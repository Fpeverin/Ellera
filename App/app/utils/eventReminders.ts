// app/utils/eventReminders.ts
//
// Promemoria push locali per i giocatori: un avviso alle 09:00 del giorno
// stesso per ogni allenamento/partita in calendario. Solo notifiche locali
// (nessun server/push token): ogni dispositivo pianifica da solo in base agli
// eventi che legge da Supabase, quindi zero costi di infrastruttura.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { CalendarEvent } from '../data/events';

const CHANNEL_ID = 'event-reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let permissionAsked = false;

async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  let granted = current.status === 'granted';
  if (!granted && !permissionAsked) {
    permissionAsked = true;
    const requested = await Notifications.requestPermissionsAsync();
    granted = requested.status === 'granted';
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Promemoria allenamenti e partite',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  return granted;
}

function parseYMDLocal(ymd: string, hour: number, minute: number): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, hour, minute, 0, 0);
}

function reminderTitle(ev: CalendarEvent): string {
  if (ev.type === 'ALLENAMENTO') return 'Allenamento oggi';
  const opp = ev.opponent || 'avversario';
  return `Partita oggi vs ${opp}`;
}

function reminderBody(ev: CalendarEvent): string {
  const label = ev.type === 'PARTITA' ? 'Partita' : 'Allenamento';
  const ora = ev.time && ev.time !== '00:00' ? ` alle ${ev.time}` : '';
  const luogo = ev.location ? ` — ${ev.location}` : '';
  return `${label}${ora}${luogo}`;
}

/**
 * Ripianifica da zero tutti i promemoria in base agli eventi passati: questa
 * app pianifica solo questi promemoria locali, quindi cancellare e
 * riprogrammare tutto a ogni chiamata evita duplicati ed eventi ormai
 * modificati/rimossi in calendario.
 */
export async function scheduleEventReminders(events: CalendarEvent[]): Promise<void> {
  // Sul web non esiste uno scheduler di notifiche locali affidabile come sui
  // dispositivi nativi (dipende dal permesso del browser e resta attivo solo
  // a pagina aperta) — disattivato per ora, vedi Backlog in PIANO_LAVORO.md.
  if (Platform.OS === 'web') return;

  const granted = await ensurePermission();
  if (!granted) return;

  await Notifications.cancelAllScheduledNotificationsAsync();

  const now = new Date();
  const relevant = events.filter((ev) => ev.type === 'PARTITA' || ev.type === 'ALLENAMENTO');

  for (const ev of relevant) {
    const triggerDate = parseYMDLocal(ev.date, 9, 0);
    if (triggerDate <= now) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: `event-${ev.id}`,
      content: {
        title: reminderTitle(ev),
        body: reminderBody(ev),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
        channelId: CHANNEL_ID,
      },
    });
  }
}

export async function clearEventReminders(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

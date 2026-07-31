// app/data/pushNotify.ts
//
// Notifiche push VERE tra utenti diversi (sondaggi, convocazione, proposte
// Live, modifiche anagrafica) — a differenza di app/utils/eventReminders.ts
// (solo promemoria locali, ogni dispositivo avvisa se stesso), qui un
// dispositivo registra il proprio push token Expo su Supabase e un altro
// dispositivo/utente lo usa per inviargli una notifica, via l'API pubblica di
// Expo (nessun server dedicato).
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

const PUSH_CHANNEL_ID = 'push-notifications';
const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
const CHUNK_SIZE = 100; // limite dei token per singola chiamata all'API di Expo

/** Registra (o aggiorna) il push token del dispositivo corrente per l'org indicata. No-op sul web. */
export async function registerPushTokenForCurrentUser(orgId: string): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const current = await Notifications.getPermissionsAsync();
    let granted = current.status === 'granted';
    if (!granted) {
      const requested = await Notifications.requestPermissionsAsync();
      granted = requested.status === 'granted';
    }
    if (!granted) return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(PUSH_CHANNEL_ID, {
        name: 'Notifiche',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    if (!token) return;

    const { error } = await supabase.rpc('register_push_token', { p_org_id: orgId, p_push_token: token });
    if (error) throw error;
  } catch (e) {
    console.error('Errore registrazione push token', e);
  }
}

/** Invia una notifica push a una lista di token Expo (a chunk, best-effort: gli errori vengono solo loggati). */
export async function sendExpoPush(tokens: string[], title: string, body: string, data?: Record<string, unknown>): Promise<void> {
  const unique = Array.from(new Set(tokens.filter(Boolean)));
  if (unique.length === 0) return;

  for (let i = 0; i < unique.length; i += CHUNK_SIZE) {
    const chunk = unique.slice(i, i + CHUNK_SIZE);
    try {
      await fetch(EXPO_PUSH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(chunk.map((to) => ({ to, title, body, data }))),
      });
    } catch (e) {
      console.error('Errore invio notifica push', e);
    }
  }
}

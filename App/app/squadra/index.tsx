import { StatsCard } from '@/app/components/StatsCard';
import { useAuth } from '@/app/context/AuthContext';
import { Player } from '@/app/data/players';
import { loadSurveysEnabled } from '@/app/data/organization';
import { usePlayers } from '@/app/hooks/usePlayers';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

function getPlayerAge(p: Player): number {
  const today = new Date();
  if (p.dob) {
    const m = p.dob.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const [_, y, mo, d] = m;
      const birth = new Date(Number(y), Number(mo) - 1, Number(d));
      let age = today.getFullYear() - birth.getFullYear();
      const hasHadBirthdayThisYear =
        today.getMonth() > birth.getMonth() ||
        (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
      if (!hasHadBirthdayThisYear) age -= 1;
      return age;
    }
  }
  return today.getFullYear() - p.year;
}

export default function GestioneSquadra() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { players } = usePlayers();
  const { membership } = useAuth();
  const isAdmin = membership?.role === 'admin';
  const isGiocatore = membership?.role === 'giocatore';
  const [surveysEnabled, setSurveysEnabled] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadSurveysEnabled().then(setSurveysEnabled).catch(() => {});
    }, [])
  );

  // === calcolo responsive: colonne e larghezza card ===
  const SECTION_SIDE_PADDING = 20;
  const GAP = 8;
  let cols = 2;
  if (width >= 700) cols = 3;
  if (width >= 900) cols = 4;
  if (width >= 1200) cols = 6;
  const containerWidth = width - SECTION_SIDE_PADDING * 2;
  const cardWidth = Math.floor((containerWidth - GAP * (cols - 1)) / cols);

  // statistiche
  const totalPlayers = players.length;
  const goalkeepers = players.filter(p => p.role === 'PORTIERE').length;
  const defenders = players.filter(p => p.role === 'DIFENSORE').length;
  const midfielders = players.filter(p => p.role === 'CENTROCAMPISTA').length;
  const forwards = players.filter(p => p.role === 'ATTACCANTE').length;
  const averageAge = Math.round(players.reduce((sum, p) => sum + getPlayerAge(p), 0) / Math.max(1, players.length));

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Gestione Squadra</Text>

      {/* Panoramica Squadra */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Panoramica Squadra</Text>

        <View style={[styles.statsRow, { gap: GAP }]}>
          <View style={[styles.statItem, { width: cardWidth }]}>
            <StatsCard title="Giocatori Totali" value={totalPlayers} icon="👥" color="#1b7f3b" />
          </View>
          <View style={[styles.statItem, { width: cardWidth }]}>
            <StatsCard title="Età Media" value={`${averageAge} anni`} icon="📊" color="#2563eb" />
          </View>
          <View style={[styles.statItem, { width: cardWidth }]}>
            <StatsCard title="Portieri" value={goalkeepers} icon="🥅" color="#dc2626" />
          </View>
          <View style={[styles.statItem, { width: cardWidth }]}>
            <StatsCard title="Difensori" value={defenders} icon="🛡️" color="#16a34a" />
          </View>
          <View style={[styles.statItem, { width: cardWidth }]}>
            <StatsCard title="Centrocampisti" value={midfielders} icon="⚽" color="#ca8a04" />
          </View>
          <View style={[styles.statItem, { width: cardWidth }]}>
            <StatsCard title="Attaccanti" value={forwards} icon="🎯" color="#dc2626" />
          </View>
        </View>
      </View>

      {/* Gestione */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Gestione</Text>

        {/* 2 card per riga */}
        <View style={styles.navigationGrid}>
          <Pressable style={[styles.navCard, styles.primaryCard]} onPress={() => router.push('/squadra/rosa')}>
            <Text style={styles.navIcon}>📋</Text>
            <Text style={styles.navTitle}>Rosa</Text>
            <Text style={styles.navSubtitle}>Gestisci i giocatori</Text>
          </Pressable>

          {!isGiocatore && (
            <Pressable style={[styles.navCard, styles.secondaryCard]} onPress={() => router.push('/moduli')}>
              <Text style={styles.navIcon}>📝</Text>
              <Text style={styles.navTitle}>Moduli</Text>
              <Text style={styles.navSubtitle}>Schemi di gioco</Text>
            </Pressable>
          )}

          {!isGiocatore && (
            <Pressable style={[styles.navCard, styles.tertiaryCard]} onPress={() => router.push('/squadra/tattiche')}>
              <Text style={styles.navIcon}>📐</Text>
              <Text style={styles.navTitle}>Tattiche</Text>
              <Text style={styles.navSubtitle}>Strategie di gioco</Text>
            </Pressable>
          )}

          {!isGiocatore && (
            <Pressable style={[styles.navCard, styles.infoCard]} onPress={() => router.push('/squadra/statistiche')}>
              <Text style={styles.navIcon}>📈</Text>
              <Text style={styles.navTitle}>Statistiche</Text>
              <Text style={styles.navSubtitle}>Dati stagionali e filtri</Text>
            </Pressable>
          )}

          {!isGiocatore && (
            <Pressable style={[styles.navCard, styles.archiveCard]} onPress={() => router.push('/squadra/archivio')}>
              <Text style={styles.navIcon}>🗄️</Text>
              <Text style={styles.navTitle}>Archivio</Text>
              <Text style={styles.navSubtitle}>Storico stagioni</Text>
            </Pressable>
          )}

          <Pressable style={[styles.navCard, styles.rosterStaffCard]} onPress={() => router.push('/squadra/staffRoster')}>
            <Text style={styles.navIcon}>🧑‍⚕️</Text>
            <Text style={styles.navTitle}>Staff</Text>
            <Text style={styles.navSubtitle}>Tecnico, Sanitario, Dirigenza</Text>
          </Pressable>

          {surveysEnabled && (
            <Pressable style={[styles.navCard, styles.surveysCard]} onPress={() => router.push('/squadra/sondaggi')}>
              <Text style={styles.navIcon}>📊</Text>
              <Text style={styles.navTitle}>Sondaggi</Text>
              <Text style={styles.navSubtitle}>
                {isGiocatore ? 'Rispondi ai sondaggi' : 'Crea e gestisci sondaggi'}
              </Text>
            </Pressable>
          )}

          {isAdmin && (
            <Pressable style={[styles.navCard, styles.staffCard]} onPress={() => router.push('/squadra/staff')}>
              <Text style={styles.navIcon}>🛡️</Text>
              <Text style={styles.navTitle}>Admin</Text>
              <Text style={styles.navSubtitle}>Logo, configurazioni, account</Text>
            </Pressable>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 24, marginTop: 20, marginHorizontal: 20, color: '#1e293b' },
  section: { marginBottom: 24, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 20, fontWeight: '600', marginBottom: 16, color: '#374151' },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap' },
  statItem: {},

  // 2-per-riga
  navigationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  navCard: {
    width: '48%', // 2 per riga
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 12,
  },
  primaryCard: { borderLeftWidth: 4, borderLeftColor: '#1b7f3b' },
  secondaryCard: { borderLeftWidth: 4, borderLeftColor: '#2563eb' },
  tertiaryCard: { borderLeftWidth: 4, borderLeftColor: '#dc2626' },
  infoCard: { borderLeftWidth: 4, borderLeftColor: '#0ea5e9' },
  archiveCard: { borderLeftWidth: 4, borderLeftColor: '#7c3aed' },
  staffCard: { borderLeftWidth: 4, borderLeftColor: '#0f766e' },
  rosterStaffCard: { borderLeftWidth: 4, borderLeftColor: '#0891b2' },
  surveysCard: { borderLeftWidth: 4, borderLeftColor: '#ca8a04' },

  navIcon: { fontSize: 32, marginBottom: 8 },
  navTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 4 },
  navSubtitle: { fontSize: 14, color: '#64748b', textAlign: 'center' },
});

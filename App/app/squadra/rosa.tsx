// app/squadra/rosa.tsx
import { Link, useFocusEffect } from 'expo-router';
import React from 'react';
import {
  Alert,
  Image,
  LayoutChangeEvent,
  Modal,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AddPlayerModal from '../components/AddPlayerModal';
import { useAuth } from '../context/AuthContext';
import RosterImportReviewModal from '../components/RosterImportReviewModal';
import { Player } from '../data/players';
import { loadPhotoMap } from '../data/playerMedia';
import {
  applyRosterImport,
  exportRosterToXlsx,
  pickAndParseRosterXlsx,
  planRosterImport,
  type RosterImportPlan,
} from '../data/rosterFile';
import { usePlayers } from '../hooks/usePlayers';

const AVATAR_DEFAULT = require('../../assets/avatar.png');

type Section = { title: string; data: Player[] };

const ROLE_ORDER: Record<string, number> = {
  PORTIERE: 1,
  DIFENSORE: 2,
  CENTROCAMPISTA: 3,
  ATTACCANTE: 4,
};

const ROLE_COLORS: Record<string, string> = {
  PORTIERE: '#dc2626',
  DIFENSORE: '#16a34a',
  CENTROCAMPISTA: '#ca8a04',
  ATTACCANTE: '#dc2626',
};

const ROLE_ICONS: Record<string, string> = {
  PORTIERE: '🥅',
  DIFENSORE: '🛡️',
  CENTROCAMPISTA: '⚽',
  ATTACCANTE: '🎯',
};

function getPlayerAge(p: Player): number {
  const today = new Date();
  const anyP = p as any;
  if (anyP.dob && typeof anyP.dob === 'string') {
    const m = anyP.dob.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const [_, y, mo, d] = m;
      const birth = new Date(Number(y), Number(mo) - 1, Number(d));
      let age = today.getFullYear() - birth.getFullYear();
      const hadBday =
        today.getMonth() > birth.getMonth() ||
        (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
      if (!hadBday) age -= 1;
      return age;
    }
  }
  return today.getFullYear() - p.year;
}

/** Mini stat compatta (per evitare le card enormi su mobile) */
function MiniStat({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string | number;
}) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniStatIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.miniStatLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.miniStatValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

export default function Rosa() {
  const { membership } = useAuth();
  const readOnly = membership?.role === 'giocatore';
  const { players, exPlayers, addPlayer, moveToEx, removePlayer, refresh } = usePlayers();
  const [photoMap, setPhotoMap] = React.useState<Record<string, string | null>>({});
  const [search, setSearch] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState<string | 'ALL'>('ALL');
  const [yearFilter, setYearFilter] = React.useState<number | null>(null);
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [customMenuPlayer, setCustomMenuPlayer] = React.useState<Player | null>(null);
  const [importPlan, setImportPlan] = React.useState<RosterImportPlan | null>(null);
  const [importBusy, setImportBusy] = React.useState(false);

  // height dinamica dell'header fisso (search + filtri + stats)
  const [stickyH, setStickyH] = React.useState(0);
  const onStickyLayout = (e: LayoutChangeEvent) => setStickyH(e.nativeEvent.layout.height);

  // ricarica la mappa foto quando la tab torna attiva
  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        try {
          setPhotoMap(await loadPhotoMap());
        } catch {
          setPhotoMap({});
        }
      })();
    }, [])
  );


  // players filtrati (riuso in più punti)
  const filteredPlayers = React.useMemo(() => {
    return players.filter(p => {
      if (roleFilter !== 'ALL' && p.role !== roleFilter) return false;
      if (yearFilter && p.year !== yearFilter) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [players, search, roleFilter, yearFilter]);

  const filteredExPlayers = React.useMemo(() => {
    return exPlayers.filter(p => {
      if (yearFilter && p.year !== yearFilter) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [exPlayers, search, yearFilter]);

  const averageAge = React.useMemo(() => {
    if (filteredPlayers.length === 0) return 0;
    return Math.round(
      filteredPlayers.reduce((sum, p) => sum + getPlayerAge(p), 0) / filteredPlayers.length
    );
  }, [filteredPlayers]);

  // sezioni per ruolo
  const sections = React.useMemo(() => {
    const grouped: Record<string, Player[]> = {};
    filteredPlayers
      .slice()
      .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name))
      .forEach(p => {
        if (!grouped[p.role]) grouped[p.role] = [];
        grouped[p.role].push(p);
      });

    return Object.keys(grouped)
      .sort((a, b) => ROLE_ORDER[a] - ROLE_ORDER[b])
      .map(role => ({ title: role, data: grouped[role] })) as Section[];
  }, [filteredPlayers]);

  // anni disponibili
  const years = React.useMemo(() => {
    const set = new Set([...players, ...exPlayers].map(p => p.year));
    return Array.from(set).sort((a, b) => b - a);
  }, [players, exPlayers]);

  const handleLongPress = (item: Player) => {
    setCustomMenuPlayer(item);
  };

  const handleMoveToEx = async () => {
    if (!customMenuPlayer) return;
    await moveToEx(customMenuPlayer.id);
    setCustomMenuPlayer(null);
  };

  const handleRemove = async () => {
    if (!customMenuPlayer) return;
    await removePlayer(customMenuPlayer.id);
    setCustomMenuPlayer(null);
  };

  const handleExportRoster = async () => {
    try {
      await exportRosterToXlsx(players, exPlayers);
    } catch {
      Alert.alert('Errore', "Impossibile esportare la rosa.");
    }
  };

  const handleImportRoster = async () => {
    try {
      const rows = await pickAndParseRosterXlsx();
      if (!rows) return; // annullato
      if (rows.length === 0) {
        Alert.alert('File vuoto', 'Non ho trovato righe da importare in questo file.');
        return;
      }
      setImportPlan(planRosterImport(rows, players, exPlayers));
    } catch {
      Alert.alert('Errore', 'Impossibile leggere il file selezionato.');
    }
  };

  const handleConfirmImport = async (moveToExIds: string[]) => {
    if (!importPlan) return;
    setImportBusy(true);
    try {
      await applyRosterImport(importPlan, moveToExIds);
      await refresh();
      setImportPlan(null);
    } catch {
      Alert.alert('Errore', "Impossibile completare l'importazione.");
    } finally {
      setImportBusy(false);
    }
  };

  const renderPlayerCard = (item: Player) => {
    const uri = (photoMap as any)[item.id];
    const age = getPlayerAge(item);
    return (
      <Pressable
        style={styles.playerCard}
        onPress={() => {}}
        onLongPress={readOnly ? undefined : () => handleLongPress(item)}
        delayLongPress={500}
      >
        <Link href={{ pathname: '/player/[id]', params: { id: item.id } }} asChild>
          <Pressable style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
            <Image source={uri ? { uri } : AVATAR_DEFAULT} style={styles.avatar} />
            <View style={styles.playerInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.playerName} numberOfLines={1}>{item.name}</Text>
              </View>
              <View style={styles.playerMeta}>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Età:</Text>
                  <Text style={styles.metaValue}>{age} anni</Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Anno:</Text>
                  <Text style={styles.metaValue}>{item.year}</Text>
                </View>
              </View>
              <View style={styles.playerStats}>
                <Text style={styles.statText}>H: {item.height}cm</Text>
                <Text style={styles.statText}>P: {item.weight}kg</Text>
              </View>
            </View>
            <View style={[styles.roleIndicator, { backgroundColor: ROLE_COLORS[item.role] }]}>
              <Text style={styles.roleIcon}>{ROLE_ICONS[item.role]}</Text>
            </View>
          </Pressable>
        </Link>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top','bottom']}>
      {/* HEADER FISSO: stats compatte + ricerca + filtri */}
      <View style={styles.sticky} onLayout={onStickyLayout}>
        <View style={styles.miniStatsRow}>
          <MiniStat icon="👥" label="Giocatori" value={filteredPlayers.length} />
          <MiniStat icon="📊" label="Età media" value={averageAge ? `${averageAge}` : '—'} />
          {!readOnly && (
            <Pressable style={styles.addBtn} onPress={() => setShowAddModal(true)}>
              <Text style={styles.addBtnText}>+ Aggiungi</Text>
            </Pressable>
          )}
        </View>

        {!readOnly && (
          <View style={styles.xlsxRow}>
            <Pressable style={styles.xlsxBtn} onPress={handleExportRoster}>
              <Text style={styles.xlsxBtnText}>📤 Esporta Excel</Text>
            </Pressable>
            <Pressable style={styles.xlsxBtn} onPress={handleImportRoster}>
              <Text style={styles.xlsxBtnText}>📥 Importa Excel</Text>
            </Pressable>
          </View>
        )}

        <TextInput
          placeholder="🔍 Cerca giocatore…"
          value={search}
          onChangeText={setSearch}
          style={styles.search}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
          <FilterChip label="Tutti" active={roleFilter === 'ALL'} onPress={() => setRoleFilter('ALL')} />
          <FilterChip label="Portieri" active={roleFilter === 'PORTIERE'} onPress={() => setRoleFilter('PORTIERE')} />
          <FilterChip label="Difensori" active={roleFilter === 'DIFENSORE'} onPress={() => setRoleFilter('DIFENSORE')} />
          <FilterChip
            label="Centrocampisti"
            active={roleFilter === 'CENTROCAMPISTA'}
            onPress={() => setRoleFilter('CENTROCAMPISTA')}
          />
          <FilterChip label="Attaccanti" active={roleFilter === 'ATTACCANTE'} onPress={() => setRoleFilter('ATTACCANTE')} />
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
          <FilterChip label="Tutti anni" active={yearFilter === null} onPress={() => setYearFilter(null)} />
          {years.map(y => (
            <FilterChip key={y} label={String(y)} active={yearFilter === y} onPress={() => setYearFilter(y)} />
          ))}
        </ScrollView>
      </View>

      {/* LISTA: occupa la maggior parte dello schermo e scorre sotto l'header */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: stickyH + 8, paddingHorizontal: 16, paddingBottom: 24 }}
        renderSectionHeader={({ section }) => (
          <View style={[styles.sectionHeader, { borderLeftColor: ROLE_COLORS[section.title] }]}>
            <Text style={styles.sectionIcon}>{ROLE_ICONS[section.title]}</Text>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionCount}>{section.data.length}</Text>
            </View>
          </View>
        )}
        renderItem={({ item }) => renderPlayerCard(item)}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        SectionSeparatorComponent={() => <View style={styles.sectionSeparator} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>👤</Text>
            <Text style={styles.emptyText}>Nessun giocatore trovato</Text>
            <Text style={styles.emptySubtext}>Prova a modificare i filtri di ricerca</Text>
          </View>
        }
        ListFooterComponent={
         filteredExPlayers.length > 0 ? (
         <View style={{ marginTop: 24 }}>
             <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>
               Ex giocatori
             </Text>
             {filteredExPlayers.map(item => {
               const uri = (photoMap as any)[item.id];
               const age = getPlayerAge(item);
               return (
                 <React.Fragment key={item.id}>
                   <Link href={{ pathname: '/player/[id]', params: { id: item.id } }} asChild>
                     <Pressable style={styles.playerCard}>
                       <Image source={uri ? { uri } : AVATAR_DEFAULT} style={styles.avatar} />
                       <View style={styles.playerInfo}>
                         <Text style={styles.playerName} numberOfLines={1}>{item.name}</Text>
                         <View style={styles.playerMeta}>
                           <View style={styles.metaItem}>
                             <Text style={styles.metaLabel}>Età:</Text>
                             <Text style={styles.metaValue}>{age} anni</Text>
                           </View>
                           <View style={styles.metaItem}>
                             <Text style={styles.metaLabel}>Anno:</Text>
                             <Text style={styles.metaValue}>{item.year}</Text>
                           </View>
                         </View>
                        <View style={styles.playerStats}>
                           <Text style={styles.statText}>H: {item.height}cm</Text>
                           <Text style={styles.statText}>P: {item.weight}kg</Text>
                         </View>
                       </View>
                       <View style={[styles.roleIndicator, { backgroundColor: ROLE_COLORS[item.role] }]}>
                         <Text style={styles.roleIcon}>{ROLE_ICONS[item.role]}</Text>
                       </View>
                     </Pressable>
                   </Link>
                   <View style={styles.separator} />
                 </React.Fragment>
              );
             })}
           </View>
         ) : null
       }
      />

      {/* Modal aggiungi giocatore */}
      <AddPlayerModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSaved={() => {}}
        addPlayer={addPlayer}
      />

      {/* Menu azioni giocatore (tenuto premuto) */}
      <Modal
        visible={!!customMenuPlayer}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomMenuPlayer(null)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setCustomMenuPlayer(null)}>
          <View style={styles.menuCard}>
            <Text style={styles.menuTitle}>{customMenuPlayer?.name}</Text>
            <Pressable style={styles.menuItem} onPress={handleMoveToEx}>
              <Text style={styles.menuItemIcon}>🔄</Text>
              <Text style={styles.menuItemText}>Sposta tra ex giocatori</Text>
            </Pressable>
            <Pressable style={[styles.menuItem, styles.menuItemDanger]} onPress={handleRemove}>
              <Text style={styles.menuItemIcon}>🗑️</Text>
              <Text style={[styles.menuItemText, { color: '#dc2626' }]}>Elimina giocatore</Text>
            </Pressable>
            <Pressable style={styles.menuCancel} onPress={() => setCustomMenuPlayer(null)}>
              <Text style={styles.menuCancelText}>Annulla</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <RosterImportReviewModal
        visible={!!importPlan}
        plan={importPlan}
        busy={importBusy}
        onCancel={() => setImportPlan(null)}
        onConfirm={handleConfirmImport}
      />
    </SafeAreaView>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },

  /** HEADER FISSO */
  sticky: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    elevation: 3,
    backgroundColor: '#f8fafc',
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  miniStatsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 6,
    alignItems: 'center',
  },
  miniStat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  miniStatIcon: { fontSize: 18 },
  miniStatLabel: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  miniStatValue: { fontSize: 16, fontWeight: '800', color: '#0f172a' },

  addBtn: {
    backgroundColor: '#1b7f3b',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  addBtnText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 14,
  },

  xlsxRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  xlsxBtn: {
    flex: 1,
    backgroundColor: '#eef2f7',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  xlsxBtnText: {
    color: '#1a202c',
    fontWeight: '700',
    fontSize: 13,
  },

  search: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    fontSize: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  filterContainer: {
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#e2e8f0',
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: '#1b7f3b',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  chipTextActive: {
    color: 'white',
  },

  /** LISTA */
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
    marginBottom: 8,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    flex: 1,
  },
  sectionBadge: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 12,
  },
  playerInfo: { flex: 1 },
  playerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  playerMeta: { flexDirection: 'row', marginBottom: 4 },
  metaItem: { flexDirection: 'row', marginRight: 16 },
  metaLabel: { fontSize: 12, color: '#64748b', marginRight: 4 },
  metaValue: { fontSize: 12, fontWeight: '600', color: '#374151' },
  playerStats: { flexDirection: 'row' },
  statText: { fontSize: 11, color: '#64748b', marginRight: 12 },
  roleIndicator: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIcon: { fontSize: 18 },
  separator: { height: 8 },
  sectionSeparator: { height: 8 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#374151', marginBottom: 4 },
  emptySubtext: { fontSize: 14, color: '#64748b', textAlign: 'center' },

  // Menu azioni giocatore custom
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  menuCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 360,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 16,
    textAlign: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  menuItemDanger: {
    borderBottomWidth: 0,
  },
  menuItemIcon: { fontSize: 20 },
  menuItemText: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  menuCancel: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  menuCancelText: { fontSize: 16, color: '#64748b', fontWeight: '600' },
});

// app/squadra/staff.tsx
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { loadPendingInvites, revokeInvite, type PendingInvite } from '../data/invites';
import { loadOrgLogoUrl, loadStaffRoleOptions, saveStaffRoleOptions, uploadOrgLogo } from '../data/organization';
import { loadOrgMembers, removeMember, setMemberLink, updateMemberRole, type OrgMember, type Role } from '../data/staff';
import { loadStaffMembers, type StaffMember } from '../data/staffRoster';
import { usePlayers } from '../hooks/usePlayers';

const ROLE_LABEL: Record<Role, string> = { admin: 'Admin', staff: 'Staff', giocatore: 'Giocatore' };
const ALL_ROLES: Role[] = ['admin', 'staff', 'giocatore'];

export default function AdminScreen() {
  const { membership, session } = useAuth();
  const { allPlayers } = usePlayers();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [pending, setPending] = useState<PendingInvite[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [staffRoles, setStaffRoles] = useState<string[]>([]);
  const [newStaffRole, setNewStaffRole] = useState('');
  const [rolesBusy, setRolesBusy] = useState(false);

  const [confirmRemove, setConfirmRemove] = useState<OrgMember | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<PendingInvite | null>(null);

  // Gestione unificata (tocco sul nome): ruolo + collegamento a giocatore/staff
  const [manageTarget, setManageTarget] = useState<OrgMember | null>(null);
  const [manageRole, setManageRole] = useState<Role>('staff');
  const [managePlayerId, setManagePlayerId] = useState<string | null>(null);
  const [manageStaffMemberId, setManageStaffMemberId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!membership) return;
    setLoading(true);
    try {
      const [m, p, logo, roles, staff] = await Promise.all([
        loadOrgMembers(membership.orgId),
        loadPendingInvites(membership.orgId),
        loadOrgLogoUrl(),
        loadStaffRoleOptions(),
        loadStaffMembers(),
      ]);
      setMembers(m);
      setPending(p);
      setLogoUrl(logo);
      setStaffRoles(roles);
      setStaffMembers(staff);
    } catch {
      Alert.alert('Errore', 'Impossibile caricare i dati dello staff.');
    } finally {
      setLoading(false);
    }
  }, [membership]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const pickLogo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permessi', 'Serve il permesso per accedere alle foto.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.9,
    });
    if (res.canceled) return;
    setLogoBusy(true);
    try {
      const publicUrl = await uploadOrgLogo(res.assets[0].uri);
      setLogoUrl(publicUrl);
    } catch {
      Alert.alert('Errore', 'Impossibile salvare il logo.');
    } finally {
      setLogoBusy(false);
    }
  };

  if (membership && membership.role !== 'admin') {
    return (
      <View style={styles.center}>
        <Text style={styles.deniedText}>Solo l'admin della squadra può accedere a questa pagina.</Text>
      </View>
    );
  }

  const shareCode = async (code: string, label: string) => {
    try {
      await Share.share({ message: `Codice personale per ${label} su TeamBoard (squadra "${membership?.orgName}"): ${code}` });
    } catch {}
  };

  const handleAddStaffRole = async () => {
    const name = newStaffRole.trim();
    if (!name || staffRoles.includes(name)) return;
    const next = [...staffRoles, name];
    setRolesBusy(true);
    try {
      await saveStaffRoleOptions(next);
      setStaffRoles(next);
      setNewStaffRole('');
    } catch {
      Alert.alert('Errore', 'Impossibile salvare il ruolo.');
    } finally {
      setRolesBusy(false);
    }
  };

  const handleRemoveStaffRole = async (name: string) => {
    const next = staffRoles.filter((r) => r !== name);
    setRolesBusy(true);
    try {
      await saveStaffRoleOptions(next);
      setStaffRoles(next);
    } catch {
      Alert.alert('Errore', 'Impossibile rimuovere il ruolo.');
    } finally {
      setRolesBusy(false);
    }
  };

  const handleRevoke = async () => {
    if (!confirmRevoke) return;
    setBusy(true);
    try {
      await revokeInvite(confirmRevoke.id);
      setConfirmRevoke(null);
      await load();
    } catch {
      Alert.alert('Errore', 'Impossibile revocare l\'invito.');
    } finally {
      setBusy(false);
    }
  };

  const openManage = (m: OrgMember) => {
    setManageRole(m.role);
    setManagePlayerId(m.playerId);
    setManageStaffMemberId(m.staffMemberId);
    setManageTarget(m);
  };

  const closeManage = () => setManageTarget(null);

  const handleSaveManage = async () => {
    if (!membership || !manageTarget) return;
    setBusy(true);
    try {
      if (manageRole !== manageTarget.role) {
        await updateMemberRole(membership.orgId, manageTarget.userId, manageRole);
      }
      const nextPlayerId = manageRole === 'giocatore' ? managePlayerId : null;
      const nextStaffMemberId = manageRole === 'staff' ? manageStaffMemberId : null;
      if (nextPlayerId !== manageTarget.playerId || nextStaffMemberId !== manageTarget.staffMemberId) {
        await setMemberLink(membership.orgId, manageTarget.userId, nextPlayerId, nextStaffMemberId);
      }
      closeManage();
      await load();
    } catch {
      Alert.alert('Errore', 'Impossibile salvare le modifiche.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    if (!membership || !confirmRemove) return;
    setBusy(true);
    try {
      await removeMember(membership.orgId, confirmRemove.userId);
      setConfirmRemove(null);
      await load();
    } catch {
      Alert.alert('Errore', 'Impossibile rimuovere il membro.');
    } finally {
      setBusy(false);
    }
  };

  if (loading && members.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1b7f3b" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={styles.sectionTitle}>Logo squadra</Text>
        <View style={styles.logoRow}>
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={styles.logoPreview} resizeMode="contain" />
          ) : (
            <View style={[styles.logoPreview, styles.logoPlaceholder]}>
              <Text style={{ fontSize: 28 }}>🛡️</Text>
            </View>
          )}
          <Pressable style={[styles.btn, styles.btnOutline, { flex: 0, paddingHorizontal: 20 }]} onPress={pickLogo} disabled={logoBusy}>
            <Text style={styles.btnOutlineText}>{logoBusy ? 'Caricamento…' : logoUrl ? 'Cambia logo' : 'Carica logo'}</Text>
          </Pressable>
        </View>

        <Text style={styles.cardHint}>
          Ogni codice di accesso è personale: per un Giocatore si genera dalla sua scheda in Rosa,
          per lo Staff dalla sua scheda in Staff.
        </Text>

        <Text style={styles.sectionTitle}>Configurazioni</Text>
        <View style={styles.section}>
          <Text style={styles.configLabel}>Ruoli disponibili per lo Staff</Text>
          {staffRoles.map((role) => (
            <View key={role} style={styles.roleRow}>
              <Text style={{ flex: 1 }}>{role}</Text>
              <Pressable onPress={() => handleRemoveStaffRole(role)} disabled={rolesBusy}>
                <Text style={{ fontSize: 18 }}>🗑️</Text>
              </Pressable>
            </View>
          ))}
          <View style={styles.addRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginVertical: 0 }]}
              placeholder="Nuovo ruolo"
              value={newStaffRole}
              onChangeText={setNewStaffRole}
            />
            <Pressable style={styles.smallBtn} onPress={handleAddStaffRole} disabled={rolesBusy}>
              <Text style={styles.smallBtnText}>+ Aggiungi</Text>
            </Pressable>
          </View>
        </View>

        {pending.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Inviti in attesa ({pending.length})</Text>
            {pending.map((inv) => (
              <View key={inv.id} style={styles.memberCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberEmail}>
                    {inv.role === 'giocatore' ? (inv.playerName ?? 'Giocatore') : (inv.displayName ?? 'Staff')}
                  </Text>
                  <Text style={[styles.roleBadge, inv.role === 'staff' ? styles.roleStaff : styles.roleGiocatore]}>
                    {ROLE_LABEL[inv.role]}
                  </Text>
                  <Text style={styles.inviteCode}>{inv.code}</Text>
                </View>
                <View style={styles.memberActions}>
                  <Pressable style={styles.memberActionBtn} onPress={() => shareCode(inv.code, inv.role === 'giocatore' ? `collegarti come "${inv.playerName}"` : `entrare come Staff (${inv.displayName})`)}>
                    <Text style={styles.memberActionText}>Condividi</Text>
                  </Pressable>
                  <Pressable style={styles.memberActionBtn} onPress={() => setConfirmRevoke(inv)}>
                    <Text style={[styles.memberActionText, { color: '#dc2626' }]}>Revoca</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        )}

        <Text style={styles.sectionTitle}>Membri della squadra ({members.length})</Text>
        <Text style={styles.cardHint}>Tocca il nome di una persona per cambiarne il ruolo o il collegamento.</Text>
        {members.map((m) => {
          const isMe = m.userId === session?.user?.id;
          const linkedName = m.role === 'giocatore' ? m.playerName : m.role === 'staff' ? m.staffMemberName : null;
          return (
            <View key={m.userId} style={styles.memberCard}>
              <Pressable
                style={{ flex: 1 }}
                onPress={() => !isMe && openManage(m)}
                disabled={isMe}
              >
                <View style={styles.memberNameRow}>
                  <Text style={styles.memberEmail}>
                    {m.email}
                    {isMe ? ' (tu)' : ''}
                  </Text>
                  {!isMe && <Text style={styles.editHint}>✏️</Text>}
                </View>
                <Text style={[styles.roleBadge, m.role === 'admin' ? styles.roleAdmin : m.role === 'staff' ? styles.roleStaff : styles.roleGiocatore]}>
                  {ROLE_LABEL[m.role]}
                </Text>
                {linkedName ? (
                  <Text style={styles.linkedPlayer}>Collegato a: {linkedName}</Text>
                ) : m.role !== 'admin' ? (
                  <Text style={[styles.linkedPlayer, { color: '#dc2626' }]}>Non collegato a nessuno</Text>
                ) : null}
              </Pressable>
              {!isMe && (
                <View style={styles.memberActions}>
                  <Pressable
                    style={[styles.memberActionBtn, styles.memberActionDanger]}
                    onPress={() => setConfirmRemove(m)}
                    disabled={busy}
                  >
                    <Text style={[styles.memberActionText, { color: '#dc2626' }]}>Rimuovi</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* gestione unificata: ruolo + collegamento */}
      <Modal visible={!!manageTarget} transparent animationType="fade" onRequestClose={closeManage}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: '85%' }]}>
            <ScrollView>
              <Text style={styles.modalTitle}>{manageTarget?.email}</Text>

              <Text style={styles.fieldLabel}>Ruolo</Text>
              <View style={styles.roleChoiceRow}>
                {ALL_ROLES.map((r) => (
                  <Pressable
                    key={r}
                    style={[styles.roleChoice, manageRole === r && styles.roleChoiceActive]}
                    onPress={() => setManageRole(r)}
                  >
                    <Text style={[styles.roleChoiceText, manageRole === r && styles.roleChoiceTextActive]}>
                      {ROLE_LABEL[r]}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {manageRole === 'giocatore' && (
                <>
                  <Text style={styles.fieldLabel}>Collegato al giocatore</Text>
                  <Pressable style={styles.linkChoiceRow} onPress={() => setManagePlayerId(null)}>
                    <View style={[styles.radioDot, !managePlayerId && styles.radioDotActive]} />
                    <Text style={styles.linkChoiceText}>— Nessuno —</Text>
                  </Pressable>
                  {[...allPlayers].sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
                    <Pressable key={p.id} style={styles.linkChoiceRow} onPress={() => setManagePlayerId(p.id)}>
                      <View style={[styles.radioDot, managePlayerId === p.id && styles.radioDotActive]} />
                      <Text style={styles.linkChoiceText}>{p.name}</Text>
                    </Pressable>
                  ))}
                </>
              )}

              {manageRole === 'staff' && (
                <>
                  <Text style={styles.fieldLabel}>Collegato alla persona dello Staff</Text>
                  <Pressable style={styles.linkChoiceRow} onPress={() => setManageStaffMemberId(null)}>
                    <View style={[styles.radioDot, !manageStaffMemberId && styles.radioDotActive]} />
                    <Text style={styles.linkChoiceText}>— Nessuno —</Text>
                  </Pressable>
                  {[...staffMembers].sort((a, b) => a.name.localeCompare(b.name)).map((s) => (
                    <Pressable key={s.id} style={styles.linkChoiceRow} onPress={() => setManageStaffMemberId(s.id)}>
                      <View style={[styles.radioDot, manageStaffMemberId === s.id && styles.radioDotActive]} />
                      <Text style={styles.linkChoiceText}>{s.name}</Text>
                    </Pressable>
                  ))}
                </>
              )}

              {manageRole === 'admin' && (
                <Text style={styles.cardHint}>Gli Admin non sono collegati a nessuna persona.</Text>
              )}

              <View style={styles.row}>
                <Pressable style={[styles.btn, styles.btnOutline]} onPress={closeManage}>
                  <Text style={styles.btnOutlineText}>Annulla</Text>
                </Pressable>
                <Pressable style={[styles.btn, styles.btnPrimary]} onPress={handleSaveManage} disabled={busy}>
                  <Text style={styles.btnPrimaryText}>{busy ? 'Salvataggio…' : 'Salva'}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* conferma revoca invito */}
      <Modal visible={!!confirmRevoke} transparent animationType="fade" onRequestClose={() => setConfirmRevoke(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Revocare questo invito?</Text>
            <Text style={styles.modalText}>Il codice smetterà subito di funzionare.</Text>
            <View style={styles.row}>
              <Pressable style={[styles.btn, styles.btnOutline]} onPress={() => setConfirmRevoke(null)}>
                <Text style={styles.btnOutlineText}>Annulla</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.btnDanger]} onPress={handleRevoke} disabled={busy}>
                <Text style={styles.btnPrimaryText}>{busy ? 'Attendere…' : 'Revoca'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* conferma rimozione membro */}
      <Modal visible={!!confirmRemove} transparent animationType="fade" onRequestClose={() => setConfirmRemove(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Rimuovere {confirmRemove?.email}?</Text>
            <Text style={styles.modalText}>Perderà l'accesso ai dati della squadra.</Text>
            <View style={styles.row}>
              <Pressable style={[styles.btn, styles.btnOutline]} onPress={() => setConfirmRemove(null)}>
                <Text style={styles.btnOutlineText}>Annulla</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.btnDanger]} onPress={handleRemove} disabled={busy}>
                <Text style={styles.btnPrimaryText}>{busy ? 'Attendere…' : 'Rimuovi'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#f8fafc' },
  deniedText: { fontSize: 16, color: '#64748b', textAlign: 'center' },

  cardHint: { fontSize: 13, color: '#64748b', marginBottom: 16 },

  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24 },
  logoPreview: { width: 64, height: 64, borderRadius: 12, backgroundColor: '#f1f5f9' },
  logoPlaceholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e5e7eb' },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 12, marginTop: 8 },

  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  configLabel: { fontSize: 14, fontWeight: '700', color: '#334155', marginBottom: 8 },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  addRow: { flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' },
  smallBtn: { backgroundColor: '#1b7f3b', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8 },
  smallBtnText: { color: 'white', fontWeight: '700', fontSize: 13 },

  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  memberEmail: { fontSize: 15, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  editHint: { fontSize: 13, marginBottom: 4 },
  linkedPlayer: { fontSize: 12, color: '#64748b', marginTop: 4 },
  inviteCode: { fontSize: 18, fontWeight: '900', letterSpacing: 1, color: '#1b7f3b', marginTop: 6 },
  roleBadge: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  roleAdmin: { backgroundColor: '#dcfce7', color: '#1b7f3b' },
  roleStaff: { backgroundColor: '#e0e7ff', color: '#3730a3' },
  roleGiocatore: { backgroundColor: '#fef3c7', color: '#92400e' },

  memberActions: { gap: 6, alignItems: 'flex-end' },
  memberActionBtn: { paddingVertical: 6, paddingHorizontal: 10 },
  memberActionDanger: {},
  memberActionText: { fontSize: 13, fontWeight: '700', color: '#2563eb' },

  row: { flexDirection: 'row', gap: 12, marginTop: 4 },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  btnPrimary: { backgroundColor: '#1b7f3b' },
  btnPrimaryText: { color: '#fff', fontWeight: '700' },
  btnOutline: { backgroundColor: '#f1f5f9' },
  btnOutlineText: { color: '#475569', fontWeight: '700' },
  btnDanger: { backgroundColor: '#dc2626' },
  btnDisabled: { opacity: 0.5 },

  input: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginVertical: 12,
  },

  backLink: { marginTop: 4, alignSelf: 'center' },
  backLinkText: { color: '#666', fontSize: 14, fontWeight: '600' },

  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#334155', marginTop: 14, marginBottom: 8 },
  roleChoiceRow: { flexDirection: 'row', gap: 8 },
  roleChoice: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  roleChoiceActive: { backgroundColor: '#1b7f3b', borderColor: '#1b7f3b' },
  roleChoiceText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  roleChoiceTextActive: { color: '#fff' },

  linkChoiceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  linkChoiceText: { fontSize: 14, color: '#1e293b' },
  radioDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#cbd5e1',
  },
  radioDotActive: { borderColor: '#1b7f3b', backgroundColor: '#1b7f3b' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBox: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 420 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#1a202c', marginBottom: 8, textAlign: 'center' },
  modalText: { fontSize: 14, color: '#64748b', marginBottom: 16, textAlign: 'center' },
});

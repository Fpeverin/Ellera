// app/squadra/staff.tsx
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { createStaffInvite, loadPendingInvites, revokeInvite, type PendingInvite } from '../data/invites';
import { loadOrgLogoUrl, uploadOrgLogo } from '../data/organization';
import { loadOrgMembers, removeMember, updateMemberRole, type OrgMember, type Role } from '../data/staff';

const ROLE_LABEL: Record<Role, string> = { admin: 'Admin', staff: 'Staff', giocatore: 'Giocatore' };
const ALL_ROLES: Role[] = ['admin', 'staff', 'giocatore'];

export default function Staff() {
  const { membership, session } = useAuth();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [pending, setPending] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);

  const [confirmRemove, setConfirmRemove] = useState<OrgMember | null>(null);
  const [roleTarget, setRoleTarget] = useState<OrgMember | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<PendingInvite | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState('');

  const load = useCallback(async () => {
    if (!membership) return;
    setLoading(true);
    try {
      const [m, p, logo] = await Promise.all([
        loadOrgMembers(membership.orgId),
        loadPendingInvites(membership.orgId),
        loadOrgLogoUrl(),
      ]);
      setMembers(m);
      setPending(p);
      setLogoUrl(logo);
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
    } catch (e: any) {
      const dump = JSON.stringify(e, Object.getOwnPropertyNames(e ?? {}), 2);
      Alert.alert('Errore', `Impossibile salvare il logo.\n\n${dump}`);
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

  const handleCreateStaffInvite = async () => {
    if (!membership || !inviteName.trim()) return;
    setBusy(true);
    try {
      const code = await createStaffInvite(membership.orgId, inviteName.trim());
      setShowInviteModal(false);
      setInviteName('');
      await load();
      await shareCode(code, `entrare come Staff (${inviteName.trim()})`);
    } catch {
      Alert.alert('Errore', 'Impossibile creare l\'invito.');
    } finally {
      setBusy(false);
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

  const handleSetRole = async (role: Role) => {
    if (!membership || !roleTarget) return;
    setBusy(true);
    try {
      await updateMemberRole(membership.orgId, roleTarget.userId, role);
      setRoleTarget(null);
      await load();
    } catch {
      Alert.alert('Errore', 'Impossibile cambiare il ruolo.');
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
          per lo Staff da qui sotto.
        </Text>

        <Pressable style={[styles.btn, styles.btnPrimary, { marginBottom: 24 }]} onPress={() => setShowInviteModal(true)}>
          <Text style={styles.btnPrimaryText}>+ Invita membro staff</Text>
        </Pressable>

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
        {members.map((m) => {
          const isMe = m.userId === session?.user?.id;
          return (
            <View key={m.userId} style={styles.memberCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberEmail}>
                  {m.email}
                  {isMe ? ' (tu)' : ''}
                </Text>
                <Text style={[styles.roleBadge, m.role === 'admin' ? styles.roleAdmin : m.role === 'staff' ? styles.roleStaff : styles.roleGiocatore]}>
                  {ROLE_LABEL[m.role]}
                </Text>
                {m.role === 'giocatore' && m.playerName && (
                  <Text style={styles.linkedPlayer}>Collegato a: {m.playerName}</Text>
                )}
              </View>
              {!isMe && (
                <View style={styles.memberActions}>
                  <Pressable style={styles.memberActionBtn} onPress={() => setRoleTarget(m)} disabled={busy}>
                    <Text style={styles.memberActionText}>Cambia ruolo</Text>
                  </Pressable>
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

      {/* invita membro staff */}
      <Modal visible={showInviteModal} transparent animationType="fade" onRequestClose={() => setShowInviteModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Invita membro staff</Text>
            <Text style={styles.modalText}>Inserisci un nome per riconoscerlo (es. "Marco - allenatore in seconda").</Text>
            <TextInput
              style={styles.input}
              placeholder="Nome"
              value={inviteName}
              onChangeText={setInviteName}
            />
            <View style={styles.row}>
              <Pressable style={[styles.btn, styles.btnOutline]} onPress={() => { setShowInviteModal(false); setInviteName(''); }}>
                <Text style={styles.btnOutlineText}>Annulla</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.btnPrimary, !inviteName.trim() && styles.btnDisabled]}
                onPress={handleCreateStaffInvite}
                disabled={busy || !inviteName.trim()}
              >
                <Text style={styles.btnPrimaryText}>{busy ? 'Creazione…' : 'Crea codice'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* cambia ruolo */}
      <Modal visible={!!roleTarget} transparent animationType="fade" onRequestClose={() => setRoleTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Cambia ruolo di {roleTarget?.email}</Text>
            <View style={{ gap: 8, marginTop: 8, marginBottom: 16 }}>
              {ALL_ROLES.filter((r) => r !== roleTarget?.role).map((r) => (
                <Pressable key={r} style={[styles.btn, styles.btnOutline]} onPress={() => handleSetRole(r)} disabled={busy}>
                  <Text style={styles.btnOutlineText}>Rendi {ROLE_LABEL[r]}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={styles.backLink} onPress={() => setRoleTarget(null)}>
              <Text style={styles.backLinkText}>Annulla</Text>
            </Pressable>
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
  memberEmail: { fontSize: 15, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
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

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBox: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 420 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#1a202c', marginBottom: 8, textAlign: 'center' },
  modalText: { fontSize: 14, color: '#64748b', marginBottom: 16, textAlign: 'center' },
});

// app/onboarding/team.tsx
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';

type Mode = 'choose' | 'create' | 'join';

export default function TeamOnboarding() {
  const router = useRouter();
  const { createOrganization, redeemInvite, signOut } = useAuth();
  const [mode, setMode] = useState<Mode>('choose');
  const [teamName, setTeamName] = useState('');
  const [personalCode, setPersonalCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onCreate = async () => {
    setError(null);
    setBusy(true);
    const { error } = await createOrganization(teamName.trim());
    setBusy(false);
    if (error) {
      setError(error);
      return;
    }
    router.replace('/');
  };

  const onJoin = async () => {
    setError(null);
    setBusy(true);
    const { error } = await redeemInvite(personalCode.trim());
    setBusy(false);
    if (error) {
      setError(error);
      return;
    }
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.content}>
          <Text style={styles.title}>Benvenuto</Text>
          <Text style={styles.subtitle}>Per continuare, crea una nuova squadra oppure entra in una esistente</Text>

          {mode === 'choose' && (
            <>
              <Pressable style={styles.button} onPress={() => setMode('create')}>
                <Text style={styles.buttonText}>Crea una nuova squadra</Text>
              </Pressable>
              <Pressable style={[styles.button, styles.secondaryButton]} onPress={() => setMode('join')}>
                <Text style={[styles.buttonText, styles.secondaryButtonText]}>Ho un codice personale</Text>
              </Pressable>
            </>
          )}

          {mode === 'create' && (
            <>
              <TextInput
                style={styles.input}
                placeholder="Nome squadra (es. Ellera)"
                value={teamName}
                onChangeText={setTeamName}
              />
              {error && <Text style={styles.error}>{error}</Text>}
              <Pressable
                style={[styles.button, (busy || !teamName.trim()) && styles.buttonDisabled]}
                onPress={onCreate}
                disabled={busy || !teamName.trim()}
              >
                <Text style={styles.buttonText}>{busy ? 'Creazione…' : 'Crea squadra'}</Text>
              </Pressable>
              <Pressable style={styles.backLink} onPress={() => { setError(null); setMode('choose'); }}>
                <Text style={styles.backLinkText}>Indietro</Text>
              </Pressable>
            </>
          )}

          {mode === 'join' && (
            <>
              <TextInput
                style={styles.input}
                placeholder="Codice personale"
                autoCapitalize="none"
                value={personalCode}
                onChangeText={setPersonalCode}
              />
              {error && <Text style={styles.error}>{error}</Text>}
              <Pressable
                style={[styles.button, (busy || !personalCode.trim()) && styles.buttonDisabled]}
                onPress={onJoin}
                disabled={busy || !personalCode.trim()}
              >
                <Text style={styles.buttonText}>{busy ? 'Ingresso…' : 'Entra nella squadra'}</Text>
              </Pressable>
              <Pressable style={styles.backLink} onPress={() => { setError(null); setMode('choose'); }}>
                <Text style={styles.backLinkText}>Indietro</Text>
              </Pressable>
            </>
          )}

          <Pressable style={styles.signOutLink} onPress={() => signOut()}>
            <Text style={styles.signOutText}>Esci</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  title: { fontSize: 28, fontWeight: '800', color: '#1a202c', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 32 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
  },
  error: { color: '#dc2626', marginBottom: 12, textAlign: 'center' },
  button: {
    backgroundColor: '#1b7f3b',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryButton: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#1b7f3b' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryButtonText: { color: '#1b7f3b' },
  backLink: { marginTop: 16, alignSelf: 'center' },
  backLinkText: { color: '#666', fontSize: 14, fontWeight: '600' },
  signOutLink: { marginTop: 32, alignSelf: 'center' },
  signOutText: { color: '#dc2626', fontSize: 14, fontWeight: '600' },
});

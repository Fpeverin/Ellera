// app/register.tsx
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PasswordInput from './components/PasswordInput';
import { useAuth } from './context/AuthContext';

export default function Register() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const canSubmit =
    email.trim().length > 0 && password.length >= 6 && password === confirmPassword && !busy;

  const onSubmit = async () => {
    setError(null);
    if (password !== confirmPassword) {
      setError('Le due password non coincidono');
      return;
    }
    setBusy(true);
    const { error, needsEmailConfirmation } = await signUp(email.trim(), password);
    setBusy(false);
    if (error) {
      setError(error);
      return;
    }
    if (needsEmailConfirmation) {
      setConfirmationSent(true);
      return;
    }
    router.replace('/onboarding/team');
  };

  if (confirmationSent) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Controlla la tua email</Text>
          <Text style={styles.subtitle}>
            Ti abbiamo inviato un link di conferma a {email.trim()}. Apri il link, poi torna qui e accedi.
          </Text>
          <Pressable style={styles.button} onPress={() => router.replace('/login')}>
            <Text style={styles.buttonText}>Vai al login</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.content}>
          <Text style={styles.title}>Crea un account</Text>
          <Text style={styles.subtitle}>Registrati per accedere a ElleraApp</Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <PasswordInput
            placeholder="Password (almeno 6 caratteri)"
            value={password}
            onChangeText={setPassword}
          />
          <PasswordInput
            placeholder="Conferma password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={[styles.button, !canSubmit && styles.buttonDisabled]}
            onPress={onSubmit}
            disabled={!canSubmit}
          >
            <Text style={styles.buttonText}>{busy ? 'Creazione account…' : 'Registrati'}</Text>
          </Pressable>

          <Link href="/login" style={styles.link}>
            <Text style={styles.linkText}>Hai già un account? Accedi</Text>
          </Link>
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
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  link: { marginTop: 20, alignSelf: 'center' },
  linkText: { color: '#1b7f3b', fontSize: 14, fontWeight: '600' },
});

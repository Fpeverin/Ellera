// deve restare il layout root del segmento "app"
import 'react-native-url-polyfill/auto'; // richiesto da Supabase, prima di tutto
import { Redirect, Stack, useSegments } from 'expo-router';
import 'react-native-gesture-handler'; // prima di tutto
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ActivityIndicator, View } from 'react-native';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TimerProvider } from './context/TimerContext';

function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, membership, loading } = useAuth();
  const segments = useSegments();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f7fa' }}>
        <ActivityIndicator size="large" color="#1b7f3b" />
      </View>
    );
  }

  const inAuthScreens = segments[0] === 'login' || segments[0] === 'register';
  const inOnboarding = segments[0] === 'onboarding';

  if (!session && !inAuthScreens) {
    return <Redirect href="/login" />;
  }
  if (session && !membership && !inOnboarding) {
    return <Redirect href="/onboarding/team" />;
  }
  if (session && membership && (inAuthScreens || inOnboarding)) {
    return <Redirect href="/" />;
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <TimerProvider>
          <AuthGate>
            <Stack screenOptions={{ headerShown: false }} />
          </AuthGate>
        </TimerProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

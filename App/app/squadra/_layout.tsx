import { Stack } from 'expo-router';
import TeamLogo from '../components/TeamLogo';

export default function SquadraLayout() {
  return (
    <Stack screenOptions={{ headerShown: true, headerRight: () => <TeamLogo size={28} style={{ marginRight: 12 }} /> }}>
      <Stack.Screen name="index" options={{ title: 'Gestione Squadra' }} />
      <Stack.Screen name="rosa" options={{ title: 'Rosa' }} />
      <Stack.Screen name="formazioni" options={{ title: 'Formazioni' }} />
      <Stack.Screen name="tattiche" options={{ title: 'Tattiche' }} />
      <Stack.Screen name="archivio" options={{ title: 'Archivio Stagioni' }} />
      <Stack.Screen name="archivio/[id]/index" options={{ title: 'Stagione' }} />
      <Stack.Screen name="archivio/[id]/match" options={{ title: 'Partita Archiviata' }} />
      <Stack.Screen name="staff" options={{ title: 'Admin' }} />
      <Stack.Screen name="staffRoster" options={{ title: 'Staff' }} />
      <Stack.Screen name="sondaggi/index" options={{ title: 'Sondaggi' }} />
      <Stack.Screen name="sondaggi/editor" options={{ title: 'Sondaggio' }} />
    </Stack>
  );
}

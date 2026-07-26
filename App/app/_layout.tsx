// deve restare il layout root del segmento "app"
import { Stack } from 'expo-router';
import 'react-native-gesture-handler'; // prima di tutto
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { TimerProvider } from './context/TimerContext';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <TimerProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </TimerProvider>
    </GestureHandlerRootView>
  );
}

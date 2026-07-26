// app/eventi/nuovo.tsx
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import EventEditor from '../components/EventEditor';
import type { EventType } from '../data/events';

export default function NuovoEventoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string; date?: string; time?: string }>();

  const initialType: EventType = params.type === 'PARTITA' ? 'PARTITA' : 'ALLENAMENTO';
  const defaultDate = typeof params.date === 'string' ? params.date : undefined;
  const defaultTime = typeof params.time === 'string' ? params.time : undefined;

  return (
    <View style={{ flex: 1 }}>
      <EventEditor
        initialType={initialType}
        defaultDate={defaultDate}
        defaultTime={defaultTime}
        onCancel={() => router.back()}
        onSaved={(ev) => {
          // Torna indietro alla lista chiamante.
          router.back();
        }}
      />
    </View>
  );
}

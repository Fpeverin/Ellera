// app/eventi/partita/[id]/index.tsx
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function PartitaIndexRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Redirect
      href={{ pathname: '/eventi/partita/[id]/live', params: { id } }}
    />
  );
}

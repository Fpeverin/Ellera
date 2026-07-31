// app/components/TeamLogo.tsx
//
// Logo squadra (caricato dall'Admin in Gestione Squadra → Admin), mostrato
// nell'header di ogni schermata quando è stato caricato — non renderizza
// nulla se non c'è ancora un logo. Vedi app/hooks/useOrgLogo.ts.
import { Image, StyleSheet, View, ViewStyle } from 'react-native';
import { useOrgLogo } from '../hooks/useOrgLogo';

type Props = { size?: number; style?: ViewStyle };

export default function TeamLogo({ size = 32, style }: Props) {
  const url = useOrgLogo();
  if (!url) return null;

  return (
    <View style={style}>
      <Image source={{ uri: url }} style={[styles.logo, { width: size, height: size }]} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  logo: { borderRadius: 6 },
});

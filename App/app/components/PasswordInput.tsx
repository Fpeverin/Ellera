// app/components/PasswordInput.tsx
//
// TextInput per password con un bottone 👁️ per mostrare/nascondere il testo
// in chiaro mentre lo si digita.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

type Props = Omit<TextInputProps, 'secureTextEntry'>;

export default function PasswordInput(props: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.wrap}>
      <TextInput {...props} secureTextEntry={!visible} style={styles.input} />
      <Pressable style={styles.toggle} onPress={() => setVisible((v) => !v)} hitSlop={8}>
        <Text style={styles.toggleText}>{visible ? '🙈' : '👁️'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
  },
  input: { flex: 1, padding: 16, fontSize: 16 },
  toggle: { paddingHorizontal: 14 },
  toggleText: { fontSize: 18 },
});

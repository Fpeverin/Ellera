import React from 'react';
import { View, Text, TextInput, Button } from 'react-native';

export default function Note() {
  const [note, setNote] = React.useState('');
  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Note Partita</Text>
      <TextInput
        placeholder="Appunti live..."
        style={{ borderColor: 'gray', borderWidth: 1, padding: 10, marginVertical: 10 }}
        multiline
        value={note}
        onChangeText={setNote}
      />
      <Button title="Salva Nota" onPress={() => alert('Nota salvata')} />
    </View>
  );
}

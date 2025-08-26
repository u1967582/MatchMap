import { useState } from 'react';
import { View, TextInput, Button, Alert, Text, StyleSheet } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { supabase } from '~/utils/supabase';

export default function SetNewPassword() {
  const [pwd, setPwd] = useState('');
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const onSave = async () => {
    try {
      if (pwd.length < 8) {
        Alert.alert('Error', 'La contraseña debe tener al menos 8 caracteres.');
        return;
      }
      setSaving(true);
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw error;
      Alert.alert('Listo', 'Tu contraseña ha sido actualizada.');
      await supabase.auth.signOut();
      router.replace('/(auth)/login');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudo actualizar la contraseña');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <Text style={styles.label}>Introduce tu nueva contraseña</Text>
      <TextInput
        secureTextEntry
        value={pwd}
        onChangeText={setPwd}
        placeholder="Nueva contraseña"
        placeholderTextColor="#94A3B8"
        style={styles.input}
      />
      <Button title={saving ? 'Guardando…' : 'Guardar'} onPress={onSave} disabled={saving} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C2A3A', padding: 16, justifyContent: 'center' },
  label: { marginBottom: 8, color: '#FFFFFF' },
  input: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', color: '#FFFFFF', padding: 12, borderRadius: 8, marginBottom: 12 }
});



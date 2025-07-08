import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, SafeAreaView } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { supabase } from '~/utils/supabase';
import ScreenTitle from '~/components/ui/ScreenTitle';
import InputField from '~/components/ui/InputField';
import CustomButton from '~/components/ui/CustomButton';

const RegisterScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isBarOwner, setIsBarOwner] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const validateForm = () => {
    if (!email.trim()) {
      Alert.alert('Error', 'El email es requerido');
      return false;
    }
    if (!email.includes('@')) {
      Alert.alert('Error', 'Ingresa un email válido');
      return false;
    }
    if (!password.trim()) {
      Alert.alert('Error', 'La contraseña es requerida');
      return false;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
      return false;
    }
    if (!username.trim()) {
      Alert.alert('Error', 'El nombre de usuario es requerido');
      return false;
    }
    return true;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      // 1. Register user with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
      });

      if (authError) {
        Alert.alert('Error de registro', authError.message);
        return;
      }

      if (authData.user) {
        // 2. Insert user data into users table
        const { error: insertError } = await supabase
          .from('users')
          .insert([
            {
              email: email.trim(),
              username: username.trim(),
              is_bar_owner: isBarOwner,
            }
          ]);

        if (insertError) {
          Alert.alert('Error', 'Error al crear el perfil de usuario');
          return;
        }

        Alert.alert('Éxito', 'Usuario registrado correctamente', [
          { text: 'OK', onPress: () => router.push('/') }
        ]);
      }
    } catch (error) {
      Alert.alert('Error', 'Error inesperado durante el registro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.contentContainer}>
        <ScreenTitle 
          title="Crear Cuenta" 
          color="#333" 
          shadow={false}
          marginBottom={40}
        />
        
        <InputField
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        
        <InputField
          placeholder="Contraseña"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />
        
        <InputField
          placeholder="Nombre de usuario"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
        />
        
        <TouchableOpacity 
          style={styles.checkboxContainer}
          onPress={() => setIsBarOwner(!isBarOwner)}
        >
          <View style={[styles.checkbox, isBarOwner && styles.checkboxChecked]}>
            {isBarOwner && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.checkboxLabel}>¿Eres propietario de un bar?</Text>
        </TouchableOpacity>
        
        <CustomButton
          text="Registrarse"
          onPress={handleRegister}
          variant="primary"
          loading={loading}
        />
        
        <View style={styles.linkContainer}>
          <Link href="/(auth)/login" style={styles.link}>
            ¿Ya tienes cuenta? Inicia sesión
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 4,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  checkmark: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#333',
  },
  linkContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  link: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
});

export default RegisterScreen; 
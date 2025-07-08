import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, SafeAreaView } from 'react-native';
import { Link, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '~/utils/supabase';
import ScreenTitle from '~/components/ui/ScreenTitle';
import InputField from '~/components/ui/InputField';
import CustomButton from '~/components/ui/CustomButton';

const RegisterScreen: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isBarOwner, setIsBarOwner] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const validateForm = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'El nombre es requerido');
      return false;
    }
    if (!username.trim()) {
      Alert.alert('Error', 'El nombre de usuario es requerido');
      return false;
    }
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
    return true;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: {
          data: {
            name: name.trim(),
            username: username.trim(),
            is_bar_owner: isBarOwner
          }
        }
      });

      if (authError) {
        Alert.alert('Error de registro', authError.message);
        return;
      }

      if (authData.user) {
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

  const handleGoogleRegister = () => {
    // TODO: Implement Google registration
    Alert.alert('Función próximamente', 'El registro con Google estará disponible pronto');
  };

  const handleFacebookRegister = () => {
    // TODO: Implement Facebook registration
    Alert.alert('Función próximamente', 'El registro con Facebook estará disponible pronto');
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <ScreenTitle 
            title="Sign up" 
            color="#FFFFFF" 
            shadow={false}
            marginBottom={0}
            fontSize={20}
          />
          <View style={styles.placeholder} />
        </View>

        <View style={styles.contentContainer}>
          <View style={styles.formContainer}>
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Name</Text>
              <InputField
                placeholder="Enter your name"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoCorrect={false}
                theme="dark"
              />
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>User Name</Text>
              <InputField
                placeholder="Enter your user name"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                theme="dark"
              />
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Email</Text>
              <InputField
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                theme="dark"
              />
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Password</Text>
              <InputField
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                theme="dark"
              />
            </View>

            <TouchableOpacity 
              style={styles.checkboxContainer}
              onPress={() => setIsBarOwner(!isBarOwner)}
            >
              <View style={[styles.checkbox, isBarOwner && styles.checkboxChecked]}>
                {isBarOwner && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>¿Eres propietario de un bar?</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.buttonContainer}>
            <CustomButton
              text="Sign up"
              onPress={handleRegister}
              variant="primary"
              loading={loading}
            />
            
            <CustomButton
              text="Continue with Google"
              onPress={handleGoogleRegister}
              variant="social"
            />
            
            <CustomButton
              text="Continuar con Facebook"
              onPress={handleFacebookRegister}
              variant="social"
            />
          </View>

          <View style={styles.linkContainer}>
            <Link href="/(auth)/login" style={styles.link}>
              <Text style={styles.linkText}>¿Ya tienes cuenta? Inicia sesión</Text>
            </Link>
          </View>
        </View>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C2A3A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 30,
  },
  backButton: {
    padding: 8,
  },
  placeholder: {
    width: 40,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  formContainer: {
    marginBottom: 40,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  fieldLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#8E8E93',
    borderRadius: 4,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
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
    color: '#FFFFFF',
  },
  buttonContainer: {
    gap: 12,
    marginBottom: 30,
  },
  linkContainer: {
    alignItems: 'center',
  },
  link: {
    padding: 10,
  },
  linkText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '400',
  },
});

export default RegisterScreen;

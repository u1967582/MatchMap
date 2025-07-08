import { useState } from 'react';
import { View, Text, StyleSheet, Alert, SafeAreaView, TouchableOpacity } from 'react-native';
import { Link, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '~/utils/supabase';
import ScreenTitle from '~/components/ui/ScreenTitle';
import InputField from '~/components/ui/InputField';
import CustomButton from '~/components/ui/CustomButton';

const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) {
        Alert.alert('Error de inicio de sesión', error.message);
        return;
      }

      router.push('/');
    } catch (error) {
      Alert.alert('Error', 'Error inesperado durante el inicio de sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    // TODO: Implement forgot password functionality
    Alert.alert('Función próximamente', 'La recuperación de contraseña estará disponible pronto');
  };

  const handleGoogleLogin = () => {
    // TODO: Implement Google login
    Alert.alert('Función próximamente', 'El inicio de sesión con Google estará disponible pronto');
  };

  const handleFacebookLogin = () => {
    // TODO: Implement Facebook login
    Alert.alert('Función próximamente', 'El inicio de sesión con Facebook estará disponible pronto');
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
            title="Iniciar sesión" 
            color="#FFFFFF" 
            shadow={false}
            marginBottom={0}
            fontSize={20}
          />
          <View style={styles.placeholder} />
        </View>

        <View style={styles.contentContainer}>
          <View style={styles.formContainer}>
            <InputField
              placeholder="Correo electrónico"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              theme="dark"
            />
            
            <InputField
              placeholder="Contraseña"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              theme="dark"
            />

            <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotPasswordContainer}>
              <Text style={styles.forgotPasswordText}>¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.buttonContainer}>
            <CustomButton
              text="Iniciar sesión"
              onPress={handleLogin}
              variant="primary"
              loading={loading}
            />
            
            <CustomButton
              text="Continuar con Google"
              onPress={handleGoogleLogin}
              variant="social"
            />
            
            <CustomButton
              text="Continuar con Facebook"
              onPress={handleFacebookLogin}
              variant="social"
            />
          </View>

          <View style={styles.linkContainer}>
            <Link href="/(auth)/register" style={styles.link}>
              <Text style={styles.linkText}>¿No tienes cuenta? Regístrate</Text>
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
  forgotPasswordContainer: {
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  forgotPasswordText: {
    color: '#8E8E93',
    fontSize: 14,
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

export default LoginScreen; 
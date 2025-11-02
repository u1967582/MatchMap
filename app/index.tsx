import { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { View, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import WelcomeScreen from '~/screens/WelcomeScreen';
import { supabase } from '~/utils/supabase';
import { signInWithGoogle } from '~/utils/auth';
import LoginModal from './(auth)/components/LoginModal';
import RegisterModal from './(auth)/components/RegisterModal';

export default function Home() {
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [loginModalVisible, setLoginModalVisible] = useState(false);
  const [registerModalVisible, setRegisterModalVisible] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const router = useRouter();

  useEffect(() => {
    checkAuthAndRedirect();
  }, []);

  const checkAuthAndRedirect = async () => {
    try {
      // Check if there's an active session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // User is already authenticated, redirect to map
        console.log('✅ Usuario ya autenticado, redirigiendo al mapa...');
        router.replace('/(protected)/map');
      } else {
        // No session, show welcome screen
        console.log('❌ No hay sesión activa, mostrando pantalla de bienvenida');
        setIsCheckingAuth(false);
      }
    } catch (error) {
      console.error('Error checking authentication:', error);
      // In case of error, show welcome screen
      setIsCheckingAuth(false);
    }
  };

  const handleLoginSuccess = () => {
    console.log('✅ Login exitoso');
    router.replace('/(protected)/map');
  };

  const handleRegisterSuccess = () => {
    console.log('✅ Registro exitoso');
    router.replace('/(protected)/map');
  };

  const handleGoogleLogin = async () => {
    setLoadingGoogle(true);

    try {
      console.log('🚀 Starting Google sign in...');

      const result = await signInWithGoogle();

      if (result.success) {
        console.log('✅ Google sign in successful!');
        router.replace('/(protected)/map');
      } else {
        console.error('❌ Google sign in failed:', result.error);
        Alert.alert(
          'Error de Google',
          result.error || 'No se pudo completar el inicio de sesión con Google'
        );
      }
    } catch (error: any) {
      console.error('❌ Exception in handleGoogleLogin:', error);
      Alert.alert('Error', error.message || 'Error inesperado con Google');
    } finally {
      setLoadingGoogle(false);
    }
  };

  // Show loading indicator while checking authentication
  if (isCheckingAuth) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <WelcomeScreen
        onLoginPress={() => setLoginModalVisible(true)}
        onRegisterPress={() => setRegisterModalVisible(true)}
        onGooglePress={handleGoogleLogin}
        loadingGoogle={loadingGoogle}
      />

      {/* Modals */}
      <LoginModal
        visible={loginModalVisible}
        onClose={() => setLoginModalVisible(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      <RegisterModal
        visible={registerModalVisible}
        onClose={() => setRegisterModalVisible(false)}
        onRegisterSuccess={handleRegisterSuccess}
      />
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1C2A3A',
  },
});



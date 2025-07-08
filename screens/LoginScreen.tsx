import { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Alert, SafeAreaView, TouchableOpacity, Linking } from 'react-native';
import { Link, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '~/utils/supabase';
import { useAuthStateChange, getOAuthRedirectUrl } from '~/utils/auth';
import ScreenTitle from '~/components/ui/ScreenTitle';
import InputField from '~/components/ui/InputField';
import CustomButton from '~/components/ui/CustomButton';
import { memo } from 'react';

interface LoginFormData {
  email: string;
  password: string;
}

interface LoadingState {
  email: boolean;
  google: boolean;
  facebook: boolean;
}

const LoginScreen: React.FC = () => {
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
  });
  
  const [loading, setLoading] = useState<LoadingState>({
    email: false,
    google: false,
    facebook: false,
  });

  const router = useRouter();

  // Listen for auth state changes (including OAuth callbacks)
  useAuthStateChange();

  // Memoized validation function
  const isFormValid = useMemo(() => {
    return formData.email.trim().length > 0 && formData.password.trim().length > 0;
  }, [formData.email, formData.password]);

  // Optimized form update handlers
  const handleEmailChange = useCallback((email: string) => {
    setFormData(prev => ({ ...prev, email }));
  }, []);

  const handlePasswordChange = useCallback((password: string) => {
    setFormData(prev => ({ ...prev, password }));
  }, []);

  // Optimized loading state helpers
  const setLoadingState = useCallback((type: keyof LoadingState, isLoading: boolean) => {
    setLoading(prev => ({ ...prev, [type]: isLoading }));
  }, []);

  // Error handling helper
  const handleOAuthError = useCallback((error: any, provider: string) => {
    console.error(`${provider} OAuth error:`, error);
    
    if (error?.message?.includes('provider is not enabled') || 
        error?.message?.includes('Unsupported provider')) {
      Alert.alert(
        'Servicio no disponible', 
        `El inicio de sesión con ${provider} no está configurado en este momento. Por favor, usa tu email y contraseña.`,
        [{ text: 'Entendido' }]
      );
    } else {
      Alert.alert(`Error de ${provider}`, error?.message || `Error inesperado con ${provider}`);
    }
  }, []);

  // OAuth URL opening helper
  const openOAuthUrl = useCallback(async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'No se puede abrir el navegador');
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo abrir la URL de autenticación');
    }
  }, []);

  // Main login handler
  const handleLogin = useCallback(async () => {
    if (!isFormValid) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    setLoadingState('email', true);
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: formData.email.trim(),
        password: formData.password.trim(),
      });

      if (error) {
        Alert.alert('Error de inicio de sesión', error.message);
        return;
      }

      // Navigation will be handled by useAuthStateChange
    } catch (error: any) {
      console.error('Login error:', error);
      Alert.alert('Error', 'Error inesperado durante el inicio de sesión');
    } finally {
      setLoadingState('email', false);
    }
  }, [formData, isFormValid, setLoadingState]);

  // Google OAuth handler
  const handleGoogleLogin = useCallback(async () => {
    setLoadingState('google', true);
    
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getOAuthRedirectUrl(),
        },
      });

      if (error) {
        handleOAuthError(error, 'Google');
        return;
      }

      if (data.url) {
        await openOAuthUrl(data.url);
      }
    } catch (error: any) {
      handleOAuthError(error, 'Google');
    } finally {
      setLoadingState('google', false);
    }
  }, [setLoadingState, handleOAuthError, openOAuthUrl]);

  // Facebook OAuth handler
  const handleFacebookLogin = useCallback(async () => {
    setLoadingState('facebook', true);
    
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: {
          redirectTo: getOAuthRedirectUrl(),
        },
      });

      if (error) {
        handleOAuthError(error, 'Facebook');
        return;
      }

      if (data.url) {
        await openOAuthUrl(data.url);
      }
    } catch (error: any) {
      handleOAuthError(error, 'Facebook');
    } finally {
      setLoadingState('facebook', false);
    }
  }, [setLoadingState, handleOAuthError, openOAuthUrl]);

  // Forgot password handler
  const handleForgotPassword = useCallback(() => {
    Alert.alert('Función próximamente', 'La recuperación de contraseña estará disponible pronto');
  }, []);

  // Back navigation handler
  const handleBackPress = useCallback(() => {
    router.back();
  }, [router]);

  // Check if any loading state is active
  const isAnyLoading = useMemo(() => {
    return Object.values(loading).some(Boolean);
  }, [loading]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={handleBackPress}
            disabled={isAnyLoading}
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
              value={formData.email}
              onChangeText={handleEmailChange}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              theme="dark"
              editable={!isAnyLoading}
            />
            
            <InputField
              placeholder="Contraseña"
              value={formData.password}
              onChangeText={handlePasswordChange}
              secureTextEntry
              autoCapitalize="none"
              theme="dark"
              editable={!isAnyLoading}
            />

            <TouchableOpacity 
              onPress={handleForgotPassword} 
              style={styles.forgotPasswordContainer}
              disabled={isAnyLoading}
            >
              <Text style={styles.forgotPasswordText}>¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.buttonContainer}>
            <CustomButton
              text="Iniciar sesión"
              onPress={handleLogin}
              variant="primary"
              loading={loading.email}
              disabled={!isFormValid || isAnyLoading}
            />
            
            <CustomButton
              text="Continuar con Google"
              onPress={handleGoogleLogin}
              variant="social"
              loading={loading.google}
              disabled={isAnyLoading}
            />
            
            <CustomButton
              text="Continuar con Facebook"
              onPress={handleFacebookLogin}
              variant="social"
              loading={loading.facebook}
              disabled={isAnyLoading}
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

export default memo(LoginScreen); 
import { useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Linking, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Link, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '~/utils/supabase';
import { useAuthStateChange, getOAuthRedirectUrl, signInWithApple } from '~/utils/auth';
import ScreenTitle from '~/components/ui/ScreenTitle';
import InputField from '~/components/ui/InputField';
import CustomButton from '~/components/ui/CustomButton';
import { memo } from 'react';

interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  username: string;
  isBarOwner: boolean;
}

interface LoadingState {
  register: boolean;
  google: boolean;
  facebook: boolean;
  apple: boolean;
}

interface FormValidation {
  isValid: boolean;
  errors: string[];
}

const RegisterScreen: React.FC = () => {
  const [formData, setFormData] = useState<RegisterFormData>({
    name: '',
    email: '',
    password: '',
    username: '',
    isBarOwner: false,
  });

  const [loading, setLoading] = useState<LoadingState>({
    register: false,
    google: false,
    facebook: false,
    apple: false,
  });

  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Handle OAuth user profile creation
  const handleOAuthUserProfile = useCallback(async (user: any) => {
    try {
      // Check if user profile already exists
      const { data: existingProfile } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .single();

      if (!existingProfile) {
        // Generate a unique username for OAuth users
        const baseUsername = user.user_metadata?.preferred_username || 
                            user.user_metadata?.user_name || 
                            user.email?.split('@')[0] || 
                            `user_${user.id.slice(0, 8)}`;
        
        // Create user profile for OAuth users
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: user.id, // Usar el ID del usuario autenticado
            email: user.email,
            full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
            username: baseUsername,
            profile_image_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
            is_bar_owner: false,
            updated_at: new Date().toISOString(),
          });

        if (profileError) {
          console.error('OAuth profile creation error:', profileError);
          
          // Si hay conflicto con el username, intentar con uno único
          if (profileError.code === '23505' && profileError.message.includes('username')) {
            const uniqueUsername = `${baseUsername}_${Date.now()}`;
            const { error: retryError } = await supabase
              .from('users')
              .insert({
                id: user.id,
                email: user.email,
                full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
                username: uniqueUsername,
                profile_image_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
                is_bar_owner: false,
                updated_at: new Date().toISOString(),
              });
            
            if (retryError) {
              console.error('OAuth profile retry error:', retryError);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error handling OAuth user profile:', error);
    }
  }, []);

  // Listen for auth state changes (including OAuth callbacks)
  useAuthStateChange(handleOAuthUserProfile);

  // Memoized form validation
  const formValidation = useMemo((): FormValidation => {
    const errors: string[] = [];
    
    if (!formData.name.trim()) errors.push('El nombre es requerido');
    if (!formData.username.trim()) errors.push('El nombre de usuario es requerido');
    if (!formData.email.trim()) errors.push('El email es requerido');
    if (formData.email.trim() && !formData.email.includes('@')) errors.push('Ingresa un email válido');
    if (!formData.password.trim()) errors.push('La contraseña es requerida');
    if (formData.password.trim() && formData.password.length < 6) errors.push('La contraseña debe tener al menos 6 caracteres');

    return {
      isValid: errors.length === 0,
      errors,
    };
  }, [formData]);

  // Optimized form update handlers
  const handleNameChange = useCallback((name: string) => {
    setFormData(prev => ({ ...prev, name }));
  }, []);

  const handleUsernameChange = useCallback((username: string) => {
    setFormData(prev => ({ ...prev, username }));
  }, []);

  const handleEmailChange = useCallback((email: string) => {
    setFormData(prev => ({ ...prev, email }));
  }, []);

  const handlePasswordChange = useCallback((password: string) => {
    setFormData(prev => ({ ...prev, password }));
  }, []);

  const handleBarOwnerToggle = useCallback(() => {
    setFormData(prev => ({ ...prev, isBarOwner: !prev.isBarOwner }));
  }, []);

  // Optimized loading state helpers
  const setLoadingState = useCallback((type: keyof LoadingState, isLoading: boolean) => {
    setLoading(prev => ({ ...prev, [type]: isLoading }));
  }, []);

  // Form validation helper
  const validateAndShowErrors = useCallback(() => {
    if (!formValidation.isValid) {
      Alert.alert('Error', formValidation.errors[0]);
      return false;
    }
    return true;
  }, [formValidation]);

  // Error handling helper
  const handleOAuthError = useCallback((error: any, provider: string) => {
    console.error(`${provider} OAuth error:`, error);
    
    if (error?.message?.includes('provider is not enabled') || 
        error?.message?.includes('Unsupported provider')) {
      Alert.alert(
        'Servicio no disponible', 
        `El registro con ${provider} no está configurado en este momento. Por favor, completa el formulario de registro.`,
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

  // Main registration handler
  const handleRegister = useCallback(async () => {
    if (!validateAndShowErrors()) return;

    setLoadingState('register', true);
    
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email.trim(),
        password: formData.password.trim(),
        options: {
          data: {
            name: formData.name.trim(),
            username: formData.username.trim(),
            is_bar_owner: formData.isBarOwner
          }
        }
      });

      if (authError) {
        Alert.alert('Error de registro', authError.message);
        return;
      }

      if (authData.user) {
        console.log('User created in auth.users:', authData.user.id);
        
        // Usar la función de base de datos para crear el perfil
        const { error: profileError } = await supabase.rpc('handle_new_user_registration', {
          user_id: authData.user.id,
          user_email: formData.email.trim(),
          user_full_name: formData.name.trim(),
          user_username: formData.username.trim(),
          user_is_bar_owner: formData.isBarOwner
        });

        if (profileError) {
          console.error('Profile creation error:', profileError);
          Alert.alert('Error', 'Error al crear el perfil: ' + profileError.message);
          return;
        }

        console.log('Profile created successfully via function');
        
        Alert.alert('Éxito', 'Usuario registrado correctamente', [
          { text: 'OK', onPress: () => router.replace('/(protected)/map' as any) }
        ]);
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      Alert.alert('Error', 'Error inesperado durante el registro');
    } finally {
      setLoadingState('register', false);
    }
  }, [formData, validateAndShowErrors, setLoadingState, router]);

  // Google OAuth handler
  const handleGoogleRegister = useCallback(async () => {
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
  const handleFacebookRegister = useCallback(async () => {
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

  // Back navigation handler
  const handleBackPress = useCallback(() => {
    router.back();
  }, [router]);

  // Check if any loading state is active
  const isAnyLoading = useMemo(() => {
    return Object.values(loading).some(Boolean);
  }, [loading]);

  // Memoized checkbox style
  const checkboxStyle = useMemo(() => [
    styles.checkbox,
    formData.isBarOwner && styles.checkboxChecked
  ], [formData.isBarOwner]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container} edges={['top','bottom']}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={handleBackPress}
            disabled={isAnyLoading}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <ScreenTitle 
            title="Crear cuenta" 
            color="#FFFFFF" 
            shadow={false}
            marginBottom={0}
            fontSize={20}
          />
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 32 + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formContainer}>
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Nombre</Text>
              <InputField
                placeholder="Ingresa tu nombre"
                value={formData.name}
                onChangeText={handleNameChange}
                autoCapitalize="words"
                autoCorrect={false}
                theme="dark"
                editable={!isAnyLoading}
              />
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Nombre de usuario</Text>
              <InputField
                placeholder="Ingresa tu nombre de usuario"
                value={formData.username}
                onChangeText={handleUsernameChange}
                autoCapitalize="none"
                autoCorrect={false}
                theme="dark"
                editable={!isAnyLoading}
              />
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Correo electrónico</Text>
              <InputField
                placeholder="Ingresa tu correo"
                value={formData.email}
                onChangeText={handleEmailChange}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                theme="dark"
                editable={!isAnyLoading}
              />
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Contraseña</Text>
              <InputField
                placeholder="Ingresa tu contraseña"
                value={formData.password}
                onChangeText={handlePasswordChange}
                secureTextEntry
                autoCapitalize="none"
                theme="dark"
                editable={!isAnyLoading}
              />
            </View>

            <TouchableOpacity 
              style={styles.checkboxContainer}
              onPress={handleBarOwnerToggle}
              disabled={isAnyLoading}
            >
              <View style={checkboxStyle}>
                {formData.isBarOwner && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>¿Eres propietario de un bar?</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.buttonContainer}>
            <CustomButton
              text="Crear cuenta"
              onPress={handleRegister}
              variant="primary"
              loading={loading.register}
              disabled={!formValidation.isValid || isAnyLoading}
            />
            
            {/* Social auth buttons (mismo estilo y orden consistente en iOS) */}
            <CustomButton
              text="Continuar con Apple"
              onPress={async () => {
                if (isAnyLoading) return;
                setLoadingState('apple', true);
                try {
                  await signInWithApple();
                } catch (e: any) {
                  Alert.alert('Error de Apple', e?.message ?? 'No se pudo iniciar sesión con Apple');
                } finally {
                  setLoadingState('apple', false);
                }
              }}
              variant="social"
              loading={loading.apple}
              disabled={isAnyLoading}
            />

            <CustomButton
              text="Continuar con Google"
              onPress={handleGoogleRegister}
              variant="social"
              loading={loading.google}
              disabled={isAnyLoading}
            />
            
            <CustomButton
              text="Continuar con Facebook"
              onPress={handleFacebookRegister}
              variant="social"
              loading={loading.facebook}
              disabled={isAnyLoading}
            />
          </View>

          <View style={styles.linkContainer}>
            <Link href="/(auth)/login" style={styles.link}>
              <Text style={styles.linkText}>¿Ya tienes cuenta? Inicia sesión</Text>
            </Link>
          </View>
        </ScrollView>
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
  scrollContent: {
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

export default memo(RegisterScreen);

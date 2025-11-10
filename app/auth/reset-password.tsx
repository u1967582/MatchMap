import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { updatePassword } from '~/utils/auth';
import { supabase } from '~/utils/supabase';
import InputField from '~/components/ui/InputField';
import CustomButton from '~/components/ui/CustomButton';
import ScreenTitle from '~/components/ui/ScreenTitle';

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);
  const router = useRouter();

  // Verificar que hay una sesión válida (viene del link del email)
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      console.log('🔍 Verificando sesión para reset password...');
      
      const { data: { session } } = await supabase.auth.getSession();
      
      console.log('📋 Session data:', {
        hasSession: !!session,
        userId: session?.user?.id,
        email: session?.user?.email,
      });
      
      if (session) {
        console.log('✅ Sesión válida para reset password');
        console.log('   User ID:', session.user.id);
        console.log('   Email:', session.user.email);
        setIsValidToken(true);
      } else {
        console.log('❌ No hay sesión válida');
        console.log('⚠️ Esto significa que el deep link no funcionó correctamente');
        
        // Dar más información al usuario
        Alert.alert(
          'Link Inválido',
          'El link de recuperación ha expirado o es inválido.\n\nPosibles causas:\n• El link ya fue usado\n• Han pasado más de 1 hora\n• El link no abrió la app correctamente\n\nPor favor solicita uno nuevo.',
          [{ text: 'OK', onPress: () => router.replace('/') }]
        );
      }
    } catch (error) {
      console.error('❌ Error checking session:', error);
      Alert.alert('Error', 'Error verificando el link de recuperación');
    }
  };

  const isFormValid =
    password.length >= 6 &&
    password === confirmPassword;

  const handleResetPassword = async () => {
    if (!isFormValid) {
      if (password.length < 6) {
        Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
      } else if (password !== confirmPassword) {
        Alert.alert('Error', 'Las contraseñas no coinciden');
      }
      return;
    }

    setLoading(true);

    try {
      const result = await updatePassword(password);

      if (result.success) {
        console.log('✅ Contraseña actualizada exitosamente');
        
        // Cerrar sesión después de actualizar la contraseña
        console.log('🚪 Cerrando sesión...');
        await supabase.auth.signOut();
        console.log('✅ Sesión cerrada');
        
        Alert.alert(
          'Contraseña Actualizada',
          'Tu contraseña ha sido actualizada exitosamente. Por favor inicia sesión con tu nueva contraseña.',
          [
            {
              text: 'OK',
              onPress: () => {
                console.log('🧭 Navegando al home...');
                router.replace('/');
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', result.error || 'Error actualizando la contraseña');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  if (!isValidToken) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Verificando...</Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.content}>
              <ScreenTitle
                title="Nueva Contraseña"
                subtitle="Ingresa tu nueva contraseña"
                color="#FFFFFF"
              />

              <View style={styles.form}>
                <InputField
                  placeholder="Nueva contraseña"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  editable={!loading}
                  theme="dark"
                />

                <InputField
                  placeholder="Confirmar contraseña"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  editable={!loading}
                  theme="dark"
                />

                <View style={styles.requirements}>
                  <Text style={styles.requirementsTitle}>Requisitos:</Text>
                  <Text style={styles.requirementItem}>
                    {password.length >= 6 ? '✅' : '⭕'} Mínimo 6 caracteres
                  </Text>
                  <Text style={styles.requirementItem}>
                    {password === confirmPassword && password.length > 0
                      ? '✅'
                      : '⭕'}{' '}
                    Las contraseñas coinciden
                  </Text>
                </View>

                <CustomButton
                  text="Actualizar Contraseña"
                  onPress={handleResetPassword}
                  variant="primary"
                  loading={loading}
                  disabled={!isFormValid || loading}
                />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C2A3A',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  form: {
    gap: 16,
    marginTop: 40,
  },
  requirements: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  requirementItem: {
    fontSize: 14,
    color: '#8E8E93',
  },
});


import React, { useState } from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ToastRoot from 'react-native-toast-message';
import { supabase } from '~/utils/supabase';
import { checkAndPromotePreRegisteredBar } from '~/utils/auth';
import ForgotPasswordModal from './ForgotPasswordModal';
import {
  AppText,
  AppInput,
  AppButton,
  toast,
  colors,
  spacing,
  radius,
} from '~/components/ds';
import { toastConfig } from '~/components/ds/feedback/ToastConfig';

interface LoginModalProps {
  visible: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}

export default function LoginModal({ visible, onClose, onLoginSuccess }: LoginModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotPasswordModalVisible, setForgotPasswordModalVisible] = useState(false);

  const isFormValid = email.trim().length > 0 && password.trim().length > 0;

  const handleLogin = async () => {
    if (!isFormValid) {
      toast.warning('Completa todos los campos');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) {
        toast.supabaseError(error, 'No se pudo iniciar sesión');
        return;
      }

      console.log('✅ Login exitoso:', data.user?.email);

      // ✅ IMPORTANTE: Verificar si hay un bar pre-registrado
      // Esto se ejecuta DESPUÉS de que el usuario tiene sesión activa
      if (data.user) {
        try {
          console.log('🔍 Verificando bar pre-registrado después del login...');
          await checkAndPromotePreRegisteredBar(data.user.id, data.user.email || '');
        } catch (preRegError) {
          console.error('❌ Error verificando bar pre-registrado:', preRegError);
          // No bloquear el login si falla
        }
      }

      // Limpiar formulario
      setEmail('');
      setPassword('');

      // Mostrar toast antes de cerrar para que se vea en la capa del modal
      toast.success('¡Bienvenido! 👋');
      onClose();
      onLoginSuccess();
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error('Error inesperado', 'No se pudo iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    // Cerrar el modal de login primero
    onClose();
    
    // Esperar a que termine la animación de cierre
    setTimeout(() => {
      setForgotPasswordModalVisible(true);
    }, 300);
  };

  const handleClose = () => {
    if (!loading) {
      setEmail('');
      setPassword('');
      onClose();
    }
  };

  return (
    <>
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <AppText variant="h2">Iniciar Sesión</AppText>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={28} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <AppInput
              label="Correo electrónico"
              placeholder="tu@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            <AppInput
              label="Contraseña"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              editable={!loading}
            />

            <TouchableOpacity
              onPress={handleForgotPassword}
              style={styles.forgotPassword}
              disabled={loading}
              activeOpacity={0.7}
            >
              <AppText variant="label" color={colors.brand.link}>
                ¿Olvidaste tu contraseña?
              </AppText>
            </TouchableOpacity>

            <AppButton
              text="Iniciar Sesión"
              onPress={handleLogin}
              variant="primary"
              loading={loading}
              disabled={!isFormValid || loading}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {/* Toast dentro del modal para que sea visible sobre la capa nativa del Modal */}
      <ToastRoot config={toastConfig} position="top" topOffset={60} />
    </Modal>

    {/* Modal de recuperación de contraseña */}
    <ForgotPasswordModal
      visible={forgotPasswordModalVisible}
      onClose={() => setForgotPasswordModalVisible(false)}
    />
  </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xxxl,
    marginTop: spacing.md,
  },
  closeButton: {
    padding: spacing.xs,
  },
  form: {
    flex: 1,
    gap: spacing.sm,
  },
  forgotPassword: {
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
    marginTop: -spacing.xs,
  },
});


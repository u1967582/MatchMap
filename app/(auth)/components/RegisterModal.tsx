import React, { useState } from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ToastRoot from 'react-native-toast-message';
import { supabase } from '~/utils/supabase';
import { getAuthErrorMessage, getOAuthRedirectUrl, MIN_PASSWORD_LENGTH } from '~/utils/auth';
import {
  AppText,
  AppInput,
  AppButton,
  toast,
  colors,
  spacing,
} from '~/components/ds';
import { toastConfig } from '~/components/ds/feedback/ToastConfig';

interface RegisterModalProps {
  visible: boolean;
  onClose: () => void;
  onRegisterSuccess: () => void;
}

export default function RegisterModal({
  visible,
  onClose,
  onRegisterSuccess,
}: RegisterModalProps) {
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    fullName: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);

  const isFormValid =
    formData.email.trim().length > 0 &&
    formData.email.includes('@') &&
    formData.username.trim().length >= 3 &&
    formData.fullName.trim().length > 0 &&
    formData.password.length >= MIN_PASSWORD_LENGTH &&
    formData.password === formData.confirmPassword;

  // ⚠️ La función checkAndPromotePreRegisteredBar ahora está en utils/auth.ts
  // y se ejecuta automáticamente cuando el usuario inicia sesión (evento SIGNED_IN)

  const handleRegister = async () => {
    // Validaciones detalladas
    if (formData.email.trim().length === 0) {
      toast.warning('Ingresa tu correo electrónico');
      return;
    }

    if (!formData.email.includes('@')) {
      toast.warning('Ingresa un correo válido');
      return;
    }

    if (formData.username.trim().length < 3) {
      toast.warning('El nombre de usuario debe tener al menos 3 caracteres');
      return;
    }

    if (formData.fullName.trim().length === 0) {
      toast.warning('Ingresa tu nombre completo');
      return;
    }

    if (formData.password.length < MIN_PASSWORD_LENGTH) {
      toast.warning(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);

    try {
      // Registrar en Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: formData.email.trim(),
        password: formData.password,
        options: {
          // El enlace de confirmación abre la app (auth/callback) en vez de la Site URL
          emailRedirectTo: getOAuthRedirectUrl(),
          data: {
            username: formData.username.trim().toLowerCase(),
            full_name: formData.fullName.trim(),
          },
        },
      });

      if (error) {
        const { title, subtitle } = getAuthErrorMessage(error, 'No se pudo crear la cuenta');
        toast.error(title, subtitle);
        return;
      }

      // Con la confirmación de email activa, Supabase no devuelve error si el
      // email ya existe: devuelve un usuario sin identidades y sin sesión.
      if (data.user && !data.session && data.user.identities?.length === 0) {
        toast.error('Este email ya está registrado', 'Inicia sesión o recupera tu contraseña');
        return;
      }

      // El trigger de Supabase crea el usuario en public.users. El bar
      // pre-registrado se comprueba al iniciar sesión (aquí puede no haber sesión).

      // Limpiar formulario
      setFormData({
        email: '',
        username: '',
        fullName: '',
        password: '',
        confirmPassword: '',
      });

      // Mostrar toast antes de cerrar para que se vea en la capa del modal
      onClose();
      if (data.session) {
        // Sin confirmación de email: ya hay sesión
        toast.success('¡Cuenta creada!');
        onRegisterSuccess();
      } else {
        // Con confirmación de email: no hay sesión hasta que pulse el enlace.
        // No navegar al mapa (lo devolvería a la bienvenida sin sesión).
        toast.success('¡Cuenta creada!', 'Revisa tu correo para verificar · mira también en SPAM');
      }
    } catch (error: any) {
      console.error('❌ Error inesperado en registro:', error?.message);
      const { title, subtitle } = getAuthErrorMessage(error, 'No se pudo crear la cuenta');
      toast.error(title, subtitle);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setFormData({
        email: '',
        username: '',
        fullName: '',
        password: '',
        confirmPassword: '',
      });
      onClose();
    }
  };

  return (
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
            <AppText variant="h2">Crear Cuenta</AppText>
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
              value={formData.email}
              onChangeText={(email) => setFormData({ ...formData, email })}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            <AppInput
              label="Nombre de usuario"
              placeholder="usuario123"
              value={formData.username}
              onChangeText={(username) =>
                setFormData({ ...formData, username: username.toLowerCase() })
              }
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
              helperText="Mínimo 3 caracteres"
            />

            <AppInput
              label="Nombre completo"
              placeholder="Juan Pérez"
              value={formData.fullName}
              onChangeText={(fullName) => setFormData({ ...formData, fullName })}
              autoCapitalize="words"
              editable={!loading}
            />

            <AppInput
              label="Contraseña"
              placeholder="••••••••"
              value={formData.password}
              onChangeText={(password) => setFormData({ ...formData, password })}
              secureTextEntry
              autoCapitalize="none"
              editable={!loading}
              helperText={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
            />

            <AppInput
              label="Confirmar contraseña"
              placeholder="••••••••"
              value={formData.confirmPassword}
              onChangeText={(confirmPassword) =>
                setFormData({ ...formData, confirmPassword })
              }
              secureTextEntry
              autoCapitalize="none"
              editable={!loading}
              error={
                formData.confirmPassword.length > 0 &&
                formData.password !== formData.confirmPassword
                  ? 'Las contraseñas no coinciden'
                  : undefined
              }
            />

            <AppButton
              text="Crear Cuenta"
              onPress={handleRegister}
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
    marginBottom: spacing.xxl,
    marginTop: spacing.md,
  },
  closeButton: {
    padding: spacing.xs,
  },
  form: {
    flex: 1,
    gap: spacing.xs,
  },
});


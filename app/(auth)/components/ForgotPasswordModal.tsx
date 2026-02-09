import React, { useState } from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { sendPasswordResetEmail } from '~/utils/auth';
import {
  AppText,
  AppInput,
  AppButton,
  toast,
  colors,
  spacing,
  radius,
} from '~/components/ds';

interface ForgotPasswordModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function ForgotPasswordModal({
  visible,
  onClose,
}: ForgotPasswordModalProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const isEmailValid = email.trim().length > 0 && email.includes('@');

  const handleSubmit = async () => {
    if (!isEmailValid) {
      toast.warning('Ingresa un email válido');
      return;
    }

    setLoading(true);

    try {
      await sendPasswordResetEmail(email.trim());

      // Siempre mostrar mensaje de éxito por seguridad
      // (no revelar si el email existe o no)
      setEmail('');
      onClose();
      toast.success(
        'Email enviado',
        'Revisa tu bandeja de entrada'
      );
    } catch (error: any) {
      toast.error('No se pudo enviar el email', 'Inténtalo de nuevo');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setEmail('');
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
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <AppText variant="h2">Recuperar Contraseña</AppText>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={28} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          {/* Descripción */}
          <AppText variant="body" color={colors.text.secondary} style={styles.description}>
            Ingresa tu email y te enviaremos instrucciones para restablecer tu
            contraseña.
          </AppText>

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

            <AppButton
              text="Enviar Email"
              onPress={handleSubmit}
              variant="primary"
              loading={loading}
              disabled={!isEmailValid || loading}
            />
          </View>

          {/* Info adicional */}
          <View style={styles.infoContainer}>
            <AppText variant="subtitle" style={styles.infoTitle}>
              💡 ¿No recuerdas cómo te registraste?
            </AppText>
            <AppText variant="body" color={colors.text.secondary} style={styles.infoText}>
              • Si te registraste con Google, usa "Continuar con Google"
            </AppText>
            <AppText variant="body" color={colors.text.secondary} style={styles.infoText}>
              • Si te registraste con email, ingresa tu email aquí
            </AppText>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  content: {
    flex: 1,
    padding: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
    marginTop: spacing.md,
  },
  closeButton: {
    padding: spacing.xs,
  },
  description: {
    marginBottom: spacing.xxxl,
    lineHeight: 24,
  },
  form: {
    gap: spacing.lg,
    marginBottom: spacing.xxxl,
  },
  infoContainer: {
    backgroundColor: colors.alpha.brandLight,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderLeftWidth: 4,
    borderLeftColor: colors.brand.link,
  },
  infoTitle: {
    marginBottom: spacing.sm,
  },
  infoText: {
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
});


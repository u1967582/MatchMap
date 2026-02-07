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
import { supabase } from '~/utils/supabase';
import {
  AppText,
  AppInput,
  AppButton,
  colors,
  spacing,
} from '~/components/ds';

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
    formData.password.length >= 6 &&
    formData.password === formData.confirmPassword;

  // ⚠️ La función checkAndPromotePreRegisteredBar ahora está en utils/auth.ts
  // y se ejecuta automáticamente cuando el usuario inicia sesión (evento SIGNED_IN)

  const handleRegister = async () => {
    // Validaciones detalladas
    if (formData.email.trim().length === 0) {
      Alert.alert('Error', 'Por favor ingresa tu correo electrónico');
      return;
    }
    
    if (!formData.email.includes('@')) {
      Alert.alert('Error', 'Por favor ingresa un correo electrónico válido');
      return;
    }

    if (formData.username.trim().length < 3) {
      Alert.alert('Error', 'El nombre de usuario debe tener al menos 3 caracteres');
      return;
    }

    if (formData.fullName.trim().length === 0) {
      Alert.alert('Error', 'Por favor ingresa tu nombre completo');
      return;
    }

    if (formData.password.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return;
    }

    setLoading(true);

    try {
      // Registrar en Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: formData.email.trim(),
        password: formData.password,
        options: {
          data: {
            username: formData.username.trim().toLowerCase(),
            full_name: formData.fullName.trim(),
          },
        },
      });

      if (error) {
        Alert.alert('Error de registro', error.message);
        return;
      }

      // El trigger de Supabase creará automáticamente el usuario en public.users
      console.log('✅ Usuario registrado:', data.user?.email);
      console.log('ℹ️ El usuario debe confirmar su email antes de iniciar sesión');
      console.log('ℹ️ La verificación de bar pre-registrado se ejecutará al hacer login');

      // ⚠️ NO verificar el bar pre-registrado aquí
      // Se verifica cuando el usuario inicia sesión (evento SIGNED_IN)
      // Razón: En este momento el usuario NO tiene sesión activa (necesita confirmar email)
      // y las policies requieren un usuario autenticado

      // Limpiar formulario
      setFormData({
        email: '',
        username: '',
        fullName: '',
        password: '',
        confirmPassword: '',
      });

      // Cerrar modal y notificar éxito
      onClose();
      Alert.alert(
        'Registro exitoso',
        'Tu cuenta ha sido creada correctamente',
        [{ text: 'OK', onPress: onRegisterSuccess }]
      );
    } catch (error: any) {
      console.error('Register error:', error);
      Alert.alert('Error', 'Error inesperado durante el registro');
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
              helperText="Mínimo 6 caracteres"
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


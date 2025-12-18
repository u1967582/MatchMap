import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '~/utils/supabase';
import InputField from '~/components/ui/InputField';
import CustomButton from '~/components/ui/CustomButton';

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
            <Text style={styles.title}>Crear Cuenta</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              disabled={loading}
            >
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <InputField
              placeholder="Correo electrónico"
              value={formData.email}
              onChangeText={(email) => setFormData({ ...formData, email })}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
              theme="dark"
            />

            <InputField
              placeholder="Nombre de usuario"
              value={formData.username}
              onChangeText={(username) =>
                setFormData({ ...formData, username: username.toLowerCase() })
              }
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
              theme="dark"
            />

            <InputField
              placeholder="Nombre completo"
              value={formData.fullName}
              onChangeText={(fullName) => setFormData({ ...formData, fullName })}
              autoCapitalize="words"
              editable={!loading}
              theme="dark"
            />

            <InputField
              placeholder="Contraseña"
              value={formData.password}
              onChangeText={(password) => setFormData({ ...formData, password })}
              secureTextEntry
              autoCapitalize="none"
              editable={!loading}
              theme="dark"
            />

            <InputField
              placeholder="Confirmar contraseña"
              value={formData.confirmPassword}
              onChangeText={(confirmPassword) =>
                setFormData({ ...formData, confirmPassword })
              }
              secureTextEntry
              autoCapitalize="none"
              editable={!loading}
              theme="dark"
            />

            <CustomButton
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
    backgroundColor: '#1C2A3A',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 4,
  },
  form: {
    flex: 1,
    gap: 16,
  },
});


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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { sendPasswordResetEmail } from '~/utils/auth';
import InputField from '~/components/ui/InputField';
import CustomButton from '~/components/ui/CustomButton';

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
      Alert.alert('Error', 'Por favor ingresa un email válido');
      return;
    }

    setLoading(true);

    try {
      await sendPasswordResetEmail(email.trim());

      // Siempre mostrar mensaje de éxito por seguridad
      // (no revelar si el email existe o no)
      Alert.alert(
        'Email Enviado',
        'Si el email está registrado, recibirás instrucciones para recuperar tu contraseña. Revisa tu bandeja de entrada.',
        [
          {
            text: 'OK',
            onPress: () => {
              setEmail('');
              onClose();
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error inesperado');
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
            <Text style={styles.title}>Recuperar Contraseña</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              disabled={loading}
            >
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Descripción */}
          <Text style={styles.description}>
            Ingresa tu email y te enviaremos instrucciones para restablecer tu
            contraseña.
          </Text>

          {/* Form */}
          <View style={styles.form}>
            <InputField
              placeholder="Correo electrónico"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
              theme="dark"
            />

            <CustomButton
              text="Enviar Email"
              onPress={handleSubmit}
              variant="primary"
              loading={loading}
              disabled={!isEmailValid || loading}
            />
          </View>

          {/* Info adicional */}
          <View style={styles.infoContainer}>
            <Text style={styles.infoTitle}>
              💡 ¿No recuerdas cómo te registraste?
            </Text>
            <Text style={styles.infoText}>
              • Si te registraste con Google, usa "Continuar con Google"
            </Text>
            <Text style={styles.infoText}>
              • Si te registraste con email, ingresa tu email aquí
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C2A3A',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
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
  description: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 30,
    lineHeight: 24,
  },
  form: {
    gap: 16,
    marginBottom: 30,
  },
  infoContainer: {
    backgroundColor: 'rgba(127, 179, 255, 0.1)',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#7FB3FF',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
    marginBottom: 4,
  },
});


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
import ForgotPasswordModal from './ForgotPasswordModal';

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
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) {
        Alert.alert('Error de inicio de sesión', error.message);
        return;
      }

      // Limpiar formulario
      setEmail('');
      setPassword('');
      
      // Cerrar modal y notificar éxito
      onClose();
      onLoginSuccess();
    } catch (error: any) {
      console.error('Login error:', error);
      Alert.alert('Error', 'Error inesperado durante el inicio de sesión');
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
            <Text style={styles.title}>Iniciar Sesión</Text>
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
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
              theme="dark"
            />

            <InputField
              placeholder="Contraseña"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              editable={!loading}
              theme="dark"
            />

            <TouchableOpacity
              onPress={handleForgotPassword}
              style={styles.forgotPassword}
              disabled={loading}
            >
              <Text style={styles.forgotPasswordText}>
                ¿Olvidaste tu contraseña?
              </Text>
            </TouchableOpacity>

            <CustomButton
              text="Iniciar Sesión"
              onPress={handleLogin}
              variant="primary"
              loading={loading}
              disabled={!isFormValid || loading}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  forgotPassword: {
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  forgotPasswordText: {
    color: '#7FB3FF',
    fontSize: 14,
  },
});


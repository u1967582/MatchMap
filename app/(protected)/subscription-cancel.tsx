import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { AppText } from '~/components/ds';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const SubscriptionCancelScreen: React.FC = () => {
  const router = useRouter();

  const handleTryAgain = () => {
    router.push('/subscription-plans');
  };

  const handleGoToProfile = () => {
    router.replace('/profile');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top','bottom']}>
      <Stack.Screen options={{ title: 'Pago Cancelado', headerShown: false }} />
      
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="close-circle" size={80} color="#FF6B6B" />
        </View>
        
        <AppText maxScale={1.2} style={styles.title}>Pago Cancelado</AppText>
        <AppText maxScale={1.3} style={styles.subtitle}>
          No se completó la suscripción. Puedes intentarlo de nuevo cuando quieras.
        </AppText>

        <View style={styles.infoContainer}>
          <AppText style={styles.infoTitle}>¿Por qué actualizar?</AppText>

          <View style={styles.infoRow}>
            <Ionicons name="images" size={20} color="#4CAF50" />
            <AppText style={styles.infoText}>Sube más fotos de tu bar</AppText>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
            <AppText style={styles.infoText}>Sin marca de agua</AppText>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="analytics" size={20} color="#4CAF50" />
            <AppText style={styles.infoText}>Estadísticas avanzadas</AppText>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="headset" size={20} color="#4CAF50" />
            <AppText style={styles.infoText}>Soporte prioritario</AppText>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.primaryButton} onPress={handleTryAgain}>
            <AppText maxScale={1.0} style={styles.primaryButtonText}>Intentar de Nuevo</AppText>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={handleGoToProfile}>
            <AppText maxScale={1.0} style={styles.secondaryButtonText}>Ir al Perfil</AppText>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E2A38',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    marginBottom: 32,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    color: '#8E8E93',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  infoContainer: {
    width: '100%',
    marginBottom: 40,
  },
  infoTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginLeft: 12,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#8E8E93',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#8E8E93',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SubscriptionCancelScreen; 
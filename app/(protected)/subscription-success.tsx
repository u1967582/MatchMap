import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSubscription } from '~/hooks/useSubscription';

const SubscriptionSuccessScreen: React.FC = () => {
  const router = useRouter();

  useEffect(() => {
    // Auto-navigate back to profile after 3 seconds
    const timer = setTimeout(() => {
      router.replace('/profile');
    }, 3000);

    return () => clearTimeout(timer);
  }, [router]);

  const handleGoToProfile = () => {
    router.replace('/profile');
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Suscripción Exitosa', headerShown: false }} />
      
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
        </View>
        
        <Text style={styles.title}>¡Suscripción Exitosa!</Text>
        <Text style={styles.subtitle}>
          Tu suscripción ha sido activada correctamente
        </Text>
        
        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>Ahora tienes acceso a:</Text>
          
          <View style={styles.featureRow}>
            <Ionicons name="images" size={20} color="#4CAF50" />
            <Text style={styles.featureText}>Más fotos para tu bar</Text>
          </View>
          
          <View style={styles.featureRow}>
            <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
            <Text style={styles.featureText}>Sin marca de agua</Text>
          </View>
          
          <View style={styles.featureRow}>
            <Ionicons name="analytics" size={20} color="#4CAF50" />
            <Text style={styles.featureText}>Estadísticas avanzadas</Text>
          </View>
          
          <View style={styles.featureRow}>
            <Ionicons name="headset" size={20} color="#4CAF50" />
            <Text style={styles.featureText}>Soporte prioritario</Text>
          </View>
        </View>
        
        <TouchableOpacity style={styles.button} onPress={handleGoToProfile}>
          <Text style={styles.buttonText}>Ir al Perfil</Text>
        </TouchableOpacity>
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
  featuresContainer: {
    width: '100%',
    marginBottom: 40,
  },
  featuresTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginLeft: 12,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SubscriptionSuccessScreen; 
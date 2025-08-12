import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '~/utils/supabase';
import { useUserSubscription } from '~/hooks/useUserSubscription';
import Step1GeneralInfo from '~/screens/registerBar/Step1GeneralInfo';

export default function Step1() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const { hasActiveSubscription, isLoading: subscriptionLoading } = useUserSubscription(user?.id);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        setUser(currentUser);
      } else {
        router.replace('/login');
      }
    };
    getUser();
  }, [router]);

  useEffect(() => {
    // Si no hay suscripción activa, redirigir a Step0
    if (!subscriptionLoading && !hasActiveSubscription) {
      Alert.alert(
        'Suscripción Requerida',
        'Necesitas completar el pago antes de continuar con el registro del bar.',
        [
          {
            text: 'Ir a Suscripción',
            onPress: () => router.replace('/register-bar/step0')
          }
        ]
      );
    }
  }, [hasActiveSubscription, subscriptionLoading, router]);

  // Si no hay suscripción activa, mostrar pantalla de verificación
  if (!subscriptionLoading && !hasActiveSubscription) {
    return (
      <View style={styles.container}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Paso 1 — Verificación</Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* Content */}
          <View style={styles.content}>
            {/* No Subscription State */}
            <View style={styles.warningContainer}>
              <Ionicons name="warning" size={64} color="#F59E0B" />
              <Text style={styles.title}>Suscripción Requerida</Text>
              <Text style={styles.subtitle}>
                Necesitas completar el pago antes de continuar con el registro del bar.
              </Text>
              
              <TouchableOpacity 
                style={styles.subscribeButton}
                onPress={() => router.replace('/register-bar/step0')}
              >
                <Ionicons name="card" size={20} color="#FFFFFF" />
                <Text style={styles.subscribeButtonText}>Completar Suscripción</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Si hay suscripción activa, mostrar el formulario original
  if (hasActiveSubscription) {
    return <Step1GeneralInfo />;
  }

  // Loading state
  return (
    <View style={styles.container}>
      <View style={styles.loadingContainer}>
        <Ionicons name="refresh" size={48} color="#10B981" />
        <Text style={styles.loadingText}>Verificando suscripción...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0e1b2c',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 20,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginRight: 40,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#A3B3CC',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    maxWidth: 300,
  },
  warningContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  subscribeButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  subscribeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
}); 
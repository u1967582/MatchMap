import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { AppText } from '~/components/ds';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '~/utils/supabase';

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: {
    maxPhotos: number;
    watermark: boolean;
    analytics: 'basic' | 'advanced';
    support: 'email' | 'priority' | 'vip';
  };
}

// Plans available - pricing maintained for reference (RevenueCat will handle actual purchases)
const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlan> = {
  pro_monthly: {
    id: 'pro_monthly',
    name: 'Pro Bar - Mensual',
    price: 9.99,
    currency: 'EUR',
    interval: 'month',
    features: {
      maxPhotos: 10,
      watermark: false,
      analytics: 'basic',
      support: 'priority'
    }
  },
  pro_yearly: {
    id: 'pro_yearly',
    name: 'Pro Bar - Anual',
    price: 79.99,
    currency: 'EUR',
    interval: 'year',
    features: {
      maxPhotos: 10,
      watermark: false,
      analytics: 'basic',
      support: 'priority'
    }
  },
  elite_monthly: {
    id: 'elite_monthly',
    name: 'Elite Bar - Mensual',
    price: 19.99,
    currency: 'EUR',
    interval: 'month',
    features: {
      maxPhotos: 50,
      watermark: false,
      analytics: 'advanced',
      support: 'vip'
    }
  },
  elite_yearly: {
    id: 'elite_yearly',
    name: 'Elite Bar - Anual',
    price: 149.99,
    currency: 'EUR',
    interval: 'year',
    features: {
      maxPhotos: 50,
      watermark: false,
      analytics: 'advanced',
      support: 'vip'
    }
  }
};

export default function SubscriptionPlans() {
  const router = useRouter();
  const { barId } = useLocalSearchParams<{ barId?: string }>();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
      } catch (error) {
        console.error('Error getting user:', error);
        router.replace('/login');
      } finally {
        setLoading(false);
      }
    };
    
    getUser();
  }, [router]);

  const handleBack = () => {
    router.back();
  };

  const startSubscription = async (plan: SubscriptionPlan) => {
    if (!user?.id) {
      Alert.alert('Error', 'Usuario no autenticado');
      return;
    }

    // Payments temporarily unavailable - preparing for RevenueCat integration
    Alert.alert(
      'Suscripciones temporalmente no disponibles',
      'Estamos actualizando nuestro sistema de suscripciones para ofrecerte una mejor experiencia. Esta función estará disponible muy pronto.',
      [{ text: 'Entendido', style: 'default' }]
    );
  };

  const formatPrice = (plan: SubscriptionPlan): string => {
    const { price, currency, interval } = plan;
    const currencySymbol = currency === 'EUR' ? '€' : currency;
    
    if (interval === 'year') {
      return `${price}${currencySymbol}/año`;
    }
    
    return `${price}${currencySymbol}/mes`;
  };

  const getYearlySavings = (monthlyPlan: SubscriptionPlan, yearlyPlan: SubscriptionPlan): number => {
    const monthlyCost = monthlyPlan.price * 12;
    const yearlyCost = yearlyPlan.price;
    
    return monthlyCost - yearlyCost;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <AppText style={styles.loadingText}>Cargando...</AppText>
        </View>
      </SafeAreaView>
    );
  }

  if (!user?.id) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <AppText style={styles.errorText}>Usuario no autenticado</AppText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <AppText style={styles.headerTitle}>Planes de Suscripción</AppText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Info Section */}
        <View style={styles.infoSection}>
          <AppText style={styles.infoTitle}>
            {barId ? 'Actualizar Plan' : 'Elegir Plan'}
          </AppText>
          <AppText style={styles.infoDescription}>
            {barId 
              ? 'Actualiza tu plan actual para acceder a más funcionalidades'
              : 'Elige el plan que mejor se adapte a tus necesidades'
            }
          </AppText>
        </View>

        {/* Plans */}
        <View style={styles.plansSection}>
          {Object.entries(SUBSCRIPTION_PLANS).map(([key, plan]) => (
            <View key={key} style={styles.planCard}>
              <View style={styles.planHeader}>
                <View>
                  <AppText style={styles.planName}>{plan.name}</AppText>
                  <AppText style={styles.planPrice}>{formatPrice(plan)}</AppText>
                </View>
                <View style={styles.planBadge}>
                  <AppText style={styles.planBadgeText}>
                    {plan.interval === 'year' ? 'AÑO' : 'MES'}
                  </AppText>
                </View>
              </View>
              
              {/* Features */}
              <View style={styles.planFeatures}>
                <View style={styles.featureItem}>
                  <Ionicons name="images" size={20} color="#10B981" />
                  <AppText style={styles.featureText}>
                    Hasta {plan.features.maxPhotos} fotos
                  </AppText>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons 
                    name={plan.features.watermark ? "lock-closed" : "checkmark-circle"} 
                    size={20} 
                    color={plan.features.watermark ? "#EF4444" : "#10B981"} 
                  />
                  <AppText style={styles.featureText}>
                    {plan.features.watermark ? 'Con marca de agua' : 'Sin marca de agua'}
                  </AppText>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="analytics" size={20} color="#10B981" />
                  <AppText style={styles.featureText}>
                    {plan.features.analytics === 'advanced' ? 'Analytics avanzados' : 'Analytics básicos'}
                  </AppText>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="people" size={20} color="#10B981" />
                  <AppText style={styles.featureText}>
                    Soporte {plan.features.support}
                  </AppText>
                </View>
              </View>

              {/* Yearly savings */}
              {plan.interval === 'year' && (
                <View style={styles.savingsContainer}>
                  <AppText style={styles.savingsText}>
                    💰 Ahorras {getYearlySavings(
                      SUBSCRIPTION_PLANS[plan.name.includes('Pro') ? 'pro_monthly' : 'elite_monthly'],
                      plan
                    )}€ al año
                  </AppText>
                </View>
              )}

              {/* Subscribe Button */}
              <TouchableOpacity
                style={[
                  styles.subscribeButton,
                  isProcessing && styles.subscribeButtonDisabled
                ]}
                onPress={() => startSubscription(plan)}
                disabled={isProcessing}
              >
                <AppText style={styles.subscribeButtonText}>
                  {isProcessing ? 'Procesando...' : 'Suscribirse'}
                </AppText>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Additional Info */}
        <View style={styles.additionalInfo}>
          <AppText style={styles.additionalInfoTitle}>¿Necesitas ayuda?</AppText>
          <AppText style={styles.additionalInfoText}>
            Si tienes alguna pregunta sobre nuestros planes, no dudes en contactarnos.
          </AppText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0e1b2c',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 16,
  },
  headerSpacer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  infoSection: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  infoTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  infoDescription: {
    color: '#A3B3CC',
    fontSize: 16,
    lineHeight: 22,
  },
  plansSection: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  planCard: {
    backgroundColor: '#1A2332',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A3A4A',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  planName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  planPrice: {
    color: '#10B981',
    fontSize: 24,
    fontWeight: 'bold',
  },
  planBadge: {
    backgroundColor: '#1976D2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  planBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  planFeatures: {
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    color: '#E5E7EB',
    fontSize: 16,
    marginLeft: 12,
  },
  savingsContainer: {
    backgroundColor: '#10B981',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: 'center',
  },
  savingsText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  subscribeButton: {
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  subscribeButtonDisabled: {
    backgroundColor: '#6B7280',
  },
  subscribeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  additionalInfo: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  additionalInfoTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  additionalInfoText: {
    color: '#A3B3CC',
    fontSize: 16,
    lineHeight: 22,
  },
}); 
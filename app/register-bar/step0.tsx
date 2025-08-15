import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '~/utils/supabase';
import * as Linking from 'expo-linking';
import { CAP_BY_TIER } from '~/lib/planCapabilities';
import { saveOnboardingPlan } from '~/utils/onboardingStorage';

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
  color: string;
}

interface FreePlan {
  name: string;
  features: string[];
  color: string;
}

// Plan gratuito - usando capacidades del plan
const FREE_PLAN: FreePlan = {
  name: 'Gratuito',
  features: [
    `${CAP_BY_TIER.free.events_limit} evento${CAP_BY_TIER.free.events_limit === 1 ? '' : 's'} activo${CAP_BY_TIER.free.events_limit === 'unlimited' ? 's' : ''}`,
    `${CAP_BY_TIER.free.posts_limit} post${CAP_BY_TIER.free.posts_limit === 1 ? '' : 's'} activo${CAP_BY_TIER.free.posts_limit === 'unlimited' ? 's' : ''}`,
    `Hasta ${CAP_BY_TIER.free.bar_images_limit} imagen${CAP_BY_TIER.free.bar_images_limit === 1 ? '' : 'es'} del bar`,
    'Reseñas de clientes',
    'Perfil visible en búsquedas',
    `Soporte ${CAP_BY_TIER.free.support}`
  ],
  color: '#6B7280'
};

// Planes disponibles (debe coincidir con los IDs de Stripe)
const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlan> = {
  pro_monthly: {
    id: 'price_1RvGlr7hGI6XwPtaE9d03BfI',
    name: 'Pro Bar',
    price: 9.99,
    currency: 'EUR',
    interval: 'month',
    color: '#10B981',
    features: [
      'Automatización de partidos',
      'Hasta 8 imágenes',
      'Carta del bar con menú',
      'Hasta 3 posts activos',
      'Destacar 1 post',
      'Posición prioritaria en búsquedas'
    ]
  },
  pro_yearly: {
    id: 'price_1RvGlr7hGI6XwPta032XCAwP',
    name: 'Pro Bar',
    price: 79.99,
    currency: 'EUR',
    interval: 'year',
    color: '#10B981',
    features: [
      'Automatización de partidos',
      'Hasta 8 imágenes',
      'Carta del bar con menú',
      'Hasta 3 posts activos',
      'Destacar 1 post',
      'Posición prioritaria en búsquedas'
    ]
  },
  elite_monthly: {
    id: 'price_1RvGmN7hGI6XwPtaye2UkCso',
    name: 'Elite Bar',
    price: 19.99,
    currency: 'EUR',
    interval: 'month',
    color: '#8B5CF6',
    features: [
      'Automatización total de partidos',
      'Hasta 20 imágenes en galería',
      'Carta del bar con zoom optimizado',
      'Posts ilimitados con imagen',
      'Destacar hasta 3 posts',
      'Máxima prioridad en búsquedas'
    ]
  },
  elite_yearly: {
    id: 'price_1RvGmN7hGI6XwPta96F6JX70',
    name: 'Elite Bar',
    price: 149.99,
    currency: 'EUR',
    interval: 'year',
    color: '#8B5CF6',
    features: [
      'Automatización total de partidos',
      'Hasta 20 imágenes en galería',
      'Carta del bar con zoom optimizado',
      'Posts ilimitados con imagen',
      'Destacar hasta 3 posts',
      'Máxima prioridad en búsquedas'
    ]
  }
};

export default function Step0() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'year'>('month');

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

  const continueWithFreePlan = async () => {
    try {
      // Guardar el plan seleccionado usando la utilidad
      await saveOnboardingPlan('free');
      // Navegar directamente al step1 del registro del bar
      router.push('/register-bar/step1');
    } catch (error) {
      console.warn('Error saving onboarding plan:', error);
      // Continuar con la navegación incluso si falla el guardado
      router.push('/register-bar/step1');
    }
  };

  const startSubscription = async (plan: SubscriptionPlan) => {
    if (!user?.id) {
      Alert.alert('Error', 'Usuario no autenticado');
      return;
    }

    try {
      setIsProcessing(true);

      console.log('🛒 Starting subscription for plan:', plan.name);
      console.log(' User:', user.id);
      console.log('🏪 Bar: pending (registro inicial)');

      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { 
          user_id: user.id, 
          price_id: plan.id,
          plan_type: plan.name.includes('Pro') ? 'pro_monthly' : 'elite_monthly',
          // No incluir bar_id - será "pending" por defecto
        },
      });
      
      if (error) throw error;

      console.log('✅ Checkout session created:', data);

      // Abrir Stripe Checkout
      const checkoutUrl = data?.url;
      if (checkoutUrl) {
        await Linking.openURL(checkoutUrl);
      }
    } catch (error) {
      console.error('Failed to create checkout session:', error);
      Alert.alert('Error', 'No se pudo iniciar el proceso de suscripción. Inténtalo de nuevo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatPrice = (plan: SubscriptionPlan): string => {
    const { price, currency, interval } = plan;
    const currencySymbol = currency === 'EUR' ? '€' : currency;
    
    if (interval === 'year') {
      return `${price}${currencySymbol}/año`;
    }
    
    return `${price}${currencySymbol}/mes`;
  };

  // Filtrar planes según el período seleccionado
  const filteredPlans = Object.entries(SUBSCRIPTION_PLANS).filter(
    ([key, plan]) => plan.interval === selectedPeriod
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user?.id) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Usuario no autenticado</Text>
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
        <Text style={styles.headerTitle}>Planes de Suscripción</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Progress Container - Contador de pasos */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressStep, styles.progressStepActive]} />
          <View style={styles.progressStep} />
          <View style={styles.progressStep} />
          <View style={styles.progressStep} />
          <View style={styles.progressStep} />
        </View>
        <Text style={styles.progressText}>Paso 1 de 5</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>
            Elige el plan que mejor se adapte a tu bar
          </Text>
        </View>

        {/* Period Toggle */}
        <View style={styles.periodToggleContainer}>
          <View style={styles.periodToggle}>
            <TouchableOpacity
              style={[
                styles.periodButton,
                selectedPeriod === 'month' && styles.periodButtonActive
              ]}
              onPress={() => setSelectedPeriod('month')}
            >
              <Text style={[
                styles.periodButtonText,
                selectedPeriod === 'month' && styles.periodButtonTextActive
              ]}>
                Mensual
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.periodButton,
                selectedPeriod === 'year' && styles.periodButtonActive
              ]}
              onPress={() => setSelectedPeriod('year')}
            >
              <Text style={[
                styles.periodButtonText,
                selectedPeriod === 'year' && styles.periodButtonTextActive
              ]}>
                Anual
              </Text>
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>-33%</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Plans */}
        <View style={styles.plansSection}>
          {/* Free Plan Card */}
          <View style={styles.freePlanCard}>
            <View style={styles.planHeader}>
              <View>
                <Text style={styles.planType}>PLAN GRATUITO</Text>
                <Text style={styles.planName}>{FREE_PLAN.name}</Text>
              </View>
              <View style={styles.planPriceContainer}>
                <Text style={styles.freePlanPrice}>Gratis</Text>
              </View>
            </View>
            
            {/* Features */}
            <View style={styles.planFeatures}>
              {FREE_PLAN.features.map((feature, index) => (
                <View key={index} style={styles.featureItem}>
                  <View style={[styles.featureIcon, { backgroundColor: FREE_PLAN.color }]}>
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  </View>
                  <Text style={styles.featureText}>
                    {feature}
                  </Text>
                </View>
              ))}
            </View>

            {/* Continue Free Button */}
            <TouchableOpacity style={styles.continueFreeButton} onPress={continueWithFreePlan}>
              <Text style={styles.continueFreeButtonText}>Continuar Gratis</Text>
            </TouchableOpacity>
          </View>

          {/* Paid Plans */}
          {filteredPlans.map(([key, plan]) => (
            <View key={key} style={styles.planCard}>
              <View style={styles.planHeader}>
                <View>
                  <Text style={styles.planType}>
                    {plan.name.includes('Pro') ? 'PLAN ESTÁNDAR' : 'PLAN PREMIUM'}
                  </Text>
                  <Text style={styles.planName}>
                    {plan.name}
                  </Text>
                </View>
                <View style={styles.planPriceContainer}>
                  <Text style={styles.planPrice}>{formatPrice(plan)}</Text>
                </View>
              </View>
              
              {/* Features */}
              <View style={styles.planFeatures}>
                {plan.features.map((feature, index) => (
                  <View key={index} style={styles.featureItem}>
                    <View style={[styles.featureIcon, { backgroundColor: plan.color }]}>
                      <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                    </View>
                    <Text style={styles.featureText}>
                      {feature}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Subscribe Button */}
              <TouchableOpacity
                style={[
                  styles.subscribeButton,
                  { backgroundColor: plan.color },
                  isProcessing && styles.subscribeButtonDisabled
                ]}
                onPress={() => startSubscription(plan)}
                disabled={isProcessing}
              >
                <Text style={styles.subscribeButtonText}>
                  {isProcessing ? 'Procesando...' : 'Suscribirse'}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C2A3A',
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
  progressContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  progressBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  progressStep: {
    flex: 1,
    height: 4,
    backgroundColor: '#374151',
    borderRadius: 2,
  },
  progressStepActive: {
    backgroundColor: '#007AFF',
  },
  progressText: {
    color: '#8E8E93',
    fontSize: 14,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  infoSection: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  infoTitle: {
    color: '#A3B3CC',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  periodToggleContainer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  periodToggle: {
    flexDirection: 'row',
    backgroundColor: '#1A2332',
    borderRadius: 12,
    padding: 4,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    position: 'relative',
  },
  periodButtonActive: {
    backgroundColor: '#1976D2',
  },
  periodButtonText: {
    color: '#A3B3CC',
    fontSize: 14,
    fontWeight: '600',
  },
  periodButtonTextActive: {
    color: '#FFFFFF',
  },
  discountBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#10B981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  discountText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
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
  planType: {
    color: '#A3B3CC',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  planName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  planPriceContainer: {
    alignItems: 'flex-end',
  },
  planPrice: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  planFeatures: {
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featureText: {
    color: '#FFFFFF',
    fontSize: 16,
    flex: 1,
  },
  subscribeButton: {
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
  freePlanCard: {
    backgroundColor: '#1A2332',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#10B981',
    borderStyle: 'dashed',
  },
  freePlanPrice: {
    color: '#10B981',
    fontSize: 24,
    fontWeight: 'bold',
  },
  continueFreeButton: {
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  continueFreeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
}); 
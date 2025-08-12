import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView, 
  ScrollView, 
  ActivityIndicator,
  Alert,
  Linking 
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '~/utils/supabase';

interface Plan {
  id: string;
  name: string;
  subtitle: string;
  price: string;
  originalPrice?: string;
  period: string;
  priceId: string;
  color: string;
  features: string[];
  popular?: boolean;
  savings?: string;
}

const plans = {
  pro: {
    monthly: {
      id: 'pro_monthly',
      name: 'Pro Bar',
      subtitle: 'Plan Estándar',
      price: '9,99 €',
      period: 'mes',
      priceId: 'price_1RvGlr7hGI6XwPtaE9d03BfI', // ✅ ACTUALIZADO
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
    yearly: {
      id: 'pro_yearly',
      name: 'Pro Bar',
      subtitle: 'Plan Estándar',
      price: '79,99 €',
      originalPrice: '119,88 €',
      period: 'año',
      priceId: 'price_1RvGlr7hGI6XwPta032XCAwP', // ✅ ACTUALIZADO
      color: '#10B981',
      features: [
        'Automatización de partidos',
        'Hasta 8 imágenes',
        'Carta del bar con menú',
        'Hasta 3 posts activos',
        'Destacar 1 post',
        'Posición prioritaria en búsquedas',
        'Ahorro del 33%'
      ],
      popular: true,
      savings: 'Ahorras 39,89 €'
    }
  },
  elite: {
    monthly: {
      id: 'elite_monthly',
      name: 'Elite Bar',
      subtitle: 'Plan Premium',
      price: '19,99 €',
      period: 'mes',
      priceId: 'price_1RvGmN7hGI6XwPtaye2UkCso', // ✅ ACTUALIZADO
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
    yearly: {
      id: 'elite_yearly',
      name: 'Elite Bar',
      subtitle: 'Plan Premium',
      price: '149,99 €',
      originalPrice: '239,88 €',
      period: 'año',
      priceId: 'price_1RvGmN7hGI6XwPta96F6JX70', // ✅ ACTUALIZADO
      color: '#8B5CF6',
      features: [
        'Automatización total de partidos',
        'Hasta 20 imágenes en galería',
        'Carta del bar con zoom optimizado',
        'Posts ilimitados con imagen',
        'Destacar hasta 3 posts',
        'Máxima prioridad en búsquedas',
        'Ahorro del 37%'
      ],
      savings: 'Ahorras 89,89 €'
    }
  }
};

const SubscriptionPlansScreen: React.FC = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [user, setUser] = useState<any>(null);
  const [barId, setBarId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUserAndBar();
  }, []);

  const fetchUserAndBar = async () => {
    try {
      setInitialLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (!user) {
        setError('No se pudo obtener la información del usuario');
        return;
      }

      console.log('Fetching bar for user:', user.id);

      // First try to get bar_id from users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('bar_id')
        .eq('id', user.id)
        .single();

      if (userError && userError.code !== 'PGRST116') {
        console.error('Error fetching user data:', userError);
      }

      if (userData?.bar_id) {
        console.log('Found bar_id in users table:', userData.bar_id);
        setBarId(userData.bar_id);
        return;
      }

      // Fallback: fetch the user's bar directly
      const { data: bars, error: barsError } = await supabase
        .from('bars')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      if (barsError) {
        console.error('Error fetching bars:', barsError);
      }

      if (bars && bars.length > 0) {
        console.log('Found bar in bars table:', bars[0].id);
        setBarId(bars[0].id);
      } else {
        console.log('No bar found for user:', user.id);
        setError('No se encontró un bar asociado a tu cuenta');
      }
    } catch (error) {
      console.error('Error fetching user and bar:', error);
      setError('Error al cargar la información del usuario');
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSubscribe = async (plan: Plan) => {
    console.log('handleSubscribe called with plan:', plan.id);
    console.log('Current user:', user?.id);
    console.log('Current barId:', barId);

    if (!user) {
      Alert.alert('Error', 'No se pudo obtener la información del usuario. Por favor, inicia sesión de nuevo.');
      return;
    }

    if (!barId) {
      Alert.alert(
        'Bar no encontrado', 
        'No se encontró un bar asociado a tu cuenta. Por favor, registra un bar primero.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Registrar Bar', onPress: () => router.push('/register-bar/step1') }
        ]
      );
      return;
    }

    setLoading(true);
    setSelectedPlan(plan.id);

    try {
      console.log('Creating checkout session with:', {
        user_id: user.id,
        bar_id: barId,
        price_id: plan.priceId,
      });

      const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          user_id: user.id,
          bar_id: barId,
          price_id: plan.priceId,
        }),
      });

      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', data);

      if (data.url) {
        await Linking.openURL(data.url);
      } else {
        console.error('No URL in response:', data);
        Alert.alert('Error', data.error || 'No se pudo crear la sesión de pago');
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      Alert.alert('Error', 'No se pudo conectar con el servidor de pagos. Verifica tu conexión a internet.');
    } finally {
      setLoading(false);
      setSelectedPlan(null);
    }
  };

  const renderPlanCard = (plan: Plan, planType: string) => {
    const isSelected = selectedPlan === plan.id;
    const isLoading = loading && selectedPlan === plan.id;

    return (
      <TouchableOpacity
        key={plan.id}
        style={[
          styles.planCard,
          { borderLeftColor: plan.color },
          plan.popular && styles.popularCard,
          isSelected && styles.selectedCard
        ]}
        onPress={() => handleSubscribe(plan)}
        disabled={loading}
      >
        {plan.popular && (
          <View style={styles.popularBadge}>
            <Text style={styles.popularText}>MÁS POPULAR</Text>
          </View>
        )}

        <View style={styles.planHeader}>
          <View style={styles.planTitleContainer}>
            <Text style={styles.planSubtitle}>{plan.subtitle}</Text>
            <Text style={styles.planName}>{plan.name}</Text>
          </View>
          <View style={styles.priceContainer}>
            <Text style={styles.price}>{plan.price}</Text>
            <Text style={styles.period}>/{plan.period}</Text>
            {plan.originalPrice && (
              <Text style={styles.originalPrice}>{plan.originalPrice}</Text>
            )}
            {plan.savings && (
              <Text style={styles.savings}>{plan.savings}</Text>
            )}
          </View>
        </View>

        <View style={styles.featuresContainer}>
          {plan.features.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <View style={[styles.featureIcon, { backgroundColor: plan.color }]}>
                <Ionicons name="checkmark" size={12} color="#FFFFFF" />
              </View>
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[
            styles.subscribeButton,
            { backgroundColor: plan.color },
            isLoading && styles.subscribeButtonLoading
          ]}
          onPress={() => handleSubscribe(plan)}
          disabled={loading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.subscribeButtonText}>
              Suscribirse
            </Text>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  if (initialLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Planes de Suscripción', headerShown: false }} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Planes de Suscripción</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Cargando planes...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Planes de Suscripción', headerShown: false }} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Planes de Suscripción</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#FF6B6B" />
          <Text style={styles.errorTitle}>Error</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchUserAndBar}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.registerBarButton} onPress={() => router.push('/register-bar/step1')}>
            <Text style={styles.registerBarButtonText}>Registrar Bar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Planes de Suscripción', headerShown: false }} />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Planes de Suscripción</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.introSection}>
          <Text style={styles.introSubtitle}>
            Elige el plan que mejor se adapte a tu bar
          </Text>
        </View>

        {/* Period Selection */}
        <View style={styles.periodSelector}>
          <View style={styles.periodButtons}>
            <TouchableOpacity
              style={[
                styles.periodButton,
                selectedPeriod === 'monthly' && styles.periodButtonActive
              ]}
              onPress={() => setSelectedPeriod('monthly')}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.periodButtonText,
                selectedPeriod === 'monthly' && styles.periodButtonTextActive
              ]}>
                Mensual
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.periodButton,
                selectedPeriod === 'yearly' && styles.periodButtonActive
              ]}
              onPress={() => setSelectedPeriod('yearly')}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.periodButtonText,
                selectedPeriod === 'yearly' && styles.periodButtonTextActive
              ]}>
                Anual
              </Text>
              <View style={styles.savingsBadge}>
                <Text style={styles.savingsBadgeText}>-33%</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.plansContainer}>
          {Object.entries(plans).map(([planType, planData]) => {
            const plan = planData[selectedPeriod];
            return renderPlanCard(plan, planType);
          })}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Todos los planes incluyen una prueba gratuita de 7 días
          </Text>
          <Text style={styles.footerSubtext}>
            Puedes cancelar en cualquier momento
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E2A38',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  },
  headerSpacer: {
    width: 32,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  introSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  introTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 6,
    textAlign: 'center',
  },
  introSubtitle: {
    color: '#A0AEC0',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  plansContainer: {
    gap: 12,
  },
  planCard: {
    backgroundColor: '#2D3748',
    borderRadius: 16,
    padding: 20,
    position: 'relative',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  popularCard: {
    backgroundColor: '#2D3748',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  selectedCard: {
    backgroundColor: '#2D3748',
    borderWidth: 1,
    borderColor: '#8B5CF6',
  },
  popularBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  popularText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  planTitleContainer: {
    flex: 1,
  },
  planSubtitle: {
    color: '#A0AEC0',
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  planName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  period: {
    color: '#A0AEC0',
    fontSize: 12,
    marginTop: 2,
  },
  originalPrice: {
    color: '#A0AEC0',
    fontSize: 11,
    textDecorationLine: 'line-through',
    marginTop: 2,
  },
  savings: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  featuresContainer: {
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  featureIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  featureText: {
    color: '#E2E8F0',
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  subscribeButton: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  subscribeButtonLoading: {
    backgroundColor: '#666666',
  },
  subscribeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 20,
  },
  footerText: {
    color: '#A0AEC0',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 4,
  },
  footerSubtext: {
    color: '#A0AEC0',
    fontSize: 11,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#A0AEC0',
    fontSize: 14,
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    color: '#A0AEC0',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  retryButton: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginBottom: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  registerBarButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#10B981',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  registerBarButtonText: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: '600',
  },
  periodSelector: {
    marginBottom: 20,
  },
  periodButtons: {
    flexDirection: 'row',
    backgroundColor: '#2D3748',
    borderRadius: 10,
    padding: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 7,
    alignItems: 'center',
    position: 'relative',
  },
  periodButtonActive: {
    backgroundColor: '#007AFF',
  },
  periodButtonText: {
    color: '#A0AEC0',
    fontSize: 13,
    fontWeight: '500',
  },
  periodButtonTextActive: {
    color: '#FFFFFF',
  },
  savingsBadge: {
    position: 'absolute',
    top: -4,
    right: -2,
    backgroundColor: '#10B981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  savingsBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
});

export default SubscriptionPlansScreen; 
import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import BoostCard from '~/components/boost/BoostCard';
import { calculateDiscountBadge } from '~/lib/boost/discount';
import Paywall from '~/components/revenuecat/Paywall';
import CustomerCenter from '~/components/revenuecat/CustomerCenter';
import { useRevenueCat } from '~/contexts/RevenueCatContext';
import { toast, AppText } from '~/components/ds';

type PlanKey = '7d' | '1m' | '1y';

const PLANS: Array<{
  key: PlanKey;
  title: string;
  price: number; // euros
  durationLabel: string;
  amortizationText: string;
  isPopular?: boolean;
}> = [
  {
    key: '7d',
    title: 'Boost Semanal',
    price: 19.99,
    durationLabel: '7 días',
    amortizationText: 'Se amortiza con solo 2 clientes nuevos'
  },
  {
    key: '1m',
    title: 'Boost Mensual',
    price: 59.99,
    durationLabel: '1 mes',
    amortizationText: 'Se amortiza con solo 5 clientes nuevos',
    isPopular: true
  },
  {
    key: '1y',
    title: 'Boost de Temporada',
    price: 399.99,
    durationLabel: '1 año',
    amortizationText: 'La opción de más valor (~44€/mes)'
  },
];

const BoostScreen: React.FC = () => {
  const { barId } = useLocalSearchParams<{ barId: string }>();
  const router = useRouter();
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [customerCenterVisible, setCustomerCenterVisible] = useState(false);
  const { hasActiveBoost, refreshCustomerInfo } = useRevenueCat();

  const discounts = useMemo(() => ({
    '1m': calculateDiscountBadge('1m'),
    '1y': calculateDiscountBadge('1y')
  }), []);

  const onPay = async (plan: PlanKey) => {
    if (!barId) {
      // Este es un caso crítico de error de configuración
      Alert.alert('Error', 'Falta el identificador del bar.');
      return;
    }

    console.log('[BoostScreen] Obrint Paywall, barId:', barId, 'pla:', plan);
    // Open RevenueCat paywall
    toast.info('Redirigiendo al pago…');
    setPaywallVisible(true);
  };

  const handlePurchaseComplete = async () => {
    // Refresh customer info after purchase
    await refreshCustomerInfo();
    toast.success('¡Boost activado! ✅', 'Tu bar tiene mayor visibilidad');
    router.back();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top','bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>        
        <View style={styles.headerTop}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <AppText style={styles.title}>Impulsa tu bar</AppText>
            <AppText style={styles.subtitle}>
              Invierte en visibilidad y recupera tu inversión rápidamente
            </AppText>
          </View>
          {hasActiveBoost && (
            <TouchableOpacity 
              onPress={() => setCustomerCenterVisible(true)}
              style={styles.customerCenterButton}
            >
              <Ionicons name="person-circle-outline" size={28} color="#10B981" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {hasActiveBoost && (
          <View style={styles.activeBoostBanner}>
            <Ionicons name="checkmark-circle" size={24} color="#10B981" />
            <AppText style={styles.activeBoostText}>Boost Activo</AppText>
          </View>
        )}

        {PLANS.map(p => (
          <BoostCard
            key={p.key}
            iconName={p.key === '7d' ? 'flash' : p.key === '1m' ? 'trending-up' : 'sparkles'}
            title={p.title}
            price={`${p.price} €`}
            durationLabel={p.durationLabel}
            amortizationText={p.amortizationText}
            isPopular={p.isPopular}
            discountBadge={p.key === '7d' ? undefined : discounts[p.key as '1m'|'1y']}
            onPay={() => onPay(p.key)}
          />
        ))}
        <View style={styles.benefits}>
          <AppText style={styles.benefitTitle}>✨ Beneficios del Boost</AppText>
          <AppText style={styles.benefitSubtitle}>
            Aumenta la visibilidad de tu bar y atrae más clientes
          </AppText>
          <View style={styles.benefitItem}>
            <View style={styles.benefitIconContainer}>
              <Ionicons name="arrow-up-circle" size={20} color="#10B981" />
            </View>
            <View style={styles.benefitTextContainer}>
              <AppText style={styles.benefitText}>Mayor visibilidad en listas</AppText>
              <AppText style={styles.benefitDescription}>
                Tu bar aparece primero en búsquedas y filtros
              </AppText>
            </View>
          </View>
          <View style={styles.benefitItem}>
            <View style={styles.benefitIconContainer}>
              <Ionicons name="star" size={20} color="#FFD700" />
            </View>
            <View style={styles.benefitTextContainer}>
              <AppText style={styles.benefitText}>Etiqueta destacado</AppText>
              <AppText style={styles.benefitDescription}>
                Badge especial que llama la atención
              </AppText>
            </View>
          </View>
          <View style={styles.benefitItem}>
            <View style={styles.benefitIconContainer}>
              <Ionicons name="trending-up" size={20} color="#60A5FA" />
            </View>
            <View style={styles.benefitTextContainer}>
              <AppText style={styles.benefitText}>Prioridad en resultados</AppText>
              <AppText style={styles.benefitDescription}>
                Aparece antes que la competencia
              </AppText>
            </View>
          </View>
        </View>
      </ScrollView>

      <Paywall
        visible={paywallVisible}
        barId={barId}
        onClose={() => {
          console.log('[BoostScreen] Paywall tancat');
          setPaywallVisible(false);
        }}
        onPurchaseComplete={handlePurchaseComplete}
      />

      <CustomerCenter
        visible={customerCenterVisible}
        onClose={() => setCustomerCenterVisible(false)}
      />
    </SafeAreaView>
  );
};

export default BoostScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C2A3A'
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 13,
    lineHeight: 18,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16
  },
  benefits: {
    marginTop: 8,
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)'
  },
  benefitTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4
  },
  benefitSubtitle: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
    marginBottom: 14,
    lineHeight: 18,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  benefitIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitTextContainer: {
    flex: 1,
    gap: 2,
  },
  benefitText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  benefitDescription: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    lineHeight: 16,
  },
  customerCenterButton: {
    padding: 4,
  },
  activeBoostBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  activeBoostText: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: '700',
  },
});

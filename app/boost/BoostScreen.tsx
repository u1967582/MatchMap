import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import BoostCard from '~/components/boost/BoostCard';
import { calculateDiscountBadge } from '~/lib/boost/discount';
import { createCheckoutSession } from '~/lib/boost/boostApi';

type PlanKey = '7d' | '1m' | '1y';

const PLANS: Array<{
  key: PlanKey;
  title: string;
  price: number; // euros
  productId: string;
  durationLabel: string;
}> = [
  { key: '7d', title: '7 días', price: 9, productId: 'prod_TJUB61j3RAbErD', durationLabel: '7 días' },
  { key: '1m', title: '1 mes', price: 24, productId: 'prod_TJUCGsS0s0E8Ot', durationLabel: '1 mes' },
  { key: '1y', title: '1 año', price: 89, productId: 'prod_TJUCkXwWUBpGwD', durationLabel: '1 año' },
];

const BoostScreen: React.FC = () => {
  const { barId } = useLocalSearchParams<{ barId: string }>();
  const router = useRouter();
  const [loadingKey, setLoadingKey] = useState<PlanKey | null>(null);

  const discounts = useMemo(() => ({
    '1m': calculateDiscountBadge('1m'),
    '1y': calculateDiscountBadge('1y')
  }), []);

  const onPay = async (plan: PlanKey) => {
    if (!barId) {
      Alert.alert('Error', 'Falta el identificador del bar.');
      return;
    }
    try {
      setLoadingKey(plan);
      const { url } = await createCheckoutSession({ barId, plan });
      if (!url) throw new Error('No se recibió URL de checkout');
      // La función abre la URL internamente; si devolvemos una, abrimos fallback aquí
    } catch (err) {
      console.error('Error iniciando checkout:', err);
      Alert.alert('Error', 'No se pudo iniciar el pago. Inténtalo de nuevo.');
    } finally {
      setLoadingKey(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top','bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>        
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Aumenta la visibilidad de tu bar</Text>
        <Text style={styles.subtitle}>Elige un boost para destacar tu bar en la app</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {PLANS.map(p => (
          <BoostCard
            key={p.key}
            iconName={p.key === '7d' ? 'flash' : p.key === '1m' ? 'trending-up' : 'sparkles'}
            title={p.title}
            price={`${p.price} €`}
            productId={p.productId}
            durationLabel={p.durationLabel}
            discountBadge={p.key === '7d' ? undefined : discounts[p.key as '1m'|'1y']}
            onPay={() => onPay(p.key)}
            footer={loadingKey === p.key ? <ActivityIndicator color="#FFFFFF" /> : undefined}
          />
        ))}
        <View style={styles.benefits}>
          <Text style={styles.benefitTitle}>Beneficios del boost</Text>
          <View style={styles.benefitItem}><Ionicons name="arrow-up-circle" size={18} color="#10B981" /><Text style={styles.benefitText}>Más visibilidad en listas</Text></View>
          <View style={styles.benefitItem}><Ionicons name="star" size={18} color="#10B981" /><Text style={styles.benefitText}>Etiqueta destacado</Text></View>
          <View style={styles.benefitItem}><Ionicons name="trending-up" size={18} color="#10B981" /><Text style={styles.benefitText}>Prioridad en resultados</Text></View>
        </View>
      </ScrollView>
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8
  },
  backButton: {
    padding: 4,
    marginBottom: 4
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6
  },
  subtitle: {
    color: '#A3B3CC',
    fontSize: 14
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 16
  },
  benefits: {
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#1A2332',
    borderWidth: 1,
    borderColor: '#2A3A4A'
  },
  benefitTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8
  },
  benefitText: {
    color: '#E5E7EB',
    fontSize: 14
  }
});



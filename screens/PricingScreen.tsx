import { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AppText } from '~/components/ds';

interface PlanFeature {
  text: string;
}

interface Plan {
  id: string;
  name: string;
  price: string;
  priceUnit: string;
  features: PlanFeature[];
}

interface PlanCardProps {
  plan: Plan;
  isSelected: boolean;
  onSelect: (planId: string) => void;
}

const plans: Plan[] = [
  {
    id: 'basic',
    name: 'Basic',
    price: '4.99',
    priceUnit: '/month',
    features: [
      { text: 'Access to basic features' },
      { text: 'Limited number of bars' },
      { text: 'Standard support' },
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '12.99',
    priceUnit: '/month',
    features: [
      { text: 'Access to premium features' },
      { text: 'Unlimited bars' },
      { text: 'Priority support' },
      { text: 'Exclusive content' },
    ],
  },
  {
    id: 'ultimate',
    name: 'Ultimate',
    price: '24.99',
    priceUnit: '/month',
    features: [
      { text: 'Access to all features' },
      { text: 'Unlimited bars' },
      { text: '24/7 support' },
      { text: 'Personalized recommendations' },
      { text: 'Early access to new features' },
    ],
  },
];

const PlanCard: React.FC<PlanCardProps> = ({ plan, isSelected, onSelect }) => {
  const handleSelect = useCallback(() => {
    onSelect(plan.id);
  }, [plan.id, onSelect]);

  return (
    <TouchableOpacity
      style={[styles.planCard, isSelected && styles.planCardSelected]}
      onPress={handleSelect}
      activeOpacity={0.8}
    >
      <View style={styles.planHeader}>
        <AppText style={styles.planName}>{plan.name}</AppText>
        <View style={styles.priceContainer}>
          <AppText style={styles.planPrice}>{plan.price}</AppText>
          <AppText style={styles.priceUnit}>{plan.priceUnit}</AppText>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.choosePlanButton, isSelected && styles.choosePlanButtonSelected]}
        onPress={handleSelect}
        activeOpacity={0.7}
      >
        <AppText style={[styles.choosePlanText, isSelected && styles.choosePlanTextSelected]}>
          {isSelected ? 'Selected' : 'Choose plan'}
        </AppText>
      </TouchableOpacity>

      <View style={styles.featuresContainer}>
        {plan.features.map((feature, index) => (
          <View key={`feature-${plan.id}-${index}`} style={styles.featureRow}>
            <Ionicons name="checkmark" size={20} color="#10B981" />
            <AppText style={styles.featureText}>{feature.text}</AppText>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );
};

export default function PricingScreen() {
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const router = useRouter();

  const handlePlanSelect = useCallback((planId: string) => {
    setSelectedPlan(planId);
  }, []);

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  const handleContinue = useCallback(() => {
    if (!selectedPlan) {
      Alert.alert('Selecciona un plan', 'Por favor, elige un plan antes de continuar.');
      return;
    }

    const selectedPlanData = plans.find(plan => plan.id === selectedPlan);
    Alert.alert(
      'Plan seleccionado',
      `Has elegido el plan ${selectedPlanData?.name} por ${selectedPlanData?.price}€${selectedPlanData?.priceUnit}`,
      [
        {
          text: 'Confirmar',
          onPress: () => {
            // Here you would integrate with your payment system
            console.log('Selected plan:', selectedPlan);
            router.back();
          },
        },
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  }, [selectedPlan, router]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <AppText style={styles.headerTitle}>Choose your plan</AppText>
          <View style={styles.headerSpacer} />
        </View>

        {/* Section Title */}
        <View style={styles.sectionContainer}>
          <AppText style={styles.sectionTitle}>Select your plan</AppText>
        </View>

        {/* Plan Cards */}
        <View style={styles.plansContainer}>
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isSelected={selectedPlan === plan.id}
              onSelect={handlePlanSelect}
            />
          ))}
        </View>

        {/* Continue Button */}
        <View style={styles.continueContainer}>
          <TouchableOpacity
            style={[styles.continueButton, !selectedPlan && styles.continueButtonDisabled]}
            onPress={handleContinue}
            activeOpacity={0.8}
            disabled={!selectedPlan}
          >
            <AppText style={[styles.continueText, !selectedPlan && styles.continueTextDisabled]}>
              Continue
            </AppText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  closeButton: {
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
  sectionContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  plansContainer: {
    paddingHorizontal: 24,
    gap: 16,
  },
  planCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  planCardSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#1E293B',
  },
  planHeader: {
    marginBottom: 20,
  },
  planName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  planPrice: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '700',
  },
  priceUnit: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 4,
  },
  choosePlanButton: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  choosePlanButtonSelected: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  choosePlanText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  choosePlanTextSelected: {
    color: '#FFFFFF',
  },
  featuresContainer: {
    gap: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    color: '#94A3B8',
    fontSize: 16,
    flex: 1,
  },
  continueContainer: {
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  continueButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  continueButtonDisabled: {
    backgroundColor: '#374151',
    shadowOpacity: 0,
  },
  continueText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  continueTextDisabled: {
    color: '#6B7280',
  },
});

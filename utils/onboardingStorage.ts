import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_PLAN_KEY = 'onboardingPlan';

export type OnboardingPlan = 'free' | 'pro' | 'elite';

/**
 * Guarda el plan seleccionado durante el onboarding
 */
export async function saveOnboardingPlan(plan: OnboardingPlan): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_PLAN_KEY, plan);
  } catch (error) {
    console.warn('Error saving onboarding plan:', error);
    throw error;
  }
}

/**
 * Obtiene el plan guardado durante el onboarding
 */
export async function getOnboardingPlan(): Promise<OnboardingPlan | null> {
  try {
    const plan = await AsyncStorage.getItem(ONBOARDING_PLAN_KEY);
    return plan as OnboardingPlan | null;
  } catch (error) {
    console.warn('Error getting onboarding plan:', error);
    return null;
  }
}

/**
 * Limpia el plan guardado del onboarding
 */
export async function clearOnboardingPlan(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ONBOARDING_PLAN_KEY);
  } catch (error) {
    console.warn('Error clearing onboarding plan:', error);
  }
} 
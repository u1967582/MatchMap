// Simplified: all bars behave as PRO, ignore subscriptions/tiers
import { CAP_BY_TIER, type Tier, type Capabilities } from './planCapabilities';
import { supabase } from '~/utils/supabase';

type PlanType = 'free' | 'pro_monthly' | 'pro_yearly' | 'elite_monthly' | 'elite_yearly';

export async function getBarPlanInfo(barId: string) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('plan_type, status')
    .eq('bar_id', barId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) {
    return {
      plan_type: 'free' as PlanType,
      name: 'Gratuito'
    };
  }

  const planLabels: Record<PlanType, string> = {
    free: 'Gratuito',
    pro_monthly: 'Pro Mensual',
    pro_yearly: 'Pro Anual',
    elite_monthly: 'Elite Mensual',
    elite_yearly: 'Elite Anual',
  };

  const planType = (data[0].plan_type as string) || 'free';
  return {
    plan_type: planType,
    name: planLabels[planType] || 'Desconocido'
  };
}

/** Devuelve el tier efectivo (free/pro/elite) y sus capacidades para un bar dado */
export async function getBarTierAndCapabilities(barId: string): Promise<{ tier: Tier; capabilities: Capabilities }> {
  // Always return PRO capabilities
  const tier: Tier = 'pro';
  const capabilities = CAP_BY_TIER.pro;
  return { tier, capabilities };
}
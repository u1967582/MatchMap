import { supabase } from '~/utils/supabase';
import { CAP_BY_TIER, tierFromPlanType, type Tier, type PlanType, type Capabilities } from './planCapabilities';

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
      plan_type: 'free',
      name: 'Gratuito'
    };
  }

  const planLabels: Record<string, string> = {
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
  const { data, error } = await supabase
    .from('subscriptions')
    .select('plan_type,status,created_at')
    .eq('bar_id', barId)
    .in('status', ['active', 'trialing'])
    .order('created_at', { ascending: false })
    .limit(1);

  const planType = ((data?.[0]?.plan_type as PlanType) ?? 'free') as PlanType;
  const tier: Tier = tierFromPlanType(planType);
  const capabilities = CAP_BY_TIER[tier];
  return { tier, capabilities };
}
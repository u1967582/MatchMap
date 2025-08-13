import { supabase } from '~/utils/supabase';
import { CAP_BY_TIER, tierFromPlanType, type Tier, type PlanType } from './planCapabilities';

/** Devuelve tier + capacidades (free/pro/elite) */
export async function getEffectiveCapabilities(userId: string) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('plan_type,status,created_at')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.warn('[getEffectiveCapabilities] error', error);
  }

  const planType = (data?.[0]?.plan_type as PlanType) ?? 'free';
  const tier: Tier = tierFromPlanType(planType);
  const capabilities = CAP_BY_TIER[tier];

  return { tier, capabilities };
} 
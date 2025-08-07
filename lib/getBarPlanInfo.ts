import { supabase } from '~/utils/supabase';

export async function getBarPlanInfo(barId: string) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('plan_type, status')
    .eq('bar_id', barId)
    .eq('status', 'active')
    .single();

  if (error || !data) {
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

  return {
    plan_type: data.plan_type,
    name: planLabels[data.plan_type] || 'Desconocido'
  };
} 
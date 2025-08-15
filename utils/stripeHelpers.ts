import { supabase } from './supabase';

// Espera hasta que exista al menos 1 fila reciente sin bar_id en stripe_customers y subscriptions
export async function waitForStripeRecords(timeoutMs = 20000): Promise<boolean> {
  const start = Date.now();
  
  while (Date.now() - start < timeoutMs) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No auth user');

      // 1) stripe_customers sin bar_id
      const { data: sc, error: scErr } = await supabase
        .from('stripe_customers')
        .select('id')
        .eq('user_id', user.id)
        .is('bar_id', null)
        .order('created_at', { ascending: false })
        .limit(1);

      // 2) subscriptions sin bar_id
      const { data: subs, error: subsErr } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .is('bar_id', null)
        .order('created_at', { ascending: false })
        .limit(1);

      if (scErr || subsErr) {
        console.log('🔄 Reintentando verificación de registros Stripe...');
        // No rompas aún, reintenta
      } else if ((sc && sc.length > 0) || (subs && subs.length > 0)) {
        console.log('✅ Registros de Stripe encontrados, continuando...');
        return true;
      }

      // Espera 1.5 segundos antes del siguiente intento
      await new Promise(resolve => setTimeout(resolve, 1500));
      
    } catch (error) {
      console.log('⚠️ Error verificando registros Stripe, reintentando...', error);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
  
  console.log('⏰ Timeout esperando registros de Stripe, continuando de todas formas...');
  // No pasa nada si no están aún: el link puede igualmente intentar y ser idempotente.
  return false;
}

// Obtener el plan activo del usuario
export async function getUserActivePlan(): Promise<'pro_monthly' | 'pro_yearly' | 'elite_monthly' | 'elite_yearly' | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // El webhook ya te dejó la fila en subscriptions del user (bar_id puede ser null)
    const { data, error } = await supabase
      .from('subscriptions')
      .select('plan_type, status')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing'])
      .order('created_at', { ascending: false })
      .limit(1);

    if (error || !data?.length) return null;
    return data[0].plan_type as any;
  } catch (error) {
    console.error('❌ Error obteniendo plan activo:', error);
    return null;
  }
}

// Obtener el límite máximo de fotos según el plan
export function maxPhotosForPlan(plan: string | null): number {
  switch (plan) {
    case 'pro_monthly':
    case 'pro_yearly':
      return 10; // Según tu configuración actual
    case 'elite_monthly':
    case 'elite_yearly':
      return 25; // Según tu configuración actual
    default:
      return 2; // Plan gratuito
  }
}

// Validar que el número de fotos no exceda el límite del plan
export function validatePhotoLimit(photosCount: number, plan: string | null): { isValid: boolean; maxAllowed: number; errorMessage?: string } {
  const maxAllowed = maxPhotosForPlan(plan);
  
  if (photosCount > maxAllowed) {
    return {
      isValid: false,
      maxAllowed,
      errorMessage: `Tu plan actual permite hasta ${maxAllowed} fotos. Has seleccionado ${photosCount}.`
    };
  }
  
  return {
    isValid: true,
    maxAllowed
  };
} 
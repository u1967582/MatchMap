import * as WebBrowser from 'expo-web-browser';
import { supabase } from '~/utils/supabase';
import { FunctionsHttpError } from '@supabase/supabase-js';

export type PlanKey = '7d' | '1m' | '1y';

interface CreateCheckoutParams {
  barId: string;
  plan: PlanKey;
}

export async function createCheckoutSession(params: CreateCheckoutParams): Promise<{ url: string | null }> {
  const { barId, plan } = params;

  // Get the current session for authentication
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('User must be authenticated to create a checkout session');
  }

  console.log('🔵 Calling create-checkout-session with:', { bar_id: barId, plan });

  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: { bar_id: barId, plan },
    headers: {
      Authorization: `Bearer ${session.access_token}`
    }
  });

  // Enhanced error logging
  if (error) {
    console.error('❌ Function invocation error:', error);

    if (error instanceof FunctionsHttpError) {
      try {
        const errorMessage = await error.context.json();
        console.error('❌ Function returned error:', errorMessage);
        throw new Error(`Checkout failed: ${errorMessage.error || JSON.stringify(errorMessage)}`);
      } catch (parseError) {
        console.error('❌ Could not parse error response:', parseError);
        throw new Error(`Checkout failed: ${error.message}`);
      }
    }

    throw error;
  }

  console.log('✅ Function response:', data);

  const url: string | undefined = data?.url;
  if (url) {
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch (browserError) {
      console.error('⚠️ Browser open failed:', browserError);
    }
  }
  return { url: url ?? null };
}



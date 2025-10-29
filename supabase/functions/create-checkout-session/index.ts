/// <reference lib="dom" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@12.0.0";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";

/**
 * Create Checkout Session for Bar Boost Purchases
 *
 * This function creates a Stripe checkout session for one-time boost payments.
 *
 * Requirements:
 * - User must be authenticated (Bearer token)
 * - User must own the bar
 * - Bar cannot have an active boost already
 *
 * Plans:
 * - 7d: 7 days visibility boost (€9.00)
 * - 1m: 1 month visibility boost (€24.00)
 * - 1y: 1 year visibility boost (€89.00)
 */

type PlanKey = '7d' | '1m' | '1y';

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2022-11-15" });
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Stripe product mapping (prices in cents)
const MAP: Record<PlanKey, { product: string; amount: number }> = {
  '7d': { product: 'prod_TJUB61j3RAbErD', amount: 900 },
  '1m': { product: 'prod_TJUCGsS0s0E8Ot', amount: 2400 },
  '1y': { product: 'prod_TJUCkXwWUBpGwD', amount: 8900 }
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders() });
  }
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    // Authentication is now required
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized - Authentication required' }, 401);
    }
    const jwt = authHeader.replace('Bearer ', '');

    // Get authenticated user
    const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !userData?.user) {
      console.error('❌ Authentication failed:', userError?.message);
      return json({ error: 'Unauthorized - Invalid token' }, 401);
    }
    const userId = userData.user.id;

    const { bar_id, plan } = await req.json();
    console.log('➡️ create-checkout-session-boost payload:', { bar_id, plan, userId });
    if (!bar_id) return json({ error: 'Missing bar_id' }, 400);
    if (!['7d','1m','1y'].includes(plan)) return json({ error: 'Invalid plan' }, 400);
    const p = MAP[plan as PlanKey];
    console.log('🧮 Plan mapping:', p);

    // Verify bar ownership
    const { data: bar, error: barError } = await supabase
      .from('bars')
      .select('id, owner_id')
      .eq('id', bar_id)
      .maybeSingle();

    if (barError || !bar) {
      console.error('❌ Bar not found:', barError?.message);
      return json({ error: 'Bar not found' }, 404);
    }

    if (bar.owner_id !== userId) {
      console.error('❌ User does not own this bar');
      return json({ error: 'Forbidden - You do not own this bar' }, 403);
    }

    console.log('✅ User authenticated and owns bar:', bar_id);

    // Check for active boosts - block duplicate purchases
    const { data: activeBoost, error: boostCheckError } = await supabase
      .from('bar_boosts')
      .select('id, end_at, plan')
      .eq('bar_id', bar_id)
      .eq('status', 'active')
      .gt('end_at', new Date().toISOString())
      .maybeSingle();

    if (boostCheckError) {
      console.error('❌ Error checking active boosts:', boostCheckError.message);
      return json({ error: 'Failed to check active boosts' }, 500);
    }

    if (activeBoost) {
      const endDate = new Date(activeBoost.end_at).toLocaleDateString();
      console.log('⚠️ Bar already has active boost until:', endDate);
      return json({
        error: 'Bar already has an active boost',
        activeUntil: activeBoost.end_at,
        currentPlan: activeBoost.plan
      }, 409);
    }

    const siteUrl = Deno.env.get('SITE_URL');
    const successUrl = siteUrl 
      ? `${siteUrl}/boost/success?session_id={CHECKOUT_SESSION_ID}&bar_id=${bar_id}`
      : `matchmap://(protected)/profile?bar_id=${bar_id}`;
    const cancelUrl = siteUrl 
      ? `${siteUrl}/boost/cancel?bar_id=${bar_id}`
      : `matchmap://(protected)/profile?bar_id=${bar_id}`;
    console.log('🔗 URLs:', { successUrl, cancelUrl });

    // Get or create Stripe customer
    let customerId: string | null = null;
    try {
      const { data: existing } = await supabase
        .from('stripe_customers')
        .select('stripe_customer_id')
        .eq('user_id', userId)
        .maybeSingle();

      customerId = existing?.stripe_customer_id ?? null;

      if (!customerId) {
        // Create new Stripe customer
        const customer = await stripe.customers.create({
          metadata: { user_id: userId, bar_id: bar_id }
        });
        customerId = customer.id;

        // Save to database
        await supabase.from('stripe_customers').insert({
          user_id: userId,
          bar_id: bar_id,
          stripe_customer_id: customerId,
        });
        console.log('✅ Created new Stripe customer:', customerId);
      } else {
        // Update existing customer metadata
        await stripe.customers.update(customerId, {
          metadata: { user_id: userId, bar_id: bar_id }
        });
        await supabase
          .from('stripe_customers')
          .update({ bar_id })
          .eq('stripe_customer_id', customerId);
        console.log('✅ Updated existing Stripe customer:', customerId);
      }
    } catch (custErr) {
      console.error('❌ Stripe customer error:', (custErr as any)?.message);
      return json({ error: 'Failed to create Stripe customer' }, 500);
    }

    // Create Stripe checkout session
    let session: any;
    try {
      session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer: customerId,
        line_items: [{
          price_data: {
            currency: 'eur',
            product: p.product,
            unit_amount: p.amount
          },
          quantity: 1,
        }],
        metadata: {
          bar_id,
          plan,
          user_id: userId
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
      });
      console.log('✅ Stripe session created:', { id: session?.id, url: session?.url });
    } catch (stripeErr) {
      console.error('❌ Stripe session create failed:', {
        message: (stripeErr as any)?.message,
        type: (stripeErr as any)?.type,
        code: (stripeErr as any)?.code,
      });
      return json({ error: 'Stripe session creation failed' }, 500);
    }

    if (!session?.url) {
      return json({ error: 'Stripe session URL not generated' }, 500);
    }

    return json({ url: session.url, sessionId: session.id });
  } catch (e) {
    console.error('💥 create-checkout-session-boost error:', {
      message: (e as any)?.message,
      stack: (e as any)?.stack,
    });
    return json({ error: 'Internal server error' }, 500);
  }
});

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  };
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders() });
}



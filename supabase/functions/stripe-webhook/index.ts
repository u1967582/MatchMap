/// <reference lib="dom" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@12.0.0";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";

/**
 * Stripe Webhook Handler for MatchMap Boost Payments
 *
 * Processes one-time boost purchases for bar visibility.
 * Supported plans: 7d, 1m, 1y
 */

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2022-11-15"
});

const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

type PlanKey = '7d' | '1m' | '1y';

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({
      error: "Method not allowed"
    }), {
      status: 405,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }

  try {
    const body = await req.text();
    const sig = req.headers.get("stripe-signature");
    
    if (!sig) {
      console.error("❌ Missing Stripe signature");
      return new Response(JSON.stringify({
        error: "No signature"
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, sig, endpointSecret);
    } catch (err) {
      console.error("❌ Invalid signature:", err);
      return new Response(JSON.stringify({
        error: "Invalid signature"
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }

    console.log(`📨 Processing Stripe event: ${event.type}`);

    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutSessionCompletedForBoost(session);
    } else {
      console.log(`ℹ️ Unhandled event type (ignored): ${event.type}`);
    }

    return new Response(JSON.stringify({
      received: true,
      event_type: event.type
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error("💥 Webhook error:", error);
    return new Response(JSON.stringify({
      error: "Webhook error",
      detail: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
});

// Boost flow: one-time payment checkout
async function handleCheckoutSessionCompletedForBoost(
  session: Stripe.Checkout.Session
): Promise<void> {
  try {
    const metadata = session.metadata || {};
    const barId = metadata.bar_id;
    const userId = metadata.user_id;
    const plan = metadata.plan as PlanKey | undefined;
    const amountTotal = session.amount_total ?? 0;
    const paymentIntent = typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id;
    const sessionId = session.id;

    if (!barId || !plan) {
      console.error('❌ Missing required metadata: bar_id or plan');
      return;
    }

    if (!userId) {
      console.warn('⚠️ Missing user_id in metadata - payment will be created without user tracking');
    }

    // Validate plan type
    if (!['7d', '1m', '1y'].includes(plan)) {
      console.error('❌ Invalid plan type:', plan);
      return;
    }

    // Calculate boost start and end dates
    const now = new Date();
    const startAt = now;
    const endAt = new Date(startAt);

    if (plan === '7d') {
      endAt.setDate(endAt.getDate() + 7);
    } else if (plan === '1m') {
      endAt.setMonth(endAt.getMonth() + 1);
    } else if (plan === '1y') {
      endAt.setFullYear(endAt.getFullYear() + 1);
    }

    // Resolve product by plan (for audit)
    const productMap: Record<'7d'|'1m'|'1y', string> = {
      '7d': 'prod_TJUB61j3RAbErD',
      '1m': 'prod_TJUCGsS0s0E8Ot',
      '1y': 'prod_TJUCkXwWUBpGwD'
    };
    const resolvedProduct = plan ? productMap[plan] : null;

    // Insert payment audit record
    const { error: paymentError } = await supabase.from('boost_payments').insert({
      bar_id: barId,
      user_id: userId ?? null,
      stripe_session_id: sessionId,
      stripe_payment_intent_id: paymentIntent ?? null,
      product_id: resolvedProduct,
      plan,
      amount_cents: amountTotal,
      currency: 'eur',
      status: 'succeeded'
    });

    if (paymentError) {
      console.error('❌ Failed to insert payment record:', paymentError);
      throw new Error(`Payment record insert failed: ${paymentError.message}`);
    }

    // Insert boost record
    const { error: boostError } = await supabase.from('bar_boosts').insert({
      bar_id: barId,
      user_id: userId ?? null,
      plan,
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      status: 'active',
      stripe_session_id: sessionId,
      stripe_payment_intent_id: paymentIntent ?? null,
      amount_cents: amountTotal,
      currency: 'eur'
    });

    if (boostError) {
      console.error('❌ Failed to insert boost record:', boostError);
      throw new Error(`Boost record insert failed: ${boostError.message}`);
    }

    console.log('✅ Boost created successfully:', {
      barId,
      userId,
      plan,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      amountCents: amountTotal
    });

  } catch (error) {
    console.error('💥 Error in handleCheckoutSessionCompletedForBoost:', error);
  }
}


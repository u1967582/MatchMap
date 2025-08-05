import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2022-11-15',
});

const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.text();
    const sig = req.headers.get('stripe-signature');

    if (!sig) {
      return new Response(JSON.stringify({ error: 'No signature' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutSessionCompleted(session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;

      case 'customer.subscription.deleted':
        const deletedSubscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(deletedSubscription);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: 'Webhook error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const customer = await stripe.customers.retrieve(session.customer as string) as Stripe.Customer;
  const subscription = await stripe.subscriptions.retrieve(session.subscription as string);

  const { data: existingSubscription } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  if (!existingSubscription) {
    await supabase.from('subscriptions').insert({
      stripe_customer_id: customer.id,
      stripe_subscription_id: subscription.id,
      bar_id: customer.metadata.bar_id,
      user_id: customer.metadata.user_id,
      status: subscription.status,
      start_date: new Date(subscription.current_period_start * 1000).toISOString(),
      end_date: new Date(subscription.current_period_end * 1000).toISOString(),
      plan_type: getPlanType(subscription.items.data[0].price.id),
    });
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  await supabase
    .from('subscriptions')
    .update({
      status: subscription.status,
      start_date: new Date(subscription.current_period_start * 1000).toISOString(),
      end_date: new Date(subscription.current_period_end * 1000).toISOString(),
      plan_type: getPlanType(subscription.items.data[0].price.id),
    })
    .eq('stripe_subscription_id', subscription.id);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
    })
    .eq('stripe_subscription_id', subscription.id);
}

function getPlanType(priceId: string): string {
  const planMap: Record<string, string> = {
    'price_1RrMjG7hGI6XwPtaHSZRXojJ': 'pro_monthly',
    'price_1RsRv77hGI6XwPtaGCjuajUx': 'pro_yearly',
    'price_1RrMjc7hGI6XwPtaCrf05aoZ': 'elite_monthly',
    'price_1RsRvc7hGI6XwPtaWvHMQD6K': 'elite_yearly',
  };
  
  return planMap[priceId] || 'unknown';
} 
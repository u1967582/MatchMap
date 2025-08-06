import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from 'npm:stripe@12.0.0';
import { createClient } from 'npm:@supabase/supabase-js@2.39.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2022-11-15',
});

const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req: Request) => {
  console.log('🚀 Webhook function started');
  console.log('📝 Request method:', req.method);
  console.log(' Request URL:', req.url);
  console.log(' Request headers:', Object.fromEntries(req.headers.entries()));

  if (req.method !== 'POST') {
    console.log('❌ Method not allowed:', req.method);
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.text();
    console.log('📦 Request body length:', body.length);
    console.log('📄 Request body preview:', body.substring(0, 200) + '...');
    
    const sig = req.headers.get('stripe-signature');
    console.log('🔐 Stripe signature present:', !!sig);
    console.log('🔐 Stripe signature length:', sig?.length || 0);

    if (!sig) {
      console.error('❌ No Stripe signature found');
      return new Response(JSON.stringify({ error: 'No signature' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let event: Stripe.Event;

    try {
      event = await stripe.webhooks.constructEventAsync(body, sig, endpointSecret);
      console.log('✅ Webhook signature verified successfully');
    } catch (err) {
      console.error('❌ Webhook signature verification failed:', err);
      console.error('🔐 Endpoint secret length:', endpointSecret?.length || 0);
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(` Event received: ${event.type}`);
    console.log('📊 Event ID:', event.id);
    console.log('📊 Event object type:', event.data.object.object);
    console.log(' Event data preview:', JSON.stringify(event.data.object).substring(0, 300) + '...');

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        console.log('🛒 Processing checkout.session.completed event');
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutSessionCompleted(session);
        break;

      case 'customer.subscription.created':
        console.log('📦 Processing customer.subscription.created event');
        const createdSubscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCreated(createdSubscription);
        break;

      case 'customer.subscription.updated':
        console.log('🔄 Processing customer.subscription.updated event');
        const updatedSubscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(updatedSubscription);
        break;

      case 'customer.subscription.deleted':
        console.log('🗑️ Processing customer.subscription.deleted event');
        const deletedSubscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(deletedSubscription);
        break;

      default:
        console.log(`⚠️ Unhandled event type: ${event.type}`);
    }

    console.log('✅ Webhook processed successfully');
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    console.error('📊 Error stack:', error.stack);
    return new Response(JSON.stringify({ error: 'Webhook error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log('🛒 Processing checkout.session.completed');
  console.log('📦 Session ID:', session.id);
  console.log('👤 Customer ID:', session.customer);
  console.log(' Subscription ID:', session.subscription);
  console.log('💰 Mode:', session.mode);
  console.log('📊 Payment status:', session.payment_status);
  
  try {
    // Paso 1: Obtener cliente y suscripción
    console.log('🔍 Retrieving customer from Stripe...');
    const customer = await stripe.customers.retrieve(session.customer as string) as Stripe.Customer;
    console.log('✅ Customer retrieved:', customer.id);
    console.log('️ Customer metadata:', customer.metadata);

    console.log('🔍 Retrieving subscription from Stripe...');
    const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
    console.log('✅ Subscription retrieved:', subscription.id);
    console.log('📊 Subscription status:', subscription.status);
    console.log('💰 Price ID:', subscription.items.data[0].price.id);
    console.log(' Subscription items count:', subscription.items.data.length);

    // Verificar que tenemos los datos necesarios
    if (!customer.metadata.user_id || !customer.metadata.bar_id) {
      console.error('❌ Missing user_id or bar_id in customer metadata');
      console.error('🏷️ Available metadata:', customer.metadata);
      return;
    }

    console.log('✅ Metadata validation passed');
    console.log('👤 User ID:', customer.metadata.user_id);
    console.log(' Bar ID:', customer.metadata.bar_id);

    // Paso 2: Verificar si ya existe la suscripción
    console.log('🔍 Checking if subscription already exists...');
    const { data: existingSubscription, error: checkError } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('stripe_subscription_id', subscription.id)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('❌ Error checking existing subscription:', checkError);
      return;
    }

    if (existingSubscription) {
      console.log('⚠️ Subscription already exists, skipping insert');
      return;
    }

    console.log('✅ No existing subscription found, proceeding with insert');

    // Paso 3: Preparar datos de suscripción
    const planType = getPlanType(subscription.items.data[0].price.id);
    console.log('📊 Plan type determined:', planType);

    const subscriptionData = {
      user_id: customer.metadata.user_id,
      bar_id: customer.metadata.bar_id,
      stripe_customer_id: customer.id,
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      start_date: new Date(subscription.current_period_start * 1000).toISOString(),
      end_date: new Date(subscription.current_period_end * 1000).toISOString(),
      plan_type: planType,
    };

    console.log('📊 Subscription data to insert:', subscriptionData);

    // Validaciones adicionales
    if (!subscriptionData.start_date || !subscriptionData.end_date) {
      console.error('❌ Invalid dates in subscription data');
      return;
    }

    if (subscriptionData.plan_type === 'invalid') {
      console.error('❌ Invalid plan type, cannot insert subscription');
      return;
    }

    // Paso 4: Insertar en tabla subscriptions
    console.log('📝 Inserting subscription into database...');
    const { data: insertedSubscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .insert(subscriptionData)
      .select()
      .single();

    if (subscriptionError) {
      console.error('❌ Error inserting subscription:', subscriptionError.message);
      console.error('📄 Full error object:', subscriptionError);
      if (subscriptionError.code === '23514') {
        console.error('⚠️ Violation of CHECK constraint in plan_type');
      }
      if (subscriptionError.code === '23505') {
        console.error('⚠️ Duplicate key violation - subscription already exists');
      }
      return;
    }

    console.log('✅ Subscription inserted successfully:', insertedSubscription.id);

    // Paso 5: Actualizar subscription_status en tabla users
    console.log('👤 Updating user subscription_status...');
    const { error: userUpdateError } = await supabase
      .from('users')
      .update({ subscription_status: 'active' })
      .eq('id', customer.metadata.user_id);

    if (userUpdateError) {
      console.error('❌ Error updating user.subscription_status:', userUpdateError.message);
      console.error('📄 Full error object:', userUpdateError);
      return;
    }

    console.log('✅ User subscription_status updated to active');

    // Verificar que la actualización fue exitosa
    console.log('🔍 Verifying user update...');
    const { data: updatedUser, error: verifyError } = await supabase
      .from('users')
      .select('subscription_status')
      .eq('id', customer.metadata.user_id)
      .single();

    if (verifyError) {
      console.error('❌ Error verifying user update:', verifyError);
    } else {
      console.log('✅ User verification successful, status:', updatedUser.subscription_status);
    }

  } catch (error) {
    console.error('❌ Error in handleCheckoutSessionCompleted:', error);
    console.error('📊 Error stack:', error.stack);
  }
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  console.log('📦 Processing subscription created:', subscription.id);
  
  try {
    // Obtener el customer para acceder a los metadata
    const customer = await stripe.customers.retrieve(subscription.customer as string) as Stripe.Customer;
    console.log('👤 Customer for new subscription:', customer.id);
    console.log('️ Customer metadata:', customer.metadata);

    if (!customer.metadata.user_id || !customer.metadata.bar_id) {
      console.error('❌ Missing user_id or bar_id in customer metadata for new subscription');
      return;
    }

    // Preparar datos de suscripción
    const planType = getPlanType(subscription.items.data[0].price.id);
    console.log('📊 Plan type for new subscription:', planType);

    const subscriptionData = {
      user_id: customer.metadata.user_id,
      bar_id: customer.metadata.bar_id,
      stripe_customer_id: customer.id,
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      start_date: new Date(subscription.current_period_start * 1000).toISOString(),
      end_date: new Date(subscription.current_period_end * 1000).toISOString(),
      plan_type: planType,
    };

    console.log('📝 Inserting new subscription:', subscriptionData);

    const { data: insertedSubscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .insert(subscriptionData)
      .select()
      .single();

    if (subscriptionError) {
      console.error('❌ Error inserting new subscription:', subscriptionError.message);
      console.error('📄 Full error object:', subscriptionError);
      if (subscriptionError.code === '23514') {
        console.error('⚠️ Violation of CHECK constraint in plan_type');
      }
      return;
    }

    console.log('✅ New subscription inserted:', insertedSubscription.id);

    // Actualizar el estado del usuario
    const { error: userUpdateError } = await supabase
      .from('users')
      .update({ subscription_status: 'active' })
      .eq('id', customer.metadata.user_id);

    if (userUpdateError) {
      console.error('❌ Error updating user status for new subscription:', userUpdateError.message);
      console.error('📄 Full error object:', userUpdateError);
    } else {
      console.log('✅ User status updated to active for new subscription');
    }

  } catch (error) {
    console.error('❌ Error in handleSubscriptionCreated:', error);
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('🔄 Processing subscription update:', subscription.id);
  
  try {
    // Actualizar la suscripción
    const { error: subscriptionError } = await supabase
      .from('subscriptions')
      .update({
        status: subscription.status,
        start_date: new Date(subscription.current_period_start * 1000).toISOString(),
        end_date: new Date(subscription.current_period_end * 1000).toISOString(),
        plan_type: getPlanType(subscription.items.data[0].price.id),
      })
      .eq('stripe_subscription_id', subscription.id);

    if (subscriptionError) {
      console.error('❌ Error updating subscription:', subscriptionError.message);
      console.error('📄 Full error object:', subscriptionError);
      return;
    }

    console.log('✅ Subscription updated');

    // Actualizar el estado del usuario basado en el status de la suscripción
    const { data: subscriptionData } = await supabase
      .from('subscriptions')
      .select('user_id, status')
      .eq('stripe_subscription_id', subscription.id)
      .single();

    if (subscriptionData) {
      const userStatus = subscription.status === 'active' ? 'active' : 'cancelled';
      
      const { error: userUpdateError } = await supabase
        .from('users')
        .update({ subscription_status: userStatus })
        .eq('id', subscriptionData.user_id);

      if (userUpdateError) {
        console.error('❌ Error updating user status:', userUpdateError.message);
        console.error('📄 Full error object:', userUpdateError);
      } else {
        console.log('✅ User status updated to:', userStatus);
      }
    }

  } catch (error) {
    console.error('❌ Error in handleSubscriptionUpdated:', error);
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('🗑️ Processing subscription deletion:', subscription.id);
  
  try {
    // Actualizar la suscripción a canceled
    const { error: subscriptionError } = await supabase
      .from('subscriptions')
      .update({
        status: 'canceled',
      })
      .eq('stripe_subscription_id', subscription.id);

    if (subscriptionError) {
      console.error('❌ Error updating subscription to canceled:', subscriptionError.message);
      console.error('📄 Full error object:', subscriptionError);
      return;
    }

    console.log('✅ Subscription marked as canceled');

    // Actualizar el estado del usuario
    const { data: subscriptionData } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_subscription_id', subscription.id)
      .single();

    if (subscriptionData) {
      const { error: userUpdateError } = await supabase
        .from('users')
        .update({ subscription_status: 'cancelled' })
        .eq('id', subscriptionData.user_id);

      if (userUpdateError) {
        console.error('❌ Error updating user status to cancelled:', userUpdateError.message);
        console.error('📄 Full error object:', userUpdateError);
      } else {
        console.log('✅ User status updated to cancelled');
      }
    }

  } catch (error) {
    console.error('❌ Error in handleSubscriptionDeleted:', error);
  }
}

function getPlanType(priceId: string): string {
  const planMap: Record<string, string> = {
    'price_1RrMjG7hGI6XwPtaHSZRXojJ': 'pro_monthly',
    'price_1RsRv77hGI6XwPtaGCjuajUx': 'pro_yearly',
    'price_1RrMjc7hGI6XwPtaCrf05aoZ': 'elite_monthly',
    'price_1RsRvc7hGI6XwPtaWvHMQD6K': 'elite_yearly',
  };

  const planType = planMap[priceId];

  if (!planType) {
    console.error('❌ No matching planType found for priceId:', priceId);
    return 'invalid'; // Esto causará error con el CHECK (como debe)
  }

  console.log('✅ Mapped planType:', planType);
  return planType;
} 
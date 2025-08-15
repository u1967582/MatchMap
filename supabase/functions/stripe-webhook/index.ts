/// <reference lib="dom" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@12.0.0";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";

// Types for better type safety
interface StripeCustomer {
  id: string;
  metadata: {
    user_id?: string;
    bar_id?: string;
  };
}

interface StripeSubscription {
  id: string;
  customer: string;
  status: string;
  current_period_start: number;
  current_period_end: number;
  items: {
    data: Array<{
      price: {
        id: string;
      };
    }>;
  };
}

interface StripeCheckoutSession {
  id: string;
  customer: string;
  subscription: string;
}

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"), {
  apiVersion: "2022-11-15"
});

const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
const supabase = createClient(
  Deno.env.get("SUPABASE_URL"), 
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
);

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

    switch (event.type) {
      case "checkout.session.completed":
        {
          const session = event.data.object as StripeCheckoutSession;
          await handleCheckoutSessionCompleted(session);
          break;
        }
      case "customer.subscription.created":
        {
          const createdSubscription = event.data.object as StripeSubscription;
          await handleSubscriptionCreated(createdSubscription);
          break;
        }
      case "customer.subscription.updated":
        {
          const updatedSubscription = event.data.object as StripeSubscription;
          await handleSubscriptionUpdated(updatedSubscription);
          break;
        }
      case "customer.subscription.deleted":
        {
          const deletedSubscription = event.data.object as StripeSubscription;
          await handleSubscriptionDeleted(deletedSubscription);
          break;
        }
      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
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

async function handleCheckoutSessionCompleted(session: StripeCheckoutSession) {
  try {
    console.log(`🛒 Processing checkout session: ${session.id}`);
    
    const customer = await stripe.customers.retrieve(session.customer) as StripeCustomer;
    const subscription = await stripe.subscriptions.retrieve(session.subscription) as StripeSubscription;
    
    // Normalize metadata: user_id required; bar_id can be 'pending' -> null
    const userId = customer?.metadata?.user_id;
    const rawBarId = customer?.metadata?.bar_id;
    const barId = rawBarId && rawBarId !== "pending" ? rawBarId : null;
    
    if (!userId) {
      console.error("❌ Missing user_id in customer metadata for session:", session.id);
      return;
    }

    console.log(`👤 User: ${userId}, Bar: ${barId || 'pending'}`);

    // Safe upsert of stripe_customers (don't overwrite existing bar_id with null)
    await upsertStripeCustomerSafely({
      user_id: userId,
      maybeBarId: barId,
      stripe_customer_id: customer.id
    });

    // Avoid duplicates through idempotency
    const { data: existingSubscription, error: checkError } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("stripe_subscription_id", subscription.id)
      .maybeSingle();

    if (checkError) {
      console.error("❌ Error checking existing subscription:", checkError);
      return;
    }

    if (existingSubscription) {
      console.log("✅ Subscription already exists, skipping insert");
      return;
    }

    const planType = getPlanType(subscription.items.data[0].price.id);
    if (planType === "invalid") {
      console.error("❌ Invalid plan type, cannot insert subscription");
      return;
    }

    const subscriptionData = {
      user_id: userId,
      bar_id: barId,
      stripe_customer_id: customer.id,
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      start_date: new Date(subscription.current_period_start * 1000).toISOString(),
      end_date: new Date(subscription.current_period_end * 1000).toISOString(),
      plan_type: planType
    };

    const { error: subscriptionError } = await supabase
      .from("subscriptions")
      .insert(subscriptionData)
      .select()
      .single();

    if (subscriptionError) {
      console.error("❌ Error inserting subscription:", subscriptionError);
      return;
    }

    console.log("✅ Subscription inserted successfully");

    // Update user status
    const userStatus = subscription.status === "active" ? "active" : "active";
    const { error: userUpdateError } = await supabase
      .from("users")
      .update({ subscription_status: userStatus })
      .eq("id", userId);

    if (userUpdateError) {
      console.error("⚠️ Error updating user.subscription_status:", userUpdateError);
    } else {
      console.log("✅ User status updated to:", userStatus);
    }
  } catch (error) {
    console.error("💥 Error in handleCheckoutSessionCompleted:", error);
  }
}

async function handleSubscriptionCreated(subscription: StripeSubscription) {
  try {
    console.log(`🆕 Processing new subscription: ${subscription.id}`);
    
    const customer = await stripe.customers.retrieve(subscription.customer) as StripeCustomer;
    const userId = customer?.metadata?.user_id;
    const rawBarId = customer?.metadata?.bar_id;
    const barId = rawBarId && rawBarId !== "pending" ? rawBarId : null;
    
    if (!userId) {
      console.error("❌ Missing user_id in customer metadata for subscription:", subscription.id);
      return;
    }

    await upsertStripeCustomerSafely({
      user_id: userId,
      maybeBarId: barId,
      stripe_customer_id: customer.id
    });

    const planType = getPlanType(subscription.items.data[0].price.id);
    if (planType === "invalid") {
      console.error("❌ Invalid plan type, cannot insert subscription");
      return;
    }

    const subscriptionData = {
      user_id: userId,
      bar_id: barId,
      stripe_customer_id: customer.id,
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      start_date: new Date(subscription.current_period_start * 1000).toISOString(),
      end_date: new Date(subscription.current_period_end * 1000).toISOString(),
      plan_type: planType
    };

    // Idempotency through unique(stripe_subscription_id)
    const { error: subscriptionError } = await supabase
      .from("subscriptions")
      .insert(subscriptionData)
      .select()
      .single();

    if (subscriptionError) {
      console.error("❌ Error inserting new subscription:", subscriptionError);
      return;
    }

    console.log("✅ New subscription inserted successfully");

    // Update user status
    const userStatus = subscription.status === "active" ? "active" : "active";
    const { error: userUpdateError } = await supabase
      .from("users")
      .update({ subscription_status: userStatus })
      .eq("id", userId);

    if (userUpdateError) {
      console.error("⚠️ Error updating user status for new subscription:", userUpdateError);
    } else {
      console.log("✅ User status updated to:", userStatus);
    }
  } catch (error) {
    console.error("💥 Error in handleSubscriptionCreated:", error);
  }
}

async function handleSubscriptionUpdated(subscription: StripeSubscription) {
  try {
    console.log(`🔄 Processing subscription update: ${subscription.id}`);
    
    const { error: subscriptionError } = await supabase
      .from("subscriptions")
      .update({
        status: subscription.status,
        start_date: new Date(subscription.current_period_start * 1000).toISOString(),
        end_date: new Date(subscription.current_period_end * 1000).toISOString(),
        plan_type: getPlanType(subscription.items.data[0].price.id),
        updated_at: new Date().toISOString()
      })
      .eq("stripe_subscription_id", subscription.id);

    if (subscriptionError) {
      console.error("❌ Error updating subscription:", subscriptionError);
      return;
    }

    console.log("✅ Subscription updated successfully");

    const { data: subRow } = await supabase
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_subscription_id", subscription.id)
      .maybeSingle();

    if (subRow?.user_id) {
      const userStatus = subscription.status === "active" || subscription.status === "trialing" 
        ? "active" 
        : "cancelled";
      
      const { error: userUpdateError } = await supabase
        .from("users")
        .update({ subscription_status: userStatus })
        .eq("id", subRow.user_id);

      if (userUpdateError) {
        console.error("⚠️ Error updating user status:", userUpdateError);
      } else {
        console.log("✅ User status updated to:", userStatus);
      }
    }
  } catch (error) {
    console.error("💥 Error in handleSubscriptionUpdated:", error);
  }
}

async function handleSubscriptionDeleted(subscription: StripeSubscription) {
  try {
    console.log(`🗑️ Processing subscription deletion: ${subscription.id}`);
    
    const { error: subscriptionError } = await supabase
      .from("subscriptions")
      .update({
        status: "canceled",
        updated_at: new Date().toISOString()
      })
      .eq("stripe_subscription_id", subscription.id);

    if (subscriptionError) {
      console.error("❌ Error updating subscription to canceled:", subscriptionError);
      return;
    }

    console.log("✅ Subscription marked as canceled");

    const { data: subRow } = await supabase
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_subscription_id", subscription.id)
      .maybeSingle();

    if (subRow?.user_id) {
      const { error: userUpdateError } = await supabase
        .from("users")
        .update({ subscription_status: "cancelled" })
        .eq("id", subRow.user_id);

      if (userUpdateError) {
        console.error("⚠️ Error updating user status to cancelled:", userUpdateError);
      } else {
        console.log("✅ User status updated to cancelled");
      }
    }
  } catch (error) {
    console.error("💥 Error in handleSubscriptionDeleted:", error);
  }
}

// Avoid overwriting existing bar_id with null.
// If stripe_customer exists and has no bar_id, and we receive one -> set it.
// If it doesn't exist, insert it with whatever bar_id we have (maybe null).
async function upsertStripeCustomerSafely(params: {
  user_id: string;
  maybeBarId: string | null;
  stripe_customer_id: string;
}) {
  const { user_id, maybeBarId, stripe_customer_id } = params;
  
  const { data: existing, error } = await supabase
    .from("stripe_customers")
    .select("id, bar_id")
    .eq("stripe_customer_id", stripe_customer_id)
    .maybeSingle();

  if (error) {
    console.error("❌ Error reading stripe_customers:", error);
    return;
  }

  if (existing) {
    if (!existing.bar_id && maybeBarId) {
      // Update with new bar_id
      await supabase
        .from("stripe_customers")
        .update({
          bar_id: maybeBarId,
          updated_at: new Date().toISOString()
        })
        .eq("id", existing.id);
      console.log("✅ Updated stripe_customer with bar_id:", maybeBarId);
    } else {
      // Ensure updated_at and user_id for consistency
      await supabase
        .from("stripe_customers")
        .update({
          user_id,
          updated_at: new Date().toISOString()
        })
        .eq("id", existing.id);
    }
  } else {
    // Insert new record
    await supabase
      .from("stripe_customers")
      .insert({
        user_id,
        bar_id: maybeBarId || null,
        stripe_customer_id
      });
    console.log("✅ Created new stripe_customer");
  }
}

function getPlanType(priceId: string): string {
  // ✅ ACTUALIZADO: Nuevos IDs de precios de Stripe
  const planMap: Record<string, string> = {
    'price_1RvGlr7hGI6XwPtaE9d03BfI': 'pro_monthly',
    'price_1RvGlr7hGI6XwPta032XCAwP': 'pro_yearly',
    'price_1RvGmN7hGI6XwPtaye2UkCso': 'elite_monthly',
    'price_1RvGmN7hGI6XwPta96F6JX70': 'elite_yearly'
  };
  
  const planType = planMap[priceId];
  if (!planType) {
    console.error("❌ No matching planType found for priceId:", priceId);
    return "invalid";
  }
  
  return planType;
}

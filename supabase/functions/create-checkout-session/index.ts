/// <reference lib="dom" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@12.0.0";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2022-11-15" });
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders(),
    });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const { user_id, price_id, bar_id, success_url, cancel_url } = await req.json();

    if (!user_id) return json({ error: "Missing user_id" }, 400);
    if (!price_id) return json({ error: "Missing price_id" }, 400);

    // 1) Buscar/crear stripe_customer
    const { data: existing } = await supabase
      .from("stripe_customers")
      .select("stripe_customer_id")
      .eq("user_id", user_id)
      .single();

    let customerId: string | null = existing?.stripe_customer_id ?? null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: {
          user_id,
          bar_id: bar_id ?? "pending",
        },
      });
      customerId = customer.id;

      // Insert stripe_customers
      await supabase.from("stripe_customers").insert({
        user_id,
        bar_id: bar_id ?? null,
        stripe_customer_id: customerId,
      });
    } else {
      // Asegurar metadata actualizada en Stripe
      await stripe.customers.update(customerId, {
        metadata: {
          user_id,
          bar_id: bar_id ?? "pending",
        },
      });
      // Si ahora recibimos bar_id y antes era null/pending, opcionalmente actualizar stripe_customers.bar_id
      if (bar_id) {
        await supabase
          .from("stripe_customers")
          .update({ bar_id })
          .eq("stripe_customer_id", customerId);
      }
    }

    // 2) Crear Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId!,
      mode: "subscription",
      line_items: [{ price: price_id, quantity: 1 }],
      success_url:
        success_url ||
        (bar_id
          ? "matchmap://profile?payment=success" // upgrade con bar
          : "matchmap://register-bar/step1?payment=success" // registro paso 0
        ),
      cancel_url:
        cancel_url ||
        (bar_id
          ? "matchmap://profile?payment=cancelled"
          : "matchmap://register-bar/step0?payment=cancelled"
        ),
      metadata: {
        user_id,
        bar_id: bar_id ?? "pending",
      },
    });

    return json({ url: session.url }, 200);
  } catch (e) {
    console.error("create-checkout-session error:", e);
    return json({ error: "Internal server error" }, 500);
  }
});

// Helpers
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

/// <reference lib="dom" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders() });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const accessToken = auth.split(" ")[1];
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    );

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const { bar_id } = await req.json();
    if (!bar_id) return json({ error: "Missing bar_id" }, 400);

    // 1) stripe_customers.bar_id
    await supabase
      .from("stripe_customers")
      .update({ bar_id })
      .eq("user_id", user.id);

    // 2) subscriptions.bar_id (todas las pendientes)
    await supabase
      .from("subscriptions")
      .update({ bar_id })
      .eq("user_id", user.id)
      .is("bar_id", null);

    return json({ linked: true }, 200);
  } catch (e) {
    console.error("link-bar-to-subscription error:", e);
    return json({ error: "Internal server error" }, 500);
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

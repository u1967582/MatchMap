import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    // Verify the requesting user via JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const { userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: "userId is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Create admin client with service_role to delete auth user
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify the JWT belongs to the same user requesting deletion
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: callerUser }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !callerUser || callerUser.id !== userId) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized: can only delete your own account" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`[DELETE-ACCOUNT] Starting deletion for user ${userId}`);

    // 1. Get user's bars to clean up related data
    const { data: userBars } = await supabase
      .from("bars")
      .select("id")
      .eq("owner_id", userId);

    const barIds = userBars?.map((b) => b.id) || [];

    // 2. Delete bar-related data if user owns bars
    if (barIds.length > 0) {
      console.log(`[DELETE-ACCOUNT] Cleaning up ${barIds.length} bars`);

      // Delete bar matches, images, menus, posts, etc.
      await supabase.from("bar_matches").delete().in("bar_id", barIds);
      await supabase.from("bar_images").delete().in("bar_id", barIds);
      await supabase.from("bar_menus").delete().in("bar_id", barIds);
      await supabase.from("bar_posts").delete().in("bar_id", barIds);
      await supabase.from("bar_categories").delete().in("bar_id", barIds);
      await supabase.from("bar_sports").delete().in("bar_id", barIds);
      await supabase.from("bar_foods").delete().in("bar_id", barIds);
      await supabase.from("bar_ambiances").delete().in("bar_id", barIds);
      await supabase.from("bar_auto_broadcast_preferences").delete().in("bar_id", barIds);

      // Delete bars themselves
      await supabase.from("bars").delete().in("id", barIds);
    }

    // 3. Delete user-related data
    console.log(`[DELETE-ACCOUNT] Cleaning up user data`);
    await supabase.from("reviews").delete().eq("user_id", userId);
    await supabase.from("favorites").delete().eq("user_id", userId);
    await supabase.from("review_likes").delete().eq("user_id", userId);

    // 4. Delete the user record from public.users
    await supabase.from("users").delete().eq("id", userId);

    // 5. Delete the auth user (requires service_role)
    console.log(`[DELETE-ACCOUNT] Deleting auth user`);
    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(userId);

    if (deleteAuthError) {
      console.error(`[DELETE-ACCOUNT] Error deleting auth user:`, deleteAuthError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to delete authentication user" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`[DELETE-ACCOUNT] Successfully deleted user ${userId}`);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error(`[DELETE-ACCOUNT] Unexpected error:`, error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

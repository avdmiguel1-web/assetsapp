import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey =
      Deno.env.get("SUPABASE_ANON_KEY") ??
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
      "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const authorization = req.headers.get("Authorization");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return json({ error: "Missing Supabase environment variables." }, 500);
    }

    if (!authorization) {
      return json({ error: "Missing Authorization header." }, 401);
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user: actor },
      error: actorError,
    } = await userClient.auth.getUser();

    if (actorError || !actor) {
      return json({ error: "Unauthorized request." }, 401);
    }

    const { data: actorProfile, error: profileError } = await adminClient
      .from("user_profiles")
      .select("id, role, email, full_name")
      .eq("id", actor.id)
      .single();

    if (profileError || !actorProfile) {
      return json({ error: "Admin profile not found." }, 403);
    }

    if (actorProfile.role !== "admin") {
      return json({ error: "Only administrators can delete users." }, 403);
    }

    const { userId } = await req.json();
    if (!userId || typeof userId !== "string") {
      return json({ error: "A valid userId is required." }, 400);
    }

    if (userId === actor.id) {
      return json({ error: "You cannot delete your own account." }, 400);
    }

    const { data: targetProfile, error: targetError } = await adminClient
      .from("user_profiles")
      .select("id, email, full_name")
      .eq("id", userId)
      .maybeSingle();

    if (targetError) {
      return json({ error: targetError.message }, 500);
    }

    if (!targetProfile) {
      return json({ error: "User not found." }, 404);
    }

    const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      return json({ error: authDeleteError.message }, 500);
    }

    const { error: permissionsError } = await adminClient
      .from("user_permissions")
      .delete()
      .eq("user_id", userId);

    if (permissionsError) {
      return json({ error: permissionsError.message }, 500);
    }

    const { error: profileDeleteError } = await adminClient
      .from("user_profiles")
      .delete()
      .eq("id", userId);

    if (profileDeleteError) {
      return json({ error: profileDeleteError.message }, 500);
    }

    const { error: auditError } = await adminClient.from("audit_logs").insert({
      id: crypto.randomUUID(),
      user_id: actor.id,
      user_email: actorProfile.email ?? actor.email ?? null,
      user_name: actorProfile.full_name ?? actor.user_metadata?.full_name ?? null,
      action: "delete",
      entity_type: "user",
      entity_id: userId,
      entity_label: targetProfile.email ?? targetProfile.full_name ?? userId,
      details: {
        deletedUserEmail: targetProfile.email ?? null,
        deletedUserName: targetProfile.full_name ?? null,
      },
      created_at: new Date().toISOString(),
    });

    if (auditError) {
      console.error("[delete-user] audit log error", auditError);
    }

    return json({
      ok: true,
      message: `Usuario ${targetProfile.email ?? userId} eliminado correctamente.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return json({ error: message }, 500);
  }
});

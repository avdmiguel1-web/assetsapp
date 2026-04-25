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

  if (req.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Missing Supabase environment variables." }, 500);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { email, password, fullName, companyName, companyId, role } = await req.json();

    if (!email || typeof email !== "string") {
      return json({ error: "A valid email is required." }, 400);
    }

    if (!password || typeof password !== "string" || password.length < 6) {
      return json({ error: "Password must be at least 6 characters." }, 400);
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = typeof fullName === "string" ? fullName.trim() : "";
    const normalizedCompanyName = typeof companyName === "string" ? companyName.trim() : "";
    const normalizedCompanyId = typeof companyId === "string" ? companyId.trim() : "";
    const normalizedRole = typeof role === "string" ? role.trim().toLowerCase() : "";

    const { data, error } = await adminClient.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: normalizedName || normalizedEmail.split("@")[0],
        company_name: normalizedCompanyName || undefined,
        company_id: normalizedCompanyId || undefined,
        role: normalizedRole || undefined,
      },
    });

    if (error) {
      return json({ error: error.message }, 400);
    }

    return json({
      ok: true,
      userId: data.user?.id ?? null,
      message: "Usuario creado correctamente.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return json({ error: message }, 500);
  }
});

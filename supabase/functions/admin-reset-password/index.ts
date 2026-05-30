import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function generateSecurePassword(length = 14): string {
  const charset = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);
  let password = "";
  for (const v of values) {
    password += charset[v % charset.length];
  }
  return password;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = userData.user.id;

    const { user_id, organization_id, new_password } = await req.json() as {
      user_id: string; organization_id: string; new_password?: string;
    };
    if (!user_id || !organization_id) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios faltando" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // caller must be org admin
    const { data: isAdminRes } = await admin.rpc("is_org_admin", {
      _user_id: callerId, _org_id: organization_id,
    });
    if (!isAdminRes) {
      return new Response(JSON.stringify({ error: "Permissão negada" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // target user must belong to the org
    const { data: targetMember } = await admin
      .from("organization_members")
      .select("user_id").eq("user_id", user_id).eq("organization_id", organization_id).maybeSingle();
    if (!targetMember) {
      return new Response(JSON.stringify({ error: "Usuário não pertence a essa organização" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // generate password if not supplied
    const password = new_password && new_password.length >= 6
      ? new_password
      : generateSecurePassword();

    const { error: updErr } = await admin.auth.admin.updateUserById(user_id, { password });
    if (updErr) {
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

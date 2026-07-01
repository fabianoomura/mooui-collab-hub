import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    if (userErr || !userData.user) return json({ error: "Não autenticado" }, 401);
    const callerId = userData.user.id;

    const { user_id, organization_id, days, expires_at } = await req.json() as {
      user_id: string; organization_id: string; days?: number; expires_at?: string | null;
    };
    if (!user_id || !organization_id) return json({ error: "Campos obrigatórios faltando" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: isAdminRes } = await admin.rpc("is_org_admin", {
      _user_id: callerId, _org_id: organization_id,
    });
    if (!isAdminRes) return json({ error: "Permissão negada" }, 403);

    let newExpiry: string | null;
    if (expires_at === null) {
      newExpiry = null; // sem expiração
    } else if (expires_at) {
      newExpiry = new Date(expires_at).toISOString();
    } else {
      const d = Math.max(1, Math.min(days ?? 90, 3650));
      const dt = new Date();
      dt.setUTCDate(dt.getUTCDate() + d);
      newExpiry = dt.toISOString();
    }

    const { error: upErr } = await admin
      .from("organization_members")
      .update({
        access_expires_at: newExpiry,
        access_renewed_at: new Date().toISOString(),
        access_renewed_by: callerId,
      })
      .eq("user_id", user_id)
      .eq("organization_id", organization_id);
    if (upErr) return json({ error: upErr.message }, 400);

    return json({ ok: true, access_expires_at: newExpiry });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

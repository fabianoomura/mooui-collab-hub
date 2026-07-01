import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Status = "active" | "suspended";

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
      return json({ error: "Não autenticado" }, 401);
    }
    const callerId = userData.user.id;

    const body = await req.json() as {
      user_id: string; organization_id: string; status: Status; reason?: string;
    };
    if (!body.user_id || !body.organization_id || !["active", "suspended"].includes(body.status)) {
      return json({ error: "Campos obrigatórios inválidos" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: isAdminRes } = await admin.rpc("is_org_admin", {
      _user_id: callerId, _org_id: body.organization_id,
    });
    if (!isAdminRes) return json({ error: "Permissão negada" }, 403);

    if (callerId === body.user_id && body.status === "suspended") {
      return json({ error: "Não é possível suspender a si mesmo" }, 400);
    }

    const patch: Record<string, unknown> = {
      status: body.status,
      status_changed_at: new Date().toISOString(),
      status_changed_by: callerId,
    };
    if (body.status === "suspended") {
      patch.suspended_at = new Date().toISOString();
      patch.suspended_by = callerId;
      patch.suspension_reason = body.reason ?? null;
    } else {
      patch.suspended_at = null;
      patch.suspended_by = null;
      patch.suspension_reason = null;
    }

    const { error: upErr } = await admin
      .from("organization_members")
      .update(patch)
      .eq("user_id", body.user_id)
      .eq("organization_id", body.organization_id);
    if (upErr) return json({ error: upErr.message }, 400);

    return json({ ok: true, status: body.status });
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

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

    const { organization_id } = await req.json().catch(() => ({} as { organization_id?: string }));
    if (!organization_id) return json({ error: "organization_id é obrigatório" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // O usuário só pode registrar o próprio acesso
    const now = new Date().toISOString();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const ua = req.headers.get("user-agent") ?? null;

    // Set first_seen_at if null
    const { data: current } = await admin
      .from("organization_members")
      .select("first_seen_at, status, access_expires_at")
      .eq("user_id", callerId)
      .eq("organization_id", organization_id)
      .maybeSingle();

    if (!current) return json({ error: "Você não pertence a essa organização" }, 403);
    if (current.status === "suspended") return json({ error: "Acesso suspenso" }, 403);
    if (current.access_expires_at && new Date(current.access_expires_at) <= new Date()) {
      return json({ error: "Acesso expirado" }, 403);
    }

    const patch: Record<string, unknown> = {
      last_seen_at: now,
      last_seen_ip: ip,
      last_seen_user_agent: ua,
    };
    if (!current.first_seen_at) patch.first_seen_at = now;

    const { error: upErr } = await admin
      .from("organization_members")
      .update(patch)
      .eq("user_id", callerId)
      .eq("organization_id", organization_id);
    if (upErr) return json({ error: upErr.message }, 400);

    return json({ ok: true });
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

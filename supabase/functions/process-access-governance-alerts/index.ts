import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CRON_SECRET = Deno.env.get("ACCESS_GOVERNANCE_CRON_SECRET");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const providedSecret = req.headers.get("x-cron-secret")
    ?? (req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "");
  if (!CRON_SECRET || providedSecret !== CRON_SECRET) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    let limit = 200;
    try {
      const body = await req.json();
      if (typeof body?.limit === "number") limit = Math.max(1, Math.min(body.limit, 1000));
    } catch { /* body optional */ }

    const { data, error } = await admin.rpc("process_access_governance_alerts", { _limit: limit });
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true, processed: data ?? 0 });
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

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

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
    if (userErr || !userData.user) return json({ error: "Nao autenticado" }, 401);
    const callerId = userData.user.id;

    const { organization_id, user_id, access_expires_at } = await req.json() as {
      organization_id: string;
      user_id: string;
      access_expires_at?: string | null;
    };

    if (!organization_id || !user_id) return json({ error: "Campos obrigatorios faltando" }, 400);

    let normalizedExpiry: string | null = null;
    if (access_expires_at) {
      const date = new Date(access_expires_at);
      if (Number.isNaN(date.getTime())) return json({ error: "Data de expiracao invalida" }, 400);
      if (date.getTime() <= Date.now()) return json({ error: "A data deve ser futura" }, 400);
      normalizedExpiry = date.toISOString();
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: isAdminRes, error: roleErr } = await admin.rpc("is_org_admin", {
      _user_id: callerId,
      _org_id: organization_id,
    });
    if (roleErr || !isAdminRes) return json({ error: "Permissao negada" }, 403);

    const { data: targetMember, error: memberErr } = await admin
      .from("organization_members")
      .select("user_id, role, status")
      .eq("organization_id", organization_id)
      .eq("user_id", user_id)
      .maybeSingle();
    if (memberErr || !targetMember) return json({ error: "Usuario nao pertence a organizacao" }, 404);
    if (targetMember.status === "suspended") return json({ error: "Reative o usuario antes de renovar acesso" }, 400);

    if (targetMember.role === "admin" && normalizedExpiry) {
      const { data: admins, error: adminErr } = await admin
        .from("organization_members")
        .select("user_id, access_expires_at")
        .eq("organization_id", organization_id)
        .eq("role", "admin")
        .eq("status", "active");
      if (adminErr) throw adminErr;
      const otherActiveAdmins = (admins || []).filter((row: any) => {
        if (row.user_id === user_id) return false;
        return !row.access_expires_at || new Date(row.access_expires_at).getTime() > Date.now();
      });
      if (otherActiveAdmins.length === 0) {
        return json({ error: "Nao e possivel expirar o acesso do ultimo admin ativo" }, 400);
      }
    }

    const now = new Date().toISOString();
    const { error: updateErr } = await admin
      .from("organization_members")
      .update({
        access_expires_at: normalizedExpiry,
        access_renewed_at: now,
        access_renewed_by: callerId,
      })
      .eq("organization_id", organization_id)
      .eq("user_id", user_id);
    if (updateErr) throw updateErr;

    return json({ ok: true, access_expires_at: normalizedExpiry });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});

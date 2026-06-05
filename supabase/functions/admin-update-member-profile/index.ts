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
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Nao autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { organization_id, user_id, full_name, department, position } = body as {
      organization_id: string;
      user_id: string;
      full_name?: string | null;
      department?: string | null;
      position?: string | null;
    };

    if (!organization_id || !user_id) {
      return new Response(JSON.stringify({ error: "Campos obrigatorios faltando" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: isAdminRes, error: roleErr } = await admin.rpc("is_org_admin", {
      _user_id: userData.user.id,
      _org_id: organization_id,
    });
    if (roleErr || !isAdminRes) {
      return new Response(JSON.stringify({ error: "Permissao negada" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: membership, error: membershipErr } = await admin
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", organization_id)
      .eq("user_id", user_id)
      .maybeSingle();
    if (membershipErr || !membership) {
      return new Response(JSON.stringify({ error: "Usuario nao pertence a organizacao" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const patch: Record<string, string | null> = {};
    if (full_name !== undefined) patch.full_name = full_name;
    if (department !== undefined) patch.department = department;
    if (position !== undefined) patch.position = position;

    const { data, error } = await admin
      .from("profiles")
      .update(patch)
      .eq("id", user_id)
      .select("id, full_name, department, position")
      .maybeSingle();
    if (error || !data) {
      return new Response(JSON.stringify({ error: error?.message ?? "Perfil nao atualizado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, profile: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

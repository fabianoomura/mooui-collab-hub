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

    const { organization_id, user_id } = await req.json() as {
      organization_id: string;
      user_id: string;
    };

    if (!organization_id || !user_id) {
      return new Response(JSON.stringify({ error: "Campos obrigatorios faltando" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (user_id === userData.user.id) {
      return new Response(JSON.stringify({ error: "Voce nao pode excluir seu proprio usuario" }), {
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

    const { data: targetMember, error: memberErr } = await admin
      .from("organization_members")
      .select("user_id, role, status")
      .eq("organization_id", organization_id)
      .eq("user_id", user_id)
      .maybeSingle();
    if (memberErr || !targetMember) {
      return new Response(JSON.stringify({ error: "Usuario nao pertence a organizacao" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (targetMember.role === "admin" && (targetMember.status ?? "active") === "active") {
      const { data: admins, error: adminCountErr } = await admin
        .from("organization_members")
        .select("user_id, access_expires_at")
        .eq("organization_id", organization_id)
        .eq("role", "admin")
        .eq("status", "active");
      if (adminCountErr) throw adminCountErr;
      const activeAdminCount = (admins || []).filter((row: any) => {
        return !row.access_expires_at || new Date(row.access_expires_at).getTime() > Date.now();
      }).length;
      if (activeAdminCount <= 1) {
        return new Response(JSON.stringify({ error: "Nao e possivel excluir o ultimo admin" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { error: deleteErr } = await admin.auth.admin.deleteUser(user_id);
    if (deleteErr) {
      return new Response(JSON.stringify({ error: deleteErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, deleted_auth_user: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

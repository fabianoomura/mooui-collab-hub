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
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = userData.user.id;

    const body = await req.json();
    const {
      email,
      password,
      full_name,
      organization_id,
      org_role = "member",
      department,
      position,
      app_role,
      send_invite = false,
      redirect_to,
      access_expires_at,
    } = body as {
      email: string;
      password?: string;
      full_name?: string;
      organization_id: string;
      org_role?: "admin" | "member";
      department?: string;
      position?: string;
      app_role?: "admin" | "director" | "manager" | "operator" | "member";
      send_invite?: boolean;
      redirect_to?: string;
      access_expires_at?: string | null;
    };

    if (!email || !organization_id || (!send_invite && !password)) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios faltando" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // verify caller is org admin
    const { data: isAdminRes, error: roleErr } = await admin.rpc("is_org_admin", {
      _user_id: callerId,
      _org_id: organization_id,
    });
    if (roleErr || !isAdminRes) {
      return new Response(JSON.stringify({ error: "Permissão negada" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const metadata = { full_name: full_name ?? "", organization_id };
    const { data: created, error: createErr } = send_invite
      ? await admin.auth.admin.inviteUserByEmail(email, {
          data: metadata,
          redirectTo: redirect_to,
        })
      : await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: metadata,
        });
    if (createErr || !created.user) {
      return new Response(JSON.stringify({ error: createErr?.message ?? "Erro ao criar usuário" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newId = created.user.id;
    const now = new Date();
    const inviteExpiresAt = send_invite ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString() : null;

    // ensure profile row exists with extras (handle_new_user trigger inserts basics)
    await admin
      .from("profiles")
      .upsert({ id: newId, full_name: full_name ?? "", department, position }, { onConflict: "id" });

    // add to organization
    await admin
      .from("organization_members")
      .insert({
        organization_id,
        user_id: newId,
        role: org_role,
        status: "active",
        invited_at: send_invite ? now.toISOString() : null,
        invite_last_sent_at: send_invite ? now.toISOString() : null,
        invite_expires_at: inviteExpiresAt,
        invite_sent_count: send_invite ? 1 : 0,
        invite_last_sent_by: send_invite ? callerId : null,
        access_expires_at: access_expires_at || null,
      });

    // app role override
    if (app_role && app_role !== "member") {
      await admin.from("user_roles").insert({ user_id: newId, role: app_role });
    }

    return new Response(JSON.stringify({ ok: true, user_id: newId, invited: send_invite, invite_expires_at: inviteExpiresAt }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

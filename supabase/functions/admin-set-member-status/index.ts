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

    const {
      organization_id,
      user_id,
      status,
      reason,
      block_auth = false,
      unblock_auth = true,
    } = await req.json() as {
      organization_id: string;
      user_id: string;
      status: "active" | "invited" | "suspended";
      reason?: string | null;
      block_auth?: boolean;
      unblock_auth?: boolean;
    };

    if (!organization_id || !user_id || !status) {
      return json({ error: "Campos obrigatorios faltando" }, 400);
    }
    if (status === "suspended" && (!reason || reason.trim().length < 3)) {
      return json({ error: "Informe o motivo da suspensao" }, 400);
    }
    if (user_id === callerId && status !== "active") {
      return json({ error: "Voce nao pode suspender seu proprio usuario" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: isAdminRes, error: roleErr } = await admin.rpc("is_org_admin", {
      _user_id: callerId,
      _org_id: organization_id,
    });
    if (roleErr || !isAdminRes) return json({ error: "Permissao negada" }, 403);

    const { data: targetMember, error: memberErr } = await admin
      .from("organization_members")
      .select("user_id, role, status, auth_blocked_at")
      .eq("organization_id", organization_id)
      .eq("user_id", user_id)
      .maybeSingle();
    if (memberErr || !targetMember) {
      return json({ error: "Usuario nao pertence a organizacao" }, 404);
    }

    if (targetMember.role === "admin" && (targetMember.status ?? "active") === "active" && status !== "active") {
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
      if (activeAdminCount <= 1) return json({ error: "Nao e possivel suspender o ultimo admin ativo" }, 400);
    }

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      status,
      status_changed_at: now,
      status_changed_by: callerId,
    };

    let authBlocked = false;
    let authUnblocked = false;

    if (status === "suspended") {
      patch.suspended_at = now;
      patch.suspended_by = callerId;
      patch.suspension_reason = reason?.trim();
      if (block_auth) {
        const { error: banErr } = await admin.auth.admin.updateUserById(user_id, {
          ban_duration: "876000h",
        });
        if (banErr) throw banErr;
        patch.auth_blocked_at = now;
        patch.auth_blocked_by = callerId;
        patch.auth_block_reason = reason?.trim();
        authBlocked = true;
      } else {
        patch.auth_blocked_at = null;
        patch.auth_blocked_by = null;
        patch.auth_block_reason = null;
      }
    } else {
      patch.suspended_at = null;
      patch.suspended_by = null;
      patch.suspension_reason = null;
      if (status === "invited") patch.invited_at = now;
      if (unblock_auth && targetMember.auth_blocked_at) {
        const { error: unbanErr } = await admin.auth.admin.updateUserById(user_id, {
          ban_duration: "none",
        });
        if (unbanErr) throw unbanErr;
        authUnblocked = true;
      }
      patch.auth_blocked_at = null;
      patch.auth_blocked_by = null;
      patch.auth_block_reason = null;
    }

    const { error: updateErr } = await admin
      .from("organization_members")
      .update(patch)
      .eq("organization_id", organization_id)
      .eq("user_id", user_id);
    if (updateErr) throw updateErr;

    return json({ ok: true, status, auth_blocked: authBlocked, auth_unblocked: authUnblocked });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});

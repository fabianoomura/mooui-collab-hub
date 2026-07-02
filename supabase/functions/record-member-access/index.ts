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

const clientIp = (req: Request) => {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || null;
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
    if (userErr || !userData.user) return json({ error: "Nao autenticado" }, 401);

    const userId = userData.user.id;
    const now = new Date().toISOString();
    const nowMs = Date.now();
    const ip = clientIp(req);
    const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: memberships, error: memberErr } = await admin
      .from("organization_members")
      .select("organization_id, status, invited_at, invite_accepted_at, first_seen_at, access_expires_at")
      .eq("user_id", userId)
      .in("status", ["active", "invited"]);
    if (memberErr) throw memberErr;

    let updated = 0;
    let firstAccess = 0;
    let acceptedInvites = 0;
    let skippedExpired = 0;

    for (const member of memberships || []) {
      const accessExpiry = member.access_expires_at ? new Date(member.access_expires_at).getTime() : null;
      if (accessExpiry && accessExpiry <= nowMs) {
        skippedExpired += 1;
        continue;
      }

      const isFirstAccess = !member.first_seen_at;
      const isInviteAcceptance = !!member.invited_at && !member.invite_accepted_at;
      const patch: Record<string, unknown> = {
        status: "active",
        last_seen_at: now,
        last_seen_ip: ip,
        last_seen_user_agent: userAgent,
      };
      if (isFirstAccess) patch.first_seen_at = now;
      if (isInviteAcceptance) patch.invite_accepted_at = now;

      const { error: updateErr } = await admin
        .from("organization_members")
        .update(patch)
        .eq("organization_id", member.organization_id)
        .eq("user_id", userId);
      if (updateErr) throw updateErr;
      updated += 1;

      if (isFirstAccess || isInviteAcceptance) {
        const action = isFirstAccess ? "first_access" : "accept_invite";
        const { error: auditErr } = await admin.from("permission_audit_log").insert({
          organization_id: member.organization_id,
          actor_id: userId,
          target_user_id: userId,
          entity_type: "organization_member",
          entity_id: `${member.organization_id}:${userId}`,
          action,
          before_state: {
            status: member.status,
            first_seen_at: member.first_seen_at,
            invite_accepted_at: member.invite_accepted_at,
          },
          after_state: {
            status: "active",
            first_seen_at: isFirstAccess ? now : member.first_seen_at,
            invite_accepted_at: isInviteAcceptance ? now : member.invite_accepted_at,
          },
          metadata: { source: "record-member-access", accepted_invite: isInviteAcceptance },
        });
        if (auditErr) console.warn("permission_audit_log insert failed", auditErr.message);
      }

      if (isFirstAccess) firstAccess += 1;
      if (isInviteAcceptance) acceptedInvites += 1;
    }

    return json({ ok: true, updated, first_access: firstAccess, accepted_invites: acceptedInvites, skipped_expired: skippedExpired });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});

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
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || "MOOUI <onboarding@resend.dev>";

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Nao autenticado" }, 401);
    const callerId = userData.user.id;

    const { organization_id, user_id, redirect_to } = await req.json() as {
      organization_id: string;
      user_id: string;
      redirect_to?: string;
    };

    if (!organization_id || !user_id) return json({ error: "Campos obrigatorios faltando" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: isAdminRes, error: roleErr } = await admin.rpc("is_org_admin", {
      _user_id: callerId,
      _org_id: organization_id,
    });
    if (roleErr || !isAdminRes) return json({ error: "Permissao negada" }, 403);

    const { data: member, error: memberErr } = await admin
      .from("organization_members")
      .select("user_id, status, invite_sent_count, invite_accepted_at")
      .eq("organization_id", organization_id)
      .eq("user_id", user_id)
      .maybeSingle();
    if (memberErr || !member) return json({ error: "Usuario nao pertence a organizacao" }, 404);
    if (member.status === "suspended") return json({ error: "Reative o usuario antes de reenviar convite" }, 400);
    if (member.invite_accepted_at) return json({ error: "Convite ja aceito por este usuario" }, 400);

    const [{ data: profile }, { data: org }, { data: authUser }] = await Promise.all([
      admin.from("profiles").select("full_name, email").eq("id", user_id).maybeSingle(),
      admin.from("organizations").select("name").eq("id", organization_id).maybeSingle(),
      admin.auth.admin.getUserById(user_id),
    ]);

    const email = profile?.email || authUser?.user?.email;
    if (!email) return json({ error: "Usuario sem email" }, 400);

    const redirectTo = redirect_to || (ALLOWED_ORIGIN === "*" ? undefined : `${ALLOWED_ORIGIN}/login`);
    const fullName = profile?.full_name || email;
    const orgName = org?.name || "MOOUI";
    const metadata = { full_name: fullName, organization_id };
    const linkOptions = redirectTo ? { redirectTo, data: metadata } : { data: metadata };

    let method = "supabase_invite";
    let emailSent = false;
    let actionLink: string | undefined;

    const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, linkOptions as any);

    if (inviteErr) {
      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: linkOptions,
      } as any);
      actionLink = linkData?.properties?.action_link;
      if (linkErr || !actionLink) return json({ error: linkErr?.message || inviteErr.message }, 400);
      method = RESEND_API_KEY ? "resend_magiclink" : "manual_magiclink";

      if (RESEND_API_KEY) {
        const html = `
          <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
            <h2 style="color:#b83280;margin:0 0 16px;">Convite MOOUI</h2>
            <p>Ola, ${escapeHtml(fullName)}.</p>
            <p>Voce foi convidado(a) para acessar a organizacao <strong>${escapeHtml(orgName)}</strong>.</p>
            <p>Clique no botao abaixo para acessar. O link expira em 7 dias.</p>
            <p style="margin:24px 0;">
              <a href="${actionLink}" style="background:#b83280;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;">
                Acessar plataforma
              </a>
            </p>
            <p style="color:#666;font-size:12px;">Se o botao nao funcionar, copie e cole no navegador:<br/>${actionLink}</p>
          </div>
        `.trim();

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: EMAIL_FROM,
            to: [email],
            subject: `Convite para acessar ${orgName}`,
            html,
          }),
        });

        emailSent = res.ok;
        if (!res.ok) {
          console.error("Resend error", res.status, await res.text());
          method = "manual_magiclink";
        }
      }
    } else {
      emailSent = true;
    }

    const now = new Date();
    const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const { error: updateErr } = await admin
      .from("organization_members")
      .update({
        invited_at: now.toISOString(),
        invite_last_sent_at: now.toISOString(),
        invite_expires_at: expires.toISOString(),
        invite_sent_count: (member.invite_sent_count ?? 0) + 1,
        invite_last_sent_by: callerId,
      })
      .eq("organization_id", organization_id)
      .eq("user_id", user_id);
    if (updateErr) throw updateErr;

    return json({
      ok: true,
      method,
      email_sent: emailSent,
      action_link: emailSent ? undefined : actionLink,
      invite_expires_at: expires.toISOString(),
    });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]!));
}

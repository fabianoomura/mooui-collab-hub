import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "MOOUI <onboarding@resend.dev>";

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

    const { user_id, organization_id, redirect_to } = await req.json() as {
      user_id: string; organization_id: string; redirect_to?: string;
    };
    if (!user_id || !organization_id) return json({ error: "Campos obrigatórios faltando" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: isAdminRes } = await admin.rpc("is_org_admin", {
      _user_id: callerId, _org_id: organization_id,
    });
    if (!isAdminRes) return json({ error: "Permissão negada" }, 403);

    // Fetch target
    const { data: targetAuth } = await admin.auth.admin.getUserById(user_id);
    const targetEmail = targetAuth?.user?.email;
    if (!targetEmail) return json({ error: "Usuário sem email" }, 404);

    const { data: org } = await admin
      .from("organizations")
      .select("name")
      .eq("id", organization_id)
      .maybeSingle();

    // Generate magic link
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: targetEmail,
      options: { redirectTo: redirect_to },
    });
    if (linkErr) return json({ error: linkErr.message }, 400);

    const actionLink = linkData?.properties?.action_link;

    // Update invite tracking
    const { data: current } = await admin
      .from("organization_members")
      .select("invite_sent_count")
      .eq("user_id", user_id).eq("organization_id", organization_id).maybeSingle();
    const nextCount = (current?.invite_sent_count ?? 0) + 1;
    const expiresAt = new Date();
    expiresAt.setUTCDate(expiresAt.getUTCDate() + 7);

    await admin.from("organization_members").update({
      invite_last_sent_at: new Date().toISOString(),
      invite_last_sent_by: callerId,
      invite_sent_count: nextCount,
      invite_expires_at: expiresAt.toISOString(),
    }).eq("user_id", user_id).eq("organization_id", organization_id);

    // Send email via Resend (if configured)
    let emailSent = false;
    if (RESEND_API_KEY && actionLink) {
      const html = `
        <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
          <h2 style="color:#b83280;">Convite MOOUI</h2>
          <p>Você foi convidado(a) para acessar a organização <strong>${escapeHtml(org?.name ?? "MOOUI")}</strong>.</p>
          <p>Clique no botão abaixo para acessar. O link expira em 7 dias.</p>
          <p style="margin:24px 0;">
            <a href="${actionLink}" style="background:#b83280;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;">
              Acessar plataforma
            </a>
          </p>
          <p style="color:#666;font-size:12px;">Se o botão não funcionar, copie e cole no navegador: <br/>${actionLink}</p>
        </div>`;
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: [targetEmail],
          subject: `Seu convite para ${org?.name ?? "MOOUI"}`,
          html,
        }),
      });
      emailSent = res.ok;
      if (!res.ok) {
        const errText = await res.text();
        console.error("Resend error", res.status, errText);
      }
    }

    return json({
      ok: true,
      email_sent: emailSent,
      action_link: emailSent ? undefined : actionLink,
      invite_expires_at: expiresAt.toISOString(),
    });
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

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

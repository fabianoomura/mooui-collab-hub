import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || '*';
const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * send-email Edge Function
 *
 * Sends transactional email via Resend API (or any provider that takes
 * POST /emails with `{ from, to, subject, html }`).
 *
 * Required secrets:
 *   RESEND_API_KEY       — API key from resend.com
 *   EMAIL_FROM           — Verified sender, e.g. "MOOUI <noreply@mooui.com.br>"
 *
 * Body:
 *   { user_id, subject, body_html, notification_type?, organization_id }
 *
 * The function looks up the user's email from auth.users and respects
 * the email_preferences table before sending.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || 'MOOUI <noreply@mooui.com.br>';

    if (!RESEND_API_KEY) {
      return json({ error: 'Email not configured', hint: 'Set RESEND_API_KEY secret' }, 503);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const {
      user_id,
      subject,
      body_html,
      notification_type,
      organization_id,
    } = await req.json() as {
      user_id: string;
      subject: string;
      body_html: string;
      notification_type?: string;
      organization_id?: string;
    };

    if (!user_id || !subject || !body_html) {
      return json({ error: 'user_id, subject, and body_html are required' }, 400);
    }

    // Look up user email
    const { data: userData, error: userErr } = await admin.auth.admin.getUserById(user_id);
    if (userErr || !userData?.user?.email) {
      return json({ error: 'User not found or has no email' }, 404);
    }
    const toEmail = userData.user.email;

    // Check email preferences (if org context provided)
    if (organization_id && notification_type) {
      const { data: prefs } = await admin
        .from('email_preferences')
        .select('*')
        .eq('user_id', user_id)
        .eq('organization_id', organization_id)
        .maybeSingle();

      if (prefs) {
        const p = prefs as Record<string, unknown>;
        if (notification_type === 'assignment' && p.notify_on_assignment === false) {
          return json({ skipped: true, reason: 'user disabled assignment emails' });
        }
        if (notification_type === 'deadline' && p.notify_on_deadline === false) {
          return json({ skipped: true, reason: 'user disabled deadline emails' });
        }
        if (notification_type === 'mention' && p.notify_on_mention === false) {
          return json({ skipped: true, reason: 'user disabled mention emails' });
        }
      }
    }

    // Build HTML wrapper
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8f9fa; padding: 32px 16px;">
  <div style="max-width: 520px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
    <div style="text-align: center; margin-bottom: 24px;">
      <strong style="font-size: 18px; color: #111;">MOOUI</strong>
    </div>
    ${body_html}
    <hr style="border: none; border-top: 1px solid #e9ecef; margin: 24px 0;" />
    <p style="font-size: 12px; color: #868e96; text-align: center;">
      Você recebeu este email porque está cadastrado no MOOUI Collab Hub.<br/>
      Para ajustar suas preferências de email, acesse Configurações no app.
    </p>
  </div>
</body>
</html>`.trim();

    // Send via Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: EMAIL_FROM, to: [toEmail], subject, html }),
    });
    const resBody = await res.json();

    if (!res.ok) {
      return json({ error: 'Email send failed', detail: resBody }, res.status);
    }

    // If notify_directors is enabled, send copies to directors/admins
    if (organization_id) {
      const { data: prefs } = await admin
        .from('email_preferences')
        .select('notify_directors')
        .eq('user_id', user_id)
        .eq('organization_id', organization_id)
        .maybeSingle();

      if (prefs && (prefs as any).notify_directors) {
        // Find org admins + users with director/admin app_role
        const { data: adminMembers } = await admin
          .from('organization_members')
          .select('user_id')
          .eq('organization_id', organization_id)
          .eq('role', 'admin');

        const { data: directorRoles } = await admin
          .from('user_roles')
          .select('user_id')
          .in('role', ['admin', 'director']);

        const allIds = new Set<string>();
        adminMembers?.forEach((m: any) => allIds.add(m.user_id));
        directorRoles?.forEach((r: any) => allIds.add(r.user_id));
        allIds.delete(user_id); // exclude the original recipient

        const directorIds = [...allIds];

        if (directorIds.length) {
          for (const dirId of directorIds) {
            const { data: dirUser } = await admin.auth.admin.getUserById(dirId);
            if (dirUser?.user?.email) {
              await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${RESEND_API_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  from: EMAIL_FROM,
                  to: [dirUser.user.email],
                  subject: `[Cópia] ${subject}`,
                  html,
                }),
              });
            }
          }
        }
      }
    }

    return json({ ok: true, id: resBody.id });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

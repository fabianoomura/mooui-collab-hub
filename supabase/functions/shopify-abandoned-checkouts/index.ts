import { createClient } from 'npm:@supabase/supabase-js@2';

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Sincroniza checkouts abandonados do Shopify e cria deals no CRM (varejo).
//
// Modo manual (POST do app, autenticado):
//   { organization_id, pipeline_id, since_days? }
// Modo agendado (cron):
//   header: x-cron-secret: <CRON_SECRET>
//   body: { scheduled: true, since_days? }
//
// Secrets necessários: SHOPIFY_STORE_DOMAIN, SHOPIFY_ADMIN_ACCESS_TOKEN, CRON_SECRET (apenas para cron)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const domain = Deno.env.get('SHOPIFY_STORE_DOMAIN');
  const token = Deno.env.get('SHOPIFY_ADMIN_ACCESS_TOKEN');
  if (!domain || !token) {
    return json({
      error: 'Shopify não configurado',
      hint: 'Adicione os secrets SHOPIFY_STORE_DOMAIN e SHOPIFY_ADMIN_ACCESS_TOKEN',
    }, 503);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const cronSecret = Deno.env.get('CRON_SECRET');
  const admin = createClient(supabaseUrl, serviceKey);

  let body: any = {};
  try { body = await req.json(); } catch { /* cron pode mandar body vazio */ }
  const { organization_id, pipeline_id, since_days = 30, scheduled = false } = body ?? {};

  // ---- Modo agendado (cron)
  if (scheduled) {
    const headerSecret = req.headers.get('x-cron-secret');
    if (!cronSecret || headerSecret !== cronSecret) {
      return json({ error: 'cron secret inválido' }, 401);
    }
    const { data: pipes } = await admin.from('crm_pipelines')
      .select('id, organization_id').eq('kind', 'varejo');
    const totals = { fetched: 0, created: 0, skipped: 0, errors: 0, pipelines: 0 };
    for (const p of pipes ?? []) {
      const r = await syncOnePipeline(admin, domain, token, p.organization_id, p.id, since_days, null);
      totals.fetched += r.fetched; totals.created += r.created;
      totals.skipped += r.skipped; totals.errors += r.errors; totals.pipelines++;
    }
    return json({ ok: true, mode: 'scheduled', ...totals });
  }

  // ---- Modo manual (usuário do app)
  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: 'não autenticado' }, 401);
  const userId = userData.user.id;

  if (!organization_id || !pipeline_id) {
    return json({ error: 'organization_id e pipeline_id são obrigatórios' }, 400);
  }
  const { data: member } = await admin.from('organization_members')
    .select('id').eq('user_id', userId).eq('organization_id', organization_id).maybeSingle();
  if (!member) return json({ error: 'sem acesso à organização' }, 403);

  const { data: pipe } = await admin.from('crm_pipelines')
    .select('id, organization_id').eq('id', pipeline_id).maybeSingle();
  if (!pipe || pipe.organization_id !== organization_id) {
    return json({ error: 'pipeline inválido' }, 400);
  }

  const result = await syncOnePipeline(admin, domain, token, organization_id, pipeline_id, since_days, userId);
  return json({ ok: true, ...result });
});

async function syncOnePipeline(
  admin: any, domain: string, token: string,
  organization_id: string, pipeline_id: string, since_days: number, userId: string | null,
) {
  let { data: stage } = await admin.from('crm_stages')
    .select('id').eq('pipeline_id', pipeline_id).ilike('name', 'carrinho abandonado').maybeSingle();
  if (!stage) {
    const { data: created } = await admin.from('crm_stages').insert({
      pipeline_id, name: 'Carrinho Abandonado', position: 0, color: '#F59E0B',
    }).select('id').single();
    stage = created;
  }

  const sinceIso = new Date(Date.now() - since_days * 86400000).toISOString();
  const url = `https://${domain}/admin/api/2024-10/checkouts.json?status=open&updated_at_min=${encodeURIComponent(sinceIso)}&limit=250`;
  const r = await fetch(url, {
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
  });
  if (!r.ok) {
    const errText = await r.text();
    console.error('shopify error', r.status, errText);
    return { fetched: 0, created: 0, skipped: 0, errors: 1 };
  }
  const { checkouts = [] } = await r.json();

  // Fallback de created_by quando rodando via cron
  let creatorId = userId;
  if (!creatorId) {
    const { data: anyDeal } = await admin.from('crm_deals')
      .select('created_by').eq('organization_id', organization_id).limit(1).maybeSingle();
    creatorId = anyDeal?.created_by ?? null;
    if (!creatorId) {
      const { data: anyMember } = await admin.from('organization_members')
        .select('user_id').eq('organization_id', organization_id).limit(1).maybeSingle();
      creatorId = anyMember?.user_id ?? null;
    }
    if (!creatorId) return { fetched: checkouts.length, created: 0, skipped: 0, errors: 1 };
  }

  let created = 0, skipped = 0, errors = 0;
  for (const c of checkouts) {
    try {
      if (c.completed_at) { skipped++; continue; }
      const tokenStr = String(c.token ?? c.id ?? '');
      if (!tokenStr) { skipped++; continue; }

      const valueCents = Math.round(parseFloat(c.total_price ?? '0') * 100);
      const customerEmail = c.email ?? c.customer?.email ?? null;
      const customerName = [c.customer?.first_name, c.customer?.last_name].filter(Boolean).join(' ').trim()
        || customerEmail || 'Cliente sem nome';

      const { data: existing } = await admin.from('crm_deals').select('id')
        .eq('organization_id', organization_id)
        .eq('shopify_checkout_token', tokenStr).maybeSingle();
      if (existing) { skipped++; continue; }

      const { error: insErr } = await admin.from('crm_deals').insert({
        organization_id, pipeline_id, stage_id: stage!.id,
        title: `Carrinho • ${customerName}`,
        value_cents: valueCents,
        currency: c.currency ?? 'BRL',
        notes: customerEmail ? `E-mail: ${customerEmail}` : null,
        status: 'open', position: 0,
        created_by: creatorId,
        shopify_checkout_token: tokenStr,
        shopify_checkout_url: c.abandoned_checkout_url ?? null,
        shopify_customer_email: customerEmail,
        abandoned_at: c.updated_at ?? c.created_at ?? new Date().toISOString(),
      });
      if (insErr) { errors++; console.error('insert deal', insErr); continue; }
      created++;
    } catch (e) { errors++; console.error('loop error', e); }
  }
  return { fetched: checkouts.length, created, skipped, errors };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

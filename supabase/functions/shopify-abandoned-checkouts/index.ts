import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Sincroniza checkouts abandonados do Shopify e cria/atualiza deals no CRM (varejo).
//
// Body (POST):
//   { organization_id: string, pipeline_id: string, since_days?: number }
//
// Requer secrets: SHOPIFY_STORE_DOMAIN, SHOPIFY_ADMIN_ACCESS_TOKEN
// Usuário deve estar autenticado e ser membro da organização.

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return json({ error: 'method not allowed' }, 405);
  }

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

  // Auth: identifica o usuário a partir do JWT
  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return json({ error: 'não autenticado' }, 401);
  }
  const userId = userData.user.id;

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'json inválido' }, 400); }
  const { organization_id, pipeline_id, since_days = 30 } = body ?? {};
  if (!organization_id || !pipeline_id) {
    return json({ error: 'organization_id e pipeline_id são obrigatórios' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey);

  // Confirma que o usuário pertence à org e que o pipeline é dela
  const { data: member } = await admin.from('organization_members')
    .select('id').eq('user_id', userId).eq('organization_id', organization_id).maybeSingle();
  if (!member) return json({ error: 'sem acesso à organização' }, 403);

  const { data: pipe } = await admin.from('crm_pipelines')
    .select('id, organization_id').eq('id', pipeline_id).maybeSingle();
  if (!pipe || pipe.organization_id !== organization_id) {
    return json({ error: 'pipeline inválido' }, 400);
  }

  // Estágio "Carrinho Abandonado" (cria se não existir)
  let { data: stage } = await admin.from('crm_stages')
    .select('id').eq('pipeline_id', pipeline_id).ilike('name', 'carrinho abandonado').maybeSingle();
  if (!stage) {
    const { data: created, error: stErr } = await admin.from('crm_stages').insert({
      pipeline_id, name: 'Carrinho Abandonado', position: 0, color: '#F59E0B',
    }).select('id').single();
    if (stErr) return json({ error: 'falha ao criar estágio', detail: stErr.message }, 500);
    stage = created;
  }

  // Busca checkouts abandonados no Shopify
  const sinceIso = new Date(Date.now() - since_days * 86400000).toISOString();
  const url = `https://${domain}/admin/api/2024-10/checkouts.json?status=open&updated_at_min=${encodeURIComponent(sinceIso)}&limit=250`;
  const r = await fetch(url, {
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
  });
  if (!r.ok) {
    const text = await r.text();
    return json({ error: 'shopify falhou', status: r.status, detail: text }, 502);
  }
  const { checkouts = [] } = await r.json();

  let created = 0, skipped = 0, errors = 0;
  for (const c of checkouts) {
    try {
      // Considera abandonado se completed_at for null
      if (c.completed_at) { skipped++; continue; }

      const tokenStr = String(c.token ?? c.id ?? '');
      if (!tokenStr) { skipped++; continue; }

      const valueCents = Math.round(parseFloat(c.total_price ?? '0') * 100);
      const customerEmail = c.email ?? c.customer?.email ?? null;
      const customerName = [c.customer?.first_name, c.customer?.last_name].filter(Boolean).join(' ').trim()
        || customerEmail || 'Cliente sem nome';
      const recoveryUrl = c.abandoned_checkout_url ?? null;

      // Upsert por (organization_id, shopify_checkout_token)
      const { data: existing } = await admin.from('crm_deals').select('id')
        .eq('organization_id', organization_id)
        .eq('shopify_checkout_token', tokenStr).maybeSingle();

      if (existing) { skipped++; continue; }

      const { error: insErr } = await admin.from('crm_deals').insert({
        organization_id,
        pipeline_id,
        stage_id: stage!.id,
        title: `Carrinho • ${customerName}`,
        value_cents: valueCents,
        currency: c.currency ?? 'BRL',
        notes: customerEmail ? `E-mail: ${customerEmail}` : null,
        status: 'open',
        position: 0,
        created_by: userId,
        shopify_checkout_token: tokenStr,
        shopify_checkout_url: recoveryUrl,
        shopify_customer_email: customerEmail,
        abandoned_at: c.updated_at ?? c.created_at ?? new Date().toISOString(),
      });
      if (insErr) { errors++; console.error('insert deal', insErr); continue; }
      created++;
    } catch (e) {
      errors++;
      console.error('checkout loop error', e);
    }
  }

  return json({ ok: true, fetched: checkouts.length, created, skipped, errors });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

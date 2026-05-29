import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || '*';
const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Edge function for Shopify Plus integration.
// Requires secrets: SHOPIFY_STORE_DOMAIN (e.g. mystore.myshopify.com) and SHOPIFY_ADMIN_ACCESS_TOKEN.
// Operations:
//   GET   ?id=12345&organization_id=...  -> fetch draft order
//   POST  { organization_id, line_items: [...], note?, customer? } -> create draft order

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  // ── Authentication ──
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const ANON = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')!;
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return json({ error: 'Não autenticado' }, 401);
  }
  const callerId = userData.user.id;

  // ── Shopify config ──
  const domain = Deno.env.get('SHOPIFY_STORE_DOMAIN');
  const token = Deno.env.get('SHOPIFY_ADMIN_ACCESS_TOKEN');
  if (!domain || !token) {
    return json({
      error: 'Shopify not configured',
      hint: 'Add SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_ACCESS_TOKEN secrets',
    }, 503);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const baseUrl = `https://${domain}/admin/api/2024-10`;
  const headers = { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' };

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const id = url.searchParams.get('id');
      const orgId = url.searchParams.get('organization_id');
      if (!id) return json({ error: 'id required' }, 400);
      if (!orgId) return json({ error: 'organization_id required' }, 400);

      // Verify org membership
      const { data: isMember } = await admin.rpc('is_org_member', {
        _user_id: callerId, _org_id: orgId,
      });
      if (!isMember) return json({ error: 'Sem acesso à organização' }, 403);

      const r = await fetch(`${baseUrl}/draft_orders/${id}.json`, { headers });
      const data = await r.json();
      return json(data, r.status);
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const { organization_id, ...shopifyPayload } = body;
      if (!organization_id) return json({ error: 'organization_id required' }, 400);

      // Verify org membership
      const { data: isMember } = await admin.rpc('is_org_member', {
        _user_id: callerId, _org_id: organization_id,
      });
      if (!isMember) return json({ error: 'Sem acesso à organização' }, 403);

      const r = await fetch(`${baseUrl}/draft_orders.json`, {
        method: 'POST', headers, body: JSON.stringify({ draft_order: shopifyPayload }),
      });
      const data = await r.json();
      return json(data, r.status);
    }

    return json({ error: 'method not allowed' }, 405);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

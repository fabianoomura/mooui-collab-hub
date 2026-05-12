import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

// Edge function for Shopify Plus integration.
// Requires secrets: SHOPIFY_STORE_DOMAIN (e.g. mystore.myshopify.com) and SHOPIFY_ADMIN_ACCESS_TOKEN.
// Operations:
//   GET   ?id=12345          -> fetch draft order
//   POST  { line_items: [...], note?, customer? } -> create draft order

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const domain = Deno.env.get('SHOPIFY_STORE_DOMAIN');
  const token = Deno.env.get('SHOPIFY_ADMIN_ACCESS_TOKEN');
  if (!domain || !token) {
    return new Response(JSON.stringify({
      error: 'Shopify not configured',
      hint: 'Add SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_ACCESS_TOKEN secrets',
    }), { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const baseUrl = `https://${domain}/admin/api/2024-10`;
  const headers = { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' };

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const id = url.searchParams.get('id');
      if (!id) return new Response(JSON.stringify({ error: 'id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
      const r = await fetch(`${baseUrl}/draft_orders/${id}.json`, { headers });
      const data = await r.json();
      return new Response(JSON.stringify(data), {
        status: r.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const r = await fetch(`${baseUrl}/draft_orders.json`, {
        method: 'POST', headers, body: JSON.stringify({ draft_order: body }),
      });
      const data = await r.json();
      return new Response(JSON.stringify(data), {
        status: r.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

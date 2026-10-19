// =====================================================================
//  Netlify Function: meta-leads
//  Webhook do Meta (Facebook/Instagram) Lead Ads. Multi-tenant:
//   - GET  = verificação do webhook (hub.challenge) usando o meta_verify_token da empresa.
//   - POST = evento leadgen → busca os dados do lead na Graph API (com o
//            Page Access Token da empresa, achada pelo page_id) e insere em `leads`
//            com origem = 'meta_ads'.
//
//  Env vars (já existentes):
//    SUPABASE_URL          = https://xuzcczbdbgihkurcbepw.supabase.co
//    SUPABASE_SERVICE_KEY  = (sb_secret_...)
//
//  Credenciais por empresa ficam em integracoes:
//    meta_page_id, meta_access_token, meta_verify_token, meta_app_secret (opcional)
// =====================================================================

exports.handler = async (event) => {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const sbHeaders = { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json' };
  const rest = (p) => SUPABASE_URL + '/rest/v1/' + p;

  // ---- GET: verificação do webhook ----
  if (event.httpMethod === 'GET') {
    const q = event.queryStringParameters || {};
    const mode = q['hub.mode'];
    const token = q['hub.verify_token'];
    const challenge = q['hub.challenge'];
    if (mode === 'subscribe' && token) {
      try {
        const r = await fetch(rest('integracoes?meta_verify_token=eq.' + encodeURIComponent(token) + '&select=empresa_id'), { headers: sbHeaders });
        const rows = await r.json();
        if (Array.isArray(rows) && rows.length) {
          return { statusCode: 200, headers: { 'Content-Type': 'text/plain' }, body: String(challenge || '') };
        }
      } catch (e) {}
    }
    return { statusCode: 403, body: 'Forbidden' };
  }

  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  if (!SUPABASE_URL || !SERVICE_KEY) return { statusCode: 200, body: 'ok' }; // responde 200 p/ o Meta não re-tentar

  try {
    const body = JSON.parse(event.body || '{}');
    const entries = body.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const ch of changes) {
        if (ch.field !== 'leadgen') continue;
        const v = ch.value || {};
        const leadgen_id = v.leadgen_id;
        const page_id = String(v.page_id || entry.id || '');
        const form_id = v.form_id || '';
        if (!leadgen_id || !page_id) continue;

        // acha a empresa dona da página
        const ri = await fetch(rest('integracoes?meta_page_id=eq.' + encodeURIComponent(page_id) + '&select=empresa_id,meta_access_token'), { headers: sbHeaders });
        const cfg = (await ri.json())[0];
        if (!cfg || !cfg.meta_access_token) continue;

        // busca os dados do lead na Graph API
        const g = await fetch('https://graph.facebook.com/v21.0/' + encodeURIComponent(leadgen_id) + '?access_token=' + encodeURIComponent(cfg.meta_access_token));
        const lead = await g.json();
        if (!g.ok || !lead.field_data) continue;

        const campo = (names) => {
          for (const f of lead.field_data) {
            const n = (f.name || '').toLowerCase();
            if (names.some(x => n.includes(x))) return (f.values && f.values[0]) || '';
          }
          return '';
        };
        const nome = campo(['full_name', 'nome', 'name']) || campo(['first_name']);
        const email = campo(['email', 'e-mail']);
        const telefone = campo(['phone', 'telefone', 'celular', 'whatsapp']);
        const empresa = campo(['company', 'empresa', 'razao']);

        const row = {
          empresa_id: cfg.empresa_id,
          nome: (nome || empresa || 'Lead Meta ADS'),
          email: email || null,
          telefone: telefone || null,
          origem: 'meta_ads',
          etapa: 'novo',
          observacao: 'Lead via Meta ADS' + (form_id ? (' (form ' + form_id + ')') : '') + (empresa ? (' · Empresa: ' + empresa) : '')
        };
        await fetch(rest('leads'), { method: 'POST', headers: { ...sbHeaders, Prefer: 'return=minimal' }, body: JSON.stringify(row) });
      }
    }
    return { statusCode: 200, body: 'ok' };
  } catch (e) {
    // sempre 200 para o Meta não reenviar em loop; erro fica no log do Netlify
    return { statusCode: 200, body: 'ok' };
  }
};

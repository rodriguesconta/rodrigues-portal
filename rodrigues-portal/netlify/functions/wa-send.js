// =====================================================================
//  Netlify Function: wa-send
//  Envia mensagem de TEMPLATE do WhatsApp (Cloud API) lendo as
//  credenciais DA EMPRESA na tabela `integracoes` (Caminho B / multi-tenant).
//
//  Variáveis de ambiente necessárias (Netlify → Environment variables):
//    SUPABASE_URL          = https://xuzcczbdbgihkurcbepw.supabase.co
//    SUPABASE_SERVICE_KEY  = (chave SECRETA do Supabase — sb_secret_...)  [lê integracoes, bypassa RLS]
//    SUPABASE_ANON_KEY     = (chave PUBLICÁVEL do Supabase — sb_publishable_...)  [valida o login]
//
//  Body (POST, JSON):
//    {
//      "empresa_id": "uuid-da-contabilidade",
//      "to": "5524999667693",              // telefone (com ou sem 55)
//      "template": "documento_enviado",
//      "lang": "pt_BR",
//      "body_params": ["Nome", "DAS MEI", "09/2026"],   // variáveis do corpo, na ordem
//      "header_document": { "link": "https://.../arquivo.pdf", "filename": "DAS MEI - 09-2026.pdf" } // opcional
//    }
//
//  Header obrigatório:  Authorization: Bearer <access_token do usuário logado no portal>
// =====================================================================

exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: 'OK' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: 'Method not allowed' };

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const ANON_KEY = process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ erro: 'Env vars do Supabase não configuradas (SUPABASE_URL / SUPABASE_SERVICE_KEY / SUPABASE_ANON_KEY).' }) };
  }

  try {
    // 1) Autenticação — exige um usuário logado no portal (token da sessão)
    const authHeader = event.headers['authorization'] || event.headers['Authorization'] || '';
    const userToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!userToken) return { statusCode: 401, headers: cors, body: JSON.stringify({ erro: 'não autenticado' }) };
    const au = await fetch(SUPABASE_URL + '/auth/v1/user', { headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + userToken } });
    if (!au.ok) return { statusCode: 401, headers: cors, body: JSON.stringify({ erro: 'sessão inválida' }) };

    // 2) Entrada
    const b = JSON.parse(event.body || '{}');
    const { empresa_id, to, template, lang, body_params, header_document } = b;
    if (!empresa_id) return { statusCode: 400, headers: cors, body: JSON.stringify({ erro: 'empresa_id obrigatório' }) };
    if (!to) return { statusCode: 400, headers: cors, body: JSON.stringify({ erro: 'destinatário (to) obrigatório' }) };
    if (!template) return { statusCode: 400, headers: cors, body: JSON.stringify({ erro: 'template obrigatório' }) };

    // 3) Credenciais da empresa (service key — bypassa RLS)
    const q = SUPABASE_URL + '/rest/v1/integracoes?empresa_id=eq.' + encodeURIComponent(empresa_id) + '&select=wa_phone_number_id,wa_token';
    const r = await fetch(q, { headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY } });
    const rows = await r.json();
    const cfg = Array.isArray(rows) ? rows[0] : null;
    if (!cfg || !cfg.wa_phone_number_id || !cfg.wa_token) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ erro: 'Integração WhatsApp não configurada para esta empresa.' }) };
    }

    // 4) Telefone (55 + dígitos, sem duplicar o 55)
    let tel = String(to).replace(/\D/g, '');
    if (!tel.startsWith('55')) tel = '55' + tel;

    // 5) Componentes do template
    const components = [];
    if (header_document && header_document.link) {
      components.push({ type: 'header', parameters: [{ type: 'document', document: { link: header_document.link, filename: header_document.filename || 'documento.pdf' } }] });
    }
    if (Array.isArray(body_params) && body_params.length) {
      components.push({ type: 'body', parameters: body_params.map(t => ({ type: 'text', text: String(t == null ? '' : t) })) });
    }

    const payload = {
      messaging_product: 'whatsapp',
      to: tel,
      type: 'template',
      template: { name: template, language: { code: lang || 'pt_BR' }, components }
    };

    // 6) Graph API (credencial da empresa)
    const g = await fetch('https://graph.facebook.com/v21.0/' + cfg.wa_phone_number_id + '/messages', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + cfg.wa_token, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await g.json();
    if (!g.ok) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ erro: (data.error && data.error.message) || JSON.stringify(data), meta: data }) };
    }
    return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true, id: (data.messages && data.messages[0] && data.messages[0].id) || null }) };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ erro: e.message }) };
  }
};

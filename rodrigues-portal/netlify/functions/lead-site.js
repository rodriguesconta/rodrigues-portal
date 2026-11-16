// =====================================================================
//  Netlify Function: lead-site
//  Recebe o formulário "Diagnóstico gratuito" do SITE (home e páginas de
//  nicho) e grava na tabela `leads` do portal (origem = 'site'), usando a
//  SERVICE_KEY. Público — não exige login. O lead aparece no portal em
//  Comercial → CRM / Leads, na etapa "novo".
//
//  Env vars (as mesmas que já existem no Netlify):
//    SUPABASE_URL          = https://xuzcczbdbgihkurcbepw.supabase.co
//    SUPABASE_SERVICE_KEY  = (sb_secret_...)
//    SITE_EMPRESA_ID       = (opcional) uuid da contabilidade dona do site.
//                            Se não existir, usa o da Rodrigues.
//
//  Body (POST JSON):
//    { nome, telefone, email, perfil, contador, mensagem, nicho, pagina, website(honeypot) }
// =====================================================================

const EMPRESA_PADRAO = 'b01804f2-30ad-4108-80ea-74044f95cca6'; // Rodrigues

exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: 'OK' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: 'Method not allowed' };

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ erro: 'Env vars do Supabase não configuradas.' }) };
  }

  try {
    const b = JSON.parse(event.body || '{}');

    // Honeypot anti-robô: campo escondido preenchido = bot. Responde OK e não grava.
    if (b.website) return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true }) };

    const cut = (s, n) => (s == null ? '' : String(s).trim().slice(0, n));
    const nome = cut(b.nome, 120);
    const tel = cut(b.telefone, 30).replace(/\D/g, '');
    if (!nome || tel.length < 10) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ erro: 'Informe nome e WhatsApp com DDD.' }) };
    }
    const email = cut(b.email, 160);
    const nicho = cut(b.nicho || b.perfil, 60);
    const contador = cut(b.contador, 60);
    const mensagem = cut(b.mensagem, 1200);
    const pagina = cut(b.pagina, 80);

    const obs = ['[Site' + (nicho ? ' · ' + nicho : '') + ']', contador ? contador + '.' : '', mensagem, pagina ? '(página ' + pagina + ')' : '']
      .filter(Boolean).join(' ');

    const row = {
      empresa_id: process.env.SITE_EMPRESA_ID || EMPRESA_PADRAO,
      nome,
      telefone: tel,
      email: email || null,
      origem: 'site',
      etapa: 'novo',
      observacao: obs
    };

    const r = await fetch(SUPABASE_URL + '/rest/v1/leads', {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(row)
    });
    if (!r.ok) {
      const t = await r.text();
      return { statusCode: 500, headers: cors, body: JSON.stringify({ erro: 'Falha ao gravar o lead.', detalhe: t.slice(0, 300) }) };
    }
    return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ erro: e.message }) };
  }
};

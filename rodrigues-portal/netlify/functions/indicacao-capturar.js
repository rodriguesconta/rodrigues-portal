// =====================================================================
//  Netlify Function: indicacao-capturar
//  Recebe uma indicação da PÁGINA PÚBLICA (indicar.html) e grava na
//  tabela `indicacoes` usando a SERVICE_KEY (bypassa RLS). Público —
//  não exige login (é o cliente/parceiro externo quem preenche).
//
//  Env vars (já configuradas no Netlify):
//    SUPABASE_URL          = https://xuzcczbdbgihkurcbepw.supabase.co
//    SUPABASE_SERVICE_KEY  = (sb_secret_...)
//
//  Body (POST JSON):
//    {
//      "empresa_id": "uuid-da-contabilidade",
//      "indicador_nome": "...", "indicador_contato": "...", "indicador_tipo": "cliente|parceiro",
//      "indicado_nome": "...",  "indicado_contato": "...",
//      "observacao": "...",
//      "hp": ""   // honeypot anti-spam: se vier preenchido, ignora
//    }
// =====================================================================

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

    // Honeypot: bots preenchem campos ocultos. Responde OK mas não grava.
    if (b.hp) return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true }) };

    const empresa_id = b.empresa_id;
    const indicador_nome = (b.indicador_nome || '').trim();
    const indicado_nome = (b.indicado_nome || '').trim();
    if (!empresa_id) return { statusCode: 400, headers: cors, body: JSON.stringify({ erro: 'empresa_id ausente no link.' }) };
    if (!indicador_nome || !indicado_nome) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ erro: 'Preencha seu nome e o nome de quem está indicando.' }) };
    }

    // Confere se a empresa existe (evita lixo apontando p/ ids inexistentes)
    const ce = await fetch(SUPABASE_URL + '/rest/v1/empresas?id=eq.' + encodeURIComponent(empresa_id) + '&select=id', {
      headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY }
    });
    const emp = await ce.json();
    if (!Array.isArray(emp) || !emp.length) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ erro: 'Contabilidade não encontrada.' }) };
    }

    const limit = s => (s == null ? null : String(s).slice(0, 300));
    const row = {
      empresa_id,
      indicador_nome: limit(indicador_nome),
      indicador_contato: limit(b.indicador_contato),
      indicador_tipo: (b.indicador_tipo === 'parceiro' ? 'parceiro' : 'cliente'),
      indicado_nome: limit(indicado_nome),
      indicado_contato: limit(b.indicado_contato),
      observacao: limit(b.observacao),
      status: 'recebida',
      origem: 'link_externo',
      comissao_percent: 10
    };

    const r = await fetch(SUPABASE_URL + '/rest/v1/indicacoes', {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: 'Bearer ' + SERVICE_KEY,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(row)
    });
    if (!r.ok) {
      const t = await r.text();
      return { statusCode: 400, headers: cors, body: JSON.stringify({ erro: 'Falha ao gravar: ' + t }) };
    }
    return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ erro: e.message }) };
  }
};

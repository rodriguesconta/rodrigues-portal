// =====================================================================
//  Netlify Function: email-campanha
//  Dispara uma campanha de e-mail (tabela email_campanhas) para a lista
//  de contatos (email_contatos) usando o provedor RESEND, com a chave
//  da empresa (tabela integracoes). Caminho B / multi-tenant.
//
//  Env vars (já existentes):
//    SUPABASE_URL          = https://xuzcczbdbgihkurcbepw.supabase.co
//    SUPABASE_SERVICE_KEY  = (sb_secret_...)  [lê integracoes/campanhas, bypassa RLS]
//    SUPABASE_ANON_KEY     = (sb_publishable_...)  [valida o login]
//
//  A chave do Resend + remetente vêm da tabela integracoes da empresa:
//    email_provider_key  = Resend API key (re_...)
//    email_remetente     = ex.: documentos@rodriguesconta.com.br (domínio verificado no Resend)
//    email_reply         = ex.: contato@rodriguesconta.com.br
//
//  Body (POST JSON): { "empresa_id": "...", "campanha_id": "..." }
//  Header: Authorization: Bearer <access_token do usuário logado>
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
    return { statusCode: 500, headers: cors, body: JSON.stringify({ erro: 'Env vars do Supabase não configuradas.' }) };
  }

  const sb = (path) => SUPABASE_URL + '/rest/v1/' + path;
  const sbHeaders = { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json' };

  try {
    // 1) Autenticação (usuário logado no portal)
    const authHeader = event.headers['authorization'] || event.headers['Authorization'] || '';
    const userToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!userToken) return { statusCode: 401, headers: cors, body: JSON.stringify({ erro: 'não autenticado' }) };
    const au = await fetch(SUPABASE_URL + '/auth/v1/user', { headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + userToken } });
    if (!au.ok) return { statusCode: 401, headers: cors, body: JSON.stringify({ erro: 'sessão inválida' }) };

    // 2) Entrada
    const b = JSON.parse(event.body || '{}');
    const { empresa_id, campanha_id } = b;
    if (!empresa_id || !campanha_id) return { statusCode: 400, headers: cors, body: JSON.stringify({ erro: 'empresa_id e campanha_id obrigatórios' }) };

    // 3) Credenciais do e-mail (Resend) da empresa
    const ri = await fetch(sb('integracoes?empresa_id=eq.' + encodeURIComponent(empresa_id) + '&select=email_provider_key,email_remetente,email_reply'), { headers: sbHeaders });
    const cfg = (await ri.json())[0] || {};
    const RESEND_KEY = (cfg.email_provider_key || '').trim();
    const FROM_EMAIL = (cfg.email_remetente || '').trim();
    if (!RESEND_KEY) return { statusCode: 400, headers: cors, body: JSON.stringify({ erro: 'Motor de e-mail (Resend) não configurado. Adicione a chave em Integrações.' }) };
    if (!FROM_EMAIL) return { statusCode: 400, headers: cors, body: JSON.stringify({ erro: 'E-mail remetente não configurado em Integrações.' }) };

    // 4) Campanha
    const rc = await fetch(sb('email_campanhas?id=eq.' + encodeURIComponent(campanha_id) + '&empresa_id=eq.' + encodeURIComponent(empresa_id) + '&select=*'), { headers: sbHeaders });
    const camp = (await rc.json())[0];
    if (!camp) return { statusCode: 404, headers: cors, body: JSON.stringify({ erro: 'Campanha não encontrada.' }) };

    // 5) Destinatários (ativos, da lista escolhida)
    let q = 'email_contatos?empresa_id=eq.' + encodeURIComponent(empresa_id) + '&status=eq.ativo&select=nome,email,empresa_nome';
    if (camp.lista_alvo && camp.lista_alvo !== 'todos') q += '&lista=eq.' + encodeURIComponent(camp.lista_alvo);
    const rd = await fetch(sb(q), { headers: sbHeaders });
    const dests = (await rd.json()).filter(c => c.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email));
    if (!dests.length) return { statusCode: 400, headers: cors, body: JSON.stringify({ erro: 'Nenhum destinatário ativo nesta lista.' }) };

    // marca como enviando
    await fetch(sb('email_campanhas?id=eq.' + encodeURIComponent(campanha_id)), { method: 'PATCH', headers: sbHeaders, body: JSON.stringify({ status: 'enviando' }) });

    const fromName = (camp.remetente_nome || 'Rodrigues Assessoria').replace(/[<>"]/g, '');
    const fromHeader = fromName + ' <' + FROM_EMAIL + '>';
    const replyTo = (cfg.email_reply || '').trim() || undefined;
    const subject = camp.assunto || '(sem assunto)';
    const bodyTpl = camp.corpo_html || '';

    const personalize = (c) => bodyTpl
      .replace(/{{\s*nome\s*}}/gi, c.nome || 'cliente')
      .replace(/{{\s*empresa\s*}}/gi, c.empresa_nome || 'sua empresa');

    // 6) Envio em lotes de 100 via Resend /emails/batch
    let enviados = 0;
    for (let i = 0; i < dests.length; i += 100) {
      const lote = dests.slice(i, i + 100).map(c => {
        const html = personalize(c);
        const obj = { from: fromHeader, to: [c.email], subject: subject, html: html };
        if (replyTo) obj.reply_to = replyTo;
        return obj;
      });
      const rr = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(lote)
      });
      if (rr.ok) {
        enviados += lote.length;
      } else {
        const t = await rr.text();
        // marca o que já saiu e retorna o erro do lote
        await fetch(sb('email_campanhas?id=eq.' + encodeURIComponent(campanha_id)), { method: 'PATCH', headers: sbHeaders, body: JSON.stringify({ status: 'enviada', enviados, enviada_em: new Date().toISOString() }) });
        return { statusCode: 400, headers: cors, body: JSON.stringify({ erro: 'Resend recusou um lote: ' + t, enviados }) };
      }
    }

    // 7) Conclui
    await fetch(sb('email_campanhas?id=eq.' + encodeURIComponent(campanha_id)), { method: 'PATCH', headers: sbHeaders, body: JSON.stringify({ status: 'enviada', enviados, enviada_em: new Date().toISOString() }) });
    return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true, enviados }) };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ erro: e.message }) };
  }
};

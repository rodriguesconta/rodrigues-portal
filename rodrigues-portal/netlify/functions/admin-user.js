// netlify/functions/admin-user.js
// Operações administrativas no Supabase Auth (alterar senha, bloquear/desbloquear).
// SEGURANÇA: exige sessão válida de um usuário com role='admin' na tabela usuarios.
// A chave service_role vem da variável de ambiente SUPABASE_SERVICE_ROLE_KEY (Netlify).
exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: 'OK' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'Method not allowed' }) };

  const SURL = 'https://xuzcczbdbgihkurcbepw.supabase.co';
  const ANON = 'sb_publishable_7xC7UlKxPMdivffyuXPN2Q_rOjh6O8o';
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SERVICE) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no Netlify' }) };
  }

  try {
    // 1) Valida a sessão de quem chamou
    const token = (event.headers.authorization || event.headers.Authorization || '').replace('Bearer ', '');
    if (!token) return { statusCode: 401, headers: cors, body: JSON.stringify({ error: 'Sessão ausente' }) };

    const uRes = await fetch(SURL + '/auth/v1/user', { headers: { apikey: ANON, Authorization: 'Bearer ' + token } });
    if (!uRes.ok) return { statusCode: 401, headers: cors, body: JSON.stringify({ error: 'Sessão inválida ou expirada' }) };
    const caller = await uRes.json();

    // 2) Quem chamou precisa ser admin
    const aRes = await fetch(SURL + '/rest/v1/usuarios?email=eq.' + encodeURIComponent(caller.email) + '&select=role', {
      headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE }
    });
    const aData = await aRes.json();
    if (!Array.isArray(aData) || !aData.length || aData[0].role !== 'admin') {
      return { statusCode: 403, headers: cors, body: JSON.stringify({ error: 'Apenas administradores podem executar esta ação' }) };
    }

    const { action, email, password } = JSON.parse(event.body || '{}');
    if (!action || !email) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'action e email são obrigatórios' }) };

    // 3) Proteção: o alvo não pode ser uma conta de administrador
    const tRes = await fetch(SURL + '/rest/v1/usuarios?email=eq.' + encodeURIComponent(email) + '&select=role', {
      headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE }
    });
    const tData = await tRes.json();
    if (Array.isArray(tData) && tData.length && tData[0].role === 'admin') {
      return { statusCode: 403, headers: cors, body: JSON.stringify({ error: 'Não é permitido alterar contas de administrador' }) };
    }

    // 4) Localiza o usuário no Auth
    const lRes = await fetch(SURL + '/auth/v1/admin/users?page=1&per_page=1000', {
      headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE }
    });
    const lData = await lRes.json();
    const users = lData.users || [];
    const alvo = users.find(u => (u.email || '').toLowerCase() === email.toLowerCase());

    // 5) Ação DELETE: apaga login (se existir) + perfil + vínculos de clientes
    if (action === 'delete') {
      if (alvo) {
        const dRes = await fetch(SURL + '/auth/v1/admin/users/' + alvo.id, {
          method: 'DELETE',
          headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE }
        });
        if (!dRes.ok) {
          const dErr = await dRes.json().catch(() => ({}));
          return { statusCode: dRes.status, headers: cors, body: JSON.stringify({ error: dErr.msg || dErr.message || 'Erro ao excluir login no Auth' }) };
        }
      }
      await fetch(SURL + '/rest/v1/usuario_clientes?usuario_email=eq.' + encodeURIComponent(email), {
        method: 'DELETE',
        headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE }
      });
      await fetch(SURL + '/rest/v1/usuarios?email=eq.' + encodeURIComponent(email), {
        method: 'DELETE',
        headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE }
      });
      return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true, action: 'delete', email: email, auth_removido: !!alvo }) };
    }

    if (!alvo) return { statusCode: 404, headers: cors, body: JSON.stringify({ error: 'Usuário não encontrado no Auth' }) };

    // 6) Demais ações
    let body = {};
    if (action === 'set_password') {
      if (!password || password.length < 6) {
        return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Senha deve ter no mínimo 6 caracteres' }) };
      }
      body = { password: password };
    } else if (action === 'ban') {
      body = { ban_duration: '876000h' }; // ~100 anos
    } else if (action === 'unban') {
      body = { ban_duration: 'none' };
    } else {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Ação inválida' }) };
    }

    const pRes = await fetch(SURL + '/auth/v1/admin/users/' + alvo.id, {
      method: 'PUT',
      headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const pData = await pRes.json().catch(() => ({}));
    if (!pRes.ok) {
      return { statusCode: pRes.status, headers: cors, body: JSON.stringify({ error: pData.msg || pData.message || 'Erro no Supabase Auth' }) };
    }

    return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true, action: action, email: email }) };
  } catch (err) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: err.message }) };
  }
};

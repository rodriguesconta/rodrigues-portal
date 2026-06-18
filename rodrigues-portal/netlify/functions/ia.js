// netlify/functions/ia.js
// Proxy seguro para a API da Anthropic — a chave fica SOMENTE na env var
// ANTHROPIC_API_KEY do Netlify, nunca no HTML/repositório.
//
// Recebe do portal: { system, user_text, image_base64, image_type, max_tokens }
// Retorna: { text } com o texto da resposta do modelo (já concatenado).
//
// Env var necessária (Netlify → Environment variables):
//   ANTHROPIC_API_KEY  → a chave nova (sk-ant-...)
exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: 'OK' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'Method not allowed' }) };

  const KEY = process.env.ANTHROPIC_API_KEY;
  if (!KEY) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY não configurada no Netlify' }) };
  }

  try {
    const { system, user_text, image_base64, image_type, max_tokens } = JSON.parse(event.body || '{}');

    const content = [];
    if (image_base64) {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: image_type || 'image/jpeg', data: image_base64 }
      });
    }
    content.push({ type: 'text', text: user_text || 'Analise a imagem acima.' });

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: max_tokens || 1000,
        system: system || '',
        messages: [{ role: 'user', content: content }]
      })
    });

    const data = await resp.json();
    if (!resp.ok) {
      const msg = (data && data.error && data.error.message) || ('Erro na API Claude: ' + resp.status);
      return { statusCode: resp.status, headers: cors, body: JSON.stringify({ error: msg }) };
    }

    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    return { statusCode: 200, headers: cors, body: JSON.stringify({ text: text }) };
  } catch (err) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: err.message }) };
  }
};

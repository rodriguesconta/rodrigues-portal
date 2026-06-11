// netlify/functions/prolabore.js
// Proxy para buscar transferências do Mercado Pago (evita CORS)

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { ano } = JSON.parse(event.body || '{}');
    if (!ano) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Ano obrigatório' }) };
    }

    const MP_TOKEN = 'APP_USR-7113660792455299-041014-e8a1ffa4f17b993c28802a3cfb808b26-2326004458';
    let allPayments = [];
    let offset = 0;

    // Buscar todos os pagamentos aprovados do ano
    while (true) {
      const url = `https://api.mercadopago.com.br/v1/payments/search?sort=date_created&criteria=desc&range=date_created&begin_date=${ano}-01-01T00:00:00.000-03:00&end_date=${ano}-12-31T23:59:59.999-03:00&status=approved&limit=100&offset=${offset}`;
      
      const resp = await fetch(url, {
        headers: { 'Authorization': `Bearer ${MP_TOKEN}` }
      });

      if (!resp.ok) {
        const errText = await resp.text();
        return { statusCode: resp.status, headers, body: JSON.stringify({ error: 'Erro MP API', detail: errText }) };
      }

      const data = await resp.json();
      if (!data.results || !data.results.length) break;

      allPayments = allPayments.concat(data.results);
      offset += data.results.length;
      if (offset >= data.paging.total) break;
      if (offset > 1000) break; // safety limit
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        total: allPayments.length,
        payments: allPayments.map(p => ({
          id: p.id,
          date: p.date_created,
          amount: p.transaction_amount,
          description: p.description || '',
          payer_doc: p.payer?.identification?.number || '',
          payer_name: (p.payer?.first_name || '') + ' ' + (p.payer?.last_name || ''),
          payer_email: p.payer?.email || '',
          payment_type: p.payment_type_id || '',
          status: p.status
        }))
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};

exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: cors, body: 'OK' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: cors, body: 'Method not allowed' };
  }
  const MP_TOKEN = 'APP_USR-7113660792455299-041014-e8a1ffa4f17b993c28802a3cfb808b26-2326004458';
  try {
    const b = JSON.parse(event.body);
    const valor = b.valor;
    const descricao = b.descricao;
    const email = b.email;
    const nome = b.nome;
    const cpf = b.cpf;
    const cobranca_id = b.cobranca_id;
    const endereco = b.endereco || {};
    const vencimento = b.vencimento; // 'YYYY-MM-DD' (vencimento da cobrança no sistema)

    const doc = (cpf || '').replace(/\D/g, '') || '00000000000';
    const docType = doc.length === 14 ? 'CNPJ' : 'CPF';

    const primeiro = (nome || 'Cliente').split(' ')[0] || 'Cliente';
    const ultimo = (nome || '').split(' ').slice(1).join(' ') || '.';

    // Data de expiração do boleto = vencimento do sistema (fim do dia, fuso -03:00).
    // Se não vier vencimento, o MP usa o padrão dele.
    let expStr = null;
    if (vencimento && /^\d{4}-\d{2}-\d{2}$/.test(vencimento)) {
      expStr = vencimento + 'T23:59:59.000-03:00';
    }

    const payload = {
      transaction_amount: parseFloat(valor),
      description: descricao || 'Honorários contábeis - Rodrigues Assessoria',
      payment_method_id: 'bolbradesco',
      payer: {
        email: email || 'cliente@rodriguesconta.com.br',
        first_name: primeiro,
        last_name: ultimo,
        identification: { type: docType, number: doc },
        address: {
          zip_code: (endereco.cep || '27270000').replace(/\D/g, ''),
          street_name: endereco.rua || 'Rua não informada',
          street_number: endereco.numero || 'S/N',
          neighborhood: endereco.bairro || 'Centro',
          city: endereco.cidade || 'Volta Redonda',
          federal_unit: endereco.estado || 'RJ'
        }
      },
      notification_url: 'https://rodriguesconta.com.br/.netlify/functions/webhook-mp',
      external_reference: cobranca_id
    };
    if (expStr) payload.date_of_expiration = expStr;

    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + MP_TOKEN,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': (cobranca_id || 'bol') + '-bol-' + Date.now()
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
      return {
        statusCode: 400,
        headers: cors,
        body: JSON.stringify({ erro: data.message || JSON.stringify(data) })
      };
    }
    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({
        linha_digitavel: data.barcode?.content || '',
        pdf_url: data.transaction_details?.external_resource_url || '',
        payment_id: data.id,
        status: data.status
      })
    };
  } catch (err) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ erro: err.message }) };
  }
};

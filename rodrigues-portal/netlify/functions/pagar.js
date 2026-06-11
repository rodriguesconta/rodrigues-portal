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
    const { valor, descricao, email, nome, cpf, cobranca_id } = JSON.parse(event.body);
    const doc = (cpf || '').replace(/\D/g, '') || '00000000000';
    const docType = doc.length === 14 ? 'CNPJ' : 'CPF';
    const exp = new Date(Date.now() + 30 * 86400000);
    const expStr = exp.getFullYear() + '-' + String(exp.getMonth() + 1).padStart(2, '0') + '-' + String(exp.getDate()).padStart(2, '0') + 'T23:59:59.000-03:00';
    const payload = {
      transaction_amount: parseFloat(valor),
      description: descricao || 'Honorários contábeis - Rodrigues Assessoria',
      payment_method_id: 'pix',
      date_of_expiration: expStr,
      payer: {
        email: email || 'cliente@rodriguesconta.com.br',
        first_name: nome?.split(' ')[0] || 'Cliente',
        last_name: nome?.split(' ').slice(1).join(' ') || '.',
        identification: { type: docType, number: doc }
      },
      notification_url: 'https://rodriguesconta.com.br/.netlify/functions/webhook-mp',
      external_reference: cobranca_id
    };
    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + MP_TOKEN,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': cobranca_id + '-' + Date.now()
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
        pix_copia_cola: data.point_of_interaction?.transaction_data?.qr_code,
        qr_code_base64: data.point_of_interaction?.transaction_data?.qr_code_base64,
        payment_id: data.id,
        status: data.status
      })
    };
  } catch (err) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ erro: err.message }) };
  }
};

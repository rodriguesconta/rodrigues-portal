exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 200, body: 'OK' };
  }

  const MP_TOKEN = 'APP_USR-7113660792455299-041014-e8a1ffa4f17b993c28802a3cfb808b26-2326004458';
  const SUPA_URL = 'https://xuzcczbdbgihkurcbepw.supabase.co';
  const SUPA_KEY = 'sb_publishable_7xC7UlKxPMdivffyuXPN2Q_rOjh6O8o';

  try {
    const body = JSON.parse(event.body);
    if (body.type !== 'payment') return { statusCode: 200, body: 'OK' };

    const payment_id = body.data?.id;
    if (!payment_id) return { statusCode: 200, body: 'OK' };

    const mpRes = await fetch('https://api.mercadopago.com/v1/payments/' + payment_id, {
      headers: { 'Authorization': 'Bearer ' + MP_TOKEN }
    });
    const payment = await mpRes.json();

    if (payment.status === 'approved' && payment.external_reference) {
      await fetch(SUPA_URL + '/rest/v1/cobrancas?id=eq.' + payment.external_reference, {
        method: 'PATCH',
        headers: {
          'Authorization': 'Bearer ' + SUPA_KEY,
          'apikey': SUPA_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          status: 'pago',
          data_pagamento: new Date().toISOString().split('T')[0],
          mp_payment_id: String(payment_id)
        })
      });
    }

    return { statusCode: 200, body: 'OK' };
  } catch (err) {
    return { statusCode: 200, body: 'OK' };
  }
};
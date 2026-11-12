const { STORES, db, mp, DEAD, qrOf } = require('./_lib');
const STORE = 'mangoe';
const EXP = 'PT1H';
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (!process.env.MP_ACCESS_TOKEN || !process.env.PIX_SECRET) return res.status(500).json({ error: 'config' });
    let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
    const number = parseInt((req.method === 'GET' ? req.query.number : (b && b.number)), 10);
    if (!(number > 0)) return res.status(400).json({ error: 'pedido inválido' });
    const info = await db(STORE, { action: 'info', number });
    if (info.paid) return res.status(200).json({ paid: true });

    // Consulta de status
    if (req.method === 'GET') {
      if (!info.mp_order_id) return res.status(200).json({ paid: false });
      const o = await mp('/v1/orders/' + encodeURIComponent(info.mp_order_id));
      const st = o.data && o.data.status;
      if (st === 'processed') { await db(STORE, { action: 'paid', number, mp: info.mp_order_id }); return res.status(200).json({ paid: true }); }
      if (DEAD.includes(st)) return res.status(200).json({ paid: false, expired: true });
      return res.status(200).json({ paid: false });
    }

    // Geração do Pix
    if (info.payment_method !== 'pix') return res.status(400).json({ error: 'pedido não é Pix' });
    if (info.fee_pending) return res.status(400).json({ error: 'entrega a combinar' });
    const total = Number(info.total);
    if (!(total > 0)) return res.status(400).json({ error: 'valor inválido' });

    if (info.mp_order_id) {
      const o = await mp('/v1/orders/' + encodeURIComponent(info.mp_order_id));
      const st = o.data && o.data.status;
      if (st === 'processed') { await db(STORE, { action: 'paid', number, mp: info.mp_order_id }); return res.status(200).json({ paid: true }); }
      const q = qrOf(o.data);
      if (o.ok && !DEAD.includes(st) && q.qr) return res.status(200).json({ paid: false, amount: total, qr: q.qr, qr_base64: q.qr_base64, expires_in: 3000 });
    }
    const amount = total.toFixed(2);
    const body = {
      type: 'online', total_amount: amount, external_reference: STORE + '-' + number,
      processing_mode: 'automatic', description: 'Pedido #' + number + ' ' + STORES[STORE].name,
      transactions: { payments: [{ amount, payment_method: { id: 'pix', type: 'bank_transfer' }, expiration_time: EXP }] },
      payer: { email: 'pedido' + number + '@' + STORES[STORE].host }
    };
    const r = await mp('/v1/orders', { method: 'POST', headers: { 'X-Idempotency-Key': STORE + '-' + number + '-' + (info.mp_order_id ? Date.now() : '1') }, body: JSON.stringify(body) });
    if (!r.ok) { console.error('MP create error', r.status, JSON.stringify(r.data).slice(0, 800)); return res.status(502).json({ error: 'mp', detail: (r.data && r.data.errors && r.data.errors[0] && r.data.errors[0].message) || (r.data && r.data.message) || null }); }
    const q = qrOf(r.data);
    if (!q.qr) { console.error('MP sem QR', JSON.stringify(r.data).slice(0, 800)); return res.status(502).json({ error: 'sem qr' }); }
    await db(STORE, { action: 'set_mp', number, mp: r.data.id });
    return res.status(200).json({ paid: false, amount: total, qr: q.qr, qr_base64: q.qr_base64, expires_in: 3300 });
  } catch (e) {
    console.error('pix error', e && e.message);
    return res.status(500).json({ error: 'erro' });
  }
};

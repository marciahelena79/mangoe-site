const { STORES, db, mp } = require('./_lib');
// O Mercado Pago permite uma única URL de webhook por aplicação: este endpoint atende as duas lojas
// (pela external_reference "<loja>-<número>"). Nunca confiamos no corpo da notificação: sempre
// consultamos o pedido direto na API do Mercado Pago antes de marcar como pago.
module.exports = async (req, res) => {
  try {
    let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
    const q = req.query || {};
    const id = (b && b.data && b.data.id) || q['data.id'] || q.id;
    if (!id) return res.status(200).json({ ok: true });
    const o = await mp('/v1/orders/' + encodeURIComponent(String(id)));
    if (!o.ok) return res.status(200).json({ ok: true, skipped: o.status });
    const ref = String(o.data.external_reference || '');
    const m = ref.match(/^(mangoe|bistro)-(\d+)$/);
    if (!m) return res.status(200).json({ ok: true, skipped: 'ref' });
    if (o.data.status === 'processed') await db(m[1], { action: 'paid', number: parseInt(m[2], 10), mp: String(o.data.id) });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('webhook error', e && e.message);
    return res.status(500).json({ error: 'erro' });
  }
};

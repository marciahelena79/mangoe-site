// Configuração das lojas (chaves publishable do Supabase são públicas; segredos ficam em variáveis de ambiente)
const STORES = {
  mangoe: { name: 'Mangoê', host: 'mangoe.vercel.app', sb: 'https://uwwrzpzjwcegonrntbio.supabase.co/rest/v1/rpc/pix_api', key: 'sb_publishable_g4gdE7lepqwJHC1vh0E51Q_HpQCdQ6G' },
  bistro: { name: 'DonaLia Bistrô', host: 'donalia-bistro.vercel.app', sb: 'https://lwicspulohwiniobupib.supabase.co/rest/v1/rpc/pix_api', key: 'sb_publishable_fGRKerLUJblNN6WKb8m76g_6wnm2uiz' }
};
async function db(store, p) {
  const s = STORES[store];
  const r = await fetch(s.sb, { method: 'POST', headers: { apikey: s.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ p: Object.assign({ secret: process.env.PIX_SECRET }, p) }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.message || 'db ' + r.status); e.status = r.status; throw e; }
  return j;
}
async function mp(path, opts) {
  const r = await fetch('https://api.mercadopago.com' + path, Object.assign({}, opts, { headers: Object.assign({ Authorization: 'Bearer ' + process.env.MP_ACCESS_TOKEN, 'Content-Type': 'application/json', accept: 'application/json' }, (opts && opts.headers) || {}) }));
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data: j };
}
const DEAD = ['canceled', 'cancelled', 'expired', 'failed', 'refunded'];
function qrOf(order) {
  const p = order && order.transactions && order.transactions.payments && order.transactions.payments[0];
  const pm = (p && p.payment_method) || {};
  return { qr: pm.qr_code || null, qr_base64: pm.qr_code_base64 || null };
}
module.exports = { STORES, db, mp, DEAD, qrOf };

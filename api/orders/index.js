const crypto = require('crypto');
const {clientIp} = require('../shared/auth');
const {send, readJson, requireAdmin, handler} = require('../shared/http');
const {readStore, saveOrder, listOrders, updateOrderStatus} = require('../shared/storage');
const {cleanOrder, cleanSettings, ORDER_STATUSES} = require('../shared/validate');

// A light spam brake for the public order form (per server instance).
const recent = new Map();
function tooMany(ip) {
  const now = Date.now();
  const list = (recent.get(ip) || []).filter((t) => now - t < 3600000);
  list.push(now);
  recent.set(ip, list);
  if (recent.size > 5000) recent.clear();
  return list.length > 12;
}

function orderId() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(5);
  return 'VN-' + [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
}

module.exports = handler(async function (context, req) {
  const method = req.method.toUpperCase();

  if (method === 'POST') {
    if (tooMany(clientIp(req.headers))) {
      return send(context, 429, {error: 'Too many orders from this connection. Message us on WhatsApp instead.'});
    }
    const store = await readStore();
    const order = cleanOrder(readJson(req), store && store.products, cleanSettings(store && store.settings));
    order.id = orderId();
    order.createdAt = new Date().toISOString();
    await saveOrder(order);
    return send(context, 200, {ok: true, orderId: order.id, total: order.total});
  }

  if (!requireAdmin(context, req)) return;

  if (method === 'GET') {
    return send(context, 200, {orders: await listOrders()});
  }

  if (method === 'PATCH') {
    const body = readJson(req) || {};
    if (!ORDER_STATUSES.includes(body.status)) return send(context, 400, {error: 'Unknown order status.'});
    return send(context, 200, {ok: true, order: await updateOrderStatus(String(body.key || ''), body.status)});
  }

  send(context, 405, {error: 'Method not allowed.'});
});

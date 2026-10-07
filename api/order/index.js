'use strict';
const { getContainer } = require('../shared/db');

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*'
};

// WhatsApp number for order notifications (91 = India country code)
const OWNER_WA = '918923646175';

const SHIPPING_THRESHOLD = 1500;

function money(v) {
  return '₹' + Number(v).toLocaleString('en-IN');
}

function generateRef() {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `VNC-${datePart}-${rand}`;
}

function buildWhatsAppMessage(order) {
  const lines = [
    `🧶 *New Order — VN crochet*`,
    `Ref: *${order.ref}*`,
    ``,
    `*Customer*`,
    `Name: ${order.name}`,
    `Email: ${order.email}`,
    `City: ${order.city}`,
    ``,
    `*Items*`
  ];

  for (const item of order.items) {
    lines.push(`• ${item.name} (${item.ribbon} ribbon, ${item.size}) × ${item.qty} — ${money(item.lineTotal)}`);
  }

  lines.push(``);
  lines.push(`Subtotal: ${money(order.subtotal)}`);
  lines.push(`Shipping: ${order.shipping === 0 ? 'Free' : money(order.shipping)}`);
  if (order.discount) lines.push(`Discount: −10%`);
  lines.push(`*Total: ${money(order.total)}*`);

  if (order.notes) {
    lines.push(``);
    lines.push(`Notes: ${order.notes}`);
  }

  lines.push(``);
  lines.push(`Placed at: ${new Date(order.placedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);

  return lines.join('\n');
}

module.exports = async function (context, req) {
  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers: HEADERS };
    return;
  }

  try {
    const body = req.body;

    // ── Validate incoming payload ────────────────────────────────────────
    const name  = String(body?.name  || '').trim().slice(0, 80);
    const email = String(body?.email || '').trim().slice(0, 120);
    const city  = String(body?.city  || '').trim().slice(0, 80);
    const notes = String(body?.notes || '').trim().slice(0, 400);
    const cart  = Array.isArray(body?.cart) ? body.cart : [];
    const claimed = Boolean(body?.claimed);

    if (!name || !email || !city) {
      context.res = { status: 400, headers: HEADERS, body: JSON.stringify({ error: 'name, email, and city are required.' }) };
      return;
    }
    if (!cart.length) {
      context.res = { status: 400, headers: HEADERS, body: JSON.stringify({ error: 'Cart is empty.' }) };
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      context.res = { status: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid email address.' }) };
      return;
    }

    // ── Fetch live products from DB to get authoritative prices ──────────
    const catalogContainer = await getContainer('catalog');
    const { resources: products } = await catalogContainer.items
      .query('SELECT * FROM c WHERE c.active = true')
      .fetchAll();

    // Build enriched item list and calculate totals server-side
    const items = [];
    let subtotal = 0;
    for (const cartItem of cart) {
      const product = products.find(p => String(p.id) === String(cartItem.id));
      if (!product) continue; // skip unknown products
      const qty = Math.max(1, Math.min(9, Number(cartItem.q) || 1));
      const lineTotal = product.p * qty;
      subtotal += lineTotal;
      items.push({
        id: product.id,
        name: product.n,
        ribbon: String(cartItem.c || 'Cream'),
        size: product.s,
        unitPrice: product.p,
        qty,
        lineTotal
      });
    }

    if (!items.length) {
      context.res = { status: 400, headers: HEADERS, body: JSON.stringify({ error: 'No valid products in cart.' }) };
      return;
    }

    const shipping = subtotal >= SHIPPING_THRESHOLD ? 0 : 199;
    const discount = claimed ? Math.round(subtotal * 0.1) : 0;
    const total = subtotal + shipping - discount;
    const ref = generateRef();

    const order = {
      id: ref,
      ref,
      name, email, city, notes,
      items,
      subtotal,
      shipping,
      discount,
      total,
      claimed,
      status: 'pending',
      placedAt: new Date().toISOString()
    };

    // ── Save order to Cosmos DB ──────────────────────────────────────────
    const ordersContainer = await getContainer('orders');
    await ordersContainer.items.create(order);

    // ── Build WhatsApp notification link ─────────────────────────────────
    const waMessage = buildWhatsAppMessage(order);
    const waUrl = `https://wa.me/${OWNER_WA}?text=${encodeURIComponent(waMessage)}`;

    context.res = {
      status: 200,
      headers: HEADERS,
      body: JSON.stringify({
        ok: true,
        ref,
        total,
        waUrl   // front end opens this to notify the maker
      })
    };

  } catch (err) {
    context.log.error('order error:', err.message);
    context.res = {
      status: 500,
      headers: HEADERS,
      body: JSON.stringify({ error: 'Could not save order. Please try again.' })
    };
  }
};

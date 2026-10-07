import { PRODUCTS, SHIPPING_THRESHOLD, initCatalog } from '../js/data.js';
import { loadState, saveState, subtotal, total } from '../js/store.js';

const state = loadState();
const money = (value) => '₹' + value.toLocaleString('en-IN');
const listRoot  = document.querySelector('#checkout-list');
const totalsRoot = document.querySelector('#checkout-totals');
const statusRoot = document.querySelector('#checkout-status');
const form = document.querySelector('#checkout-form');

// ── Render bag summary ────────────────────────────────────────────────────────
function renderSummary() {
  const items = state.cart;
  const sum   = subtotal(state, PRODUCTS);

  if (!items.length) {
    listRoot.innerHTML = `
      <div class="empty-checkout">
        <h3>Your bag is empty.</h3>
        <p>Browse the collection and add a piece before checking out.</p>
        <a class="btn" href="../index.html">Visit the shop</a>
      </div>`;
    totalsRoot.innerHTML = `
      <div class="mat"><span>Subtotal</span><b>${money(0)}</b></div>
      <div class="mat"><span>Shipping</span><b>${money(0)}</b></div>
      <div class="mat total"><span>Total</span><b>${money(0)}</b></div>`;
    form.querySelector('button[type="submit"]').disabled = true;
    return;
  }

  listRoot.innerHTML = items.map((item) => {
    const product = PRODUCTS.find((p) => String(p.id) === String(item.id));
    if (!product) return '';
    const artInner = product.image
      ? `<img src="${product.image}" alt="${product.n}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">`
      : product.e;
    return `
      <article class="checkout-item">
        <div class="art small" style="background:${product.bg}">${artInner}</div>
        <div class="checkout-copy">
          <h3>${product.n}</h3>
          <p>${item.c} ribbon · ${product.s}</p>
        </div>
        <div class="checkout-meta">
          <b>Qty ${item.q}</b>
          <span>${money(product.p * item.q)}</span>
        </div>
      </article>`;
  }).join('');

  const shipping   = sum >= SHIPPING_THRESHOLD ? 0 : 199;
  const grandTotal = total(state, PRODUCTS);

  totalsRoot.innerHTML = `
    <div class="mat"><span>Subtotal</span><b>${money(sum)}</b></div>
    <div class="mat"><span>Shipping</span><b>${shipping === 0 ? 'Free' : money(shipping)}</b></div>
    <div class="mat"><span>Discount</span><b>${state.claimed ? '−10%' : '—'}</b></div>
    <div class="mat total"><span>Total</span><b>${money(grandTotal)}</b></div>`;
}

// ── Input helpers ─────────────────────────────────────────────────────────────
function sanitise(str, maxLen = 200) {
  return String(str).trim().replace(/[<>]/g, '').slice(0, maxLen);
}
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}
function setFieldError(field, message) {
  let err = field.parentElement.querySelector('.field-error');
  if (!err) {
    err = document.createElement('span');
    err.className = 'field-error';
    err.id = `err-${Math.random().toString(36).slice(2)}`;
    field.after(err);
  }
  err.textContent = message;
  field.setAttribute('aria-invalid', 'true');
  field.setAttribute('aria-describedby', err.id);
}
function clearFieldErrors() {
  form.querySelectorAll('.field-error').forEach(el => (el.textContent = ''));
  form.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
}

// ── Submit ────────────────────────────────────────────────────────────────────
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearFieldErrors();

  if (!state.cart.length) {
    statusRoot.textContent = 'Your bag is empty. Add a piece before placing an order.';
    return;
  }

  const formData = new FormData(form);
  const name  = sanitise(formData.get('name')  || '', 80);
  const email = sanitise(formData.get('email') || '', 120);
  const city  = sanitise(formData.get('city')  || '', 80);
  const notes = sanitise(formData.get('notes') || '', 400);

  // Client-side validation
  let valid = true;
  if (!name) {
    setFieldError(form.querySelector('[name="name"]'), 'Please enter your name.');
    valid = false;
  }
  if (!email || !isValidEmail(email)) {
    setFieldError(form.querySelector('[name="email"]'), 'Please enter a valid email address.');
    valid = false;
  }
  if (!city) {
    setFieldError(form.querySelector('[name="city"]'), 'Please enter your delivery city.');
    valid = false;
  }
  if (!valid) return;

  // Disable button while processing
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Placing order…';
  statusRoot.textContent = '';
  statusRoot.className = 'checkout-status';

  let ref = null;
  let waUrl = null;
  let orderTotal = total(state, PRODUCTS);

  try {
    // ── POST to /api/order ─────────────────────────────────────────────────
    const res = await fetch('/api/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, email, city, notes,
        cart: state.cart,
        claimed: state.claimed
      })
    });

    const data = await res.json();

    if (!res.ok) {
      // Server-side validation error — show it
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send order request';
      statusRoot.textContent = data.error || 'Something went wrong. Please try again.';
      return;
    }

    ref        = data.ref;
    waUrl      = data.waUrl;
    orderTotal = data.total; // use server-calculated total

  } catch (err) {
    // Network error — fall back to client-side WA message so order still goes through
    console.warn('API unreachable, falling back to local WA message.', err);
    waUrl = buildFallbackWaUrl({ name, email, city, notes });
  }

  // ── Award points + clear cart ──────────────────────────────────────────────
  state.pts   += Math.round(orderTotal);
  state.cart   = [];
  state.claimed = false;
  saveState(state);

  // ── Show confirmation ──────────────────────────────────────────────────────
  const refLine = ref ? `<br><small style="color:var(--soft)">Order ref: <b>${ref}</b> — save this for WhatsApp.</small>` : '';
  statusRoot.innerHTML = `
    <span>Thank you, <strong>${name}</strong>! Your order (${money(orderTotal)}) is confirmed.${refLine}</span>
    <a class="btn g" href="${waUrl}" target="_blank" rel="noopener noreferrer"
       style="margin-top:12px;display:inline-flex;align-items:center;gap:6px;text-decoration:none">
      📱 Message us on WhatsApp to confirm
    </a>`;
  statusRoot.classList.add('success');

  form.reset();
  renderSummary();

  // Auto-open WhatsApp after a short pause
  setTimeout(() => window.open(waUrl, '_blank'), 500);
});

// ── Fallback WA builder (used if API is unreachable) ─────────────────────────
function buildFallbackWaUrl({ name, email, city, notes }) {
  const OWNER_WA = '918923646175';
  const sum      = subtotal(state, PRODUCTS);
  const shipping = sum >= SHIPPING_THRESHOLD ? 0 : 199;
  const grand    = total(state, PRODUCTS);

  const lines = [
    `🧶 *New Order — VN crochet*`,
    ``,
    `*Customer:* ${name}`,
    `*Email:* ${email}`,
    `*City:* ${city}`,
    ``,
    `*Items:*`
  ];
  state.cart.forEach((item) => {
    const product = PRODUCTS.find((p) => String(p.id) === String(item.id));
    if (product) lines.push(`• ${product.n} (${item.c} ribbon) × ${item.q} — ${money(product.p * item.q)}`);
  });
  lines.push(``, `Subtotal: ${money(sum)}`);
  lines.push(`Shipping: ${shipping === 0 ? 'Free' : money(shipping)}`);
  if (state.claimed) lines.push(`Discount: −10%`);
  lines.push(`*Total: ${money(grand)}*`);
  if (notes) lines.push(``, `Notes: ${notes}`);

  return `https://wa.me/${OWNER_WA}?text=${encodeURIComponent(lines.join('\n'))}`;
}

// Boot
initCatalog().then(() => renderSummary());

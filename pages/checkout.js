import { PRODUCTS, SHIPPING_THRESHOLD, initCatalog } from '../js/data.js';
import { loadState, saveState, subtotal, total } from '../js/store.js';

const OWNER_WHATSAPP = '916396709920';

const state = loadState();
const money = (value) => '₹' + value.toLocaleString('en-IN');
const listRoot = document.querySelector('#checkout-list');
const totalsRoot = document.querySelector('#checkout-totals');
const statusRoot = document.querySelector('#checkout-status');
const form = document.querySelector('#checkout-form');

function renderSummary() {
  const items = state.cart;
  const sum = subtotal(state, PRODUCTS);

  if (!items.length) {
    listRoot.innerHTML = `
      <div class="empty-checkout">
        <h3>Your bag is empty.</h3>
        <p>Browse the collection and add a tiny handmade piece before checking out.</p>
        <a class="btn" href="../index.html">Visit the shop</a>
      </div>
    `;
    totalsRoot.innerHTML = `
      <div class="mat"><span>Subtotal</span><b>${money(0)}</b></div>
      <div class="mat"><span>Shipping</span><b>${money(0)}</b></div>
      <div class="mat total"><span>Total</span><b>${money(0)}</b></div>
    `;
    form.querySelector('button[type="submit"]').disabled = true;
    return;
  }

  listRoot.innerHTML = items.map((item) => {
    const product = PRODUCTS.find((entry) => entry.id === item.id);
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
      </article>
    `;
  }).join('');

  const shipping = sum >= SHIPPING_THRESHOLD ? 0 : 199;
  const grandTotal = total(state, PRODUCTS);

  totalsRoot.innerHTML = `
    <div class="mat"><span>Subtotal</span><b>${money(sum)}</b></div>
    <div class="mat"><span>Shipping</span><b>${shipping === 0 ? 'Free' : money(shipping)}</b></div>
    <div class="mat"><span>Discount</span><b>${state.claimed ? '-10%' : '—'}</b></div>
    <div class="mat total"><span>Total</span><b>${money(grandTotal)}</b></div>
  `;
}

// ── Input helpers ─────────────────────────────────────────────────────────
function sanitise(str, maxLen = 200) {
  return String(str).trim().replace(/[<>]/g, '').slice(0, maxLen);
}
function isValidEmail(email) {
  // Basic RFC-style check — catches obvious typos without over-engineering
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

form.addEventListener('submit', (event) => {
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

  // Validate
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
  const totalValue = total(state, PRODUCTS);
  const sum = subtotal(state, PRODUCTS);
  const shipping = sum >= SHIPPING_THRESHOLD ? 0 : 199;

  // Build a formatted WhatsApp message with order details
  const lines = [
    `*New Order Request — VN crochet* 🧶`,
    ``,
    `*Customer:* ${name}`,
    `*Email:* ${email}`,
    `*City:* ${city}`,
    ``,
    `*Items in bag:*`
  ];

  state.cart.forEach((item) => {
    const product = PRODUCTS.find((entry) => entry.id === item.id);
    if (product) {
      lines.push(`• ${product.n} (${item.c} ribbon, ${product.s}) × ${item.q} — ${money(product.p * item.q)}`);
    }
  });

  lines.push(``);
  lines.push(`*Subtotal:* ${money(sum)}`);
  lines.push(`*Shipping:* ${shipping === 0 ? 'Free' : money(shipping)}`);
  if (state.claimed) {
    lines.push(`*Discount:* 10% off`);
  }
  lines.push(`*Grand Total:* ${money(totalValue)}`);

  if (notes) {
    lines.push(``);
    lines.push(`*Notes for maker:* ${notes}`);
  }

  const messageText = lines.join('\n');
  const waUrl = `https://wa.me/${OWNER_WHATSAPP}?text=${encodeURIComponent(messageText)}`;

  // Award points & clear cart
  state.pts += Math.round(totalValue);
  state.cart = [];
  state.claimed = false;
  saveState(state);

  statusRoot.innerHTML = `
    <span>Order prepared for <strong>${name}</strong> (${money(totalValue)})!</span><br>
    <a class="btn g" href="${waUrl}" target="_blank" rel="noopener noreferrer" style="margin-top:10px;display:inline-flex;align-items:center;gap:6px;">
      📱 Open in WhatsApp to send order
    </a>
  `;
  statusRoot.classList.add('success');
  form.reset();
  form.querySelector('button[type="submit"]').disabled = true;
  renderSummary();

  // Also auto-open WhatsApp after a brief moment
  setTimeout(() => {
    window.open(waUrl, '_blank');
  }, 400);
});

// Boot: fetch live catalog then render
initCatalog().then(() => renderSummary());

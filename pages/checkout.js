import {PRODUCTS, SETTINGS, initCatalog, waLink} from '../js/data.js';
import {loadState, saveState, subtotal, pruneCart} from '../js/store.js';


const state = loadState();
const money = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]
));

const list = document.querySelector('#list');
const totals = document.querySelector('#totals');
const status = document.querySelector('#status');
const form = document.querySelector('#form');
const submit = form.querySelector('button[type="submit"]');

/* ── Summary ───────────────────────────────────────────────── */

function currentTotals() {
  const sum = subtotal(state, PRODUCTS);
  const shipping = state.cart.length && sum < SETTINGS.freeShippingFrom ? SETTINGS.shippingFee : 0;
  return {sum, shipping, grand: sum + shipping};
}

function render() {
  pruneCart(state, PRODUCTS);
  const {sum, shipping, grand} = currentTotals();

  if (!state.cart.length) {
    list.innerHTML = `
      <div class="empty">
        <span class="empty-mark" aria-hidden="true">🛍</span>
        <h3>There's nothing in your cart</h3>
        <p>Add a piece from the collection and come back here to place the order.</p>
        <div class="empty-actions">
          <a class="btn" href="../index.html#shop">Browse the collection</a>
        </div>
      </div>`;
    totals.innerHTML = '';
    submit.disabled = true;
    return;
  }

  submit.disabled = false;

  list.innerHTML = state.cart.map((line) => {
    const p = PRODUCTS.find((x) => String(x.id) === String(line.id));
    if (!p) return '';
    const bg = /^#[0-9a-f]{3,8}$/i.test(p.bg || '') ? p.bg : 'var(--linen)';
    const art = p.image
      ? `<img src="${esc(p.image)}" alt="${esc(p.n)}" loading="lazy">`
      : `<span class="card-emoji">${esc(p.e || '🧶')}</span>`;
    return `
      <article class="co-item">
        <div class="crow-art" style="background-color:${bg}">${art}</div>
        <div class="co-copy">
          <h3>${esc(p.n)}</h3>
          <p>${[line.c ? `${esc(line.c)} ribbon` : '', esc(p.s || '')].filter(Boolean).join(' · ')}</p>
        </div>
        <div class="co-meta">
          <b>Qty ${line.q}</b>
          <span>${money(p.p * line.q)}</span>
        </div>
      </article>`;
  }).join('');

  totals.innerHTML = `
    <div class="mat"><span>Subtotal</span><b>${money(sum)}</b></div>
    <div class="mat"><span>Shipping</span><b>${shipping === 0 ? 'Free' : money(shipping)}</b></div>
    <div class="mat total"><span>Total</span><b>${money(grand)}</b></div>`;
}

/* ── Validation ────────────────────────────────────────────── */

const clean = (v, max = 200) => String(v || '').trim().replace(/[<>]/g, '').slice(0, max);
const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const validPhone = (v) => (v.match(/\d/g) || []).length >= 10;

function fieldError(input, message) {
  const field = input.closest('.field');
  let err = field.querySelector('.field-error');
  if (!err) {
    err = document.createElement('span');
    err.className = 'field-error';
    err.id = `err-${input.id}`;
    field.appendChild(err);
  }
  err.textContent = message;
  input.setAttribute('aria-invalid', 'true');
  input.setAttribute('aria-describedby', err.id);
}
function clearErrors() {
  form.querySelectorAll('.field-error').forEach((el) => { el.textContent = ''; });
  form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
}

/* ── WhatsApp hand-off ─────────────────────────────────────── */

function waUrl({name, email, phone, city, notes, ref}) {
  const {sum, shipping, grand} = currentTotals();
  const lines = ['New order — VN crochet', ''];
  if (ref) lines.push(`Ref: ${ref}`, '');
  lines.push(`Name: ${name}`, `Email: ${email}`, `Phone: ${phone}`, `City: ${city}`, '', 'Items:');
  state.cart.forEach((line) => {
    const p = PRODUCTS.find((x) => String(x.id) === String(line.id));
    if (p) lines.push(`- ${p.n}${line.c ? ` (${line.c} ribbon)` : ''} x${line.q} — ${money(p.p * line.q)}`);
  });
  lines.push('', `Subtotal: ${money(sum)}`, `Shipping: ${shipping === 0 ? 'Free' : money(shipping)}`, `Total: ${money(grand)}`);
  if (notes) lines.push('', `Notes: ${notes}`);
  return waLink(lines.join('\n'));
}

/* ── Submit ────────────────────────────────────────────────── */

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearErrors();
  status.textContent = '';
  status.className = 'co-status';

  if (!state.cart.length) {
    status.textContent = 'Your cart is empty. Add a piece before placing an order.';
    status.classList.add('err');
    return;
  }

  const name = clean(form.name.value, 80);
  const email = clean(form.email.value, 120);
  const phone = clean(form.phone.value, 20);
  const city = clean(form.city.value, 80);
  const notes = clean(form.notes.value, 400);

  let ok = true;
  if (!name) { fieldError(form.name, 'Please add your name.'); ok = false; }
  if (!validEmail(email)) { fieldError(form.email, 'Enter a valid email address.'); ok = false; }
  if (!validPhone(phone)) { fieldError(form.phone, 'Enter a phone number we can reach you on.'); ok = false; }
  if (!city) { fieldError(form.city, 'Which city should we deliver to?'); ok = false; }
  if (!ok) { form.querySelector('[aria-invalid]')?.focus(); return; }

  submit.disabled = true;
  submit.textContent = 'Placing the order…';

  const {grand} = currentTotals();
  let ref = null;
  let orderTotal = grand;

  // Shape expected by api/orders: {name, phone, items, total}.
  const items = state.cart.map((line) => {
    const p = PRODUCTS.find((x) => String(x.id) === String(line.id));
    return {id: line.id, name: p?.n || '', ribbon: line.c, qty: line.q, price: p?.p || 0};
  });

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({name, email, phone, city, notes, items, total: orderTotal})
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      submit.disabled = false;
      submit.textContent = 'Place the order';
      status.textContent = data.error || "We couldn't save that order. Please try again in a moment.";
      status.classList.add('err');
      return;
    }
    if (data.orderId) ref = data.orderId;
    if (Number.isFinite(Number(data.total))) orderTotal = Number(data.total); // server-checked prices
  } catch {
    // The order API is unreachable — still hand the order over on WhatsApp
    // rather than losing it. The maker confirms there either way.
  }

  const url = waUrl({name, email, phone, city, notes, ref});

  state.cart = [];
  saveState(state);

  status.innerHTML = `
    <span>Thanks, <strong>${esc(name)}</strong>. Your order for <strong>${money(orderTotal)}</strong> is in.
    ${ref ? `Reference <strong>${esc(ref)}</strong>.` : ''}</span>
    <span>Send the message below so we can confirm delivery and payment.</span>
    <a class="btn" href="${url}" target="_blank" rel="noopener" style="margin-top:6px">Confirm on WhatsApp</a>`;
  status.classList.add('ok');

  form.reset();
  render();
  submit.textContent = 'Place the order';
  status.scrollIntoView({behavior: 'smooth', block: 'center'});
});

/* ── Boot ──────────────────────────────────────────────────── */

initCatalog().then(render).catch(() => {
  list.innerHTML = `
    <div class="empty">
      <span class="empty-mark" aria-hidden="true">⚠</span>
      <h3>We couldn't load your cart</h3>
      <p>Reload the page to try again, or message us and we'll take the order directly.</p>
      <div class="empty-actions">
        <button class="btn" type="button" onclick="location.reload()">Reload the page</button>
        <a class="link-quiet" href="${waLink()}" target="_blank" rel="noopener">Message us</a>
      </div>
    </div>`;
  submit.disabled = true;
});

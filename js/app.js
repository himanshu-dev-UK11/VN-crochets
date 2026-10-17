import {PRODUCTS, RIBBON_COLORS, RIBBON_NAMES, SETTINGS, CAT_ICONS, CATEGORIES, settingsLoaded, initCatalog, waLink, ribbonsFor} from './data.js';
import {loadState, saveState, itemCount, subtotal, pruneCart} from './store.js';

const state = loadState();
const $ = (sel) => document.querySelector(sel);
const money = (n) => (SETTINGS.currency || '₹') + Math.round(n).toLocaleString('en-IN');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]
));

/* ── Small helpers ─────────────────────────────────────────── */

function artwork(product, className = '', inner = '') {
  if (!product) return `<div class="${className}"></div>`;
  const bg = /^#[0-9a-f]{3,8}$/i.test(product.bg || '') ? product.bg : 'var(--linen)';
  if (product.image) {
    const x = product.imageX ?? 50, y = product.imageY ?? 50, z = product.imageZoom || 100;
    const img = `<img src="${esc(product.image)}" alt="${esc(product.n)}" loading="lazy" decoding="async"
        style="object-position:${x}% ${y}%;transform-origin:${x}% ${y}%;transform:scale(${z / 100})">`;
    return `<div class="${className}" style="background-color:${bg}">${img}${inner}</div>`;
  }
  // No photograph: fall back to the emoji on a textured yarn-colour field.
  return `<div class="${className} tex" style="background-color:${bg}">
    <span class="card-emoji">${esc(product.e || '🧶')}</span>${inner}</div>`;
}

function stockNote(product) {
  const n = Number(product.stock);
  if (!Number.isFinite(n) || n > 2) return '';
  if (n <= 0) return `<span class="card-last">Made to order</span>`;
  return `<span class="card-last">Only ${n} left</span>`;
}

const maxQty = (product) => {
  const n = Number(product?.stock);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 9) : 5;
};

let toastTimer;
function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 2400);
}

/* ── Dialog plumbing (native <dialog> handles focus + Esc) ─── */

/* Re-render a panel without losing the reader's place: keep the scroll
   position of its scrolling area and put focus back on the same control
   (matched by its data attributes) so ribbon, quantity and cart buttons
   don't jump the view to the top or drop keyboard focus. */
function repaint(panel, html, scrollSel) {
  const box = panel.querySelector(scrollSel);
  const top = box ? box.scrollTop : 0;
  const active = document.activeElement;
  let key = null;
  if (active && panel.contains(active)) {
    const attrs = ['data-ribbon', 'data-step', 'data-i', 'data-d'].filter((n) => active.hasAttribute(n));
    if (attrs.length) key = attrs.map((n) => `[${n}="${active.getAttribute(n)}"]`).join('');
  }
  panel.innerHTML = html;
  const next = panel.querySelector(scrollSel);
  if (next) next.scrollTop = top;
  if (key) {
    const el = panel.querySelector(key);
    (el && !el.disabled ? el : panel.querySelector('[data-add], [data-close]'))?.focus({preventScroll: true});
  }
}

function openDialog(dialog) {
  if (dialog.open) return;
  dialog.showModal();
  document.documentElement.classList.add('is-locked');
}
function closeDialog(dialog) {
  if (dialog.open) dialog.close();
}
['#pd', '#cart'].forEach((sel) => {
  const dialog = $(sel);
  dialog.addEventListener('close', () => {
    if (!$('#pd').open && !$('#cart').open) {
      document.documentElement.classList.remove('is-locked');
    }
  });
  // click on the backdrop area (the dialog element itself) closes it
  dialog.addEventListener('click', (e) => { if (e.target === dialog) closeDialog(dialog); });
});

/* ── Catalogue ─────────────────────────────────────────────── */

function visibleProducts() {
  const q = state.query.trim().toLowerCase();
  let list = PRODUCTS.filter((p) => {
    if (state.cat !== 'All' && p.c !== state.cat) return false;
    if (!q) return true;
    return `${p.n} ${p.c} ${p.d} ${p.s}`.toLowerCase().includes(q);
  });
  if (state.sort === 'lo') list = [...list].sort((a, b) => a.p - b.p);
  else if (state.sort === 'hi') list = [...list].sort((a, b) => b.p - a.p);
  else list = [...list].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
  return list;
}

function renderCategories() {
  const known = CATEGORIES.map((c) => c.name);
  const used = PRODUCTS.map((p) => p.c).filter(Boolean);
  const cats = ['All', ...known.filter((c) => used.includes(c)), ...used.filter((c) => !known.includes(c))];
  const unique = [...new Set(cats)];
  if (!unique.includes(state.cat)) state.cat = 'All';
  $('#cats').innerHTML = unique.map((cat) => `
    <button class="cat" type="button" data-cat="${esc(cat)}" aria-pressed="${cat === state.cat}">
      <span aria-hidden="true">${CAT_ICONS[cat] || '•'}</span> ${esc(cat)}
    </button>`).join('');
}

let firstPaint = true;

function renderGrid() {
  const list = visibleProducts();
  const grid = $('#grid');

  if (!list.length) {
    grid.innerHTML = `
      <div class="empty">
        <span class="empty-mark" aria-hidden="true">⌕</span>
        <h3>Nothing here matches that</h3>
        <p>${state.query ? `We couldn't find a piece for “${esc(state.query)}”.` : 'This category is empty right now.'} Try a different word, or ask us to make it.</p>
        <div class="empty-actions">
          <button class="btn" type="button" id="resetFilters">Show every piece</button>
          <a class="link-quiet" href="#custom">Request a custom piece</a>
        </div>
      </div>`;
  } else {
    grid.innerHTML = list.map((p, i) => `
      <button class="card" type="button" style="--i:${i}" data-id="${esc(p.id)}"
              aria-label="View ${esc(p.n)}, ${money(p.p)}">
        ${artwork(p, 'card-swatch', (p.c ? `<span class="card-tag">${esc(p.c)}</span>` : '') + stockNote(p))}
        <div class="card-body">
          <h3 class="card-name">${esc(p.n)}</h3>
          <p class="card-meta">${esc(p.s || 'Made in a small batch')}</p>
          <div class="card-foot">
            <span class="price">${money(p.p)}</span>
            <span class="card-cta">View piece</span>
          </div>
        </div>
      </button>`).join('');
  }

  grid.removeAttribute('aria-busy');
  grid.setAttribute('aria-label', 'The collection');
  grid.classList.toggle('reveal', firstPaint && list.length > 0);
  firstPaint = false;

  $('#count').textContent = PRODUCTS.length
    ? `${list.length} of ${PRODUCTS.length} ${PRODUCTS.length === 1 ? 'piece' : 'pieces'}`
    : '';
}


/* ── Product detail ────────────────────────────────────────── */

function openProduct(id) {
  const product = PRODUCTS.find((p) => String(p.id) === String(id));
  if (!product) return;
  const cap = maxQty(product);
  const offered = ribbonsFor(product);
  let ribbon = offered[0] ?? -1;
  let qty = 1;

  const draw = () => {
    const specs = [];
    if (product.s) specs.push(['Size', esc(product.s)]);
    (product.m || []).forEach(([label, value]) => specs.push([esc(label), esc(value)]));
    const stock = Number(product.stock);
    specs.push(['Availability', Number.isFinite(stock) && stock > 0
      ? `${stock} ready to post`
      : 'Made to order, 1–2 weeks']);

    repaint($('#pdPanel'), `
      <button class="x" type="button" data-close aria-label="Close details">✕</button>
      ${artwork(product, 'pd-art')}
      <div class="pd-side">
        <div class="pd-scroll">
          ${product.c ? `<span class="pd-kind">${esc(product.c)}</span>` : ''}
          <h2 class="pd-title">${esc(product.n)}</h2>
          ${product.d ? `<p class="pd-desc">${esc(product.d)}</p>` : ''}
          <p class="pd-sub">Details</p>
          <ul class="specs">
            ${specs.map(([k, v]) => `<li><span>${k}</span><span>${v}</span></li>`).join('')}
            ${product.care ? `<li class="stack"><span>Care</span><span>${esc(product.care)}</span></li>` : ''}
          </ul>
          ${offered.length ? `
          <p class="pd-sub">Ribbon colour: ${esc(RIBBON_NAMES[ribbon])}</p>
          <div class="sw" role="group" aria-label="Choose a ribbon colour">
            ${offered.map((i) => `
              <button type="button" data-ribbon="${i}" aria-pressed="${i === ribbon}"
                      title="${esc(RIBBON_NAMES[i])}" aria-label="${esc(RIBBON_NAMES[i])} ribbon"
                      style="background:${RIBBON_COLORS[i]}">${i === ribbon ? '✓' : ''}</button>`).join('')}
          </div>` : ''}
        </div>
        <div class="pd-foot">
          <div class="pd-row">
            <div class="qty">
              <button type="button" data-step="-1" aria-label="One fewer" ${qty <= 1 ? 'disabled' : ''}>−</button>
              <b>${qty}</b>
              <button type="button" data-step="1" aria-label="One more" ${qty >= cap ? 'disabled' : ''}>+</button>
            </div>
            <span class="pd-total">${money(product.p * qty)}</span>
          </div>
          <button class="btn btn-wide" type="button" data-add>Add to cart</button>
        </div>
      </div>`, '.pd-scroll');
  };

  // Start from a blank panel so a previous product's scroll position isn't kept.
  $('#pdPanel').innerHTML = '';
  draw();
  openDialog($('#pd'));
  const scroller = $('#pdPanel .pd-scroll');
  if (scroller) scroller.scrollTop = 0;

  $('#pdPanel').onclick = (e) => {
    const hit = e.target.closest('button');
    if (!hit) return;
    if (hit.hasAttribute('data-close')) return closeDialog($('#pd'));
    if (hit.dataset.ribbon !== undefined) { ribbon = Number(hit.dataset.ribbon); return draw(); }
    if (hit.dataset.step) { qty = Math.max(1, Math.min(cap, qty + Number(hit.dataset.step))); return draw(); }
    if (hit.hasAttribute('data-add')) {
      addToCart(product.id, qty, RIBBON_NAMES[ribbon] || '');
      closeDialog($('#pd'));
    }
  };
}

/* ── Cart ──────────────────────────────────────────────────── */

function addToCart(id, qty, ribbon) {
  const line = state.cart.find((l) => String(l.id) === String(id) && l.c === ribbon);
  if (line) line.q += qty; else state.cart.push({id, q: qty, c: ribbon});
  const btn = $('#openCart');
  btn.classList.remove('bump');
  void btn.offsetWidth;
  btn.classList.add('bump');
  toast('Added to your cart');
  sync();
}

function renderCart() {
  pruneCart(state, PRODUCTS);
  const sum = subtotal(state, PRODUCTS);
  const threshold = SETTINGS.freeShippingFrom;
  const pct = Math.min(100, threshold ? (sum / threshold) * 100 : 100);
  const free = sum >= threshold;
  const shipping = state.cart.length ? (free ? 0 : SETTINGS.shippingFee) : 0;

  const rows = state.cart.map((line, i) => {
    const p = PRODUCTS.find((x) => String(x.id) === String(line.id));
    if (!p) return '';
    const cap = maxQty(p);
    return `
      <div class="crow">
        ${artwork(p, 'crow-art')}
        <div class="crow-main">
          <b>${esc(p.n)}</b>
          <small>${line.c ? `${esc(line.c)} ribbon · ` : ''}${money(p.p)} each</small>
          <div class="crow-foot">
            <div class="qty">
              <button type="button" data-i="${i}" data-d="-1" aria-label="One fewer ${esc(p.n)}">−</button>
              <b>${line.q}</b>
              <button type="button" data-i="${i}" data-d="1" aria-label="One more ${esc(p.n)}" ${line.q >= cap ? 'disabled' : ''}>+</button>
            </div>
            <span class="crow-total">${money(p.p * line.q)}</span>
          </div>
        </div>
      </div>`;
  }).join('');

  repaint($('#cartPanel'), `
    <div class="cart-head">
      <button class="x" type="button" data-close aria-label="Close cart">✕</button>
      <h2>Your cart</h2>
      ${state.cart.length ? `
        <div class="ship">
          <small>${free ? '<b>Free shipping unlocked.</b>' : `${money(threshold - sum)} more for free shipping`}</small>
          <div class="meter" role="presentation"><i style="width:${pct}%"></i></div>
        </div>` : ''}
    </div>
    <div class="cart-body">
      ${state.cart.length ? rows : `
        <div class="cart-empty">
          <span class="cart-empty-mark" aria-hidden="true">🛍</span>
          <h3>Your cart is empty</h3>
          <p>Have a look through the collection — most pieces are one of a kind.</p>
          <button class="btn" type="button" data-close>Browse the collection</button>
        </div>`}
    </div>
    ${state.cart.length ? `
      <div class="cart-foot">
        <div class="mat"><span>Subtotal</span><b>${money(sum)}</b></div>
        <div class="mat"><span>Shipping</span><b>${free ? 'Free' : money(shipping)}</b></div>
        <div class="mat total"><span>Total</span><b>${money(sum + shipping)}</b></div>
        <a class="btn btn-wide" href="pages/checkout.html" id="toCheckout">Continue to checkout</a>
      </div>` : ''}`, '.cart-body');
}

$('#cartPanel').addEventListener('click', (e) => {
  const hit = e.target.closest('button');
  if (!hit) return;
  if (hit.hasAttribute('data-close')) return closeDialog($('#cart'));
  if (hit.dataset.d) {
    const line = state.cart[Number(hit.dataset.i)];
    if (!line) return;
    line.q += Number(hit.dataset.d);
    if (line.q < 1) state.cart.splice(Number(hit.dataset.i), 1);
    sync();
  }
});

function sync() {
  $('#cnt').textContent = itemCount(state);
  renderCart();
  saveState(state);
}

/* ── Events ────────────────────────────────────────────────── */

$('#openCart').addEventListener('click', () => { renderCart(); openDialog($('#cart')); });

$('#grid').addEventListener('click', (e) => {
  const card = e.target.closest('.card');
  if (card) return openProduct(card.dataset.id);
  if (e.target.id === 'resetFilters') {
    state.query = '';
    state.cat = 'All';
    $('#search').value = '';
    $('#searchWrap').classList.remove('has-value');
    renderCategories();
    renderGrid();
  }
});

$('#cats').addEventListener('click', (e) => {
  const btn = e.target.closest('.cat');
  if (!btn) return;
  state.cat = btn.dataset.cat;
  renderCategories();
  renderGrid();
  saveState(state);
});

let searchTimer;
$('#search').addEventListener('input', (e) => {
  state.query = e.target.value;
  $('#searchWrap').classList.toggle('has-value', !!state.query);
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { renderGrid(); saveState(state); }, 160);
});

$('#searchClear').addEventListener('click', () => {
  state.query = '';
  $('#search').value = '';
  $('#searchWrap').classList.remove('has-value');
  renderGrid();
  $('#search').focus();
});

$('#sort').addEventListener('change', (e) => {
  state.sort = e.target.value;
  renderGrid();
  saveState(state);
});

/* ── Custom order form ─────────────────────────────────────── */

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
function clearErrors(form) {
  form.querySelectorAll('.field-error').forEach((el) => { el.textContent = ''; });
  form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
}
const clean = (v, max = 400) => String(v || '').trim().replace(/[<>]/g, '').slice(0, max);

$('#req').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target;
  clearErrors(form);

  const name = clean($('#rn').value, 80);
  const contact = clean($('#re').value, 120);
  const brief = clean($('#rd').value, 600);
  let ok = true;

  if (!name) { fieldError($('#rn'), 'Please add your name.'); ok = false; }
  if (!contact) { fieldError($('#re'), 'Add an email or WhatsApp number so we can reply.'); ok = false; }
  if (!brief) { fieldError($('#rd'), 'Describe what you would like made.'); ok = false; }
  else if (brief.length < 12) { fieldError($('#rd'), 'A little more detail helps us quote accurately.'); ok = false; }

  if (!ok) { form.querySelector('[aria-invalid]')?.focus(); return; }

  const url = waLink(
    [`Custom crochet request`, ``, `Name: ${name}`, `Contact: ${contact}`,
     `Size: ${$('#rs').value}`, ``, `Brief: ${brief}`].join('\n')
  );

  const status = $('#reqStatus');
  status.innerHTML = `Thanks, ${esc(name)} — your brief is ready to send.
    <a class="btn" href="${url}" target="_blank" rel="noopener" style="margin-top:12px">Send it on WhatsApp</a>`;
  status.hidden = false;
  toast('Brief ready to send');
  form.reset();
});

/* ── Nav highlight ─────────────────────────────────────────── */

const sections = ['shop', 'custom', 'about'].map((id) => document.getElementById(id)).filter(Boolean);
if (sections.length && 'IntersectionObserver' in window) {
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      document.querySelectorAll('.nav a').forEach((a) => {
        a.setAttribute('aria-current', String(a.hash === `#${entry.target.id}`));
      });
    });
  }, {rootMargin: '-45% 0px -50% 0px'});
  sections.forEach((s) => spy.observe(s));
}

/* ── Boot ──────────────────────────────────────────────────── */

// Push the admin's shop settings into the page. Runs once with cached
// settings (no flash for returning visitors) and again with live ones.
function renderSettings() {
  const S = SETTINGS;
  const setText = (sel, value) => { const el = $(sel); if (el && value) el.textContent = value; };
  setText('#heroTitle', S.heroTitle);
  setText('#heroText', S.heroText);
  const img = $('#heroImg');
  if (img && S.heroImage && img.getAttribute('src') !== S.heroImage) img.src = S.heroImage;
  const cap = $('#heroCap');
  // Only touch the caption once real settings exist: an empty caption then
  // means the admin removed it, not that nothing has loaded yet.
  if (cap && settingsLoaded) {
    cap.hidden = !S.heroCaption;
    if (S.heroCaption) cap.lastElementChild.textContent = S.heroCaption;
  }
  if (S.ticker.length) {
    const once = S.ticker.map((t) => `<span>${esc(t)}</span>`).join('');
    $('#tickerTrack').innerHTML = once + once; // doubled for a seamless loop
  }
  document.querySelectorAll('[data-ship]').forEach((el) => { el.textContent = money(S.freeShippingFrom); });
  document.querySelectorAll('a[href^="https://wa.me/"]').forEach((a) => { a.href = waLink(); });

  // Brand name, announcement strip and accent colour are all admin-editable.
  document.querySelectorAll('[data-brand]').forEach((el) => { if (S.brandName) el.textContent = S.brandName; });
  if (S.brandName) {
    document.title = `${S.brandName} — Handmade crochet plushies, botanicals & charms`;
  }
  const bar = $('#announce');
  if (bar && settingsLoaded) {
    const on = !!S.announcement;
    bar.hidden = !on;
    if (on) bar.textContent = S.announcement;
  }
  if (S.accent && /^#[0-9a-f]{6}$/i.test(S.accent)) {
    document.documentElement.style.setProperty('--rose', S.accent);
  }
}

$('#yr').textContent = new Date().getFullYear();
$('#search').value = state.query || '';
$('#searchWrap').classList.toggle('has-value', !!state.query);
$('#sort').value = state.sort || 'feat';
renderSettings();

initCatalog().then(() => {
  renderSettings();
  $('#factCount').textContent = PRODUCTS.length || '—';
  renderCategories();
  renderGrid();
  sync();
}).catch(() => {
  $('#grid').innerHTML = `
    <div class="empty">
      <span class="empty-mark" aria-hidden="true">⚠</span>
      <h3>The collection didn't load</h3>
      <p>Check your connection and reload the page. If it keeps happening, message us and we'll sort it out.</p>
      <div class="empty-actions">
        <button class="btn" type="button" onclick="location.reload()">Reload the page</button>
        <a class="link-quiet" href="${waLink()}" target="_blank" rel="noopener">Message us</a>
      </div>
    </div>`;
  $('#grid').removeAttribute('aria-busy');
});

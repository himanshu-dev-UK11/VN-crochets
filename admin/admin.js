// ─────────────────────────────────────────────────────────────────────────────
// VN crochet — Studio desk
// Handles sign-in, the catalogue editor, shop appearance and orders.
// Talks to the same /api contract the Azure Functions serve, so the panel
// behaves identically on localhost and on the live site.
// ─────────────────────────────────────────────────────────────────────────────

const API = '/api';
const TOKEN_KEY = 'vnc.admin.token';
const CRED_KEY = 'vnc.admin.cred';

// ── Session ──────────────────────────────────────────────────────────────────
// "Remember me" keeps the token in localStorage so the browser can reopen the
// desk without a sign-in; otherwise it lives in sessionStorage and dies with
// the tab. Credentials are only stored when the maker ticks the box.

function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}
function setToken(token, persistent) {
  try {
    clearToken();
    (persistent ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
  } catch { /* private mode — the session still works without storage */ }
}
function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
}
// Only the username is kept by the page. The password is handed to the
// browser's own password manager (Chrome / Edge: Credential Management API;
// everyone else: the standard autocomplete prompt), which stores it encrypted.
function savedCred() {
  try { const raw = JSON.parse(localStorage.getItem(CRED_KEY) || 'null'); return raw && raw.username ? {username: raw.username} : null; } catch { return null; }
}
function saveCred(username, password) {
  try { localStorage.setItem(CRED_KEY, JSON.stringify({username})); } catch { /* ignore */ }
  try {
    if (window.PasswordCredential && navigator.credentials) {
      navigator.credentials.store(new window.PasswordCredential({id: username, password, name: 'VN crochet admin'})).catch(() => {});
    }
  } catch { /* browser without the API — autocomplete still offers to save */ }
}
function forgetCred() {
  try { localStorage.removeItem(CRED_KEY); } catch { /* ignore */ }
  try { navigator.credentials?.preventSilentAccess?.(); } catch { /* ignore */ }
}
async function browserCred() {
  try {
    if (!window.PasswordCredential || !navigator.credentials) return null;
    const c = await navigator.credentials.get({password: true, mediation: 'optional'});
    return c && c.id && c.password ? {username: c.id, password: c.password} : null;
  } catch { return null; }
}

// ── Small helpers ────────────────────────────────────────────────────────────
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const money = (n, symbol) => `${symbol || '₹'}${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const titleCase = (s) => String(s || '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function toast(message, kind = '') {
  let wrap = $('#toasts');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'toasts';
    wrap.className = 'toast-wrap';
    wrap.setAttribute('role', 'status');
    wrap.setAttribute('aria-live', 'polite');
    document.body.appendChild(wrap);
  }
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = `<span class="ic" aria-hidden="true">${kind === 'err' ? '!' : kind === 'ok' ? '✓' : 'i'}</span><span>${esc(message)}</span>`;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), kind === 'err' ? 6000 : 3200);
}

async function api(path, {method = 'GET', body, auth = true} = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store'
  });

  let data = null;
  const text = await res.text();
  if (text) { try { data = JSON.parse(text); } catch { data = {error: text.slice(0, 200)}; } }

  if (res.status === 401 && auth) {
    clearToken();
    showLogin('Your session has ended. Please sign in again.');
    throw new Error('Sign in again to continue.');
  }
  if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status}).`);
  return data;
}

// ── Sign-in ──────────────────────────────────────────────────────────────────
function showLogin(message = '') {
  const cred = savedCred();
  $('#app').innerHTML = `
    <div class="login-shell">
      <section class="login-card">
        <div class="login-brand">
          <span class="login-mark" aria-hidden="true">🧶</span>
          <div><strong class="js-brand">VN crochet</strong><small>Studio desk</small></div>
        </div>
        <h1>Sign in</h1>
        <p class="login-sub">Your shop, your shelf. Everything you publish here goes live on the storefront.</p>
        <p class="login-error" id="loginErr" role="alert"${message ? '' : ' hidden'}>${esc(message)}</p>
        <form id="loginForm" autocomplete="on">
          <label>
            <span>Username</span>
            <input id="loginUser" name="username" type="text" autocomplete="username"
                   autocapitalize="none" spellcheck="false" required placeholder="your username"
                   value="${cred ? esc(cred.username) : ''}">
          </label>
          <label>
            <span>Password</span>
            <span class="pass-wrap">
              <input id="loginPass" name="password" type="password" autocomplete="current-password"
                     required placeholder="your password">
              <button type="button" class="pass-toggle" id="passToggle" aria-label="Show password" aria-pressed="false">Show</button>
            </span>
          </label>
          <label class="check remember">
            <input id="loginRemember" type="checkbox" checked>
            <span>Remember me on this device</span>
          </label>
          <button type="submit" id="loginBtn" class="primary wide">Sign in</button>
        </form>
        <p class="login-note" id="loginNote" hidden></p>
      </section>
    </div>`;

  const form = $('#loginForm');
  const errEl = $('#loginErr');
  const noteEl = $('#loginNote');
  const passEl = $('#loginPass');

  // Auto-fill is on the house: when a previous sign-in was saved, signing in
  // is one click. Browsers with their own password manager still work too.
  // Ask the browser for the saved password and fill both boxes when it has one.
  browserCred().then((c) => {
    if (!c) return;
    const user = $('#loginUser');
    if (user && !user.value) user.value = c.username;
    if (passEl && !passEl.value) passEl.value = c.password;
    noteEl.hidden = false;
    noteEl.textContent = 'Signed-in details filled from your browser — just press Sign in.';
    $('#loginBtn')?.focus();
  });

  const toggle = $('#passToggle');
  toggle.addEventListener('click', () => {
    const show = passEl.type === 'password';
    passEl.type = show ? 'text' : 'password';
    toggle.textContent = show ? 'Hide' : 'Show';
    toggle.setAttribute('aria-pressed', String(show));
    toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    passEl.focus();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#loginBtn');
    const remember = $('#loginRemember').checked;
    const username = $('#loginUser').value.trim();
    const password = passEl.value;

    errEl.hidden = true;
    noteEl.hidden = true;
    btn.disabled = true;
    btn.textContent = 'Signing in…';

    try {
      const res = await fetch(`${API}/login`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({username, password, remember})
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'That username and password don’t match.');

      setToken(data.token, remember);
      if (remember) saveCred(username, password); else forgetCred();
      boot();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.hidden = false;
      btn.disabled = false;
      btn.textContent = 'Sign in';
      passEl.focus();
      passEl.select();
    }
  });

  setTimeout(() => (cred ? passEl : $('#loginUser')).focus(), 60);
}

// ── Store ────────────────────────────────────────────────────────────────────
// Single source of truth for the panel: products, settings and the etag the
// server uses to detect two tabs editing at once.

const store = {
  products: [],
  settings: null,
  etag: null,
  orders: [],
  reachable: true,
  notice: ''
};

const SETTINGS_DEFAULTS = {
  brandName: 'VN crochet',
  tagline: 'Studio desk',
  currency: '₹',
  heroTitle: '',
  heroText: '',
  heroImage: '',
  heroCaption: '',
  ticker: [],
  announcement: '',
  freeShippingFrom: 1500,
  shippingFee: 199,
  whatsapp: '918923646175',
  instagram: '',
  accent: '#b2485f',
  ribbonColors: ['#fffdf7', '#f7a1b8', '#a9b8f0', '#ffc94d'],
  ribbonNames: ['Cream', 'Pink', 'Periwinkle', 'Gold'],
  categories: [{name: 'Plush', icon: '●'}, {name: 'Botanical', icon: '✿'}, {name: 'Little gifts', icon: '♡'}, {name: 'Keychains', icon: '⌁'}]
};

function settings() {
  if (!store.settings) store.settings = structuredClone(SETTINGS_DEFAULTS);
  const s = store.settings;
  for (const key of Object.keys(SETTINGS_DEFAULTS)) {
    if (s[key] === undefined || s[key] === null) s[key] = structuredClone(SETTINGS_DEFAULTS[key]);
  }
  if (!Array.isArray(s.categories) || !s.categories.length) s.categories = structuredClone(SETTINGS_DEFAULTS.categories);
  if (!Array.isArray(s.ribbonColors) || !s.ribbonColors.length) s.ribbonColors = [...SETTINGS_DEFAULTS.ribbonColors];
  if (!Array.isArray(s.ribbonNames) || !s.ribbonNames.length) s.ribbonNames = [...SETTINGS_DEFAULTS.ribbonNames];
  return s;
}

async function loadStore() {
  store.notice = '';
  try {
    const data = await api('/catalog?all=1');
    store.products = Array.isArray(data.products) ? data.products : [];
    store.settings = data.settings || null;
    store.etag = data.etag || null;
    store.reachable = true;

    // First run on a fresh deployment: seed the desk from the catalogue that
    // ships with the site, so the maker edits real products instead of nothing.
    if (!store.products.length && !store.settings) {
      try {
        const seedRes = await fetch('../data/catalog.json', {cache: 'no-store'});
        if (seedRes.ok) {
          const seed = await seedRes.json();
          const list = Array.isArray(seed) ? seed : seed.products;
          if (Array.isArray(list) && list.length) {
            store.products = list;
            store.notice = 'Loaded the starter catalogue. Press “Publish to shop” to put it live.';
          }
        }
      } catch { /* no starter file — fine */ }
    }
  } catch (err) {
    if (err.message === 'Sign in again to continue.') throw err;
    store.reachable = false;
    store.products = [];
    store.settings = null;
    store.etag = null;
    store.notice = err.message;
  }
}

async function saveStore(successMessage) {
  const payload = {products: store.products, settings: settings(), etag: store.etag};
  try {
    const data = await api('/catalog', {method: 'POST', body: payload});
    store.products = Array.isArray(data.products) ? data.products : store.products;
    store.settings = data.settings || store.settings;
    store.etag = data.etag || store.etag;
    store.reachable = true;
    store.notice = '';
    if (successMessage) toast(successMessage, 'ok');
    return true;
  } catch (err) {
    if (err.message.startsWith('The shop was changed')) {
      toast('Another tab saved changes. Reloading the latest version…', 'err');
      await loadStore();
      renderNav();
      renderView();
      return false;
    }
    toast(err.message, 'err');
    throw err;
  }
}

// ── Shell ────────────────────────────────────────────────────────────────────
let view = 'overview';
let filter = {q: '', status: 'all'};
let editing = null; // product object being edited, or a blank draft

function navButton(id, icon, label, count) {
  return `<button class="nav-btn" data-go="${id}" aria-current="${view === id ? 'page' : 'false'}">
    <span class="ico" aria-hidden="true">${icon}</span>${label}${count ? `<span class="pill">${count}</span>` : ''}
  </button>`;
}

function renderNav() {
  const nav = $('#nav');
  if (!nav) return;
  const live = store.products.filter((p) => p.active !== false).length;
  const drafts = store.products.length - live;
  nav.innerHTML = [
    navButton('overview', '◈', 'Overview'),
    navButton('products', '▦', 'Products', store.products.length),
    navButton('appearance', '✿', 'Shop appearance'),
    navButton('orders', '⚑', 'Orders', store.orders.filter((o) => o.status === 'new').length)
  ].join('');
  $$('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));

  const stateEl = $('#connState');
  if (stateEl) {
    const dot = $('#connDot');
    const live2 = store.reachable;
    dot.className = `dot ${live2 ? 'live' : 'off'}`;
    stateEl.lastChild.textContent = live2 ? (drafts ? `${live} live · ${drafts} draft` : `${live} live`) : 'Needs attention';
  }
}

function shell() {
  $('#app').innerHTML = `
    <div class="desk">
      <aside class="side" id="side">
        <div class="side-brand">
          <span class="side-mark" aria-hidden="true">🧶</span>
          <div><strong class="js-brand">${esc(settings().brandName || 'VN crochet')}</strong><small>Studio desk</small></div>
        </div>
        <nav class="nav" id="nav" aria-label="Studio sections"></nav>
        <div class="side-foot">
          <div class="side-state" id="connState"><span class="dot" id="connDot"></span><span>Connecting…</span></div>
          <a class="side-link" href="../index.html" target="_blank" rel="noopener"><span aria-hidden="true">↗</span>View shop</a>
          <button class="side-link" id="signOutBtn" type="button"><span aria-hidden="true">⏻</span>Sign out</button>
        </div>
      </aside>
      <div class="main">
        <header class="topbar">
          <button class="ghost menu-btn" id="menuBtn" type="button" aria-label="Open menu">☰</button>
          <h1 id="viewTitle">Overview<span class="sub" id="viewSub"></span></h1>
          <button class="ghost" id="reloadBtn" type="button">Reload</button>
          <button class="primary" id="quickAdd" type="button">+ New product</button>
        </header>
        <div class="view" id="view"></div>
      </div>
    </div>`;

  $('#signOutBtn').addEventListener('click', () => {
    clearToken();
    store.products = [];
    store.settings = null;
    store.etag = null;
    showLogin('Signed out.');
  });
  $('#reloadBtn').addEventListener('click', async () => {
    await loadStore();
    renderNav();
    renderView();
    toast('Reloaded from the live shop.', 'ok');
  });
  $('#quickAdd').addEventListener('click', () => { editing = blankProduct(); go('editor'); });
  $('#menuBtn').addEventListener('click', () => {
    const side = $('#side');
    side.classList.toggle('open');
    if (side.classList.contains('open')) {
      const scrim = document.createElement('button');
      scrim.className = 'scrim';
      scrim.type = 'button';
      scrim.setAttribute('aria-label', 'Close menu');
      scrim.addEventListener('click', () => { side.classList.remove('open'); scrim.remove(); });
      document.body.appendChild(scrim);
      side.dataset.scrim = '1';
    } else {
      $('.scrim')?.remove();
    }
  });

  renderNav();
}

const VIEW_TITLES = {
  overview: ['Overview', 'How the shop is doing right now'],
  products: ['Products', 'Everything on your shelf'],
  editor: ['Product editor', 'Changes save straight to the live shop'],
  appearance: ['Shop appearance', 'Hero, colours and delivery — no code needed'],
  orders: ['Orders', 'Everything customers have sent']
};

function go(next) {
  view = next;
  $('#side')?.classList.remove('open');
  $('.scrim')?.remove();
  renderNav();
  renderView();
  window.scrollTo({top: 0, behavior: 'smooth'});
}

function renderView() {
  const [title, sub] = VIEW_TITLES[view] || VIEW_TITLES.overview;
  $('#viewTitle').childNodes[0].textContent = title;
  $('#viewSub').textContent = sub;
  const host = $('#view');
  if (!host) return;
  host.innerHTML = '';
  if (!store.reachable && view !== 'appearance' && !store.products.length) {
    host.innerHTML = `
      <div class="card"><div class="empty">
        <span class="mark" aria-hidden="true">⚠</span>
        <h3>The desk can’t reach the shop yet</h3>
        <p>${esc(store.notice || 'The server did not answer.')}</p>
        <p class="section-note">If this is the live site, add <b>STORAGE_CONNECTION_STRING</b>, <b>ADMIN_USERNAME</b>, <b>ADMIN_PASSWORD</b> and <b>JWT_SECRET</b> in Azure → Configuration, then reload.</p>
        <button class="primary" id="retryBtn" type="button">Try again</button>
      </div></div>`;
    $('#retryBtn').addEventListener('click', async () => {
      await loadStore(); renderNav(); renderView();
    });
    return;
  }
  ({overview: viewOverview, products: viewProducts, editor: viewEditor, appearance: viewAppearance, orders: viewOrders}[view] || viewOverview)(host);
}

// ── Overview ─────────────────────────────────────────────────────────────────
function viewOverview(host) {
  const live = store.products.filter((p) => p.active !== false);
  const drafts = store.products.length - live;
  const outOfStock = live.filter((p) => Number(p.stock) <= 0);
  const value = live.reduce((sum, p) => sum + Number(p.p || 0) * Math.max(0, Number(p.stock) || 0), 0);
  const recent = [...live].slice(-6).reverse();
  const s = settings();

  host.innerHTML = `
    ${store.notice ? `<div class="card"><div class="card-body"><p class="status err">${esc(store.notice)}</p></div></div>` : ''}
    <div class="stats">
      <div class="stat"><b>${live.length}</b><span>Live on the shop</span></div>
      <div class="stat ${drafts ? 'warn' : ''}"><b>${drafts}</b><span>Drafts</span></div>
      <div class="stat ${outOfStock.length ? 'bad' : ''}"><b>${outOfStock.length}</b><span>Out of stock</span></div>
      <div class="stat"><b>${money(value, s.currency)}</b><span>Shelf value</span></div>
    </div>

    <div class="card">
      <div class="card-head"><div class="grow"><h2>Quick actions</h2><p>The three things makers do most.</p></div></div>
      <div class="card-body" style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="primary" id="ovAdd" type="button">+ New product</button>
        <button class="ghost" id="ovAppearance" type="button">Edit hero & colours</button>
        <button class="ghost" id="ovPublish" type="button">Publish to shop</button>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <div class="grow"><h2>Newest on the shelf</h2><p>Most recently added pieces.</p></div>
        <button class="ghost small" id="ovAll" type="button">View all</button>
      </div>
      <div class="card-body tight">
        ${recent.length ? `<div class="list">${recent.map(productRow).join('')}</div>` : `
          <div class="empty"><span class="mark" aria-hidden="true">▦</span><h3>Nothing published yet</h3>
          <p>Add your first piece and it will appear on the shop the moment you save.</p></div>`}
      </div>
    </div>`;

  $('#ovAdd').addEventListener('click', () => { editing = blankProduct(); go('editor'); });
  $('#ovAppearance').addEventListener('click', () => go('appearance'));
  $('#ovAll').addEventListener('click', () => go('products'));
  $('#ovPublish').addEventListener('click', async (e) => {
    e.target.disabled = true;
    try { await saveStore('Your shelf is live on the shop.'); }
    finally { e.target.disabled = false; }
  });
  wireRows(host);
}

function productRow(p) {
  const img = p.image
    ? `<img src="${esc(p.image)}" alt="" loading="lazy">`
    : esc(p.e || '🧶');
  const status = p.active === false ? '<span class="badge draft">Draft</span>' : '<span class="badge live">Live</span>';
  const stock = Number(p.stock) || 0;
  const stockBadge = stock <= 0 ? '<span class="badge out">Out of stock</span>'
    : stock <= 2 ? `<span class="badge">${stock} left</span>` : '';
  return `<div class="row click" data-open="${esc(p.id)}">
    <div class="thumb">${img}</div>
    <div class="row-main">
      <h3>${esc(p.n)}</h3>
      <div class="row-meta">${esc(p.c || 'Uncategorised')} · ${money(p.p, settings().currency)} ${status}${p.featured ? '<span class="badge feat">Featured</span>' : ''}${stockBadge}</div>
    </div>
    <div class="row-actions">
      <button class="ghost small" data-edit="${esc(p.id)}" type="button">Edit</button>
      <button class="ghost small" data-toggle="${esc(p.id)}" type="button">${p.active === false ? 'Publish' : 'Hide'}</button>
    </div>
  </div>`;
}

function wireRows(root) {
  $$('[data-edit]', root).forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    openEditor(b.dataset.edit);
  }));
  $$('[data-toggle]', root).forEach((b) => b.addEventListener('click', async (e) => {
    e.stopPropagation();
    const p = store.products.find((x) => String(x.id) === String(b.dataset.toggle));
    if (!p) return;
    p.active = p.active === false;
    try {
      await saveStore(`${p.n} is now ${p.active ? 'live on the shop' : 'hidden from the shop'}.`);
      renderNav(); renderView();
    } catch { p.active = !p.active; }
  }));
  $$('[data-open]', root).forEach((r) => r.addEventListener('click', () => openEditor(r.dataset.open)));
}

// ── Products ─────────────────────────────────────────────────────────────────
function viewProducts(host) {
  host.innerHTML = `
    <div class="card">
      <div class="toolbar">
        <div class="search"><input id="pSearch" type="search" placeholder="Search by name or collection…" value="${esc(filter.q)}" aria-label="Search products"></div>
        <div class="seg" role="group" aria-label="Filter by status">
          <button data-status="all" aria-pressed="${filter.status === 'all'}">All</button>
          <button data-status="live" aria-pressed="${filter.status === 'live'}">Live</button>
          <button data-status="draft" aria-pressed="${filter.status === 'draft'}">Drafts</button>
          <button data-status="out" aria-pressed="${filter.status === 'out'}">Out</button>
        </div>
        <button class="primary" id="pNew" type="button">+ New product</button>
      </div>
      <div class="card-body tight" id="pList"></div>
    </div>`;

  const paint = () => {
    const q = filter.q.trim().toLowerCase();
    const list = store.products.filter((p) => {
      if (filter.status === 'live' && p.active === false) return false;
      if (filter.status === 'draft' && p.active !== false) return false;
      if (filter.status === 'out' && Number(p.stock) > 0) return false;
      if (!q) return true;
      return `${p.n} ${p.c} ${p.d} ${p.s}`.toLowerCase().includes(q);
    });
    $('#pList').innerHTML = list.length
      ? `<div class="list">${list.map(productRow).join('')}</div>`
      : `<div class="empty"><span class="mark" aria-hidden="true">⌕</span><h3>Nothing matches</h3>
         <p>Try another word, or clear the filters to see every piece.</p>
         <button class="ghost" id="clearFilters" type="button">Clear filters</button></div>`;
    wireRows($('#pList'));
    $('#clearFilters')?.addEventListener('click', () => { filter = {q: '', status: 'all'}; viewProducts(host); });
  };

  paint();
  $('#pSearch').addEventListener('input', debounce((e) => { filter.q = e.target.value; paint(); }, 140));
  $$('[data-status]').forEach((b) => b.addEventListener('click', () => {
    filter.status = b.dataset.status;
    $$('[data-status]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    paint();
  }));
  $('#pNew').addEventListener('click', () => { editing = blankProduct(); go('editor'); });
}

// ── Product editor ───────────────────────────────────────────────────────────
function blankProduct() {
  return {
    id: 0, n: '', e: '🧶', c: settings().categories[0]?.name || 'Plush', p: 0, lv: 1,
    bg: '#f5eadf', s: '', m: [], d: '', care: '', stock: 1,
    featured: false, active: true, image: '', imageX: 50, imageY: 50, imageZoom: 100,
    ribbons: settings().ribbonColors.map((_, i) => i)
  };
}

function openEditor(id) {
  const found = store.products.find((p) => String(p.id) === String(id));
  editing = found ? structuredClone(found) : blankProduct();
  go('editor');
}

const editorState = {pendingImage: null, draft: null};

function viewEditor(host) {
  const p = editing || (editing = blankProduct());
  const s = settings();
  const isNew = !p.id;
  delete editorState.pendingImage;

  host.innerHTML = `
    <div class="card">
      <div class="card-head">
        <div class="grow">
          <h2>${isNew ? 'New product' : esc(p.n || 'Product')}</h2>
          <p>${isNew ? 'Fill in the details — it appears on the shop as soon as you save.' : 'Edit anything and save to update the live shop.'}</p>
        </div>
        <button class="ghost small" id="backBtn" type="button">← All products</button>
      </div>
      <div class="card-body" style="display:grid;grid-template-columns:minmax(0,1fr) 250px;gap:24px;align-items:start" id="editorGrid">
        <form class="form" id="pForm" novalidate>
          <fieldset>
            <legend>Basics</legend>
            <div class="grid-2">
              <label>Product name
                <input id="fName" type="text" required maxlength="80" value="${esc(p.n)}" placeholder="Moss the Mushroom" autocomplete="off">
              </label>
              <label>Collection
                <select id="fCat">
                  ${s.categories.map((c) => `<option value="${esc(c.name)}"${c.name === p.c ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}
                  ${s.categories.some((c) => c.name === p.c) ? '' : `<option value="${esc(p.c)}" selected>${esc(p.c || 'Uncategorised')}</option>`}
                </select>
                <span class="field-hint">Manage collections in Shop appearance.</span>
              </label>
            </div>
            <div class="grid-3">
              <label>Price (${esc(s.currency)})
                <input id="fPrice" type="number" min="0" step="1" required value="${Number(p.p) || ''}" placeholder="599">
              </label>
              <label>Stock
                <input id="fStock" type="number" min="0" step="1" value="${Number(p.stock) || 0}">
              </label>
              <label>Size
                <input id="fSize" type="text" maxlength="40" value="${esc(p.s)}" placeholder="12 cm">
              </label>
            </div>
            <label>Short description
              <textarea id="fDesc" rows="3" maxlength="1200" placeholder="A soft little companion for a quiet desk corner.">${esc(p.d)}</textarea>
            </label>
          </fieldset>

          <fieldset>
            <legend>Photo</legend>
            <div class="uploader">
              <div class="drop${p.image ? ' has-image' : ''}" id="drop" role="button" tabindex="0" aria-label="Choose a product photo">
                ${p.image
                  ? `<img class="preview" id="dropImg" src="${esc(p.image)}" alt="">`
                  : `<div class="drop-inner"><span class="drop-icon" aria-hidden="true">🖼️</span>
                     <span class="drop-text">Click or drop a photo here</span>
                     <span class="drop-sub">JPG, PNG or WebP · up to 4 MB</span></div>`}
                ${p.image ? `<div class="thumb-bar"><span id="fileName">${esc(p.image.startsWith('data:') ? 'New photo' : p.image.split('/').pop())}</span>
                   <button type="button" id="clearImg" aria-label="Remove photo">✕</button></div>` : ''}
              </div>
              <div class="focus-edit" id="focusEdit"${p.image ? '' : ' hidden'}>
                <div class="focus-stage" id="focusStage" role="application" aria-label="Drag to reposition the photo"></div>
                <div class="focus-controls">
                  <div class="slider">
                    <label for="fZoom"><span>Zoom</span><b id="zoomOut">${Number(p.imageZoom) || 100}%</b></label>
                    <input id="fZoom" type="range" min="100" max="250" step="5" value="${Number(p.imageZoom) || 100}">
                  </div>
                  <span class="field-hint">Drag the photo to choose what shows on the shop card. Resets with the button.</span>
                  <button class="ghost small" id="resetFocus" type="button">Centre & reset zoom</button>
                </div>
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend>Details</legend>
            <div class="grid-2">
              <label>Care note
                <input id="fCare" type="text" maxlength="400" value="${esc(p.care)}" placeholder="Spot clean gently">
              </label>
              <label>Emoji (used when there is no photo)
                <input id="fEmoji" type="text" maxlength="4" value="${esc(p.e)}" placeholder="🧶">
              </label>
            </div>
            <label>Materials <span class="field-hint">one per line — material | amount</span>
              <textarea id="fMats" rows="3" placeholder="Cotton yarn | 2 skeins&#10;Poly fill | 30 g">${esc((p.m || []).map((m) => m.join(' | ')).join('\n'))}</textarea>
            </label>
            <label>Card colour <span class="field-hint">the tint behind the photo</span>
              <span style="display:flex;gap:10px;align-items:center">
                <input id="fBg" type="color" value="${esc(p.bg || '#f5eadf')}" style="flex:none">
                <input id="fBgHex" type="text" maxlength="7" value="${esc(p.bg || '#f5eadf')}" style="max-width:120px">
              </span>
            </label>
          </fieldset>

          <fieldset>
            <legend>Ribbon colours this piece offers</legend>
            <p class="fieldset-sub">Tick the ones customers may choose. Leave all off to hide the ribbon picker for this piece.</p>
            <div class="checks" id="fRibbons">
              ${s.ribbonColors.map((colour, i) => `
                <label class="check"><input type="checkbox" data-ribbon="${i}" ${(p.ribbons || []).includes(i) ? 'checked' : ''}>
                  <span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${esc(colour)};border:1px solid rgba(0,0,0,.15)"></span>
                  ${esc(s.ribbonNames[i] || `Colour ${i + 1}`)}
                </label>`).join('')}
            </div>
          </fieldset>

          <fieldset>
            <legend>Visibility</legend>
            <div class="checks">
              <label class="check"><input id="fActive" type="checkbox" ${p.active !== false ? 'checked' : ''}> Published on the shop</label>
              <label class="check"><input id="fFeatured" type="checkbox" ${p.featured ? 'checked' : ''}> Feature at the top</label>
            </div>
          </fieldset>

          <div class="form-foot">
            <button class="primary" id="saveBtn" type="submit">${isNew ? 'Publish to shop' : 'Save changes'}</button>
            <button class="ghost" id="cancelBtn" type="button">Cancel</button>
            <span class="spacer"></span>
            ${isNew ? '' : '<button class="ghost danger" id="deleteBtn" type="button">Delete</button>'}
            <p class="status" id="saveStatus" role="status"></p>
          </div>
        </form>

        <aside class="side-preview">
          <span class="cap">Live card preview</span>
          <div class="mini-card" id="miniCard"></div>
          <p class="field-hint">This is how the piece looks in the shop grid.</p>
        </aside>
      </div>
    </div>`;

  // Responsive: the preview column collapses on narrow screens.
  if (window.matchMedia('(max-width: 1000px)').matches) {
    $('#editorGrid').style.gridTemplateColumns = '1fr';
    $('#editorGrid').lastElementChild.hidden = false;
  }

  const state = () => {
    const mats = $('#fMats').value.split('\n')
      .map((line) => line.split('|').map((x) => x.trim()))
      .filter((m) => m.length === 2 && m[0])
      .slice(0, 12);
    return {
      ...p,
      id: Number(p.id) || 0,
      n: $('#fName').value.trim(),
      c: $('#fCat').value,
      p: Math.max(0, Math.round(Number($('#fPrice').value) || 0)),
      stock: Math.max(0, Math.round(Number($('#fStock').value) || 0)),
      s: $('#fSize').value.trim(),
      d: $('#fDesc').value.trim(),
      care: $('#fCare').value.trim(),
      e: $('#fEmoji').value.trim(),
      bg: /^#[0-9a-f]{6}$/i.test($('#fBgHex').value) ? $('#fBgHex').value : p.bg || '#f5eadf',
      m: mats,
      featured: $('#fFeatured').checked,
      active: $('#fActive').checked,
      ribbons: $$('[data-ribbon]').filter((cb) => cb.checked).map((cb) => Number(cb.dataset.ribbon)),
      imageX: Number(p.imageX) || 50,
      imageY: Number(p.imageY) || 50,
      imageZoom: Number(p.imageZoom) || 100
    };
  };

  const paintMini = () => {
    const d = state();
    const art = d.image
      ? `<div class="mini-art" style="background-color:${esc(d.bg)};background-image:url('${esc(d.image)}');background-position:${d.imageX}% ${d.imageY}%;background-size:${d.imageZoom}%"></div>`
      : `<div class="mini-art" style="background-color:${esc(d.bg)}">${esc(d.e || '🧶')}</div>`;
    $('#miniCard').innerHTML = `${art}
      <div class="mini-body">
        <div class="mini-meta"><span>${esc(d.c || 'Collection')}</span><span class="mini-price">${money(d.p, s.currency)}</span></div>
        <h3>${esc(d.n || 'Your product name')}</h3>
        <div class="mini-meta"><span>${esc(d.s || 'Add a size')}</span><span>${d.stock > 0 ? `${d.stock} in stock` : 'Made to order'}</span></div>
      </div>`;
    paintStage();
  };

  // ── Photo focus stage ──────────────────────────────────────────────────────
  const paintStage = () => {
    const stage = $('#focusStage');
    if (!stage || !p.image) return;
    stage.style.backgroundImage = `url('${p.image}')`;
    stage.style.backgroundPosition = `${Number(p.imageX) || 50}% ${Number(p.imageY) || 50}%`;
    stage.style.backgroundSize = `${Number(p.imageZoom) || 100}%`;
  };

  if (p.image) {
    paintStage();
    let dragging = false;
    let sx = 0, sy = 0, px = 50, py = 50;
    const stage = $('#focusStage');
    const start = (x, y) => { dragging = true; sx = x; sy = y; px = Number(p.imageX) || 50; py = Number(p.imageY) || 50; };
    const move = (x, y) => {
      if (!dragging) return;
      const box = stage.getBoundingClientRect();
      p.imageX = Math.max(0, Math.min(100, px - ((x - sx) / box.width) * 100));
      p.imageY = Math.max(0, Math.min(100, py - ((y - sy) / box.height) * 100));
      paintStage();
    };
    const end = () => { dragging = false; paintMini(); };
    stage.addEventListener('pointerdown', (e) => { e.preventDefault(); stage.setPointerCapture(e.pointerId); start(e.clientX, e.clientY); });
    stage.addEventListener('pointermove', (e) => move(e.clientX, e.clientY));
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);

    $('#fZoom').addEventListener('input', (e) => {
      p.imageZoom = Number(e.target.value);
      $('#zoomOut').textContent = `${p.imageZoom}%`;
      paintStage();
      paintMini();
    });
    $('#resetFocus').addEventListener('click', () => {
      p.imageX = 50; p.imageY = 50; p.imageZoom = 100;
      $('#fZoom').value = 100; $('#zoomOut').textContent = '100%';
      paintStage(); paintMini();
    });
  }

  // ── Photo picker ───────────────────────────────────────────────────────────
  const drop = $('#drop');
  const pick = () => $('#fileInput')?.click() ?? (() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.id = 'fileInput';
    input.accept = 'image/png,image/jpeg,image/webp';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', () => takeFile(input.files?.[0]));
    input.click();
  })();

  function takeFile(file) {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      toast('Use a JPG, PNG or WebP photo.', 'err');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast('That photo is larger than 4 MB. Try a smaller one.', 'err');
      return;
    }
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      editorState.pendingImage = file;
      p.image = String(reader.result);
      p.imageX = 50; p.imageY = 50; p.imageZoom = 100;
      viewEditor(host);
      $('#saveStatus').textContent = 'Photo ready — save to upload it.';
    });
    reader.readAsDataURL(file);
  }

  drop.addEventListener('click', (e) => { if (e.target.id !== 'clearImg') pick(); });
  drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('drag'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('drag'); takeFile(e.dataTransfer.files?.[0]); });
  $('#clearImg')?.addEventListener('click', (e) => {
    e.stopPropagation();
    p.image = ''; editorState.pendingImage = null;
    viewEditor(host);
  });

  // Card colour: keep the picker and the hex box in step.
  $('#fBg').addEventListener('input', (e) => { $('#fBgHex').value = e.target.value; paintMini(); });
  $('#fBgHex').addEventListener('input', (e) => {
    if (/^#[0-9a-f]{6}$/i.test(e.target.value)) { $('#fBg').value = e.target.value; paintMini(); }
  });

  $('#pForm').addEventListener('input', debounce(paintMini, 90));
  paintMini();

  $('#backBtn').addEventListener('click', () => go('products'));
  $('#cancelBtn').addEventListener('click', () => go('products'));

  // ── Save ───────────────────────────────────────────────────────────────────
  $('#pForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = $('#saveStatus');
    const draft = state();

    if (!draft.n) { status.className = 'status err'; status.textContent = 'Give the product a name first.'; $('#fName').focus(); return; }
    if (!draft.p && draft.p !== 0) { status.textContent = 'Add a price.'; $('#fPrice').focus(); return; }
    if (!(Number($('#fPrice').value) >= 0) || $('#fPrice').value === '') {
      status.className = 'status err'; status.textContent = 'Add a price (a number, 0 or more).'; $('#fPrice').focus(); return;
    }

    const btn = $('#saveBtn');
    btn.disabled = true;
    const original = btn.textContent;
    status.className = 'status';
    status.textContent = 'Saving…';

    try {
      // Upload the photo first when a new file was chosen; if the upload can't
      // run, the data URL is sent along and the server stores it instead.
      if (editorState.pendingImage) {
        status.textContent = 'Uploading photo…';
        try {
          const file = editorState.pendingImage;
          const dataUrl = await new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result));
            r.onerror = reject;
            r.readAsDataURL(file);
          });
          const up = await api('/upload', {method: 'POST', body: {data: dataUrl}});
          if (up && up.url) draft.image = up.url;
        } catch (err) {
          status.textContent = 'Photo will be stored on save…';
        }
      }

      const idx = store.products.findIndex((x) => String(x.id) === String(draft.id) && draft.id);
      if (idx >= 0) store.products[idx] = draft;
      else store.products.push({...draft, id: 0});

      await saveStore(idx >= 0 ? 'Changes saved — the shop is updated.' : 'Product published to the shop.');
      editorState.pendingImage = null;
      editing = structuredClone(store.products.find((x) => x.n === draft.n && x.p === draft.p) || draft);
      go('products');
    } catch (err) {
      status.className = 'status err';
      status.textContent = err.message;
      btn.disabled = false;
      btn.textContent = original;
    }
  });

  // ── Delete ─────────────────────────────────────────────────────────────────
  $('#deleteBtn')?.addEventListener('click', async () => {
    if (!confirm(`Delete “${p.n}”? This can’t be undone.`)) return;
    const btn = $('#deleteBtn');
    btn.disabled = true;
    try {
      store.products = store.products.filter((x) => String(x.id) !== String(p.id));
      await saveStore('Product deleted.');
      go('products');
    } catch {
      btn.disabled = false;
    }
  });
}

// ── Shop appearance ──────────────────────────────────────────────────────────
function viewAppearance(host) {
  const s = settings();
  let accents = s.ribbonColors.slice();
  let names = s.ribbonNames.slice();
  let cats = s.categories.map((c) => ({...c}));
  let ticker = s.ticker.slice();

  host.innerHTML = `
    <form class="form" id="appForm" novalidate>
      <div class="card">
        <div class="card-head"><div class="grow"><h2>Brand</h2><p>What the shop calls itself.</p></div></div>
        <div class="card-body form">
          <div class="grid-2">
            <label>Shop name
              <input id="aBrand" type="text" maxlength="30" value="${esc(s.brandName)}">
            </label>
            <label>Currency symbol
              <input id="aCurrency" type="text" maxlength="3" value="${esc(s.currency)}">
            </label>
          </div>
          <label>Announcement strip <span class="field-hint">shows as a coloured bar at the very top — leave empty to hide</span>
            <input id="aAnnounce" type="text" maxlength="120" value="${esc(s.announcement)}" placeholder="Free shipping on orders over ₹1,500">
          </label>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><div class="grow"><h2>Homepage hero</h2><p>The first thing visitors read.</p></div></div>
        <div class="card-body form">
          <label>Headline
            <input id="aHeroTitle" type="text" maxlength="90" value="${esc(s.heroTitle)}">
          </label>
          <label>Intro text
            <textarea id="aHeroText" rows="3" maxlength="320">${esc(s.heroText)}</textarea>
          </label>
          <div class="grid-2">
            <label>Photo URL
              <input id="aHeroImage" type="text" maxlength="300" value="${esc(s.heroImage)}" placeholder="/images/product-sample.webp">
            </label>
            <label>Caption under the photo
              <input id="aHeroCaption" type="text" maxlength="60" value="${esc(s.heroCaption)}">
            </label>
          </div>
          <p class="field-hint">Use a path from the site, e.g. /images/product-sample.webp — or upload photos in a product and paste that URL here.</p>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><div class="grow"><h2>Ticker</h2><p>The scrolling strip of small promises.</p></div></div>
        <div class="card-body form">
          <div class="repeat-list" id="tickerList"></div>
          <div><button class="ghost small" id="addTicker" type="button">+ Add a line</button></div>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><div class="grow"><h2>Colours</h2><p>Accent colour and the ribbon options customers can pick.</p></div></div>
        <div class="card-body form">
          <label>Accent colour <span class="field-hint">buttons, links and highlights</span>
            <span style="display:flex;gap:10px;align-items:center">
              <input id="aAccent" type="color" value="${esc(s.accent)}" style="flex:none">
              <input id="aAccentHex" type="text" maxlength="7" value="${esc(s.accent)}" style="max-width:120px">
            </span>
          </label>
          <div class="repeat-list" id="ribbonList"></div>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><div class="grow"><h2>Collections</h2><p>The categories shown as filters above the shop grid.</p></div></div>
        <div class="card-body form">
          <div class="repeat-list" id="catList"></div>
          <div><button class="ghost small" id="addCat" type="button">+ Add a collection</button></div>
          <p class="field-hint">Renaming a collection here does not move products; edit a product to change its collection.</p>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><div class="grow"><h2>Delivery & contact</h2><p>Used in the cart, checkout and every message button.</p></div></div>
        <div class="card-body form">
          <div class="grid-3">
            <label>Free shipping from (${esc(s.currency)})
              <input id="aFree" type="number" min="0" step="50" value="${Number(s.freeShippingFrom)}">
            </label>
            <label>Shipping fee (${esc(s.currency)})
              <input id="aShip" type="number" min="0" step="10" value="${Number(s.shippingFee)}">
            </label>
            <label>WhatsApp number
              <input id="aWhats" type="text" maxlength="15" value="${esc(s.whatsapp)}" placeholder="918923646175">
            </label>
          </div>
          <p class="field-hint" style="margin-top:-6px">That third box is your WhatsApp number with country code and no spaces — the chat button uses it.</p>
          <label>Instagram handle <span class="field-hint">optional</span>
            <input id="aInsta" type="text" maxlength="60" value="${esc(s.instagram)}" placeholder="vncrochet">
          </label>
        </div>
      </div>

      <div class="form-foot">
        <button class="primary" id="aSave" type="submit">Save appearance</button>
        <button class="ghost" id="aReset" type="button">Discard changes</button>
        <span class="spacer"></span>
        <p class="status" id="aStatus" role="status"></p>
      </div>
    </form>`;

  const paintTicker = () => {
    $('#tickerList').innerHTML = ticker.map((t, i) => `
      <div class="repeat-row">
        <input type="text" maxlength="50" value="${esc(t)}" data-ticker="${i}" placeholder="Hand-finished in small batches">
        <button class="icon-btn" type="button" data-rmticker="${i}" aria-label="Remove line">✕</button>
      </div>`).join('') || '<p class="field-hint">No lines — the ticker will use the defaults.</p>';
    $$('[data-ticker]').forEach((input) => input.addEventListener('input', (e) => { ticker[Number(input.dataset.ticker)] = e.target.value; }));
    $$('[data-rmticker]').forEach((b) => b.addEventListener('click', () => { ticker.splice(Number(b.dataset.rmticker), 1); paintTicker(); }));
  };

  const paintRibbons = () => {
    $('#ribbonList').innerHTML = accents.map((colour, i) => `
      <div class="colour-row">
        <input type="color" value="${esc(colour)}" data-rib="${i}">
        <input type="text" maxlength="20" value="${esc(names[i] || '')}" data-ribname="${i}" placeholder="Colour name">
        <span class="field-hint">used on ${store.products.filter((p) => (p.ribbons || []).includes(i)).length} product(s)</span>
        <button class="icon-btn" type="button" data-rmrib="${i}" aria-label="Remove colour">✕</button>
      </div>`).join('');
    $$('[data-rib]').forEach((input) => input.addEventListener('input', (e) => { accents[Number(input.dataset.rib)] = e.target.value; }));
    $$('[data-ribname]').forEach((input) => input.addEventListener('input', (e) => { names[Number(input.dataset.ribname)] = e.target.value; }));
    $$('[data-rmrib]').forEach((b) => b.addEventListener('click', () => {
      const i = Number(b.dataset.rmrib);
      if (accents.length <= 1) { toast('Keep at least one colour.', 'err'); return; }
      accents.splice(i, 1); names.splice(i, 1); paintRibbons();
    }));
  };

  const paintCats = () => {
    $('#catList').innerHTML = cats.map((c, i) => `
      <div class="repeat-row">
        <input type="text" maxlength="40" value="${esc(c.name)}" data-cat="${i}" placeholder="Plush">
        <button class="icon-btn" type="button" data-rmcat="${i}" aria-label="Remove collection">✕</button>
      </div>`).join('');
    $$('[data-cat]').forEach((input) => input.addEventListener('input', (e) => { cats[Number(input.dataset.cat)].name = e.target.value; }));
    $$('[data-rmcat]').forEach((b) => b.addEventListener('click', () => {
      const i = Number(b.dataset.rmcat);
      if (cats.length <= 1) { toast('Keep at least one collection.', 'err'); return; }
      cats.splice(i, 1); paintCats();
    }));
  };

  paintTicker(); paintRibbons(); paintCats();
  $('#addTicker').addEventListener('click', () => { if (ticker.length < 8) { ticker.push(''); paintTicker(); } });
  $('#addCat').addEventListener('click', () => { if (cats.length < 12) { cats.push({name: '', icon: '•'}); paintCats(); } });

  $('#aAccent').addEventListener('input', (e) => { $('#aAccentHex').value = e.target.value; });
  $('#aAccentHex').addEventListener('input', (e) => { if (/^#[0-9a-f]{6}$/i.test(e.target.value)) $('#aAccent').value = e.target.value; });

  const readForm = () => {
    const accent = /^#[0-9a-f]{6}$/i.test($('#aAccentHex').value) ? $('#aAccentHex').value : '#b2485f';
    return {
      ...settings(),
      brandName: $('#aBrand').value.trim(),
      currency: $('#aCurrency').value.trim() || '₹',
      announcement: $('#aAnnounce').value.trim(),
      heroTitle: $('#aHeroTitle').value.trim(),
      heroText: $('#aHeroText').value.trim(),
      heroImage: $('#aHeroImage').value.trim(),
      heroCaption: $('#aHeroCaption').value.trim(),
      accent,
      ticker: ticker.map((t) => t.trim()).filter(Boolean).slice(0, 8),
      ribbonColors: accents.slice(),
      ribbonNames: names.map((n, i) => n.trim() || `Colour ${i + 1}`),
      categories: cats.map((c) => ({name: c.name.trim(), icon: c.icon || '•'})).filter((c) => c.name).slice(0, 12),
      freeShippingFrom: Math.max(0, Number($('#aFree').value) || 0),
      shippingFee: Math.max(0, Number($('#aShip').value) || 0),
      whatsapp: $('#aWhats').value.replace(/\D/g, ''),
      instagram: $('#aInsta').value.trim()
    };
  };

  $('#appForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = $('#aStatus');
    const next = readForm();
    if (!next.categories.length) { status.className = 'status err'; status.textContent = 'Keep at least one collection.'; return; }
    if (!next.whatsapp || next.whatsapp.length < 10) { status.className = 'status err'; status.textContent = 'WhatsApp number needs the country code, e.g. 918923646175.'; $('#aWhats').focus(); return; }

    const btn = $('#aSave');
    btn.disabled = true;
    status.className = 'status';
    status.textContent = 'Saving…';
    store.settings = next;
    try {
      await saveStore('Appearance saved — reload the shop to see it.');
      status.className = 'status ok';
      status.textContent = 'Saved. The shop uses these on its next load.';
      $$('.js-brand').forEach((el) => { el.textContent = next.brandName || 'VN crochet'; });
    } catch (err) {
      status.className = 'status err';
      status.textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });

  $('#aReset').addEventListener('click', () => { viewAppearance(host); toast('Changes discarded.'); });
}

// ── Orders ───────────────────────────────────────────────────────────────────
async function viewOrders(host) {
  host.innerHTML = `<div class="card"><div class="card-body"><p class="status">Loading orders…</p></div></div>`;
  try {
    const data = await api('/orders');
    store.orders = Array.isArray(data.orders) ? data.orders : [];
  } catch (err) {
    host.innerHTML = `<div class="card"><div class="empty"><span class="mark" aria-hidden="true">⚑</span>
      <h3>Orders aren’t available yet</h3><p>${esc(err.message)}</p></div></div>`;
    return;
  }

  if (!store.orders.length) {
    host.innerHTML = `<div class="card"><div class="empty"><span class="mark" aria-hidden="true">⚑</span>
      <h3>No orders yet</h3><p>When someone checks out, their order lands here.</p></div></div>`;
    return;
  }

  const s = settings();
  const statuses = ['new', 'confirmed', 'shipped', 'delivered', 'cancelled'];
  host.innerHTML = `<div class="card"><div class="card-head"><div class="grow"><h2>${store.orders.length} order${store.orders.length === 1 ? '' : 's'}</h2>
    <p>Newest first. Change a status as the parcel moves.</p></div></div>
    <div class="card-body tight" id="orderList"></div></div>`;

  $('#orderList').innerHTML = store.orders.map((o, i) => `
    <div class="order" data-order="${i}">
      <div class="order-top">
        <span class="badge ${o.status === 'new' ? 'new' : o.status === 'cancelled' ? 'out' : 'live'}">${esc(titleCase(o.status))}</span>
        <div class="who"><b>${esc(o.name)}</b><div>${esc(o.phone)}${o.city ? ` · ${esc(o.city)}` : ''} · ${new Date(o.createdAt).toLocaleString('en-IN')}</div></div>
        <span class="order-total">${money(o.total, s.currency)}</span>
      </div>
      <div class="order-body" hidden>
        ${(o.items || []).map((it) => `<div class="order-line"><span>${esc(it.name)}${it.ribbon ? ` · ${esc(it.ribbon)}` : ''} × ${it.qty}</span><span>${money(it.price * it.qty, s.currency)}</span></div>`).join('')}
        <div class="order-line"><span>Shipping</span><span>${o.shipping ? money(o.shipping, s.currency) : 'Free'}</span></div>
        ${o.notes ? `<div class="order-line"><span>Notes</span><span>${esc(o.notes)}</span></div>` : ''}
        <div class="actions">
          <select class="sel-status" data-status="${i}" aria-label="Order status">
            ${statuses.map((st) => `<option value="${st}"${st === o.status ? ' selected' : ''}>${titleCase(st)}</option>`).join('')}
          </select>
          <a class="ghost small" href="https://wa.me/${esc(String(o.phone).replace(/\D/g, ''))}" target="_blank" rel="noopener">Message on WhatsApp</a>
        </div>
      </div>
    </div>`).join('');

  $$('[data-order]').forEach((row) => {
    $('.order-top', row).addEventListener('click', () => {
      const body = $('.order-body', row);
      body.hidden = !body.hidden;
    });
  });
  $$('[data-status]').forEach((sel) => sel.addEventListener('change', async () => {
    const o = store.orders[Number(sel.dataset.status)];
    sel.disabled = true;
    try {
      await api('/orders', {method: 'PATCH', body: {key: o.key, status: sel.value}});
      o.status = sel.value;
      toast('Order updated.', 'ok');
      renderNav();
      const top = sel.closest('.order').querySelector('.badge');
      top.textContent = titleCase(sel.value);
      top.className = `badge ${sel.value === 'new' ? 'new' : sel.value === 'cancelled' ? 'out' : 'live'}`;
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      sel.disabled = false;
    }
  }));
}

// ── Boot ─────────────────────────────────────────────────────────────────────
async function boot() {
  if (!getToken()) { showLogin(); return; }

  // Show the shell straight away; data arrives a moment later.
  store.products = [];
  store.settings = null;
  store.orders = [];
  shell();
  $('#view').innerHTML = `<div class="card"><div class="card-body"><p class="status">Loading your studio…</p></div></div>`;

  try {
    await loadStore();
    renderNav();
    renderView();
    if (store.notice) toast(store.notice, 'err');
  } catch (err) {
    if (err.message === 'Sign in again to continue.') return;
    renderView();
  }
}

boot();

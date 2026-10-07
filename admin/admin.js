// ── Auth ──────────────────────────────────────────────────────────────────────
const TOKEN_KEY = 'vn_admin_token';
function getToken()    { return sessionStorage.getItem(TOKEN_KEY); }
function setToken(t)   { sessionStorage.setItem(TOKEN_KEY, t); }
function clearToken()  { sessionStorage.removeItem(TOKEN_KEY); }

// Hide the desk shell immediately — before any rendering — so it never flashes
document.documentElement.style.visibility = 'hidden';

// Authenticated fetch: attaches Bearer token, catches 401s
async function apiFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    clearToken();
    bootAdmin(); // re-runs the gate, will show login
    throw new Error('Unauthorised');
  }
  return res;
}

// ── Login screen ──────────────────────────────────────────────────────────────
function showLoginScreen(message = '') {
  document.body.innerHTML = `
    <div class="login-shell">
      <div class="login-card">
        <div class="login-brand"><span>🧶</span><strong>VN crochet</strong><small>Studio desk</small></div>
        <h1>Sign in</h1>
        <p class="login-error" id="loginErr" role="alert"${message ? '' : ' hidden'}>${message}</p>
        <form id="loginForm">
          <label>Username<input id="loginUser" type="text" autocomplete="username" required placeholder="admin"></label>
          <label>Password<input id="loginPass" type="password" autocomplete="current-password" required placeholder="••••••••"></label>
          <button type="submit" id="loginBtn">Sign in</button>
        </form>
      </div>
    </div>`;
  document.documentElement.style.visibility = 'visible';

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn    = document.getElementById('loginBtn');
    const errEl  = document.getElementById('loginErr');
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    errEl.hidden = true;

    try {
      const res  = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: document.getElementById('loginUser').value.trim(),
          password: document.getElementById('loginPass').value
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed.');
      setToken(data.token);
      window.location.reload();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.hidden      = false;
      btn.disabled      = false;
      btn.textContent   = 'Sign in';
    }
  });
}

// ── Boot gate — runs immediately ──────────────────────────────────────────────
function bootAdmin() {
  if (!getToken()) {
    showLoginScreen();
    return; // desk never initialises
  }
  // Token present — reveal the desk and initialise everything
  document.documentElement.style.visibility = 'visible';
  initDesk();
}

// ── Full desk initialisation (only runs when authenticated) ───────────────────
function initDesk() {
  // Inject logout button into the header
  const actions = document.querySelector('.header-actions');
  if (actions) {
    const btn = document.createElement('button');
    btn.className   = 'ghost';
    btn.textContent = 'Sign out';
    btn.addEventListener('click', () => { clearToken(); window.location.reload(); });
    actions.prepend(btn);
  }

  const API = '/api';
  const $   = (sel) => document.querySelector(sel);
  const form = $('#productForm');
  const fields = ['productId','name','category','price','size','stock','level','background','emoji','description','materials','care','featured','active'];
  let imageData = '';
  let imageFile = null;
  let catalog   = [];

  // ── Catalog load / save ───────────────────────────────────────────────────
  async function loadCatalog() {
    try {
      const res = await apiFetch(`${API}/catalog`);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      catalog = await res.json();
    } catch (err) {
      if (err.message !== 'Unauthorised') {
        console.warn('Could not reach backend, falling back to empty catalog.', err);
        catalog = [];
      }
    }
    renderList();
    clearForm();
  }

  async function saveCatalog() {
    const res = await apiFetch(`${API}/catalog`, {
      method: 'POST',
      body: JSON.stringify(catalog)
    });
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
  }

  async function uploadImage(file) {
    const data = new FormData();
    data.append('image', file);
    const res = await apiFetch(`${API}/upload`, { method: 'POST', body: data });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    const json = await res.json();
    return json.url;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function materialsFromText(value) {
    return value.split('\n').map((line) => line.split('|').map((p) => p.trim())).filter((parts) => parts.length === 2 && parts[0] && parts[1]);
  }
  function materialsToText(materials = []) {
    return materials.map((m) => m.join(' | ')).join('\n');
  }
  function nextId() {
    return Math.max(0, ...catalog.map((p) => p.id)) + 1;
  }

  function readForm() {
    return {
      id:       Number($('#productId').value) || nextId(),
      n:        $('#name').value.trim(),
      c:        $('#category').value,
      p:        Number($('#price').value),
      s:        $('#size').value.trim(),
      stock:    Number($('#stock').value),
      lv:       Number($('#level').value) || 1,
      bg:       $('#background').value,
      e:        $('#emoji').value.trim(),
      image:    imageData,
      d:        $('#description').value.trim(),
      m:        materialsFromText($('#materials').value),
      care:     $('#care').value.trim(),
      featured: $('#featured').checked,
      active:   $('#active').checked
    };
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function renderList() {
    const query   = $('#catalogSearch').value.trim().toLowerCase();
    const visible = catalog.filter((p) => `${p.n} ${p.c} ${p.d}`.toLowerCase().includes(query));
    $('#productCount').textContent = catalog.filter((p) => p.active).length;
    $('#draftCount').textContent   = catalog.filter((p) => !p.active).length;
    $('#catalogList').innerHTML = visible.length
      ? visible.map((p) => `
        <article class="catalog-row" data-product="${p.id}">
          <div class="art" style="background:${p.bg};${p.image ? `background-image:url('${p.image}')` : ''}">${p.image ? '' : p.e}</div>
          <div><h3>${p.n}</h3><p>${p.c} · ₹${p.p.toLocaleString('en-IN')} · ${p.stock} in stock${p.active ? '' : ' · Draft'}</p></div>
          <div class="row-actions">
            <button data-edit="${p.id}" type="button">Edit</button>
            <button class="${p.active ? '' : 'unpublished'}" data-toggle="${p.id}" type="button">${p.active ? 'Hide' : 'Publish'}</button>
          </div>
        </article>`).join('')
      : '<div class="empty">No creations match this search.</div>';
  }

  function renderPreview() { renderInspector(readForm(), 'Draft preview'); }

  function renderInspector(p, title = p.n) {
    $('#inspectorTitle').textContent = title;
    $('#preview').innerHTML = `
      <div class="inspector-card">
        <div class="preview-art" style="background-color:${p.bg};${p.image ? `background-image:url('${p.image}')` : ''}">${p.image ? '' : p.e || '🧶'}</div>
        <div class="inspector-copy">
          <div class="preview-meta"><span>${p.c || 'Collection'} · ${p.s || 'Size'}</span><strong>₹${(p.p || 0).toLocaleString('en-IN')}</strong></div>
          <h3>${p.n || 'Your creation name'}</h3>
          <p>${p.d || 'No description added yet.'}</p>
          <dl>
            <div><dt>Status</dt><dd>${p.active === false ? 'Draft' : 'Published'}</dd></div>
            <div><dt>Stock</dt><dd>${p.stock ?? 0}</dd></div>
            <div><dt>Level</dt><dd>LV ${p.lv ?? 1}</dd></div>
            <div><dt>Care</dt><dd>${p.care || 'Not added'}</dd></div>
          </dl>
          <div class="material-list">${(p.m || []).length ? p.m.map((m) => `<span>${m[0]} <b>${m[1]}</b></span>`).join('') : '<span>No materials added yet</span>'}</div>
        </div>
      </div>`;
  }

  function fillForm(p) {
    fields.forEach((field) => {
      const el = $(`#${field}`);
      if (field === 'productId')   el.value   = p.id;
      else if (field === 'name')   el.value   = p.n;
      else if (field === 'category') el.value = p.c;
      else if (field === 'price')  el.value   = p.p;
      else if (field === 'size')   el.value   = p.s;
      else if (field === 'stock')  el.value   = p.stock ?? 0;
      else if (field === 'level')  el.value   = p.lv ?? 1;
      else if (field === 'background') el.value = p.bg;
      else if (field === 'emoji')  el.value   = p.e;
      else if (field === 'description') el.value = p.d;
      else if (field === 'materials')   el.value = materialsToText(p.m);
      else if (field === 'care')   el.value   = p.care ?? '';
      else el.checked = p[field] !== false;
    });
    imageData = p.image || '';
    imageFile = null;
    renderImagePreview();
    $('#editorTitle').textContent = `Edit ${p.n}`;
    $('#deleteProduct').hidden = false;
    renderPreview();
  }

  function clearForm() {
    form.reset();
    $('#productId').value   = '';
    imageData               = '';
    imageFile               = null;
    $('#image').value       = '';
    $('#editorTitle').textContent = 'New creation';
    $('#deleteProduct').hidden    = true;
    $('#saveStatus').textContent  = '';
    renderPreview();
    renderImagePreview();
  }

  function renderImagePreview(fileName) {
    const thumb  = $('#imageThumb');
    const badge  = $('#imageSelectedBadge');
    const nameEl = $('#imageFileName');
    const zone   = $('#imageDropZone');
    if (imageData) {
      thumb.src = imageData;
      thumb.classList.add('visible');
      zone.classList.add('has-image');
      if (badge)  badge.hidden  = false;
      if (nameEl) nameEl.textContent = fileName || (imageData.startsWith('/uploads/') ? imageData.split('/').pop() : 'Image selected');
    } else {
      thumb.src = '';
      thumb.classList.remove('visible');
      zone.classList.remove('has-image');
      if (badge)  badge.hidden  = true;
      if (nameEl) nameEl.textContent = '';
    }
  }

  function openEditor() {
    $('#editorPanel').classList.add('open');
    $('#editorPanel').setAttribute('aria-hidden', 'false');
    document.body.classList.add('editor-open');
    $('#name').focus();
  }
  function closeEditor() {
    $('#editorPanel').classList.remove('open');
    $('#editorPanel').setAttribute('aria-hidden', 'true');
    document.body.classList.remove('editor-open');
  }

  // ── Event listeners ───────────────────────────────────────────────────────
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    $('#saveStatus').textContent = 'Saving…';
    try {
      if (imageFile) {
        $('#saveStatus').textContent = 'Uploading image…';
        imageData = await uploadImage(imageFile);
        imageFile = null;
      }
      const product = readForm();
      const index   = catalog.findIndex((e) => e.id === product.id);
      if (index >= 0) catalog[index] = product;
      else catalog.push(product);
      await saveCatalog();
      renderList();
      fillForm(product);
      $('#saveStatus').textContent = `${product.n} saved and live in the shop.`;
    } catch (err) {
      $('#saveStatus').textContent = `Save failed: ${err.message}`;
    } finally {
      btn.disabled = false;
    }
  });

  document.addEventListener('input', (event) => {
    if (event.target.closest('#productForm')) renderPreview();
    if (event.target.id === 'catalogSearch') renderList();
  });

  $('#image').addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { event.target.value = ''; $('#saveStatus').textContent = 'Choose an image smaller than 4 MB.'; return; }
    imageFile = file;
    const reader = new FileReader();
    reader.addEventListener('load', () => { imageData = String(reader.result); renderImagePreview(file.name); renderPreview(); });
    reader.readAsDataURL(file);
  });

  $('#imageDropZone').addEventListener('click',   (e) => { if (e.target.id !== 'imageClearBtn') $('#image').click(); });
  $('#imageDropZone').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#image').click(); } });
  $('#imageClearBtn').addEventListener('click',   (e) => { e.stopPropagation(); imageData = ''; imageFile = null; $('#image').value = ''; renderImagePreview(); renderPreview(); });
  $('#imageDropZone').addEventListener('dragover', (e) => { e.preventDefault(); $('#imageDropZone').classList.add('drag-over'); });
  $('#imageDropZone').addEventListener('dragleave', () => { $('#imageDropZone').classList.remove('drag-over'); });
  $('#imageDropZone').addEventListener('drop', (e) => {
    e.preventDefault();
    $('#imageDropZone').classList.remove('drag-over');
    const file = e.dataTransfer.files?.[0];
    if (!file || !['image/jpeg','image/png','image/webp'].includes(file.type)) return;
    if (file.size > 4 * 1024 * 1024) { $('#saveStatus').textContent = 'Choose an image smaller than 4 MB.'; return; }
    imageFile = file;
    const reader = new FileReader();
    reader.addEventListener('load', () => { imageData = String(reader.result); renderImagePreview(file.name); renderPreview(); });
    reader.readAsDataURL(file);
  });

  document.addEventListener('click', async (event) => {
    if ($('#editorPanel').classList.contains('open') && !event.target.closest('#editorPanel') && event.target.id !== 'newProduct') closeEditor();
    const edit   = event.target.closest('[data-edit]');
    const toggle = event.target.closest('[data-toggle]');
    const row    = event.target.closest('[data-product]');
    if (edit)   { fillForm(catalog.find((p) => p.id === Number(edit.dataset.edit))); openEditor(); }
    if (toggle) {
      const p = catalog.find((e) => e.id === Number(toggle.dataset.toggle));
      p.active = !p.active;
      try { await saveCatalog(); } catch { /* shown elsewhere */ }
      renderList();
    }
    if (row && !event.target.closest('button')) {
      const p = catalog.find((e) => e.id === Number(row.dataset.product));
      if (p) renderInspector(p);
    }
    if (event.target.id === 'newProduct')    { clearForm(); openEditor(); }
    if (event.target.id === 'clearForm')     clearForm();
    if (event.target.id === 'closeEditor')   closeEditor();
    if (event.target.id === 'deleteProduct') {
      const id = Number($('#productId').value);
      catalog = catalog.filter((p) => p.id !== id);
      try { await saveCatalog(); $('#saveStatus').textContent = 'Creation removed from the shop.'; }
      catch (err) { $('#saveStatus').textContent = `Delete failed: ${err.message}`; }
      renderList(); clearForm();
      if (catalog[0]) renderInspector(catalog[0]);
    }
    if (event.target.id === 'downloadCatalog') {
      const blob = new Blob([JSON.stringify(catalog, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href     = URL.createObjectURL(blob);
      link.download = 'varsha-catalog.json';
      link.click();
      URL.revokeObjectURL(link.href);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && $('#editorPanel').classList.contains('open')) closeEditor();
  });

  // Boot the desk
  loadCatalog();
}

// ── Run the gate ──────────────────────────────────────────────────────────────
bootAdmin();

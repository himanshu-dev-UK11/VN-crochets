// ── Auth ──────────────────────────────────────────────────────────────────────
const TOKEN_KEY = 'vn_admin_token';
function getToken()   { return sessionStorage.getItem(TOKEN_KEY); }
function setToken(t)  { sessionStorage.setItem(TOKEN_KEY, t); }
function clearToken() { sessionStorage.removeItem(TOKEN_KEY); }

// Authenticated fetch: attaches Bearer token, handles 401 by showing login
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
    showLogin('Session expired. Please sign in again.');
    throw new Error('Unauthorised');
  }
  return res;
}

// ── Login ─────────────────────────────────────────────────────────────────────
function showLogin(message = '') {
  const app = document.getElementById('app');
  app.innerHTML = `
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

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn   = document.getElementById('loginBtn');
    const errEl = document.getElementById('loginErr');
    btn.disabled    = true;
    btn.textContent = 'Signing in…';
    errEl.hidden    = true;
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
      mountDesk();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.hidden      = false;
      btn.disabled      = false;
      btn.textContent   = 'Sign in';
    }
  });
}

// ── Desk HTML template ────────────────────────────────────────────────────────
function deskHTML() {
  return `
  <header class="admin-header">
    <a class="brand" href="../index.html"><span>🧶</span><strong>VN crochet</strong><small>Studio desk</small></a>
    <div class="header-actions">
      <button class="ghost" id="signOutBtn" type="button">Sign out</button>
      <button class="ghost" id="downloadCatalog" type="button">Download catalog</button>
      <a class="shop-link" href="../index.html">View shop ↗</a>
    </div>
  </header>

  <main class="admin-shell">
    <section class="intro">
      <div>
        <p class="eyebrow">Private maker workspace</p>
        <h1>Keep the shelf fresh.</h1>
        <p>Add a new creation once and see it in the shop catalog. Changes save to the database and go live immediately.</p>
      </div>
      <div class="stats" aria-label="Catalog summary">
        <strong id="productCount">0</strong><span>creations listed</span>
        <strong id="draftCount">0</strong><span>drafts</span>
      </div>
    </section>

    <div class="workspace">
      <section class="catalog-panel">
        <div class="panel-heading">
          <div><p class="eyebrow">Catalog</p><h2>All creations</h2></div>
          <button class="primary small" id="newProduct" type="button">+ New creation</button>
        </div>
        <label class="search-box">Search creations<input id="catalogSearch" type="search" placeholder="Mushroom, forest, gift..."></label>
        <div id="catalogList" class="catalog-list" aria-live="polite"></div>
      </section>

      <aside class="editor-panel" id="editorPanel" aria-hidden="true">
        <div class="panel-heading">
          <div><p class="eyebrow">Editor</p><h2 id="editorTitle">New creation</h2></div>
          <div class="editor-actions"><button class="text-button" id="clearForm" type="button">Clear</button><button class="close-editor" id="closeEditor" type="button" aria-label="Close editor">×</button></div>
        </div>
        <form id="productForm">
          <input id="productId" type="hidden">
          <div class="form-grid two">
            <label>Creation name<input id="name" required maxlength="50" placeholder="Moss the Mushroom"></label>
            <label>Collection<select id="category"><option>Forest</option><option>Pond</option><option>Meadow</option><option>Custom</option></select></label>
          </div>
          <div class="form-grid three">
            <label>Price (INR)<input id="price" required type="number" min="0" step="1" placeholder="599"></label>
            <label>Size<input id="size" placeholder="12 cm"></label>
            <label>Stock<input id="stock" type="number" min="0" step="1" value="1"></label>
          </div>
          <div class="form-grid two">
            <label>Level<input id="level" type="number" min="1" max="9" value="1"></label>
            <label>Card colour<input id="background" type="color" value="#ffc9c9"></label>
          </div>
          <label>Preview art / emoji<input id="emoji" maxlength="4" placeholder="🍄"></label>
          <div class="image-upload-label">
            <span>Product image</span>
            <span class="hint">JPG, PNG, or WebP · up to 4 MB</span>
          </div>
          <div class="image-upload-container">
            <div class="image-drop-zone" id="imageDropZone" role="button" tabindex="0" aria-label="Choose product image">
              <img id="imageThumb" class="image-thumb" alt="Selected product image">
              <div class="image-drop-inner" id="imageDropInner">
                <span class="image-drop-icon">🖼️</span>
                <span class="image-drop-text">Click to choose or drag an image here</span>
              </div>
              <div class="image-selected-badge" id="imageSelectedBadge" hidden>
                <span class="image-check">✓</span>
                <span id="imageFileName" class="image-file-name"></span>
                <button type="button" class="image-clear-btn" id="imageClearBtn" aria-label="Remove image">✕</button>
              </div>
            </div>
            <div class="image-position-editor" id="imagePositionEditor" hidden>
              <div class="position-label">
                <span>Position & aspect ratio</span>
                <span class="hint">Drag to reposition · grab and move</span>
              </div>
              <div class="aspect-presets">
                <button type="button" data-aspect="0.75" class="preset-btn active">Portrait (3:4)</button>
                <button type="button" data-aspect="1" class="preset-btn">Square (1:1)</button>
                <button type="button" data-aspect="0.85" class="preset-btn">Tall (0.85)</button>
              </div>
              <div class="position-preview-container">
                <div class="position-preview" id="positionPreview" data-aspect="0.75">
                  <div class="position-crosshair"></div>
                </div>
                <div class="position-coords">
                  <span>X: <b id="coordX">50</b>%</span>
                  <span>Y: <b id="coordY">50</b>%</span>
                </div>
              </div>
              <div class="position-actions">
                <button type="button" class="text-button" id="resetPosition">Reset to center</button>
              </div>
            </div>
          </div>
          <input id="imageX" type="hidden" value="50">
          <input id="imageY" type="hidden" value="50">
          <input id="imageAspect" type="hidden" value="0.75">
          <input id="image" type="file" accept="image/png,image/jpeg,image/webp" aria-hidden="true" tabindex="-1" style="position:fixed;top:-999px;left:-999px;width:1px;height:1px;opacity:0;pointer-events:none">
          <label>Short description<textarea id="description" rows="3" maxlength="180" placeholder="A soft little companion for a calm desk corner."></textarea></label>
          <label>Materials <span class="hint">one per line: material | amount</span><textarea id="materials" rows="3" placeholder="Cotton yarn | 2 skeins&#10;Poly fill | 30 g"></textarea></label>
          <label>Care note<input id="care" placeholder="Spot clean gently"></label>
          <div class="form-grid two checks">
            <label class="check"><input id="featured" type="checkbox" checked> Featured on shelf</label>
            <label class="check"><input id="active" type="checkbox" checked> Published</label>
          </div>
          <div class="form-actions">
            <button class="primary" type="submit">Upload to catalog</button>
            <button class="danger ghost" id="deleteProduct" type="button" hidden>Delete creation</button>
          </div>
          <p id="saveStatus" class="status" role="status"></p>
        </form>
      </aside>

      <section class="preview-panel" id="inspectorPanel">
        <div class="panel-heading"><div><p class="eyebrow">Creation details</p><h2 id="inspectorTitle">Select a creation</h2></div><span class="preview-label">Click a catalog row to inspect</span></div>
        <div id="preview" class="product-inspector"></div>
      </section>
    </div>
  </main>`;
}

// ── Mount desk ────────────────────────────────────────────────────────────────
function mountDesk() {
  document.getElementById('app').innerHTML = deskHTML();
  initDesk();
}

// ── Full desk logic ───────────────────────────────────────────────────────────
function initDesk() {
  document.getElementById('signOutBtn').addEventListener('click', () => {
    clearToken();
    showLogin();
  });

  const API = '/api';
  const $   = (sel) => document.querySelector(sel);
  const form = $('#productForm');
  const fields = ['productId','name','category','price','size','stock','level','background','emoji','imageX','imageY','description','materials','care','featured','active'];
  let imageData = '';
  let imageFile = null;
  let catalog   = [];

  async function loadCatalog() {
    try {
      const res = await apiFetch(`${API}/catalog`);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      catalog = await res.json();
    } catch (err) {
      if (err.message !== 'Unauthorised') {
        console.warn('Could not reach backend.', err);
        catalog = [];
      }
    }
    renderList();
    clearForm();
  }

  async function saveCatalog() {
    const res = await apiFetch(`${API}/catalog`, { method: 'POST', body: JSON.stringify(catalog) });
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
  }

  async function uploadImage(file) {
    const data = new FormData();
    data.append('image', file);
    const res = await apiFetch(`${API}/upload`, { method: 'POST', body: data });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    return (await res.json()).url;
  }

  function materialsFromText(v) {
    return v.split('\n').map(l => l.split('|').map(p => p.trim())).filter(p => p.length === 2 && p[0] && p[1]);
  }
  function materialsToText(m = []) { return m.map(x => x.join(' | ')).join('\n'); }
  function nextId() { return Math.max(0, ...catalog.map(p => p.id)) + 1; }

  function readForm() {
    return {
      id: Number($('#productId').value) || nextId(),
      n: $('#name').value.trim(), c: $('#category').value,
      p: Number($('#price').value), s: $('#size').value.trim(),
      stock: Number($('#stock').value), lv: Number($('#level').value) || 1,
      bg: $('#background').value, e: $('#emoji').value.trim(),
      image: imageData,
      imageX: Number($('#imageX').value) || 50,
      imageY: Number($('#imageY').value) || 50,
      d: $('#description').value.trim(),
      m: materialsFromText($('#materials').value),
      care: $('#care').value.trim(),
      featured: $('#featured').checked, active: $('#active').checked
    };
  }

  function renderList() {
    const q = $('#catalogSearch').value.trim().toLowerCase();
    const visible = catalog.filter(p => `${p.n} ${p.c} ${p.d}`.toLowerCase().includes(q));
    $('#productCount').textContent = catalog.filter(p => p.active).length;
    $('#draftCount').textContent   = catalog.filter(p => !p.active).length;
    $('#catalogList').innerHTML = visible.length
      ? visible.map(p => `
        <article class="catalog-row" data-product="${p.id}">
          <div class="art" style="background:${p.bg};${p.image ? `background-image:url('${p.image}');background-position:${p.imageX || 50}% ${p.imageY || 50}%` : ''}">${p.image ? '' : p.e}</div>
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
        <div class="preview-art" style="background-color:${p.bg};${p.image ? `background-image:url('${p.image}');background-position:${p.imageX || 50}% ${p.imageY || 50}%` : ''}">${p.image ? '' : p.e || '🧶'}</div>
        <div class="inspector-copy">
          <div class="preview-meta"><span>${p.c || 'Collection'} · ${p.s || 'Size'}</span><strong>₹${(p.p || 0).toLocaleString('en-IN')}</strong></div>
          <h3>${p.n || 'Your creation name'}</h3><p>${p.d || 'No description yet.'}</p>
          <dl>
            <div><dt>Status</dt><dd>${p.active === false ? 'Draft' : 'Published'}</dd></div>
            <div><dt>Stock</dt><dd>${p.stock ?? 0}</dd></div>
            <div><dt>Level</dt><dd>LV ${p.lv ?? 1}</dd></div>
            <div><dt>Care</dt><dd>${p.care || 'Not added'}</dd></div>
          </dl>
          <div class="material-list">${(p.m||[]).length ? p.m.map(m=>`<span>${m[0]} <b>${m[1]}</b></span>`).join('') : '<span>No materials added yet</span>'}</div>
        </div>
      </div>`;
  }

  function fillForm(p) {
    fields.forEach(f => {
      const el = $(`#${f}`);
      if      (f==='productId')   el.value   = p.id;
      else if (f==='name')        el.value   = p.n;
      else if (f==='category')    el.value   = p.c;
      else if (f==='price')       el.value   = p.p;
      else if (f==='size')        el.value   = p.s;
      else if (f==='stock')       el.value   = p.stock ?? 0;
      else if (f==='level')       el.value   = p.lv ?? 1;
      else if (f==='background')  el.value   = p.bg;
      else if (f==='emoji')       el.value   = p.e;
      else if (f==='imageX')      el.value   = p.imageX ?? 50;
      else if (f==='imageY')      el.value   = p.imageY ?? 50;
      else if (f==='description') el.value   = p.d;
      else if (f==='materials')   el.value   = materialsToText(p.m);
      else if (f==='care')        el.value   = p.care ?? '';
      else el.checked = p[f] !== false;
    });
    imageData = p.image || ''; imageFile = null;
    renderImagePreview();
    $('#editorTitle').textContent = `Edit ${p.n}`;
    $('#deleteProduct').hidden = false;
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.textContent = 'Update product';
    renderPreview();
  }

  function clearForm() {
    form.reset(); $('#productId').value = ''; imageData = ''; imageFile = null;
    $('#image').value = ''; $('#editorTitle').textContent = 'New creation';
    $('#deleteProduct').hidden = true; $('#saveStatus').textContent = '';
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.textContent = 'Upload to catalog';
    renderPreview(); renderImagePreview();
  }

  // ── Image preview & position editor ───────────────────────────────────────
  function renderImagePreview(fileName) {
    const thumb  = $('#imageThumb');
    const badge  = $('#imageSelectedBadge');
    const nameEl = $('#imageFileName');
    const zone   = $('#imageDropZone');
    const posEditor = $('#imagePositionEditor');
    const posPreview = $('#positionPreview');

    if (imageData) {
      thumb.src = imageData;
      thumb.classList.add('visible');
      zone.classList.add('has-image');
      if (badge)  badge.hidden  = false;
      if (nameEl) nameEl.textContent = fileName || (imageData.startsWith('/uploads/') ? imageData.split('/').pop() : 'Image selected');

      if (posEditor && posPreview) {
        posEditor.hidden = false;
        // Show image as background so drag maps directly to background-position
        posPreview.style.backgroundImage = `url('${imageData}')`;
        posPreview.style.backgroundSize = 'cover';
        posPreview.style.backgroundRepeat = 'no-repeat';
        updatePositionPreview();
      }
    } else {
      thumb.src = '';
      thumb.classList.remove('visible');
      zone.classList.remove('has-image');
      if (badge)      badge.hidden = true;
      if (nameEl)     nameEl.textContent = '';
      if (posEditor)  posEditor.hidden = true;
      if (posPreview) posPreview.style.backgroundImage = '';
    }
  }

  // Updates background-position on the preview div and the coord readout
  function updatePositionPreview() {
    const posPreview = $('#positionPreview');
    const x = Number($('#imageX').value) || 50;
    const y = Number($('#imageY').value) || 50;

    if (posPreview) {
      posPreview.style.backgroundPosition = `${x}% ${y}%`;
    }
    const cx = $('#coordX'), cy = $('#coordY');
    if (cx) cx.textContent = Math.round(x);
    if (cy) cy.textContent = Math.round(y);
  }

  // Drag directly moves background-position — no img element, no pixel maths
  function initImagePositionDrag() {
    const preview = $('#positionPreview');
    if (!preview) return;

    let dragging = false;
    let startMouseX = 0, startMouseY = 0;
    let startX = 50, startY = 50;

    // pixels of drag needed to move from 0% to 100%
    // smaller = more sensitive; 200 feels like Instagram on a ~200px preview
    const RANGE = 200;

    const startDrag = (clientX, clientY) => {
      if (!preview.style.backgroundImage) return; // no image yet
      dragging = true;
      preview.classList.add('dragging');
      startMouseX = clientX;
      startMouseY = clientY;
      startX = Number($('#imageX').value) || 50;
      startY = Number($('#imageY').value) || 50;
    };

    const onMove = (clientX, clientY) => {
      if (!dragging) return;
      // Drag left  → x increases (reveal right part of image) → invert: drag right → x decreases
      // This matches Instagram: drag image left = see more of the right side
      const newX = Math.max(0, Math.min(100, startX - (clientX - startMouseX) / RANGE * 100));
      const newY = Math.max(0, Math.min(100, startY - (clientY - startMouseY) / RANGE * 100));

      $('#imageX').value = newX.toFixed(1);
      $('#imageY').value = newY.toFixed(1);
      preview.style.backgroundPosition = `${newX}% ${newY}%`;

      const cx = $('#coordX'), cy = $('#coordY');
      if (cx) cx.textContent = Math.round(newX);
      if (cy) cy.textContent = Math.round(newY);
    };

    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      preview.classList.remove('dragging');
    };

    // Mouse
    preview.addEventListener('mousedown', (e) => { e.preventDefault(); startDrag(e.clientX, e.clientY); });
    document.addEventListener('mousemove', (e) => { if (dragging) { e.preventDefault(); onMove(e.clientX, e.clientY); } });
    document.addEventListener('mouseup', endDrag);

    // Touch
    preview.addEventListener('touchstart', (e) => { e.preventDefault(); startDrag(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
    preview.addEventListener('touchmove',  (e) => { if (dragging) { e.preventDefault(); onMove(e.touches[0].clientX, e.touches[0].clientY); } }, { passive: false });
    preview.addEventListener('touchend',   endDrag);

    // Aspect ratio presets
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const aspect = btn.dataset.aspect;
        $('#imageAspect').value = aspect;
        preview.style.aspectRatio = aspect;
        preview.dataset.aspect = aspect;
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Reset
    const resetBtn = $('#resetPosition');
    if (resetBtn) {
      resetBtn.addEventListener('click', (e) => {
        e.preventDefault();
        $('#imageX').value = 50;
        $('#imageY').value = 50;
        updatePositionPreview();
      });
    }
  }

  function openEditor()  { $('#editorPanel').classList.add('open'); $('#editorPanel').setAttribute('aria-hidden','false'); document.body.classList.add('editor-open'); $('#name').focus(); }
  function closeEditor() { $('#editorPanel').classList.remove('open'); $('#editorPanel').setAttribute('aria-hidden','true'); document.body.classList.remove('editor-open'); }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; $('#saveStatus').textContent = 'Saving…';
    try {
      if (imageFile) { $('#saveStatus').textContent = 'Uploading image…'; imageData = await uploadImage(imageFile); imageFile = null; }
      const product = readForm();
      const idx = catalog.findIndex(x => x.id === product.id);
      if (idx >= 0) catalog[idx] = product; else catalog.push(product);
      await saveCatalog(); renderList(); fillForm(product);
      $('#saveStatus').textContent = `${product.n} saved and live in the shop.`;
    } catch (err) { $('#saveStatus').textContent = `Save failed: ${err.message}`; }
    finally { btn.disabled = false; }
  });

  document.addEventListener('input', e => {
    if (e.target.closest('#productForm')) renderPreview();
    if (e.target.id === 'catalogSearch') renderList();
  });

  $('#image').addEventListener('change', e => {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 4*1024*1024) { e.target.value=''; $('#saveStatus').textContent='Choose an image smaller than 4 MB.'; return; }
    imageFile = file;
    const r = new FileReader();
    r.addEventListener('load', () => { imageData = String(r.result); renderImagePreview(file.name); renderPreview(); });
    r.readAsDataURL(file);
  });

  $('#imageDropZone').addEventListener('click',   e => { if (e.target.id !== 'imageClearBtn') $('#image').click(); });
  $('#imageDropZone').addEventListener('keydown', e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); $('#image').click(); } });
  $('#imageClearBtn').addEventListener('click',   e => { e.stopPropagation(); imageData=''; imageFile=null; $('#image').value=''; renderImagePreview(); renderPreview(); });
  $('#imageDropZone').addEventListener('dragover', e => { e.preventDefault(); $('#imageDropZone').classList.add('drag-over'); });
  $('#imageDropZone').addEventListener('dragleave', () => $('#imageDropZone').classList.remove('drag-over'));
  $('#imageDropZone').addEventListener('drop', e => {
    e.preventDefault(); $('#imageDropZone').classList.remove('drag-over');
    const file = e.dataTransfer.files?.[0];
    if (!file || !['image/jpeg','image/png','image/webp'].includes(file.type)) return;
    if (file.size > 4*1024*1024) { $('#saveStatus').textContent='Choose an image smaller than 4 MB.'; return; }
    imageFile = file;
    const r = new FileReader();
    r.addEventListener('load', () => { imageData = String(r.result); renderImagePreview(file.name); renderPreview(); });
    r.readAsDataURL(file);
  });

  document.addEventListener('click', async e => {
    if ($('#editorPanel').classList.contains('open') && !e.target.closest('#editorPanel') && e.target.id !== 'newProduct') closeEditor();
    const edit = e.target.closest('[data-edit]'), toggle = e.target.closest('[data-toggle]'), row = e.target.closest('[data-product]');
    if (edit)   { fillForm(catalog.find(p => p.id === Number(edit.dataset.edit))); openEditor(); }
    if (toggle) { const p = catalog.find(x => x.id === Number(toggle.dataset.toggle)); p.active = !p.active; try { await saveCatalog(); } catch {} renderList(); }
    if (row && !e.target.closest('button')) { const p = catalog.find(x => x.id === Number(row.dataset.product)); if (p) renderInspector(p); }
    if (e.target.id === 'newProduct')    { clearForm(); openEditor(); }
    if (e.target.id === 'clearForm')     clearForm();
    if (e.target.id === 'closeEditor')   closeEditor();
    if (e.target.id === 'deleteProduct') {
      const id = Number($('#productId').value);
      catalog = catalog.filter(p => p.id !== id);
      try { await saveCatalog(); $('#saveStatus').textContent = 'Creation removed.'; }
      catch (err) { $('#saveStatus').textContent = `Delete failed: ${err.message}`; }
      renderList(); clearForm(); if (catalog[0]) renderInspector(catalog[0]);
    }
    if (e.target.id === 'downloadCatalog') {
      const blob = new Blob([JSON.stringify(catalog,null,2)], {type:'application/json'});
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'varsha-catalog.json'; a.click(); URL.revokeObjectURL(a.href);
    }
  });

  document.addEventListener('keydown', e => { if (e.key==='Escape' && $('#editorPanel').classList.contains('open')) closeEditor(); });

  initImagePositionDrag();
  loadCatalog();
}

// ── Boot ──────────────────────────────────────────────────────────────────────
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  mountDesk();
} else if (getToken()) {
  mountDesk();
} else {
  showLogin();
}

// ── Auth gate ─────────────────────────────────────────────────────────────────
// Token is stored in sessionStorage (cleared when the tab closes).
const TOKEN_KEY = 'vn_admin_token';

function getToken() { return sessionStorage.getItem(TOKEN_KEY); }
function setToken(t) { sessionStorage.setItem(TOKEN_KEY, t); }
function clearToken() { sessionStorage.removeItem(TOKEN_KEY); }

// Wrap every API call to automatically attach the Bearer token and handle 401s
async function apiFetch(url, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  // Don't set Content-Type for FormData (browser sets it with boundary)
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    clearToken();
    showLoginScreen('Session expired. Please log in again.');
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
        ${message ? `<p class="login-error" role="alert">${message}</p>` : '<p class="login-error" role="alert" hidden></p>'}
        <form id="loginForm">
          <label>Username<input id="loginUser" type="text" autocomplete="username" required placeholder="admin"></label>
          <label>Password<input id="loginPass" type="password" autocomplete="current-password" required placeholder="••••••••"></label>
          <button type="submit" id="loginBtn">Sign in</button>
        </form>
      </div>
    </div>`;

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('loginBtn');
    const errEl = document.querySelector('.login-error');
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    errEl.hidden = true;
    try {
      const res = await fetch('/api/login', {
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
      // Reload the page so the full admin shell renders fresh
      window.location.reload();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.hidden = false;
      btn.disabled = false;
      btn.textContent = 'Sign in';
    }
  });
}

// Boot: show login if no token, otherwise initialise the desk
if (!getToken()) {
  showLoginScreen();
  // Stop executing the rest of the file until the login redirects/reloads
  throw new Error('Not authenticated — login screen shown.');
}

// ── Desk shell ────────────────────────────────────────────────────────────────
// Add a logout button to the header once the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const actions = document.querySelector('.header-actions');
  if (actions) {
    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'ghost';
    logoutBtn.textContent = 'Sign out';
    logoutBtn.addEventListener('click', () => { clearToken(); window.location.reload(); });
    actions.prepend(logoutBtn);
  }
});

const API = '/api';
const $ = (selector) => document.querySelector(selector);
const form = $('#productForm');
const fields = ['productId','name','category','price','size','stock','level','background','emoji','description','materials','care','featured','active'];
let imageData = '';   // URL string (either a server path "/uploads/…" or a fresh data: URL for preview only)
let imageFile = null; // File object waiting to be uploaded on save
let catalog = [];

async function loadCatalog() {
  try {
    const res = await apiFetch(`${API}/catalog`);
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    catalog = await res.json();
  } catch (err) {
    console.warn('Could not reach backend, falling back to empty catalog.', err);
    catalog = [];
  }
  renderList();
  clearForm();
}

async function saveCatalog() {
  try {
    const res = await apiFetch(`${API}/catalog`, {
      method: 'POST',
      body: JSON.stringify(catalog)
    });
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
  } catch (err) {
    console.error('Could not save catalog to server:', err);
    throw err;
  }
}

async function uploadImage(file) {
  const data = new FormData();
  data.append('image', file);
  const res = await apiFetch(`${API}/upload`, { method: 'POST', body: data });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  const json = await res.json();
  return json.url; // e.g. "/uploads/1717000000-abc123.jpg"
}

function materialsFromText(value) {
  return value.split('\n').map((line) => line.split('|').map((part) => part.trim())).filter((parts) => parts.length === 2 && parts[0] && parts[1]);
}

function materialsToText(materials = []) {
  return materials.map((material) => material.join(' | ')).join('\n');
}

function readForm() {
  return {
    id: Number($('#productId').value) || nextId(),
    n: $('#name').value.trim(),
    c: $('#category').value,
    p: Number($('#price').value),
    s: $('#size').value.trim(),
    stock: Number($('#stock').value),
    lv: Number($('#level').value) || 1,
    bg: $('#background').value,
    e: $('#emoji').value.trim(),
    image: imageData,
    d: $('#description').value.trim(),
    m: materialsFromText($('#materials').value),
    care: $('#care').value.trim(),
    featured: $('#featured').checked,
    active: $('#active').checked
  };
}

function nextId() {
  return Math.max(0, ...catalog.map((product) => product.id)) + 1;
}

function renderList() {
  const query = $('#catalogSearch').value.trim().toLowerCase();
  const visible = catalog.filter((product) => `${product.n} ${product.c} ${product.d}`.toLowerCase().includes(query));
  $('#productCount').textContent = catalog.filter((product) => product.active).length;
  $('#draftCount').textContent = catalog.filter((product) => !product.active).length;
  $('#catalogList').innerHTML = visible.length ? visible.map((product) => `
    <article class="catalog-row" data-product="${product.id}">
      <div class="art" style="background:${product.bg};${product.image ? `background-image:url('${product.image}')` : ''}">${product.image ? '' : product.e}</div>
      <div><h3>${product.n}</h3><p>${product.c} · ₹${product.p.toLocaleString('en-IN')} · ${product.stock} in stock${product.active ? '' : ' · Draft'}</p></div>
      <div class="row-actions"><button data-edit="${product.id}" type="button">Edit</button><button class="${product.active ? '' : 'unpublished'}" data-toggle="${product.id}" type="button">${product.active ? 'Hide' : 'Publish'}</button></div>
    </article>`).join('') : '<div class="empty">No creations match this search.</div>';
}

function renderPreview() {
  const product = readForm();
  renderInspector(product, 'Draft preview');
}

function renderInspector(product, title = product.n) {
  $('#inspectorTitle').textContent = title;
  $('#preview').innerHTML = `<div class="inspector-card"><div class="preview-art" style="background-color:${product.bg};${product.image ? `background-image:url('${product.image}')` : ''}">${product.image ? '' : product.e || '🧶'}</div><div class="inspector-copy"><div class="preview-meta"><span>${product.c || 'Collection'} · ${product.s || 'Size'}</span><strong>₹${(product.p || 0).toLocaleString('en-IN')}</strong></div><h3>${product.n || 'Your creation name'}</h3><p>${product.d || 'No description added yet.'}</p><dl><div><dt>Status</dt><dd>${product.active === false ? 'Draft' : 'Published'}</dd></div><div><dt>Stock</dt><dd>${product.stock ?? 0}</dd></div><div><dt>Level</dt><dd>LV ${product.lv ?? 1}</dd></div><div><dt>Care</dt><dd>${product.care || 'Not added'}</dd></div></dl><div class="material-list">${(product.m || []).length ? product.m.map((material) => `<span>${material[0]} <b>${material[1]}</b></span>`).join('') : '<span>No materials added yet</span>'}</div></div></div>`;
}

function fillForm(product) {
  fields.forEach((field) => {
    const element = $(`#${field}`);
    if (field === 'productId') element.value = product.id;
    else if (field === 'name') element.value = product.n;
    else if (field === 'category') element.value = product.c;
    else if (field === 'price') element.value = product.p;
    else if (field === 'size') element.value = product.s;
    else if (field === 'stock') element.value = product.stock ?? 0;
    else if (field === 'level') element.value = product.lv ?? 1;
    else if (field === 'background') element.value = product.bg;
    else if (field === 'emoji') element.value = product.e;
    else if (field === 'description') element.value = product.d;
    else if (field === 'materials') element.value = materialsToText(product.m);
    else if (field === 'care') element.value = product.care ?? '';
    else element.checked = product[field] !== false;
  });
  imageData = product.image || '';
  imageFile = null;
  renderImagePreview();
  $('#editorTitle').textContent = `Edit ${product.n}`;
  $('#deleteProduct').hidden = false;
  renderPreview();
}

function clearForm() {
  form.reset();
  $('#productId').value = '';
  imageData = '';
  imageFile = null;
  $('#image').value = '';
  $('#editorTitle').textContent = 'New creation';
  $('#deleteProduct').hidden = true;
  $('#saveStatus').textContent = '';
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
    if (badge)  badge.hidden = false;
    if (nameEl) nameEl.textContent = fileName
      || (imageData.startsWith('/uploads/') ? imageData.split('/').pop() : 'Image selected');
  } else {
    thumb.src = '';
    thumb.classList.remove('visible');
    zone.classList.remove('has-image');
    if (badge)  badge.hidden = true;
    if (nameEl) nameEl.textContent = '';
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  $('#saveStatus').textContent = 'Saving…';

  try {
    // Upload the image first if a new file was chosen
    if (imageFile) {
      $('#saveStatus').textContent = 'Uploading image…';
      imageData = await uploadImage(imageFile);
      imageFile = null;
    }

    const product = readForm();
    const index = catalog.findIndex((entry) => entry.id === product.id);
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
  if (file.size > 4 * 1024 * 1024) {
    event.target.value = '';
    $('#saveStatus').textContent = 'Choose an image smaller than 4 MB.';
    return;
  }
  // Keep the File for upload-on-save, but show a local preview immediately
  imageFile = file;
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    imageData = String(reader.result); // local data URL for preview only
    renderImagePreview(file.name);
    renderPreview();
  });
  reader.readAsDataURL(file);
});

// Click on the drop zone triggers the hidden file input
$('#imageDropZone').addEventListener('click', (e) => {
  if (e.target.id === 'imageClearBtn') return; // clear button handled separately
  $('#image').click();
});

// Keyboard: Enter/Space on the drop zone also triggers the picker
$('#imageDropZone').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#image').click(); }
});

// Clear image button
$('#imageClearBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  imageData = '';
  imageFile = null;
  $('#image').value = '';
  renderImagePreview();
  renderPreview();
});

// Drag-and-drop support
$('#imageDropZone').addEventListener('dragover', (e) => {
  e.preventDefault();
  $('#imageDropZone').classList.add('drag-over');
});
$('#imageDropZone').addEventListener('dragleave', () => {
  $('#imageDropZone').classList.remove('drag-over');
});
$('#imageDropZone').addEventListener('drop', (e) => {
  e.preventDefault();
  $('#imageDropZone').classList.remove('drag-over');
  const file = e.dataTransfer.files?.[0];
  if (!file || !['image/jpeg','image/png','image/webp'].includes(file.type)) return;
  if (file.size > 4 * 1024 * 1024) { $('#saveStatus').textContent = 'Choose an image smaller than 4 MB.'; return; }
  imageFile = file;
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    imageData = String(reader.result);
    renderImagePreview(file.name);
    renderPreview();
  });
  reader.readAsDataURL(file);
});

document.addEventListener('click', async (event) => {
  if ($('#editorPanel').classList.contains('open') && !event.target.closest('#editorPanel') && event.target.id !== 'newProduct') closeEditor();
  const edit   = event.target.closest('[data-edit]');
  const toggle = event.target.closest('[data-toggle]');
  const row    = event.target.closest('[data-product]');
  if (edit) {
    fillForm(catalog.find((product) => product.id === Number(edit.dataset.edit)));
    openEditor();
  }
  if (toggle) {
    const product = catalog.find((entry) => entry.id === Number(toggle.dataset.toggle));
    product.active = !product.active;
    try {
      await saveCatalog();
    } catch { /* status already shown elsewhere */ }
    renderList();
  }
  if (row && !event.target.closest('button')) {
    const product = catalog.find((entry) => entry.id === Number(row.dataset.product));
    if (product) renderInspector(product);
  }
  if (event.target.id === 'newProduct') { clearForm(); openEditor(); }
  if (event.target.id === 'clearForm')  clearForm();
  if (event.target.id === 'closeEditor') closeEditor();
  if (event.target.id === 'deleteProduct') {
    const id = Number($('#productId').value);
    catalog = catalog.filter((product) => product.id !== id);
    try {
      await saveCatalog();
      $('#saveStatus').textContent = 'Creation removed from the shop.';
    } catch (err) {
      $('#saveStatus').textContent = `Delete failed: ${err.message}`;
    }
    renderList();
    clearForm();
    if (catalog[0]) renderInspector(catalog[0]);
  }
  if (event.target.id === 'downloadCatalog') {
    const blob = new Blob([JSON.stringify(catalog, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'varsha-catalog.json';
    link.click();
    URL.revokeObjectURL(link.href);
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && $('#editorPanel').classList.contains('open')) closeEditor();
});

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

// Boot: fetch catalog from server, then render
loadCatalog();

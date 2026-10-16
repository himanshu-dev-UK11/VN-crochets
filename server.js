/**
 * VN crochet — local dev server
 *
 *   npm start   →  http://localhost:3000        (shop)
 *                  http://localhost:3000/admin/ (admin panel)
 *
 * Speaks exactly the same /api contract as the Azure Functions in /api, and
 * reuses their sign-in and validation code, so what works here works live.
 * Data is kept in local files instead of Azure Storage:
 *   data/catalog.json        products (also the shop's offline fallback)
 *   data/settings.json       shop settings
 *   data/orders.local.json   orders (git-ignored)
 *   images/                  uploaded photos
 *
 * Admin username/password/JWT_SECRET are read from api/local.settings.json.
 */

'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3000;
const FILES = {
  catalog: path.join(ROOT, 'data', 'catalog.json'),
  settings: path.join(ROOT, 'data', 'settings.json'),
  orders: path.join(ROOT, 'data', 'orders.local.json'),
  images: path.join(ROOT, 'images')
};

// ── Credentials: same variables the live API uses ───────────────────────────
try {
  const local = JSON.parse(fs.readFileSync(path.join(ROOT, 'api', 'local.settings.json'), 'utf8'));
  for (const [k, v] of Object.entries(local.Values || {})) if (v && !process.env[k]) process.env[k] = v;
} catch {
  console.warn('  ! api/local.settings.json not found — copy local.settings.json.example and fill it in.');
}

const auth = require('./api/shared/auth');
const {cleanProducts, cleanSettings, cleanOrder, DEFAULT_SETTINGS, ORDER_STATUSES} = require('./api/shared/validate');

// ── File helpers ────────────────────────────────────────────────────────────
const readJson = (file, fallback) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
};
const writeJson = (file, data) => {
  // Write to a temp file then rename, so a crash never leaves half a file.
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
};
function readStore() {
  const products = readJson(FILES.catalog, []);
  const settings = cleanSettings(readJson(FILES.settings, DEFAULT_SETTINGS));
  const etag = '"' + crypto.createHash('sha1').update(JSON.stringify([products, settings])).digest('hex').slice(0, 16) + '"';
  return {products: Array.isArray(products) ? products : [], settings, etag};
}

fs.mkdirSync(FILES.images, {recursive: true});

// ── App ─────────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({limit: '8mb'}));
app.use((req, res, next) => { if (req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store'); next(); });

const requireAdmin = (req, res, next) =>
  auth.isAdmin(req.headers) ? next() : res.status(401).json({error: 'Your session has ended. Sign in again.'});

app.post('/api/login', async (req, res) => {
  const ip = req.ip;
  const wait = auth.lockedFor(ip);
  if (wait) return res.status(429).json({error: `Too many attempts. Try again in ${wait} minute${wait === 1 ? '' : 's'}.`});
  const {username, password, remember} = req.body || {};
  if (auth.checkCredentials(username, password)) {
    auth.clearFails(ip);
    return res.json(auth.issueToken(remember === true));
  }
  auth.recordFail(ip);
  await new Promise((r) => setTimeout(r, 600));
  res.status(401).json({error: 'That username and password don’t match.'});
});

app.get('/api/catalog', (req, res) => {
  const store = readStore();
  if (req.query.all === '1' && auth.isAdmin(req.headers)) return res.json(store);
  res.json({products: store.products.filter((p) => p.active !== false), settings: store.settings});
});

app.put('/api/catalog', requireAdmin, (req, res) => {
  const body = req.body || {};
  const current = readStore();
  if (body.etag && body.etag !== current.etag) {
    return res.status(409).json({error: 'The shop was changed on another device. Reload to get the latest version, then make your change again.'});
  }
  const products = cleanProducts(body.products);
  const settings = cleanSettings(body.settings);
  writeJson(FILES.catalog, products);
  writeJson(FILES.settings, settings);
  const saved = readStore();
  res.json({ok: true, etag: saved.etag, updatedAt: new Date().toISOString(), products, settings});
});

app.post('/api/upload', requireAdmin, (req, res) => {
  const data = String(req.body?.data || '').replace(/^data:[^,]*,/, '');
  const buf = Buffer.from(data, 'base64');
  if (!buf.length) return res.status(400).json({error: 'No image was received.'});
  if (buf.length > 4 * 1024 * 1024) return res.status(413).json({error: 'That image is larger than 4 MB.'});
  const ext = buf.toString('ascii', 8, 12) === 'WEBP' ? 'webp'
    : buf[0] === 0xff && buf[1] === 0xd8 ? 'jpg'
    : buf.toString('hex', 0, 8) === '89504e470d0a1a0a' ? 'png' : null;
  if (!ext) return res.status(415).json({error: 'Use a JPG, PNG or WebP photo.'});
  const name = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  fs.writeFileSync(path.join(FILES.images, name), buf);
  res.json({ok: true, url: `/images/${name}`});
});

app.post('/api/orders', (req, res) => {
  const store = readStore();
  const order = cleanOrder(req.body, store.products, store.settings);
  order.id = 'VN-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  order.createdAt = new Date().toISOString();
  order.key = `orders/${order.createdAt}-${order.id}.json`;
  const all = readJson(FILES.orders, []);
  all.push(order);
  writeJson(FILES.orders, all);
  res.json({ok: true, orderId: order.id, total: order.total});
});

app.get('/api/orders', requireAdmin, (_req, res) => {
  const all = readJson(FILES.orders, []);
  res.json({orders: all.slice().reverse()});
});

app.patch('/api/orders', requireAdmin, (req, res) => {
  const {key, status} = req.body || {};
  if (!ORDER_STATUSES.includes(status)) return res.status(400).json({error: 'Unknown order status.'});
  const all = readJson(FILES.orders, []);
  const order = all.find((o) => o.key === key);
  if (!order) return res.status(404).json({error: 'That order no longer exists.'});
  order.status = status;
  order.updatedAt = new Date().toISOString();
  writeJson(FILES.orders, all);
  res.json({ok: true, order});
});

app.use('/api', (_req, res) => res.status(404).json({error: 'Not found.'}));

// Static site. Never serve server-side secrets or tooling.
app.use((req, res, next) => {
  if (/^\/(api|node_modules|\.git|\.github|\.vscode|\.kilo)(\/|$)/.test(req.path) || /\.(md|zip)$/i.test(req.path) || req.path === '/server.js') {
    return res.status(404).send('Not found');
  }
  next();
});
app.use(express.static(ROOT, {index: 'index.html', extensions: ['html']}));
app.use((_req, res) => res.status(404).sendFile(path.join(ROOT, '404.html')));

// Errors (including validation) come back as clear JSON messages.
app.use((err, _req, res, _next) => {
  const status = err.status || (err.type === 'entity.too.large' ? 413 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({error: status === 413 ? 'That upload is too large.' : err.status ? err.message : 'Something went wrong on the server.'});
});

app.listen(PORT, () => {
  console.log(`\n  VN crochet is running`);
  console.log(`    Shop   http://localhost:${PORT}`);
  console.log(`    Admin  http://localhost:${PORT}/admin/\n`);
});

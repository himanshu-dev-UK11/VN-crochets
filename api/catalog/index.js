const {isAdmin} = require('../shared/auth');
const {send, readJson, requireAdmin, handler} = require('../shared/http');
const {readStore, writeStore, saveImage, isDataUrl, decodeDataUrl} = require('../shared/storage');
const {cleanProducts, cleanSettings} = require('../shared/validate');

// The admin sometimes saves a product whose photo is still a data: URL (the
// upload can fail on a slow connection). Promote it to storage on the way in
// so the store document never carries megabytes of base64.
async function promoteImage(url) {
  if (!isDataUrl(url)) return url;
  const file = decodeDataUrl(url);
  if (!file) return '';
  try {
    return await saveImage(file.buffer, file.ext, file.contentType);
  } catch {
    return ''; // never block the save on a photo that would not upload
  }
}

module.exports = handler(async function (context, req) {
  const method = req.method.toUpperCase();
  const wantsEverything = !!(req.query && req.query.all === '1') && isAdmin(req.headers);

  if (method === 'GET') {
    const store = await readStore();

    if (wantsEverything) {
      // Admin view: everything, plus the version tag used to detect clashes.
      return send(context, 200, store
        ? {products: store.products, settings: store.settings, etag: store.etag, updatedAt: store.updatedAt}
        : {products: [], settings: null, etag: null});
    }

    // Shoppers: published products only. 404 tells the site to use its
    // built-in catalogue until the admin saves for the first time.
    if (!store) return send(context, 404, {error: 'No live catalogue yet.'});
    return send(context, 200, {
      products: (store.products || []).filter((p) => p.active !== false),
      settings: store.settings
    }, {'Cache-Control': 'no-cache'});
  }

  if (method === 'PUT' || method === 'POST') {
    if (!requireAdmin(context, req)) return;
    const body = readJson(req);
    if (!body) return send(context, 400, {error: 'Nothing was sent.'});

    // Accept both the wrapped shape {products, settings, etag} and a bare
    // array of products, so an older admin build still works.
    const incoming = Array.isArray(body) ? {products: body} : body;
    const existing = await readStore();
    const settings = incoming.settings !== undefined
      ? cleanSettings(incoming.settings)
      : cleanSettings(existing && existing.settings);

    const cleaned = cleanProducts(incoming.products);
    for (const p of cleaned) p.image = await promoteImage(p.image);

    const doc = {
      products: cleaned,
      settings,
      updatedAt: new Date().toISOString()
    };
    const etag = await writeStore(doc, incoming.etag || null);
    return send(context, 200, {ok: true, etag, updatedAt: doc.updatedAt, products: doc.products, settings: doc.settings});
  }

  send(context, 405, {error: 'Method not allowed.'});
});

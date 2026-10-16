const {isAdmin} = require('../shared/auth');
const {send, readJson, requireAdmin, handler} = require('../shared/http');
const {readStore, writeStore} = require('../shared/storage');
const {cleanProducts, cleanSettings} = require('../shared/validate');

module.exports = handler(async function (context, req) {
  const method = req.method.toUpperCase();

  if (method === 'GET') {
    const store = await readStore();
    const admin = req.query && req.query.all === '1' && isAdmin(req.headers);

    if (admin) {
      // Admin view: everything, plus the version tag used to detect clashes.
      return send(context, 200, store
        ? {products: store.products, settings: store.settings, etag: store.etag, updatedAt: store.updatedAt}
        : {products: null, settings: null, etag: null});
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

    const doc = {
      products: cleanProducts(body.products),
      settings: cleanSettings(body.settings),
      updatedAt: new Date().toISOString()
    };
    const etag = await writeStore(doc, body.etag || null);
    return send(context, 200, {ok: true, etag, updatedAt: doc.updatedAt, products: doc.products, settings: doc.settings});
  }

  send(context, 405, {error: 'Method not allowed.'});
});

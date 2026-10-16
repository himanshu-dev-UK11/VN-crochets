// Small helpers shared by every HTTP function (Azure Functions v3 model).

const {isAdmin} = require('./auth');

function send(context, status, body, headers = {}) {
  context.res = {
    status,
    headers: {'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers},
    body
  };
}

function readJson(req) {
  const b = req.body;
  if (b && typeof b === 'object' && !Buffer.isBuffer(b)) return b;
  const raw = Buffer.isBuffer(b) ? b.toString('utf8') : typeof b === 'string' ? b : req.rawBody;
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function requireAdmin(context, req) {
  if (isAdmin(req.headers)) return true;
  send(context, 401, {error: 'Your session has ended. Sign in again.'});
  return false;
}

// Turn any thrown error into a clean JSON response; never leak stack traces.
function handler(fn) {
  return async function (context, req) {
    try {
      await fn(context, req);
    } catch (err) {
      const status = err.status || 500;
      if (status >= 500) (context.log.error || context.log)(err);
      send(context, status, {
        error: err.status ? err.message : 'Something went wrong on the server. Try again in a moment.'
      });
    }
  };
}

module.exports = {send, readJson, requireAdmin, handler};

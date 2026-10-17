// Admin sign-in: credential check, signed session tokens (HS256 JWT built on
// Node's crypto — no third-party library) and a simple brute-force brake.

const crypto = require('crypto');

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw httpError(500, 'The server is missing JWT_SECRET (needs 32+ characters).');
  return s;
}

function adminConfig() {
  const user = process.env.ADMIN_USERNAME;
  const pass = process.env.ADMIN_PASSWORD;
  if (!user || !pass) throw httpError(500, 'The server is missing ADMIN_USERNAME or ADMIN_PASSWORD.');
  return {user: user.trim().toLowerCase(), pass};
}

// Hash both sides first so the comparison takes the same time whatever the input.
function safeEqual(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

// Ties every token to the current password: changing ADMIN_PASSWORD signs
// out every device at once.
function passwordVersion() {
  return crypto.createHash('sha256').update(adminConfig().pass + secret()).digest('base64url').slice(0, 12);
}

function checkCredentials(username, password) {
  secret(); // fail loudly on a misconfigured server instead of "wrong password"
  const {user, pass} = adminConfig();
  const okUser = safeEqual(String(username ?? '').trim().toLowerCase(), user);
  const okPass = safeEqual(String(password ?? ''), pass);
  return okUser && okPass;
}

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

// remember === true  → 30-day token the panel keeps across restarts.
// remember === false → 12-hour token the panel drops when the tab closes.
const SHORT_TTL = 12 * 3600;
const LONG_TTL = 30 * 24 * 3600;

function issueToken(remember) {
  const now = Math.floor(Date.now() / 1000);
  const ttl = remember ? LONG_TTL : SHORT_TTL;
  const head = b64({alg: 'HS256', typ: 'JWT'});
  const body = b64({role: 'admin', pv: passwordVersion(), iat: now, exp: now + ttl});
  const sig = crypto.createHmac('sha256', secret()).update(`${head}.${body}`).digest('base64url');
  return {token: `${head}.${body}.${sig}`, expiresAt: (now + ttl) * 1000, persistent: remember === true};
}

function verifyToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const [head, body, sig] = parts;
  const expected = crypto.createHmac('sha256', secret()).update(`${head}.${body}`).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  let header, payload;
  try {
    header = JSON.parse(Buffer.from(head, 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (header.alg !== 'HS256' || payload.role !== 'admin') return null;
  if (!payload.exp || payload.exp * 1000 < Date.now()) return null;
  if (payload.pv !== passwordVersion()) return null;
  return payload;
}

function bearer(headers) {
  const h = (headers && (headers.authorization || headers.Authorization)) || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
}

function isAdmin(headers) {
  return !!verifyToken(bearer(headers));
}

// ── Brute-force brake ────────────────────────────────────────────────────────
// Per server instance; good enough to make password guessing impractical.
const MAX_FAILS = 6;
const WINDOW_MS = 15 * 60 * 1000;
const fails = new Map();

function clientIp(headers) {
  const fwd = (headers && (headers['x-forwarded-for'] || headers['x-client-ip'])) || '';
  return String(fwd).split(',')[0].trim().replace(/:\d+$/, '') || 'unknown';
}

function lockedFor(ip) {
  const rec = fails.get(ip);
  if (!rec) return 0;
  if (Date.now() - rec.first > WINDOW_MS) { fails.delete(ip); return 0; }
  return rec.count >= MAX_FAILS ? Math.ceil((rec.first + WINDOW_MS - Date.now()) / 60000) : 0;
}

function recordFail(ip) {
  const rec = fails.get(ip);
  if (!rec || Date.now() - rec.first > WINDOW_MS) fails.set(ip, {count: 1, first: Date.now()});
  else rec.count += 1;
  if (fails.size > 5000) fails.clear();
}

function clearFails(ip) { fails.delete(ip); }

module.exports = {
  httpError,
  checkCredentials,
  issueToken,
  verifyToken,
  bearer,
  isAdmin,
  clientIp,
  lockedFor,
  recordFail,
  clearFails
};

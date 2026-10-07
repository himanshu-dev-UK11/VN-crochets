// JWT helpers for admin session tokens
const jwt = require('jsonwebtoken');

const SECRET = () => {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET must be set.');
  return s;
};

const ADMIN_USER = () => process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASS = () => process.env.ADMIN_PASSWORD;

/**
 * Verify submitted credentials. Returns true/false.
 */
function checkCredentials(username, password) {
  const expectedPass = ADMIN_PASS();
  if (!expectedPass) throw new Error('ADMIN_PASSWORD must be set.');
  return username === ADMIN_USER() && password === expectedPass;
}

/**
 * Issue a signed JWT valid for 8 hours.
 */
function issueToken() {
  return jwt.sign({ role: 'admin' }, SECRET(), { expiresIn: '8h' });
}

/**
 * Verify a token from the Authorization header.
 * Returns the decoded payload or throws.
 */
function verifyToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const err = new Error('No token provided.');
    err.status = 401;
    throw err;
  }
  try {
    return jwt.verify(authHeader.slice(7), SECRET());
  } catch {
    const err = new Error('Invalid or expired token.');
    err.status = 401;
    throw err;
  }
}

/**
 * Middleware-style helper: call at the top of any protected function.
 * Returns { payload } or writes a 401 response and returns null.
 */
function requireAdmin(req, context) {
  try {
    const payload = verifyToken(req.headers['authorization']);
    return payload;
  } catch (err) {
    context.res = {
      status: err.status || 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message })
    };
    return null;
  }
}

module.exports = { checkCredentials, issueToken, verifyToken, requireAdmin };

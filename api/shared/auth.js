// JWT helpers for admin session tokens
const jwt = require('jsonwebtoken');

const SECRET = () => {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET must be set.');
  return s;
};

const ADMIN_USER = () => process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASS = () => process.env.ADMIN_PASSWORD;

function checkCredentials(username, password) {
  const expectedPass = ADMIN_PASS();
  if (!expectedPass) throw new Error('ADMIN_PASSWORD must be set.');
  return username === ADMIN_USER() && password === expectedPass;
}

function issueToken() {
  return jwt.sign({ role: 'admin' }, SECRET(), { expiresIn: '8h' });
}

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

function requireAdmin(req, context) {
  try {
    // Functions v3 uses req.headers (object) not req.headers.get()
    const authHeader = req.headers.authorization || req.headers.Authorization || req.headers['authorization'];
    const payload = verifyToken(authHeader);
    return payload;
  } catch (err) {
    context.res = {
      status: err.status || 401,
      headers: { 'Content-Type': 'application/json' },
      body: { error: err.message }
    };
    return null;
  }
}

module.exports = { checkCredentials, issueToken, verifyToken, requireAdmin };

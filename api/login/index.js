const { checkCredentials, issueToken } = require('../shared/auth');

module.exports = async function (context, req) {
  try {
    const { username, password } = req.body;
    
    if (checkCredentials(username, password)) {
      const token = issueToken();
      context.res = {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: { token }
      };
    } else {
      context.res = {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
        body: { error: 'Invalid credentials' }
      };
    }
  } catch (err) {
    context.log('Login error:', err);
    context.res = {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: { error: err.message || 'Login failed' }
    };
  }
};

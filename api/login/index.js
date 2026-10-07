'use strict';
const { checkCredentials, issueToken } = require('../shared/auth');

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

module.exports = async function (context, req) {
  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers: HEADERS };
    return;
  }

  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '').trim();

    if (!username || !password) {
      context.res = {
        status: 400, headers: HEADERS,
        body: JSON.stringify({ error: 'username and password are required.' })
      };
      return;
    }

    if (!checkCredentials(username, password)) {
      // Deliberate vague message — don't hint which field is wrong
      context.res = {
        status: 401, headers: HEADERS,
        body: JSON.stringify({ error: 'Incorrect username or password.' })
      };
      return;
    }

    const token = issueToken();

    context.res = {
      status: 200, headers: HEADERS,
      body: JSON.stringify({ ok: true, token })
    };

  } catch (err) {
    context.log.error('login error:', err.message);
    context.res = {
      status: 500, headers: HEADERS,
      body: JSON.stringify({ error: 'Login unavailable. Please try again.' })
    };
  }
};

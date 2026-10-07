'use strict';
const { getContainer } = require('../shared/db');
const { requireAdmin } = require('../shared/auth');

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*'
};

module.exports = async function (context, req) {
  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers: HEADERS };
    return;
  }

  const auth = requireAdmin(req, context);
  if (!auth) return;

  try {
    const container = await getContainer('orders');
    const { resources } = await container.items
      .query('SELECT * FROM c ORDER BY c.placedAt DESC')
      .fetchAll();

    context.res = { status: 200, headers: HEADERS, body: JSON.stringify(resources) };
  } catch (err) {
    context.log.error('orders error:', err.message);
    context.res = { status: 500, headers: HEADERS, body: JSON.stringify({ error: 'Could not load orders.' }) };
  }
};

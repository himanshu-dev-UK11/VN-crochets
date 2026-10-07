'use strict';
const { getContainer } = require('../shared/db');
const { requireAdmin } = require('../shared/auth');

// Base products used as seed / fallback if DB is empty
const BASE_PRODUCTS = [
  {id:'1',n:'Moss the Mushroom',e:'🍄',c:'Forest',p:599,lv:1,bg:'#ffc9c9',s:'12 cm',m:[['Cotton yarn','2 skeins'],['Poly fill','30 g']],d:'A soft red cap and sleepy stitched eyes for a calm little desk corner. Makes a gentle gift for anyone who loves slow, quiet things.',care:'Spot-clean with a damp cloth. Avoid machine wash to keep the shape.',stock:5,featured:true,active:true},
  {id:'2',n:'Pip the Frog',e:'🐸',c:'Pond',p:699,lv:2,bg:'#c7f2d4',s:'15 cm',m:[['Cotton yarn','3 skeins'],['Safety eyes','2 pcs']],d:'A wide smile and bendy legs that make a cheerful shelf companion. The cotton yarn is soft enough to squeeze without squishing the shape.',care:'Hand wash cold, reshape while damp, air dry flat.',stock:4,featured:true,active:true},
  {id:'3',n:'Barley Bear',e:'🐻',c:'Forest',p:999,lv:2,bg:'#ffe0b5',s:'20 cm',m:[['Milk cotton','4 skeins'],['Poly fill','60 g']],d:'A warm, classic bear with a generous shape and an easygoing expression. The milk-cotton yarn gives it a slightly matte, grown-up finish.',care:'Hand wash cold. Squeeze out water gently, do not wring.',stock:3,featured:true,active:true},
  {id:'4',n:'Inky the Octopus',e:'🐙',c:'Pond',p:549,lv:1,bg:'#e3d4ff',s:'14 cm',m:[['Cotton yarn','2 skeins'],['Poly fill','25 g']],d:'Eight soft curly arms, made for a comforting handful and a colourful shelf.',care:'Spot-clean only — the curly arms keep their bounce better when dry.',stock:6,featured:true,active:true},
  {id:'5',n:'Clover Bunny',e:'🐰',c:'Meadow',p:799,lv:2,bg:'#ffd6ea',s:'18 cm',m:[['Velvet yarn','3 skeins'],['Wire ears','1 pair']],d:'Floppy ears, a fluffy tail, and tiny blush cheeks for a thoughtful gift.',care:'Hand wash cold in a small basin, reshape ears gently, air dry.',stock:4,featured:true,active:true},
  {id:'6',n:'Sunny Sunflower',e:'🌻',c:'Meadow',p:449,lv:1,bg:'#fff0a8',s:'25 cm',m:[['Cotton yarn','2 skeins'],['Green wire','1 stem']],d:'A bright, everlasting bloom for a desk, bedside table, or sunny corner.',care:'Keep out of direct sunlight to preserve the yellow. Dust gently.',stock:8,featured:true,active:true},
  {id:'7',n:'Tuck the Turtle',e:'🐢',c:'Pond',p:899,lv:3,bg:'#c9f0e8',s:'16 cm',m:[['Cotton yarn','3 skeins'],['Felt','1 sheet']],d:'A textured shell and removable bandana for a slow, steady companion.',care:'Remove the bandana before washing. Hand wash cold, air dry.',stock:3,featured:true,active:true},
  {id:'8',n:'Ember Fox',e:'🦊',c:'Forest',p:1199,lv:3,bg:'#ffd0b0',s:'22 cm',m:[['Milk cotton','4 skeins'],['Poly fill','70 g']],d:'A russet fox with a fluffy cream-tipped tail and a quietly confident look.',care:'Hand wash cold. The tail keeps its fluff best when air-dried away from heat.',stock:2,featured:true,active:true}
];

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*'
};

module.exports = async function (context, req) {
  // ── OPTIONS pre-flight ────────────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers: HEADERS };
    return;
  }

  try {
    const container = await getContainer('catalog');

    // ── GET /api/catalog ──────────────────────────────────────────────────
    if (req.method === 'GET') {
      const { resources } = await container.items
        .query('SELECT * FROM c ORDER BY c._ts ASC')
        .fetchAll();

      // Seed if empty
      if (!resources.length) {
        for (const p of BASE_PRODUCTS) {
          await container.items.upsert(p);
        }
        context.res = { status: 200, headers: HEADERS, body: JSON.stringify(BASE_PRODUCTS) };
        return;
      }

      // Public callers only see active products; admin sees all
      const authHeader = req.headers['authorization'];
      let isAdmin = false;
      if (authHeader) {
        try {
          const { requireAdmin: _r, verifyToken } = require('../shared/auth');
          verifyToken(authHeader);
          isAdmin = true;
        } catch { /* not admin — that's fine */ }
      }

      const result = isAdmin ? resources : resources.filter(p => p.active !== false);
      context.res = { status: 200, headers: HEADERS, body: JSON.stringify(result) };
      return;
    }

    // ── POST /api/catalog ─────────────────────────────────────────────────
    // Admin-only: replace the full catalog
    if (req.method === 'POST') {
      const auth = requireAdmin(req, context);
      if (!auth) return; // 401 already written

      const incoming = req.body;
      if (!Array.isArray(incoming)) {
        context.res = { status: 400, headers: HEADERS, body: JSON.stringify({ error: 'Expected an array.' }) };
        return;
      }

      // Upsert every product
      for (const product of incoming) {
        await container.items.upsert({ ...product, id: String(product.id) });
      }

      // Delete products no longer in the list
      const { resources: existing } = await container.items
        .query('SELECT c.id FROM c')
        .fetchAll();
      const incomingIds = new Set(incoming.map(p => String(p.id)));
      for (const { id } of existing) {
        if (!incomingIds.has(id)) {
          await container.item(id, id).delete();
        }
      }

      context.res = { status: 200, headers: HEADERS, body: JSON.stringify({ ok: true, count: incoming.length }) };
      return;
    }

    context.res = { status: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method not allowed.' }) };

  } catch (err) {
    context.log.error('catalog error:', err.message);
    context.res = {
      status: 500,
      headers: HEADERS,
      body: JSON.stringify({ error: 'Server error. Please try again.' })
    };
  }
};

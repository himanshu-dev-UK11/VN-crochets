/**
 * VN crochet – local dev server
 *
 * Serves the static site and provides three API endpoints:
 *   GET  /api/catalog          → full catalog array (JSON)
 *   POST /api/catalog          → save full catalog array (JSON body)
 *   POST /api/upload           → upload one product image, returns { url }
 *
 * Images land in /uploads/ and are served at /uploads/<filename>.
 * Catalog is persisted to /data/catalog.json.
 *
 * Run:  node server.js
 * Then open:  http://localhost:3000
 */

'use strict';

const express  = require('express');
const multer   = require('multer');
const cors     = require('cors');
const path     = require('path');
const fs       = require('fs');

const app  = express();
const PORT = 3000;
const ROOT = __dirname;
const CATALOG_FILE = path.join(ROOT, 'data', 'catalog.json');
const UPLOADS_DIR  = path.join(ROOT, 'uploads');

// ── Ensure storage directories exist ─────────────────────────────────────────
fs.mkdirSync(path.join(ROOT, 'data'),    { recursive: true });
fs.mkdirSync(UPLOADS_DIR,               { recursive: true });

// ── Multer: store uploads on disk with original extension ─────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename:    (_req,  file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase() || '.jpg';
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 },  // 4 MB
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
    cb(ok ? null : new Error('Only JPG, PNG, or WebP images are accepted.'), ok);
  }
});

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Serve uploaded images
app.use('/uploads', express.static(UPLOADS_DIR));

// Serve the entire project as static files (index.html, admin/, pages/, css/, js/)
app.use(express.static(ROOT, { index: 'index.html' }));

// ── Catalog helpers ───────────────────────────────────────────────────────────
const BASE_PRODUCTS = [
  {id:1,n:'Moss the Mushroom',e:'🍄',c:'Forest',p:599,lv:1,bg:'#ffc9c9',s:'12 cm',m:[['Cotton yarn','2 skeins'],['Poly fill','30 g']],d:'A soft red cap and sleepy stitched eyes for a calm little desk corner. Makes a gentle gift for anyone who loves slow, quiet things.',care:'Spot-clean with a damp cloth. Avoid machine wash to keep the shape.',stock:5,featured:true,active:true},
  {id:2,n:'Pip the Frog',e:'🐸',c:'Pond',p:699,lv:2,bg:'#c7f2d4',s:'15 cm',m:[['Cotton yarn','3 skeins'],['Safety eyes','2 pcs']],d:'A wide smile and bendy legs that make a cheerful shelf companion. The cotton yarn is soft enough to squeeze without squishing the shape.',care:'Hand wash cold, reshape while damp, air dry flat.',stock:4,featured:true,active:true},
  {id:3,n:'Barley Bear',e:'🐻',c:'Forest',p:999,lv:2,bg:'#ffe0b5',s:'20 cm',m:[['Milk cotton','4 skeins'],['Poly fill','60 g']],d:'A warm, classic bear with a generous shape and an easygoing expression. The milk-cotton yarn gives it a slightly matte, grown-up finish that photographs well.',care:'Hand wash cold. Squeeze out water gently, do not wring.',stock:3,featured:true,active:true},
  {id:4,n:'Inky the Octopus',e:'🐙',c:'Pond',p:549,lv:1,bg:'#e3d4ff',s:'14 cm',m:[['Cotton yarn','2 skeins'],['Poly fill','25 g']],d:'Eight soft curly arms, made for a comforting handful and a colourful shelf. A popular desk companion for anyone who likes things a little unusual.',care:'Spot-clean only — the curly arms keep their bounce better when dry.',stock:6,featured:true,active:true},
  {id:5,n:'Clover Bunny',e:'🐰',c:'Meadow',p:799,lv:2,bg:'#ffd6ea',s:'18 cm',m:[['Velvet yarn','3 skeins'],['Wire ears','1 pair']],d:'Floppy ears, a fluffy tail, and tiny blush cheeks for a thoughtful gift. The velvet yarn feels noticeably different — much softer than standard cotton.',care:'Hand wash cold in a small basin, reshape ears gently, air dry.',stock:4,featured:true,active:true},
  {id:6,n:'Sunny Sunflower',e:'🌻',c:'Meadow',p:449,lv:1,bg:'#fff0a8',s:'25 cm',m:[['Cotton yarn','2 skeins'],['Green wire','1 stem']],d:'A bright, everlasting bloom for a desk, bedside table, or sunny corner. The stem is poseable — you can angle it just right and it holds.',care:'Keep out of direct sunlight to preserve the yellow. Dust gently.',stock:8,featured:true,active:true},
  {id:7,n:'Tuck the Turtle',e:'🐢',c:'Pond',p:899,lv:3,bg:'#c9f0e8',s:'16 cm',m:[['Cotton yarn','3 skeins'],['Felt','1 sheet']],d:'A textured shell and removable bandana for a slow, steady companion. The bandana comes in whichever ribbon colour you pick at checkout.',care:'Remove the bandana before washing. Hand wash cold, air dry.',stock:3,featured:true,active:true},
  {id:8,n:'Ember Fox',e:'🦊',c:'Forest',p:1199,lv:3,bg:'#ffd0b0',s:'22 cm',m:[['Milk cotton','4 skeins'],['Poly fill','70 g']],d:'A russet fox with a fluffy cream-tipped tail and a quietly confident look. One of the most asked-about pieces — it ships in a small ribbon-tied box.',care:'Hand wash cold. The tail keeps its fluff best when air-dried away from heat.',stock:2,featured:true,active:true}
];

function readCatalog() {
  try {
    const raw = fs.readFileSync(CATALOG_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : BASE_PRODUCTS;
  } catch {
    return BASE_PRODUCTS;
  }
}

function writeCatalog(catalog) {
  fs.writeFileSync(CATALOG_FILE, JSON.stringify(catalog, null, 2), 'utf8');
}

// Seed catalog.json if it doesn't exist yet
if (!fs.existsSync(CATALOG_FILE)) {
  writeCatalog(BASE_PRODUCTS);
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/catalog  — returns the full catalog (active + drafts for admin)
app.get('/api/catalog', (_req, res) => {
  res.json(readCatalog());
});

// POST /api/catalog  — replaces the full catalog (admin saves)
app.post('/api/catalog', (req, res) => {
  const catalog = req.body;
  if (!Array.isArray(catalog)) {
    return res.status(400).json({ error: 'Expected a catalog array.' });
  }
  writeCatalog(catalog);
  res.json({ ok: true, count: catalog.length });
});

// POST /api/upload  — upload one image, get back its public URL
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file received.' });
  }
  const url = `/uploads/${req.file.filename}`;
  res.json({ ok: true, url });
});

// ── 404 fallback ──────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).send('Not found'));

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err.message);
  res.status(err.status || 500).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`\n  VN crochet dev server running at  http://localhost:${PORT}`);
  console.log(`  Admin desk:                        http://localhost:${PORT}/admin/`);
  console.log(`  API:                               http://localhost:${PORT}/api/catalog\n`);
});

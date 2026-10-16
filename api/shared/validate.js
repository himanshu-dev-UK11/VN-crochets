// Shape and clean everything the admin sends before it is stored.
// Shared by the Azure Functions and the local dev server (server.js),
// so both enforce exactly the same rules.

const DEFAULT_SETTINGS = {
  heroTitle: 'One thread, a few quiet evenings, one small friend.',
  heroText: "VN crochet is a one-person studio making soft plushies, tiny botanicals and pocket charms in small batches. Browse what's finished, or send an idea and we'll make it for you.",
  heroImage: '/images/product-sample.webp',
  heroCaption: 'Cotton yarn, hand-stitched details',
  ticker: [
    'Cotton & milk-cotton yarn',
    'Hand-finished and checked twice',
    'Care notes in every parcel',
    'Custom commissions open',
    'Ships across India'
  ],
  freeShippingFrom: 1500,
  shippingFee: 199,
  whatsapp: '918923646175'
};

const RIBBON_COUNT = 4;

class ValidationError extends Error {
  constructor(message) { super(message); this.status = 400; }
}

const str = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
const int = (v, min, max, fallback) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const num = (v, min, max, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

// Only allow image URLs this site actually produces — never javascript: or
// arbitrary third-party hosts.
const IMAGE_PATTERNS = [
  /^\/images\/[\w.-]+$/,
  /^\/api\/image\/[\w.-]+$/,
  /^https:\/\/[a-z0-9]+\.blob\.core\.windows\.net\/[\w./-]+$/
];
function cleanImage(v) {
  const s = str(v, 300);
  return IMAGE_PATTERNS.some((re) => re.test(s)) ? s : '';
}

function cleanProduct(raw, index) {
  if (!raw || typeof raw !== 'object') throw new ValidationError(`Product ${index + 1} is not valid.`);
  const n = str(raw.n, 80);
  if (!n) throw new ValidationError(`Product ${index + 1} needs a name.`);
  const p = Number(raw.p);
  if (!Number.isFinite(p) || p < 0) throw new ValidationError(`“${n}” needs a price.`);

  const materials = Array.isArray(raw.m)
    ? raw.m
        .filter((row) => Array.isArray(row) && str(row[0], 40))
        .slice(0, 12)
        .map((row) => [str(row[0], 40), str(row[1], 40)])
    : [];

  const ribbons = Array.isArray(raw.ribbons)
    ? [...new Set(raw.ribbons.map(Number).filter((r) => Number.isInteger(r) && r >= 0 && r < RIBBON_COUNT))].sort()
    : [0, 1, 2, 3];

  return {
    id: int(raw.id, 1, Number.MAX_SAFE_INTEGER, 0),
    n,
    e: str(raw.e, 8),
    c: str(raw.c, 40) || 'Other',
    p: Math.min(1000000, Math.round(p)),
    lv: int(raw.lv, 1, 5, 1),
    bg: /^#[0-9a-f]{6}$/i.test(raw.bg || '') ? raw.bg : '#f5eadf',
    s: str(raw.s, 40),
    m: materials,
    d: str(raw.d, 1200),
    care: str(raw.care, 400),
    stock: int(raw.stock, 0, 9999, 0),
    featured: raw.featured === true,
    active: raw.active !== false,
    image: cleanImage(raw.image),
    imageX: num(raw.imageX, 0, 100, 50),
    imageY: num(raw.imageY, 0, 100, 50),
    imageZoom: num(raw.imageZoom, 100, 300, 100),
    ribbons
  };
}

function cleanProducts(list) {
  if (!Array.isArray(list)) throw new ValidationError('Products must be a list.');
  if (list.length > 500) throw new ValidationError('That is more products than the shop can hold (500).');
  const out = list.map(cleanProduct);
  // Give every product a unique id; new ones arrive without one.
  const seen = new Set();
  let next = out.reduce((max, p) => Math.max(max, p.id || 0), 0) + 1;
  for (const p of out) {
    if (!p.id || seen.has(p.id)) p.id = next++;
    seen.add(p.id);
  }
  return out;
}

function cleanSettings(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const d = DEFAULT_SETTINGS;
  const ticker = Array.isArray(src.ticker)
    ? src.ticker.map((t) => str(t, 50)).filter(Boolean).slice(0, 8)
    : d.ticker;
  const whatsapp = String(src.whatsapp ?? d.whatsapp).replace(/\D/g, '');
  return {
    heroTitle: str(src.heroTitle, 90) || d.heroTitle,
    heroText: str(src.heroText, 320) || d.heroText,
    heroImage: cleanImage(src.heroImage) || d.heroImage,
    heroCaption: str(src.heroCaption, 60),
    ticker: ticker.length ? ticker : d.ticker,
    freeShippingFrom: int(src.freeShippingFrom, 0, 100000, d.freeShippingFrom),
    shippingFee: int(src.shippingFee, 0, 10000, d.shippingFee),
    whatsapp: whatsapp.length >= 10 && whatsapp.length <= 15 ? whatsapp : d.whatsapp
  };
}

const ORDER_STATUSES = ['new', 'confirmed', 'shipped', 'delivered', 'cancelled'];

function cleanOrder(raw, products, settings) {
  if (!raw || typeof raw !== 'object') throw new ValidationError('Order is not valid.');
  const name = str(raw.name, 80);
  const phone = str(raw.phone, 20);
  if (!name) throw new ValidationError('Please add your name.');
  if ((phone.match(/\d/g) || []).length < 10) throw new ValidationError('Please add a phone number we can reach you on.');
  if (!Array.isArray(raw.items) || !raw.items.length) throw new ValidationError('The order has no items.');
  if (raw.items.length > 30) throw new ValidationError('That order has too many lines.');

  // Prices come from the live catalogue when we have it, not from the browser.
  const byId = new Map((products || []).map((p) => [String(p.id), p]));
  const items = raw.items.map((it) => {
    const live = byId.get(String(it?.id));
    return {
      id: str(it?.id, 20),
      name: live ? live.n : str(it?.name, 80),
      ribbon: str(it?.ribbon, 20),
      qty: int(it?.qty, 1, 99, 1),
      price: live ? live.p : int(it?.price, 0, 1000000, 0)
    };
  });
  const subtotal = items.reduce((sum, it) => sum + it.price * it.qty, 0);
  const s = settings || DEFAULT_SETTINGS;
  const shipping = subtotal >= s.freeShippingFrom ? 0 : s.shippingFee;

  return {
    name,
    phone,
    email: str(raw.email, 120),
    city: str(raw.city, 80),
    notes: str(raw.notes, 400),
    items,
    subtotal,
    shipping,
    total: subtotal + shipping,
    status: 'new'
  };
}

module.exports = {
  DEFAULT_SETTINGS,
  ORDER_STATUSES,
  ValidationError,
  cleanProducts,
  cleanSettings,
  cleanOrder,
  cleanImage
};

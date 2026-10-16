// Catalogue + shop settings.
// The live catalogue comes from /api/catalog (edited in the admin panel).
// If the API is unreachable or hasn't been set up yet, the shop falls back to
// the copy shipped with the site in data/catalog.json, so it never shows blank.

export const PRODUCTS = [];

export const RIBBON_COLORS = ['#fffdf7', '#f7a1b8', '#a9b8f0', '#ffc94d'];
export const RIBBON_NAMES = ['Cream', 'Pink', 'Periwinkle', 'Gold'];

// Defaults match the HTML; the admin panel can change every one of them.
export const SETTINGS = {
  heroTitle: '',
  heroText: '',
  heroImage: '',
  heroCaption: '',
  ticker: [],
  freeShippingFrom: 1500,
  shippingFee: 199,
  whatsapp: '918923646175'
};

const CACHE_KEY = 'vnc.settings';

// True once settings from the admin (live or cached) have been applied.
export let settingsLoaded = false;

function applySettings(src) {
  if (!src || typeof src !== 'object') return;
  settingsLoaded = true;
  for (const key of Object.keys(SETTINGS)) {
    if (src[key] === undefined || src[key] === null) continue;
    if (typeof SETTINGS[key] === 'number') {
      const n = Number(src[key]);
      if (Number.isFinite(n) && n >= 0) SETTINGS[key] = n;
    } else if (Array.isArray(SETTINGS[key])) {
      if (Array.isArray(src[key])) SETTINGS[key] = src[key].map(String);
    } else {
      SETTINGS[key] = String(src[key]);
    }
  }
}

// Apply last-known settings straight away so returning visitors don't see
// the default hero text flash before the live settings arrive.
try { applySettings(JSON.parse(localStorage.getItem(CACHE_KEY))); } catch { /* ignore */ }

async function getJson(url, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {cache: 'no-cache', signal: ctrl.signal});
    if (!res.ok) throw new Error(`${url} → ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function usable(p) {
  return p && p.active !== false && p.id !== undefined && p.n && Number.isFinite(Number(p.p));
}

export async function initCatalog() {
  const onDisk = location.protocol === 'file:';
  let data = null;

  if (!onDisk) {
    try {
      // Generous timeout: the API can take a few seconds to wake up.
      data = await getJson(new URL('../api/catalog', import.meta.url).href, 10000);
    } catch { /* fall back below */ }
  }
  if (!data) {
    data = await getJson(new URL('../data/catalog.json', import.meta.url).href, 10000);
  }

  const products = Array.isArray(data) ? data : data && data.products;
  if (!Array.isArray(products)) throw new Error('Catalogue is not a list');

  if (!Array.isArray(data) && data.settings) {
    applySettings(data.settings);
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(data.settings)); } catch { /* ignore */ }
  }

  PRODUCTS.length = 0;
  products.filter(usable).forEach((p) => {
    // Root-relative image paths break when the site is opened from disk.
    if (onDisk && typeof p.image === 'string' && p.image.startsWith('/')) {
      p.image = new URL(`..${p.image}`, import.meta.url).href;
    }
    PRODUCTS.push(p);
  });
}

export const waLink = (text) =>
  `https://wa.me/${SETTINGS.whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

/** Ribbon colours this product offers (indices into RIBBON_*). */
export function ribbonsFor(product) {
  if (!Array.isArray(product?.ribbons)) return RIBBON_NAMES.map((_, i) => i);
  return product.ribbons.map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < RIBBON_NAMES.length);
}

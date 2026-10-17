// Catalogue + shop settings.
// The live catalogue comes from /api/catalog (edited in the admin panel).
// If the API is unreachable or hasn't been set up yet, the shop falls back to
// the copy shipped with the site in data/catalog.json, so it never shows blank.

export const PRODUCTS = [];

// Defaults match the HTML; the admin panel can change every one of them.
// ribbonColors / ribbonNames are mutated in place (never reassigned) so the
// rest of the shop can keep importing the same arrays.
export const RIBBON_COLORS = ['#fffdf7', '#f7a1b8', '#a9b8f0', '#ffc94d'];
export const RIBBON_NAMES = ['Cream', 'Pink', 'Periwinkle', 'Gold'];

export const CAT_ICONS = {};
export const CATEGORIES = [];

export const SETTINGS = {
  brandName: '',
  tagline: '',
  currency: '',
  heroTitle: '',
  heroText: '',
  heroImage: '',
  heroCaption: '',
  ticker: [],
  announcement: '',
  freeShippingFrom: 1500,
  shippingFee: 199,
  whatsapp: '918923646175',
  instagram: '',
  accent: ''
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

  if (Array.isArray(src.ribbonColors) && src.ribbonColors.length) {
    RIBBON_COLORS.length = 0;
    RIBBON_COLORS.push(...src.ribbonColors.map(String));
  }
  if (Array.isArray(src.ribbonNames) && src.ribbonNames.length) {
    RIBBON_NAMES.length = 0;
    RIBBON_NAMES.push(...src.ribbonNames.map(String));
  }

  if (Array.isArray(src.categories) && src.categories.length) {
    CATEGORIES.length = 0;
    for (const c of src.categories) {
      const name = String((c && c.name) || c || '').trim();
      if (!name) continue;
      const icon = String((c && c.icon) || '•').trim() || '•';
      CATEGORIES.push({name, icon});
      CAT_ICONS[name] = icon;
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

// The API answers {products, settings}; an older deploy may answer a bare
// array. Accept both so a stale backend never empties the shelf.
function unpack(data) {
  if (Array.isArray(data)) return {products: data, settings: null};
  if (data && Array.isArray(data.products)) return {products: data.products, settings: data.settings || null};
  return null;
}

export async function initCatalog() {
  const onDisk = location.protocol === 'file:';
  let payload = null;

  if (!onDisk) {
    try {
      // Generous timeout: the API can take a few seconds to wake up.
      payload = unpack(await getJson(new URL('../api/catalog', import.meta.url).href, 10000));
    } catch { /* fall back below */ }
  }
  if (!payload) {
    payload = unpack(await getJson(new URL('../data/catalog.json', import.meta.url).href, 10000));
  }
  if (!payload) throw new Error('Catalogue is not a list');

  if (payload.settings) {
    applySettings(payload.settings);
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(payload.settings)); } catch { /* ignore */ }
  }

  PRODUCTS.length = 0;
  payload.products.filter(usable).forEach((p) => {
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

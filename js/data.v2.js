// Catalog is loaded from data/catalog.json at runtime.
// Call initCatalog() once before using PRODUCTS; it populates the array in-place.

export const PRODUCTS = [];

export async function initCatalog() {
  // Support both file:// (VS Code preview) and http:// (local server / live site)
  const base = window.location.protocol === 'file:'
    ? window.location.href.replace(/\/[^/]*$/, '')  // same directory as index.html
    : '';
  const url = base ? base + '/data/catalog.json' : '/data/catalog.json';

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Server ${res.status}`);
    const all = await res.json();
    // Only show published items to shoppers
    const active = all.filter(p => p.active !== false);
    PRODUCTS.length = 0;
    active.forEach(p => PRODUCTS.push(p));
  } catch (err) {
    console.warn('Could not load catalog.', err);
    // Empty — do not show demo products on a real shop
    PRODUCTS.length = 0;
  }
}

export const RIBBON_COLORS=['#fffdf7','#f7a1b8','#a9b8f0','#ffc94d'];
export const RIBBON_NAMES=['Cream','Pink','Periwinkle','Gold'];
export const SHIPPING_THRESHOLD=1500;

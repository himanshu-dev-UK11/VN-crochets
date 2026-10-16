const KEY = 'vnc.v1';
const defaults = {cart: [], cat: 'All', sort: 'feat', query: ''};

export function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (!saved || typeof saved !== 'object') return {...defaults};
    const state = {...defaults, ...saved};
    // Never trust persisted data: keep only well-formed cart lines.
    state.cart = Array.isArray(state.cart)
      ? state.cart
          .filter((l) => l && l.id !== undefined && Number(l.q) > 0)
          .map((l) => ({id: l.id, q: Math.min(99, Math.max(1, Math.round(Number(l.q)))), c: typeof l.c === 'string' ? l.c.slice(0, 20) : ''}))
      : [];
    return state;
  } catch {
    return {...defaults};
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch { /* storage full or blocked — the session still works */ }
}

/** Drop cart lines whose product no longer exists in the catalogue. */
export function pruneCart(state, products) {
  if (!products.length) return state.cart;
  const before = state.cart.length;
  state.cart = state.cart.filter((l) => products.some((p) => String(p.id) === String(l.id)));
  if (state.cart.length !== before) saveState(state);
  return state.cart;
}

export function itemCount(state) {
  return state.cart.reduce((n, l) => n + l.q, 0);
}

export function subtotal(state, products) {
  return state.cart.reduce((sum, line) => {
    const product = products.find((p) => String(p.id) === String(line.id));
    return product ? sum + product.p * line.q : sum;
  }, 0);
}

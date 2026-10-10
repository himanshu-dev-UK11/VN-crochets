// Catalog is loaded from data/catalog.json at runtime.
// Call initCatalog() once before using PRODUCTS; it populates the array in-place.

export const PRODUCTS = [];

export async function initCatalog() {
  try {
    const res = await fetch('/data/catalog.json');
    if (!res.ok) throw new Error(`Server ${res.status}`);
    const all = await res.json();
    // Only show published items to shoppers
    const active = all.filter(p => p.active !== false);
    PRODUCTS.length = 0;
    active.forEach(p => PRODUCTS.push(p));
  } catch (err) {
    console.warn('Could not load catalog, using built-in defaults.', err);
    // Fallback so the shop is never completely empty
    const defaults = [
      {id:1,n:'Moss the Mushroom',e:'🍄',c:'Forest',p:599,lv:1,bg:'#ffc9c9',s:'12 cm',m:[['Cotton yarn','2 skeins'],['Poly fill','30 g']],d:'A soft red cap and sleepy stitched eyes for a calm little desk corner.',care:'Spot-clean with a damp cloth.',stock:5,featured:true,active:true},
      {id:2,n:'Pip the Frog',e:'🐸',c:'Pond',p:699,lv:2,bg:'#c7f2d4',s:'15 cm',m:[['Cotton yarn','3 skeins'],['Safety eyes','2 pcs']],d:'A wide smile and bendy legs that make a cheerful shelf companion.',care:'Hand wash cold, reshape while damp, air dry flat.',stock:4,featured:true,active:true},
      {id:3,n:'Barley Bear',e:'🐻',c:'Forest',p:999,lv:2,bg:'#ffe0b5',s:'20 cm',m:[['Milk cotton','4 skeins'],['Poly fill','60 g']],d:'A warm classic bear with a generous shape.',care:'Hand wash cold. Squeeze out water gently, do not wring.',stock:3,featured:true,active:true},
      {id:4,n:'Inky the Octopus',e:'🐙',c:'Pond',p:549,lv:1,bg:'#e3d4ff',s:'14 cm',m:[['Cotton yarn','2 skeins'],['Poly fill','25 g']],d:'Eight soft curly arms for a colourful shelf.',care:'Spot-clean only.',stock:6,featured:true,active:true},
      {id:5,n:'Clover Bunny',e:'🐰',c:'Meadow',p:799,lv:2,bg:'#ffd6ea',s:'18 cm',m:[['Velvet yarn','3 skeins'],['Wire ears','1 pair']],d:'Floppy ears and tiny blush cheeks for a thoughtful gift.',care:'Hand wash cold in a small basin, reshape ears gently, air dry.',stock:4,featured:true,active:true},
      {id:6,n:'Sunny Sunflower',e:'🌻',c:'Meadow',p:449,lv:1,bg:'#fff0a8',s:'25 cm',m:[['Cotton yarn','2 skeins'],['Green wire','1 stem']],d:'A bright everlasting bloom for any desk corner.',care:'Keep out of direct sunlight.',stock:8,featured:true,active:true},
      {id:7,n:'Tuck the Turtle',e:'🐢',c:'Pond',p:899,lv:3,bg:'#c9f0e8',s:'16 cm',m:[['Cotton yarn','3 skeins'],['Felt','1 sheet']],d:'A textured shell and removable bandana.',care:'Remove the bandana before washing. Hand wash cold, air dry.',stock:3,featured:true,active:true},
      {id:8,n:'Ember Fox',e:'🦊',c:'Forest',p:1199,lv:3,bg:'#ffd0b0',s:'22 cm',m:[['Milk cotton','4 skeins'],['Poly fill','70 g']],d:'A russet fox with a fluffy cream-tipped tail.',care:'Hand wash cold.',stock:2,featured:true,active:true}
    ];
    PRODUCTS.length = 0;
    defaults.forEach(p => PRODUCTS.push(p));
  }
}

export const RIBBON_COLORS=['#fffdf7','#f7a1b8','#a9b8f0','#ffc94d'];
export const RIBBON_NAMES=['Cream','Pink','Periwinkle','Gold'];
export const SHIPPING_THRESHOLD=1500;

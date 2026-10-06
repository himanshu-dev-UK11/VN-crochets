const KEY='kp';
const defaults={cart:[],pts:0,cat:'All',sort:'feat',query:'',claimed:false,said:0};
export function loadState(){try{const saved=JSON.parse(localStorage.getItem(KEY));return saved?Object.assign({},defaults,saved):{...defaults}}catch{return {...defaults}}}
export function saveState(state){try{localStorage.setItem(KEY,JSON.stringify(state))}catch{}}
export function itemCount(state){return state.cart.reduce((sum,item)=>sum+item.q,0)}
export function subtotal(state,products){return state.cart.reduce((sum,item)=>{const product=products.find(entry=>entry.id===item.id);return sum+item.q*product.p},0)}
export function total(state,products){return subtotal(state,products)*(state.claimed?.9:1)}
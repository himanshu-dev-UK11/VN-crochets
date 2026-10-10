import {PRODUCTS,RIBBON_COLORS,RIBBON_NAMES,SHIPPING_THRESHOLD,initCatalog} from './data.v2.js';
import {loadState,saveState,itemCount,subtotal,total} from './store.v2.js';
const state=loadState();const $=selector=>document.querySelector(selector);const money=value=>'₹'+value.toLocaleString('en-IN');
const art=(product, className='', label=false, contain=false)=>{
  if(product.image){
    const x=product.imageX??50, y=product.imageY??50, z=product.imageZoom||100;
    // contain=true for modal: show full image regardless of position/zoom settings
    const size = contain ? 'contain' : z+'%';
    const pos  = contain ? 'center' : x+'% '+y+'%';
    return `<div class="art ${className}" style="background-color:${product.bg};background-image:url('${product.image}');background-position:${pos};background-size:${size};background-repeat:no-repeat;">${label?`<span class="lv">${product.c}</span>`:''}</div>`;
  }
  return `<div class="art ${className}" style="background:${product.bg}">${label?`<span class="lv">${product.c}</span>`:''}${product.e}</div>`;
};
const toast=(message)=>{const element=$('#toast');element.textContent=message;element.classList.add('on');clearTimeout(toast.timer);toast.timer=setTimeout(()=>element.classList.remove('on'),2200)};

// ── Keyboard focus trap ────────────────────────────────────────────────────
function trapFocus(container){
  const focusable='button:not([disabled]),a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])';
  const elements=[...container.querySelectorAll(focusable)].filter(el=>!el.closest('[hidden]'));
  if(!elements.length)return;
  const first=elements[0];const last=elements[elements.length-1];
  function onKey(e){
    if(e.key!=='Tab')return;
    if(e.shiftKey){if(document.activeElement===first){e.preventDefault();last.focus();}}
    else{if(document.activeElement===last){e.preventDefault();first.focus();}}
  }
  container._trapHandler=onKey;
  container.addEventListener('keydown',onKey);
  // Focus first element when trap activates
  setTimeout(()=>first.focus(),50);
}
function releaseFocus(container){
  if(container._trapHandler){container.removeEventListener('keydown',container._trapHandler);delete container._trapHandler;}
}

// skeleton HTML for a single placeholder card
const SKEL_CARD=`<div class="skel-card" aria-hidden="true"><div class="skel-art skel-bone"></div><div class="skel-title skel-bone"></div><div class="skel-sub skel-bone"></div><div class="skel-price skel-bone"></div></div>`;
let _gridFirstRender=true;

function renderGrid(){
  const categories=['All',...new Set(PRODUCTS.map(product=>product.c))];
  $('#filters').innerHTML=
    `<label class="search">Find a piece<input id="search" type="search" placeholder="Mushroom, frog, forest..." value="${state.query}"></label>`+
    categories.map(category=>`<button class="pill" aria-pressed="${category===state.cat}" data-category="${category}">${category}</button>`).join('')+
    `<select id="sort" aria-label="Sort products"><option value="feat">Featured</option><option value="lo">Price: low</option><option value="hi">Price: high</option></select>`;
  $('#sort').value=state.sort;

  const query=state.query.trim().toLowerCase();
  let products=PRODUCTS.filter(product=>(state.cat==='All'||product.c===state.cat)&&(!query||`${product.n} ${product.c} ${product.d}`.toLowerCase().includes(query)));
  if(state.sort==='lo')products.sort((a,b)=>a.p-b.p);
  if(state.sort==='hi')products.sort((a,b)=>b.p-a.p);

  // task #10 — collection heading
  const heading=products.length?`<h2 class="collection-heading">${state.cat==='All'?'The collection':state.cat}</h2>`:'';
  const realHTML=heading+(products.length
    ?products.map(product=>`<button class="item" data-product="${product.id}">${art(product,'',true)}<h3>${product.n}</h3><div class="price"><span>${product.s}</span><b>${money(product.p)}</b></div></button>`).join('')
    :'<div class="panel empty"><h3>Nothing matched that search.</h3><p>Try a different name, collection, or material.</p></div>');

  const grid=$('#grid');

  if(_gridFirstRender){
    _gridFirstRender=false;
    requestAnimationFrame(()=>{
      grid.innerHTML=realHTML;
      grid.removeAttribute('aria-busy');
      if(window._reObserveGrid)window._reObserveGrid();
    });
  } else {
    grid.setAttribute('aria-busy','true');
    grid.innerHTML=`<div class="skel-heading skel-bone"></div>${SKEL_CARD.repeat(Math.max(products.length,4))}`;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      grid.innerHTML=realHTML;
      grid.removeAttribute('aria-busy');
      if(window._reObserveGrid)window._reObserveGrid();
    }));
  }
}

function renderQuests(){
  const count=itemCount(state);
  const completed=[count>=1,count>=3,subtotal(state,PRODUCTS)>=SHIPPING_THRESHOLD];
  const done=completed.filter(Boolean).length;
  $('#qm').style.width=done/3*100+'%';
  const label=$('#qprogress-label');if(label)label.textContent=done===0?'No quests completed yet':done===3?'All quests complete — claim your reward below!':`${done} of 3 quests complete`;
  // task #8 — first-time nudge
  const nudge=count===0?`<p class="quest-nudge">Start by adding any piece to your bag — your first reward is one step away.</p>`:'';
  const quests=[['🎒','First find','Add any piece to your bag'],['🧸','Collection starter','Keep three or more pieces in your bag'],['🚚','Free shipping',`Reach ${money(SHIPPING_THRESHOLD)} in your bag`]];
  $('#qlist').innerHTML=nudge+quests.map((quest,index)=>`<div class="quest ${completed[index]?'done dark-ink':''}"><div class="art" style="background:var(--sun)">${quest[0]}</div><div><b class="f">${quest[1]}</b><br><small>${quest[2]}</small></div><b>${completed[index]?'✅':'—'}</b></div>`).join('')+`<p><button class="btn" id="claim" ${done===3&&!state.claimed?'':'disabled'}>${state.claimed?'Reward claimed':'Claim 10% off'}</button></p>`;
}

function renderBag(){
  const sum=subtotal(state,PRODUCTS);
  const percent=Math.min(100,sum/SHIPPING_THRESHOLD*100);
  // tasks #4 #12 #14 — line totals, empty state with shop button, bag row improvements
  const emptyState=`<div class="bag-empty"><p style="color:var(--soft)">Your bag is empty. Browse the collection and find a piece you love.</p><button class="btn" id="bagGoShop">Browse the collection</button></div>`;
  const itemRows=state.cart.length?state.cart.map((item,index)=>{
    const product=PRODUCTS.find(entry=>entry.id===item.id);
    return `<div class="row"><div>${art(product,"",false,true)}</div><div><b>${product.n}</b><br><small>${item.c} ribbon · ${money(product.p)}</small></div><div class="bag-item-right"><div class="qty"><button data-index="${index}" data-delta="-1" aria-label="Remove one ${product.n}">−</button><b>${item.q}</b><button data-index="${index}" data-delta="1" aria-label="Add one more ${product.n}">+</button></div><b class="line-total">${money(product.p*item.q)}</b></div></div>`;
  }).join(''):emptyState;

  $('#bagp').innerHTML=
    `<button class="x" aria-label="Close bag">✕</button><h2 style="font-size:26px">Your bag</h2>`+
    `<div><small>${sum>=SHIPPING_THRESHOLD?'🎉 Free shipping unlocked!':money(SHIPPING_THRESHOLD-sum)+' more for free shipping'}</small><div class="meter"><i style="width:${percent}%"></i></div></div>`+
    itemRows+
    `<div style="margin-top:auto">${state.claimed?`<div class="mat"><span>Reward −10%</span><span>−${money(subtotal(state,PRODUCTS)*.1)}</span></div>`:''}<div class="mat"><span>Total</span><b class="f">${money(total(state,PRODUCTS))}</b></div><button class="btn g" style="width:100%" id="buy" ${state.cart.length?'':'disabled'}>Go to checkout</button></div>`;
}

function update(){$('#cnt').textContent=itemCount(state);$('#pts').textContent=state.pts;renderQuests();renderBag();saveState(state);}

function closeOverlays(){
  const modal=$('#modal');const drawer=$('#drawer');
  releaseFocus(modal);releaseFocus(drawer);
  modal.classList.remove('on');drawer.classList.remove('on');
}

function openProduct(id){
  const product=PRODUCTS.find(entry=>entry.id===Number(id));
  let color=0;let quantity=1;
  // task #11 — richer ribbon selector, task #17 — care notes
  const draw=()=>{
    const careRow=product.care?`<div class="mat care-row"><span>🧺 Care</span><span>${product.care}</span></div>`:'';
    $('#mcard').innerHTML=
      `<button class="x" aria-label="Close details">✕</button>`+
      `<div class="rec">${art(product,"",false,true)}<div>`+
      `<span class="tag">Crafting recipe · LV ${product.lv}</span>`+
      `<h2 style="font-size:26px">${product.n}</h2>`+
      `<p style="color:var(--soft);margin:6px 0">${product.d}</p>`+
      product.m.map(material=>`<div class="mat"><span>${material[0]}</span><span>${material[1]}</span></div>`).join('')+
      `<div class="mat"><span>Size</span><span>${product.s}</span></div>`+
      careRow+
      (product.ribbons&&product.ribbons.length?`<div class="ribbon-label">Ribbon: <b>${RIBBON_NAMES[color]}</b></div>`+
      `<div class="sw" role="group" aria-label="Choose ribbon colour">${product.ribbons.map(index=>`<button style="background:${RIBBON_COLORS[index]}" data-color="${index}" aria-pressed="${index===color}" aria-label="${RIBBON_NAMES[index]} ribbon" title="${RIBBON_NAMES[index]}"><span class="ribbon-check">${index===color?'✓':''}</span></button>`).join('')}</div>`:'')+
      
      `<div style="display:flex;align-items:center;gap:12px;margin-top:10px"><div class="qty"><button data-quantity="-1" aria-label="Decrease quantity">−</button><b>${quantity}</b><button data-quantity="1" aria-label="Increase quantity">+</button></div><b class="f" style="font-size:22px">${money(product.p*quantity)}</b></div>`+
      `<p style="margin:10px 0 0"><button class="btn" data-add>Add to backpack</button></p>`+
      `</div></div>`;
  };
  draw();
  $('#modal').classList.add('on');
  trapFocus($('#mcard'));
  $('#mcard').onclick=event=>{
    const target=event.target;
    if(target.closest('.x'))return closeOverlays();
    if(target.dataset.color!==undefined&&product.ribbons&&product.ribbons.length){color=Number(target.dataset.color);draw();trapFocus($('#mcard'));}
    if(target.dataset.quantity){quantity=Math.max(1,Math.min(9,quantity+Number(target.dataset.quantity)));draw();trapFocus($('#mcard'));}
    if(target.dataset.add!==undefined){addToCart(product.id,quantity,(product.ribbons&&product.ribbons.length)?RIBBON_NAMES[color]:'None');closeOverlays();}
  };
}

function addToCart(id,quantity,color){
  const item=state.cart.find(entry=>entry.id===id&&entry.c===color);
  item?item.q+=quantity:state.cart.push({id,q:quantity,c:color});
  toast('Added to backpack 🎒');
  update();
}

function showView(view){
  document.querySelectorAll('.view').forEach(element=>element.classList.toggle('on',element.id==='v-'+view));
  document.querySelectorAll('.tabs button').forEach(button=>button.setAttribute('aria-selected',button.dataset.view===view));
  scrollTo(0,0);
  // Re-trigger reveals for the newly visible section
  if(window._reObserveReveals)window._reObserveReveals();
}

// task #16 — mascot point feedback
const heroLines=['Hi hi!','I am 100% cotton.','Adopt me?','Stitch count: yes.','You found a secret ⭐'];

document.addEventListener('click',event=>{
  const target=event.target;
  const tab=target.closest('.tabs button');
  if(tab)showView(tab.dataset.view);
  if(target.id==='goShop')$('#filters').scrollIntoView({behavior:'smooth'});
  if(target.dataset.category){state.cat=target.dataset.category;renderGrid();}
  if(target.closest('.item'))openProduct(target.closest('.item').dataset.product);
  if(target.id==='modal')closeOverlays();
  if(target.closest('#openBag')){$('#drawer').classList.add('on');renderBag();trapFocus($('#bagp'));}
  if(target.id==='drawer'||target.closest('#bagp .x')){$('#drawer').classList.remove('on');releaseFocus($('#bagp'));}
  // task #14 — bag empty state "browse" button
  if(target.id==='bagGoShop'){$('#drawer').classList.remove('on');releaseFocus($('#bagp'));showView('shop');}
  if(target.dataset.delta){
    const index=Number(target.dataset.index);
    const item=state.cart[index];
    item.q+=Number(target.dataset.delta);
    if(item.q<1)state.cart.splice(index,1);
    update();
    // re-trap focus after re-render
    trapFocus($('#bagp'));
  }
  if(target.id==='claim'){state.claimed=true;toast('10% off unlocked 🎉');update();}
  if(target.id==='buy'){closeOverlays();saveState(state);window.location.assign('pages/checkout.html');}
  if(target.id==='hero'){
    $('#heroSay').textContent=heroLines[state.said%heroLines.length];
    state.said++;
    if(state.said%5===0){
      state.pts+=5;
      // task #16 — visible feedback for points earned
      toast('✨ +5 Pal Points earned!');
      update();
    } else {
      saveState(state);
    }
  }
});

document.addEventListener('input',event=>{
  if(event.target.id==='search'){
    state.query=event.target.value;
    const cursor=event.target.selectionStart;
    renderGrid();
    $('#search').focus();
    $('#search').setSelectionRange(cursor,cursor);
  }
});
document.addEventListener('change',event=>{
  if(event.target.id==='sort'){state.sort=event.target.value;renderGrid();}
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape')closeOverlays();
});

// ── Input helpers ────────────────────────────────────────────────────────
function sanitise(str,maxLen=200){
  return String(str).trim().replace(/[<>]/g,'').slice(0,maxLen);
}
function setFieldError(field,message){
  let err=field.parentElement.querySelector('.field-error');
  if(!err){err=document.createElement('span');err.className='field-error';field.after(err);}
  err.textContent=message;
  field.setAttribute('aria-invalid','true');
  field.setAttribute('aria-describedby',err.id=(err.id||`err-${Math.random().toString(36).slice(2)}`));
}
function clearFieldError(field){
  const err=field.parentElement.querySelector('.field-error');
  if(err)err.textContent='';
  field.removeAttribute('aria-invalid');
}

$('#req').addEventListener('submit',event=>{
  event.preventDefault();
  const nameEl=$('#rn');
  const descEl=$('#rd');
  let valid=true;

  const name=sanitise(nameEl.value,80);
  const desc=sanitise(descEl.value,500);

  clearFieldError(nameEl);
  clearFieldError(descEl);

  if(!name){setFieldError(nameEl,'Please enter your name.');valid=false;}
  if(!desc){setFieldError(descEl,'Please describe what you have in mind.');valid=false;}
  else if(desc.length<10){setFieldError(descEl,'A little more detail helps us quote accurately.');valid=false;}

  if(!valid)return;

  // Write sanitised values back so they appear correctly if re-read
  nameEl.value=name;
  descEl.value=desc;

  toast(`Request posted, ${name}! We'll quote within 48h 📮`);
  event.target.reset();
});

// Boot: fetch live catalog from server, then render everything
initCatalog().then(() => {
  renderGrid();
  update();
});

// ── Task #8: Scroll-triggered section reveals ────────────────────────────
(function initReveal(){
  // Observer for .reveal panels
  const io=new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if(e.isIntersecting){
        // small delay so the tab-switch paint settles first
        setTimeout(()=>e.target.classList.add('revealed'),30);
        io.unobserve(e.target);
      }
    });
  },{threshold:0.06,rootMargin:'0px 0px -20px 0px'});

  // Observer for the product grid stagger
  const gridIo=new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if(e.isIntersecting){e.target.classList.add('grid-revealed');gridIo.unobserve(e.target);}
    });
  },{threshold:0.05,rootMargin:'0px 0px -20px 0px'});

  // Observer for the studio-notes strip
  const notesIo=new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if(e.isIntersecting){e.target.classList.add('revealed');notesIo.unobserve(e.target);}
    });
  },{threshold:0.1,rootMargin:'0px 0px -30px 0px'});

  function observeAll(){
    // (re-)observe every .reveal that hasn't been revealed yet
    document.querySelectorAll('.reveal:not(.revealed)').forEach(el=>io.observe(el));
    const notes=document.querySelector('.studio-notes:not(.revealed)');
    if(notes)notesIo.observe(notes);
  }

  // Initial pass
  observeAll();

  const grid=$('#grid');
  if(grid)gridIo.observe(grid);

  // Expose hooks for tab-switch and grid re-render
  window._reObserveReveals=observeAll;
  window._reObserveGrid=function(){
    const g=$('#grid');
    if(g){g.classList.remove('grid-revealed');gridIo.observe(g);}
  };
})();

/* APRILS SIGNATURE — PUBLIC FINAL CORRECTIONS
   Keeps public training classes in sync with admin pricing records.
*/
(function(){
'use strict';
const wait=()=>new Promise(resolve=>{let n=0;const t=setInterval(()=>{const d=window.aprilsSupabase||window.AprilsSupabase;if(d||++n>120){clearInterval(t);resolve(d||null)}},100)});
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const norm=v=>String(v||'').trim().toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
async function loadPrices(){
 const d=await wait();if(!d)return;
 try{
  const r=await d.from('settings').select('setting_key,setting_value').like('setting_key','public_training_price_%');
  if(r.error)return;
  const prices=new Map((r.data||[]).map(x=>{try{const v=JSON.parse(x.setting_value||'{}');return [norm(v.name),v]}catch(_){return null}}).filter(Boolean));
  document.querySelectorAll('.training-category').forEach(cat=>{
    cat.querySelectorAll('li,h4').forEach(el=>{
      const key=norm(el.textContent);const p=prices.get(key);if(!p||p.price===undefined||p.price==='')return;
      if(el.dataset.publicPriceDone==='1')return;
      const price=document.createElement('span');price.className='training-public-price';price.innerHTML=` — <strong>Price: GHS ${Number(p.price).toFixed(2)}</strong>`;el.appendChild(price);el.dataset.publicPriceDone='1';
    });
  });
  // Top programme cards are also refreshed from the same admin records.
  document.querySelectorAll('.training-card').forEach(card=>{
    const title=norm(card.querySelector('h3')?.textContent);const p=prices.get(title);if(!p||p.price===undefined||p.price==='')return;
    let el=card.querySelector('.training-public-price');if(!el){el=document.createElement('p');el.className='training-public-price';card.querySelector('h3')?.after(el)}
    el.innerHTML=`<strong>Price:</strong> GHS ${Number(p.price).toFixed(2)}`;
  });
 }catch(e){console.warn('Public training price sync unavailable:',e)}
}
function addStyle(){if(document.getElementById('publicFinalCorrectionsStyle'))return;const s=document.createElement('style');s.id='publicFinalCorrectionsStyle';s.textContent='.training-public-price{display:inline-block;margin-left:4px;font-weight:600}.training-card .training-public-price{display:block;margin:6px 0}';document.head.appendChild(s)}
function boot(){addStyle();if(document.body.classList.contains('training-page'))setTimeout(loadPrices,900)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();

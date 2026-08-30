 "use strict";
/* 2026-08-30 reliability and cross-device integration pass */
(function(){
 const ORDER=["pending","invoice_generated","deposit_paid","part_paid","confirmed","in_production","completed","ready","full_payment","dispatched","received","cancelled"];
 const ORDER_LABEL={pending:"Pending",invoice_generated:"Invoice Generated",deposit_paid:"Deposit Paid",part_paid:"Part Paid",confirmed:"Confirmed / Order Taken",in_production:"In Production",completed:"Completed",ready:"Ready for Collection / Delivery",full_payment:"Full Payment",dispatched:"Dispatched",received:"Received by Customer",cancelled:"Cancelled"};
 const TRAINING=["pending","invoice_generated","part_paid","fully_paid","in_class","completed","stopped","cancelled"];
 const TRAINING_LABEL={pending:"Pending",invoice_generated:"Invoice Generated",part_paid:"Part Paid",fully_paid:"Fully Paid",in_class:"In Class",completed:"Completed",stopped:"Stopped",cancelled:"Cancelled"};
 function cap(v){return String(v||"").replace(/\b([a-z])/g,(m,c)=>c.toUpperCase())}
 function persistSection(){
   const hash=location.hash;
   if(hash) sessionStorage.setItem("aprils-admin-section",hash);
   document.addEventListener("click",e=>{
     const b=e.target.closest("[data-section],a[href^='#'],button[data-target]");
     if(!b)return;
     const x=b.dataset.section||b.dataset.target||(b.getAttribute("href")||"").slice(1);
     if(x) sessionStorage.setItem("aprils-admin-section","#"+x);
   },true);
   if(!hash){const saved=sessionStorage.getItem("aprils-admin-section");if(saved){setTimeout(()=>{const el=document.querySelector(`[data-section="${CSS.escape(saved.slice(1))}"],a[href="${saved}"],#${CSS.escape(saved.slice(1))}`);if(el&&el.matches("button,a"))el.click()},300)}}
 }
 function fixButtons(){
   document.addEventListener("click",async e=>{
     const b=e.target.closest("button,a");
     if(!b)return;
     const t=(b.textContent||"").trim().toLowerCase();
     if(t.includes("whatsapp") && !b.dataset.aprilsBound){
       b.dataset.aprilsBound="1";
       // preserve existing click logic; only prevent dead links from showing an intermediate chooser
       const phone=(b.dataset.phone||b.dataset.whatsapp||"").replace(/\D/g,"");
       if(phone && (!b.getAttribute("href") || b.getAttribute("href")==="#")) b.href=`https://wa.me/${phone}`;
     }
   },true);
 }
 function formatDates(){
   const fmt=new Intl.DateTimeFormat("en-GB",{timeZone:"GMT",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false});
   window.aprilsFormatDateGMT=v=>v?fmt.format(new Date(v)).replace(",","")+" GMT":"—";
 }
 function clearSavedForms(){
   document.addEventListener("submit",e=>{
     const f=e.target;
     setTimeout(()=>{ if(f.dataset.keepValues!=="true" && !f.querySelector(":invalid")) f.querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio]),textarea").forEach(x=>{if(x.type==="file")x.value="";}); },600);
   },true);
 }
 function topScrollControls(){
   document.querySelectorAll(".table-wrap,.table-container,.spreadsheet,.final-spreadsheet").forEach(box=>{
     if(box.dataset.topScroll)return; box.dataset.topScroll="1";
     const c=document.createElement("div");c.className="aprils-table-arrows";
     c.innerHTML='<button type="button" aria-label="Scroll table left">◀</button><button type="button" aria-label="Scroll table right">▶</button>';
     c.querySelectorAll("button")[0].onclick=()=>box.scrollBy({left:-300,behavior:"smooth"});
     c.querySelectorAll("button")[1].onclick=()=>box.scrollBy({left:300,behavior:"smooth"});
     box.parentNode.insertBefore(c,box);
   });
 }
 function statusNormalization(){
   document.querySelectorAll("select").forEach(sel=>{
     const scope=(sel.closest("[id*='train'],[class*='train']")? "training":"order");
     if(!/(status|order|payment)/i.test(sel.name+" "+sel.id+" "+sel.className))return;
     const list=scope==="training"?TRAINING:ORDER, labels=scope==="training"?TRAINING_LABEL:ORDER_LABEL;
     const existing=[...sel.options].map(o=>o.value);
     if(existing.length && existing.some(v=>list.includes(v))){ // reorder only relevant status selectors
       const current=sel.value;
       list.forEach(v=>{const o=[...sel.options].find(x=>x.value===v);if(o)sel.appendChild(o);});
       if(current)sel.value=current;
     }
   });
 }
 function boot(){
   persistSection(); fixButtons(); formatDates(); clearSavedForms(); statusNormalization(); topScrollControls();
   new MutationObserver(()=>{topScrollControls();statusNormalization()}).observe(document.body,{childList:true,subtree:true});
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();
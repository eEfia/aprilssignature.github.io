/* Comprehensive correction layer — September 2, 2026.
   This file intentionally augments the existing admin application without replacing its data model. */
(function(){'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const msg=(t,k='success')=>window.message?window.message(t,k):console[k==='error'?'errlog'](t);

/* 1) Stable wording everywhere requested. */
function normalizeLabels(){
  $$('button,a').forEach(el=>{const t=(el.textContent||'').trim();
    if(/^share$/i.test(t)) el.textContent='Share PDF';
    if(/^view(?: details)?$/i.test(t)) el.textContent='View Full Details';
  });
}

/* 2) Search + Share PDF + Print controls for data sections that do not already have them. */
function controls(){
  $$('.section').forEach(section=>{
    if(section.dataset.comprehensiveControls) return;
    const table=section.querySelector('table'); if(!table) return;
    section.dataset.comprehensiveControls='1';
    const bar=document.createElement('div'); bar.className='comprehensive-table-controls';
    bar.innerHTML='<input type="search" placeholder="Search by name, item, record, month or year" aria-label="Search records"><button type="button" class="secondary">Share PDF</button><button type="button" class="secondary">Print</button>';
    table.parentElement?.insertBefore(bar,table);
    const input=$('input',bar); input.addEventListener('input',()=>{const q=input.value.trim().toLowerCase(); $$('tbody tr',table).forEach(r=>r.hidden=!!q&&!r.textContent.toLowerCase().includes(q));});
    $('button:nth-of-type(1)',bar).onclick=()=>shareNode(table,section.querySelector('h1,h2,h3')?.textContent||document.title);
    $('button:nth-of-type(2)',bar).onclick=()=>printNode(table,section.querySelector('h1,h2,h3')?.textContent||document.title);
  });
}
function printableHtml(node,title){return '<!doctype html><html><head><meta charset="utf-8"><title>'+esc(title)+'</title><style>body{font-family:Arial,sans-serif;padding:20px;color:#111}table{width:100%;border-collapse:collapse}th,td{border:1px solid #888;padding:7px;text-align:left;vertical-align:top;overflow-wrap:anywhere}button,.comprehensive-table-controls{display:none!important}</style></head><body><h2>'+esc(title)+'</h2>'+node.outerHTML+'</body></html>';}
function printNode(node,title){const w=open('','_blank','noopener,noreferrer');if(!w)return msg('Please allow pop-ups to print this document.','error');w.document.write(printableHtml(node,title));w.document.close();w.focus();setTimeout(()=>w.print(),250);}
async function shareNode(node,title){
  const html=printableHtml(node,title);
  try{if(window.jspdf?.jsPDF){const doc=new window.jspdf.jsPDF();doc.html(html,{callback:d=>{const f=new File([d.output('blob')],(title||'document')+'.pdf',{type:'application/pdf'});navigator.share?.({title,files:[f]}).catch(()=>{});}});return;}
    if(navigator.share){await navigator.share({title,text:'Aprils Signature — '+title}); return;}
  }catch(e){if(e?.name==='AbortError')return;}
  printNode(node,title);
}

/* 3) Every Share PDF button has a functional fallback; Print works on generated/saved documents. */
function bindSharePrint(){
  document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const t=(b.textContent||'').trim();
    if(/^share pdf$/i.test(t)&&!b.dataset.comprehensiveShare){b.dataset.comprehensiveShare='1';e.preventDefault();const n=b.closest('.invoice-paper,.receipt-paper,.submission-card,.tracking-order-card,.section,article,table')||document.body;shareNode(n,document.querySelector('.section.active h2')?.textContent||document.title);}
    if(/^print$/i.test(t)&&!b.dataset.comprehensivePrint){b.dataset.comprehensivePrint='1';e.preventDefault();const n=b.closest('.invoice-paper,.receipt-paper,.submission-card,.tracking-order-card,.section,article,table')||document.body;printNode(n,document.title);}
  },true);
}

/* 4) Quantity label is never rendered as a bare number in detail views. */
function quantityLabels(){
  $$('[data-view-quote],[data-view-registration],[data-view-tracking],[data-view-trainee],[data-final-view]').forEach(()=>{});
  document.addEventListener('click',()=>setTimeout(()=>{
    $$('.modal,.details-modal,[role="dialog"]').forEach(m=>{
      $$('p,div,span,li',m).forEach(x=>{if(/^(1|2|3|4|5|6|7|8|9|10)$/.test((x.textContent||'').trim()) && /quantity/i.test(x.previousElementSibling?.textContent||'')) x.textContent='Quantity: '+x.textContent.trim();});
    });
  },100),true);
}

/* 5) Delivery/Pickup preview: exact requested headings and Details column when a generated table is present. */
function deliveryHeadings(){
  const sec=document.getElementById('collectionForms'); if(!sec)return;
  const fix=()=>{
    $$('table',sec).forEach(t=>{
      const row=$('thead tr',t); if(!row)return;
      const heads=$$('th',row); const item=heads.find(h=>/^item$/i.test(h.textContent.trim()));
      if(item)item.textContent='Item/Description';
      if(!heads.some(h=>/^details$/i.test(h.textContent.trim()))){
        const quantity=$$('th',row).find(h=>/^quantity$/i.test(h.textContent.trim()));
        if(quantity){
          const idx=[...row.children].indexOf(quantity); const th=document.createElement('th'); th.textContent='Details'; row.insertBefore(th,quantity);
          $$('tbody tr',t).forEach(r=>{const td=document.createElement('td');td.textContent='';r.insertBefore(td,r.children[idx]||null);});
        }
      }
    });
  };
  new MutationObserver(fix).observe(sec,{childList:true,subtree:true});fix();
}

/* 6) Invoice + receipt image attachments. Uses existing quote-uploads bucket used by the project. */
function attachmentObservers(){
 const install=(kind)=>{const id=kind==='invoice'?'invoiceGeneratorModal':'receiptGeneratorModal';const stateKey=kind==='invoice'?'_aprilsCurrentInvoice':'_aprilsCurrentReceipt';
 const run=()=>{const modal=document.getElementById(id),state=window[stateKey];if(!modal||!state||modal.dataset['attach'+kind])return;modal.dataset['attach'+kind]='1';state.attachments=Array.isArray(state.attachments)?state.attachments:[];
 const editor=modal.querySelector('.'+kind+'-generator-editor')||modal;const wrap=document.createElement('div');wrap.className='form-group comprehensive-attachments';wrap.innerHTML='<label>Attach Images</label><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple><small>Optional reference images (maximum 5 MB each).</small><div class="attachment-list"></div>';editor.prepend(wrap);const input=$('input',wrap),list=$('.attachment-list',wrap);const render=()=>list.innerHTML=state.attachments.map(a=>'<span>'+esc(a.name||'Image')+'</span>').join('');input.onchange=async()=>{const db=window.aprilsSupabase||window.AprilsSupabase;if(!db)return msg('Image storage is unavailable.','error');for(const f of [...input.files]){if(f.size>5*1024*1024){msg('Each image must be 5 MB or smaller.','error');continue;}try{const path='invoice-attachments/'+Date.now()+'-'+Math.random().toString(36).slice(2)+'-'+f.name.replace(/[^\w.-]/g,'_');const up=await db.storage.from('quote-uploads').upload(path,f,{contentType:f.type});if(up.error)throw up.error;const u=db.storage.from('quote-uploads').getPublicUrl(path);state.attachments.push({name:f.name,path,url:u.data?.publicUrl||''});}catch(e){msg('Image upload failed: '+e.message,'error');}}input.value='';render();};render();};
 new MutationObserver(run).observe(document.body,{childList:true,subtree:true});run();};install('invoice');install('receipt');}

/* 7) Payment-entry fields clear after save without touching saved payment records. */
function paymentFormSafety(){['invoicePaymentForm','paymentDetailsForm'].forEach(id=>{const f=document.getElementById(id);if(!f||f.dataset.clearAfterSave)return;f.dataset.clearAfterSave='1';f.addEventListener('submit',()=>setTimeout(()=>{if(document.activeElement?.tagName==='INPUT')document.activeElement.blur();f.querySelectorAll('input:not([type="hidden"]),textarea').forEach(i=>i.value='');},500));});}

/* 8) Loading reliability: re-run existing loaders when tabs become active, without inventing data. */
function reliableLoading(){const map={registrations:'loadTrainingRegistrations',trainees:'loadTrainees',orderTracking:'loadOrderTracking',orders:'loadOrders',accounting:'loadAccounting',inventory:'loadInventory',checkout:'loadCheckoutOrders',refund:'loadRefunds',auditLog:'loadAuditLog',staffHR:'loadStaffHR'};document.addEventListener('click',e=>{const b=e.target.closest('[data-section]');const fn=map[b?.dataset.section];if(fn&&typeof window[fn]==='function')setTimeout(()=>Promise.resolve(window[fn]()).catch(console.warn),50);},true);}

/* 9) Checkout/invoice table readability. */
function css(){const s=document.createElement('style');s.textContent='.comprehensive-table-controls{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0}.comprehensive-table-controls input{flex:1 1 260px;min-width:180px;padding:8px}.section table{max-width:100%;table-layout:auto}.section th,.section td{overflow-wrap:anywhere;word-break:break-word;white-space:normal}.attachment-list{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px}.attachment-list span{padding:4px 7px;border:1px solid #bbb;border-radius:4px;font-size:12px}.invoice-payment-grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}@media(max-width:800px){.invoice-payment-grid.two{grid-template-columns:1fr}.section .table-wrap{overflow-x:auto}}';document.head.appendChild(s);}

function init(){css();normalizeLabels();controls();bindSharePrint();quantityLabels();deliveryHeadings();attachmentObservers();paymentFormSafety();reliableLoading();const obs=new MutationObserver(()=>{normalizeLabels();controls();paymentFormSafety();});obs.observe(document.body,{childList:true,subtree:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

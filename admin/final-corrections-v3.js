/* APRILS SIGNATURE — FINAL CORRECTIONS V3
   Strict integration pass using only the supplied website package.
*/
(function(){
'use strict';
const DB=()=>window.aprilsSupabase||window.AprilsSupabase||null;
const esc=window.escapeHTML||((v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])));
const msg=(t,type='success')=>typeof window.message==='function'&&window.message(t,type);
const rows=async(table)=>typeof window.getRows==='function'?window.getRows(table):[];
const settingRows=async()=>rows('settings');
const money=v=>`GHS ${Number(v||0).toFixed(2)}`;
const dmy=(v,withTime=true)=>{
 if(!v)return '—';
 const s=String(v).trim();
 if(/^\d{2}\/\d{2}\/\d{4}$/.test(s))return withTime?s+' GMT':s;
 const d=new Date(v); if(Number.isNaN(d.getTime()))return s;
 const p=new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',day:'2-digit',month:'2-digit',year:'numeric',...(withTime?{hour:'2-digit',minute:'2-digit',hour12:false}:{})}).formatToParts(d);
 const g=x=>p.find(q=>q.type===x)?.value||'';
 return `${g('day')}/${g('month')}/${g('year')}${withTime?' '+g('hour')+':'+g('minute')+' GMT':''}`;
};
const slug=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,90);
const norm=v=>String(v||'').trim().toLowerCase().replace(/\s+/g,' ');

function normaliseDateUI(){
 document.documentElement.lang='en-GB';
 document.querySelectorAll('input[type="date"]').forEach(e=>{e.lang='en-GB';e.setAttribute('aria-label',(e.getAttribute('aria-label')||e.previousElementSibling?.textContent||'Date')+' — DD/MM/YYYY');e.title='Date format: DD/MM/YYYY';});
 document.querySelectorAll('input[type="time"]').forEach(e=>{e.title='Time is recorded in GMT (Greenwich Mean Time)';});
 document.querySelectorAll('.section td,.section time,.section .small').forEach(e=>{
   const t=e.textContent.trim();
   if(/^\d{4}-\d{2}-\d{2}(?:T|\s)/.test(t) || /^\d{4}-\d{2}-\d{2}$/.test(t)){e.textContent=dmy(t,/T|\s\d/.test(t));}
 });
}

function dedupeSearches(){
 document.querySelectorAll('.section .table-wrap').forEach(w=>{
   const boxes=[]; let p=w.previousElementSibling;
   while(p && p.classList?.contains('admin-table-search')){boxes.push(p);p=p.previousElementSibling;}
   if(boxes.length>1)boxes.slice(1).forEach(x=>x.remove());
   const b=w.previousElementSibling;
   if(b?.classList.contains('admin-table-search')){
     const inputs=b.querySelectorAll('input[type="search"]');
     if(inputs.length>1)[...inputs].slice(1).forEach(x=>x.closest('div')?.remove()||x.remove());
   }
 });
}

function dedupeArrows(){
 document.querySelectorAll('.table-wrap').forEach(w=>{
   const bars=[];let p=w.previousElementSibling;
   while(p && p.classList?.contains('v2-table-arrows')){bars.push(p);p=p.previousElementSibling;}
   if(bars.length>1)bars.slice(1).forEach(x=>x.remove());
   const bar=w.previousElementSibling;
   if(bar?.classList.contains('v2-table-arrows')){
     const bs=bar.querySelectorAll('button');
     if(bs.length>2)[...bs].slice(2).forEach(x=>x.remove());
     const [l,r]=bar.querySelectorAll('button');
     if(l)l.onclick=()=>w.scrollBy({left:-420,behavior:'smooth'});
     if(r)r.onclick=()=>w.scrollBy({left:420,behavior:'smooth'});
   }
 });
}

async function auditDeleteAfterSuccess(button){
 const id=button?.dataset?.deleteSavedRecord||button?.dataset?.deleteProduct||button?.dataset?.deleteTraining||button?.dataset?.deleteUserAccess||button?.dataset?.deleteService||button?.dataset?.deleteContent||button?.dataset?.deleteRegistration||button?.dataset?.deleteInvoice||button?.dataset?.deleteDiscount||button?.dataset?.deleteGallery||button?.dataset?.deleteFaq||button?.dataset?.deletePolicy||button?.dataset?.deleteLink||button?.dataset?.deleteSocial;
 if(!id || button.dataset.v3DeleteAudit==='1')return;
 button.dataset.v3DeleteAudit='1';
 const before=button.closest('tr')||button.closest('.submission-card')||button.closest('article');
 setTimeout(async()=>{
   const success=!document.body.contains(button) || (before && !document.body.contains(before));
   if(!success)return;
   try{
     const actor=typeof window.getCurrentStaffIdentity==='function'?await window.getCurrentStaffIdentity():{staffId:'STAFF-UNKNOWN',email:''};
     const d=DB();if(!d)return;
     const eventId='AUD-DEL-'+Date.now().toString(36).toUpperCase();
     await d.from('settings').insert({setting_key:'audit_event_'+slug(eventId),setting_value:JSON.stringify({eventId,entityType:button.dataset.recordType||'admin_record',entityId:String(id),action:'deleted',actorId:actor.staffId,actorEmail:actor.email,at:new Date().toISOString(),details:{recordNumber:button.dataset.recordNumber||''}}),updated_at:new Date().toISOString()});
   }catch(_){}
 },1200);
}
function watchDeletes(){
 document.addEventListener('click',e=>{const b=e.target.closest('button');if(b && [...b.attributes].some(a=>/^data-delete-/.test(a.name)))auditDeleteAfterSuccess(b);},true);
}

async function recomputeAccounting(){
 const d=DB();if(!d)return;
 try{
  const s=await settingRows();
  const parse=p=>{try{return JSON.parse(p||'{}')}catch(_){return null}};
  const invoices=s.filter(r=>String(r.setting_key||'').startsWith('invoice_record_')).map(r=>parse(r.setting_value)).filter(Boolean);
  const payments=s.filter(r=>String(r.setting_key||'').startsWith('invoice_payment_record_')).map(r=>parse(r.setting_value)).filter(Boolean);
  const refunds=s.filter(r=>String(r.setting_key||'').startsWith('refund_record_')).map(r=>parse(r.setting_value)).filter(x=>x&&(['paid','refund recorded'].includes(norm(x.status))));
  const expenses=s.filter(r=>String(r.setting_key||'').startsWith('accounting_expense_')||String(r.setting_key||'').startsWith('staff_expense_')).map((r)=>({id:r.id,key:r.setting_key,v:parse(r.setting_value)})).filter(x=>x.v);
  const uniqueExp=new Map(expenses.map(x=>[x.id||x.key,x.v]));
  const paidByInvoice=new Map(); payments.forEach(p=>{const k=String(p.invoiceNumber||'');paidByInvoice.set(k,(paidByInvoice.get(k)||0)+Number(p.amount||0));});
  const grossReceived=payments.reduce((a,p)=>a+Number(p.amount||0),0);
  const totalRefund=refunds.reduce((a,r)=>a+Number(r.refundAmount||0),0);
  const netReceived=Math.max(0,grossReceived-totalRefund);
  const totalSales=netReceived; // Sales are payment-based, never invoice-only.
  const outstanding=invoices.reduce((a,i)=>a+Math.max(0,Number(i.total||0)-(paidByInvoice.get(String(i.invoiceNumber||''))||0)+refunds.filter(r=>String(r.invoiceNumber||'')===String(i.invoiceNumber||'')).reduce((x,r)=>x+Number(r.refundAmount||0),0)),0);
  const discounts=invoices.reduce((a,i)=>a+Number(i.discount||0),0);
  const totalExpenses=[...uniqueExp.values()].reduce((a,e)=>a+Number(e.amount||0),0);
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=money(v);};
  set('accountingSales',totalSales);set('accountingReceived',netReceived);set('accountingOutstanding',outstanding);set('accountingDiscounts',discounts);set('accountingExpenses',totalExpenses);set('accountingNetCash',netReceived-totalExpenses);set('accountingRefunds',totalRefund);
  const card=document.getElementById('accountingRefundCard');if(card)card.querySelector('.number')?.replaceChildren(document.createTextNode(money(totalRefund)));
  const staff=s.filter(r=>String(r.setting_key||'').startsWith('staff_expense_')).map(r=>parse(r.setting_value)).filter(Boolean);
  let staffCard=document.getElementById('staffAccountingList');
  const acc=document.getElementById('accounting');
  if(acc&&!staffCard){staffCard=document.createElement('div');staffCard.id='staffAccountingList';staffCard.className='form-card';staffCard.innerHTML='<h3>Staff / HR Expenses</h3><div class="table-wrap"></div>';acc.appendChild(staffCard);}
  const sl=staffCard?.querySelector('.table-wrap');
  if(sl)sl.innerHTML=staff.length?`<table><thead><tr><th>Date / Time</th><th>Staff ID</th><th>Staff Name</th><th>Description</th><th>Amount</th></tr></thead><tbody>${staff.map(x=>`<tr><td>${esc(dmy(x.date||x.savedAt))}</td><td>${esc(x.staffId||'')}</td><td>${esc(x.staffName||'')}</td><td>${esc(x.description||'')}</td><td>${money(x.amount)}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">No staff / HR expenses recorded.</div>';
 }catch(e){console.warn('Accounting recompute failed',e);}
}
function patchAccountingOnce(){
 const old=window.loadAccounting;if(typeof old!=='function'||old.__v3)return;
 const fn=async function(){await old();await recomputeAccounting();};fn.__v3=true;window.loadAccounting=fn;
}

function makeUserInvoiceMirror(){
 const src=document.getElementById('savedInvoiceList'),dst=document.getElementById('userInvoiceSavedList');if(!src||!dst)return;
 const table=src.querySelector('table');if(!table)return;
 const clone=table.cloneNode(true);
 clone.querySelectorAll('tr').forEach(tr=>tr.querySelectorAll('[data-delete-saved-record],button.danger').forEach(b=>b.remove()));
 clone.querySelectorAll('th').forEach(th=>{if(norm(th.textContent)==='actions')th.textContent='Actions';});
 dst.innerHTML='<h4>All Saved Invoices — User Invoice View</h4><p class="intro">This view mirrors saved invoices from Invoice &amp; Receipts. Delete controls are intentionally removed.</p>';
 dst.appendChild(clone);
 clone.querySelectorAll('[data-open-saved-record],[data-edit-saved-record],[data-share-saved-record]').forEach(b=>{
   b.onclick=async()=>{
     const key=b.dataset.openSavedRecord||b.dataset.editSavedRecord||b.dataset.shareSavedRecord;
     const row=[...src.querySelectorAll('tbody tr')].find(tr=>tr.querySelector(`[data-open-saved-record="${CSS.escape(key)}"],[data-edit-saved-record="${CSS.escape(key)}"],[data-share-saved-record="${CSS.escape(key)}"]`));
     const action=row?.querySelector(`[data-open-saved-record="${CSS.escape(key)}"],[data-edit-saved-record="${CSS.escape(key)}"],[data-share-saved-record="${CSS.escape(key)}"]`);if(action)action.click();
   };
 });
}
function patchSavedRecords(){
 const old=window.loadSavedInvoiceReceiptRecords;if(typeof old!=='function'||old.__v3)return;
 const fn=async function(){await old();makeUserInvoiceMirror();};fn.__v3=true;window.loadSavedInvoiceReceiptRecords=fn;
}

function patchTrainingStatusControls(){
 const wanted=[['under_review','New Customer — Under Review'],['invoice_generated','Invoice Generated'],['part_paid','Part Paid'],['fully_paid','Fully Paid'],['in_class','In Class'],['completed','Completed'],['stopped','Stopped'],['cancelled','Cancelled']];
 document.querySelectorAll('#traineesList .admin-status-select').forEach(s=>{const cur=s.value;s.innerHTML=wanted.map(([k,l])=>`<option value="${k}" ${k===cur?'selected':''}>${esc(l)}</option>`).join('');});
}

async function addPaymentLink(){
 const d=DB();if(!d)return;
 try{
   const payload=JSON.stringify({label:'Payment Details',url:'payment.html',order:10,location:'direct',active:true});
   if(typeof window.safeSettingUpsert==='function')await window.safeSettingUpsert('site_link_payment',payload);
 }catch(_){}
}

function patchStatusUpdateSelector(){
 const sec=document.getElementById('orderStatusUpdates');if(!sec)return;
 const picker=sec.querySelector('#finalStatusRecord'),select=sec.querySelector('#finalOrderStatus');if(!picker||!select)return;
 const set=()=>{const isTraining=(picker.options[picker.selectedIndex]?.textContent||'').startsWith('Training');if(!isTraining)return;const wanted=[['under_review','New Customer — Under Review'],['invoice_generated','Invoice Generated'],['part_paid','Part Paid'],['fully_paid','Fully Paid'],['in_class','In Class'],['completed','Completed'],['stopped','Stopped'],['cancelled','Cancelled']];const cur=select.value;select.innerHTML=wanted.map(([k,l])=>`<option value="${k}" ${k===cur?'selected':''}>${l}</option>`).join('');};picker.addEventListener('change',set);set();
}

function addRoleOptions(){
 const select=document.getElementById('userAccessRole');if(!select)return;
 const wanted=[['owner','Owner'],['manager','Manager'],['sales','Sales'],['training','Training'],['inventory','Inventory'],['content','Content'],['front_desk','Front Desk'],['customer_service','Customer Service'],['accounting','Accounting'],['hr','HR']];
 const cur=select.value;select.innerHTML=wanted.map(([v,l])=>`<option value="${v}">${l}</option>`).join('');select.value=cur||'owner';
}
function addStaffAccessEntry(){
 // The original constant lives in admin.js. Add Staff / HR to the rendered access matrix after it is built.
 const checks=document.getElementById('userAccessChecks');if(!checks)return;
 if(!checks.querySelector('input[value="staffHR"]'))checks.insertAdjacentHTML('beforeend','<label class="checkbox"><input type="checkbox" value="staffHR"> Staff / HR</label>');
}

function patchDeliverySync(){
 const old=window.saveDeliveryTracking;if(typeof old!=='function'||old.__v3)return;
 const fn=async function(id,payload){const r=await old(id,payload);try{const d=DB();const q=await d.from('quote_requests').select('journey').eq('id',id).maybeSingle();if(!q.error&&q.data){let j={};try{j=JSON.parse(q.data.journey||'{}')}catch(_){}j.deliveryDate=payload.date||'';j.deliveryTime=payload.time||'';j.deliveryLocation=payload.location||'';await d.from('quote_requests').update({journey:JSON.stringify(j)}).eq('id',id);}}catch(_){}return r;};fn.__v3=true;window.saveDeliveryTracking=fn;
}
function syncInvoiceDeliveryInputs(){
 const modal=document.getElementById('invoiceGeneratorModal');if(!modal||modal.dataset.v3delivery)return;modal.dataset.v3delivery='1';
 const save=async()=>{const state=window._aprilsCurrentInvoice,row=state?.row;if(!row?.id)return;const d=DB();if(!d)return;try{let j={};try{j=JSON.parse(row.journey||'{}')}catch(_){}j.deliveryDate=modal.querySelector('#generatedInvoiceDeliveryDate')?.value||'';j.deliveryTime=modal.querySelector('#generatedInvoiceDeliveryTime')?.value||'';await d.from('quote_requests').update({journey:JSON.stringify(j)}).eq('id',row.id);if(typeof window.saveDeliveryTracking==='function')await window.saveDeliveryTracking(row.id,{date:j.deliveryDate,time:j.deliveryTime,location:j.deliveryLocation||''});}catch(_){} };
 modal.querySelectorAll('#generatedInvoiceDeliveryDate,#generatedInvoiceDeliveryTime').forEach(e=>e.addEventListener('change',save));
}

function patchReceiptAttachments(){
 const old=window.generateReceiptPdf;if(typeof old!=='function'||old.__v3)return;
 const fn=async function(share){const state=window._aprilsCurrentReceipt,paper=document.getElementById('receiptPaper');let g=null;try{const at=state?.invoiceState?.attachments||window._aprilsCurrentInvoice?.attachments||[];if(paper&&at.length){g=document.createElement('div');g.className='final-invoice-attachment-gallery';g.innerHTML='<h3>Attached Images</h3><div>'+at.map(a=>a.url?`<img src="${esc(a.url)}" alt="${esc(a.name||'Attached image')}">`:`<p>${esc(a.name||'Attached image')}</p>`).join('')+'</div>';paper.appendChild(g);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));}return await old(share);}finally{g?.remove();}};fn.__v3=true;window.generateReceiptPdf=fn;
}

function improveCheckoutItemText(){
 document.querySelectorAll('#checkoutList tbody tr').forEach(tr=>{const cells=[...tr.children];if(!cells.length)return;cells.forEach(td=>{if(norm(td.textContent)==='shop checkout')td.textContent='Checkout Order';});});
}
function css(){if(document.getElementById('v3Styles'))return;const s=document.createElement('style');s.id='v3Styles';s.textContent='.final-invoice-attachment-gallery{margin-top:16px;border-top:1px solid #ccc;padding-top:10px}.final-invoice-attachment-gallery>div{display:flex;flex-wrap:wrap;gap:10px}.final-invoice-attachment-gallery img{max-width:180px;max-height:180px;object-fit:contain;border:1px solid #bbb;padding:3px}.v3-gmt{white-space:nowrap}';document.head.appendChild(s);}

function boot(){
 css();
 setTimeout(()=>{
   normaliseDateUI();dedupeSearches();dedupeArrows();patchAccountingOnce();patchSavedRecords();patchDeliverySync();patchReceiptAttachments();addPaymentLink();addRoleOptions();addStaffAccessEntry();patchTrainingStatusControls();patchStatusUpdateSelector();makeUserInvoiceMirror();improveCheckoutItemText();
   if(typeof window.loadUserAccess==='function')try{window.loadUserAccess().then(addStaffAccessEntry)}catch(_){}
   if(typeof window.loadAccounting==='function'&&document.getElementById('accounting')?.classList.contains('active'))window.loadAccounting();
   syncInvoiceDeliveryInputs();
 },1800);
 setInterval(()=>{normaliseDateUI();dedupeSearches();dedupeArrows();addStaffAccessEntry();patchTrainingStatusControls();patchStatusUpdateSelector();improveCheckoutItemText();syncInvoiceDeliveryInputs();},2000);
 watchDeletes();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();

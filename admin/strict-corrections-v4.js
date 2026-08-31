/* APRILS SIGNATURE — STRICT CORRECTIONS V4
   Clarifications: no public Payment Details page; one central invoice/receipt
   record set; all admin tabs available in permissions; D/M/Y + GMT everywhere;
   and public catalogue mirrors saved from Admin. */
(function(){
'use strict';
const db=()=>window.aprilsSupabase||window.AprilsSupabase||null;
const esc=window.escapeHTML||((v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])));
const slug=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,90);
const msg=(t,type='success')=>window.message?window.message(t,type):void 0;
async function rows(){const d=db();if(!d)return[];const r=await d.from('settings').select('*');return r.error?[]:(r.data||[])}
async function saveSetting(key,value){if(window.safeSettingUpsert)return window.safeSettingUpsert(key,typeof value==='string'?value:JSON.stringify(value));const d=db();if(!d)throw Error('Supabase is unavailable.');const old=await d.from('settings').select('id').eq('setting_key',key).limit(1);if(old.error)throw old.error;const payload={setting_key:key,setting_value:typeof value==='string'?value:JSON.stringify(value),updated_at:new Date().toISOString()};return old.data?.length?d.from('settings').update(payload).eq('id',old.data[0].id):d.from('settings').insert(payload)}
async function audit(type,id,action,details={}){try{if(window.auditSystemEvent)await window.auditSystemEvent(type,id,action,details)}catch(_){} }
function gmtDate(v){if(!v)return '—';const x=new Date(v);if(Number.isNaN(x.getTime())){const m=String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);return m?`${m[3]}/${m[2]}/${m[1]}`:String(v)}return new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',day:'2-digit',month:'2-digit',year:'numeric'}).format(x)}
function gmtDateTime(v){if(!v)return '—';const x=new Date(v);if(Number.isNaN(x.getTime()))return gmtDate(v);return new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(x)+' (GMT)'}

/* 1. Every admin date input: visible D/M/Y text + native calendar helper. */
function dmyInputs(root=document){root.querySelectorAll('input[type="date"]:not([data-dmy-bound="1"])').forEach(el=>{
  if(el.dataset.v4dmy)return; el.dataset.v4dmy='1';
  const wrap=document.createElement('div');wrap.className='v4-date-wrap';wrap.style.cssText='display:flex;gap:6px;align-items:center;width:100%;';
  const text=document.createElement('input');text.type='text';text.className=el.className;text.placeholder='DD/MM/YYYY';text.inputMode='numeric';text.autocomplete='off';text.required=el.required;text.setAttribute('aria-label',(el.getAttribute('aria-label')||el.previousElementSibling?.textContent||'Date')+' — DD/MM/YYYY');
  text.value=el.value?gmtDate(el.value):'';el.required=false;el.style.display='none';el.parentNode.insertBefore(wrap,el);wrap.appendChild(text);wrap.appendChild(el);
  const button=document.createElement('button');button.type='button';button.className='secondary v4-calendar-button';button.textContent='📅';button.title='Choose date';button.style.cssText='flex:0 0 auto;padding:8px 10px;';wrap.appendChild(button);
  const sync=()=>{const m=text.value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(!m){if(!text.value){el.value='';text.setCustomValidity('')}else text.setCustomValidity('Enter date as DD/MM/YYYY.');return false}const day=+m[1],mon=+m[2],yr=+m[3],dt=new Date(Date.UTC(yr,mon-1,day));if(dt.getUTCFullYear()!==yr||dt.getUTCMonth()!==mon-1||dt.getUTCDate()!==day){text.setCustomValidity('Enter a valid date as DD/MM/YYYY.');return false}text.setCustomValidity('');el.value=`${yr}-${String(mon).padStart(2,'0')}-${String(day).padStart(2,'0')}`;el.dispatchEvent(new Event('change',{bubbles:true}));return true};
  text.addEventListener('input',()=>text.value=text.value.replace(/[^0-9/]/g,'').slice(0,10));text.addEventListener('blur',sync);text.addEventListener('change',sync);el.addEventListener('change',()=>{if(el.value)text.value=gmtDate(el.value)});button.onclick=()=>{try{el.showPicker?.();}catch(_){el.click()}};
 });
 root.querySelectorAll('label').forEach(l=>{if(/\btime\b|time\s*\//i.test(l.textContent)&&!/\(GMT\)/i.test(l.textContent))l.append(' (GMT)')});
}

/* 2. Permissions: exactly all dashboard sections, including dynamically created ones. */
function patchAccessList(){
 const checks=document.getElementById('userAccessChecks');if(!checks)return;
 const canonical=[['dashboard','Dashboard'],['staffHR','Staff / HR'],['gallery','Gallery & Media'],['homepage','Homepage Media'],['services','Products / Services / Training'],['registrations','Training Registrations'],['orders','Order / Quote Requests'],['orderStatusUpdates','Order Status / Payment Updates'],['orderTracking','Order Tracking'],['refund','Refund'],['trainees','Trainees'],['invoice','Invoice Pricing'],['usersInvoice','Users Invoice'],['collectionForms','Delivery/Pickup Form'],['manualInvoice','Invoice & Receipts'],['shopAdmin','Shop'],['inventory','Inventory / Stock'],['checkout','Checkout Orders'],['errors','System Error Log'],['auditLog','Staff Activity / Audit Log'],['notifications','Notifications'],['accounting','Sales & Accounting'],['links','Website Links'],['testimonials','Testimonials'],['faq','FAQs'],['content','Website Content'],['policies','Policies & Terms'],['contact','Contact Information'],['social','Social Links'],['discounts','Discount Codes'],['users','Admin Users & Access'],['settings','Website Settings']]; const base=[...canonical,...[...document.querySelectorAll('button[data-section]')].map(b=>[b.dataset.section,(b.textContent||'').trim()]).filter(x=>x[0])];
 const extras=[['staffHR','Staff / HR'],['orderStatusUpdates','Order Status / Payment Updates'],['refund','Refund'],['enquiries','Customer Enquiries']];
 const map=new Map([...base,...extras]);
 const current=new Set([...checks.querySelectorAll('input:checked')].map(x=>x.value));
 checks.innerHTML=[...map].map(([id,label])=>`<label class="checkbox"><input type="checkbox" value="${esc(id)}" ${current.has(id)?'checked':''}> ${esc(label)}</label>`).join('');
}
function patchRoleDefaults(){
 const original=window.accessDefaultSections;
 if(typeof original==='function'&&!original.__v4){const fn=function(role){const all=[...document.querySelectorAll('button[data-section]')].map(b=>b.dataset.section).filter(Boolean);if(role==='owner'||role==='manager')return all;return original(role).filter(x=>all.includes(x));};fn.__v4=true;window.accessDefaultSections=fn;}
}

/* 3. Payment details: no payment.html. The admin link opens a shareable modal on the home page. */
function paymentShareUrl(accounts){
 const base=new URL('../index.html',location.href);base.searchParams.set('payment','1');return base.href;
}
async function getPaymentAccounts(){const r=(await rows()).find(x=>String(x.setting_key)==='invoice_payment_accounts');if(!r?.setting_value)return[];try{const a=JSON.parse(r.setting_value);return Array.isArray(a)?a:[]}catch(_){return[]}}
function patchPaymentDirectLinks(){
 const list=document.getElementById('directLinksList');if(!list)return;
 const apply=async()=>{const accounts=await getPaymentAccounts();const url=paymentShareUrl(accounts);list.querySelectorAll('[data-copy-direct-link="payment"],[data-share-direct-link="payment"]').forEach(b=>{if(b.dataset.v4bound)return;b.dataset.v4bound='1';b.dataset.v4url=url;});const a=[...list.querySelectorAll('a')].find(x=>/payment/i.test(x.textContent||''));if(a){a.href=url;a.textContent=url;a.target='_blank'}};
 apply();new MutationObserver(apply).observe(list,{childList:true,subtree:true});
 list.addEventListener('click',async e=>{const b=e.target.closest('[data-copy-direct-link="payment"],[data-share-direct-link="payment"]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();const u=paymentShareUrl(await getPaymentAccounts());if(b.hasAttribute('data-copy-direct-link')){try{await navigator.clipboard.writeText(u);msg('Payment Details link copied. It uses the payment details currently saved in Admin.')}catch(_){prompt('Copy Payment Details link:',u)}}else if(navigator.share){try{await navigator.share({title:'Aprils Signature — Payment Details',text:'Aprils Signature payment details',url:u})}catch(_){} }else{try{await navigator.clipboard.writeText(u);msg('Payment Details link copied. This link opens the saved Admin payment details.')}catch(_){prompt('Copy Payment Details link:',u)}}},true);
}
async function patchPaymentSave(){
 const form=document.getElementById('invoicePaymentForm');if(!form||form.dataset.v4save)return;form.dataset.v4save='1';
 form.addEventListener('submit',async e=>{e.preventDefault();e.stopImmediatePropagation();const wrap=document.getElementById('invoicePaymentRows');const accounts=[...(wrap?.querySelectorAll('[data-payment-row]')||[])].map(row=>({number:row.querySelector('.invoice-payment-number')?.value.trim()||'',name:row.querySelector('.invoice-payment-name')?.value.trim()||'',network:row.querySelector('.invoice-payment-network')?.value.trim()||'',branch:row.querySelector('.invoice-payment-branch')?.value.trim()||'',note:row.querySelector('.invoice-payment-note')?.value.trim()||''})).filter(x=>x.number||x.name||x.network||x.note||x.branch);try{await saveSetting('invoice_payment_accounts',accounts);const f=accounts[0]||{};await saveSetting('invoice_payment_number',f.number||'');await saveSetting('invoice_payment_name',f.name||'');await saveSetting('invoice_payment_network',f.network||'');await saveSetting('invoice_payment_branch',f.branch||'');await saveSetting('invoice_payment_note',f.note||'');await saveSetting('site_link_payment',JSON.stringify({label:'Payment Details',url:paymentShareUrl(accounts)}));form.reset();if(wrap)wrap.innerHTML='<div class="invoice-payment-row" data-payment-row style="border:1px solid #aaa;border-radius:6px;padding:12px;margin-bottom:12px;"><div class="form-grid"><div class="form-group"><label>Payment Method / Network</label><input class="invoice-payment-network" placeholder="MTN MoMo, Telecel, Bank, etc."></div><div class="form-group"><label>Account / Payment Number</label><input class="invoice-payment-number" placeholder="e.g. 024... or account number"></div><div class="form-group"><label>Account Name</label><input class="invoice-payment-name" placeholder="Name on the account"></div><div class="form-group"><label>Bank Branch</label><input class="invoice-payment-branch" placeholder="For bank accounts"></div></div><div class="form-group"><label>Payment Note</label><textarea class="invoice-payment-note" placeholder="Payment instruction to appear on invoices."></textarea></div></div>';msg('Payment details saved. The shareable link is now connected to these saved details.');await patchPaymentDirectLinks();await audit('invoice_payment_accounts','invoice_payment_accounts','updated',{count:accounts.length})}catch(err){msg('Payment details could not be saved: '+err.message,'error')}},true);
}

/* 4. Users Invoice mirrors the central saved invoices and receipts, separately, with no Delete. */
async function mirrorUserInvoice(){
 const host=document.getElementById('userInvoiceSavedList');if(!host)return;const rs=await rows();const parse=x=>{try{return JSON.parse(x.setting_value||'{}')}catch(_){return null}};
 const inv=rs.filter(x=>String(x.setting_key||'').startsWith('invoice_record_')).map(x=>({...parse(x),_id:x.id,_key:x.setting_key})).filter(x=>x.invoiceNumber);
 const rec=rs.filter(x=>String(x.setting_key||'').startsWith('receipt_record_')).map(x=>({...parse(x),_id:x.id,_key:x.setting_key})).filter(x=>x.receiptNumber||x.invoiceNumber);
 for(const x of inv){try{x._paid=(await window.getInvoicePayments(x.invoiceNumber)).reduce((s,p)=>s+Number(p.amount||0),0)}catch(_){x._paid=0}}
 const invTable=inv.length?`<table><thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th>Items / Details</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead><tbody>${inv.map(x=>`<tr><td>${esc(x.invoiceNumber)}</td><td>${esc(gmtDate(x.date||x.savedAt))}</td><td>${esc(x.customer||'')}</td><td>${esc((x.lines||[]).map(l=>`${l.description||''} × ${l.quantity||1}${l.details?' — '+l.details:''}`).join(' • '))}</td><td>GHS ${Number(x.total||0).toFixed(2)}</td><td>${x._paid>=Number(x.total||0)&&x.total>0?'Paid in full':x._paid>0?'Part payment':'Payment pending'}</td><td><button type="button" class="secondary" data-v4-view-invoice="${esc(x._key)}">View</button> <button type="button" class="secondary" data-v4-share-invoice="${esc(x._key)}">Share PDF</button></td></tr>`).join('')}</tbody></table>`:'<div class="empty">No saved invoices yet.</div>';
 const recTable=rec.length?`<table><thead><tr><th>Receipt</th><th>Invoice</th><th>Date</th><th>Customer</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rec.map(x=>`<tr><td>${esc(x.receiptNumber||'')}</td><td>${esc(x.invoiceNumber||'')}</td><td>${esc(gmtDate(x.date||x.savedAt))}</td><td>${esc(x.customer||'')}</td><td>GHS ${Number(x.amount||0).toFixed(2)}</td><td>${esc(x.status||'Payment recorded')}</td><td><button type="button" class="secondary" data-v4-view-receipt="${esc(x._key)}">View</button> <button type="button" class="secondary" data-v4-share-receipt="${esc(x._key)}">Share PDF</button></td></tr>`).join('')}</tbody></table>`:'<div class="empty">No saved receipts yet.</div>';
 host.innerHTML=`<div class="saved-record-columns"><div><h4>Saved Invoices</h4>${invTable}</div><div><h4>Saved Receipts</h4>${recTable}</div></div>`;
 host.querySelectorAll('[data-v4-view-invoice],[data-v4-share-invoice]').forEach(b=>b.onclick=async()=>{const x=inv.find(r=>r._key===b.dataset.v4ViewInvoice||r._key===b.dataset.v4ShareInvoice);if(!x)return;await window.openInvoiceGenerator({id:x.sourceId||'',full_name:x.customer||'',phone:x.phone||'',whatsapp:x.phone||'',email:x.email||'',location:x.address||''},{manualLines:x.lines||[],notes:x.notes||'',training:!!x.training,userInvoice:!!x.userInvoice,invoiceNumber:x.invoiceNumber,discountPercent:Number(x.discountPercent||0),entryId:x.entryId||'',existingRecord:x});if(b.hasAttribute('data-v4-share-invoice'))await window.generateInvoicePdf(true)});
 host.querySelectorAll('[data-v4-view-receipt],[data-v4-share-receipt]').forEach(b=>b.onclick=async()=>{const x=rec.find(r=>r._key===b.dataset.v4ViewReceipt||r._key===b.dataset.v4ShareReceipt);if(!x)return;await window.openSavedReceiptRecord(x);if(b.hasAttribute('data-v4-share-receipt'))await window.generateReceiptPdf(true)});
}

/* 5. Make every saved product/training/service change publicly consumable from settings as a reliable mirror. */
async function syncPublicCatalogueMirrors(){
 const d=db();if(!d)return;
 async function mirror(prefix,sourceRows,nameField){
   const live=new Set();
   for(const r of sourceRows||[]){let x=r; if(r.setting_value){try{x=JSON.parse(r.setting_value||'{}')}catch(_){continue}} const name=x?.[nameField]; if(!name)continue;const key=prefix+slug(name);live.add(key);await saveSetting(key,JSON.stringify({...x,active:x.active!==false}));}
   const old=await d.from('settings').select('id,setting_key').like('setting_key',prefix+'%');
   if(!old.error)for(const r of old.data||[])if(!live.has(r.setting_key))await d.from('settings').delete().eq('id',r.id);
 }
 try{const ps=await d.from('settings').select('setting_key,setting_value').like('setting_key','product_%');if(!ps.error)await mirror('public_catalogue_product_',ps.data||[],'name')}catch(_){ }
 try{const ts=await d.from('training_programs').select('*');if(!ts.error)await mirror('public_catalogue_training_',ts.data||[],'title')}catch(_){ }
 try{const ss=await d.from('admin_services').select('*');if(!ss.error)await mirror('public_catalogue_service_',ss.data||[],'title')}catch(_){ }
}
function uploadUserInvoiceImages(files){const d=db();if(!d)return Promise.reject(Error('Supabase is unavailable.'));return (async()=>{const out=[];for(const f of Array.from(files||[])){if(!/^image\//i.test(f.type))throw Error('Only image files can be attached.');if(f.size>5*1024*1024)throw Error('Each image must be 5 MB or smaller.');const path=`invoice-attachments/${Date.now()}-${Math.random().toString(36).slice(2)}-${f.name.replace(/[^a-z0-9._-]/gi,'_')}`;const u=await d.storage.from('quote-uploads').upload(path,f,{upsert:false,contentType:f.type});if(u.error)throw u.error;const pub=d.storage.from('quote-uploads').getPublicUrl(path);out.push({name:f.name,path,url:pub.data?.publicUrl||''})}return out})()}
function patchUsersInvoiceAttachments(){
 const input=document.getElementById('usersInvoiceAttachments');if(!input||input.dataset.v4attach)return;input.dataset.v4attach='1';
 input.addEventListener('change',async()=>{if(!input.files?.length)return;try{window._aprilsPendingUserInvoiceAttachments=await uploadUserInvoiceImages(input.files);msg('Image attachment(s) uploaded. Generate the invoice to save them with the document.')}catch(err){window._aprilsPendingUserInvoiceAttachments=[];msg('Invoice image attachment failed: '+err.message,'error')}finally{input.value=''}});
 if(!window._aprilsUserInvoiceAttachmentObserver){window._aprilsUserInvoiceAttachmentObserver=new MutationObserver(()=>{const state=window._aprilsCurrentInvoice;if(state&&state.details?.userInvoice&&window._aprilsPendingUserInvoiceAttachments?.length){state.attachments=(state.attachments||[]).concat(window._aprilsPendingUserInvoiceAttachments);window._aprilsPendingUserInvoiceAttachments=[];state.renderInvoice?.()}});window._aprilsUserInvoiceAttachmentObserver.observe(document.body,{childList:true,subtree:true})}
}

/* 6. Delivery form: preserve D/M/Y display and persist the same delivery data into invoice record. */
function patchDeliverySync(){
 const btn=document.getElementById('collectionGenerate');if(!btn||btn.dataset.v4)return;btn.dataset.v4='1';btn.addEventListener('click',async()=>{try{const invoice=(window._aprilsCollectionInvoices||[]).find(i=>String(i.invoiceNumber)===String(document.getElementById('collectionInvoiceSelect')?.value||''));if(!invoice)return;const date=document.getElementById('collectionDate')?.value||'',time=document.getElementById('collectionTime')?.value||'',location=document.getElementById('collectionLocation')?.value.trim()||'';if(date&&time&&location){invoice.deliveryDate=date;invoice.deliveryTime=time;invoice.deliveryLocation=location;const d=db();const r=await d.from('settings').select('id,setting_value').eq('setting_key','invoice_record_'+slug(invoice.invoiceNumber)).maybeSingle();if(!r.error&&r.data){let x={};try{x=JSON.parse(r.data.setting_value||'{}')}catch(_){}x.deliveryDate=date;x.deliveryTime=time;x.deliveryLocation=location;await d.from('settings').update({setting_value:JSON.stringify(x),updated_at:new Date().toISOString()}).eq('id',r.data.id);await audit('collection_delivery_form',invoice.invoiceNumber,'delivery_details_synced',{date,time,location})}}}catch(_){}} ,true);
}

/* 7. Make the permissions section self-healing and keep the UI date formatter running. */
async function shareExactPdfFile(blob,filename,title,options={}){
 const file=new File([blob],filename,{type:'application/pdf'});
 if(options.downloadFirst){const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000)}
 if(navigator.share){
   try{
     if(!navigator.canShare || navigator.canShare({files:[file]})){await navigator.share({title,text:options.text||title,files:[file]});return true;}
   }catch(e){if(e?.name==='AbortError')return false;}
 }
 if(options.openWhatsApp){
   // Browsers cannot attach a local file through a wa.me URL. Never open a
   // misleading blank/text document. The exact PDF has already been generated.
   if(!options.downloadFirst){const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000)}
   message('The exact PDF was generated and downloaded. This browser does not support attaching a PDF directly through WhatsApp; use the device share menu on a phone/tablet for direct PDF sharing.','error');
   return false;
 }
 message('The exact PDF was generated, but this browser does not provide a device file-sharing menu.','error');
 return false;
}

function boot(){
 patchAccessList();patchRoleDefaults();patchPaymentDirectLinks();patchPaymentSave();mirrorUserInvoice();patchUsersInvoiceAttachments();dmyInputs();patchDeliverySync();syncPublicCatalogueMirrors().catch(()=>{});watchCatalogueChanges();
 setInterval(()=>{dmyInputs();patchAccessList();mirrorUserInvoice();patchPaymentDirectLinks();patchUsersInvoiceAttachments();},1800);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
window.aprilsStrictCorrectionsV4={mirrorUserInvoice,syncPublicCatalogueMirrors,paymentShareUrl};
})();

/* Instruction-by-instruction implementation layer — Aug 31, 2026.
   Additive: preserves existing layout/data and repairs missing cross-page behaviour. */
(function(){'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)], esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const db=()=>window.aprilsSupabase||window.AprilsSupabase;
const say=(m,t='success')=>window.message?window.message(m,t):console.log(m);
const parse=v=>{try{return typeof v==='string'?JSON.parse(v):v||{}}catch{return{}}};
const key=s=>String(s||'').toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'');
const now=()=>new Date().toISOString();
async function getSettings(prefix=''){const d=db();if(!d)return[];let q=d.from('settings').select('*'); if(prefix)q=q.like('setting_key',prefix+'%'); const r=await q; return r.error?[]:r.data||[]}
async function putSetting(k,v){const d=db();if(!d)throw new Error('Database connection unavailable');const old=await d.from('settings').select('id').eq('setting_key',k).maybeSingle();if(old.data)return (await d.from('settings').update({setting_value:JSON.stringify(v),updated_at:now()}).eq('id',old.data.id));return d.from('settings').insert({setting_key:k,setting_value:JSON.stringify(v),updated_at:now()})}
async function audit(action,details={}){try{if(window.auditSystemEvent)return await window.auditSystemEvent('admin',action,action,details);await putSetting('audit_v3_'+Date.now()+'_'+Math.random().toString(36).slice(2),{action,details,at:now()})}catch(e){console.warn('audit',e)}}

/* Every admin action is recorded, including deletes/clears. */
document.addEventListener('click',e=>{const b=e.target.closest('button,a');if(!b)return;const label=(b.innerText||b.getAttribute('aria-label')||b.id||'action').trim();audit(/delete|clear/i.test(label)?'delete_or_clear':'button_action',{label,section:$('.section.active')?.id||''})},true);
document.addEventListener('submit',e=>audit('form_submit',{form:e.target.id||'unnamed'}),true);

/* Training registration cards: newest first, same compact summary/card presentation as order requests. */
function trainingCardStyle(){const list=$('#registrationList');if(!list||list.dataset.v3)return;list.dataset.v3='1';const mo=new MutationObserver(()=>{const cards=$$('.registration-card',list);cards.forEach(c=>c.classList.add('v3-training-card'));});mo.observe(list,{childList:true,subtree:true});const st=document.createElement('style');st.textContent='.v3-training-card{border:1px solid #ddd;border-radius:8px;padding:16px;margin:12px 0;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.06)}#registrationList .registration-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}';document.head.appendChild(st)}

/* HR: add requested ID-card fields without changing existing fields. */
function addHRFields(){const section=$('#staffHR')||$('#staff')||$('[data-section="staffHR"]'); if(!section||$('#v3StaffIdFields'))return;const form=section.querySelector('form');if(!form)return;const box=document.createElement('div');box.id='v3StaffIdFields';box.className='form-grid';box.innerHTML=`<div class="form-group"><label for="staffIdCardType">ID Card Type</label><input id="staffIdCardType" placeholder="e.g. Ghana Card, Passport"></div><div class="form-group"><label for="staffIdCardNumber">ID Card Number</label><input id="staffIdCardNumber"></div><div class="form-group"><label for="staffIdCardStartDate">ID Card Registration / Start Date</label><input type="date" id="staffIdCardStartDate"></div><div class="form-group"><label for="staffIdCardExpiryDate">ID Card Expiry Date</label><input type="date" id="staffIdCardExpiryDate"></div><div class="form-group"><label for="staffIdCardImage">Attach Staff / ID Card Image</label><input type="file" accept="image/*" id="staffIdCardImage"></div>`;const firstNameInput=form.querySelector('input[name*="name" i],#staffName');if(firstNameInput&&!firstNameInput.placeholder)firstNameInput.placeholder='First name, middle name, surname';form.appendChild(box)}

/* Accounting: salary card is informational only and excluded from account balance/net cash. */
async function salaryCard(){const cards=$('#accountingSummaryCards');if(!cards||$('#accountingSalary'))return;const card=document.createElement('div');card.className='card';card.innerHTML='<h3>Salary</h3><div class="number" id="accountingSalary">GHS 0.00</div><p>Paid salaries (separate; not deducted from balance)</p>';cards.appendChild(card);const rows=await getSettings('staff_expense_');const total=rows.map(x=>parse(x.setting_value)).filter(x=>/salary|wage/i.test(x.category||'')||/salary|wage/i.test(x.description||'')).reduce((a,x)=>a+Number(x.amount||0),0);$('#accountingSalary').textContent='GHS '+total.toFixed(2)}

/* Payment details public-link issue: use the same saved admin settings, never a separate false-empty store. */
async function repairPaymentDetails(){const rows=await getSettings();const payment=rows.filter(r=>/payment.*detail|invoice_payment_detail/i.test(r.setting_key||'')).map(r=>parse(r.setting_value)).filter(x=>x&&Object.keys(x).length);window.AprilsPaymentDetails=payment;document.dispatchEvent(new CustomEvent('aprils-payment-details-ready',{detail:payment}));}

/* Form reset after successful save: only reset after submit/save event has completed. */
function resetPaymentForm(){const f=$('#invoicePaymentForm');if(!f||f.dataset.v3)return;f.dataset.v3='1';f.addEventListener('submit',()=>setTimeout(()=>f.reset(),400));const save=$('#invoicePaymentForm button[type="submit"]');if(save)save.addEventListener('click',()=>setTimeout(()=>f.reset(),700));}

/* Native sharing of an actual PDF file when supported; WhatsApp opens WhatsApp directly with share text. */
async function nativeSharePdf(blob,name='document.pdf'){const file=new File([blob],name,{type:'application/pdf'});if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]}))return navigator.share({files:[file],title:name});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)}
window.aprilsNativeSharePdf=nativeSharePdf;
function directWhatsApp(text){location.href='https://wa.me/?text='+encodeURIComponent(text||'');}
window.aprilsDirectWhatsApp=directWhatsApp;

/* Latest records first + date-first for data tables where a date column exists. */
function newestFirst(){ $$('table tbody').forEach(tb=>{const rows=[...tb.rows];if(rows.length<2)return;const dated=rows.map(r=>{const t=r.cells[0]?.innerText||'';const d=Date.parse(t.split(' GMT')[0]);return{r,d:Number.isNaN(d)?0:d}});if(dated.some(x=>x.d))dated.sort((a,b)=>b.d-a.d).forEach(x=>tb.appendChild(x.r));});}

/* Delivery/Pickup wording and item numbering. */
function formLabels(){const h=[...$$('h2,h3,h4')].find(x=>/collection.*delivery|delivery.*collection/i.test(x.textContent));if(h)h.textContent='Delivery / Pickup Form';$$('table').forEach(t=>{const heads=[...t.querySelectorAll('thead th')];if(heads.length>=2&&/item.*description/i.test(heads[0]?.textContent||'')){heads[0].textContent='Item(s) / Description';heads[1].textContent='Details';if(heads[2])heads[2].textContent='Quantity';}})}

/* Automatic readable spacing for text values without guessing or altering stored values. */
function readableSpacing(){ $$('input[type="text"],textarea').forEach(i=>{if(i.dataset.v3space)return;i.dataset.v3space='1';i.addEventListener('blur',()=>{i.value=i.value.replace(/([a-zA-Z])(?=\d)/g,'$1 ').replace(/(\d)(?=[a-zA-Z])/g,'$1 ').replace(/\s{2,}/g,' ').trim()})})}

function boot(){trainingCardStyle();addHRFields();salaryCard().catch(console.warn);repairPaymentDetails().catch(console.warn);resetPaymentForm();formLabels();readableSpacing();newestFirst();setInterval(()=>{newestFirst();addHRFields();formLabels();readableSpacing()},2500);audit('instruction_implementation_v3_loaded',{at:now()})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,900));else setTimeout(boot,900);
})();

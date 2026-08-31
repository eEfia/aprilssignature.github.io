/* Aprils Signature — COMPLETE CORRECTION PASS
 * Implements only the supplied correction brief. This layer is loaded last so
 * it repairs presentation, persistence and action behaviour without replacing
 * the existing Supabase data model.
 */
(function(){
  'use strict';
  const esc=window.escapeHTML||((v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])));
  const db=()=>window.aprilsSupabase||window.AprilsSupabase||null;
  const iso=()=>new Date().toISOString();
  const slug=v=>String(v??'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,90);
  const norm=v=>String(v??'').trim().toLowerCase().replace(/\s+/g,' ');
  const money=v=>`GHS ${Number(v||0).toFixed(2)}`;
  const msg=(t,type='success')=>window.message?window.message(t,type):void 0;
  const dateOnly=v=>{if(!v)return '—';const s=String(v);const m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);return m?`${m[3]}/${m[2]}/${m[1]}`:s};
  const dateTime=v=>{if(!v)return '—';const d=new Date(v);if(Number.isNaN(d.getTime()))return String(v);return new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(d)+' GMT'};
  async function settings(){const d=db();if(!d)return[];const r=await d.from('settings').select('*');if(r.error)throw r.error;return r.data||[]}
  async function audit(type,id,action,details={}){try{if(window.auditSystemEvent)await window.auditSystemEvent(type,id,action,details)}catch(_){} }
  function words(n){
    n=Math.floor(Number(n)||0);
    const ones=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
    const tens=['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
    if(n<20)return ones[n]; if(n<100)return tens[Math.floor(n/10)]+(n%10?' '+ones[n%10]:''); if(n<1000)return ones[Math.floor(n/100)]+' hundred'+(n%100?' and '+words(n%100):'');
    if(n<1000000)return words(Math.floor(n/1000))+' thousand'+(n%1000?' '+words(n%1000):'');
    if(n<1000000000)return words(Math.floor(n/1000000))+' million'+(n%1000000?' '+words(n%1000000):'');
    return String(n);
  }
  function qtyText(q){const n=Math.max(0,Number(q)||0);return `${words(n)} (${n})`}

  /* ---- Spacing: keep ordinary human-entered text readable without touching
     emails, phones, URLs, IDs, passwords or numeric controls. ---- */
  function improveSpacing(value){
    return String(value??'').replace(/[ \t]{2,}/g,' ').replace(/([A-Za-z])([0-9])/g,'$1 $2').replace(/([0-9])([A-Za-z])/g,'$1 $2').trim();
  }
  function bindSpacing(){
    if(document.documentElement.dataset.completeSpacing)return;document.documentElement.dataset.completeSpacing='1';
    document.addEventListener('blur',e=>{
      const el=e.target;if(!(el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement))return;
      const type=(el.type||'text').toLowerCase(),id=(el.id||'').toLowerCase();
      if(type!=='text'&&type!=='search'&&el.tagName!=='TEXTAREA')return;
      if(type==='search'||/email|phone|whatsapp|url|password|number|date|time|invoice|receipt|staffid|\bid\b|reference|account|network/.test(id))return;
      el.value=improveSpacing(el.value);
    },true);
  }

  /* ---- Training registrations: same individual square cards as order/quote. ---- */
  async function loadTrainingRegistrationsComplete(){
    const list=document.getElementById('registrationList');if(!list)return;
    try{
      const [tr,rs]=await Promise.all([db().from('training_registrations').select('*'),settings()]);
      if(tr.error)throw tr.error;
      const status=new Map(rs.filter(r=>String(r.setting_key||'').startsWith('training_status_')).map(r=>[String(r.setting_key).replace('training_status_',''),String(r.setting_value||'under_review')]));
      const payStatus=new Map(rs.filter(r=>String(r.setting_key||'').startsWith('payment_status_training_')).map(r=>[String(r.setting_key).replace('payment_status_training_',''),String(r.setting_value||'unpaid')]));
      const invs=rs.filter(r=>String(r.setting_key||'').startsWith('invoice_record_')).map(r=>{try{return JSON.parse(r.setting_value||'{}')}catch(_){return null}}).filter(Boolean);
      const pays=rs.filter(r=>String(r.setting_key||'').startsWith('invoice_payment_record_')).map(r=>{try{return JSON.parse(r.setting_value||'{}')}catch(_){return null}}).filter(Boolean);
      const recs=rs.filter(r=>String(r.setting_key||'').startsWith('receipt_record_')).map(r=>{try{return JSON.parse(r.setting_value||'{}')}catch(_){return null}}).filter(Boolean);
      const rows=(tr.data||[]).map(row=>{
        const inv=invs.filter(i=>String(i.sourceId||'')===String(row.id)||norm(i.customer)===norm(row.full_name)).sort((a,b)=>String(b.updatedAt||b.savedAt||'').localeCompare(String(a.updatedAt||a.savedAt||'')))[0];
        const paid=pays.filter(p=>String(p.invoiceNumber||'')===String(inv?.invoiceNumber||'')).reduce((a,p)=>a+Number(p.amount||0),0);
        const total=Number(inv?.total||0), balance=Math.max(0,total-paid);
        let st=status.get(String(row.id))||'';if(!st)st=paid>0?(total>0&&paid>=total?'fully_paid':'part_paid'):inv?'invoice_generated':'under_review';
        const ps=payStatus.get(String(row.id))||(paid>=total&&total>0?'fully_paid':paid>0?'part_paid':'unpaid');
        return {row,inv,paid,total,balance,status:st,paymentStatus:ps,receipt:recs.find(r=>String(r.invoiceNumber||'')===String(inv?.invoiceNumber||''))};
      }).sort((a,b)=>String(b.row.created_at||'').localeCompare(String(a.row.created_at||'')));
      const statusOptions=[['under_review','New Customer — Under Review'],['invoice_generated','Invoice Generated'],['part_paid','Part Paid'],['fully_paid','Fully Paid'],['in_class','In Class'],['completed','Completed'],['stopped','Stopped'],['cancelled','Cancelled']];
      const payOptions=[['unpaid','Unpaid'],['part_paid','Part Paid'],['fully_paid','Fully Paid'],['refunded','Refunded'],['partially_refunded','Partially Refunded']];
      const select=(prefix,id,current,options)=>`<div class="status-control"><select class="admin-status-select" data-complete-status-prefix="${prefix}" data-complete-status-id="${esc(id)}">${options.map(o=>`<option value="${o[0]}" ${o[0]===current?'selected':''}>${esc(o[1])}</option>`).join('')}</select><button type="button" class="secondary save-status-button" data-complete-save-status="1">Save</button></div>`;
      const details=row=>row.message||row.request_details||row.details||row.journey||'—';
      list.innerHTML=rows.length?`<div class="submission-card-grid">${rows.map(x=>`<article class="submission-card"><div class="submission-card-top"><div><strong>${esc(x.row.full_name||'Customer')}</strong><span>${esc(x.row.course||'Training Registration')}</span></div><time>${esc(dateTime(x.row.created_at))}</time></div><div class="submission-card-gridline"><span><b>Phone / WhatsApp</b>${esc([x.row.phone,x.row.whatsapp].filter(Boolean).join(' • ')||'—')}</span><span><b>Location</b>${esc(x.row.location||'—')}</span><span><b>Training Programme</b>${esc(x.row.course||'—')}</span><span><b>Quantity</b>${esc(qtyText((()=>{try{const j=JSON.parse(x.row.journey||x.row.request_details||x.row.details||'{}');return j.quantity||j.trainingQuantity||1}catch(_){return 1}})()))}</span><span class="wide"><b>Details</b>${esc(details(x.row))}</span></div><div class="submission-status-strip"><span><b>Training Order Status</b>${select('training_status',x.row.id,x.status,statusOptions)}</span><span><b>Payment Status</b>${select('payment_status_training',x.row.id,x.paymentStatus,payOptions)}</span><span><b>Invoice</b>${esc(x.inv?.invoiceNumber||'—')}</span><span><b>Receipt</b>${esc(x.receipt?.receiptNumber||'—')}</span><span><b>Amount</b>${money(x.total)}</span><span><b>Paid</b>${money(x.paid)}</span><span><b>Balance</b>${money(x.balance)}</span></div><div class="submission-card-actions"><button type="button" class="secondary" data-complete-view-training="${esc(x.row.id)}">View Full Details</button><button type="button" class="primary" data-complete-training-invoice="${esc(x.row.id)}">Generate Invoice</button><button type="button" class="danger" data-complete-delete-training="${esc(x.row.id)}">Delete</button></div></article>`).join('')}</div>`:'<div class="empty">No training registrations received.</div>';
      list.querySelectorAll('[data-complete-save-status]').forEach(b=>b.onclick=async()=>{const c=b.closest('.submission-card'),sel=b.closest('.status-control')?.querySelector('select');if(!sel)return;try{const prefix=sel.dataset.completeStatusPrefix,id=sel.dataset.completeStatusId;await (window.setAdminRecordStatus?window.setAdminRecordStatus(prefix,id,sel.value):window.safeSettingUpsert(prefix+'_'+id,sel.value));await audit('training_registration',id,'status_updated',{statusType:prefix,status:sel.value});msg('Training status updated.');await loadTrainingRegistrationsComplete()}catch(e){msg('Status could not be updated: '+e.message,'error')}});
      list.querySelectorAll('[data-complete-view-training]').forEach(b=>b.onclick=()=>{const x=rows.find(r=>String(r.row.id)===String(b.dataset.completeViewTraining));if(x&&window.aprilsShowSubmissionDetails)window.aprilsShowSubmissionDetails('Training Registration Details',x.row,details(x.row),'')});
      list.querySelectorAll('[data-complete-training-invoice]').forEach(b=>b.onclick=async()=>{const x=rows.find(r=>String(r.row.id)===String(b.dataset.completeTrainingInvoice));if(!x)return;try{const pm=window.getInvoicePriceMap?await window.getInvoicePriceMap():new Map();const price=Number(x.inv?.lines?.[0]?.unitPrice||0)||Number(window.invoicePriceFor?.(pm,'Training - '+(x.row.course||''))||window.invoicePriceFor?.(pm,x.row.course)||0);await window.openInvoiceGenerator(x.row,{manualLines:[{description:x.row.course||'Training / Programme / Class',details:details(x.row),quantity:1,unitPrice:price}],training:x.row.course||'Training / Programme / Class',invoiceNumber:x.inv?.invoiceNumber||undefined,existingRecord:x.inv||null});await audit('training_registration',x.row.id,'invoice_generated',{invoiceNumber:document.getElementById('generatedInvoiceNumber')?.value||''})}catch(e){msg('Training invoice could not be generated: '+e.message,'error')}});
      list.querySelectorAll('[data-complete-delete-training]').forEach(b=>b.onclick=async()=>{if(!confirm('Delete this training registration permanently?'))return;try{const d=db(),r=await d.from('training_registrations').delete().eq('id',b.dataset.completeDeleteTraining);if(r.error)throw r.error;await d.from('settings').delete().eq('setting_key','training_status_'+b.dataset.completeDeleteTraining);await d.from('settings').delete().eq('setting_key','payment_status_training_'+b.dataset.completeDeleteTraining);await audit('training_registration',b.dataset.completeDeleteTraining,'deleted',{});msg('Training registration deleted.');await loadTrainingRegistrationsComplete()}catch(e){msg('Training registration could not be deleted: '+e.message,'error')}});
    }catch(e){list.innerHTML=`<div class="empty">Training registrations could not be loaded: ${esc(e.message||'')}</div>`}
  }

  /* ---- Trainees: spreadsheet-style tracking table, latest first. ---- */
  async function loadTraineesComplete(){
    const list=document.getElementById('traineesList');if(!list)return;
    try{
      const [tr,rs]=await Promise.all([db().from('training_registrations').select('*'),settings()]);if(tr.error)throw tr.error;
      const invs=rs.filter(r=>String(r.setting_key||'').startsWith('invoice_record_')).map(r=>{try{return JSON.parse(r.setting_value||'{}')}catch(_){return null}}).filter(Boolean);
      const pays=rs.filter(r=>String(r.setting_key||'').startsWith('invoice_payment_record_')).map(r=>{try{return JSON.parse(r.setting_value||'{}')}catch(_){return null}}).filter(Boolean);
      const statuses=new Map(rs.filter(r=>String(r.setting_key||'').startsWith('training_status_')).map(r=>[String(r.setting_key).replace('training_status_',''),String(r.setting_value||'')]));
      const rows=(tr.data||[]).map(row=>{const inv=invs.filter(i=>String(i.sourceId||'')===String(row.id)||norm(i.customer)===norm(row.full_name)).sort((a,b)=>String(b.updatedAt||b.savedAt||'').localeCompare(String(a.updatedAt||a.savedAt||'')))[0];const paid=pays.filter(p=>String(p.invoiceNumber||'')===String(inv?.invoiceNumber||'')).reduce((a,p)=>a+Number(p.amount||0),0);if(paid<=0)return null;const total=Number(inv?.total||0),balance=Math.max(0,total-paid);let st=statuses.get(String(row.id))||'';if(!['in_class','stopped','completed'].includes(st))st=balance<=0&&total>0?'fully_paid':'part_paid';return{row,inv,paid,total,balance,status:st}}).filter(Boolean).sort((a,b)=>String(b.row.created_at||'').localeCompare(String(a.row.created_at||'')));
      const opts=[['part_paid','Part Paid'],['fully_paid','Fully Paid'],['in_class','In Class'],['stopped','Stopped'],['completed','Completed']];
      const statusSel=(id,v)=>`<div class="status-control"><select class="admin-status-select" data-trainee-id="${esc(id)}">${opts.map(o=>`<option value="${o[0]}" ${o[0]===v?'selected':''}>${o[1]}</option>`).join('')}</select><button type="button" class="secondary save-status-button" data-trainee-save="${esc(id)}">Save</button></div>`;
      list.innerHTML=rows.length?`<table><thead><tr><th>Date</th><th>Trainee</th><th>Phone</th><th>Training Programme</th><th>Invoice</th><th>Total</th><th>Paid</th><th>Balance</th><th>Training Status</th><th>Actions</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(dateTime(x.row.created_at))}</td><td>${esc(x.row.full_name||'')}</td><td>${esc(x.row.phone||'')}</td><td>${esc(x.row.course||'')}</td><td>${esc(x.inv?.invoiceNumber||'—')}</td><td>${money(x.total)}</td><td>${money(x.paid)}</td><td>${money(x.balance)}</td><td>${statusSel(x.row.id,x.status)}</td><td><button type="button" class="secondary" data-trainee-view-complete="${esc(x.row.id)}">View</button></td></tr>`).join('')}</tbody></table>`:'<div class="empty">No paid trainees have been recorded yet.</div>';
      list.querySelectorAll('[data-trainee-save]').forEach(b=>b.onclick=async()=>{try{const sel=b.closest('.status-control')?.querySelector('select');await window.setAdminRecordStatus('training_status',b.dataset.traineeSave,sel?.value||'part_paid');await audit('training_registration',b.dataset.traineeSave,'trainee_status_updated',{status:sel?.value||'part_paid'});msg('Trainee status updated.');await loadTraineesComplete()}catch(e){msg('Trainee status could not be updated: '+e.message,'error')}});
      list.querySelectorAll('[data-trainee-view-complete]').forEach(b=>b.onclick=()=>{const x=rows.find(r=>String(r.row.id)===String(b.dataset.traineeViewComplete));if(x&&window.aprilsShowSubmissionDetails)window.aprilsShowSubmissionDetails('Trainee Details',x.row,x.row.message||x.row.request_details||x.row.details||x.row.journey||'')});
    }catch(e){list.innerHTML=`<div class="empty">Trainees could not be loaded: ${esc(e.message||'')}</div>`}
  }

  /* ---- Accounting: salary gets its own card, but salary still belongs in
     business expenses and therefore affects expenses/net cash only there. ---- */
  function ensureSalaryCard(){const cards=document.getElementById('accountingSummaryCards');if(!cards||document.getElementById('accountingSalary'))return;const c=document.createElement('div');c.className='card';c.innerHTML='<h3>Salary</h3><div class="number" id="accountingSalary">GHS 0.00</div><p>Salary / staff payments recorded separately</p>';cards.appendChild(c)}
  async function loadAccountingComplete(){
    const list=document.getElementById('accountingList');if(!list)return;ensureSalaryCard();
    try{
      const rs=await settings();
      const parse=p=>rs.filter(r=>String(r.setting_key||'').startsWith(p)).map(r=>{try{return{...JSON.parse(r.setting_value||'{}'),_id:r.id,_key:r.setting_key}}catch(_){return null}}).filter(Boolean);
      const inv=parse('invoice_record_'), payments=parse('invoice_payment_record_'), refunds=parse('refund_record_').filter(r=>['paid','refund recorded'].includes(String(r.status||'').toLowerCase()));
      const business=parse('accounting_expense_'), staff=parse('staff_expense_');
      const invMap=new Map(inv.filter(x=>x.invoiceNumber).map(x=>[String(x.invoiceNumber),x])), payMap=new Map();payments.forEach(p=>{const k=String(p.invoiceNumber||'');if(!k)return;if(!payMap.has(k))payMap.set(k,[]);payMap.get(k).push(p)});
      const refMap=new Map();refunds.forEach(r=>refMap.set(String(r.invoiceNumber||''),(refMap.get(String(r.invoiceNumber||''))||0)+Number(r.refundAmount||0)));
      const records=[...invMap.values()].map(i=>{const received=(payMap.get(String(i.invoiceNumber))||[]).reduce((a,p)=>a+Number(p.amount||0),0),ref=refMap.get(String(i.invoiceNumber))||0,net=Math.max(0,received-ref);return{...i,_received:received,_refund:ref,_net:net,_balance:Math.max(0,Number(i.total||0)-net)}}).filter(i=>i._received>0).sort((a,b)=>String(b.date||b.savedAt||'').localeCompare(String(a.date||a.savedAt||'')));
      const totalReceived=records.reduce((a,x)=>a+x._received,0),totalRefund=refunds.reduce((a,x)=>a+Number(x.refundAmount||0),0),netReceived=Math.max(0,totalReceived-totalRefund),outstanding=records.reduce((a,x)=>a+x._balance,0),discounts=records.reduce((a,x)=>a+Number(x.discount||0),0);
      const allExpenses=[...business,...staff],expenseDedup=new Map();allExpenses.forEach(e=>{const k=String(e._id||e.savedAt||`${e.date}|${e.category}|${e.description}|${e.amount}`);if(!expenseDedup.has(k))expenseDedup.set(k,e)});const expenses=[...expenseDedup.values()];
      const totalExpenses=expenses.reduce((a,e)=>a+Number(e.amount||0),0),salary=expenses.filter(e=>/staff|salary|wage/i.test(`${e.category||''} ${e.description||''}`)).reduce((a,e)=>a+Number(e.amount||0),0);
      list.innerHTML=records.length?`<table><thead><tr><th>Date</th><th>Invoice</th><th>Type</th><th>Customer</th><th>Total Received</th><th>Refunded</th><th>Net Sales</th><th>Balance</th><th>Status</th></tr></thead><tbody>${records.map(x=>`<tr><td>${esc(dateOnly(x.date||x.savedAt))}</td><td>${esc(x.invoiceNumber||'')}</td><td>${esc(x.training?'Training':'Order / Quote')}</td><td>${esc(x.customer||'')}</td><td>${money(x._received)}</td><td>${money(x._refund)}</td><td>${money(x._net)}</td><td>${money(x._balance)}</td><td>${x._balance<=0?'Paid in full':'Part payment'}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">No payments received have been recorded yet. Invoices alone are not counted as sales.</div>';
      const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=money(v)};set('accountingSales',netReceived);set('accountingReceived',netReceived);set('accountingOutstanding',outstanding);set('accountingDiscounts',discounts);set('accountingExpenses',totalExpenses);set('accountingNetCash',netReceived-totalExpenses);set('accountingRefunds',totalRefund);set('accountingSalary',salary);
      const inventory=rs.filter(r=>String(r.setting_key||'').startsWith('inventory_item_')).map(r=>{try{return{...JSON.parse(r.setting_value||'{}'),_id:r.id}}catch(_){return null}}).filter(Boolean);
      const stock=document.getElementById('accountingInventoryList');if(stock)stock.innerHTML=inventory.length?`<table><thead><tr><th>Date</th><th>Collection</th><th>Product</th><th>Quantity</th><th>Unit Price</th><th>Stock Value</th></tr></thead><tbody>${inventory.sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||''))).map(i=>`<tr><td>${esc(dateOnly(i.updatedAt||i.createdAt))}</td><td>${esc(i.collection||'')}</td><td>${esc(i.name||'')}</td><td>${Number(i.quantity||0)}</td><td>${money(i.price)}</td><td>${money(Number(i.price||0)*Number(i.quantity||0))}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">No inventory records yet.</div>';
      const ex=document.getElementById('accountingExpenseList');if(ex)ex.innerHTML=expenses.length?`<table><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th>Actions</th></tr></thead><tbody>${expenses.sort((a,b)=>String(b.date||b.savedAt||'').localeCompare(String(a.date||a.savedAt||''))).map(e=>`<tr><td>${esc(dateOnly(e.date||e.savedAt))}</td><td>${esc(e.category||'')}</td><td>${esc(e.description||'')}</td><td>${money(e.amount)}</td><td>${e._id?`<button type="button" class="secondary" data-complete-edit-expense="${esc(e._id)}">Edit</button> <button type="button" class="danger" data-complete-delete-expense="${esc(e._id)}">Delete</button>`:''}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">No business expenses recorded yet.</div>';
      const staffCard=document.getElementById('staffAccountingList')||(()=>{const c=document.createElement('div');c.id='staffAccountingList';c.className='form-card';c.innerHTML='<h3>Staff / HR Expenses</h3><div class="table-wrap"></div>';document.getElementById('accounting')?.appendChild(c);return c})();const sl=staffCard.querySelector('.table-wrap'),staffRows=expenses.filter(e=>/staff|salary|wage|hr/i.test(`${e.category||''} ${e.description||''}`));sl.innerHTML=staffRows.length?`<table><thead><tr><th>Date</th><th>Staff ID</th><th>Staff Name</th><th>Description</th><th>Amount</th></tr></thead><tbody>${staffRows.map(e=>`<tr><td>${esc(dateOnly(e.date||e.savedAt))}</td><td>${esc(e.staffId||'')}</td><td>${esc(e.staffName||'')}</td><td>${esc(e.description||'')}</td><td>${money(e.amount)}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">No staff / HR expenses recorded.</div>';
      ex?.querySelectorAll('[data-complete-edit-expense]').forEach(b=>b.onclick=()=>{const e=expenses.find(x=>String(x._id)===String(b.dataset.completeEditExpense));if(!e)return;document.getElementById('accountingExpenseId').value=e._id;document.getElementById('accountingExpenseDate').value=String(e.date||'').slice(0,10);document.getElementById('accountingExpenseCategory').value=e.category||'';document.getElementById('accountingExpenseAmount').value=e.amount||0;document.getElementById('accountingExpenseDescription').value=e.description||'';document.getElementById('accountingExpenseForm')?.scrollIntoView({behavior:'smooth'})});
      ex?.querySelectorAll('[data-complete-delete-expense]').forEach(b=>b.onclick=async()=>{if(!confirm('Delete this expense?'))return;const r=await db().from('settings').delete().eq('id',b.dataset.completeDeleteExpense);if(r.error){msg('Expense could not be deleted: '+r.error.message,'error');return}await audit('accounting_expense',b.dataset.completeDeleteExpense,'deleted',{});await loadAccountingComplete()});
    }catch(e){msg('Sales & Accounting could not be refreshed: '+e.message,'error')}
  }

  /* ---- Refund list: each refund gets Generate Invoice in addition to existing actions. ---- */
  function enhanceRefundGenerateInvoice(){
    const list=document.getElementById('refundList');if(!list||list.dataset.completeRefund)return;list.dataset.completeRefund='1';
    const inject=()=>{list.querySelectorAll('tbody tr').forEach(tr=>{if(tr.querySelector('[data-complete-refund-invoice]'))return;const inv=tr.cells?.[2]?.textContent?.trim();const b=document.createElement('button');b.type='button';b.className='primary';b.textContent='Generate Invoice';b.dataset.completeRefundInvoice=inv||'';b.style.marginLeft='5px';tr.lastElementChild?.appendChild(b)})};
    const observer=new MutationObserver(inject);observer.observe(list,{childList:true,subtree:true});inject();
    list.addEventListener('click',async e=>{const b=e.target.closest('[data-complete-refund-invoice]');if(!b)return;const invoice=b.dataset.completeRefundInvoice;if(!invoice)return;try{const rs=await settings();const inv=rs.filter(r=>String(r.setting_key||'').startsWith('invoice_record_')).map(r=>{try{return JSON.parse(r.setting_value||'{}')}catch(_){return null}}).find(x=>String(x?.invoiceNumber)===String(invoice));if(!inv){msg('The original invoice could not be found.','error');return}await window.openInvoiceGenerator({id:inv.sourceId||'',full_name:inv.customer||'',phone:inv.phone||'',whatsapp:inv.phone||'',email:inv.email||'',location:inv.address||''},{manualLines:inv.lines||[],notes:inv.notes||'',training:!!inv.training,invoiceNumber:inv.invoiceNumber,existingRecord:inv});await audit('refund',invoice,'invoice_generated',{})}catch(err){msg('Invoice could not be generated from this refund: '+err.message,'error')}});
    [...list.querySelectorAll('tbody tr')].forEach(()=>{});
  }

  /* ---- Staff/HR fields requested in the brief. ---- */
  function enhanceStaffFields(){
    const sec=document.getElementById('staffHR'),form=document.getElementById('staffHRForm');if(!sec||!form||form.dataset.completeFields)return;form.dataset.completeFields='1';
    const grid=form.querySelector('.form-grid');if(!grid)return;
    const first=grid.querySelector('#staffHRName')?.parentElement;
    const html=`<div class="form-group"><label for="staffHRIdCardType">ID Card Type</label><input id="staffHRIdCardType" placeholder="e.g. Ghana Card"></div><div class="form-group"><label for="staffHRIdCardNumber">ID Card Number</label><input id="staffHRIdCardNumber"></div><div class="form-group"><label for="staffHRIdCardRegistered">ID Card Registration Date</label><input id="staffHRIdCardRegistered" type="date"></div><div class="form-group"><label for="staffHRIdCardExpiry">ID Card Expiry Date</label><input id="staffHRIdCardExpiry" type="date"></div><div class="form-group"><label for="staffHRPhoto">Staff Image</label><input id="staffHRPhoto" type="file" accept="image/jpeg,image/png,image/webp"><small>Attach a staff image to the HR record.</small><div id="staffHRPhotoName" class="small"></div></div>`;
    first?.insertAdjacentHTML('beforebegin',html);
    form.addEventListener('submit',async()=>{setTimeout(async()=>{try{const staffId=document.getElementById('staffHRStaffId')?.value||document.getElementById('staffHRStaffIdDisplay')?.value||'';if(!staffId)return;const d=db();if(!d)return;let photoUrl='';const file=document.getElementById('staffHRPhoto')?.files?.[0];if(file){if(file.size>5*1024*1024)throw new Error('Staff image must be 5 MB or smaller.');const path=`staff-photos/${slug(staffId)}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;const up=await d.storage.from('quote-uploads').upload(path,file,{upsert:false,contentType:file.type});if(up.error)throw up.error;photoUrl=d.storage.from('quote-uploads').getPublicUrl(path)?.data?.publicUrl||''}const rs=await settings(),key='staff_hr_'+slug(staffId),row=rs.find(r=>String(r.setting_key)===key);let rec={};try{rec=JSON.parse(row?.setting_value||'{}')}catch(_){}Object.assign(rec,{idCardType:document.getElementById('staffHRIdCardType')?.value||'',idCardNumber:document.getElementById('staffHRIdCardNumber')?.value||'',idCardRegistered:document.getElementById('staffHRIdCardRegistered')?.value||'',idCardExpiry:document.getElementById('staffHRIdCardExpiry')?.value||''});if(photoUrl)rec.photoUrl=photoUrl;await window.safeSettingUpsert(key,JSON.stringify(rec));document.getElementById('staffHRPhotoName').textContent=file?.name||rec.photoUrl?'Staff image saved.':'';await audit('staff_hr',staffId,'identity_fields_saved',{idCardType:rec.idCardType,idCardNumber:rec.idCardNumber,idCardRegistered:rec.idCardRegistered,idCardExpiry:rec.idCardExpiry,hasPhoto:!!rec.photoUrl});if(window.loadStaff)await window.loadStaff()}catch(e){msg('Staff ID/image details could not be saved: '+e.message,'error')}},600)});
  }

  /* ---- Offline access reset: deliberately deletes only the encrypted local
     offline vault so a new password can be created. Live Supabase data is untouched. ---- */
  function addOfflineReset(){
    const unlock=document.getElementById('unlockForm');if(!unlock||document.getElementById('resetOfflineAccess'))return;const b=document.createElement('button');b.type='button';b.id='resetOfflineAccess';b.className='btn danger';b.style.marginTop='10px';b.textContent='Reset Offline Access';b.onclick=async()=>{if(!confirm('Reset Offline Access? This deletes only the encrypted offline copy on this device. Your live website data will not be deleted.'))return;try{const req=indexedDB.deleteDatabase('aprils_signature_offline_v1');await new Promise((resolve,reject)=>{req.onsuccess=resolve;req.onerror=reject;req.onblocked=resolve});location.reload()}catch(e){msg('Offline access could not be reset: '+e.message,false)}};unlock.parentElement.appendChild(b);
  }

  /* ---- PDF/share actions: always produce a real PDF first. Share PDF and
     WhatsApp use the device share sheet when available, so WhatsApp can be
     selected directly instead of opening a PDF page. ---- */
  async function realPdf(element,filename){
    const h=window.ensureHtml2Pdf?await window.ensureHtml2Pdf():window.html2pdf;if(!h)throw new Error('PDF service unavailable.');
    if(window.pdfFromVisibleElement)return window.pdfFromVisibleElement(element,{margin:0,filename,image:{type:'jpeg',quality:.98},html2canvas:{scale:2,useCORS:true,backgroundColor:'#fff'},jsPDF:{unit:'in',format:'a4',orientation:'portrait'}});
    throw new Error('PDF renderer unavailable.');
  }
  function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000)}
  async function shareBlob(blob,name,title,text,fallbackUrl){
    const file=new File([blob],name,{type:'application/pdf'});
    if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){await navigator.share({title,text,files:[file]});return true}
    if(fallbackUrl){window.location.href=fallbackUrl;return false}
    downloadBlob(blob,name);msg('The PDF was generated and downloaded. This browser does not provide the device file-sharing menu.','success');return false;
  }
  function bindPdfActions(){
    if(document.documentElement.dataset.completePdf)return;document.documentElement.dataset.completePdf='1';
    document.addEventListener('click',async e=>{
      const b=e.target.closest('#invoiceDownloadPdf,#invoiceSharePdf,#invoicePrint,#invoiceWhatsApp,#invoiceEmail,#receiptDownloadPdf,#receiptSharePdf,#receiptPrint,#receiptWhatsApp,#receiptEmail,#collectionGenerate,#collectionShare,#collectionWhatsApp,#accountingSharePdf,#accountingExpensesPdf');if(!b)return;
      e.preventDefault();e.stopImmediatePropagation();b.classList.add('button-working');
      try{
        if(/^invoice/.test(b.id)){const paper=document.getElementById('invoicePaper');const num=document.getElementById('generatedInvoiceNumber')?.value||'Aprils-Signature-Invoice';if(b.id==='invoicePrint'){if(window.printGeneratedInvoice)window.printGeneratedInvoice();else window.print();return}const blob=await realPdf(paper,`${num}.pdf`);if(b.id==='invoiceDownloadPdf')downloadBlob(blob,`${num}.pdf`);else if(b.id==='invoiceSharePdf')await shareBlob(blob,`${num}.pdf`,'Aprils Signature Invoice','Aprils Signature invoice');else if(b.id==='invoiceWhatsApp'){const phone=document.getElementById('generatedInvoicePhone')?.value||'';const n=window.normalizeWhatsAppNumber?window.normalizeWhatsAppNumber(phone):String(phone).replace(/\D/g,'');await shareBlob(blob,`${num}.pdf`,'Aprils Signature Invoice','Aprils Signature invoice',n?`whatsapp://send?phone=${n}`:'whatsapp://send')}
        else if(b.id==='invoiceEmail'){const email=document.getElementById('generatedInvoiceEmail')?.value||'';await shareBlob(blob,`${num}.pdf`,'Aprils Signature Invoice','Aprils Signature invoice',`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('Aprils Signature Invoice '+num)}&body=${encodeURIComponent('Please see the attached Aprils Signature invoice PDF.')}`)}}
        else if(/^receipt/.test(b.id)){const paper=document.getElementById('receiptPaper');const num=document.getElementById('generatedReceiptNumber')?.value||'Aprils-Signature-Receipt';if(b.id==='receiptPrint'){if(window.printGeneratedReceipt)window.printGeneratedReceipt();else window.print();return}const blob=await realPdf(paper,`${num}.pdf`);if(b.id==='receiptDownloadPdf')downloadBlob(blob,`${num}.pdf`);else if(b.id==='receiptSharePdf')await shareBlob(blob,`${num}.pdf`,'Aprils Signature Payment Receipt','Aprils Signature payment receipt');else if(b.id==='receiptWhatsApp'){const phone=document.getElementById('generatedReceiptPhone')?.value||'';const n=window.normalizeWhatsAppNumber?window.normalizeWhatsAppNumber(phone):String(phone).replace(/\D/g,'');await shareBlob(blob,`${num}.pdf`,'Aprils Signature Payment Receipt','Aprils Signature payment receipt',n?`whatsapp://send?phone=${n}`:'whatsapp://send')}else if(b.id==='receiptEmail'){const email=document.getElementById('generatedReceiptEmail')?.value||'';await shareBlob(blob,`${num}.pdf`,'Aprils Signature Payment Receipt','Aprils Signature payment receipt',`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('Aprils Signature Payment Receipt '+num)}&body=${encodeURIComponent('Please see the attached Aprils Signature receipt PDF.')}`)}}
        else if(/^collection/.test(b.id)){await (window.strictCollectionGenerate?window.strictCollectionGenerate(b):window.collectionGenerateAction?window.collectionGenerateAction(b):Promise.resolve());}
        else if(/^accounting/.test(b.id)){const kind=b.id==='accountingExpensesPdf'?'expenses':'sales';if(window.exportAccountingPdf)await window.exportAccountingPdf(kind,true)}
      }catch(err){if(err?.name!=='AbortError')msg('This action could not be completed: '+err.message,'error')}finally{b.classList.remove('button-working')}
    },true);
  }

  /* Auto-save receipt record when the receipt generator opens, while payment
     itself is counted in accounting only through invoice_payment_record_. */
  function autoSaveReceiptDraft(){
    if(document.documentElement.dataset.completeReceiptDraft)return;document.documentElement.dataset.completeReceiptDraft='1';
    const mo=new MutationObserver(async()=>{const modal=document.getElementById('receiptGeneratorModal'),st=window._aprilsCurrentReceipt;if(!modal||!st||modal.dataset.completeDraft)return;modal.dataset.completeDraft='1';try{if(window.saveReceiptRecordDraft)await window.saveReceiptRecordDraft();await audit('receipt',document.getElementById('generatedReceiptNumber')?.value||'','receipt_generated',{invoiceNumber:document.getElementById('generatedReceiptInvoiceNumber')?.value||''})}catch(e){console.warn('Receipt automatic save skipped',e)}});mo.observe(document.body,{childList:true,subtree:true});
  }

  /* ---- Public payment details: use the dedicated public table and never add
     Payment Details to the public navigation. ---- */
  function hardenPaymentPage(){
    if(!document.getElementById('paymentDetails'))return;
    const load=async()=>{try{const d=db();if(!d)throw new Error('Supabase unavailable');const r=await d.from('public_payment_details').select('network,number,name,branch,display_order').eq('active',true).order('display_order',{ascending:true});if(r.error)throw r.error;if(r.data?.length){document.getElementById('paymentDetails').innerHTML=r.data.map(x=>`<article class="service-card"><h3>${esc(x.network||'Payment Method')}</h3><p><strong>Account / Number:</strong> ${esc(x.number||'')}</p><p><strong>Name:</strong> ${esc(x.name||'')}</p>${x.branch?`<p><strong>Bank Branch:</strong> ${esc(x.branch)}</p>`:''}</article>`).join('');return}document.getElementById('paymentDetails').innerHTML='<div class="empty">Payment details have not been saved yet.</div>'}catch(e){console.error(e);document.getElementById('paymentDetails').innerHTML='<div class="empty">Payment details are temporarily unavailable.</div>'}};load();
  }

  /* ---- Quantity words + latest-first dates in rendered tables/PDFs. ---- */
  function applyQuantityWords(){
    document.querySelectorAll('.submission-card-gridline span,.invoice-lines tbody td:nth-child(4),.receipt-lines tbody td:nth-child(3),.final-collection-paper tbody td:nth-child(4)').forEach(el=>{
      if(el.dataset.completeQty)return;
      const t=String(el.textContent||'').trim();
      let m=t.match(/^Quantity:\s*(\d+)$/i);
      if(m){el.textContent='Quantity: '+qtyText(Number(m[1]));el.dataset.completeQty='1';return}
      if(/^\d+$/.test(t)&&Number(t)>0&&Number(t)<100000){el.textContent=qtyText(Number(t));el.dataset.completeQty='1'}
    });
  }
  function sortDateTables(){
    document.querySelectorAll('.section table').forEach(table=>{
      const heads=[...table.querySelectorAll('thead th')],dateIndex=heads.findIndex(h=>/date/i.test(h.textContent||''));
      if(dateIndex<0)return;
      const body=table.querySelector('tbody');if(!body)return;
      const rows=[...body.querySelectorAll('tr')];if(rows.length<2)return;
      const stamp=v=>{const t=String(v||'').trim();const m=t.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);if(m)return `${m[3]}-${m[2]}-${m[1]}T${m[4]||'00'}:${m[5]||'00'}`;const d=new Date(t);return Number.isNaN(d.getTime())?t:d.toISOString()};
      rows.sort((a,b)=>stamp(b.cells[dateIndex]?.textContent).localeCompare(stamp(a.cells[dateIndex]?.textContent)));
      rows.forEach(r=>body.appendChild(r));
    });
  }
  function spacingInRenderedText(){
    document.querySelectorAll('.submission-card-gridline span,.invoice-paper td,.receipt-paper td,.final-collection-paper td,.section td').forEach(el=>{
      if(el.dataset.completeSpacing)return;
      const t=String(el.textContent||'');if(!t)return;
      if(/^https?:\/\//i.test(t)||/^[+\d\s()-]{7,}$/.test(t)||/@/.test(t))return;
      const n=improveSpacing(t);if(n!==t)el.textContent=n;el.dataset.completeSpacing='1';
    });
  }

  /* Audit error-log clearing as well as normal delete actions. */
  function auditErrorClear(){const b=document.getElementById('clearErrorLog');if(!b||b.dataset.completeAudit)return;b.dataset.completeAudit='1';b.addEventListener('click',()=>audit('system_error_log','system_error_log','cleared',{at:iso()}),true)}

  function boot(){
    bindSpacing();bindPdfActions();autoSaveReceiptDraft();addOfflineReset();hardenPaymentPage();auditErrorClear();applyQuantityWords();sortDateTables();spacingInRenderedText();
    const originalLoadReg=window.loadRegistrations;if(originalLoadReg&&!originalLoadReg.__complete){window.loadRegistrations=loadTrainingRegistrationsComplete;window.loadRegistrations.__complete=true}
    const originalTrainees=window.loadTrainees;if(originalTrainees&&!originalTrainees.__complete){window.loadTrainees=loadTraineesComplete;window.loadTrainees.__complete=true}
    const originalAccounting=window.loadAccounting;if(originalAccounting&&!originalAccounting.__complete){window.loadAccounting=loadAccountingComplete;window.loadAccounting.__complete=true}
    enhanceStaffFields();enhanceRefundGenerateInvoice();
    setTimeout(()=>{enhanceStaffFields();enhanceRefundGenerateInvoice();if(document.getElementById('registrationList'))loadTrainingRegistrationsComplete();if(document.getElementById('accounting')?.classList.contains('active'))loadAccountingComplete()},1200);
    setInterval(()=>{try{enhanceStaffFields();enhanceRefundGenerateInvoice();addOfflineReset();auditErrorClear();applyQuantityWords();sortDateTables();spacingInRenderedText()}catch(_){}},2000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();

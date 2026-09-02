/* Aprils Signature — strict final integration layer.
 * This file is deliberately additive: it keeps the supplied website/database
 * structure and closes the remaining correction points without introducing a
 * second data store for invoices, receipts, products or training.
 */
(function(){
  "use strict";
  const db=()=>window.aprilsSupabase||window.AprilsSupabase||null;
  const esc=window.escapeHTML||((v)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c])));
  const norm=v=>String(v??"").trim().toLowerCase().replace(/\s+/g," ");
  const slug=v=>norm(v).replace(/[^a-z0-9]+/g,"_").rece(/^_+|_+$/g,"").slice(0,90);
  const money=v=>`GHS ${Number(v||0).toFixed(2)}`;
  const msg=(t,type="success")=>window.message?window.message(t,type):void 0;
  const isoNow=()=>new Date().toISOString();
  const dateDMY=v=>{
    if(!v)return "—"; const s=String(v); const m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(m)return `${m[3]}/${m[2]}/${m[1]}`;
    const d=new Date(v); if(Number.isNaN(d.getTime()))return s;
    return new Intl.DateTimeFormat("en-GB",{timeZone:"UTC",day:"2-digit",month:"2-digit",year:"numeric"}).format(d);
  };
  const dateTimeGMT=v=>{
    if(!v)return "—"; const d=new Date(v); if(Number.isNaN(d.getTime()))return String(v);
    return new Intl.DateTimeFormat("en-GB",{timeZone:"UTC",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false}).format(d)+" GMT";
  };
  async function rows(table){const d=db();if(!d)return[];const r=await d.from(table).select("*");if(r.error)throw r.error;return r.data||[]}
  async function settings(){return rows("settings")}
  async function settingJson(key){const r=(await settings()).find(x=>String(x.setting_key)===String(key));if(!r)return null;try{return JSON.parse(r.setting_value||"null")}catch(_){return r.setting_value}}
  async function audit(entityType,entityId,action,details){try{if(typeof window.auditSystemEvent==="function")await window.auditSystemEvent(entityType,entityId,action,details||{});}catch(_){}
  }

  /* ---------------- Accounting: payments received only; refunds reduce cash received. ---------------- */
  async function finalLoadAccounting(){
    const list=document.getElementById("accountingList"); if(!list)return;
    try{
      const rs=await settings();
      const parse=(prefix)=>rs.filter(r=>String(r.setting_key||"").startsWith(prefix)).map(r=>{try{return{...JSON.parse(r.setting_value||"{}"),_id:r.id,_key:r.setting_key}}catch(_){return null}}).filter(Boolean);
      const invoices=parse("invoice_record_");
      const payments=parse("invoice_payment_record_");
      const refunds=parse("refund_record_").filter(r=>String(r.status||"").toLowerCase()==="paid"||String(r.status||"").toLowerCase()==="refund recorded");
      const businessExpenses=parse("accounting_expense_");
      const staffExpenses=parse("staff_expense_");
      const expenses=[...businessExpenses,...staffExpenses];
      const invMap=new Map(invoices.filter(x=>x.invoiceNumber).map(x=>[String(x.invoiceNumber),x]));
      const payMap=new Map(); payments.forEach(p=>{const k=String(p.invoiceNumber||"");if(!k)return;if(!payMap.has(k))payMap.set(k,[]);payMap.get(k).push(p)});
      const refMap=new Map(); refunds.forEach(r=>{const k=String(r.invoiceNumber||"");refMap.set(k,(refMap.get(k)||0)+Number(r.refundAmount||0))});
      const records=[...invMap.values()].map(inv=>{
        const received=(payMap.get(String(inv.invoiceNumber))||[]).reduce((a,p)=>a+Number(p.amount||0),0);
        const refunded=refMap.get(String(inv.invoiceNumber))||0;
        const net=Math.max(0,received-refunded);
        return {...inv,_received:received,_refunded:refunded,_net:net,_balance:Math.max(0,Number(inv.total||0)-net)};
      }).filter(x=>x._received>0).sort((a,b)=>String(b.date||b.savedAt||"").localeCompare(String(a.date||a.savedAt||"")));
      const totalReceived=records.reduce((a,x)=>a+x._received,0);
      const totalRefunded=refunds.reduce((a,x)=>a+Number(x.refundAmount||0),0);
      const netReceived=Math.max(0,totalReceived-totalRefunded);
      const totalOutstanding=records.reduce((a,x)=>a+x._balance,0);
      const totalDiscounts=records.reduce((a,x)=>a+Number(x.discount||0),0);
      const totalExpenses=businessExpenses.reduce((a,x)=>a+Number(x.amount||0),0);
      const totalSalary=staffExpenses.reduce((a,x)=>a+Number(x.amount||0),0);
      list.innerHTML=records.length?`<table><thead><tr><th>Date</th><th>Invoice</th><th>Type</th><th>Customer</th><th>Total Received</th><th>Refunded</th><th>Net Sales</th><th>Balance</th><th>Status</th></tr></thead><tbody>${records.map(x=>`<tr><td>${esc(dateDMY(x.date||x.savedAt))}</td><td>${esc(x.invoiceNumber||"")}</td><td>${esc(x.training?"Training":"Order / Quote")}</td><td>${esc(x.customer||"")}</td><td>${money(x._received)}</td><td>${money(x._refunded)}</td><td>${money(x._net)}</td><td>${money(x._balance)}</td><td>${x._balance<=0?"Paid in full":"Part payment"}</td></tr>`).join("")}</tbody></table>`:`<div class="empty">No payments received have been recorded yet. Invoices alone are not counted as sales.</div>`;
      const cards=document.getElementById("accountingSummaryCards");
      if(cards&&!document.getElementById("accountingSalaryCard"))cards.insertAdjacentHTML("beforeend",`<div class="card" id="accountingSalaryCard"><h3>Salary</h3><div class="number" id="accountingSalary">GHS 0.00</div><p>Staff salary / bonus paid — separate from business balance</p></div>`);
      const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=money(v)};
      set("accountingSales",netReceived);set("accountingReceived",netReceived);set("accountingOutstanding",totalOutstanding);set("accountingDiscounts",totalDiscounts);set("accountingExpenses",totalExpenses);set("accountingNetCash",netReceived-totalExpenses);set("accountingRefunds",totalRefunded);set("accountingSalary",totalSalary);
      let card=document.getElementById("refundAccountingList");const accounting=document.getElementById("accounting");
      if(!card&&accounting){card=document.createElement("div");card.id="refundAccountingList";card.className="form-card";card.innerHTML="<h3>Refunds</h3><div class='table-wrap'></div>";accounting.appendChild(card)}
      const rl=card?.querySelector(".table-wrap");if(rl)rl.innerHTML=refunds.length?`<table><thead><tr><th>Date</th><th>Refund</th><th>Invoice</th><th>Customer</th><th>Amount</th></tr></thead><tbody>${refunds.map(r=>`<tr><td>${esc(dateTimeGMT(r.date||r.updatedAt))}</td><td>${esc(r.refundNumber||"")}</td><td>${esc(r.invoiceNumber||"")}</td><td>${esc(r.customer||"")}</td><td>${money(r.refundAmount)}</td></tr>`).join("")}</tbody></table>`:`<div class="empty">No refunds recorded.</div>`;
      let staff=document.getElementById("staffAccountingList");if(!staff&&accounting){staff=document.createElement("div");staff.id="staffAccountingList";staff.className="form-card";staff.innerHTML="<h3>Staff / HR Expenses</h3><div class='table-wrap'></div>";accounting.appendChild(staff)}
      const sl=staff?.querySelector(".table-wrap"),staffRows=expenses.filter(x=>String(x.category||"").match(/staff|hr|salary|wage/i)||String(x.description||"").match(/staff|salary|wage/i));
      if(sl)sl.innerHTML=staffRows.length?`<table><thead><tr><th>Date</th><th>Staff ID</th><th>Staff Name</th><th>Description</th><th>Amount</th></tr></thead><tbody>${staffRows.map(x=>`<tr><td>${esc(dateDMY(x.date||x.savedAt))}</td><td>${esc(x.staffId||"")}</td><td>${esc(x.staffName||"")}</td><td>${esc(x.description||"")}</td><td>${money(x.amount)}</td></tr>`).join("")}</tbody></table>`:`<div class="empty">No staff / HR expenses recorded.</div>`;
      if(typeof window.enhanceAllSearchesForStrict==="function")window.enhanceAllSearchesForStrict();
    }catch(e){console.error("Final accounting load failed",e);msg("Sales & Accounting could not be refreshed: "+e.message,"error")}
  }
  window.loadAccounting=finalLoadAccounting;

  /* ---------------- Training registrations: exact card/grid style used by Order / Quote Requests. ---------------- */
  const TRAINING=[
    ["under_review","New Customer — Under Review"],["invoice_generated","Invoice Generated"],["part_paid","Part Paid"],["fully_paid","Fully Paid"],["in_class","In Class"],["completed","Completed"],["stopped","Stopped"],["cancelled","Cancelled"]
  ];
  function trainingStatusSelect(id,current){return `<div class="status-control"><select class="admin-status-select" data-training-status-id="${esc(id)}">${TRAINING.map(([k,l])=>`<option value="${k}" ${k===current?"selected":""}>${esc(l)}</option>`).join("")}</select><button type="button" class="secondary save-status-button" data-save-training-status="${esc(id)}">Save</button></div>`}
  function parseJ(v){try{return JSON.parse(v||"{}")}catch(_){return{}}}
  function trainingQuantity(row){const j=parseJ(row.journey||row.request_details||row.details||row.message);return Number(j.quantity||j.trainingQuantity||1)}
  async function finalLoadRegistrations(){
    const list=document.getElementById("registrationList");if(!list)return;
    try{
      const [tr,rs]=await Promise.all([rows("training_registrations"),settings()]);
      const statusMap=new Map(rs.filter(r=>String(r.setting_key||"").startsWith("training_status_")).map(r=>[String(r.setting_key).replace("training_status_","") ,String(r.setting_value||"under_review")]));
      const invs=rs.filter(r=>String(r.setting_key||"").startsWith("invoice_record_")).map(r=>{try{return JSON.parse(r.setting_value||"{}")}catch(_){return null}}).filter(Boolean);
      const pays=rs.filter(r=>String(r.setting_key||"").startsWith("invoice_payment_record_")).map(r=>{try{return JSON.parse(r.setting_value||"{}")}catch(_){return null}}).filter(Boolean);
      const receipts=rs.filter(r=>String(r.setting_key||"").startsWith("receipt_record_")).map(r=>{try{return JSON.parse(r.setting_value||"{}")}catch(_){return null}}).filter(Boolean);
      const records=tr.map(row=>{
        const inv=invs.filter(x=>String(x.sourceId||"")===String(row.id)||norm(x.customer)===norm(row.full_name)).sort((a,b)=>String(b.updatedAt||b.savedAt||"").localeCompare(String(a.updatedAt||a.savedAt||"")))[0];
        const paid=pays.filter(p=>String(p.invoiceNumber||"")===String(inv?.invoiceNumber||"")).reduce((a,p)=>a+Number(p.amount||0),0);
        const total=Number(inv?.total||0), balance=Math.max(0,total-paid);
        let status=statusMap.get(String(row.id)); if(!status){status=paid>0?(total>0&&paid>=total?"fully_paid":"part_paid"):inv?"invoice_generated":"under_review"}
        const receipt=receipts.find(r=>String(r.invoiceNumber||"")===String(inv?.invoiceNumber||""));
        return {row,inv,paid,total,balance,status,receipt};
      });
      const tabs=TRAINING.map(([k,l])=>`<button type="button" class="final-status-tab" data-registration-tab="${k}">${esc(l)} <span>${records.filter(r=>r.status===k).length}</span></button>`).join("");
      list.innerHTML=records.length?`<div class="submission-card-grid"><div class="final-tracking-tabs" style="grid-column:1/-1">${tabs}</div>${records.map(r=>`<article class="submission-card" data-registration-card="${esc(r.status)}"><div class="submission-card-top"><div><strong>${esc(r.row.full_name||"Customer")}</strong><span>${esc(r.row.course||"Training Registration")}</span></div><time>${esc(dateTimeGMT(r.row.created_at))}</time></div><div class="submission-card-gridline"><span><b>Phone / WhatsApp</b>${esc([r.row.phone,r.row.whatsapp].filter(Boolean).join(" • ")||"—")}</span><span><b>Location</b>${esc(r.row.location||"—")}</span><span><b>Quantity</b>${esc(trainingQuantity(r.row))}</span><span><b>Training Programme</b>${esc(r.row.course||"—")}</span><span class="wide"><b>Details</b>${esc(r.row.message||r.row.request_details||r.row.details||"—")}</span></div><div class="submission-status-strip"><span><b>Training Status</b>${trainingStatusSelect(r.row.id,r.status)}</span><span><b>Payment Status</b>${esc(r.paid>=r.total&&r.total>0?"Fully Paid":r.paid>0?"Part Paid":"Unpaid")}</span><span><b>Invoice</b>${esc(r.inv?.invoiceNumber||"—")}</span><span><b>Receipt</b>${esc(r.receipt?.receiptNumber||"—")}</span><span><b>Amount</b>${money(r.total)}</span><span><b>Paid</b>${money(r.paid)}</span><span><b>Balance</b>${money(r.balance)}</span></div><div class="submission-card-actions"><button type="button" class="secondary" data-view-registration-final="${esc(r.row.id)}">View Full Details</button><button type="button" class="primary" data-generate-registration-invoice="${esc(r.row.id)}">Generate Invoice</button><button type="button" class="danger" data-delete-registration-final="${esc(r.row.id)}">Delete</button></div></article>`).join("")}</div>`:`<div class="empty">No training registrations received.</div>`;
      const filter=k=>{list.querySelectorAll("[data-registration-card]").forEach(c=>c.style.display=c.dataset.registrationCard===k?"":"none");list.querySelectorAll("[data-registration-tab]").forEach(b=>b.classList.toggle("active",b.dataset.registrationTab===k))};
      list.querySelectorAll("[data-registration-tab]").forEach(b=>b.onclick=()=>filter(b.dataset.registrationTab));filter(TRAINING[0][0]);
      list.querySelectorAll("[data-save-training-status]").forEach(b=>b.onclick=async()=>{const sel=b.closest(".status-control")?.querySelector("select");if(!sel)return;try{await (window.setAdminRecordStatus?window.setAdminRecordStatus("training_status",b.dataset.saveTrainingStatus,sel.value):Promise.reject(new Error("Status service unavailable")));await audit("training_registration",b.dataset.saveTrainingStatus,"status_updated",{status:sel.value});msg("Training status updated.");await finalLoadRegistrations()}catch(e){msg("Training status could not be updated: "+e.message,"error")}});
      list.querySelectorAll("[data-view-registration-final]").forEach(b=>b.onclick=()=>{const r=records.find(x=>String(x.row.id)===String(b.dataset.viewRegistrationFinal));if(r&&window.aprilsShowSubmissionDetails)window.aprilsShowSubmissionDetails("Training Registration Details",r.row,r.row.message||r.row.request_details||r.row.details||r.row.journey||"")});
      list.querySelectorAll("[data-generate-registration-invoice]").forEach(b=>b.onclick=async()=>{const r=records.find(x=>String(x.row.id)===String(b.dataset.generateRegistrationInvoice));if(!r)return;try{let unitPrice=Number(r.inv?.lines?.[0]?.unitPrice||0);if(!unitPrice&&typeof window.getInvoicePriceMap==="function"&&typeof window.invoicePriceFor==="function"){const pm=await window.getInvoicePriceMap();unitPrice=Number(window.invoicePriceFor(pm,"Training - "+(r.row.course||""))||window.invoicePriceFor(pm,r.row.course)||0)}await window.openInvoiceGenerator(r,{manualLines:[{description:r.row.course||"Training / Programme / Class",details:r.row.message||r.row.request_details||r.row.details||"",quantity:trainingQuantity(r.row),unitPrice}],training:r.row.course||"Training / Programme / Class",existingRecord:r.inv||null});await (window.setAdminRecordStatus?window.setAdminRecordStatus("training_status",r.row.id,"invoice_generated"):Promise.resolve())}catch(e){msg("Training invoice could not be generated: "+e.message,"error")}});
      list.querySelectorAll("[data-delete-registration-final]").forEach(b=>b.onclick=async()=>{if(!confirm("Delete this training registration permanently?"))return;try{const d=db(),r=await d.from("training_registrations").delete().eq("id",b.dataset.deleteRegistrationFinal);if(r.error)throw r.error;await d.from("settings").delete().eq("setting_key","training_status_"+b.dataset.deleteRegistrationFinal);await audit("training_registration",b.dataset.deleteRegistrationFinal,"deleted",{});msg("Training registration deleted.");await finalLoadRegistrations()}catch(e){msg("Training registration could not be deleted: "+e.message,"error")}});
    }catch(e){list.innerHTML=`<div class="empty">Training registrations could not be loaded: ${esc(e.message)}</div>`}
  }
  window.loadRegistrations=finalLoadRegistrations;

  /* ---------------- Payment details: shared URL is always live/current. ---------------- */
  function paymentLiveUrl(){return new URL("../payment.html",window.location.href).href}
  document.addEventListener("click",async e=>{
    const b=e.target.closest("[data-copy-direct-link],[data-share-direct-link]");if(!b)return;
    const key=b.dataset.copyDirectLink||b.dataset.shareDirectLink;if(key!=="payment")return;
    e.preventDefault();e.stopImmediatePropagation();
    try{const a=await settingJson("invoice_payment_accounts");if(!Array.isArray(a)||!a.length){msg("Save the payment details first.","error");return}const url=paymentLiveUrl();
      if(b.dataset.copyDirectLink){try{await navigator.clipboard.writeText(url)}catch(_){window.prompt("Copy this payment details link:",url)}msg("Live payment details link copied.");}
      else if(navigator.share){try{await navigator.share({title:"Aprils Signature — Payment Details",text:"Aprils Signature — current payment details",url});}catch(x){if(x?.name!=="AbortError")window.open("https://wa.me/?text="+encodeURIComponent("Aprils Signature — Payment Details\n"+url),"_blank","noopener,noreferrer")}}
      else window.open("https://wa.me/?text="+encodeURIComponent("Aprils Signature — Payment Details\n"+url),"_blank","noopener,noreferrer");
    }catch(x){msg("The saved payment details could not be read.","error")}
  },true);

  /* ---------------- Delivery details sync in both directions. ---------------- */
  async function syncCollectionToRelated(){
    const select=document.getElementById("collectionInvoiceSelect"), inv=(window._aprilsCollectionInvoices||[]).find(x=>String(x.invoiceNumber)===String(select?.value||""));if(!inv)return;
    const date=document.getElementById("collectionDate")?.value||"",time=document.getElementById("collectionTime")?.value||"",location=document.getElementById("collectionLocation")?.value.trim()||"";
    if(!date||!time||!location)return;
    const d=db();if(!d)return;
    const updated={...inv,deliveryDate:date,deliveryTime:time,deliveryLocation:location,updatedAt:isoNow()};
    const saved=await d.from("settings").select("id").eq("setting_key","invoice_record_"+slug(inv.invoiceNumber)).limit(1);if(!saved.error&&saved.data?.length)await d.from("settings").update({setting_value:JSON.stringify(updated),updated_at:isoNow()}).eq("id",saved.data[0].id);
    if(inv.sourceId){const q=await d.from("quote_requests").select("journey").eq("id",inv.sourceId).maybeSingle();if(!q.error){const j=parseJ(q.data?.journey);j.deliveryDate=date;j.deliveryTime=time;j.deliveryLocation=location;await d.from("quote_requests").update({journey:JSON.stringify(j)}).eq("id",inv.sourceId);}}
    await audit("delivery_tracking",inv.invoiceNumber,"saved",{date,time,location});
  }
  function bindCollectionSync(){
    const form=document.getElementById("collectionForm");if(!form||form.dataset.strictSync)return;form.dataset.strictSync="1";
    ["collectionDate","collectionTime","collectionLocation"].forEach(id=>document.getElementById(id)?.addEventListener("change",syncCollectionToRelated));
    document.getElementById("collectionInvoiceSelect")?.addEventListener("change",()=>{
      const inv=(window._aprilsCollectionInvoices||[]).find(x=>String(x.invoiceNumber)===String(document.getElementById("collectionInvoiceSelect").value));
      if(!inv)return;document.getElementById("collectionDate").value=inv.deliveryDate||"";document.getElementById("collectionTime").value=inv.deliveryTime||"";document.getElementById("collectionLocation").value=inv.deliveryLocation||"";
    });
  }

  /* ---------------- Search: exactly one search control per table + typing + saved row picker. ---------------- */
  function enhanceAllSearches(){
    document.querySelectorAll(".section .table-wrap").forEach(wrap=>{
      const controls=[];let n=wrap.previousElementSibling;while(n&&(n.classList.contains("admin-table-search")||n.classList.contains("v2-table-arrows"))){if(n.classList.contains("admin-table-search"))controls.push(n);n=n.previousElementSibling}
      const box=controls[0]||document.createElement("div");controls.slice(1).forEach(x=>x.remove());if(!box.parentNode){box.className="admin-table-search";wrap.parentNode.insertBefore(box,wrap)}
      if(box.dataset.strictSearch)return;box.dataset.strictSearch="1";box.innerHTML=`<div class="v2-search-row"><input type="search" aria-label="Search this table" placeholder="Search by customer, invoice, item, product, name or number…"><select aria-label="Saved records"><option value="">Saved records — choose one</option></select><input type="date" aria-label="Date from"><input type="date" aria-label="Date to"></div>`;
      const search=box.querySelector('input[type="search"]'),select=box.querySelector("select"),from=box.querySelector('input[type="date"]'),to=box.querySelectorAll('input[type="date"]')[1];
      const apply=()=>{const term=norm(search.value),f=from.value?new Date(from.value+"T00:00:00Z"):null,t=to.value?new Date(to.value+"T23:59:59Z"):null;[...wrap.querySelectorAll("tbody tr")].forEach(r=>{let ok=!term||norm(r.innerText).includes(term);const ds=[...r.innerText.matchAll(/(\d{2}\/\d{2}\/\d{4})/g)].map(m=>{const p=m[1].split("/");return new Date(Date.UTC(+p[2],+p[1]-1,+p[0]))});if(f&&ds.length)ok=ok&&ds.some(x=>x>=f);if(t&&ds.length)ok=ok&&ds.some(x=>x<=t);r.style.display=ok?"":"none"})};
      const refresh=()=>{const opts=[...wrap.querySelectorAll("tbody tr")].map(r=>String(r.innerText||"").trim()).filter(Boolean).slice(0,500);select.innerHTML='<option value="">Saved records — choose one</option>'+opts.map((x,i)=>`<option value="${i}">${esc(x.slice(0,140))}</option>`).join("")};
      search.oninput=apply;from.onchange=apply;to.onchange=apply;select.onchange=()=>{const o=select.options[select.selectedIndex];if(o&&o.value!==""){search.value=o.textContent;apply()}};refresh();
    });
  }
  window.enhanceAllSearchesForStrict=enhanceAllSearches;

  /* ---------------- Date/time presentation everywhere in Admin. ---------------- */
  function strictDateTimeEverywhere(){
    document.documentElement.lang="en-GB";
    document.querySelectorAll('input[type="date"]').forEach(i=>{i.lang="en-GB";i.title="Date format: DD/MM/YYYY";const l=i.closest(".form-group")?.querySelector("label");if(l&&!/DD\/MM\/YYYY/i.test(l.textContent))l.insertAdjacentText("beforeend"," (DD/MM/YYYY)")});
    document.querySelectorAll('input[type="time"]').forEach(i=>{i.title="Time is recorded/displayed in GMT";const l=i.closest(".form-group")?.querySelector("label");if(l&&!/GMT/i.test(l.textContent))l.insertAdjacentText("beforeend"," (GMT)")});
    document.querySelectorAll(".section td,.section time").forEach(el=>{const t=String(el.textContent||"").trim();if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(t))el.textContent=dateTimeGMT(t)});
  }

  /* ---------------- Deletion audit + form save/update audit. ---------------- */
  function auditInteractions(){
    if(document.documentElement.dataset.strictAuditInteractions)return;document.documentElement.dataset.strictAuditInteractions="1";
    document.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;const text=String(b.textContent||"").trim();if(/delete|remove/i.test(text)){audit("admin_record",b.dataset.deleteSavedRecord||b.dataset.deleteQuote||b.dataset.deleteRegistrationFinal||b.dataset.deleteProduct||b.dataset.deleteTraining||b.dataset.deleteService||b.dataset.deleteContent||b.dataset.deleteFaq||b.dataset.deletePolicy||b.dataset.deleteLink||b.dataset.deleteSocial||b.dataset.deleteSetting||b.dataset.deleteUserAccess||b.dataset.deleteInventory||b.id||text,"delete_action",{button:text,at:isoNow()})}},true);
    document.addEventListener("submit",e=>{const f=e.target;if(!(f instanceof HTMLFormElement)||!f.id)return;audit("admin_form",f.id,"save_or_update",{at:isoNow()})},true);
  }

  function bindTypeAheadSelectors(){
    const add=(selectId,placeholder)=>{const sel=document.getElementById(selectId);if(!sel||sel.dataset.strictTypeahead)return;sel.dataset.strictTypeahead="1";const wrap=sel.parentElement;const input=document.createElement("input");input.type="search";input.placeholder=placeholder;input.className="strict-typeahead";input.setAttribute("aria-label",placeholder);input.style.cssText="width:100%;margin-bottom:7px;padding:9px;border:1px solid #aaa;border-radius:5px";wrap.insertBefore(input,sel);input.addEventListener("input",()=>{const q=norm(input.value);[...sel.options].forEach(o=>{o.hidden=!!q&&!norm(o.textContent).includes(q)&&o.value!==""});});};
    add("collectionInvoiceSelect","Type customer name or invoice number to find a saved invoice…");
    add("finalStatusRecord","Type customer name, phone or record to find it…");
  }
  function bindReceiptAttachmentObserver(){
    const add=()=>{const modal=document.getElementById("receiptGeneratorModal"),state=window._aprilsCurrentReceipt;if(!modal||!state||modal.dataset.strictReceiptAttachment)return;const editor=modal.querySelector(".receipt-generator-editor")||modal;modal.dataset.strictReceiptAttachment="1";state.attachments=Array.isArray(state.attachments)?state.attachments:[];const w=document.createElement("div");w.className="form-group final-invoice-attachments";w.innerHTML='<label>Attach Images to Receipt</label><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple><small>Optional customer/order reference images. Maximum 5 MB each.</small><div class="final-attachment-list"></div>';editor.prepend(w);const input=w.querySelector("input"),list=w.querySelector(".final-attachment-list");const render=()=>list.innerHTML=state.attachments.map(a=>`<span class="final-attachment-chip">${esc(a.name||"Image")}</span>`).join("");const saveBtn=modal.querySelector("#receiptSavePayment");if(saveBtn&&!saveBtn.dataset.strictAttachmentSave){saveBtn.dataset.strictAttachmentSave="1";saveBtn.addEventListener("click",()=>setTimeout(async()=>{try{const number=document.getElementById("generatedReceiptNumber")?.value;if(!number||!state.attachments.length)return;const d=db(),r=await d.from("settings").select("id,setting_value").eq("setting_key","receipt_record_"+slug(number)).maybeSingle();if(!r.error&&r.data){let rec={};try{rec=JSON.parse(r.data.setting_value||"{}")}catch(_){}rec.attachments=state.attachments;await d.from("settings").update({setting_value:JSON.stringify(rec),updated_at:isoNow()}).eq("id",r.data.id);await audit("receipt",number,"attachments_saved",{count:state.attachments.length})}}catch(_){}} ,700),false)}input.onchange=async()=>{const d=db();if(!d)return;for(const file of Array.from(input.files||[])){if(file.size>5*1024*1024){msg("Each receipt image must be 5 MB or smaller.","error");continue}try{const path=`invoice-attachments/${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;const up=await d.storage.from("quote-uploads").upload(path,file,{upsert:false,contentType:file.type});if(up.error)throw up.error;const pub=d.storage.from("quote-uploads").getPublicUrl(path);state.attachments.push({name:file.name,path,url:pub?.data?.publicUrl||""})}catch(e){msg("Receipt image upload failed: "+e.message,"error")}}input.value="";render()};render()};
    new MutationObserver(add).observe(document.body,{childList:true,subtree:true});add();
  }

  function attach(){
    strictDateTimeEverywhere();auditInteractions();enhanceAllSearches();bindCollectionSync();bindTypeAheadSelectors();bindReceiptAttachmentObserver();
    if(document.getElementById("accounting")?.classList.contains("active"))finalLoadAccounting();
    const active=document.querySelector(".sidebar button.active")?.dataset.section;if(active==="registrations")finalLoadRegistrations();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",attach);else attach();
})();

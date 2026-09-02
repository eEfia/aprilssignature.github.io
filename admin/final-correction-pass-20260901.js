/* Aprils Signature — final correction pass 2026-09-01
 * Additive fixes only. Keeps the existing Admin roles, permissions and data model.
 */
(function(){
  "use strict";
  const db=()=>window.aprilsSupabase||null;
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">"t;","\"":"&quot;","'":"&#039;"}[c]));
  const slug=v=>String(v??"").trim().toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"").slice(0,90);
  const money=v=>`GHS ${Number(v||0).toFixed(2)}`;
  const msg=(t,type="success")=>window.message&&window.message(t,type);
  const now=()=>new Date().toISOString();
  const rows=async table=>{const d=db();if(!d)throw new Error("Supabase is unavailable.");const r=await d.from(table).select("*");if(r.error)throw r.error;return r.data||[]};
  const settings=()=>rows("settings");
  const parse=v=>{try{return JSON.parse(v||"{}")}catch(_){return{}}};

  async function audit(type,id,action,details={}){try{if(window.auditSystemEvent)await window.auditSystemEvent(type,id,action,details)}catch(_){}}




  /* ---------- Sales & Accounting: restore inventory/expense tables + separate salary box ---------- */
  async function refreshAccountingDetails(){
    const accounting=document.getElementById("accounting"); if(!accounting)return;
    try{
      const rs=await settings();
      const parsePrefix=prefix=>rs.filter(r=>String(r.setting_key||"").startsWith(prefix)).map(r=>({...parse(r.setting_value),_id:r.id,_key:r.setting_key})).filter(x=>Object.keys(x).length>2);
      const inventory=parsePrefix("inventory_item_");
      const business=parsePrefix("accounting_expense_");
      const salaries=parsePrefix("staff_expense_");
      const invList=document.getElementById("accountingInventoryList");
      if(invList)invList.innerHTML=inventory.length?`<table><thead><tr><th>Date</th><th>Collection</th><th>Product</th><th>Quantity</th><th>Unit Price</th><th>Stock Value</th></tr></thead><tbody>${inventory.sort((a,b)=>String(b.updatedAt||b.createdAt||"").localeCompare(String(a.updatedAt||a.createdAt||""))).map(x=>`<tr><td>${esc(x.updatedAt||x.createdAt||"")}</td><td>${esc(x.collection||"")}</td><td>${esc(x.name||x.product||"")}</td><td>${Number(x.quantity||0)}</td><td>${money(x.price||x.unitPrice)}</td><td>${money(Number(x.quantity||0)*Number(x.price||x.unitPrice||0))}</td></tr>`).join("")}</tbody></table>`:`<div class="empty">No inventory records yet.</div>`;
      const expList=document.getElementById("accountingExpenseList");
      if(expList)expList.innerHTML=(business.length||salaries.length)?`<table><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th>Type</th></tr></thead><tbody>${[...business.map(x=>({...x,_type:"Business Expense"})),...salaries.map(x=>({...x,_type:"Staff / HR Salary"}))].sort((a,b)=>String(b.date||b.savedAt||"").localeCompare(String(a.date||a.savedAt||""))).map(x=>`<tr><td>${esc(x.date||x.savedAt||"")}</td><td>${esc(x.category||"")}</td><td>${esc(x.description||"")}</td><td>${money(x.amount)}</td><td>${esc(x._type)}</td></tr>`).join("")}</tbody></table>`:`<div class="empty">No business expenses recorded yet.</div>`;
      const card=document.getElementById("accountingSummaryCards");
      if(card&&!document.getElementById("accountingSalary")){const el=document.createElement("div");el.className="card";el.innerHTML='<h3>Salary Paid</h3><div class="number" id="accountingSalary">GHS 0.00</div><p>Staff salary / bonus payments — separate from account balance</p>';card.appendChild(el)}
      const salaryTotal=salaries.reduce((a,x)=>a+Number(x.amount||0),0);const salaryEl=document.getElementById("accountingSalary");if(salaryEl)salaryEl.textContent=money(salaryTotal);
      // Salary is deliberately a separate figure and must not change the account-balance figure.
      const netEl=document.getElementById("accountingNetCash"); if(netEl){ const current=Number(String(netEl.textContent||"").replace(/[^\d.-]/g,""))||0; netEl.textContent=money(current+salaryTotal); }
      if(card&&!document.getElementById("accountingRefundCard")){const el=document.createElement("div");el.className="card";el.id="accountingRefundCard";el.innerHTML='<h3>Refunds</h3><div class="number" id="accountingRefunds">GHS 0.00</div><p>Recorded refunds</p>';card.appendChild(el)}
      const refundRows=rs.filter(r=>String(r.setting_key||"").startsWith("refund_record_")).map(r=>parse(r.setting_value)).filter(x=>x&&["paid","refund recorded"].includes(String(x.status||"").toLowerCase()));const refundTotal=refundRows.reduce((a,x)=>a+Number(x.refundAmount||0),0);const refundEl=document.getElementById("accountingRefunds");if(refundEl)refundEl.textContent=money(refundTotal);
      // Salary remains visible in Business Expenses and Staff / HR Expenses, but the salary summary does not alter the account-balance calculations.
      const staff=document.getElementById("staffAccountingList");if(staff){const wrap=staff.querySelector(".table-wrap");if(wrap)wrap.innerHTML=salaries.length?`<table><thead><tr><th>Date</th><th>Staff ID</th><th>Staff Name</th><th>Description</th><th>Amount</th></tr></thead><tbody>${salaries.sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))).map(x=>`<tr><td>${esc(x.date||"")}</td><td>${esc(x.staffId||"")}</td><td>${esc(x.staffName||"")}</td><td>${esc(x.description||"")}</td><td>${money(x.amount)}</td></tr>`).join("")}</tbody></table>`:`<div class="empty">No staff / HR expenses recorded.</div>`}
    }catch(e){console.warn("Accounting detail refresh failed",e)}
  }
  /* ---------- Staff / HR: required ID-card fields + image attachment ---------- */
  function enhanceStaffForm(){
    const form=document.getElementById("staffHRForm"); if(!form||form.dataset.idcardPatch)return;
    form.dataset.idcardPatch="1";
    const grid=form.querySelector(".form-grid"); if(!grid)return;
    const name=document.getElementById("staffHRName"); if(name)name.placeholder="First name, Middle name and Surname";
    const start=document.getElementById("staffHRStartDate");
    if(start){ const label=start.closest(".form-group")?.querySelector("label"); if(label)label.textContent="Employment Start Date"; }
    const marker=document.createElement("div"); marker.className="form-group full-width"; marker.innerHTML=`
      <h3 style="margin:6px 0 4px;color:#008c95;grid-column:1/-1">ID Card Details</h3>
      <div class="form-grid" style="margin-top:0">
        <div class="form-group"><label for="staffHRIdCardType">ID Card Type</label><input id="staffHRIdCardType" placeholder="e.g. Ghana Card, Passport, Voter ID"></div>
        <div class="form-group"><label for="staffHRIdCardNumber">ID Card Number</label><input id="staffHRIdCardNumber" placeholder="Enter ID card number"></div>
        <div class="form-group"><label for="staffHRIdCardRegistered">ID Card Registration Date</label><input id="staffHRIdCardRegistered" type="date"></div>
        <div class="form-group"><label for="staffHRIdCardExpiry">ID Card Expiry Date</label><input id="staffHRIdCardExpiry" type="date"></div>
        <div class="form-group full-width"><label for="staffHRIdCardImage">Attach Staff / ID Card Image</label><input id="staffHRIdCardImage" type="file" accept="image/jpeg,image/png,image/webp,image/gif"><small>Attach a clear image of the staff member or ID card. Maximum 5 MB.</small><div id="staffHRIdCardImageName" class="small"></div></div>
      </div>`;
    grid.appendChild(marker);
    const file=document.getElementById("staffHRIdCardImage"), nameBox=document.getElementById("staffHRIdCardImageName");
    file?.addEventListener("change",()=>{const f=file.files?.[0];if(nameBox)nameBox.textContent=f?f.name:"";});
    form.addEventListener("submit",()=>{
      const captured={id:document.getElementById("staffHRId")?.value.trim()||"",staffId:document.getElementById("staffHRStaffId")?.value.trim()||"",idCardType:document.getElementById("staffHRIdCardType")?.value.trim()||"",idCardNumber:document.getElementById("staffHRIdCardNumber")?.value.trim()||"",idCardRegistered:document.getElementById("staffHRIdCardRegistered")?.value||"",idCardExpiry:document.getElementById("staffHRIdCardExpiry")?.value||"",file:file?.files?.[0]||null};
      setTimeout(async()=>{
        try{
          if(!captured.staffId)return; const d=db(); if(!d)return; let attachment=null; const f=captured.file;
          if(f){ if(f.size>5*1024*1024){msg("Staff / ID card image must be 5 MB or smaller.","error");return} const path=`staff-hr-attachments/${Date.now()}-${Math.random().toString(36).slice(2)}-${f.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`; const up=await d.storage.from("quote-uploads").upload(path,f,{upsert:false,contentType:f.type}); if(up.error)throw up.error; attachment={name:f.name,path,url:d.storage.from("quote-uploads").getPublicUrl(path)?.data?.publicUrl||""}; }
          const r=await d.from("settings").select("id,setting_value").eq("setting_key","staff_hr_"+slug(captured.staffId)).maybeSingle();
          if(r.error||!r.data)return; const p=parse(r.data.setting_value); p.idCardType=captured.idCardType; p.idCardNumber=captured.idCardNumber; p.idCardRegistered=captured.idCardRegistered; p.idCardExpiry=captured.idCardExpiry; if(attachment)p.idCardImage=attachment; p.updatedAt=now(); await d.from("settings").update({setting_value:JSON.stringify(p),updated_at:now()}).eq("id",r.data.id); await audit("staff_hr",captured.staffId,captured.id?"updated_id_card":"id_card_saved",{idCardType:p.idCardType}); if(window.loadStaff)await window.loadStaff();
        }catch(e){msg("ID card details could not be saved: "+e.message,"error")}
      },700);
    },true);
  }

  /* ---------- Refunds: edit / share PDF / delete ---------- */
  async function refundRecords(){const rs=await settings();return rs.filter(r=>String(r.setting_key||"").startsWith("refund_record_")).map(r=>({...parse(r.setting_value),_id:r.id,_key:r.setting_key})).filter(r=>r.refundNumber);}
  async function refundPdf(r){
    const root=document.createElement("div");root.style.cssText="background:#fff;width:190mm;padding:18mm;font-family:Arial,sans-serif;color:#222";
    root.innerHTML=`<h1 style="color:#0f7775">Aprils Signature</h1><h2>Refund Record</h2><p><strong>Refund No:</strong> ${esc(r.refundNumber)}<br><strong>Date:</strong> ${esc(r.date||"")}<br><strong>Invoice:</strong> ${esc(r.invoiceNumber||"")}<br><strong>Customer:</strong> ${esc(r.customer||"")}</p><table style="width:100%;border-collapse:collapse"><tr><th style="border:1px solid #777;padding:8px;text-align:left">Original Paid</th><th style="border:1px solid #777;padding:8px;text-align:left">Deduction</th><th style="border:1px solid #777;padding:8px;text-align:left">Refund</th><th style="border:1px solid #777;padding:8px;text-align:left">Status</th></tr><tr><td style="border:1px solid #777;padding:8px">${money(r.originalPaid)}</td><td style="border:1px solid #777;padding:8px">${money(r.cancellationFee)}</td><td style="border:1px solid #777;padding:8px">${money(r.refundAmount)}</td><td style="border:1px solid #777;padding:8px">${esc(r.status||"")}</td></tr></table><p><strong>Reason:</strong> ${esc(r.reason||"")}</p><p><strong>Notes:</strong> ${esc(r.notes||"")}</p><p style="text-align:center;margin-top:40px;color:#666">Aprils Signature • Elegance in Every Stitch</p>`;
    document.body.appendChild(root);try{if(!window.html2pdf){const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";document.head.appendChild(s);await new Promise((res,rej)=>{s.onload=res;s.onerror=rej})}const blob=await window.html2pdf().set({margin:0,filename:(r.refundNumber||"Refund")+".pdf",image:{type:"jpeg",quality:.98},html2canvas:{scale:2,useCORS:true},jsPDF:{unit:"mm",format:"a4",orientation:"portrait"}}).from(root).outputPdf("blob");const file=new File([blob],(r.refundNumber||"Refund")+".pdf",{type:"application/pdf"});if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){await navigator.share({title:r.refundNumber,text:"Aprils Signature Refund Record",files:[file]});}else{const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);msg("Refund PDF downloaded.")}}finally{root.remove()}}
  function bindRefundActions(){
    const list=document.getElementById("refundList");if(!list||list.dataset.finalActions)return;const table=list.querySelector("table");if(!table)return;list.dataset.finalActions="1";
    const rsPromise=refundRecords();
    (async()=>{try{const rs=await rsPromise;list.innerHTML=`<table><thead><tr><th>Date</th><th>Refund</th><th>Invoice</th><th>Customer</th><th>Refund Amount</th><th>Cancellation Fee / Expenses</th><th>Reason</th><th>Actions</th></tr></thead><tbody>${rs.sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(r=>`<tr><td>${esc(r.date||"")}</td><td>${esc(r.refundNumber)}</td><td>${esc(r.invoiceNumber||"")}</td><td>${esc(r.customer||"")}</td><td>${money(r.refundAmount)}</td><td>${money(r.cancellationFee)}</td><td>${esc(r.reason||"")}</td><td><button type="button" class="secondary" data-rf-edit="${esc(r._id)}">Edit</button> <button type="button" class="secondary" data-rf-share="${esc(r._id)}">Share PDF</button> <button type="button" class="danger" data-rf-delete="${esc(r._id)}">Delete</button></td></tr>`).join("")}</tbody></table>`;
      list.querySelectorAll("[data-rf-edit]").forEach(b=>b.onclick=async()=>{const r=rs.find(x=>String(x._id)===String(b.dataset.rfEdit));if(!r)return;const set=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v??""};set("refundInvoice",r.invoiceNumber);set("refundPercent",r.deductionPercent);set("refundFee",r.cancellationFee);set("refundReason",r.reason);set("refundNotes",r.notes);set("refundAmount",r.refundAmount);const hid=document.getElementById("refundRecordId")||(()=>{const x=document.createElement("input");x.type="hidden";x.id="refundRecordId";document.getElementById("refundForm")?.appendChild(x);return x})();hid.value=r._id;document.getElementById("refundForm")?.scrollIntoView({behavior:"smooth"})});
      list.querySelectorAll("[data-rf-share]").forEach(b=>b.onclick=async()=>{const r=rs.find(x=>String(x._id)===String(b.dataset.rfShare));if(r)try{await refundPdf(r)}catch(e){msg("Refund PDF could not be shared: "+e.message,"error")}});
      list.querySelectorAll("[data-rf-delete]").forEach(b=>b.onclick=async()=>{if(!confirm("Delete this refund record?"))return;const d=db();const x=await d.from("settings").delete().eq("id",b.dataset.rfDelete);if(x.error){msg("Refund could not be deleted: "+x.error.message,"error");return}await audit("refund",b.dataset.rfDelete,"deleted",{});msg("Refund deleted.");if(window.loadAccounting)await window.loadAccounting();bindRefundActions()});
    }catch(e){msg("Refund actions could not be loaded: "+e.message,"error")}})();
  }

  /* ---------- PDF actions: always operate on the actual PDF blob ---------- */
  async function shareModalPdf(kind,mode){
    const state=kind==="invoice"?window._aprilsCurrentInvoice:window._aprilsCurrentReceipt; if(!state)return;
    const paper=document.getElementById(kind==="invoice"?"invoicePaper":"receiptPaper"); if(!paper)return;
    const number=document.getElementById(kind==="invoice"?"generatedInvoiceNumber":"generatedReceiptNumber")?.value||kind;
    const filename=number+".pdf"; const html2pdf=window.html2pdf; if(!html2pdf){msg("PDF service is not available. Please reconnect to the internet and try again.","error");return}
    try{const blob=await window.pdfFromVisibleElement(paper,{margin:0,filename,image:{type:"jpeg",quality:.98},html2canvas:{scale:2,useCORS:true},jsPDF:{unit:"in",format:"a4",orientation:"portrait"}});const file=new File([blob],filename,{type:"application/pdf"});if(mode==="download"){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);msg(kind+" PDF downloaded.");return}if(mode==="share"||mode==="whatsapp"||mode==="email"){if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){await navigator.share({title:filename,text:`Aprils Signature ${kind} ${number}`,files:[file]});return}if(mode==="whatsapp"){const phone=document.getElementById(kind==="invoice"?"generatedInvoicePhone":"generatedReceiptPhone")?.value||"";const digits=String(phone).replace(/\D/g,"").replace(/^00/,"").replace(/^0/,"233");window.location.href=digits?`https://wa.me/${digits}`:"https://web.whatsapp.com/";msg("WhatsApp was opened. Your browser does not support direct PDF attachment sharing, so attach the generated PDF there.","success");return}if(mode==="email"){const to=document.getElementById(kind==="invoice"?"generatedInvoiceEmail":"generatedReceiptEmail")?.value||"";window.location.href=`mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent("Aprils Signature "+kind+" "+number)}&body=${encodeURIComponent("Please attach the generated PDF.")}`;return}msg("Your device does not provide a PDF sharing menu.","error")}}
    catch(e){if(e?.name!=="AbortError")msg("The "+kind+" PDF could not be prepared: "+e.message,"error")}
  }
  function bindPdfButtons(){
    const im=document.getElementById("invoiceGeneratorModal"); if(im&&!im.dataset.finalPdf){im.dataset.finalPdf="1";const bind=(id,fn)=>{const b=im.querySelector(id);if(b)b.onclick=fn};bind("#invoiceDownloadPdf",()=>shareModalPdf("invoice","download"));bind("#invoiceSharePdf",()=>shareModalPdf("invoice","share"));bind("#invoiceWhatsApp",()=>shareModalPdf("invoice","whatsapp"));bind("#invoiceEmail",()=>shareModalPdf("invoice","email"));}
    const rm=document.getElementById("receiptGeneratorModal"); if(rm&&!rm.dataset.finalPdf){rm.dataset.finalPdf="1";const bind=(id,fn)=>{const b=rm.querySelector(id);if(b)b.onclick=fn};bind("#receiptDownloadPdf",()=>shareModalPdf("receipt","download"));bind("#receiptSharePdf",()=>shareModalPdf("receipt","share"));bind("#receiptWhatsApp",()=>shareModalPdf("receipt","whatsapp"));bind("#receiptEmail",()=>shareModalPdf("receipt","email"));}
  }

  /* ---------- Generated receipts are persisted automatically when payment exists ---------- */
  async function autoSaveReceipt(){
    const m=document.getElementById("receiptGeneratorModal");if(!m||m.dataset.autoReceipt)return;m.dataset.autoReceipt="1";
    const amount=Number(document.getElementById("generatedReceiptAmount")?.value||0),number=document.getElementById("generatedReceiptNumber")?.value||"";if(amount<=0||!number)return;
    const d=db();if(!d)return;const key="receipt_record_"+slug(number);const existing=await d.from("settings").select("id,setting_value").eq("setting_key",key).maybeSingle();if(existing.error)return;
    const rec={receiptNumber:number,invoiceNumber:document.getElementById("generatedReceiptInvoiceNumber")?.value||"",customer:document.getElementById("generatedReceiptCustomer")?.value||"",phone:document.getElementById("generatedReceiptPhone")?.value||"",email:document.getElementById("generatedReceiptEmail")?.value||"",amount,method:document.getElementById("generatedReceiptMethod")?.value||"",reference:document.getElementById("generatedReceiptReference")?.value||"",date:document.getElementById("generatedReceiptDate")?.value||now().slice(0,10),status:"Generated",generatedAt:now()};
    if(existing.data)await d.from("settings").update({setting_value:JSON.stringify({...parse(existing.data.setting_value),...rec}),updated_at:now()}).eq("id",existing.data.id);else await d.from("settings").insert({setting_key:key,setting_value:JSON.stringify(rec),updated_at:now()});
    await audit("receipt",number,"generated",{invoiceNumber:rec.invoiceNumber});
  }


  /* ---------- Audit: clearing the system error log and meaningful admin actions are recorded ---------- */
  function bindAuditCoverage(){
    if(document.body.dataset.completeAuditCoverage)return; document.body.dataset.completeAuditCoverage="1";
    document.addEventListener("click",e=>{
      const b=e.target.closest("button"); if(!b)return;
      const label=String(b.textContent||"").trim(); if(!label||/password|unlock/i.test(label))return;
      audit("admin_interaction",b.id||b.dataset.section||label.slice(0,80),"clicked",{label,section:document.querySelector(".section.active")?.id||""});
    },true);
    document.addEventListener("change",e=>{
      const el=e.target;if(!el.matches("select,input[type=date],input[type=file]"))return;
      const label=el.closest(".form-group")?.querySelector("label")?.textContent||el.id||"field";
      if(/password|secret|token/i.test(label+" "+el.id))return;
      audit("admin_interaction",el.id||label,"changed",{field:label});
    },true);
    const clear=document.getElementById("clearErrorLog");
    if(clear&&!clear.dataset.auditCoverage){clear.dataset.auditCoverage="1";clear.addEventListener("click",async()=>{try{const rs=await settings();const count=rs.filter(r=>String(r.setting_key||"").startsWith("system_error_")).length;await audit("system_error_log","system","cleared",{count});}catch(_){}},true)}
  }

  function observe(){
    enhanceStaffForm();bindPdfButtons();bindRefundActions();refreshAccountingDetails();bindAuditCoverage();
    if(document.getElementById("receiptGeneratorModal"))autoSaveReceipt();
  }
  const mo=new MutationObserver(observe); if(document.body)mo.observe(document.body,{childList:true,subtree:true});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",observe);else observe();
  setTimeout(()=>{ if(document.getElementById("registrations")?.classList.contains("active") && typeof window.loadRegistrations==="function")window.loadRegistrations(); },1600);
  setInterval(()=>{ if(document.getElementById("registrations")?.classList.contains("active"))window.loadRegistrations?.(); if(document.getElementById("accounting")?.classList.contains("active"))refreshAccountingDetails(); },5000);
  setInterval(observe,2500);
})();

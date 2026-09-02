/* =========================================================
   APRILS SIGNATURE — ULTIMATE CORRECTIONS 01-09-2026
   Final interaction/data reliability layer.
   This file works with the existing Supabase structure and does
   not create a second invoice, receipt, product or training store.
========================================================= */
(function(){
"use strict";

const db=()=>window.aprilsSupabase||window.AprilsSupabase||null;
const esc=window.escapeHTML||((v)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c])));
const norm=v=>String(v??"").trim().toLowerCase().replace(/\s+/g,"
const slug=v=>String(v??"").toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"").slice(0,90);
const money=v=>`GHS ${Number(v||0).toFixed(2)}`;
const now=()=>new Date().toISOString();
const msg=(t,type="success")=>window.message?window.message(t,type):console[type==="error"?"error":"log"](t);

async function settingsRows(){
  const d=db(); if(!d)return[];
  const r=await d.from("settings").select("id,setting_key,setting_value,updated_at");
  if(r.error)throw r.error; return r.data||[];
}
function parseSettingRows(rows,prefix){
  return (rows||[]).filter(r=>String(r.setting_key||"").startsWith(prefix)).map(r=>{
    try{return {...JSON.parse(r.setting_value||"{}"),_id:r.id,_key:r.setting_key}}
    catch(_){return null}
  }).filter(Boolean);
}
async function saveSetting(key,value){
  if(typeof window.safeSettingUpsert==="function")return window.safeSettingUpsert(key,typeof value==="string"?value:JSON.stringify(value));
  const d=db();if(!d)throw new Error("Supabase is unavailable.");
  const existing=await d.from("settings").select("id").eq("setting_key",key).maybeSingle();
  if(existing.error)throw existing.error;
  const payload={setting_key:key,setting_value:typeof value==="string"?value:JSON.stringify(value),updated_at:now()};
  if(existing.data)return d.from("settings").update({setting_value:payload.setting_value,updated_at:payload.updated_at}).eq("id",existing.data.id);
  return d.from("settings").insert(payload);
}
async function audit(type,id,action,details={}){
  try{
    if(typeof window.auditSystemEvent==="function")await window.auditSystemEvent(type,id,action,details);
  }catch(_){}
}

function dateTime(v){
  if(!v)return "—";
  const d=new Date(v);if(Number.isNaN(d.getTime()))return String(v);
  return new Intl.DateTimeFormat("en-GB",{timeZone:"UTC",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false}).format(d)+" GMT";
}
function qLabel(n){const x=Number(n)||0;return `Quantity ${x}`;}

function addCss(){
  if(document.getElementById("aprils-ultimate-css"))return;
  const s=document.createElement("style");s.id="aprils-ultimate-css";
  s.textContent=`
    .ultimate-busy{opacity:.7!important;pointer-events:none!important}
    .ultimate-saved-badge{font-size:10px;font-weight:700;margin-left:6px}
    .final-tracking-tabs{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:12px}
    .final-tracking-tabs .final-status-tab{padding:7px 10px;border:1px solid #aaa;background:#fff;border-radius:5px;cursor:pointer}
    .final-tracking-tabs .final-status-tab.active{font-weight:700;box-shadow:0 0 0 2px rgba(201,162,39,.35)}
    .ultimate-id-image{max-width:100px;max-height:100px;object-fit:contain;border:1px solid #aaa;border-radius:5px;margin-top:5px}
  `;
  document.head.appendChild(s);
}

/* ---------- Training registrations: same compact square-card structure as quote requests ---------- */
async function loadTrainingRegistrationsUltimate(){
  const list=document.getElementById("registrationList");if(!list)return;
  const d=db();if(!d){list.innerHTML='<div class="empty">Supabase is unavailable.</div>';return}
  try{
    const [tr,rs]=await Promise.all([d.from("training_registrations").select("*"),settingsRows()]);
    if(tr.error)throw tr.error;
    const rows=(tr.data||[]).slice().sort((a,b)=>String(b.created_at||b.updated_at||"").localeCompare(String(a.created_at||a.updated_at||"")));
    const statusMap=new Map(parseSettingRows(rs,"training_status_").map(x=>[String(x._key).replace("training_status_",""),String(x.value||x.status||"under_review")]));
    const invs=parseSettingRows(rs,"invoice_record_");
    const pays=parseSettingRows(rs,"invoice_payment_record_");
    const receipts=parseSettingRows(rs,"receipt_record_");
    const payMap=new Map();pays.forEach(p=>{const k=String(p.invoiceNumber||"");if(!payMap.has(k))payMap.set(k,[]);payMap.get(k).push(p)});
    const records=rows.map(row=>{
      const inv=invs.filter(x=>String(x.sourceId||"")===String(row.id)||norm(x.customer)===norm(row.full_name)).sort((a,b)=>String(b.updatedAt||b.savedAt||"").localeCompare(String(a.updatedAt||a.savedAt||"")))[0];
      const invoice=String(inv?.invoiceNumber||"");
      const paid=(payMap.get(invoice)||[]).reduce((a,p)=>a+Number(p.amount||0),0);
      const total=Number(inv?.total||0),balance=Math.max(0,total-paid);
      let status=statusMap.get(String(row.id));
      if(!status)status=paid>0?(total>0&&paid>=total?"fully_paid":"part_paid"):inv?"invoice_generated":"under_review";
      const receipt=receipts.find(x=>String(x.invoiceNumber||"")===invoice);
      let journey={};try{journey=JSON.parse(row.journey||"{}")}catch(_){ }
      const qty=journey.quantity||journey.trainingQuantity||row.quantity||1;
      const paymentStatus=paid>=total&&total>0?"fully_paid":paid>0?"part_paid":"unpaid";
      return {row,inv,receipt,paid,total,balance,status,qty,journey,paymentStatus};
    });
    const statuses=[
      ["under_review","New Customer — Under Review"],["invoice_generated","Invoice Generated"],
      ["part_paid","Part Paid"],["fully_paid","Fully Paid"],["in_class","In Class"],
      ["stopped","Stopped"],["completed","Completed"],["cancelled","Cancelled"]
    ];
    const tabs=statuses.map(([k,l])=>`<button type="button" class="final-status-tab" data-ut-training-tab="${esc(k)}">${esc(l)} <span>${records.filter(r=>r.status===k).length}</span></button>`).join("");
    list.innerHTML=`<div class="final-tracking-tabs">${tabs}</div><div class="final-training-panel"></div>`;
    const panel=list.querySelector(".final-training-panel");
    function render(key){
      const chosen=records.filter(r=>r.status===key);
      panel.innerHTML=chosen.length?`<div class="final-spreadsheet"><table><thead><tr><th>Date</th><th>Trainee</th><th>Course / Programme</th><th>Phone</th><th>Item / Description</th><th>Details</th><th>Quantity</th><th>Invoice</th><th>Total</th><th>Paid</th><th>Balance</th><th>Payment Status</th><th>Training Status</th><th>Action</th></tr></thead><tbody>${chosen.map(r=>{
        const details=r.row.message||r.row.request_details||r.row.details||"—";
        const item=r.row.course||"Training / Programme / Class";
        return `<tr><td>${esc(dateTime(r.row.created_at||r.row.updated_at))}</td><td>${esc(r.row.full_name||"")}</td><td>${esc(r.row.course||"")}</td><td>${esc(r.row.phone||r.row.whatsapp||"")}</td><td>${esc(item)}</td><td>${esc(details)}</td><td>${esc(qLabel(r.qty))}</td><td>${esc(r.inv?.invoiceNumber||"—")}</td><td>${money(r.total)}</td><td>${money(r.paid)}</td><td>${money(r.balance)}</td><td>${esc(r.paymentStatus==="fully_paid"?"Fully Paid":r.paymentStatus==="part_paid"?"Part Paid":"Unpaid")}</td><td><div class="status-control"><select class="admin-status-select" data-ut-training-status="${esc(r.row.id)}">${statuses.map(([k,l])=>`<option value="${k}" ${k===r.status?"selected":""}>${esc(l)}</option>`).join("")}</select><button type="button" class="secondary save-status-button" data-ut-training-save="${esc(r.row.id)}">Save</button></div></td><td><button type="button" class="secondary" data-ut-training-view="${esc(r.row.id)}">View Full Details</button><button type="button" class="secondary" data-ut-training-share="${esc(r.row.id)}">Share</button><button type="button" class="primary" data-ut-training-invoice="${esc(r.row.id)}">Generate Invoice</button><button type="button" class="danger" data-ut-training-delete="${esc(r.row.id)}">Delete</button></td></tr>`;
      }).join("")}</tbody></table></div>`:`<div class="empty">No training registrations are currently in this status.</div>`;
      panel.querySelectorAll("[data-ut-training-save]").forEach(b=>b.onclick=async()=>{
        const sel=b.closest(".status-control")?.querySelector("select");if(!sel)return;
        try{b.classList.add("ultimate-busy");if(typeof window.setAdminRecordStatus==="function")await window.setAdminRecordStatus("training_status",b.dataset.utTrainingSave,sel.value);else await saveSetting("training_status_"+b.dataset.utTrainingSave,sel.value);await audit("training_registration",b.dataset.utTrainingSave,"status_updated",{status:sel.value});msg("Training status updated.");await loadTrainingRegistrationsUltimate();}catch(e){msg("Training status could not be updated: "+e.message,"error")}finally{b.classList.remove("ultimate-busy")}
      });
      panel.querySelectorAll("[data-ut-training-view]").forEach(b=>b.onclick=()=>{
        const r=records.find(x=>String(x.row.id)===String(b.dataset.utTrainingView));if(!r)return;
        const details=`Date: ${dateTime(r.row.created_at||r.row.updated_at)}\nTrainee: ${r.row.full_name||""}\nPhone: ${r.row.phone||r.row.whatsapp||""}\nEmail: ${r.row.email||""}\nLocation: ${r.row.location||""}\nCourse / Programme: ${r.row.course||""}\nQuantity: ${Number(r.qty)||1}\nDetails: ${r.row.message||r.row.request_details||r.row.details||""}\nInvoice: ${r.inv?.invoiceNumber||"—"}\nAmount: ${money(r.total)}\nPaid: ${money(r.paid)}\nBalance: ${money(r.balance)}\nPayment Status: ${r.paymentStatus==="fully_paid"?"Fully Paid":r.paymentStatus==="part_paid"?"Part Paid":"Unpaid"}\nTraining Status: ${TRAINING_STATUS_LABEL(r.status)}`;
        if(window.aprilsShowSubmissionDetails)window.aprilsShowSubmissionDetails("Training Registration Details",r.row,details,[]);else if(window.showSubmissionDetails)window.showSubmissionDetails("Training Registration — Full Details",r.row,details,[]);else alert(details);
      });
      panel.querySelectorAll("[data-ut-training-share]").forEach(b=>b.onclick=async()=>{
        const r=records.find(x=>String(x.row.id)===String(b.dataset.utTrainingShare));if(!r)return;
        const text=`Aprils Signature — Training Registration\nTrainee: ${r.row.full_name||""}\nCourse: ${r.row.course||""}\nStatus: ${TRAINING_STATUS_LABEL(r.status)}\nPayment: ${r.paymentStatus==="fully_paid"?"Fully Paid":r.paymentStatus==="part_paid"?"Part Paid":"Unpaid"}\nInvoice: ${r.inv?.invoiceNumber||"—"}`;
        try{if(navigator.share)await navigator.share({title:"Aprils Signature Training Registration",text});else{await navigator.clipboard?.writeText(text);msg("Sharing is unavailable on this browser; the details were copied to the clipboard.","success")}}catch(e){if(e?.name!=="AbortError")msg("The training details could not be shared.","error")}
      });
      panel.querySelectorAll("[data-ut-training-invoice]").forEach(b=>b.onclick=async()=>{
        const r=records.find(x=>String(x.row.id)===String(b.dataset.utTrainingInvoice));if(!r)return;
        try{b.classList.add("ultimate-busy");let unitPrice=Number(r.inv?.lines?.[0]?.unitPrice||0);if(!unitPrice&&typeof window.getInvoicePriceMap==="function"&&typeof window.invoicePriceFor==="function"){const pm=await window.getInvoicePriceMap();unitPrice=Number(window.invoicePriceFor(pm,"Training - "+(r.row.course||""))||window.invoicePriceFor(pm,r.row.course)||0)}if(typeof window.openInvoiceGenerator!=="function")throw new Error("Invoice generator is not ready.");await window.openInvoiceGenerator(r.row,{manualLines:[{description:r.row.course||"Training / Programme / Class",details:r.row.message||r.row.request_details||r.row.details||"",quantity:Number(r.qty)||1,unitPrice}],training:r.row.course||"Training / Programme / Class",existingRecord:r.inv||null});}catch(e){msg("Training invoice could not be generated: "+e.message,"error")}finally{b.classList.remove("ultimate-busy")}
      });
      panel.querySelectorAll("[data-ut-training-delete]").forEach(b=>b.onclick=async()=>{if(!confirm("Delete this training registration permanently?"))return;try{const rr=await d.from("training_registrations").delete().eq("id",b.dataset.utTrainingDelete);if(rr.error)throw rr.error;await d.from("settings").delete().eq("setting_key","training_status_"+b.dataset.utTrainingDelete);await audit("training_registration",b.dataset.utTrainingDelete,"deleted",{});msg("Training registration deleted.");await loadTrainingRegistrationsUltimate()}catch(e){msg("Training registration could not be deleted: "+e.message,"error")}});
    }
    list.querySelectorAll("[data-ut-training-tab]").forEach(b=>b.onclick=()=>{list.querySelectorAll(".final-status-tab").forEach(x=>x.classList.toggle("active",x===b));render(b.dataset.utTrainingTab)});
    const first=list.querySelector("[data-ut-training-tab]");if(first){first.classList.add("active");render(first.dataset.utTrainingTab)}
  }catch(e){list.innerHTML=`<div class="empty">Training registrations could not be loaded: ${esc(e.message||e)}</div>`}
}
// The strict integration layer owns Training Registrations so it stays in the
// same card format as Order / Quote Requests. Do not overwrite it here.

/* ---------- Robust PDF actions: no blank PDFs, no PDF page opened for sharing ---------- */
async function makePdf(paper,filename){
  if(!paper)throw new Error("PDF content is missing.");
  if(typeof window.pdfFromVisibleElement==="function")return window.pdfFromVisibleElement(paper,{
    margin:0,filename,image:{type:"jpeg",quality:.98},html2canvas:{scale:2,useCORS:true},jsPDF:{unit:"in",format:"a4",orientation:"portrait"}
  });
  if(!window.html2pdf)throw new Error("PDF service is not loaded.");
  const clone=paper.cloneNode(true);clone.style.cssText="position:absolute;left:-100000px;top:0;width:210mm;min-height:297mm;background:#fff";
  document.body.appendChild(clone);
  try{
    const blob=await window.html2pdf().set({margin:0,filename,image:{type:"jpeg",quality:.98},html2canvas:{scale:2,useCORS:true},jsPDF:{unit:"in",format:"a4",orientation:"portrait"}}).from(clone).outputPdf("blob");
    if(!blob||blob.size<5000)throw new Error("The PDF is empty.");
    return blob;
  }finally{clone.remove()}
}
function downloadBlob(blob,filename){
  const u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);
}
async function shareFileOrFallback(blob,filename,title,whatsapp=false,phone=""){
  if(!blob||blob.size<5000)throw new Error("The generated PDF is empty or incomplete.");
  const file=new File([blob],filename,{type:"application/pdf"});
  // Preferred path: the OS share sheet receives the actual PDF file. On phones/tablets
  // this lets the user choose WhatsApp, Mail, Drive, etc. without opening a PDF page.
  if(navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))){
    try{await navigator.share({title,text:title,files:[file]});return true}catch(e){if(e?.name==="AbortError")return false}
  }
  // Desktop browsers without Web Share cannot programmatically attach a local file to
  // WhatsApp. Download the real PDF, then open the WhatsApp chat directly as fallback.
  downloadBlob(blob,filename);
  if(whatsapp){
    const number=typeof window.normalizeWhatsAppNumber==="function"?window.normalizeWhatsAppNumber(phone):String(phone||"").replace(/\D/g,"");
    const text=`${title}\nThe generated PDF is ready in your downloads. Please attach that PDF to this chat.`;
    const url=number?`https://wa.me/${number}?text=${encodeURIComponent(text)}`:`https://wa.me/?text=${encodeURIComponent(text)}`;
    window.location.href=url;
    msg("WhatsApp opened directly. The generated PDF was saved for attachment.","success");
  }else if(navigator.share){
    try{await navigator.share({title,text:`${title}\nPDF: ${filename}`})}catch(e){if(e?.name!=="AbortError")msg("The PDF was downloaded because this browser cannot share files.","error")}
  }else msg("The PDF was downloaded. This browser does not provide the device share menu.","success");
  return false;
}
function bindInvoiceReceiptActions(){
  const inv=document.getElementById("invoiceGeneratorModal");
  if(inv&&!inv.dataset.utActions){
    inv.dataset.utActions="1";
    const bind=(id,fn)=>{const b=inv.querySelector("#"+id);if(b)b.onclick=async()=>{try{b.classList.add("ultimate-busy");await fn()}catch(e){console.error(e);msg("Action could not be completed: "+e.message,"error")}finally{b.classList.remove("ultimate-busy")}}};
    bind("invoiceDownloadPdf",async()=>{const n=document.getElementById("generatedInvoiceNumber")?.value||"Aprils-Signature-Invoice";const blob=await makePdf(document.getElementById("invoicePaper"),n+".pdf");downloadBlob(blob,n+".pdf");msg("Invoice PDF downloaded.")});
    bind("invoiceSharePdf",async()=>{const n=document.getElementById("generatedInvoiceNumber")?.value||"Aprils-Signature-Invoice";const blob=await makePdf(document.getElementById("invoicePaper"),n+".pdf");await shareFileOrFallback(blob,n+".pdf","Aprils Signature Invoice",false,"")});
    bind("invoiceWhatsApp",async()=>{const n=document.getElementById("generatedInvoiceNumber")?.value||"Aprils-Signature-Invoice";const blob=await makePdf(document.getElementById("invoicePaper"),n+".pdf");await shareFileOrFallback(blob,n+".pdf",`Aprils Signature Invoice ${n}`,true,document.getElementById("generatedInvoicePhone")?.value||"")});
    bind("invoicePrint",()=>{if(typeof window.printGeneratedInvoice==="function")window.printGeneratedInvoice();else window.print()});
    bind("invoiceEmail",async()=>{const n=document.getElementById("generatedInvoiceNumber")?.value||"Aprils-Signature-Invoice";const blob=await makePdf(document.getElementById("invoicePaper"),n+".pdf");downloadBlob(blob,n+".pdf");const email=document.getElementById("generatedInvoiceEmail")?.value||"";window.location.href=`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent("Aprils Signature Invoice "+n)}&body=${encodeURIComponent("The invoice PDF has been generated and saved on this device. Please attach it to this email before sending.")}`});
  }
  const rec=document.getElementById("receiptGeneratorModal");
  if(rec&&!rec.dataset.utActions){
    rec.dataset.utActions="1";
    const bind=(id,fn)=>{const b=rec.querySelector("#"+id);if(b)b.onclick=async()=>{try{b.classList.add("ultimate-busy");await fn()}catch(e){console.error(e);msg("Action could not be completed: "+e.message,"error")}finally{b.classList.remove("ultimate-busy")}}};
    bind("receiptDownloadPdf",async()=>{const n=document.getElementById("generatedReceiptNumber")?.value||"Aprils-Signature-Receipt";const blob=await makePdf(document.getElementById("receiptPaper"),n+".pdf");downloadBlob(blob,n+".pdf");msg("Receipt PDF downloaded.")});
    bind("receiptSharePdf",async()=>{const n=document.getElementById("generatedReceiptNumber")?.value||"Aprils-Signature-Receipt";const blob=await makePdf(document.getElementById("receiptPaper"),n+".pdf");await shareFileOrFallback(blob,n+".pdf","Aprils Signature Payment Receipt",false,"")});
    bind("receiptWhatsApp",async()=>{const n=document.getElementById("generatedReceiptNumber")?.value||"Aprils-Signature-Receipt";const blob=await makePdf(document.getElementById("receiptPaper"),n+".pdf");await shareFileOrFallback(blob,n+".pdf",`Aprils Signature Payment Receipt ${n}`,true,document.getElementById("generatedReceiptPhone")?.value||"")});
    bind("receiptPrint",()=>{if(typeof window.printGeneratedReceipt==="function")window.printGeneratedReceipt();else window.print()});
    bind("receiptEmail",async()=>{const n=document.getElementById("generatedReceiptNumber")?.value||"Aprils-Signature-Receipt";const blob=await makePdf(document.getElementById("receiptPaper"),n+".pdf");downloadBlob(blob,n+".pdf");const email=document.getElementById("generatedReceiptEmail")?.value||"";window.location.href=`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent("Aprils Signature Payment Receipt "+n)}&body=${encodeURIComponent("The receipt PDF has been generated and saved on this device. Please attach it to this email before sending.")}`});
  }
}
const modalObserver=new MutationObserver(()=>{try{bindInvoiceReceiptActions()}catch(_){}});
function bindModals(){if(!document.body)return;modalObserver.observe(document.body,{childList:true,subtree:true});bindInvoiceReceiptActions()}

/* ---------- Automatically save generated receipt draft, without counting it as a payment ---------- */
async function autoSaveReceiptDraft(){
  const m=document.getElementById("receiptGeneratorModal");if(!m)return;
  const number=document.getElementById("generatedReceiptNumber")?.value||"";if(!number)return;
  const state=window._aprilsCurrentReceipt; if(!state)return;
  const amount=Number(document.getElementById("generatedReceiptAmount")?.value||0);
  const invoiceNumber=document.getElementById("generatedReceiptInvoiceNumber")?.value||"";
  const record={
    receiptNumber,invoiceNumber,
    customer:document.getElementById("generatedReceiptCustomer")?.value||"",
    phone:document.getElementById("generatedReceiptPhone")?.value||"",
    email:document.getElementById("generatedReceiptEmail")?.value||"",
    amount,lines:state.totals?.lines||[],total:Number(state.totals?.total||0),
    discount:Number(state.totals?.discount||0),balance:Math.max(0,Number(state.totals?.total||0)-amount),
    method:document.getElementById("generatedReceiptMethod")?.value||"",
    reference:document.getElementById("generatedReceiptReference")?.value||"",
    date:document.getElementById("generatedReceiptDate")?.value||"",
    status:"Draft — payment not yet recorded",savedAt:now(),saveType:"automatic"
  };
  try{await saveSetting("receipt_record_"+slug(number),record)}catch(e){console.warn("Receipt draft autosave:",e)}
}
let receiptSaveTimer=0;
function watchReceiptAutosave(){
  const m=document.getElementById("receiptGeneratorModal");if(!m||m.dataset.utAutoSave)return;
  m.dataset.utAutoSave="1";
  const schedule=()=>{clearTimeout(receiptSaveTimer);receiptSaveTimer=setTimeout(autoSaveReceiptDraft,500)};
  m.addEventListener("input",schedule);m.addEventListener("change",schedule);schedule();
}

/* ---------- Staff HR: required ID-card fields and attachment ---------- */
function ensureStaffFields(){
  const sec=document.getElementById("staffHR");if(!sec)return;
  const form=document.getElementById("staffHRForm");if(!form)return;
  if(!document.getElementById("staffHRIdCardType")){
    const phone=document.getElementById("staffHRPhone")?.closest(".form-group");
    const wrap=document.createElement("div");wrap.className="form-group";
    wrap.innerHTML='<label>ID Card Type</label><input id="staffHRIdCardType" placeholder="e.g. Ghana Card, Passport">';
    phone?.insertAdjacentElement("afterend",wrap);
  }
  if(!document.getElementById("staffHRIdCardNumber")){
    const type=document.getElementById("staffHRIdCardType")?.closest(".form-group"),wrap=document.createElement("div");wrap.className="form-group";
    wrap.innerHTML='<label>ID Card Number</label><input id="staffHRIdCardNumber" placeholder="Enter ID card number">';
    type?.insertAdjacentElement("afterend",wrap);
  }
  if(!document.getElementById("staffHRIdCardStartDate")){
    const wrap=document.createElement("div");wrap.className="form-group";
    wrap.innerHTML='<label>ID Card Registration / Issue Date</label><input id="staffHRIdCardStartDate" type="date">';
    document.getElementById("staffHRIdCardNumber")?.closest(".form-group")?.insertAdjacentElement("afterend",wrap);
  }
  if(!document.getElementById("staffHRIdCardExpiryDate")){
    const wrap=document.createElement("div");wrap.className="form-group";
    wrap.innerHTML='<label>ID Card Expiry Date</label><input id="staffHRIdCardExpiryDate" type="date">';
    document.getElementById("staffHRIdCardStartDate")?.closest(".form-group")?.insertAdjacentElement("afterend",wrap);
  }
  if(!document.getElementById("staffHRIdCardImage")){
    const wrap=document.createElement("div");wrap.className="form-group full-width";
    wrap.innerHTML='<label>Attach Staff / ID Card Image</label><input id="staffHRIdCardImage" type="file" accept="image/jpeg,image/png,image/webp"><div id="staffHRIdCardImagePreview"></div>';
    document.getElementById("staffHRIdCardExpiryDate")?.closest(".form-group")?.insertAdjacentElement("afterend",wrap);
    document.getElementById("staffHRIdCardImage").addEventListener("change",async e=>{
      const f=e.target.files?.[0];if(!f)return;if(f.size>3*1024*1024){msg("Staff / ID card image must be 3 MB or smaller.","error");e.target.value="";return}
      const r=new FileReader();r.onload=()=>{document.getElementById("staffHRIdCardImagePreview").innerHTML=`<img class="ultimate-id-image" src="${esc(r.result)}" alt="Staff ID card preview">`};r.readAsDataURL(f);
    });
  }
  const name=document.getElementById("staffHRName");if(name)name.placeholder="Firstname Middlename Surname";
}

/* ---------- General text spacing: preserve phone/email/IDs and add missing word-number spaces ---------- */
function bindSpacing(){
  if(document.documentElement.dataset.utSpacing)return;document.documentElement.dataset.utSpacing="1";
  const clean=v=>String(v||"").replace(/([A-Za-z])(\d)/g,"$1 $2").replace(/(\d)([A-Za-z])/g,"$1 $2").replace(/[ \t]{2,}/g," ");
  document.addEventListener("blur",e=>{
    const x=e.target;
    if(!(x instanceof HTMLInputElement||x instanceof HTMLTextAreaElement))return;
    if(["email","tel","number","date","time","password","url","search","file"].includes(String(x.type||"").toLowerCase()))return;
    if(/id|staff|invoice|receipt|code|reference|link|phone|whatsapp/i.test(String(x.id||"")))return;
    if(x.value)x.value=clean(x.value);
  },true);
}

/* ---------- Audit every meaningful admin interaction, including delete/clear/error-log actions ---------- */
function bindAudit(){
  if(document.documentElement.dataset.utAudit)return;document.documentElement.dataset.utAudit="1";
  document.addEventListener("click",e=>{
    const b=e.target.closest("button");if(!b)return;
    const label=String(b.textContent||"").trim()||b.getAttribute("aria-label")||b.id||"Button";
    const section=b.closest(".section")?.id||"admin";
    audit("admin_action",b.id||label,"button_clicked",{label,section,at:now()});
  },true);
  document.addEventListener("change",e=>{
    const x=e.target;if(!(x instanceof HTMLInputElement||x instanceof HTMLSelectElement||x instanceof HTMLTextAreaElement))return;
    const section=x.closest(".section")?.id||"admin";
    audit("admin_action",x.id||x.name||"field","field_changed",{field:x.id||x.name||"",section,at:now()});
  },true);
  document.addEventListener("submit",e=>{
    const f=e.target;if(!(f instanceof HTMLFormElement))return;
    audit("admin_action",f.id||"form","form_submitted",{form:f.id||"",at:now()});
  },true);
}

/* ---------- Boot ---------- */
function start(){
  addCss();bindModals();bindSpacing();bindAudit();ensureStaffFields();watchReceiptAutosave();

}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();

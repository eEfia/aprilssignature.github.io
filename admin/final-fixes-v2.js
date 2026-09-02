/* =========================================================
   APRILS SIGNATURE — STRICT CORRECTIONS V2
   Completes the supplied correction brief without replacing the
   existing Supabase structure.
========================================================= */
(function(){
"use strict";

const esc=window.escapeHTML||((v)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c])));
const db=()=>window.aprilsSupabase||window.AprilsSupabase||null;
const getRows=()=>typeof window.getRows==="function"?window.gets("settings"):Promise.resolve([]);
const money=v=>`GHS ${Number(v||0).toFixed(2)}`;
const gmtDate=v=>{
  if(!v)return "—";
  const d=new Date(v); if(Number.isNaN(d.getTime()))return String(v);
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"UTC",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(d);
  const get=t=>parts.find(p=>p.type===t)?.value||"";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")} GMT`;
};
const gmtDateOnly=v=>{
  if(!v)return "—"; const d=new Date(v); if(Number.isNaN(d.getTime()))return String(v);
  return new Intl.DateTimeFormat("en-GB",{timeZone:"UTC",day:"2-digit",month:"2-digit",year:"numeric"}).format(d);
};
function msg(text,type="success"){if(typeof window.message==="function")window.message(text,type);else{const el=document.getElementById("globalStatus");if(el){el.textContent=text;el.className="status "+type;}}}
function slug(v){return String(v||"").toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"").slice(0,90);}
function normal(v){return String(v||"").trim().toLowerCase().replace(/\s+/g," ");}

const ORDER_STATUSES=[
 ["under_review","New Customer — Under Review"],["invoice_generated","Invoice Generated"],
 ["deposit_paid","Deposit Paid"],["part_paid","Part Paid"],["order_taken","Confirmed / Order Taken"],
 ["in_production","In Production"],["completed","Completed"],["ready","Ready for Collection / Delivery"],
 ["fully_paid","Full Payment"],["dispatched","Dispatched"],["received","Received by Customer"],["cancelled","Cancelled"]
];
const TRAINING_STATUSES=[
 ["under_review","New Customer — Under Review"],["invoice_generated","Invoice Generated"],
 ["part_paid","Part Paid"],["fully_paid","Fully Paid"],["in_class","In Class"],
 ["completed","Completed"],["stopped","Stopped"],["cancelled","Cancelled"]
];

async function settingsRows(){
  const d=db(); if(!d)return[];
  try{const r=await d.from("settings").select("*"); return r.error?[]:(r.data||[]);}catch(_){return[];}
}
async function setting(key){
  const rows=await settingsRows(); const r=rows.find(x=>String(x.setting_key)===String(key));
  return r?{...r,value:r.setting_value}:null;
}
async function saveSetting(key,value){
  const d=db(); if(!d)throw new Error("Supabase is unavailable.");
  if(typeof window.safeSettingUpsert==="function")return window.safeSettingUpsert(key,value);
  const existing=await d.from("settings").select("id").eq("setting_key",key).limit(1).maybeSingle();
  if(existing.error)throw existing.error;
  const payload={setting_key:key,setting_value:value,updated_at:new Date().toISOString()};
  const r=existing.data?await d.from("settings").update(payload).eq("id",existing.data.id):await d.from("settings").insert(payload);
  if(r.error)throw r.error; return r;
}
async function audit(type,id,action,details){
  try{if(typeof window.auditSystemEvent==="function")await window.auditSystemEvent(type,id,action,details||{});}catch(_){}
}

/* ---------- Staff / HR ---------- */
function addStaffSection(){
  const nav=document.querySelector(".sidebar"); if(!nav)return;
  if(!document.getElementById("staffHR")){
    const b=document.createElement("button"); b.type="button"; b.dataset.section="staffHR"; b.textContent="Staff / HR";
    const accounting=nav.querySelector('[data-section="accounting"]'); nav.insertBefore(b,accounting||null);
    const sec=document.createElement("section"); sec.id="staffHR"; sec.className="section";
    sec.innerHTML=`<h2>Staff / HR</h2>
      <p class="intro">Organise staff records, generate permanent Staff IDs, store employment and education information, and keep salary/bonus records in one professional workspace.</p>
      <div class="form-card"><form id="staffHRForm">
        <input type="hidden" id="staffHRId"><input type="hidden" id="staffHRStaffId">
        <div class="form-grid">
          <div class="form-group"><label>Staff ID</label><input id="staffHRStaffIdDisplay" readonly placeholder="Generated automatically"></div>
          <div class="form-group"><label>Full Name *</label><input id="staffHRName" required placeholder="Firstname Middlename Surname"></div>
          <div class="form-group"><label>Email</label><input id="staffHREmail" type="email"></div>
          <div class="form-group"><label>Phone</label><input id="staffHRPhone" type="tel"></div>
          <div class="form-group"><label>ID Card Type</label><input id="staffHRIdCardType" placeholder="e.g. Ghana Card, Passport"></div>
          <div class="form-group"><label>ID Card Number</label><input id="staffHRIdCardNumber" placeholder="Enter ID card number"></div>
          <div class="form-group"><label>ID Card Registration / Issue Date</label><input id="staffHRIdCardStartDate" type="date"></div>
          <div class="form-group"><label>ID Card Expiry Date</label><input id="staffHRIdCardExpiryDate" type="date"></div>
          <div class="form-group full-width"><label>Attach Staff / ID Card Image</label><input id="staffHRIdCardImage" type="file" accept="image/jpeg,image/png,image/webp"></div>
          <div class="form-group"><label>Job Title / Position</label><input id="staffHRPosition" placeholder="e.g. Seamstress, Sales Assistant"></div>
          <div class="form-group"><label>Employment Status</label><select id="staffHREmployment"><option>Active</option><option>On Leave</option><option>Inactive</option></select></div>
          <div class="form-group"><label>Start Date</label><input id="staffHRStartDate" type="date"></div>
          <div class="form-group"><label>Address / Location</label><input id="staffHRAddress"></div>
          <div class="form-group"><label>Emergency Contact Name</label><input id="staffHREmergencyName"></div>
          <div class="form-group"><label>Emergency Contact Phone</label><input id="staffHREmergencyPhone" type="tel"></div>
          <div class="form-group"><label>Highest Education / Qualification</label><input id="staffHREducation"></div>
          <div class="form-group"><label>Education / Training Background</label><textarea id="staffHREducationBackground"></textarea></div>
          <div class="form-group"><label>Skills / Specialities</label><textarea id="staffHRSkills" placeholder="List relevant skills and specialities."></textarea></div>
          <div class="form-group"><label>Monthly Salary (GHS)</label><input id="staffHRSalary" type="number" min="0" step="0.01"></div>
          <div class="form-group"><label>Bonus / Allowance (GHS)</label><input id="staffHRBonus" type="number" min="0" step="0.01"></div>
          <div class="form-group"><label>Salary / Bonus Notes</label><textarea id="staffHRPayNotes"></textarea></div>
          <div class="form-group full-width"><label>Additional Staff Notes</label><textarea id="staffHRNotes"></textarea></div>
        </div>
        <div class="admin-actions"><button class="primary" type="submit">Save Staff Record</button><button class="secondary" type="button" id="staffHRClear">Clear</button></div>
      </form></div>
      <div class="form-card"><div class="toolbar"><button type="button" class="secondary" id="staffHRRefresh">Refresh</button><button type="button" class="primary" id="staffHRExport">Export CSV</button></div><div id="staffHRList" class="table-wrap"></div></div>`;
    document.querySelector("main.main")?.appendChild(sec);
  }
  if(!nav.querySelector('[data-section="staffHR"][data-v2bound]')){
    const b=nav.querySelector('[data-section="staffHR"]'); b.dataset.v2bound="1";
    b.addEventListener("click",async()=>{nav.querySelectorAll("button[data-section]").forEach(x=>x.classList.remove("active"));b.classList.add("active");document.querySelectorAll(".section").forEach(x=>x.classList.remove("active"));document.getElementById("staffHR").classList.add("active");try{sessionStorage.setItem("aprils_admin_current_section","staffHR")}catch(_){}await loadStaff();});
  }
  setupStaffForm();
}
async function staffRecords(){
  const rows=await settingsRows();
  return rows.filter(r=>String(r.setting_key||"").startsWith("staff_hr_")).map(r=>{try{return{...JSON.parse(r.setting_value||"{}"),_id:r.id,_key:r.setting_key}}catch(_){return null}}).filter(Boolean);
}
function staffFormReset(){
  const f=document.getElementById("staffHRForm"); if(!f)return; f.reset();
  ["staffHRId","staffHRStaffId"].forEach(id=>{const e=document.getElementById(id);if(e)e.value=""});
  const display=document.getElementById("staffHRStaffIdDisplay");if(display)display.value="";
  const emp=document.getElementById("staffHREmployment");if(emp)emp.value="Active";
}
async function loadStaff(){
  const list=document.getElementById("staffHRList"); if(!list)return;
  try{
    const rows=await staffRecords();
    list.innerHTML=rows.length?`<table><thead><tr><th>Staff ID</th><th>Name</th><th>ID Card</th><th>Position</th><th>Phone</th><th>Status</th><th>Salary</th><th>Bonus</th><th>Actions</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.staffId||"")}</td><td>${esc(r.name||"")}</td><td>${esc([r.idCardType,r.idCardNumber].filter(Boolean).join(" — ")||"—")}</td><td>${esc(r.position||"")}</td><td>${esc(r.phone||"")}</td><td>${esc(r.employment||"")}</td><td>${money(r.salary)}</td><td>${money(r.bonus)}</td><td><button class="secondary" type="button" data-staff-edit="${esc(r._key)}">Edit</button> <button class="secondary" type="button" data-staff-pay="${esc(r._key)}">Record Salary / Bonus Expense</button> <button class="danger" type="button" data-staff-delete="${esc(r._id)}" data-staff-key="${esc(r._key)}">Delete</button></td></tr>`).join("")}</tbody></table>`:`<div class="empty">No staff records have been added yet.</div>`;
    list.querySelectorAll("[data-staff-edit]").forEach(b=>b.onclick=async()=>{
      const r=rows.find(x=>x._key===b.dataset.staffEdit);if(!r)return; fillStaff(r);
    });
    list.querySelectorAll("[data-staff-delete]").forEach(b=>b.onclick=async()=>{
      if(!confirm("Delete this staff HR record?"))return; const d=db(); if(!d)return;
      const rr=await d.from("settings").delete().eq("id",b.dataset.staffDelete); if(rr.error){msg("Staff record could not be deleted.","error");return}
      await audit("staff_hr",b.dataset.staffKey,"deleted",{});msg("Staff HR record deleted.");await loadStaff();
    });
    list.querySelectorAll("[data-staff-pay]").forEach(b=>b.onclick=async()=>{
      const r=rows.find(x=>x._key===b.dataset.staffPay);if(!r)return;
      const amount=Number(r.salary||0)+Number(r.bonus||0); if(amount<=0){msg("This staff record has no salary/bonus amount to record.","error");return}
      const date=new Date().toISOString().slice(0,10), key=`staff_expense_${slug(r.staffId||r.name)}_${date}_${Date.now()}`;
      const expense={date,category:"Staff / HR",amount,description:`Salary / bonus — ${r.name||"Staff"} (${r.staffId||""})`,staffId:r.staffId||"",staffName:r.name||""};
      await saveSetting(key,JSON.stringify(expense));await audit("staff_hr",r.staffId||r.name,"staff_expense_recorded",expense);msg("Salary / bonus expense recorded in Sales & Accounting.");if(typeof window.loadAccounting==="function")await window.loadAccounting();
    });
  }catch(e){list.innerHTML=`<div class="empty">Staff records could not be loaded: ${esc(e.message||"")}</div>`}
}
function fillStaff(r){
  const map={staffHRId:r._id,staffHRStaffId:r.staffId,staffHRStaffIdDisplay:r.staffId,staffHRName:r.name,staffHREmail:r.email,staffHRPhone:r.phone,staffHRIdCardType:r.idCardType,staffHRIdCardNumber:r.idCardNumber,staffHRIdCardStartDate:r.idCardStartDate,staffHRIdCardExpiryDate:r.idCardExpiryDate,staffHRPosition:r.position,staffHREmployment:r.employment||"Active",staffHRStartDate:r.startDate,staffHRAddress:r.address,staffHREmergencyName:r.emergencyName,staffHREmergencyPhone:r.emergencyPhone,staffHREducation:r.education,staffHREducationBackground:r.educationBackground,staffHRSkills:r.skills,staffHRSalary:r.salary,staffHRBonus:r.bonus,staffHRPayNotes:r.payNotes,staffHRNotes:r.notes};
  Object.entries(map).forEach(([id,v])=>{const e=document.getElementById(id);if(e)e.value=v??""}); document.getElementById("staffHRForm")?.scrollIntoView({behavior:"smooth",block:"start"});
}
function setupStaffForm(){
  const f=document.getElementById("staffHRForm");if(!f||f.dataset.v2bound)return;f.dataset.v2bound="1";
  document.getElementById("staffHRClear")?.addEventListener("click",staffFormReset);
  document.getElementById("staffHRRefresh")?.addEventListener("click",loadStaff);
  document.getElementById("staffHRExport")?.addEventListener("click",()=>exportSectionCSV(document.getElementById("staffHRList"),"staff-hr"));
  f.addEventListener("submit",async e=>{
    e.preventDefault();const id=document.getElementById("staffHRId").value.trim();
    const staffId=document.getElementById("staffHRStaffId").value.trim()||("AS-STF-"+Date.now().toString(36).toUpperCase());
    let idCardImage="";
    const imageFile=document.getElementById("staffHRIdCardImage")?.files?.[0];
    if(imageFile){ if(imageFile.size>3*1024*1024) throw new Error("Staff / ID card image must be 3 MB or smaller."); idCardImage=await fileToDataUrl(imageFile); }
    const existingRecord=id?((await staffRecords()).find(x=>String(x._id)===String(id))||{}):{};
    if(!idCardImage) idCardImage=existingRecord.idCardImage||"";
    const payload={staffId,name:document.getElementById("staffHRName").value.trim(),email:document.getElementById("staffHREmail").value.trim(),phone:document.getElementById("staffHRPhone").value.trim(),idCardType:document.getElementById("staffHRIdCardType").value.trim(),idCardNumber:document.getElementById("staffHRIdCardNumber").value.trim(),idCardStartDate:document.getElementById("staffHRIdCardStartDate").value,idCardExpiryDate:document.getElementById("staffHRIdCardExpiryDate").value,idCardImage,position:document.getElementById("staffHRPosition").value.trim(),employment:document.getElementById("staffHREmployment").value,startDate:document.getElementById("staffHRStartDate").value,address:document.getElementById("staffHRAddress").value.trim(),emergencyName:document.getElementById("staffHREmergencyName").value.trim(),emergencyPhone:document.getElementById("staffHREmergencyPhone").value.trim(),education:document.getElementById("staffHREducation").value.trim(),educationBackground:document.getElementById("staffHREducationBackground").value.trim(),skills:document.getElementById("staffHRSkills").value.trim(),salary:Number(document.getElementById("staffHRSalary").value||0),bonus:Number(document.getElementById("staffHRBonus").value||0),payNotes:document.getElementById("staffHRPayNotes").value.trim(),notes:document.getElementById("staffHRNotes").value.trim(),updatedAt:new Date().toISOString()};
    try{
      const key=`staff_hr_${slug(staffId)}`; await saveSetting(key,JSON.stringify(payload));await audit("staff_hr",staffId,id?"updated":"created",payload);msg("Staff HR record saved.");staffFormReset();await loadStaff();
    }catch(err){msg("Staff HR record could not be saved: "+err.message,"error")}
  });
}


/* ---------- Status / payment update history + customer detail preview ---------- */
async function enhanceStatusUpdates(){
  const sec=document.getElementById("orderStatusUpdates");if(!sec||sec.dataset.v2status)return;
  sec.dataset.v2status="1";
  const info=sec.querySelector("#finalStatusInfo");
  if(info) info.insertAdjacentHTML("afterend",`<div class="toolbar v2-status-actions"><button type="button" class="secondary" id="finalViewCustomer">View Customer Details</button></div><div id="statusUpdateHistory" class="table-wrap" style="margin-top:15px"></div>`);
  const save=sec.querySelector("#finalStatusSave");
  if(save){
    save.addEventListener("click",async e=>{
      e.preventDefault();e.stopImmediatePropagation();
      const picker=sec.querySelector("#finalStatusRecord"),status=sec.querySelector("#finalOrderStatus"),pay=sec.querySelector("#finalPaymentStatus");
      if(!picker?.value){msg("Select a customer or record first.","error");return}
      const [orders,training]=await Promise.all([db().from("quote_requests").select("*"),db().from("training_registrations").select("*")]);
      const opts=[...(orders.data||[]).map(r=>({type:"Order / Quote",id:r.id,name:r.full_name,row:r,orderStatusKey:"quote_status",paymentKey:"payment_status_quote_"})),...(training.data||[]).map(r=>({type:"Training",id:r.id,name:r.full_name,row:r,orderStatusKey:"training_status",paymentKey:"payment_status_training_"}))];
      const o=opts[Number(picker.value)];if(!o)return;
      try{
        if(typeof window.setAdminRecordStatus==="function")await window.setAdminRecordStatus(o.orderStatusKey,o.id,status.value);else await saveSetting(o.orderStatusKey+"_"+o.id,status.value);
        await saveSetting(o.paymentKey+o.id,pay.value);
        const rec={recordId:o.id,type:o.type,customer:o.name||"",status:status.value,paymentStatus:pay.value,updatedAt:new Date().toISOString(),actor:"Admin"};
        await saveSetting("status_payment_update_"+slug(o.type+"_"+o.id+"_"+Date.now()),JSON.stringify(rec));
        await audit(o.type,o.id,"status_payment_updated",rec);msg("Order/training status and payment status updated and saved.");await renderStatusHistory();
      }catch(err){msg("The status update could not be saved: "+err.message,"error")}
    },true);
  }
  document.getElementById("finalViewCustomer")?.addEventListener("click",async()=>{
    const picker=sec.querySelector("#finalStatusRecord");if(!picker?.value){msg("Select a customer or record first.","error");return}
    const [orders,training]=await Promise.all([db().from("quote_requests").select("*"),db().from("training_registrations").select("*")]);
    const opts=[...(orders.data||[]).map(r=>({type:"Order / Quote",row:r})),...(training.data||[]).map(r=>({type:"Training",row:r}))];
    const o=opts[Number(picker.value)];if(!o)return;
    if(typeof window.aprilsShowSubmissionDetails==="function")window.aprilsShowSubmissionDetails(`${o.type} — Customer Details`,o.row,o.row.message||o.row.request_details||o.row.details||o.row.journey||"");
  });
  await renderStatusHistory();
}
async function renderStatusHistory(){
  const list=document.getElementById("statusUpdateHistory");if(!list)return;
  const rows=await settingsRows(),records=rows.filter(r=>String(r.setting_key||"").startsWith("status_payment_update_")).map(r=>{try{return{...JSON.parse(r.setting_value||"{}"),_id:r.id,_key:r.setting_key}}catch(_){return null}}).filter(Boolean).sort((a,b)=>String(b.updatedAt||"").localeCompare(String(a.updatedAt||"")));
  list.innerHTML=records.length?`<h3 style="margin:12px 0">Saved Status / Payment Updates</h3><table><thead><tr><th>Date / Time</th><th>Type</th><th>Customer</th><th>Status</th><th>Payment</th><th>Actions</th></tr></thead><tbody>${records.map(r=>`<tr><td>${esc(gmtDate(r.updatedAt))}</td><td>${esc(r.type||"")}</td><td>${esc(r.customer||"")}</td><td>${esc((ORDER_STATUSES.concat(TRAINING_STATUSES).find(x=>x[0]===r.status)||["",r.status||""])[1]||r.status||"")}</td><td>${esc(r.paymentStatus||"")}</td><td><button type="button" class="secondary" data-status-edit="${esc(r._key)}">Edit</button> <button type="button" class="danger" data-status-delete="${esc(r._id)}">Delete</button></td></tr>`).join("")}</tbody></table>`:`<div class="empty">No saved status/payment updates yet.</div>`;
  list.querySelectorAll("[data-status-edit]").forEach(b=>b.onclick=async()=>{const r=records.find(x=>x._key===b.dataset.statusEdit);if(!r)return;const picker=document.getElementById("finalStatusRecord"),opts=[...picker.options];const idx=opts.findIndex(o=>o.textContent.includes(r.customer||"")&&o.textContent.includes(r.type||""));if(idx>=0){picker.value=String(idx);picker.dispatchEvent(new Event("change"));}document.getElementById("finalOrderStatus").value=r.status||"under_review";document.getElementById("finalPaymentStatus").value=r.paymentStatus||"unpaid";document.getElementById("orderStatusUpdates")?.scrollIntoView({behavior:"smooth",block:"start"});});
  list.querySelectorAll("[data-status-delete]").forEach(b=>b.onclick=async()=>{if(!confirm("Delete this saved status/payment update history record?"))return;const d=db();const rr=await d.from("settings").delete().eq("id",b.dataset.statusDelete);if(rr.error){msg("Status update history could not be deleted.","error");return}msg("Saved status/payment update deleted.");await renderStatusHistory()});
}

/* ---------- Refund: status, attachments, CRUD, accounting linkage ---------- */
async function refundRecords(){
  const rows=await settingsRows();return rows.filter(r=>String(r.setting_key||"").startsWith("refund_record_")).map(r=>{try{return{...JSON.parse(r.setting_value||"{}"),_id:r.id,_key:r.setting_key}}catch(_){return null}}).filter(Boolean);
}
async function uploadRefundImages(files){
  const d=db();if(!d)throw new Error("Supabase is unavailable.");
  const out=[];
  for(const file of Array.from(files||[])){
    if(!/^image\/(jpeg|png|webp|gif)$/i.test(file.type))throw new Error("Refund attachments must be JPG, PNG, WEBP or GIF images.");
    if(file.size>5*1024*1024)throw new Error("Each refund attachment must be 5 MB or smaller.");
    const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"_"),path=`refund-attachments/${Date.now()}-${Math.random().toString(36).slice(2)}-${safe}`;
    const up=await d.storage.from("quote-uploads").upload(path,file,{upsert:false,contentType:file.type});if(up.error)throw up.error;
    const pub=d.storage.from("quote-uploads").getPublicUrl(path);out.push({name:file.name,path,url:pub?.data?.publicUrl||""});
  }return out;
}
function enhanceRefundForm(){
  const sec=document.getElementById("refund");if(!sec)return;
  const form=sec.querySelector("#refundForm");if(!form)return;
  if(!document.getElementById("refundRecordId")){
    const hid=document.createElement("input");hid.type="hidden";hid.id="refundRecordId";form.prepend(hid);
  }
  const grid=form.querySelector(".form-grid");
  if(grid&&!document.getElementById("refundStatus")){
    grid.insertAdjacentHTML("beforeend",`<div class="form-group"><label for="refundStatus">Refund Status</label><select id="refundStatus"><option value="pending">Pending</option><option value="paid">Paid</option></select></div><div class="form-group full-width"><label for="refundImages">Attach Refund Receipt / Images</label><input id="refundImages" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple><small>Optional. Upload receipts or supporting refund images.</small><div id="refundImageNames" class="small"></div></div>`);
  }
  const list=document.getElementById("refundList");if(list&&!list.dataset.v2actions)list.dataset.v2actions="1";
  const oldSubmit=form.onsubmit;
  form.addEventListener("submit",async e=>{
    e.preventDefault(); e.stopImmediatePropagation();
    const invoice=document.getElementById("refundInvoice")?.value||"", invRows=await settingsRows();
    const inv=invRows.filter(r=>String(r.setting_key||"").startsWith("invoice_record_")).map(r=>{try{return JSON.parse(r.setting_value||"{}")}catch(_){return null}}).find(x=>String(x?.invoiceNumber)===String(invoice));
    if(!inv){msg("Select an invoice.","error");return}
    const pays=inv?invRows.filter(r=>String(r.setting_key||"").startsWith("invoice_payment_record_")).map(r=>{try{return JSON.parse(r.setting_value||"{}")}catch(_){return null}}).filter(x=>String(x?.invoiceNumber)===String(invoice)):[];
    const paid=pays.reduce((a,p)=>a+Number(p.amount||0),0);
    const pct=Math.max(0,Math.min(100,Number(document.getElementById("refundPercent")?.value||0))),fee=Math.max(0,Number(document.getElementById("refundFee")?.value||0));
    const refundAmount=Math.max(0,paid-Math.min(paid,paid*pct/100+fee));if(refundAmount<=0){msg("There is no refundable balance after the selected deduction.","error");return}
    const existingId=document.getElementById("refundRecordId")?.value||"", old=existingId?(await refundRecords()).find(r=>String(r._id)===String(existingId)):null;
    let attachments=old?.attachments||[];const files=document.getElementById("refundImages")?.files;if(files?.length){try{attachments=attachments.concat(await uploadRefundImages(files));}catch(err){msg("Refund images could not be uploaded: "+err.message,"error");return}}
    const refund={...(old||{}),refundNumber:old?.refundNumber||("AS-RF-"+Date.now().toString(36).toUpperCase()),invoiceNumber:inv.invoiceNumber,customer:inv.customer,phone:inv.phone,email:inv.email,originalPaid:paid,refundAmount,deductionPercent:pct,cancellationFee:Math.min(paid,paid*pct/100+fee),reason:document.getElementById("refundReason").value.trim(),notes:document.getElementById("refundNotes").value.trim(),date:old?.date||new Date().toISOString(),updatedAt:new Date().toISOString(),status:document.getElementById("refundStatus")?.value||"pending",attachments};
    await saveSetting("refund_record_"+slug(refund.refundNumber),JSON.stringify(refund));
    if(inv.sourceId&&refund.status==="paid"){const prefix=inv.training?"training_status":"quote_status";if(typeof window.setAdminRecordStatus==="function")await window.setAdminRecordStatus(prefix,inv.sourceId,"cancelled");else await saveSetting(prefix+"_"+inv.sourceId,"cancelled");await saveSetting((inv.training?"payment_status_training_":"payment_status_quote_")+inv.sourceId,refundAmount>=paid?"refunded":"partially_refunded");}
    await audit("refund",refund.refundNumber,old?"updated":"refund_recorded",refund);
    msg(`Refund ${refund.refundNumber} ${old?"updated":"recorded"}.`);
    form.reset();document.getElementById("refundRecordId").value="";if(document.getElementById("refundStatus"))document.getElementById("refundStatus").value="pending";if(document.getElementById("refundImageNames"))document.getElementById("refundImageNames").textContent="";
    await renderRefundList();if(typeof window.loadAccounting==="function")await window.loadAccounting();
  },true);
}
async function renderRefundList(){
  const list=document.getElementById("refundList");if(!list)return;const rows=await refundRecords();
  list.innerHTML=rows.length?`<table><thead><tr><th>Date</th><th>Refund</th><th>Invoice</th><th>Customer</th><th>Amount</th><th>Status</th><th>Images</th><th>Reason</th><th>Actions</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(gmtDate(r.date))}</td><td>${esc(r.refundNumber||"")}</td><td>${esc(r.invoiceNumber||"")}</td><td>${esc(r.customer||"")}</td><td>${money(r.refundAmount)}</td><td>${esc(r.status==="paid"?"Paid":"Pending")}</td><td>${(r.attachments||[]).map(a=>a.url?`<a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.name||"Image")}</a>`:esc(a.name||"Image")).join("<br>")||"—"}</td><td>${esc(r.reason||"")}</td><td><button class="secondary" type="button" data-refund-edit="${esc(r._id)}">Edit</button> <button class="secondary" type="button" data-refund-share="${esc(r._id)}">Share</button> <button class="danger" type="button" data-refund-delete="${esc(r._id)}">Delete</button></td></tr>`).join("")}</tbody></table>`:`<div class="empty">No refunds have been recorded.</div>`;
  list.querySelectorAll("[data-refund-edit]").forEach(b=>b.onclick=async()=>{const r=rows.find(x=>String(x._id)===String(b.dataset.refundEdit));if(!r)return;document.getElementById("refundRecordId").value=r._id;document.getElementById("refundInvoice").value=r.invoiceNumber||"";document.getElementById("refundPercent").value=r.deductionPercent||0;document.getElementById("refundFee").value=0;document.getElementById("refundReason").value=r.reason||"";document.getElementById("refundNotes").value=r.notes||"";document.getElementById("refundStatus").value=r.status||"pending";document.getElementById("refundImageNames").textContent=(r.attachments||[]).map(x=>x.name).join(", ");document.getElementById("refund").scrollIntoView({behavior:"smooth",block:"start"});});
  list.querySelectorAll("[data-refund-delete]").forEach(b=>b.onclick=async()=>{if(!confirm("Delete this refund record?"))return;const d=db();const r=await d.from("settings").delete().eq("id",b.dataset.refundDelete);if(r.error){msg("Refund could not be deleted.","error");return}await audit("refund",b.dataset.refundDelete,"deleted",{});msg("Refund deleted.");await renderRefundList();if(typeof window.loadAccounting==="function")await window.loadAccounting();});
  list.querySelectorAll("[data-refund-share]").forEach(b=>b.onclick=async()=>{const r=rows.find(x=>String(x._id)===String(b.dataset.refundShare));if(!r)return;const text=`Aprils Signature Refund ${r.refundNumber||""}\nCustomer: ${r.customer||""}\nInvoice: ${r.invoiceNumber||""}\nAmount: ${money(r.refundAmount)}\nStatus: ${r.status==="paid"?"Paid":"Pending"}`;const n=typeof window.normalizeWhatsAppNumber==="function"?window.normalizeWhatsAppNumber(r.phone):String(r.phone||"").replace(/\D/g,"");const url=n?`https://wa.me/${n}?text=${encodeURIComponent(text)}`:`https://wa.me/?text=${encodeURIComponent(text)}`;window.location.href=url;});
}

/* ---------- Accounting refund card + paid-only deduction ---------- */
function patchAccounting(){
  const old=window.loadAccounting;if(typeof old!=="function"||old.__v2)return;
  const fn=async function(){
    await old();
    try{
      const rows=await refundRecords(),paid=rows.filter(r=>String(r.status).toLowerCase()==="paid" || String(r.status).toLowerCase()==="refund recorded");
      const total=paid.reduce((a,r)=>a+Number(r.refundAmount||0),0);
      const cards=document.getElementById("accountingSummaryCards");
      if(cards&&!document.getElementById("accountingRefundCard"))cards.insertAdjacentHTML("beforeend",`<div class="card" id="accountingRefundCard"><h3>Refunds</h3><div class="number" id="accountingRefunds">GHS 0.00</div><p>Paid refunds deducted from money received</p></div>`);
      if(document.getElementById("accountingRefunds"))document.getElementById("accountingRefunds").textContent=money(total);
      // The original final-fixes accounting bridge performs the paid-only refund deduction.
      // Add Staff / HR expenses to the accounting expense total and show them separately.
      const staffRows=await settingsRows();
      const staffExpenses=staffRows.filter(r=>String(r.setting_key||"").startsWith("staff_expense_")).map(r=>{try{return{...JSON.parse(r.setting_value||"{}"),_id:r.id}}catch(_){return null}}).filter(Boolean);
      const staffTotal=staffExpenses.reduce((a,r)=>a+Number(r.amount||0),0);
      // Staff salary/bonus is tracked separately and MUST NOT change Business Expenses or Net Cash.
      const accounting=document.getElementById("accounting");
      const cardsSummary=document.getElementById("accountingSummaryCards");
      if(cardsSummary&&!document.getElementById("accountingSalaryCard")){
        cardsSummary.insertAdjacentHTML("beforeend",`<div class="card" id="accountingSalaryCard"><h3>Salary</h3><div class="number" id="accountingSalary">GHS 0.00</div><p>Staff salary / bonus paid</p></div>`);
      }
      if(document.getElementById("accountingSalary"))document.getElementById("accountingSalary").textContent=money(staffTotal);
      let card=document.getElementById("refundAccountingList");
      if(!card&&accounting){card=document.createElement("div");card.className="form-card";card.id="refundAccountingList";card.innerHTML="<h3>Refunds</h3><div class='table-wrap'></div>";accounting.appendChild(card)}
      const list=card?.querySelector(".table-wrap");
      if(list)list.innerHTML=rows.length?`<table><thead><tr><th>Date</th><th>Refund</th><th>Invoice</th><th>Customer</th><th>Amount</th><th>Status</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(gmtDate(r.date))}</td><td>${esc(r.refundNumber||"")}</td><td>${esc(r.invoiceNumber||"")}</td><td>${esc(r.customer||"")}</td><td>${money(r.refundAmount)}</td><td>${esc(r.status==="paid"?"Paid":"Pending")}</td></tr>`).join("")}</tbody></table>`:"<div class='empty'>No refunds recorded.</div>";      renderStaffAccountingCard();
      const staffList=document.querySelector("#staffAccountingList .table-wrap");
      if(staffList)staffList.innerHTML=staffExpenses.length?`<table><thead><tr><th>Date</th><th>Staff ID</th><th>Staff Name</th><th>Description</th><th>Amount</th></tr></thead><tbody>${staffExpenses.map(r=>`<tr><td>${esc(gmtDate(r.date))}</td><td>${esc(r.staffId||"")}</td><td>${esc(r.staffName||"")}</td><td>${esc(r.description||"")}</td><td>${money(r.amount)}</td></tr>`).join("")}</tbody></table>`:"<div class='empty'>No staff / HR expenses recorded.</div>";
    }catch(e){console.warn("Accounting refund patch:",e)}
  };fn.__v2=true;window.loadAccounting=fn;
}


function renderStaffAccountingCard(){
 const accounting=document.getElementById("accounting");if(!accounting)return;
 let card=document.getElementById("staffAccountingList");
 if(!card){card=document.createElement("div");card.className="form-card";card.id="staffAccountingList";card.innerHTML="<h3>Staff / HR Expenses</h3><div class='table-wrap'></div>";accounting.appendChild(card)}
}

/* ---------- Trainees: all registrations, training tracking pipeline ---------- */
async function loadTraineesEnhanced(){
  const list=document.getElementById("traineesList");if(!list)return;
  const d=db();if(!d){list.innerHTML="<div class='empty'>Supabase is unavailable.</div>";return}
  try{
    const [tr,settings]=await Promise.all([
      (typeof window.getRows === "function" ? window.getRows("training_registrations") : d.from("training_registrations").select("*")),
      settingsRows()
    ]);
    if(tr.error)throw tr.error;
    const rows=(tr.data||tr||[]).slice().sort((a,b)=>String(b.created_at||b.updated_at||b.createdAt||b.updatedAt||"").localeCompare(String(a.created_at||a.updated_at||a.createdAt||a.updatedAt||""))), sm=new Map();
    settings.filter(r=>String(r.setting_key||"").startsWith("training_status_")).forEach(r=>sm.set(String(r.setting_key).replace("training_status_",""),String(r.setting_value||"under_review")));
    const invoices=settings.filter(r=>String(r.setting_key||"").startsWith("invoice_record_")).map(r=>{try{return JSON.parse(r.setting_value||"{}")}catch(_){return null}}).filter(Boolean);
    const payments=settings.filter(r=>String(r.setting_key||"").startsWith("invoice_payment_record_")).map(r=>{try{return JSON.parse(r.setting_value||"{}")}catch(_){return null}}).filter(Boolean);
    const records=rows.map(row=>{
      const invoice=invoices.filter(x=>String(x.sourceId||"")===String(row.id)||normal(x.customer)===normal(row.full_name)).sort((a,b)=>String(b.savedAt||b.updatedAt||"").localeCompare(String(a.savedAt||a.updatedAt||"")))[0];
      const invoiceNumber=String(invoice?.invoiceNumber||"");
      const paid=payments.filter(p=>String(p.invoiceNumber||"")===invoiceNumber).reduce((a,p)=>a+Number(p.amount||0),0);
      const total=Number(invoice?.total||0),balance=Math.max(0,total-paid);
      let status=sm.get(String(row.id))||"under_review";
      if(!sm.has(String(row.id))){if(total>0&&balance<=0)status="fully_paid";else if(paid>0)status="part_paid";else if(invoice)status="invoice_generated";}
      let journey={};try{journey=JSON.parse(row.journey||"{}")}catch(_){}
      const quantity=Number(journey.quantity||journey.trainingQuantity||row.quantity||1)||1;
      const paymentStatus=total>0&&paid>=total?"fully_paid":paid>0?"part_paid":"unpaid";
      return {row,invoice,invoiceNumber,paid,total,balance,status,quantity,paymentStatus,journey};
    });
    const tabs=TRAINING_STATUSES.map(([k,l])=>`<button type="button" class="final-status-tab" data-trainee-tab="${esc(k)}">${esc(l)} <span>${records.filter(x=>x.status===k).length}</span></button>`).join("");
    list.innerHTML=`<div class="final-tracking-tabs">${tabs}</div><div class="final-training-panel"></div>`;
    const panel=list.querySelector(".final-training-panel");
    function render(key){
      const chosen=records.filter(x=>x.status===key).sort((a,b)=>String(b.row.created_at||b.row.updated_at||"").localeCompare(String(a.row.created_at||a.row.updated_at||"")));
      panel.innerHTML=chosen.length?`<div class="final-spreadsheet"><table><thead><tr><th>Date</th><th>Trainee</th><th>Course / Programme</th><th>Phone / WhatsApp</th><th>Details</th><th>Quantity</th><th>Invoice</th><th>Total</th><th>Paid</th><th>Balance</th><th>Payment Status</th><th>Training Status</th><th>Action</th></tr></thead><tbody>${chosen.map(x=>`<tr><td>${esc(gmtDate(x.row.created_at||x.row.updated_at))}</td><td>${esc(x.row.full_name||"")}</td><td>${esc(x.row.course||"")}</td><td>${esc([x.row.phone,x.row.whatsapp].filter(Boolean).join(" • ")||"—")}</td><td>${esc(x.row.message||x.row.request_details||x.row.details||"—")}</td><td>Quantity ${esc(x.quantity)}</td><td>${esc(x.invoiceNumber||"—")}</td><td>${money(x.total)}</td><td>${money(x.paid)}</td><td>${money(x.balance)}</td><td>${esc(x.paymentStatus==="fully_paid"?"Fully Paid":x.paymentStatus==="part_paid"?"Part Paid":"Unpaid")}</td><td><div class="status-control"><select class="admin-status-select">${TRAINING_STATUSES.map(([k,l])=>`<option value="${k}" ${k===x.status?"selected":""}>${esc(l)}</option>`).join("")}</select><button type="button" class="secondary" data-trainee-save="${esc(x.row.id)}">Save</button></div></td><td><button type="button" class="secondary" data-view-trainee="${esc(x.row.id)}">View Full Details</button><button type="button" class="secondary" data-trainee-share="${esc(x.row.id)}">Share</button></td></tr>`).join("")}</tbody></table></div>`:`<div class="empty">No trainees are currently in this status.</div>`;
      panel.querySelectorAll("[data-trainee-save]").forEach(b=>b.onclick=async()=>{const sel=b.closest(".status-control")?.querySelector("select");try{b.disabled=true;if(typeof window.setAdminRecordStatus==="function")await window.setAdminRecordStatus("training_status",b.dataset.traineeSave,sel?.value||"under_review");else await saveSetting("training_status_"+b.dataset.traineeSave,sel?.value||"under_review");await audit("training_registration",b.dataset.traineeSave,"status_updated",{status:sel?.value||"under_review"});msg("Trainee status updated.");await loadTraineesEnhanced()}catch(e){msg("Trainee status could not be updated: "+e.message,"error")}finally{b.disabled=false}});
      panel.querySelectorAll("[data-view-trainee]").forEach(b=>b.onclick=()=>{const x=records.find(v=>String(v.row.id)===String(b.dataset.viewTrainee));if(!x)return;const details=`Date: ${gmtDate(x.row.created_at||x.row.updated_at)}\nTrainee: ${x.row.full_name||""}\nCourse / Programme: ${x.row.course||""}\nPhone / WhatsApp: ${[x.row.phone,x.row.whatsapp].filter(Boolean).join(" • ")}\nEmail: ${x.row.email||""}\nLocation: ${x.row.location||""}\nDetails: ${x.row.message||x.row.request_details||x.row.details||""}\nQuantity: ${x.quantity}\nInvoice: ${x.invoiceNumber||"—"}\nTotal: ${money(x.total)}\nPaid: ${money(x.paid)}\nBalance: ${money(x.balance)}\nPayment Status: ${x.paymentStatus==="fully_paid"?"Fully Paid":x.paymentStatus==="part_paid"?"Part Paid":"Unpaid"}\nTraining Status: ${(TRAINING_STATUSES.find(s=>s[0]===x.status)||[])[1]||x.status}`;if(typeof window.aprilsShowSubmissionDetails==="function")window.aprilsShowSubmissionDetails("Trainee Details",x.row,details,[]);else alert(details)});
      panel.querySelectorAll("[data-trainee-share]").forEach(b=>b.onclick=async()=>{const x=records.find(v=>String(v.row.id)===String(b.dataset.traineeShare));if(!x)return;const text=`Aprils Signature — Trainee\nTrainee: ${x.row.full_name||""}\nCourse / Programme: ${x.row.course||""}\nTraining Status: ${(TRAINING_STATUSES.find(s=>s[0]===x.status)||[])[1]||x.status}\nPayment Status: ${x.paymentStatus==="fully_paid"?"Fully Paid":x.paymentStatus==="part_paid"?"Part Paid":"Unpaid"}\nInvoice: ${x.invoiceNumber||"—"}`;try{if(navigator.share)await navigator.share({title:"Aprils Signature — Trainee",text});else{await navigator.clipboard?.writeText(text);msg("Sharing is unavailable on this browser; the trainee details were copied to the clipboard.")}}catch(e){if(e?.name!=="AbortError")msg("The trainee details could not be shared.","error")}});
    }
    list.querySelectorAll("[data-trainee-tab]").forEach(b=>b.onclick=()=>{list.querySelectorAll(".final-status-tab").forEach(x=>x.classList.toggle("active",x===b));render(b.dataset.traineeTab)});
    const first=list.querySelector("[data-trainee-tab]");if(first){first.classList.add("active");render(first.dataset.traineeTab)}
  }catch(e){list.innerHTML=`<div class='empty'>Trainees could not be loaded: ${esc(e.message||"")}</div>`}
}

/* ---------- Generic search: saved items + text + date/month/year + export ---------- */
function parseDMY(s){
  const m=String(s||"").match(/(\d{2})\/(\d{2})\/(\d{4})/);if(!m)return null;
  return new Date(Date.UTC(Number(m[3]),Number(m[2])-1,Number(m[1])));
}
function exportSectionCSV(wrap,filename){
  if(!wrap)return;
  const table=wrap.querySelector("table");if(!table){msg("There is no table data to export.","error");return}
  const rows=[...table.querySelectorAll("tr")].filter(r=>r.style.display!=="none");
  const csv=rows.map(r=>[...r.children].map(c=>`"${String(c.innerText||"").replace(/"/g,'""')}"`).join(",")).join("\r\n");
  const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`${filename}-${new Date().toISOString().slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function enhanceSearchBox(box,wrap){
  if(box.dataset.v2)return;box.dataset.v2="1";
  box.className="admin-table-search v2-search";
  box.innerHTML=`<div class="v2-search-row"><input type="search" aria-label="Search saved items" placeholder="Search by customer, invoice, item, product, name or number…"><select aria-label="Saved items"><option value="">Saved items — choose one</option></select><input type="date" aria-label="Date from"><input type="date" aria-label="Date to"><button type="button" class="secondary v2-export">Export CSV</button></div>`;
  const input=box.querySelector('input[type="search"]'),select=box.querySelector("select"),from=box.querySelector('input[type="date"]'),to=box.querySelectorAll('input[type="date"]')[1];
  const options=[...wrap.querySelectorAll("tbody tr")].map(r=>String(r.innerText||"").trim()).filter(Boolean).slice(0,200);
  options.forEach((v,i)=>{const o=document.createElement("option");o.value=String(i);o.textContent=v.slice(0,120);select.appendChild(o)});
  const apply=()=>{
    const term=normal(input.value),fd=from.value?new Date(from.value+"T00:00:00Z"):null,td=to.value?new Date(to.value+"T23:59:59Z"):null;
    [...wrap.querySelectorAll("tbody tr")].forEach(r=>{
      const text=normal(r.innerText||"");let ok=!term||text.includes(term);
      const dates=[...String(r.innerText||"").matchAll(/(\d{2}\/\d{2}\/\d{4})/g)].map(m=>parseDMY(m[1])).filter(Boolean);
      if(fd&&dates.length)ok=ok&&dates.some(d=>d>=fd);if(td&&dates.length)ok=ok&&dates.some(d=>d<=td);
      r.style.display=ok?"":"none";
    });
  };
  input.oninput=apply;from.onchange=apply;to.onchange=apply;select.onchange=()=>{const v=select.value;if(v!==""){input.value=options[Number(v)]||"";apply()}};
  box.querySelector(".v2-export").onclick=()=>exportSectionCSV(wrap,"aprils-signature-export");
}
function refreshSavedSearchOptions(){
 document.querySelectorAll(".section .table-wrap").forEach(wrap=>{
   const box=wrap.previousElementSibling;if(!box?.classList.contains("admin-table-search")||!box.classList.contains("v2-search"))return;
   const select=box.querySelector("select");if(!select)return;
   const current=select.value, options=[...wrap.querySelectorAll("tbody tr")].map(r=>String(r.innerText||"").trim()).filter(Boolean).slice(0,200);
   select.innerHTML='<option value="">Saved items — choose one</option>'+options.map((x,i)=>`<option value="${i}">${esc(x.slice(0,120))}</option>`).join("");
   if(current && options[Number(current)])select.value=current;
 });
}
function enhanceAllSearches(){
 document.querySelectorAll(".section .table-wrap").forEach(wrap=>{
   let box=null,anchor=wrap.previousElementSibling;
   if(anchor?.classList.contains("admin-table-search"))box=anchor;
   else if(anchor?.classList.contains("v2-table-arrows") && anchor.previousElementSibling?.classList.contains("admin-table-search"))box=anchor.previousElementSibling;
   if(!box){box=document.createElement("div");box.className="admin-table-search";if(anchor?.classList.contains("v2-table-arrows"))wrap.parentNode.insertBefore(box,anchor);else wrap.parentNode.insertBefore(box,wrap)}
   enhanceSearchBox(box,wrap);
 });
}

/* ---------- Button / date presentation helpers ---------- */
function patchAdminDateStrings(){
  // Replace obvious date/time text nodes after dynamic rendering. This is deliberately
  // conservative: it only changes ISO timestamps or existing dd/mm/yyyy date+time strings.
  document.querySelectorAll(".section td,.section time,.section .small,.section .intro").forEach(el=>{
    if(el.dataset.v2date)return;
    const t=el.textContent.trim();
    if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(t)){el.textContent=gmtDate(t);el.dataset.v2date="1";}
  });
}
function addTopArrows(){
  document.querySelectorAll(".table-wrap").forEach(w=>{
    if(w.dataset.v2arrows)return;w.dataset.v2arrows="1";
    const parent=w.parentElement;if(!parent)return;
    const bar=document.createElement("div");bar.className="v2-table-arrows";
    bar.innerHTML=`<button type="button" aria-label="Scroll table left">←</button><button type="button" aria-label="Scroll table right">→</button>`;
    parent.insertBefore(bar,w);
    const [l,r]=bar.querySelectorAll("button");l.onclick=()=>w.scrollBy({left:-350,behavior:"smooth"});r.onclick=()=>w.scrollBy({left:350,behavior:"smooth"});
  });
}


function addV2Css(){
 if(document.getElementById("strictCorrectionsV2Styles"))return;
 const st=document.createElement("style");st.id="strictCorrectionsV2Styles";st.textContent=`
 .v2-search-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
 .v2-search-row input[type="search"]{flex:1 1 260px;min-width:220px}
 .v2-search-row input[type="date"],.v2-search-row select{flex:0 1 180px;min-width:150px}
 .v2-table-arrows{display:flex;justify-content:flex-end;gap:4px;margin:4px 0 6px}
 .v2-table-arrows button{width:30px;height:28px;padding:0;border:1px solid #888;background:#fff;border-radius:4px;cursor:pointer;font-weight:700}
 .v2-table-arrows button:hover{background:#eee}
 .table-wrap{scrollbar-width:none}.table-wrap::-webkit-scrollbar{height:0;width:0}
 #checkoutList table{table-layout:fixed;min-width:980px}
 #checkoutList th:nth-child(1),#checkoutList td:nth-child(1){width:9%}
 #checkoutList th:nth-child(2),#checkoutList td:nth-child(2){width:7%}
 #checkoutList th:nth-child(3),#checkoutList td:nth-child(3){width:13%}
 #checkoutList th:nth-child(4),#checkoutList td:nth-child(4){width:17%}
 #checkoutList th:nth-child(5),#checkoutList td:nth-child(5){width:9%}
 #checkoutList th:nth-child(6),#checkoutList td:nth-child(6){width:15%}
 #checkoutList th:nth-child(7),#checkoutList td:nth-child(7){width:18%}
 #checkoutList th:nth-child(8),#checkoutList td:nth-child(8){width:12%}
 #auditLogList table{table-layout:fixed;min-width:0}
 #auditLogList th:nth-child(5),#auditLogList td:nth-child(5){width:12%}
 #auditLogList th:nth-child(6),#auditLogList td:nth-child(6){width:24%;word-break:break-word}
 .catalogue-product-title{margin:0 0 6px;font-size:15px}
 .catalogue-detail-box{display:none}.catalogue-detail-box.is-open{display:block}
 @media(max-width:700px){.v2-search-row input[type="date"],.v2-search-row select{flex:1 1 150px}.v2-search-row button{flex:0 0 auto}}
 `;
 document.head.appendChild(st);
}


function setupAccountingPeriod(){
 const sec=document.getElementById("accounting");if(!sec||sec.dataset.v2period)return;sec.dataset.v2period="1";
 const card=sec.querySelector("#accountingSummaryCards");if(!card)return;
 const bar=document.createElement("div");bar.className="form-card";bar.innerHTML=`<div class="form-grid"><div class="form-group"><label>Accounting Period — From</label><input type="date" id="accountingPeriodFrom"></div><div class="form-group"><label>Accounting Period — To</label><input type="date" id="accountingPeriodTo"></div></div><div class="toolbar"><button type="button" class="primary" id="accountingApplyPeriod">Apply Period</button><button type="button" class="secondary" id="accountingClearPeriod">Show All</button><button type="button" class="secondary" id="accountingExportPeriod">Export Period CSV</button></div><div id="accountingPeriodNote" class="small"></div>`;
 card.parentNode.insertBefore(bar,card);
 const apply=async()=>{await calculateAccountingPeriod()};
 document.getElementById("accountingApplyPeriod").onclick=apply;
 document.getElementById("accountingClearPeriod").onclick=()=>{document.getElementById("accountingPeriodFrom").value="";document.getElementById("accountingPeriodTo").value="";calculateAccountingPeriod()};
 document.getElementById("accountingExportPeriod").onclick=()=>exportSectionCSV(document.getElementById("accountingList"),"aprils-signature-accounting-period");
}
async function calculateAccountingPeriod(){
 const from=document.getElementById("accountingPeriodFrom")?.value,to=document.getElementById("accountingPeriodTo")?.value;
 const note=document.getElementById("accountingPeriodNote");const d=db();if(!d)return;
 if(!from&&!to){if(note)note.textContent="Showing all recorded accounting data.";if(typeof window.loadAccounting==="function"&&document.getElementById("accounting")?.classList.contains("active"))await window.loadAccounting();return}
 const inPeriod=v=>{if(!v)return false;const dt=new Date(v);if(Number.isNaN(dt.getTime()))return false;const ymd=new Date(dt.toISOString()).toISOString().slice(0,10);return (!from||ymd>=from)&&(!to||ymd<=to)};
 try{
  const rows=await settingsRows();
  const invoices=rows.filter(r=>String(r.setting_key||"").startsWith("invoice_record_")).map(r=>{try{return JSON.parse(r.setting_value||"{}")}catch(_){return null}}).filter(x=>x&&inPeriod(x.date||x.savedAt));
  const payments=rows.filter(r=>String(r.setting_key||"").startsWith("invoice_payment_record_")).map(r=>{try{return JSON.parse(r.setting_value||"{}")}catch(_){return null}}).filter(x=>x&&inPeriod(x.date||x.savedAt));
  const expenses=rows.filter(r=>String(r.setting_key||"").startsWith("accounting_expense_")||String(r.setting_key||"").startsWith("staff_expense_")).map(r=>{try{return JSON.parse(r.setting_value||"{}")}catch(_){return null}}).filter(x=>x&&inPeriod(x.date||x.savedAt));
  const refunds=rows.filter(r=>String(r.setting_key||"").startsWith("refund_record_")).map(r=>{try{return JSON.parse(r.setting_value||"{}")}catch(_){return null}}).filter(x=>x&&x.status==="paid"&&inPeriod(x.date||x.updatedAt));
  const sales=invoices.reduce((s,x)=>s+Number(x.total||0),0),received=payments.reduce((s,x)=>s+Number(x.amount||0),0),outstanding=invoices.reduce((s,x)=>s+Math.max(0,Number(x.total||0)-payments.filter(p=>String(p.invoiceNumber)===String(x.invoiceNumber)).reduce((a,p)=>a+Number(p.amount||0),0)),0),discounts=invoices.reduce((s,x)=>s+Number(x.discount||0),0),refund=refunds.reduce((s,x)=>s+Number(x.refundAmount||0),0),exp=expenses.reduce((s,x)=>s+Number(x.amount||0),0);
  const set=(id,val)=>{const e=document.getElementById(id);if(e)e.textContent=money(val)};
  set("accountingSales",sales);set("accountingReceived",Math.max(0,received-refund));set("accountingOutstanding",outstanding);set("accountingDiscounts",discounts);set("accountingExpenses",exp);set("accountingNetCash",received-refund-exp);set("accountingRefunds",refund);
  if(note)note.textContent=`Accounting period: ${from||"start"} to ${to||"present"}.`;
 }catch(e){if(note)note.textContent="Could not calculate the selected period: "+e.message}
}


/* =========================================================
   STRICT FINAL INTEGRATION — all remaining correction points
========================================================= */
function strictDateTime(v){
  if(!v)return "—";
  const d=new Date(v);if(Number.isNaN(d.getTime()))return String(v);
  return new Intl.DateTimeFormat("en-GB",{timeZone:"UTC",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false}).format(d)+" GMT";
}
function strictDate(v){
  if(!v)return "—";
  const raw=String(v);
  const m=raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m)return `${m[3]}/${m[2]}/${m[1]}`;
  const d=new Date(v);if(Number.isNaN(d.getTime()))return raw;
  return new Intl.DateTimeFormat("en-GB",{timeZone:"UTC",day:"2-digit",month:"2-digit",year:"numeric"}).format(d);
}
function strictDateInputs(){
  document.documentElement.lang="en-GB";
  document.querySelectorAll('input[type="date"]').forEach(i=>{
    i.lang="en-GB";i.title="Date format: DD/MM/YYYY";i.setAttribute("aria-label",(i.getAttribute("aria-label")||i.id||"Date")+" — DD/MM/YYYY");
    const label=i.closest(".form-group")?.querySelector("label");
    if(label&&!label.dataset.strictDateLabel){label.dataset.strictDateLabel="1";if(!/DD\/MM\/YYYY/i.test(label.textContent))label.insertAdjacentText("beforeend"," (DD/MM/YYYY)");}
  });
  document.querySelectorAll('input[type="time"]').forEach(i=>{
    i.title="Time is recorded/displayed in GMT";
    const label=i.closest(".form-group")?.querySelector("label");
    if(label&&!label.dataset.strictGmtLabel){label.dataset.strictGmtLabel="1";if(!/GMT/i.test(label.textContent))label.insertAdjacentText("beforeend"," (GMT)");}
  });
  document.querySelectorAll(".section td,.section time,.section .small").forEach(el=>{
    const t=String(el.textContent||"").trim();
    if(!t||el.dataset.strictDateDisplay)return;
    if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(t)){el.textContent=strictDateTime(t);el.dataset.strictDateDisplay="1";}
  });
}

function strictSearchDedup(){
  document.querySelectorAll(".section .table-wrap").forEach(wrap=>{
    const boxes=[];let node=wrap.previousElementSibling;
    while(node && (node.classList.contains("admin-table-search")||node.classList.contains("v2-table-arrows"))){if(node.classList.contains("admin-table-search"))boxes.unshift(node);node=node.previousElementSibling;}
    if(boxes.length){const keep=boxes[0];boxes.slice(1).forEach(b=>b.remove());if(keep.dataset.v2!=="1")enhanceSearchBox(keep,wrap)}
    else{const box=document.createElement("div");box.className="admin-table-search";box.innerHTML=`<div class="v2-search-row"><input type="search" aria-label="Search this table" placeholder="Search by customer, invoice, item, product, name or number…"><select aria-label="Saved items"><option value="">Saved items — choose one</option></select><input type="date" aria-label="Date from"><input type="date" aria-label="Date to"></div>`;const anchor=wrap.previousElementSibling;wrap.parentNode.insertBefore(box,anchor?.classList.contains("v2-table-arrows")?anchor:wrap)}
  });
}

async function strictAccounting(){
  const list=document.getElementById("accountingList");if(!list)return;
  try{
    const rows=await settingsRows();
    const parse=prefix=>rows.filter(r=>String(r.setting_key||"").startsWith(prefix)).map(r=>{try{return{...JSON.parse(r.setting_value||"{}"),_id:r.id,_key:r.setting_key}}catch(_){return null}}).filter(Boolean);
    const invoices=parse("invoice_record_");
    const payments=parse("invoice_payment_record_");
    const refunds=parse("refund_record_").filter(r=>["paid","refund recorded"].includes(String(r.status||"").toLowerCase()));
    const businessExpenses=parse("accounting_expense_");
    const staffExpenses=parse("staff_expense_");
    let offlineInvoices=[],offlinePayments=[],offlineExpenses=[];
    try{offlineInvoices=JSON.parse(localStorage.getItem("aprils_offline_invoices")||"[]")}catch(_){}
    try{offlinePayments=JSON.parse(localStorage.getItem("aprils_offline_payments")||"[]")}catch(_){}
    try{offlineExpenses=JSON.parse(localStorage.getItem("aprils_offline_expenses")||"[]")}catch(_){}
    const invMap=new Map([...invoices,...offlineInvoices].filter(x=>x.invoiceNumber).map(x=>[String(x.invoiceNumber),x]));
    const payMap=new Map();[...payments,...offlinePayments].forEach(p=>{const k=String(p.invoiceNumber||"");if(!k)return;if(!payMap.has(k))payMap.set(k,[]);payMap.get(k).push(p)});
    const refundByInvoice=new Map();refunds.forEach(r=>refundByInvoice.set(String(r.invoiceNumber||""),(refundByInvoice.get(String(r.invoiceNumber||""))||0)+Number(r.refundAmount||0)));
    const records=[...invMap.values()].map(inv=>{const gross=(payMap.get(String(inv.invoiceNumber))||[]).reduce((a,p)=>a+Number(p.amount||0),0);const ref=refundByInvoice.get(String(inv.invoiceNumber))||0;const net=Math.max(0,gross-ref);const total=Number(inv.total||0);return {...inv,_grossPaid:gross,_refund:ref,_netPaid:net,_balance:Math.max(0,total-net)}}).filter(x=>x._grossPaid>0).sort((a,b)=>String(b.date||b.savedAt||"").localeCompare(String(a.date||a.savedAt||"")));
    const grossReceived=records.reduce((a,x)=>a+x._grossPaid,0),totalRefunds=refunds.reduce((a,x)=>a+Number(x.refundAmount||0),0),netReceived=Math.max(0,grossReceived-totalRefunds);
    const totalSales=netReceived,totalOutstanding=records.reduce((a,x)=>a+x._balance,0),totalDiscounts=records.reduce((a,x)=>a+Number(x.discount||0),0);
    const expenseMap=new Map();[...businessExpenses,...staffExpenses,...offlineExpenses].forEach(e=>{const k=String(e._id||e.id||e.savedAt||`${e.date}|${e.category}|${e.description}|${e.amount}`);if(!expenseMap.has(k))expenseMap.set(k,e)});
    const expenses=[...expenseMap.values()],totalExpenses=expenses.reduce((a,x)=>a+Number(x.amount||0),0);
    list.innerHTML=records.length?`<table><thead><tr><th>Date</th><th>Invoice</th><th>Type</th><th>Customer</th><th>Sale (Net Received)</th><th>Discount</th><th>Received</th><th>Refunded</th><th>Balance</th><th>Status</th></tr></thead><tbody>${records.map(x=>`<tr><td>${esc(strictDate(x.date||x.savedAt))}</td><td>${esc(x.invoiceNumber||"")}</td><td>${esc(x.training?"Training":"Order / Quote")}</td><td>${esc(x.customer||"")}</td><td>${money(x._netPaid)}</td><td>${money(x.discount)}</td><td>${money(x._grossPaid)}</td><td>${money(x._refund)}</td><td>${money(x._balance)}</td><td>${x._balance<=0?"Paid in full":"Part payment"}</td></tr>`).join("")}</tbody></table>`:`<div class="empty">No payments received have been recorded yet. Invoices alone are not counted as sales.</div>`;
    const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=money(v)};
    set("accountingSales",totalSales);set("accountingReceived",netReceived);set("accountingOutstanding",totalOutstanding);set("accountingDiscounts",totalDiscounts);set("accountingExpenses",totalExpenses);set("accountingNetCash",netReceived-totalExpenses);set("accountingRefunds",totalRefunds);
    let card=document.getElementById("refundAccountingList");const accounting=document.getElementById("accounting");if(!card&&accounting){card=document.createElement("div");card.id="refundAccountingList";card.className="form-card";card.innerHTML="<h3>Refunds</h3><div class='table-wrap'></div>";accounting.appendChild(card)}
    const rl=card?.querySelector(".table-wrap");if(rl)rl.innerHTML=refunds.length?`<table><thead><tr><th>Date</th><th>Refund</th><th>Invoice</th><th>Customer</th><th>Amount</th><th>Status</th></tr></thead><tbody>${refunds.map(r=>`<tr><td>${esc(strictDateTime(r.date||r.updatedAt))}</td><td>${esc(r.refundNumber||"")}</td><td>${esc(r.invoiceNumber||"")}</td><td>${esc(r.customer||"")}</td><td>${money(r.refundAmount)}</td><td>Paid</td></tr>`).join("")}</tbody></table>`:`<div class='empty'>No refunds recorded.</div>`;
    renderStaffAccountingCard();const sl=document.querySelector("#staffAccountingList .table-wrap");const staffVisible=[...businessExpenses.filter(e=>/staff|salary|wage/i.test(String(e.category||"")+" "+String(e.description||""))),...staffExpenses];
    if(sl)sl.innerHTML=staffVisible.length?`<table><thead><tr><th>Date</th><th>Staff ID</th><th>Staff Name</th><th>Description</th><th>Amount</th></tr></thead><tbody>${staffVisible.map(e=>`<tr><td>${esc(strictDate(e.date||e.savedAt))}</td><td>${esc(e.staffId||"")}</td><td>${esc(e.staffName||"")}</td><td>${esc(e.description||"")}</td><td>${money(e.amount)}</td></tr>`).join("")}</tbody></table>`:`<div class='empty'>No staff / HR expenses recorded.</div>`;
    const expList=document.getElementById("accountingExpenseList");if(expList)expList.innerHTML=expenses.length?`<table><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th>Actions</th></tr></thead><tbody>${expenses.map(e=>`<tr><td>${esc(strictDate(e.date||e.savedAt))}</td><td>${esc(e.category||"")}</td><td>${esc(e.description||"")}</td><td>${money(e.amount)}</td><td>${e._id&&!String(e._id).startsWith("offline-")?`<button type="button" class="secondary" data-edit-expense="${esc(e._id)}">Edit</button> <button type="button" class="danger" data-delete-expense="${esc(e._id)}">Delete</button>`:""}</td></tr>`).join("")}</tbody></table>`:`<div class='empty'>No business expenses recorded yet.</div>`;
    strictSearchDedup();strictDateInputs();
  }catch(e){console.warn("Strict accounting load failed",e);}
}

function strictStaffPayButton(){
  document.querySelectorAll("[data-staff-pay]").forEach(b=>{
    if(b.dataset.strictPayBound)return;b.dataset.strictPayBound="1";
    b.onclick=async()=>{
      const rows=await staffRecords(),r=rows.find(x=>x._key===b.dataset.staffPay);if(!r)return;
      const amount=Number(r.salary||0)+Number(r.bonus||0);if(amount<=0){msg("Enter a salary or bonus amount on this staff record first.","error");return}
      const f=document.getElementById("accountingExpenseForm");if(!f)return;
      document.getElementById("accountingExpenseId").value="";document.getElementById("accountingExpenseDate").value=new Date().toISOString().slice(0,10);document.getElementById("accountingExpenseCategory").value="Staff / HR";document.getElementById("accountingExpenseAmount").value=amount.toFixed(2);document.getElementById("accountingExpenseDescription").value=`Salary / bonus — ${r.name||"Staff"} (${r.staffId||""})`;document.querySelector('.sidebar button[data-section="accounting"]')?.click();
    };
  });
}

function strictRoleOptions(){
  const role=document.getElementById("userAccessRole");if(role&&!role.querySelector('option[value="front_desk"]'))role.insertAdjacentHTML("beforeend",`<option value="front_desk">Front Desk</option><option value="customer_service">Customer Service</option><option value="accounting">Accounting</option><option value="hr">HR</option>`);
  const roles={front_desk:["dashboard","orders","checkout","collectionForms"],customer_service:["dashboard","orders","orderTracking","usersInvoice","collectionForms","testimonials"],accounting:["dashboard","invoice","usersInvoice","manualInvoice","accounting","refund","orderStatusUpdates"],hr:["dashboard","staffHR","auditLog","accounting"]};
  const old=window.accessDefaultSections;if(typeof old==="function"&&!old.__strictRole){const fn=function(role){return roles[role]||old(role)};fn.__strictRole=true;window.accessDefaultSections=fn;}
  const accessSection=window.ADMIN_ACCESS_SECTIONS;if(Array.isArray(accessSection)&&!accessSection.some(x=>x[0]==="staffHR"))accessSection.push(["staffHR","Staff / HR"]);
}

function strictDeleteAudit(){
  if(document.documentElement.dataset.strictDeleteAudit)return;document.documentElement.dataset.strictDeleteAudit="1";
  document.addEventListener("click",async e=>{
    const b=e.target.closest("button,a");if(!b)return;
    const text=String(b.textContent||"").trim().toLowerCase(),ds=b.dataset||{};
    const isDelete=/delete|remove/i.test(text)||Object.keys(ds).some(k=>/delete/i.test(k));if(!isDelete)return;
    try{await audit("admin_record",ds.deleteSavedRecord||ds.deleteExpense||ds.deleteUserAccess||ds.deleteTraining||ds.deleteProduct||ds.deleteService||ds.deleteContent||ds.deleteGallery||ds.refundDelete||b.id||text,"delete_initiated",{button:text,dataset:{...ds},at:new Date().toISOString()});}catch(_){}
  },true);
}

function strictInvoiceReceiptAttachments(){
  const add=(modalId,stateKey,inputId,label)=>{
    const modal=document.getElementById(modalId),state=window[stateKey];if(!modal||!state)return;
    if(modal.querySelector(`[data-strict-attachment="${inputId}"]`)|| (modalId==="invoiceGeneratorModal" && modal.querySelector(".final-invoice-attachments")))return;
    const editor=modal.querySelector(".invoice-generator-editor");if(!editor)return;
    const wrap=document.createElement("div");wrap.className="form-group final-invoice-attachments";wrap.dataset.strictAttachment=inputId;wrap.innerHTML=`<label>${label}</label><input id="${inputId}" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple><small>Optional customer/order reference images. Maximum 5 MB each.</small><div class="final-attachment-list"></div>`;editor.prepend(wrap);
    const input=wrap.querySelector("input"),list=wrap.querySelector(".final-attachment-list");state.attachments=Array.isArray(state.attachments)?state.attachments:[];
    list.innerHTML=state.attachments.map(a=>`<span class="final-attachment-chip">${esc(a.name||"Image")}</span>`).join("");
    input.onchange=async()=>{const d=db();if(!d){msg("Supabase is unavailable; the image could not be attached.","error");return}for(const file of Array.from(input.files||[])){if(file.size>5*1024*1024){msg("Each image must be 5 MB or smaller.","error");continue}try{const path=`invoice-attachments/${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;const up=await d.storage.from("quote-uploads").upload(path,file,{upsert:false,contentType:file.type});if(up.error)throw up.error;const pub=d.storage.from("quote-uploads").getPublicUrl(path);state.attachments.push({name:file.name,path,url:pub?.data?.publicUrl||""});}catch(err){msg("Image upload failed: "+err.message,"error")}}input.value="";list.innerHTML=state.attachments.map(a=>`<span class="final-attachment-chip">${esc(a.name||"Image")}</span>`).join("");if(state.renderReceipt)state.renderReceipt();if(state.renderInvoice)state.renderInvoice()};
  };
  add("invoiceGeneratorModal","_aprilsCurrentInvoice","strictInvoiceAttachments","Attach Images to Invoice");
  add("receiptGeneratorModal","_aprilsCurrentReceipt","strictReceiptAttachments","Attach Images to Receipt");
}

function strictReceiptSaveWithAttachments(){
  const state=window._aprilsCurrentReceipt;if(!state||state.__strictAttachSave)return;state.__strictAttachSave=true;
  const oldSave=window.saveReceiptRecordDraft;
  if(typeof oldSave==="function"&&!oldSave.__strict){const fn=async()=>{const result=await oldSave();try{const number=document.getElementById("generatedReceiptNumber")?.value;if(number&&state.attachments?.length){const d=db();const row=await d.from("settings").select("id,setting_value").eq("setting_key","receipt_record_"+slug(number)).maybeSingle();if(!row.error&&row.data){let rec={};try{rec=JSON.parse(row.data.setting_value||"{}")}catch(_){}rec.attachments=state.attachments;await d.from("settings").update({setting_value:JSON.stringify(rec),updated_at:new Date().toISOString()}).eq("id",row.data.id)}}}catch(_){}return result};fn.__strict=true;window.saveReceiptRecordDraft=fn;}
}

function strictCollectionOverride(){
  const btn=document.getElementById("collectionGenerate"),share=document.getElementById("collectionShare"),wa=document.getElementById("collectionWhatsApp");
  if(!btn||btn.dataset.strictCollection)return;
  [btn,share,wa].filter(Boolean).forEach(b=>{b.dataset.strictCollection="1";b.addEventListener("click",async e=>{e.preventDefault();e.stopImmediatePropagation();await strictGenerateCollection(b===share||b===wa,b===wa)},true)});
}
async function strictGenerateCollection(share,whatsapp){
  const inv=(window._aprilsCollectionInvoices||[]).find(i=>String(i.invoiceNumber)===String(document.getElementById("collectionInvoiceSelect")?.value||""));if(!inv){msg("Select a saved invoice first.","error");return}
  const date=document.getElementById("collectionDate")?.value||"",time=document.getElementById("collectionTime")?.value||"",location=document.getElementById("collectionLocation")?.value.trim()||"";if(!date||!time||!location){msg("Enter the collection / delivery date, time and location.","error");return}
  const pays=await (typeof window.getInvoicePayments==="function"?window.getInvoicePayments(inv.invoiceNumber):Promise.resolve([])),paid=pays.reduce((a,p)=>a+Number(p.amount||0),0),balance=Math.max(0,Number(inv.total||0)-paid),entryId="COL-"+Date.now().toString(36).toUpperCase();
  let root=null;
  try{
    let rec={...inv,deliveryDate:date,deliveryTime:time,deliveryLocation:location,updatedAt:new Date().toISOString()};
    if(inv.sourceId){try{const d=db();const q=await d.from("quote_requests").select("journey").eq("id",inv.sourceId).maybeSingle();if(!q.error){let j={};try{j=JSON.parse(q.data?.journey||"{}")}catch(_){}j.deliveryDate=date;j.deliveryTime=time;j.deliveryLocation=location;await d.from("quote_requests").update({journey:JSON.stringify(j)}).eq("id",inv.sourceId);rec.journey=j}}catch(_){}
    }
    if(typeof window.safeSettingUpsert==="function")await window.safeSettingUpsert("invoice_record_"+slug(inv.invoiceNumber),JSON.stringify(rec));
    root=document.createElement("div");root.className="final-collection-paper";root.innerHTML=`<div class="collection-brand"><div><h1>Aprils Signature</h1><p>Elegance in Every Stitch</p></div><div class="collection-title"><strong>COLLECTION / DELIVERY FORM</strong><span>${esc(inv.invoiceNumber||"")}</span></div></div><div class="collection-customer"><p><strong>Customer:</strong> ${esc(inv.customer||"")}</p><p><strong>Phone:</strong> ${esc(inv.phone||"")}</p></div><table><thead><tr><th>No.</th><th>Item / Description</th><th>Details</th><th>Quantity</th><th>Unit Price</th><th>Total</th></tr></thead><tbody>${(inv.lines||[]).map((l,i)=>`<tr><td>${i+1}</td><td>${esc(l.description||"")}</td><td>${esc(l.details||"")}</td><td>${Number(l.quantity||1)}</td><td>${money(l.unitPrice)}</td><td>${money(Number(l.quantity||1)*Number(l.unitPrice||0))}</td></tr>`).join("")}</tbody></table><div class="collection-summary"><p><strong>Total Cost:</strong> ${money(inv.total)}</p><p><strong>Payment Made:</strong> ${money(paid)}</p><p><strong>Balance:</strong> ${money(balance)}</p></div><div class="collection-details"><h3>Collection / Delivery Details</h3><p><strong>Date:</strong> ${esc(strictDate(date))}</p><p><strong>Time:</strong> ${esc(time)} GMT</p><p><strong>Location:</strong> ${esc(location)}</p></div><p class="collection-id">Form ID: ${esc(entryId)}</p>`;
    document.body.appendChild(root);const h=await (typeof window.ensureHtml2Pdf==="function"?window.ensureHtml2Pdf():Promise.resolve(window.html2pdf));if(!h)throw new Error("PDF service unavailable. Refresh the admin page and try again.");await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const blob=await window.pdfFromVisibleElement(root,{margin:0,filename:`Aprils-Signature-Collection-${inv.invoiceNumber}.pdf`,image:{type:"jpeg",quality:.98},html2canvas:{scale:2,useCORS:true,backgroundColor:"#fff"},jsPDF:{unit:"in",format:"a4",orientation:"portrait"}});if(!blob||blob.size<5000)throw new Error("The generated PDF was empty or incomplete.");const file=new File([blob],`Aprils-Signature-Collection-${inv.invoiceNumber}.pdf`,{type:"application/pdf"});
    if(whatsapp){const n=typeof window.normalizeWhatsAppNumber==="function"?window.normalizeWhatsAppNumber(inv.phone):String(inv.phone||"").replace(/\D/g,"");const url=n?`https://wa.me/${n}`:"https://wa.me/";const w=window.open(url,"_blank","noopener,noreferrer");if(!w)location.href=url;const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=file.name;a.click();msg("WhatsApp opened directly. The generated PDF has been downloaded for attachment.","success");}
    else if(share&&navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]})))await navigator.share({title:"Aprils Signature Collection / Delivery Form",text:"Aprils Signature collection / delivery form",files:[file]});
    else {const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=file.name;a.click();msg("Collection / delivery PDF generated successfully.","success")}
    await audit("collection_delivery_form",entryId,"generated",{invoiceNumber:inv.invoiceNumber,customer:inv.customer,date,time,location});
  }catch(e){console.error(e);msg("The collection / delivery PDF could not be generated: "+e.message,"error")}finally{root?.remove()}
}

function strictTrainingPublicPrices(){
  if(!document.body.classList.contains("training-page"))return;
  const run=async()=>{
    try{
      const d=await (typeof window.waitForSupabase==="function"?window.waitForSupabase():Promise.resolve(null));if(!d)return;
      const [tr,pr]=await Promise.all([d.from("training_programs").select("title,category,description,active,display_order"),d.from("settings").select("setting_value").like("setting_key","public_training_price_%")]);
      if(tr.error)return;
      const rows=(tr.data||[]).filter(x=>x.active!==false&&x.title),prices=(pr.data||[]).map(x=>{try{return JSON.parse(x.setting_value||"{}")}catch(_){return null}}).filter(Boolean);
      const norm=x=>String(x||"").toLowerCase().replace(/[’']/g,"'").replace(/[^a-z0-9]+/g," ").trim();
      const price=x=>prices.find(p=>norm(p.name)===norm(x))?.price;
      const nodes=[...document.querySelectorAll(".training-category li,.training-category h4,.training-section ul li,.training-section h4")],used=new Set();
      nodes.forEach(n=>{const clean=n.textContent.trim().replace(/\s+—\s+GHS\s+[\d,.]+$/i,"");const m=rows.find(r=>norm(r.title)===norm(clean));if(m){used.add(m.title);const p=price(m.title);n.textContent=m.title+(p!==undefined?` — GHS ${Number(p).toFixed(2)}`:"")}});
      document.querySelectorAll(".training-category").forEach(cat=>{const title=norm(cat.querySelector("h3")?.textContent);rows.filter(r=>norm(r.category)===title).forEach(r=>{if(used.has(r.title))return;const ul=cat.querySelector("ul")||(()=>{const u=document.createElement("ul");cat.appendChild(u);return u})();const li=document.createElement("li");const p=price(r.title);li.textContent=r.title+(p!==undefined?` — GHS ${Number(p).toFixed(2)}`:"");ul.appendChild(li);used.add(r.title)})});
      const extras=rows.filter(r=>!used.has(r.title));
      if(extras.length){
        let sec=document.getElementById("managedTrainingClasses");
        if(!sec){sec=document.createElement("section");sec.id="managedTrainingClasses";sec.className="training-section";sec.innerHTML='<div class="container"><h2>Additional Training Classes</h2><div class="training-category-list"></div></div>';document.querySelector("main")?.appendChild(sec)}
        const box=sec.querySelector(".training-category-list"),groups=new Map();
        extras.forEach(r=>{const k=r.category||"Other Classes";if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r)});
        box.innerHTML=[...groups.entries()].map(([k,arr])=>`<div class="training-category"><h3>${esc(k)}</h3><ul>${arr.sort((a,b)=>Number(a.display_order||9999)-Number(b.display_order||9999)).map(r=>{const p=price(r.title);return `<li>${esc(r.title)}${p!==undefined?` — GHS ${Number(p).toFixed(2)}`:""}</li>`}).join("")}</ul></div>`).join("");
      }
    }catch(e){console.warn("Strict training price sync failed",e)}
  };
  run();
}
function strictPublicCatalogue(){
  if(!document.body.classList.contains("services-page"))return;
  const run=async()=>{
    try{
      const d=await (typeof window.waitForSupabase==="function"?window.waitForSupabase():Promise.resolve(null));if(!d)return;
      const r=await d.from("settings").select("setting_value").like("setting_key","product_%");if(r.error)return;
      const products=(r.data||[]).map(x=>{try{return JSON.parse(x.setting_value||"{}")}catch(_){return null}}).filter(x=>x&&x.name&&x.active!==false);
      let sec=document.getElementById("managedProductCatalogue");
      if(!sec){sec=document.createElement("section");sec.id="managedProductCatalogue";sec.className="service-section";sec.innerHTML='<div class="container"><h2>Product Catalogue</h2><div class="services-grid" id="managedProductGrid"></div></div>';document.querySelector("main")?.appendChild(sec)}
      const grid=sec.querySelector("#managedProductGrid"),groups=new Map();products.forEach(p=>{const k=p.category||"Products / Services";if(!groups.has(k))groups.set(k,[]);groups.get(k).push(p)});
      if(grid)grid.innerHTML=[...groups.entries()].map(([k,arr])=>`<article class="service-card"><h3>${esc(k)}</h3>${arr.sort((a,b)=>Number(a.display_order||9999)-Number(b.display_order||9999)).map(p=>`<div class="managed-product"><strong>${esc(p.name)}</strong>${p.public_price!==null&&p.public_price!==undefined&&p.public_price!==""?`<p class="service-public-price">Price: GHS ${Number(p.public_price).toFixed(2)}</p>`:""}${p.subcategory?`<small>${esc(p.subcategory)}</small>`:""}${p.notes?`<p>${esc(p.notes)}</p>`:""}</div>`).join("")}</article>`).join("");
    }catch(e){console.warn("Strict public product catalogue sync failed",e)}
  };
  run();
}
function strictReceiptPdfAttachments(){
  if(typeof window.generateReceiptPdf!=="function"||window.generateReceiptPdf.__strictAttachments)return;
  const old=window.generateReceiptPdf;const fn=async function(share){const state=window._aprilsCurrentReceipt,paper=document.getElementById("receiptPaper");let gallery=null;try{if(paper&&state?.attachments?.length){gallery=document.createElement("div");gallery.className="final-invoice-attachment-gallery";gallery.innerHTML=`<h3>Attached Images</h3><div>${state.attachments.map(a=>a.url?`<img src="${esc(a.url)}" alt="${esc(a.name||"Attached image")}">`:`<p>${esc(a.name||"Attached image")}</p>`).join("")}</div>`;paper.appendChild(gallery);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))}return await old(share)}finally{gallery?.remove()}};fn.__strictAttachments=true;window.generateReceiptPdf=fn;
}

function strictSavedReceiptOpen(){
  if(typeof window.openSavedReceiptRecord!=="function"||window.openSavedReceiptRecord.__strictSaved)return;
  const old=window.openSavedReceiptRecord;const fn=async function(row){await old(row);const st=window._aprilsCurrentReceipt;if(st){st.attachments=Array.isArray(row?.attachments)?row.attachments:[]}};fn.__strictSaved=true;window.openSavedReceiptRecord=fn;
}

function strictGlobalSync(){
  strictRoleOptions();strictDeleteAudit();strictDateInputs();strictSearchDedup();strictInvoiceReceiptAttachments();strictReceiptSaveWithAttachments();strictReceiptPdfAttachments();strictSavedReceiptOpen();strictStaffPayButton();strictCollectionOverride();strictTrainingPublicPrices();strictPublicCatalogue();
}

/* ---------- Boot ---------- */
function boot(){
  addV2Css();
  addStaffSection();
  strictGlobalSync();
  if(window._aprilsAdminUser && typeof window.applyCurrentUserAccess==="function")window.applyCurrentUserAccess(window._aprilsAdminUser);
  enhanceRefundForm();
  setTimeout(()=>enhanceStatusUpdates(),700);
  if(typeof window.loadTrainees==="function" && !window.loadTrainees.__v2){window.loadTrainees=loadTraineesEnhanced;window.loadTrainees.__v2=true;}
  patchAccounting();
  setTimeout(()=>setupAccountingPeriod(),500);
  addTopArrows();
  enhanceAllSearches();
  document.querySelectorAll('.sidebar button[data-section="refund"]').forEach(b=>b.addEventListener("click",()=>setTimeout(()=>renderRefundList(),250)));
  // Refunds are rendered when their section is opened; do not load staff/refund data
  // in the background during dashboard startup.
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();

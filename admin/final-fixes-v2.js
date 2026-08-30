/* =========================================================
   APRILS SIGNATURE — STRICT CORRECTIONS V2
   Completes the supplied correction brief without replacing the
   existing Supabase structure.
========================================================= */
(function(){
"use strict";

const esc=window.escapeHTML||((v)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c])));
const db=()=>window.aprilsSupabase||window.AprilsSupabase||null;
const getRows=()=>typeof window.getRows==="function"?window.getRows("settings"):Promise.resolve([]);
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
          <div class="form-group"><label>Full Name *</label><input id="staffHRName" required></div>
          <div class="form-group"><label>Email</label><input id="staffHREmail" type="email"></div>
          <div class="form-group"><label>Phone</label><input id="staffHRPhone" type="tel"></div>
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
    list.innerHTML=rows.length?`<table><thead><tr><th>Staff ID</th><th>Name</th><th>Position</th><th>Phone</th><th>Status</th><th>Salary</th><th>Bonus</th><th>Actions</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.staffId||"")}</td><td>${esc(r.name||"")}</td><td>${esc(r.position||"")}</td><td>${esc(r.phone||"")}</td><td>${esc(r.employment||"")}</td><td>${money(r.salary)}</td><td>${money(r.bonus)}</td><td><button class="secondary" type="button" data-staff-edit="${esc(r._key)}">Edit</button> <button class="secondary" type="button" data-staff-pay="${esc(r._key)}">Record Salary / Bonus Expense</button> <button class="danger" type="button" data-staff-delete="${esc(r._id)}" data-staff-key="${esc(r._key)}">Delete</button></td></tr>`).join("")}</tbody></table>`:`<div class="empty">No staff records have been added yet.</div>`;
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
  const map={staffHRId:r._id,staffHRStaffId:r.staffId,staffHRStaffIdDisplay:r.staffId,staffHRName:r.name,staffHREmail:r.email,staffHRPhone:r.phone,staffHRPosition:r.position,staffHREmployment:r.employment||"Active",staffHRStartDate:r.startDate,staffHRAddress:r.address,staffHREmergencyName:r.emergencyName,staffHREmergencyPhone:r.emergencyPhone,staffHREducation:r.education,staffHREducationBackground:r.educationBackground,staffHRSkills:r.skills,staffHRSalary:r.salary,staffHRBonus:r.bonus,staffHRPayNotes:r.payNotes,staffHRNotes:r.notes};
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
    const payload={staffId,name:document.getElementById("staffHRName").value.trim(),email:document.getElementById("staffHREmail").value.trim(),phone:document.getElementById("staffHRPhone").value.trim(),position:document.getElementById("staffHRPosition").value.trim(),employment:document.getElementById("staffHREmployment").value,startDate:document.getElementById("staffHRStartDate").value,address:document.getElementById("staffHRAddress").value.trim(),emergencyName:document.getElementById("staffHREmergencyName").value.trim(),emergencyPhone:document.getElementById("staffHREmergencyPhone").value.trim(),education:document.getElementById("staffHREducation").value.trim(),educationBackground:document.getElementById("staffHREducationBackground").value.trim(),skills:document.getElementById("staffHRSkills").value.trim(),salary:Number(document.getElementById("staffHRSalary").value||0),bonus:Number(document.getElementById("staffHRBonus").value||0),payNotes:document.getElementById("staffHRPayNotes").value.trim(),notes:document.getElementById("staffHRNotes").value.trim(),updatedAt:new Date().toISOString()};
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
      const expEl=document.getElementById("accountingExpenses"),netEl=document.getElementById("accountingNetCash");
      const currentExp=Number(String(expEl?.textContent||"").replace(/[^\d.-]/g,""))||0;
      const currentNet=Number(String(netEl?.textContent||"").replace(/[^\d.-]/g,""))||0;
      if(expEl)expEl.textContent=money(currentExp+staffTotal);
      if(netEl)netEl.textContent=money(currentNet-staffTotal);
      const accounting=document.getElementById("accounting");
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
    const [tr,settings]=await Promise.all([d.from("training_registrations").select("*").order("created_at",{ascending:false}),settingsRows()]);
    if(tr.error)throw tr.error;
    const rows=tr.data||[], sm=new Map();
    settings.filter(r=>String(r.setting_key||"").startsWith("training_status_")).forEach(r=>sm.set(String(r.setting_key).replace("training_status_",""),String(r.setting_value||"under_review")));
    const inv=settings.filter(r=>String(r.setting_key||"").startsWith("invoice_record_")).map(r=>{try{return JSON.parse(r.setting_value||"{}")}catch(_){return null}}).filter(Boolean);
    const pay=settings.filter(r=>String(r.setting_key||"").startsWith("invoice_payment_record_")).map(r=>{try{return JSON.parse(r.setting_value||"{}")}catch(_){return null}}).filter(Boolean);
    const records=rows.map(row=>{
      const invoice=inv.filter(x=>String(x.sourceId||"")===String(row.id)||normal(x.customer)===normal(row.full_name)).sort((a,b)=>String(b.savedAt||"").localeCompare(String(a.savedAt||"")))[0];
      const paid=pay.filter(p=>String(p.invoiceNumber||"")===String(invoice?.invoiceNumber||"")).reduce((a,p)=>a+Number(p.amount||0),0);
      const total=Number(invoice?.total||0), balance=Math.max(0,total-paid);
      let status=sm.get(String(row.id))||"under_review";
      if(!sm.has(String(row.id))){if(total>0&&balance<=0)status="fully_paid";else if(paid>0)status="part_paid";else if(invoice)status="invoice_generated";}
      return {row,invoice,paid,total,balance,status};
    });
    const tabs=TRAINING_STATUSES;
    const tabButtons=`<div class="final-tracking-tabs">${tabs.map(([k,l])=>`<button type="button" class="final-status-tab" data-trainee-tab="${k}">${esc(l)} <span>${records.filter(x=>x.status===k).length}</span></button>`).join("")}</div>`;
    const card=x=>`<article class="tracking-order-card trainee-enhanced-card" data-trainee-status="${esc(x.status)}"><div class="tracking-card-head"><div><strong>${esc(x.row.full_name||"Trainee")}</strong><small>${esc(x.row.course||"Training")}</small></div><time>${esc(gmtDate(x.row.created_at))}</time></div><div class="tracking-card-data"><span><b>Phone</b>${esc(x.row.phone||"—")}</span><span><b>Invoice</b>${esc(x.invoice?.invoiceNumber||"—")}</span><span><b>Paid</b>${money(x.paid)}</span><span><b>Balance</b>${money(x.balance)}</span></div><div class="tracking-card-status"><select class="admin-status-select" data-trainee-status-id="${esc(x.row.id)}">${TRAINING_STATUSES.map(([k,l])=>`<option value="${k}" ${k===x.status?"selected":""}>${esc(l)}</option>`).join("")}</select><button type="button" class="secondary" data-trainee-save="${esc(x.row.id)}">Save</button></div><button type="button" class="secondary" data-view-trainee="${esc(x.row.id)}">View Full Details</button></article>`;
    list.innerHTML=tabButtons+`<div class="tracking-board trainee-board">${tabs.map(([k,l])=>`<section class="tracking-column" data-trainee-column="${k}"><header><h3>${esc(l)}</h3><strong>${records.filter(x=>x.status===k).length}</strong></header><div class="tracking-column-body">${records.filter(x=>x.status===k).map(card).join("")||`<div class="tracking-empty">No trainees</div>`}</div></section>`).join("")}</div>`;
    const filter=k=>{list.querySelectorAll("[data-trainee-column]").forEach(c=>c.style.display=(k==="all"||c.dataset.traineeColumn===k)?"":"none");list.querySelectorAll(".final-status-tab").forEach(b=>b.classList.toggle("active",b.dataset.traineeTab===k));};
    list.querySelectorAll("[data-trainee-tab]").forEach(b=>b.onclick=()=>filter(b.dataset.traineeTab));filter("under_review");
    list.querySelectorAll("[data-trainee-save]").forEach(b=>b.onclick=async()=>{const sel=b.parentElement.querySelector("select");try{if(typeof window.setAdminRecordStatus==="function")await window.setAdminRecordStatus("training_status",b.dataset.traineeSave,sel.value);else await saveSetting("training_status_"+b.dataset.traineeSave,sel.value);await audit("training_registration",b.dataset.traineeSave,"status_updated",{status:sel.value});msg("Trainee status updated.");await loadTraineesEnhanced()}catch(e){msg("Trainee status could not be updated: "+e.message,"error")}});
    list.querySelectorAll("[data-view-trainee]").forEach(b=>b.onclick=()=>{const x=records.find(v=>String(v.row.id)===String(b.dataset.viewTrainee));if(x&&typeof window.aprilsShowSubmissionDetails==="function")window.aprilsShowSubmissionDetails("Trainee Details",x.row,x.row.message||x.row.request_details||x.row.details||"");});
  }catch(e){list.innerHTML=`<div class="empty">Trainees could not be loaded: ${esc(e.message||"")}</div>`}
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
    let box=wrap.previousElementSibling;
    if(!box?.classList.contains("admin-table-search")){
      box=document.createElement("div");box.className="admin-table-search";wrap.parentNode.insertBefore(box,wrap);
    }
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

/* ---------- Boot ---------- */
function boot(){
  addV2Css();
  addStaffSection();
  enhanceRefundForm();
  setTimeout(()=>enhanceStatusUpdates(),700);
  if(typeof window.loadTrainees==="function" && !window.loadTrainees.__v2){window.loadTrainees=loadTraineesEnhanced;window.loadTrainees.__v2=true;}
  patchAccounting();
  setTimeout(()=>setupAccountingPeriod(),500);
  addTopArrows();
  enhanceAllSearches();
  setInterval(()=>{enhanceAllSearches();refreshSavedSearchOptions();addTopArrows();patchAdminDateStrings()},1500);
  document.querySelectorAll('.sidebar button[data-section="refund"]').forEach(b=>b.addEventListener("click",()=>setTimeout(()=>renderRefundList(),250)));
  // Re-render refund list after the existing final-fixes boot has created its section.
  setTimeout(async()=>{try{enhanceRefundForm();await renderRefundList()}catch(_){}try{if(document.getElementById("staffHR"))await loadStaff()}catch(_){}},1200);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();

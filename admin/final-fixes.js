"use strict";

/*
=========================================================
APRILS SIGNATURE — FINAL CORRECTION / INTEGRATION PASS
Built only from the supplied website package and correction
instructions. This file coordinates the existing modules without
replacing the existing Supabase structure.
=========================================================
*/
(function(){
    const STATUS_ORDER = [
        ["under_review","New Customer — Under Review"],
        ["order_taken","Confirmed / Order Taken"],
        ["in_production","In Production"],
        ["completed","Completed"],
        ["ready","Ready for Collection / Delivery"],
        ["dispatched","Dispatched"],
        ["received","Received by Customer"],
        ["cancelled","Order Cancelled"]
    ];
    const PAYMENT_STATUS = [
        ["unpaid","Unpaid"],
        ["deposit_paid","Deposit Paid"],
        ["part_paid","Part Paid"],
        ["paid_in_full","Paid in Full"],
        ["refunded","Refunded"],
        ["partially_refunded","Partially Refunded"]
    ];

    const esc = window.escapeHTML || (v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c])));
    const supabase = ()=>window.aprilsSupabase || window.AprilsSupabase || null;

    function money(v){ return `GHS ${Number(v||0).toFixed(2)}`; }
    function formatDate(value){
        if(!value) return "—";
        const raw=String(value).trim();
        if(/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;
        const d=new Date(raw);
        if(Number.isNaN(d.getTime())){
            const m=raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
            return m ? `${m[3]}/${m[2]}/${m[1]}` : raw;
        }
        return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
    }
    function formatDateTime(value){
        if(!value) return "—";
        const d=new Date(value);
        if(Number.isNaN(d.getTime())) return String(value);
        return `${formatDate(d)} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
    }
    function normal(s){return String(s||"").trim().toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();}
    function getRowsSafe(table){
        return typeof window.getRows==="function" ? window.getRows(table) : Promise.resolve([]);
    }
    async function settingValue(key){
        const rows=await getRowsSafe("settings");
        const r=rows.find(x=>String(x.setting_key||"")===key);
        return r?.setting_value||"";
    }
    async function upsertSetting(key,value){
        if(typeof window.safeSettingUpsert==="function") return window.safeSettingUpsert(key,value);
        const d=supabase(); if(!d) throw new Error("Supabase is unavailable.");
        const now=new Date().toISOString();
        const old=await d.from("settings").select("id").eq("setting_key",key).limit(1);
        if(old.error) throw old.error;
        if(old.data?.length) return d.from("settings").update({setting_value:value,updated_at:now}).eq("id",old.data[0].id);
        return d.from("settings").insert({setting_key:key,setting_value:value,updated_at:now});
    }
    async function paymentRows(invoiceNumber){
        if(typeof window.getInvoicePayments==="function") return window.getInvoicePayments(invoiceNumber);
        const rows=await getRowsSafe("settings");
        return rows.filter(r=>String(r.setting_key||"").startsWith("invoice_payment_record_")).map(r=>{
            try{return JSON.parse(r.setting_value||"{}")}catch(_){return null}
        }).filter(x=>x&&String(x.invoiceNumber||"")===String(invoiceNumber||""));
    }
    function paymentState(total,paid,refund=0){
        const net=Math.max(0,Number(paid||0)-Number(refund||0));
        const t=Number(total||0);
        if(net<=0) return "unpaid";
        if(t>0 && net>=t) return "paid_in_full";
        if(t>0 && net>=t*.75) return "deposit_paid";
        return "part_paid";
    }

    /* ---------------- PUBLIC FORM: robust submission ---------------- */
    function improveQuoteSubmission(){
        const form=document.getElementById("quoteForm");
        if(!form || form.dataset.finalSubmissionBound) return;
        form.dataset.finalSubmissionBound="1";
        // The original handler remains responsible for the full payload.
        // This guard only prevents accidental double-click submissions.
        form.addEventListener("click",e=>{
            const b=e.target.closest("#quoteSubmitButton");
            if(b && b.dataset.submitting==="1") e.preventDefault();
        },true);
    }

    /* ---------------- SEARCH ACROSS EVERY ADMIN TABLE ---------------- */
    function attachSearchBoxes(){
        document.querySelectorAll(".section .table-wrap").forEach(wrap=>{
            if(wrap.dataset.searchReady==="1") return;
            wrap.dataset.searchReady="1";
            const box=document.createElement("div");
            box.className="admin-table-search";
            box.innerHTML=`<input type="search" aria-label="Search this section" placeholder="Search by customer, invoice, item, product, name or number…">`;
            wrap.parentNode.insertBefore(box,wrap);
            const input=box.querySelector("input");
            input.addEventListener("input",()=>{
                const term=normal(input.value);
                const rows=wrap.querySelectorAll("tbody tr");
                if(rows.length){
                    rows.forEach(row=>row.style.display=!term||normal(row.textContent).includes(term)?"":"none");
                }else{
                    wrap.querySelectorAll(".submission-card,.tracking-table-row,.tracking-board-card").forEach(card=>{
                        card.style.display=!term||normal(card.textContent).includes(term)?"":"none";
                    });
                }
            });
        });
    }

    /* ---------------- STATUS / PAYMENT HELPERS ---------------- */
    async function setStatus(prefix,id,status){
        if(typeof window.setAdminRecordStatus==="function") return window.setAdminRecordStatus(prefix,id,status);
        return upsertSetting(`${prefix}_${id}`,status);
    }
    async function getStatus(prefix,id){
        if(typeof window.getAdminRecordStatus==="function") return window.getAdminRecordStatus(prefix,id);
        return settingValue(`${prefix}_${id}`);
    }
    function statusSelect(id,current){
        return `<select class="final-status-select" data-id="${esc(id)}">${STATUS_ORDER.map(([k,l])=>`<option value="${k}" ${k===current?"selected":""}>${esc(l)}</option>`).join("")}</select>`;
    }
    function paymentSelect(id,current){
        return `<select class="final-payment-select" data-id="${esc(id)}">${PAYMENT_STATUS.map(([k,l])=>`<option value="${k}" ${k===current?"selected":""}>${esc(l)}</option>`).join("")}</select>`;
    }
    function rowDetails(row){
        let j={};
        try{j=JSON.parse(row.journey||"{}")}catch(_){}
        return j;
    }
    function itemLines(row){
        const j=row.j||rowDetails(row);
        if(Array.isArray(j.items) && j.items.length) return j.items.map(i=>({
            description:i.name||i.product||i.description||"Item",
            details:i.details||i.description||"",
            quantity:Number(i.quantity||1),
            unitPrice:Number(i.unitPrice||i.price||0)
        }));
        const d=row.j||rowDetails(row);
        const out=[];
        if(d.streetwear && typeof d.streetwear==="object") Object.values(d.streetwear).forEach(i=>{
            if(!i||!i.product) return;
            out.push({description:i.product,details:[i.size,i.measurements,i.colour,i.details].filter(Boolean).join(" • "),quantity:Number(i.quantity||1),unitPrice:Number(i.unitPrice||0)});
        });
        if(d.ladiesWearProducts && typeof d.ladiesWearProducts==="object") Object.values(d.ladiesWearProducts).forEach(i=>{
            if(!i||!i.product)return;
            out.push({description:i.product,details:[i.size,i.measurements,i.colour,i.details].filter(Boolean).join(" • "),quantity:Number(i.quantity||1),unitPrice:Number(i.unitPrice||0)});
        });
        if(d.kidsWearQuantity || d.kidsWearDetails) out.push({description:"Kids Wear",details:[d.kidsWearAge,d.kidsWearSizeMeasurements,d.kidsWearColour,d.kidsWearDetails].filter(Boolean).join(" • "),quantity:Number(d.kidsWearQuantity||1),unitPrice:0});
        if(d.embellishmentDetails && typeof d.embellishmentDetails==="object"){
            const selected=Array.isArray(d.embellishmentDetails.selected)?d.embellishmentDetails.selected:[];
            selected.forEach(name=>{
                const i=d.embellishmentDetails[name]||{};
                out.push({description:name,details:[i.size,i.measurements,i.colour,i.details].filter(Boolean).join(" • "),quantity:Number(i.quantity||1),unitPrice:Number(i.unitPrice||0)});
            });
        }
        return out;
    }

    /* ---------------- ORDER TRACKING: spreadsheet + horizontal status tabs ---------------- */
    async function loadOrderTrackingFinal(){
        const list=document.getElementById("orderTrackingList"); if(!list)return;
        try{
            const rows=await getRowsSafe("quote_requests");
            const settings=await getRowsSafe("settings");
            const invoices=settings.filter(r=>String(r.setting_key||"").startsWith("invoice_record_")).map(r=>{try{return {...JSON.parse(r.setting_value||"{}"),_settingId:r.id}}catch(_){return null}}).filter(Boolean);
            const allPayments=settings.filter(r=>String(r.setting_key||"").startsWith("invoice_payment_record_")).map(r=>{try{return JSON.parse(r.setting_value||"{}")}catch(_){return null}}).filter(Boolean);
            const refunds=settings.filter(r=>String(r.setting_key||"").startsWith("refund_record_")).map(r=>{try{return JSON.parse(r.setting_value||"{}")}catch(_){return null}}).filter(Boolean);
            const deliveryMap=new Map(settings.filter(r=>String(r.setting_key||"").startsWith("delivery_tracking_")).map(r=>{try{return [String(r.setting_key).replace("delivery_tracking_",""),JSON.parse(r.setting_value||"{}")]}catch(_){return [String(r.setting_key).replace("delivery_tracking_",""),{}]}}));
            const records=[];
            for(const row of rows){
                const j=row.journey?rowDetails(row):{};
                const inv=invoices.filter(x=>String(x.sourceId||"")===String(row.id)||String(x.customer||"").trim().toLowerCase()===String(row.full_name||"").trim().toLowerCase()).sort((a,b)=>String(b.updatedAt||b.savedAt||"").localeCompare(String(a.updatedAt||a.savedAt||"")))[0];
                const invoiceNumber=inv?.invoiceNumber||j.invoiceNumber||"";
                const paid=allPayments.filter(p=>String(p.invoiceNumber||"")===String(invoiceNumber)).reduce((a,p)=>a+Number(p.amount||0),0);
                const refunded=refunds.filter(r=>String(r.invoiceNumber||"")===String(invoiceNumber)).reduce((a,r)=>a+Number(r.refundAmount||0),0);
                const total=Number(inv?.total??j.total??0);
                let status=await getStatus("quote_status",row.id); status=status||j.orderStatus||"under_review";
                const legacy={request_received:"under_review",reviewed:"under_review",invoice_sent:"under_review",payment_received:"order_taken",work_in_progress:"in_production",delivered:"received",fully_paid:"order_taken"};
                status=legacy[status]||status;
                if(refunded>=paid && refunded>0) status="cancelled";
                const payKey=await settingValue("payment_status_quote_"+row.id);
                const payStatus=payKey||paymentState(total,paid,refunded);
                const delivery=deliveryMap.get(String(row.id))||{};
                if(delivery.date)j.deliveryDate=delivery.date;
                if(delivery.time)j.deliveryTime=delivery.time;
                if(delivery.location)j.deliveryLocation=delivery.location;
                const lines=inv?.lines?.length?inv.lines:itemLines({...row,j});
                records.push({row,j,inv,invoiceNumber,total,paid,refunded,status,payStatus,lines});
            }
            const tabs=STATUS_ORDER.map(([key,label])=>{
                const count=records.filter(r=>r.status===key).length;
                return `<button type="button" class="final-status-tab" data-track-tab="${esc(key)}">${esc(label)} <span>${count}</span></button>`;
            }).join("");
            list.innerHTML=`<div class="final-tracking-tabs">${tabs}</div><div class="final-tracking-panel"></div>`;
            const panel=list.querySelector(".final-tracking-panel");
            function render(key){
                const chosen=records.filter(r=>r.status===key);
                panel.innerHTML=chosen.length?`<div class="final-spreadsheet"><table><thead><tr><th>Customer</th><th>Service</th><th>Item / Description</th><th>Details</th><th>Quantity</th><th>Invoice</th><th>Total</th><th>Paid</th><th>Balance</th><th>Payment Status</th><th>Order Status</th><th>Collection / Delivery</th><th>Action</th></tr></thead><tbody>${chosen.map(r=>{
                    let j=r.j||{}; const dueDate=j.deliveryDate||j.collectionDate||"", dueTime=j.deliveryTime||j.collectionTime||"";
                    const service=r.row.service||j.selectedServices?.join(", ")||"Order / Request a Quote";
                    const itemText=r.lines.map(x=>x.description).join(" • ")||"—";
                    const detailText=r.lines.map(x=>x.details).filter(Boolean).join(" • ")||"—";
                    const qty=r.lines.reduce((a,x)=>a+Number(x.quantity||0),0);
                    const bal=Math.max(0,r.total-r.paid+r.refunded);
                    return `<tr><td>${esc(r.row.full_name||"")}</td><td>${esc(service)}</td><td>${esc(itemText)}</td><td>${esc(detailText)}</td><td>${esc(qty)}</td><td>${esc(r.invoiceNumber||"—")}</td><td>${money(r.total)}</td><td>${money(r.paid)}</td><td>${money(bal)}</td><td>${esc(PAYMENT_STATUS.find(x=>x[0]===r.payStatus)?.[1]||r.payStatus)}</td><td>${esc(STATUS_ORDER.find(x=>x[0]===r.status)?.[1]||r.status)}</td><td>${esc(formatDate(dueDate))}${dueTime?" "+esc(dueTime):""}</td><td><button type="button" class="secondary" data-final-view="${esc(r.row.id)}">View Full Details</button><button type="button" class="secondary" data-final-share="${esc(r.row.id)}">Share</button></td></tr>`;
                }).join("")}</tbody></table></div>`:`<div class="empty">No orders are currently in this status.</div>`;
                panel.querySelectorAll("[data-final-view]").forEach(b=>b.onclick=()=>{
                    const r=records.find(x=>String(x.row.id)===String(b.dataset.finalView)); if(!r)return;
                    const j=r.j||{};
                    const details=`Customer: ${r.row.full_name||""}\nPhone: ${r.row.phone||""}\nWhatsApp: ${r.row.whatsapp||""}\nEmail: ${r.row.email||""}\nService: ${r.row.service||j.selectedServices?.join(", ")||""}\nItems: ${r.lines.map(x=>`${x.description} — ${x.details||"No additional details"} — Qty ${x.quantity}`).join("\n")||"—"}\nInvoice: ${r.invoiceNumber||"—"}\nTotal: ${money(r.total)}\nPaid: ${money(r.paid)}\nRefunded: ${money(r.refunded)}\nBalance: ${money(Math.max(0,r.total-r.paid+r.refunded))}\nPayment Status: ${PAYMENT_STATUS.find(x=>x[0]===r.payStatus)?.[1]||r.payStatus}\nOrder Status: ${STATUS_ORDER.find(x=>x[0]===r.status)?.[1]||r.status}\nCollection / Delivery Date: ${formatDate(j.deliveryDate||j.collectionDate)}\nTime: ${j.deliveryTime||j.collectionTime||"—"}\nLocation: ${j.deliveryLocation||j.collectionLocation||"—"}`;
                    if(typeof window.showSubmissionDetails==="function") window.showSubmissionDetails("Order Tracking — Full Details",r.row,details,[]);
                    else alert(details);
                });
                panel.querySelectorAll("[data-final-share]").forEach(b=>b.onclick=async()=>{
                    const r=records.find(x=>String(x.row.id)===String(b.dataset.finalShare));if(!r)return;
                    const text=`Aprils Signature — Order Tracking\nCustomer: ${r.row.full_name||""}\nService: ${r.row.service||"Order / Request a Quote"}\nInvoice: ${r.invoiceNumber||"—"}\nStatus: ${STATUS_ORDER.find(x=>x[0]===r.status)?.[1]||r.status}\nPayment Status: ${PAYMENT_STATUS.find(x=>x[0]===r.payStatus)?.[1]||r.payStatus}\nTotal: ${money(r.total)}\nPaid: ${money(r.paid)}\nBalance: ${money(Math.max(0,r.total-r.paid+r.refunded))}`;
                    try{
                        if(navigator.share){await navigator.share({title:"Aprils Signature Order Tracking",text});}
                        else{await navigator.clipboard?.writeText(text);message("Sharing is unavailable on this browser; the details were copied to the clipboard.","success");}
                    }catch(e){if(e?.name!=="AbortError")message("The order details could not be shared.","error")}
                });
            }
            let active=records[0]?.status||"under_review";
            list.querySelectorAll("[data-track-tab]").forEach(b=>b.onclick=()=>{active=b.dataset.trackTab;list.querySelectorAll(".final-status-tab").forEach(x=>x.classList.toggle("active",x===b));render(active);});
            const first=list.querySelector(`[data-track-tab="${CSS.escape(active)}"]`)||list.querySelector("[data-track-tab]");
            first?.classList.add("active"); render(first?.dataset.trackTab||"under_review");
        }catch(e){list.innerHTML=`<div class="empty">Order tracking could not be loaded: ${esc(e.message||"")}</div>`}
    }

    /* ---------------- TRAINING REGISTRATIONS: same spreadsheet pattern ---------------- */
    async function loadRegistrationsFinal(){
        const list=document.getElementById("registrationList"); if(!list)return;
        try{
            const rows=await getRowsSafe("training_registrations"), settings=await getRowsSafe("settings");
            const invoices=settings.filter(r=>String(r.setting_key||"").startsWith("invoice_record_")).map(r=>{try{return JSON.parse(r.setting_value||"{}")}catch(_){return null}}).filter(Boolean);
            const payments=settings.filter(r=>String(r.setting_key||"").startsWith("invoice_payment_record_")).map(r=>{try{return JSON.parse(r.setting_value||"{}")}catch(_){return null}}).filter(Boolean);
            const rec=[];
            for(const row of rows){
                const inv=invoices.filter(x=>String(x.sourceId||"")===String(row.id)||String(x.customer||"").trim().toLowerCase()===String(row.full_name||"").trim().toLowerCase()).sort((a,b)=>String(b.savedAt||"").localeCompare(String(a.savedAt||"")))[0];
                const invoiceNumber=inv?.invoiceNumber||"", total=Number(inv?.total||0);
                const paid=payments.filter(p=>String(p.invoiceNumber||"")===invoiceNumber).reduce((a,p)=>a+Number(p.amount||0),0);
                let status=await getStatus("training_status",row.id); status=status||"under_review";
                if(!["in_class","stopped","completed"].includes(status)) status=paid>=total&&total>0?"fully_paid":paid>0?"part_paid":status;
                const ps=await settingValue("payment_status_training_"+row.id)||paymentState(total,paid,0);
                rec.push({row,inv,invoiceNumber,total,paid,status,ps});
            }
            const tabs=TRAINING_STATUS_TABS(rec);
            list.innerHTML=`<div class="final-tracking-tabs">${tabs}</div><div class="final-training-panel"></div>`;
            const panel=list.querySelector(".final-training-panel");
            function render(key){
                const chosen=rec.filter(x=>x.status===key);
                panel.innerHTML=chosen.length?`<div class="final-spreadsheet"><table><thead><tr><th>Trainee</th><th>Course / Programme</th><th>Phone</th><th>Invoice</th><th>Amount</th><th>Paid</th><th>Balance</th><th>Payment Status</th><th>Training Status</th><th>Action</th></tr></thead><tbody>${chosen.map(r=>`<tr><td>${esc(r.row.full_name||"")}</td><td>${esc(r.row.course||"")}</td><td>${esc(r.row.phone||"")}</td><td>${esc(r.invoiceNumber||"—")}</td><td>${money(r.total)}</td><td>${money(r.paid)}</td><td>${money(Math.max(0,r.total-r.paid))}</td><td>${esc(PAYMENT_STATUS.find(x=>x[0]===r.ps)?.[1]||r.ps)}</td><td>${esc(TRAINING_STATUS_LABEL(r.status))}</td><td><button type="button" class="secondary" data-training-view="${esc(r.row.id)}">View Full Details</button><button type="button" class="secondary" data-training-share="${esc(r.row.id)}">Share</button></td></tr>`).join("")}</tbody></table></div>`:`<div class="empty">No training registrations are currently in this status.</div>`;
                panel.querySelectorAll("[data-training-view]").forEach(b=>b.onclick=()=>{
                    const r=rec.find(x=>String(x.row.id)===String(b.dataset.trainingView)); if(!r)return;
                    const d=`Trainee: ${r.row.full_name||""}\nCourse / Programme: ${r.row.course||""}\nPhone: ${r.row.phone||""}\nWhatsApp: ${r.row.whatsapp||""}\nEmail: ${r.row.email||""}\nLocation: ${r.row.location||""}\nDetails: ${r.row.message||r.row.details||""}\nInvoice: ${r.invoiceNumber||"—"}\nAmount: ${money(r.total)}\nPaid: ${money(r.paid)}\nBalance: ${money(Math.max(0,r.total-r.paid))}\nPayment Status: ${PAYMENT_STATUS.find(x=>x[0]===r.ps)?.[1]||r.ps}\nTraining Status: ${TRAINING_STATUS_LABEL(r.status)}`;
                    if(typeof window.showSubmissionDetails==="function") window.showSubmissionDetails("Training Registration — Full Details",r.row,d,[]); else alert(d);
                });
                panel.querySelectorAll("[data-training-share]").forEach(b=>b.onclick=async()=>{
                    const r=rec.find(x=>String(x.row.id)===String(b.dataset.trainingShare));if(!r)return;
                    const text=`Aprils Signature — Training Registration\nTrainee: ${r.row.full_name||""}\nCourse: ${r.row.course||""}\nStatus: ${TRAINING_STATUS_LABEL(r.status)}\nPayment: ${PAYMENT_STATUS.find(x=>x[0]===r.ps)?.[1]||r.ps}\nInvoice: ${r.invoiceNumber||"—"}`;
                    try{if(navigator.share)await navigator.share({title:"Aprils Signature Training Registration",text});else{await navigator.clipboard?.writeText(text);message("Sharing is unavailable on this browser; the details were copied to the clipboard.","success")}}catch(e){if(e?.name!=="AbortError")message("The training details could not be shared.","error")}
                });
            }
            const first=rec[0]?.status||"under_review";
            list.querySelectorAll("[data-track-tab]").forEach(b=>b.onclick=()=>{list.querySelectorAll(".final-status-tab").forEach(x=>x.classList.toggle("active",x===b));render(b.dataset.trackTab)});
            (list.querySelector(`[data-track-tab="${CSS.escape(first)}"]`)||list.querySelector("[data-track-tab]"))?.classList.add("active");
            render(first);
        }catch(e){list.innerHTML=`<div class="empty">Training registrations could not be loaded: ${esc(e.message||"")}</div>`}
    }
    function TRAINING_STATUS_LABEL(k){
        const map={under_review:"New Customer — Under Review",invoice_generated:"Invoice Generated",part_paid:"Part Paid",receipt_generated:"Receipt Generated",fully_paid:"Fully Paid",in_class:"In Class",stopped:"Stopped",completed:"Completed"};
        return map[k]||k;
    }
    function TRAINING_STATUS_TABS(rec){
        const keys=[["under_review","New Customer — Under Review"],["invoice_generated","Invoice Generated"],["part_paid","Part Paid"],["fully_paid","Fully Paid"],["in_class","In Class"],["stopped","Stopped"],["completed","Completed"]];
        return keys.map(([k,l])=>`<button type="button" class="final-status-tab" data-track-tab="${k}">${esc(l)} <span>${rec.filter(x=>x.status===k).length}</span></button>`).join("");
    }

    /* ---------------- ORDER STATUS / PAYMENT STATUS UPDATE TAB ---------------- */
    async function loadStatusUpdates(){
        const section=document.getElementById("orderStatusUpdates"); if(!section)return;
        const picker=section.querySelector("#finalStatusRecord"), status=section.querySelector("#finalOrderStatus"), pay=section.querySelector("#finalPaymentStatus");
        const info=section.querySelector("#finalStatusInfo"); if(!picker)return;
        try{
            const [orders,training,settings]=await Promise.all([getRowsSafe("quote_requests"),getRowsSafe("training_registrations"),getRowsSafe("settings")]);
            const opts=[];
            orders.forEach(r=>opts.push({type:"Order / Quote",id:r.id,name:r.full_name,phone:r.phone,orderStatusKey:"quote_status",paymentKey:"payment_status_quote_",row:r}));
            training.forEach(r=>opts.push({type:"Training",id:r.id,name:r.full_name,phone:r.phone,orderStatusKey:"training_status",paymentKey:"payment_status_training_",row:r}));
            picker.innerHTML=`<option value="">Select customer / record</option>`+opts.map((o,i)=>`<option value="${i}">${esc(o.type)} — ${esc(o.name||"Customer")} — ${esc(o.phone||"")}</option>`).join("");
            const refresh=async()=>{
                const o=opts[Number(picker.value)];
                if(!o){info.textContent="Select a customer or record.";return}
                const st=await getStatus(o.orderStatusKey,o.id)||"under_review";
                const ps=await settingValue(o.paymentKey+o.id)||"unpaid";
                status.value=st; pay.value=ps;
                info.textContent=`Current status: ${TRAINING_STATUS_LABEL(st)} | Payment: ${PAYMENT_STATUS.find(x=>x[0]===ps)?.[1]||ps}`;
            };
            picker.onchange=refresh;
            section.querySelector("#finalStatusSave").onclick=async()=>{
                const o=opts[Number(picker.value)];if(!o){if(window.message)message("Select a customer or record first.","error");return}
                try{
                    await setStatus(o.orderStatusKey,o.id,status.value);
                    await upsertSetting(o.paymentKey+o.id,pay.value);
                    if(typeof window.auditSystemEvent==="function") await window.auditSystemEvent(o.type,o.id,"status_payment_updated",{orderStatus:status.value,paymentStatus:pay.value});
                    if(window.message)message("Order/training status and payment status updated and synchronised.","success");
                    await refresh();
                }catch(e){if(window.message)message("The status update could not be saved: "+e.message,"error")}
            };
            await refresh();
        }catch(e){info.textContent="Could not load records: "+e.message}
    }

    /* ---------------- REFUNDS + ACCOUNTING ---------------- */
    async function loadRefundSection(){
        const section=document.getElementById("refund");if(!section)return;
        const select=section.querySelector("#refundInvoice"), info=section.querySelector("#refundInvoiceInfo"), amount=section.querySelector("#refundAmount"), pct=section.querySelector("#refundPercent"), fee=section.querySelector("#refundFee");
        try{
            const settings=await getRowsSafe("settings");
            const invoices=settings.filter(r=>String(r.setting_key||"").startsWith("invoice_record_")).map(r=>{try{return {...JSON.parse(r.setting_value||"{}"),_id:r.id}}catch(_){return null}}).filter(Boolean);
            select.innerHTML=`<option value="">Select saved invoice</option>`+invoices.map(i=>`<option value="${esc(i.invoiceNumber||"")}">${esc(i.invoiceNumber||"")} — ${esc(i.customer||"")} — ${money(i.total)}</option>`).join("");
            const show=async()=>{
                const inv=invoices.find(x=>String(x.invoiceNumber)===String(select.value));
                if(!inv){info.textContent="Select an invoice to view its payment information.";return}
                const pays=await paymentRows(inv.invoiceNumber), paid=pays.reduce((a,p)=>a+Number(p.amount||0),0);
                info.innerHTML=`Customer: <strong>${esc(inv.customer||"")}</strong> · Total: <strong>${money(inv.total)}</strong> · Paid: <strong>${money(paid)}</strong> · Maximum refundable: <strong>${money(Math.max(0,paid))}</strong>`;
            };
            const recalc=async()=>{
                const inv=invoices.find(x=>String(x.invoiceNumber)===String(select.value)); if(!inv){amount.value="";return}
                const pays=await paymentRows(inv.invoiceNumber),paid=pays.reduce((a,p)=>a+Number(p.amount||0),0);
                const p=Math.max(0,Math.min(100,Number(pct.value||0))), f=Math.max(0,Number(fee.value||0));
                amount.value=Math.max(0,paid-Math.min(paid,paid*p/100+f)).toFixed(2);
            };
            [pct,fee].forEach(el=>el.addEventListener("input",recalc));
            select.onchange=async()=>{await show();await recalc();};
            section.querySelector("#refundForm").onsubmit=async e=>{
                e.preventDefault();
                const inv=invoices.find(x=>String(x.invoiceNumber)===String(select.value));if(!inv){message("Select an invoice.","error");return}
                const pays=await paymentRows(inv.invoiceNumber), paid=pays.reduce((a,p)=>a+Number(p.amount||0),0);
                const percent=Number(pct.value||0), extra=Number(fee.value||0);
                if(percent<0||percent>100||extra<0){message("Enter a valid deduction percentage or amount.","error");return}
                const deduction=Math.min(paid, Math.max(0, paid*percent/100 + extra));
                const refundAmount=Math.max(0, paid-deduction);
                if(refundAmount<=0){message("There is no refundable balance after the selected deduction.","error");return}
                const refund={refundNumber:"AS-RF-"+Date.now().toString(36).toUpperCase(),invoiceNumber:inv.invoiceNumber,customer:inv.customer,phone:inv.phone,email:inv.email,originalPaid:paid,refundAmount,deductionPercent:percent,cancellationFee:deduction,reason:section.querySelector("#refundReason").value.trim(),notes:section.querySelector("#refundNotes").value.trim(),date:new Date().toISOString(),status:"Refund Recorded"};
                await upsertSetting("refund_record_"+String(refund.refundNumber).toLowerCase(),JSON.stringify(refund));
                await setStatus(inv.training?"training_status":"quote_status",inv.sourceId||"", "cancelled");
                if(inv.sourceId) await upsertSetting(inv.training?"payment_status_training_"+inv.sourceId:"payment_status_quote_"+inv.sourceId, refundAmount>=paid?"refunded":"partially_refunded");
                if(typeof window.auditSystemEvent==="function") await window.auditSystemEvent("refund",refund.refundNumber,"refund_recorded",refund);
                message(`Refund ${refund.refundNumber} recorded for ${money(refund.refundAmount)}.`,"success");
                e.target.reset(); await loadRefundSection();
                if(typeof window.loadAccounting==="function") await window.loadAccounting();
            };
            const list=section.querySelector("#refundList");
            const refunds=settings.filter(r=>String(r.setting_key||"").startsWith("refund_record_")).map(r=>{try{return JSON.parse(r.setting_value||"{}")}catch(_){return null}}).filter(Boolean);
            list.innerHTML=refunds.length?`<table><thead><tr><th>Date</th><th>Refund</th><th>Invoice</th><th>Customer</th><th>Refund Amount</th><th>Cancellation Fee / Expenses</th><th>Reason</th></tr></thead><tbody>${refunds.map(r=>`<tr><td>${esc(formatDateTime(r.date))}</td><td>${esc(r.refundNumber||"")}</td><td>${esc(r.invoiceNumber||"")}</td><td>${esc(r.customer||"")}</td><td>${money(r.refundAmount)}</td><td>${money(r.cancellationFee)}</td><td>${esc(r.reason||"")}</td></tr>`).join("")}</tbody></table>`:`<div class="empty">No refunds have been recorded.</div>`;
        }catch(e){message("Refund section could not be loaded: "+e.message,"error")}
    }

    /* ---------------- USER INVOICE: ALL SYSTEM INVOICES + RECEIPTS, NO DELETE ---------------- */
    async function loadSavedInvoiceReceiptRecordsFinal(){
        const userList=document.getElementById("userInvoiceSavedList"); if(!userList)return;
        try{
            const rows=await getRowsSafe("settings");
            const invoices=rows.filter(r=>String(r.setting_key||"").startsWith("invoice_record_")).map(r=>{try{return{type:"Invoice",id:r.id,key:r.setting_key,...JSON.parse(r.setting_value||"{}")}}catch(_){return null}}).filter(Boolean);
            const receipts=rows.filter(r=>String(r.setting_key||"").startsWith("receipt_record_")).map(r=>{try{return{type:"Receipt",id:r.id,key:r.setting_key,...JSON.parse(r.setting_value||"{}")}}catch(_){return null}}).filter(Boolean);
            const all=[...invoices,...receipts];
            for(const r of invoices){const p=await paymentRows(r.invoiceNumber);r._paid=p.reduce((a,x)=>a+Number(x.amount||0),0)}
            userList.innerHTML=all.length?`<table><thead><tr><th>Type</th><th>Number</th><th>Date</th><th>Customer</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead><tbody>${all.map(r=>{
                const amount=r.type==="Receipt"?Number(r.amount||0):Number(r.total||0);
                const status=r.type==="Receipt"?(r.status||"Payment Recorded"):(r._paid>=amount&&amount>0?"Paid in Full":r._paid>0?"Part Payment":"Payment Pending");
                return `<tr><td>${r.type}</td><td>${esc(r.invoiceNumber||r.receiptNumber||"")}</td><td>${esc(formatDate(r.date))}</td><td>${esc(r.customer||"")}</td><td>${money(amount)}</td><td>${esc(status)}</td><td><button type="button" class="secondary" data-final-user-open="${esc(r.key)}">Open</button><button type="button" class="secondary" data-final-user-edit="${esc(r.key)}">Edit / Correct</button><button type="button" class="secondary" data-final-user-share="${esc(r.key)}">Share PDF</button></td></tr>`;
            }).join("")}</tbody></table>`:`<div class="empty">No saved invoices or receipts are available.</div>`;
            const find=k=>all.find(r=>r.key===k);
            userList.querySelectorAll("[data-final-user-open],[data-final-user-edit]").forEach(b=>b.onclick=async()=>{
                const r=find(b.dataset.finalUserOpen||b.dataset.finalUserEdit);if(!r)return;
                if(r.type==="Invoice"){
                    await window.openInvoiceGenerator({id:r.sourceId||"",full_name:r.customer||"",phone:r.phone||"",whatsapp:r.phone||"",email:r.email||"",location:r.address||""},{manualLines:r.lines||[],notes:r.notes||"",training:!!r.training,userInvoice:true,invoiceNumber:r.invoiceNumber,discountPercent:Number(r.discountPercent||0),entryId:r.entryId||"",existingRecord:r});
                    if(r.attachments?.length){const paper=document.getElementById("invoicePaper");if(paper){const g=document.createElement("div");g.className="final-invoice-attachment-gallery";g.innerHTML=`<h3>Attached Images</h3><div>${r.attachments.map(a=>a.url?`<img src="${esc(a.url)}" alt="${esc(a.name||"Attached image")}">`:`<p>${esc(a.name||"Attached image")}</p>`).join("")}</div>`;paper.appendChild(g);}}
                }else{
                    await window.openSavedReceiptRecord(r);
                }
            });
            userList.querySelectorAll("[data-final-user-share]").forEach(b=>b.onclick=async()=>{
                const r=find(b.dataset.finalUserShare);if(!r)return;
                if(r.type==="Invoice"){
                    await window.openInvoiceGenerator({id:r.sourceId||"",full_name:r.customer||"",phone:r.phone||"",whatsapp:r.phone||"",email:r.email||"",location:r.address||""},{manualLines:r.lines||[],notes:r.notes||"",training:!!r.training,userInvoice:true,invoiceNumber:r.invoiceNumber,discountPercent:Number(r.discountPercent||0),entryId:r.entryId||"",existingRecord:r});
                    if(r.attachments?.length){const paper=document.getElementById("invoicePaper");if(paper){const g=document.createElement("div");g.className="final-invoice-attachment-gallery";g.innerHTML=`<h3>Attached Images</h3><div>${r.attachments.map(a=>a.url?`<img src="${esc(a.url)}" alt="${esc(a.name||"Attached image")}">`:`<p>${esc(a.name||"Attached image")}</p>`).join("")}</div>`;paper.appendChild(g);}}
                    await window.generateInvoicePdf(true);
                }else{
                    await window.openSavedReceiptRecord(r); await window.generateReceiptPdf(true);
                }
            });
        }catch(e){userList.innerHTML=`<div class="empty">Saved invoices and receipts could not be loaded: ${esc(e.message||"")}</div>`}
    }

    /* ---------------- COLLECTION / DELIVERY FORM ---------------- */
    async function generateCollectionFormFinal(share,mode){
        const invoices=window._aprilsCollectionInvoices||[];
        const inv=invoices.find(i=>String(i.invoiceNumber)===String(document.getElementById("collectionInvoiceSelect")?.value||""));
        if(!inv){message("Select a saved invoice first.","error");return}
        const date=document.getElementById("collectionDate")?.value||"",time=document.getElementById("collectionTime")?.value||"",location=document.getElementById("collectionLocation")?.value.trim()||"";
        if(!date||!time||!location){message("Enter the collection / delivery date, time and location.","error");return}
        const pays=await paymentRows(inv.invoiceNumber),paid=pays.reduce((a,p)=>a+Number(p.amount||0),0),balance=Math.max(0,Number(inv.total||0)-paid);
        const lines=Array.isArray(inv.lines)?inv.lines:[];
        const entryId="COL-"+Date.now().toString(36).toUpperCase();
        const root=document.createElement("div");
        root.className="collection-form-paper final-collection-paper";
        root.innerHTML=`<div class="collection-brand"><div><h1>Aprils Signature</h1><p>Elegance in Every Stitch</p></div><div class="collection-title"><strong>COLLECTION / DELIVERY FORM</strong><span>${esc(inv.invoiceNumber||"")}</span></div></div><div class="collection-customer"><p><strong>Customer:</strong> ${esc(inv.customer||"")}</p><p><strong>Phone:</strong> ${esc(inv.phone||"")}</p></div><table class="collection-items"><thead><tr><th>No.</th><th>Item / Description</th><th>Details</th><th>Quantity</th><th>Unit Price</th><th>Total</th></tr></thead><tbody>${lines.map((l,i)=>`<tr><td>${i+1}</td><td>${esc(l.description||"")}</td><td>${esc(l.details||"")}</td><td>${Number(l.quantity||1)}</td><td>${money(l.unitPrice)}</td><td>${money(Number(l.quantity||1)*Number(l.unitPrice||0))}</td></tr>`).join("")||`<tr><td>1</td><td>Order / Service</td><td>See invoice</td><td>1</td><td>${money(inv.total)}</td><td>${money(inv.total)}</td></tr>`}</tbody></table><div class="collection-summary"><p><strong>Total Cost:</strong> ${money(inv.total)}</p><p><strong>Payment Made:</strong> ${money(paid)}</p><p><strong>Balance:</strong> ${money(balance)}</p></div><div class="collection-details"><h3>Collection / Delivery Details</h3><p><strong>Date:</strong> ${esc(formatDate(date))}</p><p><strong>Time:</strong> ${esc(time)}</p><p><strong>Location:</strong> ${esc(location)}</p></div><p class="collection-id">Form ID: ${esc(entryId)}</p></div>`;
        document.body.appendChild(root);
        try{
            const h2p=window.html2pdf;if(!h2p)throw new Error("PDF service unavailable. Refresh the admin page and try again.");
            await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
            const blob=await window.pdfFromVisibleElement(root,{margin:0,filename:`Aprils-Signature-Collection-${inv.invoiceNumber}.pdf`,image:{type:"jpeg",quality:.98},html2canvas:{scale:2,useCORS:true,backgroundColor:"#ffffff"},jsPDF:{unit:"in",format:"a4",orientation:"portrait"}});
            if(!blob||blob.size<5000)throw new Error("The generated PDF was empty or incomplete.");
            const file=new File([blob],`Aprils-Signature-Collection-${inv.invoiceNumber}.pdf`,{type:"application/pdf"});
            if(mode==="whatsapp"){
                const n=typeof window.normalizeWhatsAppNumber==="function"?window.normalizeWhatsAppNumber(inv.phone):String(inv.phone||"").replace(/\D/g,"");
                const url=n?`https://wa.me/${n}`:"https://wa.me/";
                const opened=window.open(url,"_blank","noopener,noreferrer");
                if(!opened) window.location.href=url;
                const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=file.name;a.click();
                message("WhatsApp opened directly. The original PDF has been downloaded for attachment.","success");
                return;
            }
            if(share && navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))){
                await navigator.share({title:"Aprils Signature Collection / Delivery Form",text:"Aprils Signature collection / delivery form",files:[file]});return;
            }
            const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=file.name;a.click();message("Collection / delivery PDF downloaded.","success");
        }catch(e){console.error(e);message("The collection / delivery PDF could not be generated: "+e.message,"error")}
        finally{root.remove()}
    }

    /* ---------------- WHATSAPP / PDF SHARE BEHAVIOUR ---------------- */
    function patchSharing(){
        if(typeof window.sharePdfToWhatsApp==="function" && !window.sharePdfToWhatsApp.__final){
            const old=window.sharePdfToWhatsApp;
            const fn=async function(paper,filename,phone,title){
                try{
                    if(window.html2pdf && paper){
                        const blob=await window.pdfFromVisibleElement(paper,{margin:0,filename,image:{type:"jpeg",quality:.98},html2canvas:{scale:2,useCORS:true,backgroundColor:"#fff"},jsPDF:{unit:"in",format:"a4",orientation:"portrait"}});
                        const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename;a.click();
                    }
                    const n=typeof window.normalizeWhatsAppNumber==="function"?window.normalizeWhatsAppNumber(phone):String(phone||"").replace(/\D/g,"");
                    const url=n?`https://wa.me/${n}`:"https://wa.me/";
                    const w=window.open(url,"_blank","noopener,noreferrer"); if(!w) location.href=url;
                    message("WhatsApp opened directly. Attach the generated PDF from your downloads.","success");
                    return true;
                }catch(e){console.error(e);message("WhatsApp could not be opened: "+e.message,"error");return false}
            };
            fn.__final=true; window.sharePdfToWhatsApp=fn;
        }
    }

    /* ---------------- ATTACH IMAGES TO INVOICES ---------------- */
    function addInvoiceImageAttachmentUI(){
        const modal=document.getElementById("invoiceGeneratorModal");
        const state=window._aprilsCurrentInvoice;
        if(!modal||!state||modal.dataset.finalImages==="1")return;
        modal.dataset.finalImages="1";
        const editor=modal.querySelector(".invoice-generator-editor"); if(!editor)return;
        const wrap=document.createElement("div");
        wrap.className="form-group final-invoice-attachments";
        wrap.innerHTML=`<label>Attach Images</label><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple><small>Optional. Attach reference or order images to this invoice.</small><div class="final-attachment-list"></div>`;
        editor.prepend(wrap);
        const input=wrap.querySelector("input"), list=wrap.querySelector(".final-attachment-list");
        const render=()=>{
            const arr=state.attachments||[];
            list.innerHTML=arr.map(a=>`<span class="final-attachment-chip">${esc(a.name||"Image")}</span>`).join("");
        };
        input.onchange=async()=>{
            const d=supabase(); if(!d){message("Supabase is unavailable; images cannot be attached right now.","error");return}
            state.attachments=state.attachments||[];
            for(const file of Array.from(input.files||[])){
                if(file.size>5*1024*1024){message("Each invoice image must be 5 MB or smaller.","error");continue}
                try{
                    const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
                    const path=`invoice-attachments/${Date.now()}-${Math.random().toString(36).slice(2)}-${safe}`;
                    const up=await d.storage.from("quote-uploads").upload(path,file,{upsert:false,contentType:file.type});
                    if(up.error)throw up.error;
                    const pub=d.storage.from("quote-uploads").getPublicUrl(path);
                    state.attachments.push({name:file.name,path,url:pub?.data?.publicUrl||""});
                }catch(e){message("An invoice image could not be uploaded: "+e.message,"error")}
            }
            input.value="";render();
        };
        render();
    }

    /* ---------------- AUDIT LOG: clear button, clearer language ---------------- */
    function addAuditClear(){
        const section=document.getElementById("auditLog");if(!section||section.dataset.finalAudit==="1")return;
        section.dataset.finalAudit="1";
        const refresh=section.querySelector("#auditRefresh");
        if(refresh){
            const clear=document.createElement("button");clear.type="button";clear.className="danger";clear.textContent="Clear Activity Log";
            refresh.parentNode.appendChild(clear);
            clear.onclick=async()=>{
                if(!confirm("Clear the staff activity log? This removes audit events only; customer, invoice and payment records are not deleted."))return;
                try{
                    const d=supabase();if(!d)throw new Error("Supabase unavailable.");
                    const rows=await getRowsSafe("settings");
                    const ids=rows.filter(r=>String(r.setting_key||"").startsWith("audit_event_")).map(r=>r.id).filter(Boolean);
                    if(ids.length)await d.from("settings").delete().in("id",ids);
                    message("Staff activity log cleared. Business records were not deleted.","success");
                    if(typeof window.loadAuditLog==="function")await window.loadAuditLog();
                }catch(e){message("The activity log could not be cleared: "+e.message,"error")}
            };
        }
    }

    /* ---------------- DATE DISPLAY / CAPITALISATION ---------------- */
    function improveTextCapitalisation(){
        if(document.documentElement.dataset.finalCapitalisation==="1")return;
        document.documentElement.dataset.finalCapitalisation="1";
        const skip=new Set(["email","url","password","tel","number","date","time","search","hidden"]);
        const terms=["bubu","kaftan","jersey","hoodie","joggers","sweatshirt","sweatpants","t-shirt","polo","varsity jacket","cargo pants","cargo skirts","jorts","winneba","ghana","aprils signature"];
        const cap=el=>{
            if(!(el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement))return;
            const t=String(el.type||"").toLowerCase();
            if(skip.has(t)||/email|url|password|phone|whatsapp|website|link/i.test((el.name||"")+" "+(el.id||"")))return;
            let v=String(el.value||"");
            if(!v)return;
            v=v.replace(/(^|[.!?]\s+)([a-z])/g,(_,p,c)=>p+c.toUpperCase());
            terms.forEach(term=>{
                const re=new RegExp("(^|\\s|[(/-])("+term.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+")(?=$|[\\s.,!?)/-])","gi");
                v=v.replace(re,(m,p,w)=>p+w.charAt(0).toUpperCase()+w.slice(1));
            });
            el.value=v;
        };
        document.addEventListener("input",e=>cap(e.target),true);
        document.addEventListener("blur",e=>cap(e.target),true);
        document.addEventListener("change",e=>{
            if(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement)cap(e.target);
        },true);
    }

    function addSections(){
        const nav=document.querySelector(".sidebar"); if(!nav)return;
        if(!document.getElementById("orderStatusUpdates")){
            const ref=nav.querySelector('[data-section="orderTracking"]');
            const b=document.createElement("button");b.type="button";b.dataset.section="orderStatusUpdates";b.textContent="Order Status / Payment Updates";
            nav.insertBefore(b,ref||null);
        }
        if(!document.getElementById("refund")){
            const ref=nav.querySelector('[data-section="accounting"]');
            const b=document.createElement("button");b.type="button";b.dataset.section="refund";b.textContent="Refund";
            nav.insertBefore(b,ref||null);
            const sec=document.createElement("section");sec.id="refund";sec.className="section";
            sec.innerHTML=`<h2>Refund</h2><p class="intro">Record a professional refund and keep it linked to the original invoice, payment status and Sales &amp; Accounting.</p><div class="form-card"><form id="refundForm"><div class="form-grid"><div class="form-group"><label for="refundInvoice">Invoice</label><select id="refundInvoice" required><option value="">Select saved invoice</option></select></div><div class="form-group"><label for="refundPercent">Percentage to Deduct (Optional)</label><input id="refundPercent" type="number" min="0" max="100" step="0.01"></div><div class="form-group"><label for="refundFee">Amount to Deduct / Cancellation Fee / Incurred Expenses (Optional)</label><input id="refundFee" type="number" min="0" step="0.01"><small>As a custom and made-to-order brand, this is a penalty fee subtracted from the customer's payment to cover the administrative time spent processing the order and/or time used for sourcing for fabrics and/or expenses already incurred on the order before cancellation.</small></div><div class="form-group"><label for="refundAmount">Refund Amount (Calculated)</label><input id="refundAmount" type="number" min="0" step="0.01" readonly></div><div class="form-group full-width"><label for="refundReason">Reason</label><textarea id="refundReason" required></textarea></div><div class="form-group full-width"><label for="refundNotes">Notes</label><textarea id="refundNotes"></textarea></div></div><div id="refundInvoiceInfo" class="notice">Select an invoice to view its payment information.</div><button class="primary" type="submit">Record Refund</button></form></div><div id="refundList" class="table-wrap"></div>`;
            document.getElementById("accounting")?.before(sec);
        }
        if(!document.getElementById("orderStatusUpdates")){
            const sec=document.createElement("section");sec.id="orderStatusUpdates";sec.className="section";
            sec.innerHTML=`<h2>Order Status / Payment Updates</h2><p class="intro">Use this manual control only when automatic status progression cannot determine the current stage. Changes are synchronised with the related order or training record and payment status.</p><div class="form-card"><div class="form-grid"><div class="form-group"><label for="finalStatusRecord">Customer / Record</label><select id="finalStatusRecord"><option value="">Loading…</option></select></div><div class="form-group"><label for="finalOrderStatus">Order / Training Status</label><select id="finalOrderStatus">${STATUS_ORDER.map(([k,l])=>`<option value="${k}">${esc(l)}</option>`).join("")}</select></div><div class="form-group"><label for="finalPaymentStatus">Payment Status</label><select id="finalPaymentStatus">${PAYMENT_STATUS.map(([k,l])=>`<option value="${k}">${esc(l)}</option>`).join("")}</select></div></div><p id="finalStatusInfo" class="notice">Select a customer or record.</p><button type="button" class="primary" id="finalStatusSave">Save Status &amp; Payment Update</button></div>`;
            const ref=document.getElementById("orderTracking");ref?.before(sec);
        }
        // Give the newly added buttons the same section behaviour as the existing admin navigation.
        nav.querySelectorAll('button[data-section]').forEach(b=>{
            if(b.dataset.finalNav==="1")return;b.dataset.finalNav="1";
            b.addEventListener("click",async()=>{
                nav.querySelectorAll("button").forEach(x=>x.classList.remove("active"));b.classList.add("active");
                document.querySelectorAll(".section").forEach(x=>x.classList.remove("active"));
                document.getElementById(b.dataset.section)?.classList.add("active");
                try{sessionStorage.setItem("aprils_admin_current_section",b.dataset.section)}catch(_){}
                if(b.dataset.section==="orderStatusUpdates")await loadStatusUpdates();
                if(b.dataset.section==="refund")await loadRefundSection();
                attachSearchBoxes();
            });
        });
    }

    function addCss(){
        if(document.getElementById("finalFixStyles"))return;
        const st=document.createElement("style");st.id="finalFixStyles";
        st.textContent=`
        .admin-table-search{display:flex;gap:8px;margin:10px 0}.admin-table-search input{width:100%;max-width:520px;padding:10px 12px;border:1px solid #bbb;border-radius:5px}
        .final-tracking-tabs{display:flex;gap:6px;overflow-x:auto;padding:8px 0 12px;position:sticky;top:0;background:#fff;z-index:2}
        .final-status-tab{border:1px solid #888;background:#fff;padding:9px 12px;border-radius:5px;white-space:nowrap;cursor:pointer}.final-status-tab.active{background:#111;color:#fff}
        .final-status-tab span{font-weight:700;margin-left:4px}.final-spreadsheet{width:100%;overflow:auto}.final-spreadsheet table{min-width:1200px;border-collapse:collapse;width:100%}.final-spreadsheet th,.final-spreadsheet td{border:1px solid #bbb;padding:7px 8px;vertical-align:top;text-align:left;font-size:11px}.final-spreadsheet th{font-weight:700}
        .final-collection-paper{background:#fff!important;color:#222!important;width:210mm;max-width:210mm;min-height:297mm;padding:12mm;box-sizing:border-box;font-family:Arial,sans-serif}.final-collection-paper table{width:100%;border-collapse:collapse}.final-collection-paper th,.final-collection-paper td{border:1px solid #777;padding:7px;text-align:left;font-size:10.5px}.final-collection-paper th{font-weight:700}.final-collection-paper .collection-summary{margin-left:auto;max-width:320px;margin-top:16px}.final-collection-paper .collection-brand{display:flex;justify-content:space-between;gap:15px;border-bottom:3px solid #111;padding-bottom:12px;margin-bottom:15px}.final-collection-paper .collection-title{text-align:right}
        .final-invoice-attachments{border:1px solid #ddd;padding:10px;margin-bottom:12px}.final-invoice-attachment-gallery{margin-top:18px;border-top:1px solid #ccc;padding-top:12px}.final-invoice-attachment-gallery>div{display:flex;flex-wrap:wrap;gap:10px}.final-invoice-attachment-gallery img{max-width:170px;max-height:170px;object-fit:contain;border:1px solid #bbb;padding:3px}.final-attachment-list{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.final-attachment-chip{border:1px solid #bbb;padding:4px 7px;border-radius:4px;font-size:11px}
        #orderStatusUpdates,#refund{scroll-margin-top:20px}
        `;
        document.head.appendChild(st);
    }



    function patchAccountingRefundSync(){
        if(typeof window.loadAccounting!=="function" || window.loadAccounting.__finalRefund)return;
        const old=window.loadAccounting;
        const fn=async function(){
            await old();
            try{
                const settings=await getRowsSafe("settings");
                const refunds=settings.filter(r=>String(r.setting_key||"").startsWith("refund_record_")).map(r=>{try{return JSON.parse(r.setting_value||"{}")}catch(_){return null}}).filter(Boolean);
                const totalRefunds=refunds.reduce((a,r)=>a+Number(r.refundAmount||0),0);
                const salesEl=document.getElementById("accountingSales"),receivedEl=document.getElementById("accountingReceived"),netEl=document.getElementById("accountingNetCash");
                const currentMoney=el=>Number(String(el?.textContent||"").replace(/[^\d.-]/g,""))||0;
                if(salesEl)salesEl.textContent=money(Math.max(0,currentMoney(salesEl)-totalRefunds));
                if(receivedEl)receivedEl.textContent=money(Math.max(0,currentMoney(receivedEl)-totalRefunds));
                if(netEl)netEl.textContent=money(Math.max(0,currentMoney(netEl)-totalRefunds));
                const accounting=document.getElementById("accounting");
                if(accounting&&!accounting.querySelector("#refundAccountingList")){
                    const card=document.createElement("div");card.className="form-card";card.id="refundAccountingList";
                    card.innerHTML=`<h3>Refunds</h3><div class="table-wrap"></div>`;
                    accounting.appendChild(card);
                }
                const list=document.querySelector("#refundAccountingList .table-wrap");
                if(list)list.innerHTML=refunds.length?`<table><thead><tr><th>Date</th><th>Refund</th><th>Invoice</th><th>Customer</th><th>Amount</th><th>Cancellation Fee / Expenses</th></tr></thead><tbody>${refunds.map(r=>`<tr><td>${esc(formatDateTime(r.date))}</td><td>${esc(r.refundNumber||"")}</td><td>${esc(r.invoiceNumber||"")}</td><td>${esc(r.customer||"")}</td><td>${money(r.refundAmount)}</td><td>${money(r.cancellationFee)}</td></tr>`).join("")}</tbody></table>`:`<div class="empty">No refunds recorded.</div>`;
                attachSearchBoxes();
            }catch(e){console.warn("Refund/accounting sync skipped:",e)}
        };
        fn.__finalRefund=true;window.loadAccounting=fn;
    }

    function patchInvoicePdfAttachments(){
        if(typeof window.generateInvoicePdf!=="function" || window.generateInvoicePdf.__finalAttachments)return;
        const old=window.generateInvoicePdf;
        const fn=async function(share){
            const state=window._aprilsCurrentInvoice;
            const paper=document.getElementById("invoicePaper");
            let gallery=null;
            try{
                const files=state?.attachments||[];
                if(paper&&files.length){
                    gallery=document.createElement("div");
                    gallery.className="final-invoice-attachment-gallery";
                    gallery.innerHTML=`<h3>Attached Images</h3><div>${files.map(a=>a.url?`<img src="${esc(a.url)}" alt="${esc(a.name||"Attached image")}">`:`<p>${esc(a.name||"Attached image")}</p>`).join("")}</div>`;
                    paper.appendChild(gallery);
                    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
                }
                return await old(share);
            }finally{gallery?.remove();}
        };
        fn.__finalAttachments=true;window.generateInvoicePdf=fn;
    }

    function patchGlobals(){
        if(typeof window.loadOrderTracking==="function") window.loadOrderTracking=loadOrderTrackingFinal;
        if(typeof window.loadRegistrations==="function") window.loadRegistrations=loadRegistrationsFinal;
        if(typeof window.loadSavedInvoiceReceiptRecords==="function") window.loadSavedInvoiceReceiptRecords=loadSavedInvoiceReceiptRecordsFinal;
        if(typeof window.generateCollectionForm==="function") window.generateCollectionForm=generateCollectionFormFinal;
        patchSharing(); patchInvoicePdfAttachments(); patchAccountingRefundSync();
    }

    function boot(){
        addCss(); addSections(); improveTextCapitalisation(); improveQuoteSubmission();
        patchGlobals(); addAuditClear(); attachSearchBoxes();
        // Re-run corrected data views after the original admin startup has completed.
        setTimeout(async()=>{
            try{if(typeof window.loadOrderTracking==="function")await window.loadOrderTracking()}catch(_){}
            try{if(typeof window.loadRegistrations==="function")await window.loadRegistrations()}catch(_){}
            try{if(typeof window.loadSavedInvoiceReceiptRecords==="function")await window.loadSavedInvoiceReceiptRecords()}catch(_){}
            try{addInvoiceImageAttachmentUI()}catch(_){}
            attachSearchBoxes();
            // Preserve the currently selected admin section across refreshes.
            try{
                const id=sessionStorage.getItem("aprils_admin_current_section");
                if(id){
                    const b=document.querySelector(`.sidebar button[data-section="${CSS.escape(id)}"]`);
                    if(b)b.click();
                }
            }catch(_){}
        },900);
        // Invoice modals are created dynamically, so observe them for image attachment UI.
        const observer=new MutationObserver(()=>{try{addInvoiceImageAttachmentUI()}catch(_){}});
        observer.observe(document.body,{childList:true,subtree:true});
    }
    if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();

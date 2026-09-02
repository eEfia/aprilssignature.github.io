"use strict";
(function(){
 const db=()=>window.aprilsSupabase||window.AprilsSupabase||null;
 const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,ot;").replace(/'/g,"&#039;");
 const slug=v=>String(v||"").toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"").slice(0,80);
 async function rows(){const d=db();if(!d)return[];const r=await d.from("settings").select("id,setting_key,setting_value,updated_at");if(r.error)throw r.error;return r.data||[]}
 async function save(key,val){if(window.safeSettingUpsert)return window.safeSettingUpsert(key,JSON.stringify(val));const d=db();if(!d)throw new Error("Supabase is unavailable");const old=await d.from("settings").select("id").eq("setting_key",key).limit(1);if(old.error)throw old.error;if(old.data?.length)return d.from("settings").update({setting_value:JSON.stringify(val),updated_at:new Date().toISOString()}).eq("id",old.data[0].id);return d.from("settings").insert({setting_key:key,setting_value:JSON.stringify(val),updated_at:new Date().toISOString()})}
 async function getInventory(){return(await rows()).filter(r=>String(r.setting_key||"").startsWith("inventory_item_")).map(r=>{try{return{...JSON.parse(r.setting_value||"{}"),id:r.id,setting_key:r.setting_key}}catch(_){return null}}).filter(x=>x&&x.name).sort((a,b)=>Number(a.display_order||9999)-Number(b.display_order||9999))}
 async function syncPublicShopInventory(items){try{await save("site_link_shop_inventory",items.map(x=>({id:x.id,name:x.name,collection:x.collection,price:Number(x.price||0),quantity:Number(x.quantity||0),description:x.description||"",active:x.active!==false,display_order:Number(x.display_order||9999),image:x.image||""})));}catch(e){console.warn("Public shop sync skipped:",e)}}
 function busy(btn,on,label){if(!btn)return;btn.disabled=on;btn.classList.toggle("button-working",!!on);btn.setAttribute("aria-busy",on?"true":"false");}
 async function renderShopPreview(){const box=document.getElementById("shopInventoryPreview");if(!box)return;try{const items=await getInventory();box.innerHTML=items.length?`<h4>Shop Items</h4><table><thead><tr><th>Image</th><th>Garment</th><th>Price</th><th>Qty</th><th>Public</th></tr></thead><tbody>${items.map(x=>`<tr><td>${x.image?`<img class="inventory-thumb" src="${esc(x.image)}" alt="">`:`—`}</td><td>${esc(x.name)}</td><td>GHS ${Number(x.price||0).toFixed(2)}</td><td>${Number(x.quantity||0)}</td><td>${x.active!==false?"Yes":"No"}</td></tr>`).join("")}</tbody></table>`:`<h4>Shop Items</h4><div class="empty">No inventory items have been added yet. Add garments in Inventory / Stock and they will appear here and on the public Shop.</div>`}catch(e){box.innerHTML=`<div class="empty">Shop items could not be loaded: ${esc(e.message)}</div>`}}
 async function renderInventoryCollectionOrder(items){
    const box=document.getElementById("inventoryCollectionOrderList");if(!box)return;
    const names=[...new Set((items||[]).map(x=>String(x.collection||"").trim()).filter(Boolean))];
    const settings=await rows();
    const orderMap=new Map();
    settings.filter(r=>String(r.setting_key||"").startsWith("inventory_collection_order_")).forEach(r=>{
        const name=String(r.setting_key).replace(/^inventory_collection_order_/,"").replace(/_/g," ");
        const value=Number(r.setting_value||0); if(value) orderMap.set(name,value);
    });
    names.sort((a,b)=>(orderMap.get(slug(a))||9999)-(orderMap.get(slug(b))||9999)||a.localeCompare(b));
    box.innerHTML=names.length?`<table><thead><tr><th>Collection</th><th>Order</th><th>Save</th><th>Rename</th><th>Remove From Order</th></tr></thead><tbody>${names.map((name,i)=>`<tr><td>${esc(name)}</td><td><input type="number" min="1" value="${Number(orderMap.get(slug(name))||i+1)}" data-inventory-collection-order="${esc(name)}" style="max-width:90px"></td><td><button type="button" class="secondary" data-save-inventory-collection="${esc(name)}">Save Order</button></td><td><button type="button" class="secondary" data-rename-inventory-collection="${esc(name)}">Rename</button></td><td><button type="button" class="danger" data-delete-inventory-collection="${esc(name)}">Remove</button></td></tr>`).join("")}</tbody></table>`:`<div class="empty">No collections yet. Add a collection or save an inventory item with a collection name.</div>`;
    box.querySelectorAll("[data-save-inventory-collection]").forEach(b=>b.onclick=async()=>{
        const name=b.dataset.saveInventoryCollection;const input=box.querySelector(`[data-inventory-collection-order="${CSS.escape(name)}"]`);
        try{await save("inventory_collection_order_"+slug(name),String(Math.max(1,Number(input?.value)||1)));message("Inventory collection order saved.","success");await loadInventory();}catch(e){message("Collection order could not be saved: "+e.message,"error")}
    });
    box.querySelectorAll("[data-rename-inventory-collection]").forEach(b=>b.onclick=async()=>{
        const oldName=b.dataset.renameInventoryCollection;const next=prompt("Rename collection:",oldName);if(next===null)return;const name=next.trim();if(!name||name===oldName)return;
        try{
            const current=await getInventory();const duplicate=current.some(x=>String(x.collection||"").trim().toLowerCase()===name.toLowerCase()&&String(x.collection||"").trim().toLowerCase()!==oldName.toLowerCase());
            if(duplicate){message("That collection name already exists.","error");return;}
            for(const item of current.filter(x=>String(x.collection||"").trim()===oldName)){
                const value={...item};delete value.id;delete value.setting_key;value.collection=name;
                const key=item.setting_key;
                const result=await db().from("settings").update({setting_key:"inventory_item_"+slug(name+"_"+item.name),setting_value:JSON.stringify(value),updated_at:new Date().toISOString()}).eq("id",item.id);
                if(result.error)throw result.error;
            }
            const oldKey="inventory_collection_order_"+slug(oldName);const oldOrder=orderMap.get(slug(oldName));
            if(oldOrder) await save("inventory_collection_order_"+slug(name),String(oldOrder));
            await db().from("settings").delete().eq("setting_key",oldKey);
            message("Collection renamed.","success");await loadInventory();
        }catch(e){message("Collection could not be renamed: "+e.message,"error")}
    });
    box.querySelectorAll("[data-delete-inventory-collection]").forEach(b=>b.onclick=async()=>{
        const name=b.dataset.deleteInventoryCollection;if(!confirm(`Remove "${name}" from the collection order? Inventory items will remain.`))return;
        try{await db().from("settings").delete().eq("setting_key","inventory_collection_order_"+slug(name));message("Collection removed from order.","success");await loadInventory();}catch(e){message("Collection could not be removed: "+e.message,"error")}
    });
}
 async function loadInventory(){const list=document.getElementById("inventoryList");if(!list)return;try{const items=await getInventory();await renderInventoryCollectionOrder(items);await syncPublicShopInventory(items);list.innerHTML=items.length?`<table><thead><tr><th>Image</th><th>Collection / Batch</th><th>Garment</th><th>Price</th><th>Qty</th><th>Public</th><th>Actions</th></tr></thead><tbody>${items.map(x=>`<tr><td>${x.image?`<img class="inventory-thumb" src="${esc(x.image)}" alt="">`:`—`}</td><td>${esc(x.collection)}</td><td>${esc(x.name)}</td><td>GHS ${Number(x.price||0).toFixed(2)}</td><td><strong>${Number(x.quantity||0)}</strong>${Number(x.quantity||0)<=0?" — Out of Stock":""}</td><td>${x.active!==false?"Yes":"No"}</td><td><button class="secondary" data-edit-inventory="${esc(x.id)}">Edit</button> <button class="danger" data-delete-inventory="${esc(x.id)}">Delete</button></td></tr>`).join("")}</tbody></table>`:`<div class="empty">No inventory items have been added yet.</div>`;list.querySelectorAll("[data-edit-inventory]").forEach(b=>b.onclick=()=>{const x=items.find(i=>String(i.id)===String(b.dataset.editInventory));if(x)inventoryFormFill(x)});list.querySelectorAll("[data-delete-inventory]").forEach(b=>b.onclick=async()=>{if(!confirm("Delete this inventory item?"))return;const d=db();const r=await d.from("settings").delete().eq("id",b.dataset.deleteInventory);if(r.error){alert(r.error.message);return}await loadInventory();await renderShopPreview()});}catch(e){list.innerHTML=`<div class="empty">Inventory could not be loaded: ${esc(e.message)}</div>`}}
 function inventoryFormFill(x){document.getElementById("inventoryId").value=x.id||"";document.getElementById("inventoryCollection").value=x.collection||"";document.getElementById("inventoryName").value=x.name||"";document.getElementById("inventoryPrice").value=x.price??"";document.getElementById("inventoryQuantity").value=x.quantity??0;document.getElementById("inventoryOrder").value=x.display_order??1;document.getElementById("inventoryDescription").value=x.description||"";document.getElementById("inventoryActive").checked=x.active!==false;document.getElementById("inventoryForm").scrollIntoView({behavior:"smooth",block:"center"});document.getElementById("inventoryName")?.focus()}
 async function fileToDataUrl(file){if(!file)return "";if(file.size>3*1024*1024)throw new Error("Please choose an image smaller than 3 MB.");return await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result));r.onerror=rej;r.readAsDataURL(file)})}
 async function getCheckoutInvoicePrice(d,name,fallback){
    try {
        const r=await d.from("settings").select("setting_value").like("setting_key","invoice_price_%");
        const normal=v=>String(v||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
        const target=normal(name);
        for(const row of (r.data||[])){ try { const item=JSON.parse(row.setting_value||"{}"); if(item.active===false)continue; if(normal(item.name)===target || normal(item.name)==="training "+target) return Number(item.price||0); } catch(_){} }
    } catch(_){}
    return Number(fallback||0);
}
 async function loadCheckoutOrders(){
    const list=document.getElementById("checkoutList");if(!list)return;const d=db();if(!d)return;
    try{
        const r=await d.from("quote_requests").select("*").order("created_at",{ascending:false});
        if(r.error)throw r.error;
        const orders=(r.data||[]).map(x=>{let j={};try{j=JSON.parse(x.journey||"{}")}catch(_){}return{...x,j}}).filter(x=>x.j.checkout);
        list.innerHTML=orders.length?`<table><thead><tr><th>Date</th><th>Time</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th>Delivery / Collection</th><th>Actions</th></tr></thead><tbody>${orders.map(x=>`<tr>
            <td>${esc(x.created_at||x.updated_at||"")}</td><td>${esc(x.created_at?new Intl.DateTimeFormat("en-GB",{timeZone:"UTC",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(x.created_at))+" GMT":"")}</td>
            <td>${esc(x.full_name)}<br>${esc(x.phone)}</td>
            <td>${esc((x.j.items||[]).map(i=>i.name+" × "+i.quantity).join(", "))}</td>
            <td>GHS ${Number(x.j.total||0).toFixed(2)}</td>
            <td>${esc(x.j.paymentStatus||"pending")}</td>
            <td><select class="admin-status-select" data-checkout-status="${esc(x.id)}">
                ${[["under_review","New Customer — Under Review"],["invoice_generated","Invoice Generated"],["deposit_paid","Deposit Paid"],["part_paid","Part Paid"],["order_taken","Confirmed / Order Taken"],["in_production","In Production"],["completed","Completed"],["ready","Ready for Collection / Delivery"],["fully_paid","Full Payment"],["dispatched","Dispatched"],["received","Received by Customer"],["cancelled","Cancelled"]].map(([k,l])=>`<option value="${k}" ${(x.j.orderStatus||"under_review")===k?"selected":""}>${l}</option>`).join("")}
            </select></td>
            <td><div style="display:grid;gap:6px"><input type="date" data-checkout-delivery-date="${esc(x.id)}" value="${esc(x.j.deliveryDate||"")}"><input type="time" data-checkout-delivery-time="${esc(x.id)}" value="${esc(x.j.deliveryTime||"")}"><input type="text" data-checkout-delivery-location="${esc(x.id)}" value="${esc(x.j.deliveryLocation||"")}" placeholder="Delivery / collection location"><button class="secondary" data-save-checkout-delivery="${esc(x.id)}">Save Delivery</button></div></td>
            <td>
                <button class="secondary" data-checkout-details="${esc(x.id)}">View Full Details</button>
                <button class="primary" data-checkout-invoice="${esc(x.id)}">Generate Invoice</button>
                <button class="secondary" data-checkout-paid="${esc(x.id)}">Mark Payment Received &amp; Deduct Stock</button>
            </td>
        </tr>`).join("")}</tbody></table>`:`<div class="empty">No checkout orders have been received.</div>`;

        list.querySelectorAll("[data-checkout-status]").forEach(select=>select.onchange=async()=>{
            const x=orders.find(o=>String(o.id)===String(select.dataset.checkoutStatus));if(!x)return;
            try{
                const status=select.value;
                x.j.orderStatus=status;
                const u=await d.from("quote_requests").update({journey:JSON.stringify(x.j)}).eq("id",x.id);
                if(u.error)throw u.error;
                await save("checkout_status_"+slug(x.id),status);
                select.classList.add("button-working");setTimeout(()=>select.classList.remove("button-working"),700);
            }catch(e){alert("Order status could not be updated: "+e.message)}
        });

        list.querySelectorAll("[data-save-checkout-delivery]").forEach(b=>b.onclick=async()=>{
            const x=orders.find(o=>String(o.id)===String(b.dataset.saveCheckoutDelivery));if(!x)return;
            try { x.j.deliveryDate=list.querySelector(`[data-checkout-delivery-date="${CSS.escape(x.id)}"]`)?.value||""; x.j.deliveryTime=list.querySelector(`[data-checkout-delivery-time="${CSS.escape(x.id)}"]`)?.value||""; x.j.deliveryLocation=list.querySelector(`[data-checkout-delivery-location="${CSS.escape(x.id)}"]`)?.value||""; const u=await d.from("quote_requests").update({journey:JSON.stringify(x.j)}).eq("id",x.id);if(u.error)throw u.error;message("Checkout delivery details saved.","success"); } catch(e){alert("Delivery details could not be saved: "+e.message)}
        });

        list.querySelectorAll("[data-checkout-details]").forEach(b=>b.onclick=()=>{
            const x=orders.find(o=>String(o.id)===String(b.dataset.checkoutDetails));if(!x)return;
            const details=`Customer: ${x.full_name||""}\nPhone: ${x.phone||""}\nWhatsApp: ${x.whatsapp||""}\nEmail: ${x.email||""}\nLocation: ${x.location||""}\nPayment: ${x.j.paymentStatus||"pending"}\nOrder Status: ${x.j.orderStatus||"under_review"}\nItems:\n${(x.j.items||[]).map(i=>`• ${i.name} × ${i.quantity} — GHS ${Number(i.total||0).toFixed(2)}`).join("\n")}`;
            if(window.aprilsShowSubmissionDetails) window.aprilsShowSubmissionDetails("Checkout Order Details",x,details,[]);
            else alert(details);
        });

        list.querySelectorAll("[data-checkout-invoice]").forEach(b=>b.onclick=async()=>{
            const x=orders.find(o=>String(o.id)===String(b.dataset.checkoutInvoice));if(!x)return;
            if(!window.aprilsOpenInvoiceGenerator){alert("Invoice generator is not ready yet.");return;}
            const manualLines=[];
            for(const i of (x.j.items||[])){ manualLines.push({description:i.name,quantity:Number(i.quantity||1),unitPrice:await getCheckoutInvoicePrice(d,i.name,i.unitPrice),details:[i.size,i.measurements,i.colour,i.details,i.description].filter(Boolean).join(" • ")||"Order details not supplied"}); }
            await window.aprilsOpenInvoiceGenerator({id:x.id,full_name:x.full_name||"",phone:x.phone||"",whatsapp:x.whatsapp||x.phone||"",email:x.email||"",location:x.location||""},{manualLines,notes:"Checkout order",invoiceNumber:x.j.invoiceNumber||"",training:false,checkout:true,deliveryDate:x.j.deliveryDate||"",deliveryTime:x.j.deliveryTime||"",deliveryLocation:x.j.deliveryLocation||""});
        });

        list.querySelectorAll("[data-checkout-paid]").forEach(b=>b.onclick=async()=>{
            const x=orders.find(o=>String(o.id)===String(b.dataset.checkoutPaid));if(!x)return;
            if(!confirm("Confirm payment received and deduct the purchased quantities from inventory?"))return;
            busy(b,true,"Processing…");
            try{
                for(const item of x.j.items||[]){
                    const inv=await d.from("settings").select("id,setting_key,setting_value").eq("id",item.inventoryId).maybeSingle();
                    if(!inv.data)continue;
                    let v={};try{v=JSON.parse(inv.data.setting_value||"{}")}catch(_){}
                    v.quantity=Math.max(0,Number(v.quantity||0)-Number(item.quantity||0));
                    const u=await d.from("settings").update({setting_value:JSON.stringify(v),updated_at:new Date().toISOString()}).eq("id",inv.data.id);
                    if(u.error)throw u.error;
                }
                x.j.paymentStatus="paid";x.j.orderStatus="order_taken";
                const invoiceNumber=x.j.invoiceNumber||("AS-CO-"+String(x.id).replace(/[^a-zA-Z0-9]/g,"").slice(-8).toUpperCase());
                x.j.invoiceNumber=invoiceNumber;
                const u=await d.from("quote_requests").update({journey:JSON.stringify(x.j)}).eq("id",x.id);if(u.error)throw u.error;

                // Keep checkout, invoice, payment and accounting records synchronized.
                const invoiceKey="invoice_record_"+slug(invoiceNumber);
                const pricedLines=[];
                for(const i of (x.j.items||[])){ const unitPrice=await getCheckoutInvoicePrice(d,i.name,i.unitPrice); pricedLines.push({description:i.name,quantity:Number(i.quantity||1),unitPrice,details:[i.size,i.measurements,i.colour,i.details,i.description].filter(Boolean).join(" • ")||"Order details not supplied"}); }
                const invoiceSubtotal=pricedLines.reduce((sum,line)=>sum+Number(line.quantity||0)*Number(line.unitPrice||0),0);
                const invoiceRecord={invoiceNumber,date:new Date().toLocaleString("en-GB", {timeZone:"UTC", day:"2-digit", month:"2-digit", year:"numeric"}),savedAt:new Date().toISOString(),customer:x.full_name||"",phone:x.phone||"",email:x.email||"",address:x.location||"",lines:pricedLines,subtotal:invoiceSubtotal,discount:0,total:invoiceSubtotal,notes:"Checkout order",training:false,status:"fully_paid",deliveryDate:x.j.deliveryDate||"",deliveryTime:x.j.deliveryTime||"",deliveryLocation:x.j.deliveryLocation||""};
                await save(invoiceKey,invoiceRecord);
                await save("invoice_payment_record_"+slug(invoiceNumber)+"_"+Date.now(),{invoiceNumber,amount:Number(invoiceRecord.total||0),date:new Date().toLocaleString("en-GB", {timeZone:"UTC", day:"2-digit", month:"2-digit", year:"numeric"}),savedAt:new Date().toISOString(),method:x.j.paymentMethod||"Checkout payment",customer:x.full_name||""});
                const receiptNumber="AS-RC-"+Date.now().toString().slice(-8);
                await save("receipt_record_"+slug(receiptNumber),{receiptNumber,invoiceNumber,customer:x.full_name||"",phone:x.phone||"",email:x.email||"",amount:Number(invoiceRecord.total||0),method:x.j.paymentMethod||"Checkout payment",date:new Date().toLocaleString("en-GB", {timeZone:"UTC", day:"2-digit", month:"2-digit", year:"numeric"}),status:"Payment recorded",savedAt:new Date().toISOString(),lines:invoiceRecord.lines,total:Number(invoiceRecord.total||0)});
                await loadCheckoutOrders();await loadInventory();
                if(window.loadErrorLog){} 
                alert("Payment recorded, stock deducted, invoice saved, and accounting synchronized.");
            }catch(e){alert(e.message)}finally{busy(b,false)}
        });
    }catch(e){list.innerHTML=`<div class="empty">Checkout orders could not be loaded: ${esc(e.message)}</div>`}
} async function syncInventoryFromPayment(invoiceNumber){const d=db();if(!d||!invoiceNumber)return;const key="inventory_deducted_invoice_"+slug(invoiceNumber);const old=await d.from("settings").select("id").eq("setting_key",key).limit(1);if(old.data?.length)return;const rec=await d.from("settings").select("setting_value").eq("setting_key","invoice_record_"+slug(invoiceNumber)).limit(1);if(!rec.data?.length)return;let invoice={};try{invoice=JSON.parse(rec.data[0].setting_value||"{}")}catch(_){}const invRows=await getInventory();for(const line of invoice.lines||[]){const item=invRows.find(i=>String(i.name).trim().toLowerCase()===String(line.description).trim().toLowerCase());if(!item)continue;let v={...item};v.quantity=Math.max(0,Number(v.quantity||0)-Number(line.quantity||0));await d.from("settings").update({setting_value:JSON.stringify({...v,id:undefined,setting_key:undefined}),updated_at:new Date().toISOString()}).eq("id",item.id)}await save(key,{invoiceNumber,deductedAt:new Date().toISOString()});await loadInventory()}
 async function loadErrorLog(){const list=document.getElementById("errorLogList");if(!list)return;try{const rs=(await rows()).filter(r=>String(r.setting_key||"").startsWith("system_error_")).map(r=>{try{return{...JSON.parse(r.setting_value||"{}"),id:r.id}}catch(_){return null}}).filter(Boolean).sort((a,b)=>String(b.time).localeCompare(String(a.time)));list.innerHTML=rs.length?`<table><thead><tr><th>Time</th><th>Page</th><th>Error</th></tr></thead><tbody>${rs.map(x=>`<tr><td>${esc(x.time)}</td><td>${esc(x.page)}</td><td><pre style="white-space:pre-wrap">${esc(x.message)}</pre></td></tr>`).join("")}</tbody></table>`:`<div class="empty">No logged system errors.</div>`}catch(e){list.innerHTML=`<div class="empty">Error log could not be loaded: ${esc(e.message)}</div>`}}
 function setup(){let errorLock=false;window.addEventListener("error",async event=>{if(errorLock||!db())return;errorLock=true;try{await save("system_error_"+Date.now()+"_"+Math.random().toString(36).slice(2,7),{time:new Date().toISOString(),page:location.pathname,message:event.error?.stack||event.message||"Unknown JavaScript error"})}catch(_){}finally{errorLock=false}});window.addEventListener("unhandledrejection",async event=>{if(errorLock||!db())return;errorLock=true;try{await save("system_error_"+Date.now()+"_"+Math.random().toString(36).slice(2,7),{time:new Date().toISOString(),page:location.pathname,message:event.reason?.stack||String(event.reason||"Unhandled promise rejection")})}catch(_){}finally{errorLock=false}});
  const form=document.getElementById("inventoryForm");
  if(form&&!form.dataset.bound){form.dataset.bound="1";form.addEventListener("submit",async e=>{e.preventDefault();const btn=form.querySelector('button[type="submit"]');busy(btn,true,"Saving…");try{const id=document.getElementById("inventoryId").value.trim();const file=document.getElementById("inventoryImage")?.files?.[0];let image=await fileToDataUrl(file);const val={collection:document.getElementById("inventoryCollection").value.trim(),name:document.getElementById("inventoryName").value.trim(),price:Number(document.getElementById("inventoryPrice").value||0),quantity:Number(document.getElementById("inventoryQuantity").value||0),display_order:Number(document.getElementById("inventoryOrder").value||1),description:document.getElementById("inventoryDescription").value.trim(),active:document.getElementById("inventoryActive").checked,updatedAt:new Date().toISOString()};if(!val.name)throw new Error("Enter a garment name.");if(!image&&id){const old=await db().from("settings").select("setting_value").eq("id",id).maybeSingle();if(old.data){try{image=JSON.parse(old.data.setting_value||"{}").image||""}catch(_){}}}val.image=image;let key="inventory_item_"+slug(val.collection+"_"+val.name);if(id){const old=await db().from("settings").select("setting_key").eq("id",id).maybeSingle();if(old.error)throw old.error;if(old.data?.setting_key)key=old.data.setting_key;const u=await db().from("settings").update({setting_value:JSON.stringify(val),updated_at:new Date().toISOString()}).eq("id",id);if(u.error)throw u.error}else{const r=await save(key,val);if(r.error)throw r.error}form.reset();document.getElementById("inventoryId").value="";document.getElementById("inventoryActive").checked=true;await loadInventory();await renderShopPreview();alert("Inventory item saved successfully.")}catch(e){alert("Inventory could not be saved: "+e.message)}finally{busy(btn,false)}})}
  document.getElementById("addInventoryCollection")?.addEventListener("click",async()=>{const name=prompt("Enter the collection name:");if(!name?.trim())return;try{const clean=name.trim();const items=await getInventory();if(items.some(x=>String(x.collection||"").trim().toLowerCase()===clean.toLowerCase())){message("That collection already exists.","error");return;}const settings=await rows();const max=Math.max(0,...settings.filter(r=>String(r.setting_key||"").startsWith("inventory_collection_order_")).map(r=>Number(r.setting_value||0)));await save("inventory_collection_order_"+slug(clean),String(max+1));message("Collection added. Add inventory items to this collection when ready.","success");await loadInventory();}catch(e){message("Collection could not be added: "+e.message,"error")}});
  document.getElementById("inventoryExport")?.addEventListener("click",async e=>{const b=e.currentTarget;busy(b,true,"Exporting…");try{exportInventoryCsv(await getInventory())}finally{busy(b,false)}});
  document.getElementById("inventorySharePdf")?.addEventListener("click",async e=>{const b=e.currentTarget;busy(b,true,"Preparing PDF…");try{await exportInventoryPdf()}finally{busy(b,false)}});
  document.getElementById("inventoryCancel")?.addEventListener("click",()=>{form?.reset();document.getElementById("inventoryId").value="";document.getElementById("inventoryActive").checked=true});
  document.getElementById("refreshErrorLog")?.addEventListener("click",async e=>{const b=e.currentTarget;busy(b,true,"Refreshing…");try{await loadErrorLog()}finally{busy(b,false)}});
  document.getElementById("clearErrorLog")?.addEventListener("click",async e=>{if(!confirm("Clear all system error log entries?"))return;const b=e.currentTarget;busy(b,true,"Clearing…");try{const d=db();const rs=(await rows()).filter(r=>String(r.setting_key||"").startsWith("system_error_"));for(const r of rs){const x=await d.from("settings").delete().eq("id",r.id);if(x.error)throw x.error}await loadErrorLog()}catch(err){alert(err.message)}finally{busy(b,false)}});
 }
 window.loadInventory=loadInventory;window.loadCheckoutOrders=loadCheckoutOrders;window.loadErrorLog=loadErrorLog;window.syncInventoryFromPayment=syncInventoryFromPayment;window.renderShopPreview=renderShopPreview;window.setupCommerceAdmin=setup;setup();
})();

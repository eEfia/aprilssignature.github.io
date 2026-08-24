(function(){
"use strict";
const tableMsg = "This section needs the included Supabase database setup to be run once. The rest of the admin dashboard is unchanged.";

function e(v){return String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));}
function n(v){return Number(v||0);}

async function inventoryRows(){
  if(!window.db) return [];
  const r=await db.from("inventory_items").select("*").order("created_at",{ascending:false});
  if(r.error) throw r.error;
  return r.data||[];
}
async function loadInventory(){
  const list=document.getElementById("inventoryList"); if(!list)return;
  try{
    const rows=await inventoryRows();
    list.innerHTML=rows.length?`<table><thead><tr><th>Item</th><th>SKU</th><th>Collection</th><th>Category</th><th>Available</th><th>Price</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows.map(r=>{
      const qty=n(r.quantity), status=qty<=0?"Out of Stock":(r.active===false?"Hidden":"In Stock");
      return `<tr><td>${e(r.name)}</td><td>${e(r.sku||"")}</td><td>${e(r.collection||"")}</td><td>${e(r.category||"")}</td><td>${qty}</td><td>${r.price==null?"—":"GHS "+n(r.price).toFixed(2)}</td><td><strong>${status}</strong></td><td><button class="secondary" data-inv-edit="${e(r.id)}">Edit</button> <button class="danger" data-inv-delete="${e(r.id)}">Delete</button></td></tr>`;
    }).join("")}</tbody></table>`:`<div class="empty">No inventory items yet.</div>`;
    list.querySelectorAll("[data-inv-edit]").forEach(b=>b.onclick=async()=>{
      const r=rows.find(x=>String(x.id)===String(b.dataset.invEdit)); if(!r)return;
      document.getElementById("inventoryId").value=r.id;
      document.getElementById("inventoryName").value=r.name||"";
      document.getElementById("inventorySku").value=r.sku||"";
      document.getElementById("inventoryCollection").value=r.collection||"";
      document.getElementById("inventoryCategory").value=r.category||"";
      document.getElementById("inventoryQuantity").value=n(r.quantity);
      document.getElementById("inventoryPrice").value=r.price==null?"":r.price;
      document.getElementById("inventoryActive").checked=r.active!==false;
    });
    list.querySelectorAll("[data-inv-delete]").forEach(b=>b.onclick=async()=>{
      if(!confirm("Delete this inventory item?"))return;
      const r=await db.from("inventory_items").delete().eq("id",b.dataset.invDelete);
      if(r.error){message("Could not delete inventory item: "+r.error.message,"error");return;}
      message("Inventory item deleted.","success"); await loadInventory(); await loadCheckout();
    });
    await loadInventoryTransactions();
  }catch(err){console.error(err);list.innerHTML=`<div class="empty">${e(tableMsg)}<br><small>${e(err.message||"")}</small></div>`;}
}
async function loadInventoryTransactions(){
  const box=document.getElementById("inventoryTransactionsList");if(!box)return;
  try{
    const r=await db.from("inventory_transactions").select("*,inventory_items(name)").order("created_at",{ascending:false}).limit(100);
    if(r.error)throw r.error;
    box.innerHTML=r.data?.length?`<table><thead><tr><th>Date</th><th>Item</th><th>Type</th><th>Quantity</th><th>Reference</th><th>Notes</th></tr></thead><tbody>${r.data.map(x=>`<tr><td>${e(new Date(x.created_at).toLocaleString())}</td><td>${e(x.inventory_items?.name||"")}</td><td>${e(x.transaction_type||"")}</td><td>${n(x.quantity)}</td><td>${e(x.reference||"")}</td><td>${e(x.notes||"")}</td></tr>`).join("")}</tbody></table>`:`<div class="empty">No stock activity yet.</div>`;
  }catch(err){box.innerHTML=`<div class="empty">Stock activity is unavailable until the inventory tables are installed.</div>`;}
}
async function saveInventory(event){
 event.preventDefault();
 const id=document.getElementById("inventoryId").value.trim();
 const payload={name:document.getElementById("inventoryName").value.trim(),sku:document.getElementById("inventorySku").value.trim(),collection:document.getElementById("inventoryCollection").value.trim(),category:document.getElementById("inventoryCategory").value.trim(),quantity:n(document.getElementById("inventoryQuantity").value),price:document.getElementById("inventoryPrice").value===""?null:n(document.getElementById("inventoryPrice").value),active:document.getElementById("inventoryActive").checked};
 if(!payload.name){message("Enter the inventory item name.","error");return;}
 try{
   let r;
   if(id) r=await db.from("inventory_items").update({...payload,updated_at:new Date().toISOString()}).eq("id",id);
   else r=await db.from("inventory_items").insert(payload);
   if(r.error)throw r.error;
   document.getElementById("inventoryForm").reset();document.getElementById("inventoryId").value="";document.getElementById("inventoryActive").checked=true;
   message("Inventory item saved.","success");await loadInventory();await loadCheckout();
 }catch(err){message("Inventory could not be saved: "+err.message,"error");}
}
async function loadCheckout(){
 const select=document.getElementById("checkoutItem"); if(!select)return;
 try{
   const rows=(await inventoryRows()).filter(r=>r.active!==false && n(r.quantity)>0);
   select.innerHTML='<option value="">Select stock item</option>'+rows.map(r=>`<option value="${e(r.id)}" data-price="${n(r.price)}">${e(r.name)} — ${n(r.quantity)} available</option>`).join("");
   select.onchange=()=>{const o=select.selectedOptions[0];if(o&&n(document.getElementById("checkoutUnitPrice").value)===0)document.getElementById("checkoutUnitPrice").value=n(o.dataset.price).toFixed(2);};
   await loadCheckoutOrders();
 }catch(err){select.innerHTML='<option value="">Inventory setup required</option>';document.getElementById("checkoutList").innerHTML=`<div class="empty">${e(tableMsg)}</div>`;}
}
async function loadCheckoutOrders(){
 const box=document.getElementById("checkoutList");if(!box)return;
 try{
  const r=await db.from("checkout_orders").select("*").order("created_at",{ascending:false}).limit(100);if(r.error)throw r.error;
  box.innerHTML=r.data?.length?`<table><thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead><tbody>${r.data.map(x=>`<tr><td>${e(x.order_number)}</td><td>${e(new Date(x.created_at).toLocaleString())}</td><td>${e(x.customer_name)}</td><td>${e(x.items?.map?.(i=>i.name+" × "+i.quantity).join(", ")||"")}</td><td>GHS ${n(x.total).toFixed(2)}</td><td>${e(x.payment_method)} / ${e(x.payment_status)}</td><td>${e(x.order_status)}</td></tr>`).join("")}</tbody></table>`:`<div class="empty">No checkout orders yet.</div>`;
 }catch(_){box.innerHTML='<div class="empty">Checkout orders are unavailable until the included database setup is installed.</div>';}
}
async function createCheckout(event){
 event.preventDefault();
 const itemId=document.getElementById("checkoutItem").value, qty=n(document.getElementById("checkoutQuantity").value), price=n(document.getElementById("checkoutUnitPrice").value);
 if(!itemId||qty<1||price<0){message("Select an item and enter a valid quantity and price.","error");return;}
 try{
  const items=await inventoryRows(), item=items.find(x=>String(x.id)===String(itemId));
  if(!item||n(item.quantity)<qty){message("There is not enough stock available.","error");return;}
  const total=qty*price;
  const paymentStatus=document.getElementById("checkoutPaymentStatus").value;
  const paidAmount=Math.min(total,Math.max(0,n(document.getElementById("checkoutPaidAmount").value)));
  const paid=paymentStatus==="paid" || paidAmount>=total;
  const order={order_number:"AS-"+Date.now(),customer_name:document.getElementById("checkoutCustomer").value.trim(),phone:document.getElementById("checkoutPhone").value.trim(),items:[{inventory_item_id:item.id,name:item.name,quantity:qty,unit_price:price}],subtotal:total,total:total,paid_amount:paid?total:paidAmount,payment_method:document.getElementById("checkoutPaymentMethod").value,payment_status:paid?"paid":(paidAmount>0?"part_paid":"pending"),payment_reference:document.getElementById("checkoutReference").value.trim(),order_status:paid?"Completed":"Awaiting Payment"};
  if(!order.customer_name){message("Enter the customer name.","error");return;}
  const r=await db.from("checkout_orders").insert(order).select().single();if(r.error)throw r.error;
  if(paid){
    // Prefer the database RPC because it is atomic. The direct update is only a compatibility fallback.
    const rpc=await db.rpc("record_inventory_sale",{p_inventory_item_id:item.id,p_quantity:qty,p_reference:order.order_number,p_notes:"Checkout sale"});
    if(rpc.error){
      const updated=await db.from("inventory_items").update({quantity:n(item.quantity)-qty,updated_at:new Date().toISOString()}).eq("id",item.id);
      if(updated.error)throw updated.error;
      await db.from("inventory_transactions").insert({inventory_item_id:item.id,transaction_type:"sale",quantity:qty,reference:order.order_number,notes:"Checkout sale"});
    }
  }
  document.getElementById("checkoutForm").reset();message("Checkout order created.","success");await loadCheckout();await loadInventory();
 }catch(err){message("Checkout could not be completed: "+err.message,"error");}
}
async function logError(source,error,details){
 try{
  const row={severity:"error",source:String(source||"website"),message:String(error?.message||error||"Unknown error"),details:typeof details==="string"?details:JSON.stringify(details||{}),url:location.href,user_agent:navigator.userAgent};
  if(window.db) await db.from("system_error_logs").insert(row);
  const local=JSON.parse(localStorage.getItem("aprils_error_log")||"[]");local.unshift({...row,created_at:new Date().toISOString()});localStorage.setItem("aprils_error_log",JSON.stringify(local.slice(0,100)));
 }catch(_){}
}
async function loadErrors(){
 const box=document.getElementById("errorLogList");if(!box)return;
 let rows=[];
 try{const r=await db.from("system_error_logs").select("*").order("created_at",{ascending:false}).limit(200);if(!r.error)rows=r.data||[];}catch(_){}
 if(!rows.length){try{rows=JSON.parse(localStorage.getItem("aprils_error_log")||"[]");}catch(_){}}
 box.innerHTML=rows.length?`<table><thead><tr><th>Date</th><th>Source</th><th>Message</th><th>Page</th><th>Details</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${e(r.created_at?new Date(r.created_at).toLocaleString():"")}</td><td>${e(r.source)}</td><td>${e(r.message)}</td><td>${e(r.url)}</td><td>${e(r.details)}</td></tr>`).join("")}</tbody></table>`:'<div class="empty">No errors have been recorded.</div>';
}
async function clearErrors(){
 if(!confirm("Clear the saved system error log?"))return;
 try{await db.from("system_error_logs").delete().neq("id","00000000-0000-0000-0000-000000000000");}catch(_){}
 localStorage.removeItem("aprils_error_log");await loadErrors();message("Error log cleared.","success");
}
function bind(){
 document.getElementById("inventoryForm")?.addEventListener("submit",saveInventory);
 document.getElementById("inventoryCancel")?.addEventListener("click",()=>{document.getElementById("inventoryForm").reset();document.getElementById("inventoryId").value="";});
 document.getElementById("checkoutForm")?.addEventListener("submit",createCheckout);
 document.getElementById("errorRefresh")?.addEventListener("click",loadErrors);
 document.getElementById("errorClear")?.addEventListener("click",clearErrors);
 document.querySelectorAll('.sidebar button[data-section="inventory"],.sidebar button[data-section="checkout"],.sidebar button[data-section="errors"]').forEach(button=>{
  button.addEventListener("click",async()=>{
   document.querySelectorAll(".sidebar button").forEach(b=>b.classList.remove("active"));button.classList.add("active");
   document.querySelectorAll(".section").forEach(s=>s.classList.remove("active"));
   document.getElementById(button.dataset.section)?.classList.add("active");
   if(button.dataset.section==="inventory")await loadInventory();
   if(button.dataset.section==="checkout")await loadCheckout();
   if(button.dataset.section==="errors")await loadErrors();
  });
 });
 window.addEventListener("error",ev=>logError("browser",ev.error||new Error(ev.message),{line:ev.lineno,column:ev.colno}));
 window.addEventListener("unhandledrejection",ev=>logError("promise",ev.reason));
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind);else bind();
window.aprilsInventory={loadInventory,loadCheckout,loadErrors,logError};
})();
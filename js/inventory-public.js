(function(){
"use strict";
function norm(v){return String(v||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");}
function badge(card,qty){
 let b=card.querySelector(".inventory-stock-badge");if(!b){b=document.createElement("div");b.className="inventory-stock-badge";card.appendChild(b);}
 b.textContent=qty>0?("Available: "+qty):"Out of Stock";b.classList.toggle("out",qty<=0);
}
async function start(){
 if(!window.db)return;
 try{
  const r=await db.from("inventory_items").select("name,quantity,active").eq("active",true);if(r.error)return;
  const rows=r.data||[];
  document.querySelectorAll(".gallery-item,.featured-card").forEach(card=>{
   const title=card.querySelector("h3")?.textContent||"";
   const alt=card.querySelector("img")?.alt||"";
   const key=norm(title||alt);
   const match=rows.find(x=>norm(x.name)===key||key.includes(norm(x.name))||norm(x.name).includes(key));
   if(match)badge(card,Number(match.quantity||0));
  });
 }catch(_){}
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();
(function(){
"use strict";
function esc(v){return String(v||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));}
function setFrame(frame,item){
 if(!frame)return;
 frame.classList.remove("is-visible");
 setTimeout(()=>{frame.innerHTML=item.type==="video"?`<video muted autoplay loop playsinline preload="metadata"><source src="${esc(item.url)}" type="video/mp4"></video>`:`<img src="${esc(item.url)}" alt="${esc(item.title||"Aprils Signature featured garment")}">`;requestAnimationFrame(()=>frame.classList.add("is-visible"));},250);
}
async function start(){
 const left=document.querySelector(".hero-side-left .hero-side-frame"),right=document.querySelector(".hero-side-right .hero-side-frame");
 if(!left||!right)return;
 let items=[];
 try{
  if(window.db){
   const r=await db.from("settings").select("setting_value").like("setting_key","homepage_featured_%");
   if(!r.error)items=(r.data||[]).map(x=>{try{return JSON.parse(x.setting_value||"{}")}catch(_){return null}}).filter(x=>x&&x.url&&x.active!==false).sort((a,b)=>Number(a.order||999)-Number(b.order||999));
  }
 }catch(_){}
 if(!items.length)items=[
  {title:"Featured garment",url:"images/photo (5).jpeg",type:"image"},
  {title:"Featured garment",url:"images/photo (7).jpeg",type:"image"},
  {title:"Featured garment",url:"images/photo (9).jpeg",type:"image"},
  {title:"Featured garment",url:"videos/video (2).mp4",type:"video"},
  {title:"Featured garment",url:"videos/video (3).mp4",type:"video"}
 ];
 items=items.filter(x=>x.url);
 if(!items.length)return;
 let index=Math.floor(Math.random()*items.length);
 function next(){
   const first=items[index%items.length], second=items[(index+1)%items.length];
   setFrame(left,first);setFrame(right,second);index=(index+2)%items.length;
 }
 next();
 setInterval(next,5000);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();
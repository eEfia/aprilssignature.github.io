"use strict";
/* Always check for the newest deployment so stale cached gallery/media order is never shown first. */
if("serviceWorker" in navigator){
  window.addEventListener("load",async()=>{
    try{
      const reg=await navigator.serviceWorker.register("/sw.js",{scope:"/",updateViaCache:"none"});
      await reg.update();
      let refreshed=false;
      navigator.serviceWorker.addEventListener("controllerchange",()=>{
        if(!refreshed){refreshed=true; window.location.reload();}
      });
    }catch(_){}
  });
}

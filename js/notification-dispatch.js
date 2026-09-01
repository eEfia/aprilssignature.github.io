"use strict";
/* Aprils Signature — secure client-side trigger for server-side notifications.
   The public site never contains provider secrets. It only asks the Supabase Edge
   Function to process the notification row created by the database trigger. */
(function(){
  function cfg(){ return window.APRILS_SUPABASE_CONFIG || {}; }
  function dispatch(sourceTable, sourceId, customer){
    if(!sourceTable) return Promise.resolve(false);
    const c=cfg(); if(!c.url || !c.publishableKey) return Promiseolve(false);
    const url=String(c.url).replace(/\/$/,"")+"/functions/v1/notify-new-submission";
    return fetch(url,{method:"POST",headers:{"Content-Type":"application/json","apikey":c.publishableKey,"Authorization":"Bearer "+c.publishableKey},body:JSON.stringify({source_table:sourceTable,source_id:sourceId?String(sourceId):"",customer_phone:String(customer?.phone||""),customer_email:String(customer?.email||"")})})
      .then(r=>r.json().catch(()=>({}))).then(x=>!!x.ok).catch(()=>false);
  }
  window.aprilsDispatchNotification=dispatch;
})();

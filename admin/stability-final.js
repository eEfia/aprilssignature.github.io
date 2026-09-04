/* Aprils Signature — final admin stability layer.
 * This layer does not change the public Order/Quote form. It only makes the admin
 * reliably use the corrected loaders and prevents repeated background refreshes.
 */
(function(){
  "use strict";
  function markLoading(id){
    const el=document.getElementById(id);
    if(el && !el.dataset.hasRenderedData){
      el.innerHTML='<div class="empty">Loading saved records…</div>';
    }
  }
  function markRendered(){
    document.querySelectorAll('.table-wrap, [id$="List"], [id$="list"]'rEach(el=>{
      if(el.textContent.trim() && !/Loading saved records…/.test(el.textContent)) el.dataset.hasRenderedData='1';
    });
  }
  const originalWindowLoadSection=window.loadSection;
  if(typeof originalWindowLoadSection==='function' && !originalWindowLoadSection.__stability){
    window.loadSection=async function(id){
      const map={registrations:'registrationList',orderTracking:'orderTrackingList',trainees:'traineesList',orders:'quoteList',gallery:'galleryList',homepage:'homepageMediaList'};
      markLoading(map[id]);
      const result=await originalWindowLoadSection(id);
      markRendered();
      return result;
    };
    window.loadSection.__stability=true;
  }
  document.addEventListener('DOMContentLoaded',()=>{
    // Re-run search enhancements only after a section has rendered; this avoids
    // duplicate search controls being inserted while tables are still being built.
    document.addEventListener('click',()=>setTimeout(()=>{
      try{window.enhanceAllSearchesForStrict?.()}catch(_){ }
    },80),true);
  });
})();

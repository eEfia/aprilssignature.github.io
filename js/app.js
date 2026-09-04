(function(){
'use strict';
// Fresh public runtime: one startup path, no stacked correction scripts.
const boot=()=>{ document.documentElement.classList.add('app-ready'); };
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
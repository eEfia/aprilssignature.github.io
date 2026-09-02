/* Aprils Signature — automatic spacing for user-entered text.
   Excludes credentials, contact numbers, URLs, email fields and search controls. */
(function(){
'use strict';
function shouldSkip(el){if(!el||!(el.matches('input,textarea')))return true;const type=String(el.type||'text').toLowerCase();const meta=(String(el.id||'')+' '+String(el.name||'')+' '+String(el.placeholder||'')).toLowerCase();return ['password','email','tel','url','search','number','date','time','file'].includes(type)||/(password|token|secret|search|phone|whatsapp|email|url|website|link)/i.test(meta)}
function normalize(v,textarea){let s=String(v??'');if(textarea){s=s.split(/\r?\n/).map(x=>x.repla \t]+/g,' ').trim()).join('\n').replace(/\n{3,}/g,'\n\n')}else{s=s.replace(/\s+/g,' ').trim()}s=s.replace(/([A-Za-z])([0-9])/g,'$1 $2').replace(/([0-9])([A-Za-z])/g,'$1 $2');return s}
function apply(el){if(shouldSkip(el))return;const old=el.value,newValue=normalize(old,el.tagName==='TEXTAREA');if(old===newValue)return;const pos=typeof el.selectionStart==='number'?el.selectionStart:null;el.value=newValue;if(pos!==null&&document.activeElement===el){const delta=newValue.length-old.length;try{el.setSelectionRange(Math.max(0,pos+delta),Math.max(0,pos+delta))}catch(_){}}}
document.addEventListener('blur',e=>apply(e.target),true);document.addEventListener('change',e=>apply(e.target),true);document.addEventListener('submit',e=>{e.target.querySelectorAll('input,textarea').forEach(apply)},true);
})();

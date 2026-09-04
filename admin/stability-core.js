/* Aprils Signature — Stabilization Core
   One small integration layer. It intentionally does not replace admin.js.
   It prevents duplicate UI patches, keeps actions observable, and supplies
   reliable table overflow/sidebar behaviour without adding database tables. */
(function(){
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
  const msg=(t,type='success')=>window.message?window.message(t,type):console[type==='error'?'error':'log'](t);

  function normalizeLabels(){
    $$('button,a').forEach(el=>{
      const t=(el.textContent||'').trim();
      if(/^share$/i.test(t)) el.textContent='Share PDF';
    });
  }

  function makeTablesScrollable(){
    $$('table').forEach(table=>{
      let parent=table.parentElement;
      if(parent && parent.classList.contains('table-wrap')) return;
      const wrap=document.createElement('div'); wrap.className='table-wrap aprils-safe-table-wrap';
      table.parentNode.insertBefore(wrap,table); wrap.appendChild(table);
    });
  }

  function sidebar(){
    const side=$('.sidebar'); if(!side || $('#aprilsSidebarToggle')) return;
    const btn=document.createElement('button'); btn.type='button'; btn.id='aprilsSidebarToggle';
    btn.className='secondary'; btn.textContent='☰'; btn.title='Collapse or expand navigation';
    Object.assign(btn.style,{position:'sticky',top:'0',margin:'8px',zIndex:'3'});
    side.prepend(btn);
    const state=localStorage.getItem('aprils-admin-sidebar-collapsed')==='1';
    const apply=v=>{document.body.classList.toggle('aprils-sidebar-collapsed',v); localStorage.setItem('aprils-admin-sidebar-collapsed',v?'1':'0');};
    apply(state); btn.addEventListener('click',()=>apply(!document.body.classList.contains('aprils-sidebar-collapsed')));
  }

  async function shareTablePdf(wrap){
    const table=wrap?.querySelector('table');
    if(!table){ msg('There is no saved table data to share.','error'); return; }
    if(!window.pdfFromVisibleElement){ msg('PDF service is still loading. Please try again in a moment.','error'); return; }
    const root=document.createElement('div');
    root.style.cssText='background:#fff;color:#111;padding:18px;width:190mm;font-family:Arial,sans-serif';
    root.innerHTML='<h1>Aprils Signature</h1><h2>Saved Records</h2><p>Generated: '+esc(new Date().toLocaleString('en-GB'))+'</p>';
    const clone=table.cloneNode(true); clone.querySelectorAll('button').forEach(b=>b.remove()); root.appendChild(clone); document.body.appendChild(root);
    try{
      const blob=await window.pdfFromVisibleElement(root,{margin:.3,image:{type:'jpeg',quality:.98},html2canvas:{scale:2,useCORS:true},jsPDF:{unit:'mm',format:'a4',orientation:'landscape'}});
      const file=new File([blob],'Aprils-Signature-Records.pdf',{type:'application/pdf'});
      if(navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))){ await navigator.share({title:'Aprils Signature Records',files:[file]}); return; }
      const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(u),2000);
      msg('PDF downloaded because this browser does not support file sharing.','success');
    }catch(e){ if(e?.name!=='AbortError') msg('PDF could not be generated: '+e.message,'error'); }
    finally{root.remove();}
  }

  function printTable(wrap){
    const table=wrap?.querySelector('table'); if(!table){msg('There is no table data to print.','error');return;}
    const w=window.open('','_blank'); if(!w){msg('Please allow pop-ups so the print window can open.','error');return;}
    const clone=table.cloneNode(true); clone.querySelectorAll('button').forEach(b=>b.remove());
    w.document.write('<!doctype html><html><head><title>Aprils Signature</title><style>@page{size:A4 landscape;margin:10mm}body{font-family:Arial;color:#111}table{border-collapse:collapse;width:100%}th,td{border:1px solid #777;padding:6px;font-size:10px;text-align:left}</style></head><body><h1>Aprils Signature</h1>'+clone.outerHTML+'</body></html>');
    w.document.close(); w.focus(); setTimeout(()=>w.print(),350);
  }

  function addMissingTableTools(){
    $$('.section .table-wrap').forEach(wrap=>{
      if(!wrap.querySelector('table') || wrap.dataset.aprilsTools==='1') return;
      // Do not duplicate the application's own controls.
      if(wrap.previousElementSibling?.classList?.contains('toolbar') || wrap.previousElementSibling?.querySelector?.('input[type="search"]')) { wrap.dataset.aprilsTools='1'; return; }
      const bar=document.createElement('div'); bar.className='toolbar aprils-stability-tools';
      bar.innerHTML='<input type="search" placeholder="Search saved records"><button type="button" class="secondary">Share PDF</button><button type="button" class="secondary">Print</button>';
      const search=$('input',bar); search.addEventListener('input',()=>{const q=search.value.trim().toLowerCase();$$('tbody tr',wrap).forEach(r=>r.hidden=!!q && !(r.innerText||'').toLowerCase().includes(q));});
      const bs=$$('button',bar); bs[0].addEventListener('click',()=>shareTablePdf(wrap)); bs[1].addEventListener('click',()=>printTable(wrap));
      wrap.parentNode.insertBefore(bar,wrap); wrap.dataset.aprilsTools='1';
    });
  }

  function diagnostics(){
    document.addEventListener('click',e=>{
      const b=e.target.closest('button'); if(!b || b.disabled) return;
      b.classList.add('button-working'); clearTimeout(b._aprilsBusyTimer);
      b._aprilsBusyTimer=setTimeout(()=>b.classList.remove('button-working'),1000);
    },true);
  }

  function boot(){ normalizeLabels(); makeTablesScrollable(); sidebar(); addMissingTableTools(); diagnostics();
    const mo=new MutationObserver(()=>{normalizeLabels(); makeTablesScrollable(); addMissingTableTools();});
    mo.observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();

// site.js — gedeeld gedrag van www.pidlane.nl: navigatie, mobiele actiebalk,
// scroll-reveals en de meekijk-demo (.rm). Pagina-eigen code staat in de pagina zelf.
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── Navigatie + mobiele actiebalk (niet tonen zolang het doelblok in beeld is) ──
(function(){
  const nav=document.getElementById('nav'), mbar=document.getElementById('mbar');
  const doel=mbar && document.getElementById(mbar.dataset.doel||'demo');
  function upd(){
    const y=scrollY;
    if(nav) nav.classList.toggle('sc', y>30);
    if(mbar){ const r=doel?doel.getBoundingClientRect():null; mbar.classList.toggle('on', y>600 && !(r && r.top<innerHeight && r.bottom>0)); }
  }
  addEventListener('scroll',upd,{passive:true}); upd();
})();

// ── Meekijk-demo: twee schermen met dezelfde live waarden; de meekijker
//    vraagt foutcodes op en zet een extra sensor aan, die dan bij de auto verschijnt. ──
(function(){
  document.querySelectorAll('.rm').forEach(function(rm){
    const sets=[...rm.querySelectorAll('[data-rm-m]')];
    const log=rm.querySelector('[data-rm-log]'), btnD=rm.querySelector('[data-rm-dtc]'), btnP=rm.querySelector('[data-rm-pid]');
    const V={rpm:[780,860,0,5000,'toeren'],cool:[86,91,0,130,'°C'],volt:[14.0,14.4,10,16,'V'],ltft:[1.5,4.5,-25,25,'%']};
    function val(k){ const v=V[k]; return v[0]+Math.random()*(v[1]-v[0]); }
    function fmt(k,x){ return k==='volt'?x.toFixed(1).replace('.',','):k==='ltft'?(x>=0?'+':'')+x.toFixed(1).replace('.',','):Math.round(x).toLocaleString('nl-NL'); }
    function tick(){
      const now={}; Object.keys(V).forEach(k=>now[k]=val(k));
      sets.forEach(function(set,i){
        setTimeout(function(){
          set.querySelectorAll('[data-k]').forEach(function(d){
            const k=d.dataset.k, v=V[k]; if(!v) return;
            d.querySelector('b').textContent=fmt(k,now[k]);
            const u=d.querySelector('u i'); if(u) u.style.width=Math.max(4,Math.min(100,(now[k]-v[2])/(v[3]-v[2])*100))+'%';
          });
        }, i*260); // de meekijker loopt een fractie achter: zo ziet het eruit als een live verbinding
      });
    }
    function add(html,cls){ if(!log) return; const d=document.createElement('div'); d.innerHTML=html; if(cls) d.className=cls; log.appendChild(d); while(log.children.length>4) log.removeChild(log.children[1]); }
    let stap=0;
    function verhaal(){
      stap++;
      if(stap===1) add('👁 <b>Meekijker verbonden</b> via code');
      if(stap===2 && btnP){ btnP.classList.add('on'); add('🔭 Volgt nu ook: <b>lange trim</b>');
        sets.forEach(function(set){ if(set.querySelector('[data-k="ltft"]')) return;
          const d=document.createElement('div'); d.className='new'; d.dataset.k='ltft'; d.innerHTML='<small>Lange trim</small><b>—</b><u><i></i></u>'; set.appendChild(d); }); }
      if(stap===3 && btnD){ btnD.classList.add('on'); add('📋 Foutcodes opgevraagd: <b>'+(rm.dataset.dtc||'geen')+'</b>', rm.dataset.dtc?'rd':''); }
      if(stap>=5){ stap=0; if(btnP) btnP.classList.remove('on'); if(btnD) btnD.classList.remove('on');
        rm.querySelectorAll('[data-k="ltft"].new').forEach(e=>e.remove());
        if(log) while(log.children.length>1) log.removeChild(log.lastChild); }
    }
    tick(); verhaal();
    if(RM){ verhaal(); verhaal(); tick(); return; }
    let t1,t2;
    new IntersectionObserver(function(es){
      if(es[0].isIntersecting){ if(!t1){ t1=setInterval(tick,1300); t2=setInterval(verhaal,2600); } }
      else { clearInterval(t1); clearInterval(t2); t1=t2=null; }
    }).observe(rm);
  });
})();

// ── Scroll-reveals ──
(function(){
  if(RM || !('IntersectionObserver' in window)){ document.querySelectorAll('.rv').forEach(el=>el.classList.add('on')); return; }
  const io=new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('on'); io.unobserve(e.target); } }),{threshold:.12,rootMargin:'0px 0px -40px 0px'});
  document.querySelectorAll('.rv').forEach(el=>io.observe(el));
})();

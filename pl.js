// pl.js — gedrag van www.pidlane.nl (30-10-2026): navigatie, onthullen, de
// Hyperlane-tunnel in de hero met een gesimuleerde rit, de scènekiezer, de
// banden×weer-proef en de meekijk-demo. Elk blok zoekt zijn eigen element en
// doet niets als dat er niet is, zodat elke pagina hetzelfde bestand laadt.
'use strict';
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => [...(el || document).querySelectorAll(s)];
const nl = (x, d) => x.toLocaleString('nl-NL', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });

// ── Navigatie, burger en mobiele actiebalk ──
(function () {
  const nav = $('#nav'), mbar = $('#mbar'), burg = $('.burg');
  const doel = mbar && document.getElementById(mbar.dataset.doel || 'download');
  function upd() {
    const y = scrollY;
    if (nav) nav.classList.toggle('sc', y > 30);
    if (mbar) { const r = doel && doel.getBoundingClientRect(); mbar.classList.toggle('on', y > 700 && !(r && r.top < innerHeight && r.bottom > 0)); }
  }
  addEventListener('scroll', upd, { passive: true }); upd();
  if (burg) burg.addEventListener('click', () => {
    const open = nav.classList.toggle('open'); burg.setAttribute('aria-expanded', open);
  });
  $$('.nav-l a').forEach(a => a.addEventListener('click', () => { nav.classList.remove('open'); burg && burg.setAttribute('aria-expanded', false); }));
})();

// ── Onthullen bij scrollen ──
(function () {
  const els = $$('.rv');
  if (RM || !('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('on')); return; }
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('on'); io.unobserve(e.target); } }), { threshold: .1, rootMargin: '0px 0px -40px 0px' });
  els.forEach(e => io.observe(e));
})();

// ── Hyperlane in de hero ──
// De tunnel is de shader uit pidlane-hyperlane.js (alleen de tunnel-tak, met
// remmen, koud, warp en de golf bij opschakelen). De rit is gesimuleerd en
// staat in RIT; stemming en kleur rekenen zoals stemming()/kleur() in de app.
const HL = (function () {
  const STOPS = [[0, [90, 200, 255]], [.35, [0, 255, 215]], [.6, [165, 95, 255]], [.82, [255, 165, 40]], [1, [255, 40, 70]]];
  const klem = (v, a, b) => Math.max(a, Math.min(b, v));
  function kleur(m) {
    m = klem(m, 0, 1);
    for (let i = 1; i < STOPS.length; i++) {
      const a = STOPS[i - 1], b = STOPS[i];
      if (m <= b[0]) { const t = (m - a[0]) / (b[0] - a[0]); return a[1].map((v, k) => v + (b[1][k] - v) * t); }
    }
    return STOPS[STOPS.length - 1][1].slice();
  }
  const stemming = (toeren, rood, gas) => klem(.65 * klem(toeren / rood, 0, 1) + .35 * klem(gas / 100, 0, 1), 0, 1);
  const modus = m => m < .3 ? 'ECO' : m < .55 ? 'CRUISE' : m < .8 ? 'SPORT' : 'MAX';
  // [t (s), km/h, gas %, scène]; na het einde loopt hij terug naar LUS
  const RIT = [[0, 0, 0, 'koud'], [5, 28, 32, 'koud'], [11, 52, 24, 'rijden'], [14, 50, 10, 'rijden'], [16.8, 0, 0, 'remmen'],
    [17, 0, 0, 'stil'], [20, 0, 0, 'stil'], [20.01, 0, 100, 'launch'], [24.4, 100, 100, 'launch'], [27, 122, 55, 'rijden'],
    [30, 118, 32, 'cruise'], [40, 118, 32, 'cruise'], [44, 74, 12, 'rijden'], [48, 52, 24, 'rijden']];
  const LUS = 11, EIND = 48, ROOD = 6500;
  const VERS = [0, 16, 32, 52, 74, 98], RATIO = [0, 118, 66, 45, 34, 28, 24];
  const SCENE = { koud: 'Motor koud', rijden: 'Rijden', remmen: 'Hard remmen', stil: 'Stilstand', launch: 'Launch 0–100', cruise: 'Cruise · zen' };
  function staat(t, eerste) {
    if (!eerste && t < LUS) t = LUS;
    let i = 1; while (i < RIT.length - 1 && RIT[i][0] < t) i++;
    const a = RIT[i - 1], b = RIT[i], f = klem((t - a[0]) / ((b[0] - a[0]) || 1), 0, 1);
    const v = a[1] + (b[1] - a[1]) * f, gas = a[2] + (b[2] - a[2]) * f;
    let g = 0; while (g < VERS.length - 1 && v > VERS[g + 1]) g++; g = v < 1 ? 0 : g + 1;
    const toeren = g ? klem(850 + v * RATIO[g] * (.75 + gas / 400), 900, ROOD + 200) : 850 + gas * 20;
    return { v, gas, toeren, g, scene: b[3] };
  }
  return { kleur, stemming, modus, staat, SCENE, LUS, EIND, ROOD };
})();

(function () {
  const cv = $('canvas.tun'); if (!cv) return;
  const hud = k => $('[data-hud="' + k + '"]');
  const FS = 'precision highp float;uniform vec2 R;uniform float T,Z,E,W,B,K,F;uniform vec3 C1,C2;' +
    'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}' +
    'void main(){vec2 q=(gl_FragCoord.xy-.5*R)/R.y;q.x-=.18*R.x/R.y*step(1.2,R.x/R.y);vec2 p=q;' +
    'float r=mix(length(p),max(abs(p.x)*.55,abs(p.y)),.7)+1e-3;float a=atan(p.y,p.x)/6.2831853;' +
    'float z=.32/r*(1.+F*1.6)+Z;float fog=smoothstep(.02,.45,r);' +
    'float lz=abs(fract(z)-.5),la=abs(fract(a*28.)-.5);' +
    'float ring=exp(-pow(lz*(3.+55.*r),2.))*fog;float rad=exp(-pow(la*r*70.,2.))*fog*.55;' +
    'vec2 cel=vec2(floor(a*56.),floor(z*3.+Z*2.));float s=step(.985-E*.05-F*.08,h(cel));float sz=fract(z*3.+Z*2.);' +
    'float st=s*smoothstep(0.,.7,sz)*smoothstep(1.,.85,sz)*exp(-pow(abs(fract(a*56.)-.5)*r*90.,2.))*fog;' +
    'float kern=.06/(r*r*30.+.25);' +
    'vec3 c=C1*ring*(.35+E*.9)+C2*rad*(.25+E*.5)+mix(C2,vec3(1),.4)*st*(1.2+E*2.)+C2*kern*(.5+E);' +
    'c+=mix(C2,vec3(1),.5)*exp(-pow((r-(.04+W*1.1))*22.,2.))*exp(-W*2.2)*1.6;' +
    'float l=dot(c,vec3(.3,.5,.2));c=mix(c,vec3(l)*vec3(.75,.95,1.3),K*.65);' +
    'c=mix(c,vec3(1.,.12,.16)*(l*1.6+.04),B*smoothstep(.15,-.45,q.y));c+=vec3(1.,.05,.1)*B*.35*smoothstep(-.25,-.65,q.y);' +
    'c*=1.-.35*smoothstep(.6,1.2,length(q));gl_FragColor=vec4(c*min(1.,T*.6),1.);}';
  let gl = null, U = {};
  try { gl = cv.getContext('webgl', { antialias: false, alpha: false }); } catch (e) { console.warn('pl: geen WebGL', e); }
  if (gl) {
    try {
      const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
      const pr = gl.createProgram();
      gl.attachShader(pr, sh(gl.VERTEX_SHADER, 'attribute vec2 v;void main(){gl_Position=vec4(v,0,1);}'));
      gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); gl.useProgram(pr);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(pr, 'v'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      'R T Z E W B K F C1 C2'.split(' ').forEach(n => U[n] = gl.getUniformLocation(pr, n));
    } catch (e) { console.warn('pl: shader faalt, val terug op het stilstaande beeld', e); gl = null; }
  }
  if (!gl) { cv.hidden = true; const alt = $('.tun-alt'); if (alt) alt.hidden = false; }
  function maat() {
    if (!gl) return;
    const k = Math.min(devicePixelRatio || 1, 1.5) * (innerWidth < 700 ? .6 : .75);
    cv.width = Math.round(cv.clientWidth * k); cv.height = Math.round(cv.clientHeight * k);
    gl.viewport(0, 0, cv.width, cv.height);
  }
  addEventListener('resize', maat); maat();

  let t0 = performance.now(), eerste = true, rit = 0, z = 0, gOud = 0, golf = 9, launch0 = null, launchT = null, zicht = true, raf = 0, vorig = t0;
  const sm = { m: 0, B: 0, K: 1, F: 0, c: HL.kleur(0) };
  function hudZet(s, m, t) {
    const set = (k, v) => { const e = hud(k); if (e) e.textContent = v; };
    set('v', nl(s.v)); set('toeren', nl(Math.round(s.toeren / 10) * 10));
    set('koel', nl(Math.min(90, 38 + (eerste ? t : 30) * 2.6)));
    set('modus', HL.modus(m)); set('gear', s.g ? String(s.g) : 'N');
    let sc = HL.SCENE[s.scene] || '';
    if (s.scene === 'launch') sc += ' · ' + nl(launchT != null ? launchT : (t - launch0 || 0), 1) + ' s';
    set('scene', sc);
    const h = $('.hud'); if (h) { h.style.setProperty('--hm', (m * 100).toFixed(1) + '%'); h.style.setProperty('--hc', 'rgb(' + sm.c.map(Math.round).join(',') + ')'); }
  }
  function frame(nu) {
    const dt = Math.min(.05, (nu - vorig) / 1000); vorig = nu;
    rit += dt; if (rit > HL.EIND) { rit = HL.LUS; eerste = false; }
    const t = rit, s = HL.staat(t, eerste);
    if (s.scene === 'launch') { if (launch0 == null) { launch0 = t; launchT = null; } if (s.v >= 99.5 && launchT == null) launchT = t - launch0; }
    else { launch0 = null; if (s.scene !== 'rijden') launchT = null; }
    if (s.g > gOud && gOud > 0) golf = 0; gOud = s.g; golf += dt;
    const m = HL.stemming(s.toeren, HL.ROOD, s.gas), a = 1 - Math.exp(-dt * 3);
    sm.m += (m - sm.m) * a; sm.c = HL.kleur(sm.m);
    sm.B += ((s.scene === 'remmen' ? 1 : 0) - sm.B) * a; sm.K += ((s.scene === 'koud' ? 1 : 0) - sm.K) * a * .6;
    sm.F += ((s.scene === 'launch' ? 1 : 0) - sm.F) * a;
    z += dt * (.06 + s.v / 140);
    if (gl) {
      const c2 = sm.c.map(v => v / 255), c1 = c2.map(v => v * .55);
      gl.uniform2f(U.R, cv.width, cv.height); gl.uniform1f(U.T, (nu - t0) / 1000); gl.uniform1f(U.Z, z);
      gl.uniform1f(U.E, Math.min(1, s.v / 160)); gl.uniform1f(U.W, golf); gl.uniform1f(U.B, sm.B); gl.uniform1f(U.K, sm.K);
      gl.uniform1f(U.F, sm.F); gl.uniform3fv(U.C1, c1); gl.uniform3fv(U.C2, c2);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    hudZet(s, sm.m, t);
    if (!RM && zicht && !document.hidden) raf = requestAnimationFrame(frame); else raf = 0;
  }
  function start() { if (!raf && !RM) { vorig = performance.now(); raf = requestAnimationFrame(frame); } }
  if (RM) { rit = 34; eerste = false; t0 -= 5000; sm.K = 0; sm.m = .4; vorig = performance.now() - 16; frame(performance.now()); return; }
  new IntersectionObserver(es => { zicht = es[0].isIntersecting; if (zicht) start(); }).observe(cv);
  document.addEventListener('visibilitychange', start);
  start();
})();

// ── Video's alleen afspelen als ze in beeld zijn (en nooit bij minder beweging) ──
(function () {
  const vs = $$('video[data-auto]'); if (!vs.length) return;
  if (RM || !('IntersectionObserver' in window)) { vs.forEach(v => { v.removeAttribute('autoplay'); v.controls = true; }); return; }
  const io = new IntersectionObserver(es => es.forEach(e => {
    const v = e.target;
    if (e.isIntersecting) { const p = v.play(); if (p) p.catch(err => console.warn('pl: video speelt niet af', err)); } else v.pause();
  }), { threshold: .25 });
  vs.forEach(v => io.observe(v));
})();

// ── Scènekiezer ──
(function () {
  const box = $('.scenes'); if (!box) return;
  const img = $('.sc-view img', box), nr = $('[data-sc="nr"]', box), tt = $('[data-sc="t"]', box), tx = $('[data-sc="p"]', box);
  const bs = $$('.sc-list button', box);
  // vooraf laden zodat wisselen niet knippert
  bs.forEach(b => { const i = new Image(); i.src = b.dataset.img; });
  function kies(b) {
    bs.forEach(x => x.setAttribute('aria-pressed', x === b));
    img.style.opacity = .25;
    setTimeout(() => { img.src = b.dataset.img; img.alt = 'Hyperlane, scène ' + b.dataset.t; img.style.opacity = 1; }, RM ? 0 : 160);
    nr.textContent = b.querySelector('span').textContent; tt.textContent = b.dataset.t; tx.textContent = b.dataset.p;
    box.style.setProperty('--sc', b.style.getPropertyValue('--c'));
  }
  bs.forEach(b => b.addEventListener('click', () => kies(b)));
  kies(bs[0]);
})();

// ── Banden: het oordeel is relatief aan de mediaan van de vier ──
// Zelfde drempels als PLBanden (pidlane-banden.js): 10% onder de mediaan
// oranje, 20% rood. De voorgeschreven druk kent de app niet.
(function () {
  const box = $('[data-banden]'); if (!box) return;
  const sl = $('input[type=range]', box), W = { lv: 2.4, rv: 2.4, la: 2.3, ra: 2.4 };
  const KL = { ok: '#1fb47a', w: '#e08a00', x: '#e0263c' };
  function mediaan(a) { const s = a.slice().sort((x, y) => x - y); return (s[1] + s[2]) / 2; }
  function upd() {
    W.rv = Number(sl.value);
    const md = mediaan(Object.values(W));
    let slecht = null;
    Object.keys(W).forEach(k => {
      const af = (md - W[k]) / md, st = af >= .2 ? 'x' : af >= .1 ? 'w' : 'ok';
      const el = $('[data-w="' + k + '"]', box);
      el.className = 'wiel' + (k[0] === 'r' ? ' r' : '') + (st !== 'ok' ? ' ' + st : '');
      $('b', el).innerHTML = nl(W[k], 1) + '<u>bar</u>';
      $('span', el).textContent = st === 'ok' ? 'gelijk' : '−' + nl(af * 100) + '% t.o.v. de rest';
      $('[data-t="' + k + '"]', box).setAttribute('fill', KL[st]);
      if (st !== 'ok' && (!slecht || st === 'x')) slecht = st;
    });
    const o = $('.oordeel', box);
    o.className = 'oordeel' + (slecht ? ' ' + slecht : '');
    $('p', o).textContent = slecht === 'x' ? 'Rechtsvoor staat ruim onder de andere drie. Stop en kijk de band na: dit is het patroon van een band die leegloopt.'
      : slecht === 'w' ? 'Rechtsvoor loopt achter op de rest. Nog niet gevaarlijk, wel iets om bij de volgende tankbeurt na te meten.'
      : 'Vier banden binnen 10% van elkaar. Of ze samen op de goede druk staan, zegt de deurstijl, niet de app.';
  }
  sl.addEventListener('input', upd); upd();
})();

// ── Winter: profiel + verwachting → hoogstens één advies ──
(function () {
  const box = $('[data-winter]'); if (!box) return;
  const P = { band: 'zomer', sproei: 'zomer' };
  const MIN = -4, MAX = 5;
  function upd() {
    $$('.seg', box).forEach(s => $$('button', s).forEach(b => b.setAttribute('aria-pressed', P[s.dataset.k] === b.dataset.v)));
    let t, bron;
    if (P.sproei === 'zomer' && MIN <= -1) { t = 'Vrijdagnacht −4 °C en in je sproeiertank zit zomervloeistof. Die bevriest: vul vóór vrijdag antivriesvloeistof bij.'; bron = 'profiel + verwachting'; }
    else if (P.band === 'zomer' && MAX < 7) { t = 'De komende drie dagen blijft het onder 7 °C. Een zomerband wordt dan hard en houdt minder grip, vooral op nat wegdek. Tijd voor winterbanden of all-season.'; bron = 'profiel + verwachting + bandentabel (model, geen meting)'; }
    else { t = 'Niets te melden. Banden en sproeier passen bij het weer van de komende dagen.'; bron = 'profiel + verwachting'; }
    $('.advies p', box).textContent = t; $('.advies em', box).textContent = 'bron: ' + bron;
  }
  $$('.seg', box).forEach(s => $$('button', s).forEach(b => b.addEventListener('click', () => { P[s.dataset.k] = b.dataset.v; upd(); })));
  upd();
})();

// ── Meekijk-demo: twee schermen, dezelfde waarden, de meekijker loopt een
//    fractie achter; hij vraagt foutcodes op en zet een sensor bij. ──
(function () {
  const rm = $('.rm'); if (!rm) return;
  const sets = $$('[data-rm-m]', rm), log = $('[data-rm-log]', rm);
  const V = { rpm: [780, 860], koel: [88, 91], volt: [14.0, 14.4], ltft: [10.5, 12.5] };
  const fmt = (k, x) => k === 'volt' ? nl(x, 1) : k === 'ltft' ? '+' + nl(x, 1) : nl(Math.round(x));
  function tick() {
    const nu = {}; Object.keys(V).forEach(k => nu[k] = V[k][0] + Math.random() * (V[k][1] - V[k][0]));
    sets.forEach((set, i) => setTimeout(() => $$('[data-k]', set).forEach(d => { $('b', d).textContent = fmt(d.dataset.k, nu[d.dataset.k]); }), i * 260));
  }
  function regel(html, cls) { const d = document.createElement('div'); d.innerHTML = html; if (cls) d.className = cls; log.appendChild(d); while (log.children.length > 3) log.removeChild(log.firstChild); }
  let stap = 0;
  function verhaal() {
    stap++;
    if (stap === 1) regel('Meekijker verbonden via <b>code 306 188</b>');
    if (stap === 2) { regel('Volgt nu ook: <b>lange brandstoftrim</b>');
      sets.forEach(set => { if ($('[data-k="ltft"]', set)) return; const d = document.createElement('div'); d.className = 'new'; d.dataset.k = 'ltft'; d.innerHTML = '<small>Lange trim %</small><b>—</b>'; set.appendChild(d); }); }
    if (stap === 3) regel('Foutcodes opgevraagd: <b>P0171</b> systeem te arm', 'rd');
    if (stap === 4) regel('Expert: <b>"Valse lucht. Kijk de inlaatslang na."</b>');
    if (stap >= 6) { stap = 0; $$('[data-k="ltft"].new', rm).forEach(e => e.remove()); log.innerHTML = ''; }
  }
  tick(); verhaal();
  if (RM) { verhaal(); verhaal(); verhaal(); tick(); return; }
  let t1, t2;
  new IntersectionObserver(es => {
    if (es[0].isIntersecting) { if (!t1) { t1 = setInterval(tick, 1300); t2 = setInterval(verhaal, 2600); } }
    else { clearInterval(t1); clearInterval(t2); t1 = t2 = null; }
  }).observe(rm);
})();

// ── Telemetrie: helling en G-spoor als langzame illustratie ──
(function () {
  const h = $('[data-tele="helling"]'), g = $('[data-tele="g"]'); if (!h && !g) return;
  if (RM) return;
  let vis = false, raf = 0;
  const pad = [];
  function f(nu) {
    const t = nu / 1000;
    const hoek = 4.2 * Math.sin(t * .45) + 1.5 * Math.sin(t * 1.1);
    if (h) { $('g', h).setAttribute('transform', 'rotate(' + (-hoek).toFixed(2) + ' 120 80)'); $('text[data-v]', h).textContent = nl(Math.abs(hoek), 1) + '°' + (hoek >= 0 ? ' omhoog' : ' omlaag'); }
    if (g) {
      const x = 60 + 38 * Math.sin(t * .7), y = 65 + 30 * Math.sin(t * 1.3 + 1);
      pad.push([x, y]); if (pad.length > 40) pad.shift();
      $('polyline', g).setAttribute('points', pad.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' '));
      $('circle[data-p]', g).setAttribute('cx', x.toFixed(1)); $('circle[data-p]', g).setAttribute('cy', y.toFixed(1));
      $('text[data-v]', g).textContent = nl(Math.hypot(x - 60, y - 65) / 100, 2) + ' g';
    }
    raf = vis ? requestAnimationFrame(f) : 0;
  }
  const io = new IntersectionObserver(es => { vis = es.some(e => e.isIntersecting); if (vis && !raf) raf = requestAnimationFrame(f); });
  [h, g].filter(Boolean).forEach(e => io.observe(e));
})();

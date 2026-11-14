#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════
   tools/foutcodes.js — de foutcodepagina's van pidlane.nl (14-11-2026)
   ──────────────────────────────────────────────────────────────────
   WAAROM. Wie een foutcode op zijn dashboard of in een uitleesapp ziet,
   zoekt "P0420 betekenis". Een eigen pagina per code met de uitleg uit de
   app brengt die zoekers naar PidLane. GitHub Pages serveert alleen
   statische bestanden, dus de pagina's worden hier gegenereerd en
   meegecommit — er is geen buildstap bij het deployen.

   DE BRON is pidlane-data.js van de app (DTCDB, DTC_OMSCHRIJVING en
   dtcPlan). Die wordt NIET nagebouwd maar uitgevoerd in een vm, zodat de
   site precies zegt wat de app zegt. Het uittreksel staat in
   foutcode/bron.json; de pagina's volgen daar volledig uit.

   GEBRUIK
     node tools/foutcodes.js                          bron: ../PidLane/public/pidlane-data.js,
                                                      anders https://app.pidlane.nl/pidlane-data.js
     node tools/foutcodes.js --bron <pad of url>      een andere bron
     node tools/foutcodes.js --snapshot               alleen opnieuw opbouwen uit foutcode/bron.json
   Daarna committen: foutcode/, sitemap.xml.
   tools/test-foutcodes.js controleert dat de pagina's bij bron.json horen.
   ══════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WORTEL = path.join(__dirname, '..');
const MAP = 'foutcode';
const SITE = 'https://pidlane.nl';
const PLAY = 'https://play.google.com/store/apps/details?id=nl.pidlane.app';
const APP = 'https://app.pidlane.nl';

// ── puur ───────────────────────────────────────────────────────────
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const LETTER = { P: 'Aandrijving (motor en versnellingsbak)', C: 'Chassis (remmen, ABS, sturing)', B: 'Carrosserie (airbags, comfort, verlichting)', U: 'Netwerk (communicatie tussen regelapparaten)' };
const P_GROEP = {
  0: 'brandstof, lucht en emissieregeling', 1: 'brandstof- en luchtmeting', 2: 'brandstof- en luchtmeting (injectoren)',
  3: 'ontsteking en overslaan (misfire)', 4: 'emissieregeling (katalysator, EGR, EVAP)', 5: 'snelheid, stationair en hulpingangen',
  6: 'regelapparaat en uitgangen', 7: 'versnellingsbak', 8: 'versnellingsbak', 9: 'versnellingsbak', A: 'hybride-aandrijving'
};
/* Hoe de code is opgebouwd. Puur. */
function opbouw(code) {
  const c = String(code).toUpperCase();
  const l = c[0], d1 = c[1], d2 = c[2];
  const generiek = d1 === '0' || d1 === '2';
  const regels = [];
  regels.push(['Eerste letter ' + l, LETTER[l] || 'onbekend systeem']);
  regels.push(['Tweede teken ' + d1, (d1 === '0' || d1 === '2') ? 'generieke code (SAE): op elke auto dezelfde betekenis' : 'fabrikantcode: de betekenis kan per merk verschillen']);
  if (l === 'P' && P_GROEP[d2] && (d1 === '0' || d1 === '2')) regels.push(['Derde teken ' + d2, P_GROEP[d2]]);
  return { generiek, regels };
}
const ERNST = {
  high: { kop: 'Ernstig', tekst: 'Laat dit snel nakijken. Knippert het motorlampje, of zie je een temperatuur- of oliedrukwaarschuwing, stop dan zodra het veilig kan.' },
  warn: { kop: 'Aandacht nodig', tekst: 'Doorrijden kan meestal, maar laat het binnenkort controleren.' },
  med: { kop: 'Aandacht nodig', tekst: 'Doorrijden kan meestal, maar laat het binnenkort controleren. Blijft het motorlampje branden, dan kan de auto ook afgekeurd worden bij de APK.' },
  low: { kop: 'Licht', tekst: 'Geen haast, wel in de gaten houden. Komt de code terug, laat dan de oorzaak zoeken.' }
};
function ernstVan(sev) { return ERNST[sev] || ERNST.med; }
function eur(n) { return '€' + Number(n).toLocaleString('nl-NL'); }

/* Het uittreksel uit pidlane-data.js: { gegenereerd, codes: { CODE: { desc, body, sev, plan } } }. */
function uittreksel(broncode, datum) {
  const c = { console: { log() {}, warn() {}, error() {}, info() {} } };
  c.window = c; c.globalThis = c;
  vm.createContext(c);
  vm.runInContext(broncode, c, { filename: 'pidlane-data.js' });
  if (!c.DTCDB || !c.DTC_OMSCHRIJVING || typeof c.dtcPlan !== 'function') throw new Error('DTCDB, DTC_OMSCHRIJVING of dtcPlan ontbreekt in de bron');
  const codes = {};
  const neem = (tabel) => Object.keys(tabel).forEach((k) => {
    if (!/^[PCBU][0-9A-F]{4}$/.test(k) || codes[k]) return;   // DTCDB wint, zoals dtcInfo() in de app
    const r = tabel[k] || {};
    const p = c.dtcPlan(k);
    codes[k] = {
      desc: String(r.desc || ''), body: String(r.body || ''), sev: String(r.sev || 'med'),
      plan: p ? { kost: Array.isArray(p.kost) ? p.kost.slice(0, 2) : null, wie: (c.DTC_PLAN_WIE || {})[p.wie] || '', stappen: (p.stappen || []).map(String) } : null
    };
  });
  neem(c.DTCDB); neem(c.DTC_OMSCHRIJVING);
  const gesorteerd = {};
  Object.keys(codes).sort().forEach((k) => { gesorteerd[k] = codes[k]; });
  return { gegenereerd: datum, codes: gesorteerd };
}

/* Kop en voet van de site, uit consument.html: één bron voor het menu. */
function sjabloon(html) {
  const kop = html.slice(html.indexOf('<header class="nav"'), html.indexOf('</header>') + 9);
  const voet = html.slice(html.indexOf('<footer>'), html.indexOf('</footer>') + 9);
  const balk = html.slice(html.indexOf('<div class="mbar"'), html.indexOf('</div>', html.indexOf('<div class="mbar"')) + 6);
  if (kop.length < 50 || voet.length < 50 || balk.length < 20) throw new Error('kop, voet of mbar niet gevonden in consument.html');
  // Relatieve links ("consument.html") werken niet vanuit /foutcode/.
  const absoluut = (s) => s.replace(/href="(?!https?:|mailto:|\/|#)([^"]+)"/g, 'href="/$1"');
  return {
    kop: absoluut(kop).replace(/ aria-current="page"/g, ''),
    voet: absoluut(voet),
    balk: absoluut(balk)
  };
}
function hoofd(o) {
  return '<!DOCTYPE html>\n<html lang="nl">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '<title>' + esc(o.titel) + '</title>\n<meta name="description" content="' + esc(o.beschrijving) + '">\n' +
    (o.noindex ? '<meta name="robots" content="noindex">\n' : '') +
    '<meta name="theme-color" content="#07080a">\n<meta property="og:type" content="article">\n<meta property="og:locale" content="nl_NL">\n' +
    '<meta property="og:url" content="' + esc(o.url) + '">\n<meta property="og:site_name" content="PidLane">\n' +
    '<meta property="og:title" content="' + esc(o.titel) + '">\n<meta property="og:description" content="' + esc(o.beschrijving) + '">\n' +
    '<meta property="og:image" content="' + SITE + '/og-image.png">\n<link rel="canonical" href="' + esc(o.url) + '">\n' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
    '<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..800&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">\n' +
    '<link rel="stylesheet" href="/pl.css">\n' + (o.ld ? '<script type="application/ld+json">' + JSON.stringify(o.ld).replace(/</g, '\\u003c') + '</script>\n' : '') +
    '</head>\n<body>\n<a class="sr" href="#main">Naar de inhoud</a>\n';
}
function staart(s) { return '\n' + s.voet + '\n\n' + s.balk + '\n\n<script src="/pl.js"></script>\n</body>\n</html>\n'; }

function cta() {
  return '<aside class="fc-cta">' +
    '<p class="kick"><b>Zelf uitlezen</b> met je telefoon</p>' +
    '<h2 class="fc-h2">Welke code staat er in jóuw auto?</h2>' +
    '<p>Met een OBD2-adapter en PidLane lees je de foutcodes van je eigen auto uit, met uitleg in gewone taal, wat je zelf kunt controleren en wanneer je naar de garage moet. Ook live: temperatuur, accu, mengsel.</p>' +
    '<div class="cta"><a class="btn btn-p" href="' + PLAY + '" target="_blank" rel="noopener">Download in Google Play <span class="ar">→</span></a>' +
    '<a class="btn btn-l" href="' + APP + '">Open de web-app</a></div></aside>';
}

function codePagina(code, r, alle, s) {
  const e = ernstVan(r.sev), ob = opbouw(code);
  const url = SITE + '/' + MAP + '/' + code;
  const titel = code + ': ' + r.desc + ' — betekenis en oplossing | PidLane';
  const beschrijving = 'Foutcode ' + code + ' betekent: ' + r.desc + '. ' + (r.body ? r.body + ' ' : '') + 'Wat het is, hoe ernstig, en wat je zelf kunt controleren.';
  const verwant = Object.keys(alle).filter((k) => k !== code && k.slice(0, 4) === code.slice(0, 4)).slice(0, 10);
  const vragen = [
    { q: 'Wat betekent foutcode ' + code + '?', a: r.desc + '. ' + r.body },
    { q: 'Kan ik doorrijden met ' + code + '?', a: e.kop + '. ' + e.tekst }
  ];
  if (r.plan && r.plan.stappen.length) vragen.push({ q: 'Wat kan ik doen bij ' + code + '?', a: r.plan.stappen.join('. ') + '.' });
  const ld = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: vragen.map((v) => ({ '@type': 'Question', name: v.q, acceptedAnswer: { '@type': 'Answer', text: v.a } })) };
  let h = hoofd({ titel, beschrijving, url, ld }) + s.kop + '\n\n<main id="main">\n<section class="sub fc">\n  <div class="wrap fc-in">\n';
  h += '    <nav class="fc-pad" aria-label="Kruimelpad"><a href="/">PidLane</a> / <a href="/' + MAP + '/">Foutcodes</a> / <span>' + esc(code) + '</span></nav>\n';
  h += '    <p class="kick"><b>Foutcode</b> ' + esc(LETTER[code[0]].split(' (')[0]) + ' · ' + (ob.generiek ? 'generiek' : 'fabrikant') + '</p>\n';
  h += '    <h1 class="d2 fc-h1"><span class="fc-code">' + esc(code) + '</span> ' + esc(r.desc) + '</h1>\n';
  if (r.body) h += '    <p class="lead"><b>Meest voorkomende oorzaak:</b> ' + esc(r.body) + '</p>\n';
  h += '    <div class="fc-ernst fc-' + esc(r.sev in ERNST ? r.sev : 'med') + '"><b>' + esc(e.kop) + '</b><span>' + esc(e.tekst) + '</span></div>\n';
  if (r.plan && r.plan.stappen.length) {
    h += '    <h2 class="fc-h2">Wat kun je doen?</h2>\n    <ol class="fc-stappen">' + r.plan.stappen.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ol>\n';
    h += '    <dl class="fc-feit">';
    if (r.plan.wie) h += '<div><dt>Wie</dt><dd>' + esc(r.plan.wie) + '</dd></div>';
    h += '<div><dt>Indicatie kosten</dt><dd>' + (r.plan.kost ? esc(eur(r.plan.kost[0]) + ' – ' + eur(r.plan.kost[1])) + '<small>onderdelen en arbeid bij een gewone garage in Nederland; een indicatie, geen offerte</small>' : 'alleen via de dealer te zeggen') + '</dd></div>';
    h += '</dl>\n';
  }
  h += '    <h2 class="fc-h2">Zo is ' + esc(code) + ' opgebouwd</h2>\n    <dl class="fc-feit">' + ob.regels.map((x) => '<div><dt>' + esc(x[0]) + '</dt><dd>' + esc(x[1]) + '</dd></div>').join('') + '</dl>\n';
  h += '    ' + cta() + '\n';
  if (verwant.length) h += '    <h2 class="fc-h2">Verwante codes</h2>\n    <ul class="fc-lijst">' + verwant.map((k) => '<li><a href="/' + MAP + '/' + k + '"><b>' + k + '</b> ' + esc(alle[k].desc) + '</a></li>').join('') + '</ul>\n';
  h += '    <p class="fc-fijn">De algemene betekenis van ' + esc(code) + ' volgens de OBD2-norm en de kennisbank van de PidLane-app. Per merk en model kan de oorzaak afwijken; dit vervangt geen onderzoek in de werkplaats. <a href="/' + MAP + '/">Alle foutcodes</a></p>\n';
  h += '  </div>\n</section>\n</main>\n' + staart(s);
  return h;
}

function indexPagina(alle, s) {
  const url = SITE + '/' + MAP + '/';
  const titel = 'OBD2-foutcodes opzoeken: betekenis en oplossing | PidLane';
  const beschrijving = 'Alle ' + Object.keys(alle).length + ' OBD2-foutcodes uit de PidLane-app met uitleg in gewone taal: wat de code betekent, hoe ernstig het is en wat je zelf kunt doen.';
  let h = hoofd({ titel, beschrijving, url }) + s.kop + '\n\n<main id="main">\n<section class="sub fc">\n  <div class="wrap fc-in">\n';
  h += '    <nav class="fc-pad" aria-label="Kruimelpad"><a href="/">PidLane</a> / <span>Foutcodes</span></nav>\n';
  h += '    <p class="kick"><b>Foutcodes</b> uitleg in gewone taal</p>\n    <h1 class="d2 fc-h1">OBD2-foutcodes <i>opzoeken</i></h1>\n';
  h += '    <p class="lead">Brandt het motorlampje? Elke storing laat een code achter in de motorcomputer. Hieronder de ' + Object.keys(alle).length + ' codes die de PidLane-app kent, met <b>betekenis, ernst en wat je zelf kunt controleren</b>.</p>\n';
  h += '    <form class="fc-zoek" action="#" onsubmit="var c=(this.c.value||\'\').toUpperCase().replace(/[^A-Z0-9]/g,\'\');if(/^[PCBU][0-9A-F]{4}$/.test(c)){location.href=\'/' + MAP + '/\'+c;}return false;"><label for="fc-c" class="sr">Foutcode</label><input id="fc-c" name="c" maxlength="6" placeholder="bijv. P0420" spellcheck="false" autocomplete="off"><button class="btn btn-p" type="submit">Zoek <span class="ar">→</span></button></form>\n';
  ['P', 'C', 'B', 'U'].forEach((l) => {
    const ks = Object.keys(alle).filter((k) => k[0] === l);
    if (!ks.length) return;
    h += '    <h2 class="fc-h2">' + l + ' — ' + esc(LETTER[l]) + '</h2>\n    <ul class="fc-lijst">' + ks.map((k) => '<li><a href="/' + MAP + '/' + k + '"><b>' + k + '</b> ' + esc(alle[k].desc) + '</a></li>').join('') + '</ul>\n';
  });
  h += '    ' + cta() + '\n  </div>\n</section>\n</main>\n' + staart(s);
  return h;
}

/* De sitemap: de bestaande regels blijven, de foutcoderegels worden vervangen. */
function sitemap(oud, alle, datum) {
  const regels = oud.split('\n').filter((r) => r.indexOf('<url>') >= 0 && r.indexOf('/' + MAP + '/') < 0);
  const nieuw = ['/' + MAP + '/'].concat(Object.keys(alle).map((k) => '/' + MAP + '/' + k))
    .map((p) => '  <url><loc>' + SITE + p + '</loc><lastmod>' + datum + '</lastmod></url>');
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + regels.concat(nieuw).join('\n') + '\n</urlset>\n';
}

/* Alles wat er geschreven wordt, als { pad: inhoud }. Puur gegeven de invoer. */
function bouw(bron, sjabloonHtml, oudeSitemap) {
  const s = sjabloon(sjabloonHtml), alle = bron.codes, uit = {};
  uit[MAP + '/bron.json'] = JSON.stringify(bron, null, 1) + '\n';
  uit[MAP + '/index.html'] = indexPagina(alle, s);
  Object.keys(alle).forEach((k) => { uit[MAP + '/' + k + '.html'] = codePagina(k, alle[k], alle, s); });
  uit['sitemap.xml'] = sitemap(oudeSitemap, alle, bron.gegenereerd);
  return uit;
}

async function leesBron(arg) {
  if (/^https?:\/\//.test(arg)) {
    const r = await fetch(arg, { cache: 'no-store' });
    if (!r.ok) throw new Error('bron niet op te halen: HTTP ' + r.status);
    return r.text();
  }
  return fs.readFileSync(arg, 'utf8');
}

async function hoofdprogramma(argv) {
  const lees = (f) => fs.readFileSync(path.join(WORTEL, f), 'utf8');
  let bron;
  if (argv.includes('--snapshot')) {
    bron = JSON.parse(lees(MAP + '/bron.json'));
  } else {
    const i = argv.indexOf('--bron');
    const lokaal = path.join(WORTEL, '..', 'PidLane', 'public', 'pidlane-data.js');
    const waar = i >= 0 ? argv[i + 1] : (fs.existsSync(lokaal) ? lokaal : APP + '/pidlane-data.js');
    bron = uittreksel(await leesBron(waar), new Date().toISOString().slice(0, 10));
    console.log('bron: ' + waar);
  }
  const uit = bouw(bron, lees('consument.html'), lees('sitemap.xml'));
  // Oude codepagina's die niet meer in de bron staan: weg.
  const map = path.join(WORTEL, MAP);
  fs.mkdirSync(map, { recursive: true });
  fs.readdirSync(map).forEach((f) => { if (/^[PCBU][0-9A-F]{4}\.html$/.test(f) && !uit[MAP + '/' + f]) fs.unlinkSync(path.join(map, f)); });
  Object.keys(uit).forEach((p) => fs.writeFileSync(path.join(WORTEL, p), uit[p]));
  console.log(Object.keys(bron.codes).length + ' foutcodepagina\'s geschreven, plus index en sitemap');
}

module.exports = { esc, opbouw, ernstVan, uittreksel, sjabloon, codePagina, indexPagina, sitemap, bouw, MAP, SITE };
if (require.main === module) hoofdprogramma(process.argv.slice(2)).catch((e) => { console.error('FOUT ' + (e && e.message || e)); process.exit(1); });

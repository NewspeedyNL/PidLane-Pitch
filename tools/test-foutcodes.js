#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════
   tools/test-foutcodes.js — klopt /foutcode/ met zijn bron? (14-11-2026)
   ──────────────────────────────────────────────────────────────────
   WAT HIER ROOD HOORT TE WORDEN
     • een pagina die met de hand is aangepast, of een bron.json die is
       bijgewerkt zonder de pagina's opnieuw te bouwen (uit de pas);
     • een codepagina die niet meer in de bron staat (blijft anders eeuwig
       in Google);
     • tekst uit de bron die als HTML in de pagina komt (geen escaping);
     • een link naar een code zonder pagina, een canonical die niet klopt,
       een sitemap die de gewone pagina's kwijtraakt.
   Draaien:  node tools/test-foutcodes.js     (exit 0 = goed)
   ══════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const F = require('./foutcodes.js');

const W = path.join(__dirname, '..');
let n = 0, fout = 0;
function toets(naam, waar, uitleg) {
  n++;
  if (waar) console.log('  ok    ' + naam);
  else { fout++; console.log('  FOUT  ' + naam + (uitleg ? ' — ' + uitleg : '')); }
}
const lees = (f) => fs.readFileSync(path.join(W, f), 'utf8');

console.log('\n1. De pagina\'s horen bij foutcode/bron.json');
const bron = JSON.parse(lees(F.MAP + '/bron.json'));
const codes = Object.keys(bron.codes);
toets('de bron heeft codes (' + codes.length + ')', codes.length > 100);
toets('elke code heeft de vorm van een OBD2-code', codes.every((k) => /^[PCBU][0-9A-F]{4}$/.test(k)));
const uit = F.bouw(bron, lees('consument.html'), lees('sitemap.xml'));
const anders = Object.keys(uit).filter((p) => !fs.existsSync(path.join(W, p)) || lees(p) !== uit[p]);
toets('alles is opnieuw te bouwen tot precies wat er staat', anders.length === 0, anders.slice(0, 5).join(', ') + ' — draai: node tools/foutcodes.js --snapshot');
const los = fs.readdirSync(path.join(W, F.MAP)).filter((f) => f.endsWith('.html') && !uit[F.MAP + '/' + f]);
toets('geen pagina\'s van codes die niet meer in de bron staan', los.length === 0, los.join(', '));

console.log('\n2. Elke pagina');
let fouten = [];
codes.forEach((k) => {
  const h = uit[F.MAP + '/' + k + '.html'];
  if ((h.match(/<h1\b/g) || []).length !== 1) fouten.push(k + ': geen of meer dan één h1');
  if (h.indexOf('<link rel="canonical" href="' + F.SITE + '/' + F.MAP + '/' + k + '">') < 0) fouten.push(k + ': canonical');
  if (!new RegExp('<title>' + k + ': ').test(h)) fouten.push(k + ': titel');
  const ld = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(h);
  try { const j = JSON.parse(ld[1]); if (j['@type'] !== 'FAQPage' || j.mainEntity.length < 2) fouten.push(k + ': FAQ'); }
  catch (e) { fouten.push(k + ': JSON-LD onleesbaar'); }
  (h.match(/href="\/foutcode\/([^"]+)"/g) || []).forEach((m) => {
    const doel = m.slice(16, -1);
    if (doel && !bron.codes[doel]) fouten.push(k + ': link naar ' + doel + ' zonder pagina');
  });
  if (/href="(?!https?:|mailto:|\/|#)/.test(h)) fouten.push(k + ': relatieve link (werkt niet vanuit /foutcode/)');
});
toets('één h1, canonical, titel, FAQ-gegevens en alleen links die bestaan', fouten.length === 0, fouten.slice(0, 5).join('; '));
toets('de index noemt elke code', codes.every((k) => uit[F.MAP + '/index.html'].indexOf('href="/foutcode/' + k + '"') >= 0));
toets('geen prijzen zonder uitleg: elke kostenregel zegt dat het een indicatie is',
  codes.every((k) => !/€\d/.test(uit[F.MAP + '/' + k + '.html']) || /een indicatie, geen offerte/.test(uit[F.MAP + '/' + k + '.html'])));

console.log('\n3. Escaping en opbouw');
const kwaad = { desc: '<img src=x onerror=alert(1)>', body: '"</script><script>alert(2)</script>', sev: 'high', plan: { kost: [1, 2], wie: 'Garage', stappen: ['<b>stap</b>'] } };
const h = F.codePagina('P0001', kwaad, { P0001: kwaad }, F.sjabloon(lees('consument.html')));
toets('tekst uit de bron komt niet als HTML in de pagina', h.indexOf('<img src=x') < 0 && h.indexOf('<b>stap</b>') < 0 && (h.match(/<script/g) || []).length === 2, (h.match(/<script/g) || []).length + ' scripts');
toets('P0420: generiek, emissieregeling', F.opbouw('P0420').generiek && /emissie/.test(F.opbouw('P0420').regels[2][1]));
toets('P1234: fabrikantcode', !F.opbouw('P1234').generiek && /fabrikant/.test(F.opbouw('P1234').regels[1][1]));
toets('U0100: netwerk', /Netwerk/.test(F.opbouw('U0100').regels[0][1]));

console.log('\n4. De sitemap');
const sm = uit['sitemap.xml'];
['/', '/consument.html', '/zakelijk.html', '/pidlane-help.html', '/foutcode/', '/foutcode/P0420'].forEach((p) =>
  toets('staat erin: ' + p, sm.indexOf('<loc>' + F.SITE + p + '</loc>') >= 0));
toets('elke code één keer', codes.every((k) => sm.split('<loc>' + F.SITE + '/foutcode/' + k + '</loc>').length === 2));
toets('robots.txt wijst naar de sitemap', /Sitemap: https:\/\/pidlane\.nl\/sitemap\.xml/.test(lees('robots.txt')));
toets('de site linkt naar /foutcode/ (index, particulier, zakelijk)', ['index.html', 'consument.html', 'zakelijk.html'].every((f) => lees(f).indexOf('href="/foutcode/">Foutcodes') >= 0));

console.log('\n' + (fout ? fout + ' van ' + n + ' FOUT' : n + ' toetsen, allemaal goed'));
process.exit(fout ? 1 : 0);

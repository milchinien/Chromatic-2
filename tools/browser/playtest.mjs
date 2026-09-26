// Automatischer Spieltest: spielt einen Run mit echten Mausklicks durch
// (Menü → Farben → Startdeck → Welten, Kämpfe, Räume, Bosse) und meldet
// Konsolenfehler. Aufruf: node tools/browser/playtest.mjs <url> [maxRäume] [bilderOrdner]

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launch } from './cdp.mjs';

const url = process.argv[2] ?? 'http://localhost:3100/';
const maxRooms = Number(process.argv[3] ?? 8);
const shots = process.argv[4] ?? 'playtest-shots';
mkdirSync(shots, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await launch();
let shotNo = 0;
const shot = async (name) => b.screenshot(join(shots, `${String(++shotNo).padStart(2, '0')}-${name}.png`));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const visible = (sel) => `(() => { const e = document.querySelector(${JSON.stringify(sel)}); return !!e && getComputedStyle(e).visibility !== 'hidden' && e.getClientRects().length > 0 && !e.disabled; })()`;
const screen = () => b.eval(`[...document.querySelectorAll('#ui > section')].map((s) => s.className).join(' | ')`);

try {
  await b.goto(url);
  await b.eval(`localStorage.clear(); localStorage.setItem('c2-windowed', '1'); true`);
  await b.goto(url);
  await b.waitFor(visible('[data-a="enter"]'));
  await shot('menu');
  await b.click('[data-a="enter"]');

  // Farbwahl
  await b.waitFor(`document.querySelectorAll('.race-tile').length === 7`);
  for (const k of [0, 3, 5]) await b.click(`.race-tile:nth-child(${k + 1})`);
  await shot('colors');
  await b.click('[data-go]');

  // Startdeck
  await b.waitFor(`document.querySelectorAll('.dr-card').length === 10`);
  await sleep(700);
  await shot('deck-reveal-running');
  await b.waitFor(visible('.dr-go'), 15000);
  await shot('deck-reveal');
  const shown = await b.eval(`[...document.querySelectorAll('.dr-card')].filter((c) => getComputedStyle(c).opacity === '1').length`);
  log('Startdeck sichtbar:', shown, 'von 10');
  await b.click('.dr-go');

  let rooms = 0;
  let battles = 0;
  const t0 = Date.now();
  while (rooms < maxRooms) {
    await sleep(900);
    const s = await screen();
    if (/intro-scr/.test(s)) {
      await b.waitFor(visible('.intro-scr [data-go]'));
      await shot('intro');
      await b.click('.intro-scr [data-go]');
    } else if (/battle-scr/.test(s)) {
      battles++;
      const r = await playBattle(battles);
      log(`Kampf ${battles}: ${r}`);
      rooms++;
    } else if (/fork-scr/.test(s)) {
      const kinds = await b.eval(`[...document.querySelectorAll('.room-card')].map((c) => c.className.match(/k-(\\w+)/)[1])`);
      // abwechselnd Räume ausprobieren
      const pick = kinds.findIndex((k) => k !== 'battle' && rooms % 2 === 1);
      const idx = pick >= 0 ? pick : 0;
      log('Gabelung:', kinds.join(' / '), '→', kinds[idx]);
      if (rooms < 3) await shot('fork');
      await b.click(`.room-card:nth-of-type(${idx + 1})`);
    } else if (/treasure-scr/.test(s)) {
      await b.click('.chest-hot');
      await b.waitFor(visible('.treasure-result button'), 8000);
      await shot('treasure');
      await b.click('.treasure-result button');
      rooms++;
    } else if (/shop-scr/.test(s)) {
      await b.click('.shop-counter .tiny');
      await sleep(300);
      if (await b.eval(visible('.si-actions .gbtn.primary'))) await b.click('.si-actions .gbtn.primary');
      await sleep(500);
      await shot('shop');
      await b.click('.leave-btn');
      rooms++;
    } else if (/enchant-scr/.test(s)) {
      await b.click('.orb');
      await sleep(300);
      await b.click('.si-actions .gbtn.primary');
      await sleep(900);
      rooms++;
    } else if (/pyre-scr/.test(s)) {
      await b.click('.pyre-pick');
      await sleep(300);
      if (await b.eval(visible('.si-actions .gbtn.danger'))) await b.click('.si-actions .gbtn.danger');
      else await b.click('.leave-btn');
      await sleep(1800);
      rooms++;
    } else if (/worldpick/.test(s) || (await b.eval(`!!document.querySelector('.wp-choice')`))) {
      await shot('worldpick');
      await b.click('.wp-choice');
    } else if (/end-scr/.test(s)) {
      await shot('end');
      log('Run zu Ende:', await b.eval(`document.querySelector('.end-panel h1').textContent`));
      break;
    } else {
      log('Unbekannter Bildschirm:', s);
      await sleep(1500);
    }
  }
  log(`Fertig: ${rooms} Räume, ${battles} Kämpfe in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
  const state = await b.eval(`(() => { const r = window.__game?.run; return r ? { world: r.worldNo, room: r.roomNo, lives: r.lives, gold: r.gold, deck: r.deck.length, ench: r.enchants.length } : null; })()`);
  log('Run-Stand:', JSON.stringify(state));
} catch (e) {
  console.log('ABBRUCH:', e.message);
  await shot('abbruch');
} finally {
  console.log(`\nKonsolenfehler: ${b.errors.length}`);
  for (const e of [...new Set(b.errors)].slice(0, 30)) console.log(' -', e);
  await b.close();
}

async function playBattle(n) {
  let round = 0;
  await b.click('[data-sp="4"]').catch(() => undefined);
  for (;;) {
    // warten: Handkarten oder Belohnung/Niederlage
    const t0 = Date.now();
    let what = '';
    while (!what) {
      if (Date.now() - t0 > 240000) throw new Error('Kampf hängt');
      if (await b.eval(`document.querySelectorAll('.hand-layer.on .hand-card').length === 3 && [...document.querySelectorAll('.hand-card')].every((c) => c.getAnimations({ subtree: true }).every((a) => a.playState !== 'running'))`)) what = 'hand';
      else if (await b.eval(visible('.rw-go'))) what = 'done';
      else await sleep(250);
    }
    if (what === 'done') {
      const title = await b.eval(`document.querySelector('.reward-panel .gpanel-title').textContent`);
      if (n <= 2 || /boss|defeated|fallen/i.test(title)) await shot(`battle${n}-result`);
      if (await b.eval(`!!document.querySelector('.rw-card')`)) {
        await b.click('.rw-card');
        await sleep(400);
      }
      await b.click('.rw-go');
      return `${title} nach ${round} Runden`;
    }
    round++;
    const rects = await b.eval(`[...document.querySelectorAll('.hand-card')].map((c) => { const r = c.getBoundingClientRect(); return c.dataset.k + '@' + Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + (c.classList.contains('picked') ? ' P' : ''); }).join(' | ')`);
    if (process.env.DEBUG) log('Hand:', rects);
    await b.click('.hand-card[data-k="0"]');
    await sleep(450);
    await b.click('.hand-card[data-k="1"]');
    await sleep(450);
    await b.waitFor(`!document.querySelector('.wbtn.fight').disabled`, 5000);
    if (n === 1 && round === 1) await shot('battle-pick');
    await b.click('.wbtn.fight');
    await sleep(2600);
    if (n === 1 && round === 1) await shot('battle-showcase');
    await sleep(4500);
    if (n <= 2 && round === 1) await shot(`battle${n}-fight`);
  }
}

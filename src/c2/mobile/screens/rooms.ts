// Räume im Hochformat: oben die Raum-Szene (gleiches Bild wie am PC, mittiger
// Ausschnitt in Originalgröße), darunter ein Panel mit den Details der Auswahl.
// Gleiche Regeln und Preise wie screens/rooms.ts.

import { cardArtUrl, frameUrl, pcardHtml } from '../../../lab/pcard';
import { icon } from '../../../lab/pixels';
import { gem } from '../../art/props';
import { TREASURE_ANCHOR } from '../../art/roomArtwork';
import { enchantBg, pyreBg, shopBg, treasureBg } from '../../art/scenes';
import { CARDS2, PYRE_PLACE, RACES, RARITY, type Card2, type Enchant } from '../../data';
import { withStars } from '../../game';
import type { DeckCard, Room } from '../../run';
import { burst, html, sleep } from '../../ui/anim';
import type { MobileGame } from '../game';
import { MH } from '../stage';
import { onLongPress, zoomCard } from '../zoom';

/** Oberkante der Szene und Oberkante des Detail-Panels (Spielpixel). */
const SCENE_Y = 28;
const PANEL_Y = SCENE_Y + 356;

function tinyCard(c: Card2, i: number, label = ''): string {
  let st = '';
  for (let k = 0; k < 3; k++) st += icon('star', k < c.stars ? '' : 'empty');
  return `
    <button class="tiny" data-i="${i}" style="--frame:url(${frameUrl()})">
      <div class="tiny-art"><img src="${cardArtUrl(c)}" alt="" draggable="false"></div>
      <div class="tiny-name">${c.name}</div>
      <div class="tiny-stars">${st}</div>
      ${label ? `<div class="tiny-price">${label}</div>` : ''}
    </button>`;
}

/** Karte + Name daneben. Große Karte (mit Text), wenn das Panel hoch genug ist, sonst klein + Text. */
function cardDetail(c: Card2): string {
  const big = MH - PANEL_Y - 8 >= 198;
  return `
    <div class="md-card">${pcardHtml(c, { big })}</div>
    <div class="md-text">
      <b class="md-name" style="color:${RACES[c.race].art[3]}">${c.name}</b>
      <span class="md-type">${RACES[c.race].name} · ${c.cls}</span>
      ${big ? '' : `<p>${c.text}</p>`}
    </div>`;
}

interface Shell {
  el: HTMLElement;
  /** Szenenkoordinaten (640×360-Bild) → Bühne */
  sx: (x: number) => number;
  sy: (y: number) => number;
  body: HTMLElement;
  actions: HTMLElement;
}

function roomShell(g: MobileGame, cls: string, bg: string, title: string, sub: string, bgx = -160): Shell {
  const el = document.createElement('section');
  el.className = `scr room-scr m-room ${cls}`;
  el.style.backgroundImage = bg;
  el.style.setProperty('--bgx', `${bgx}px`);
  el.style.setProperty('--bgy', `${SCENE_Y}px`);
  el.innerHTML = `
    ${g.hudHtml()}
    <div class="room-title"><b>${title}</b><span>${sub}</span></div>
    <div class="m-scene-fade" style="top:${SCENE_Y + 300}px"></div>
    <aside class="gpanel m-panel" style="top:${PANEL_Y}px"><div class="md-body"><p class="si-empty">Select something to see its details.</p></div><div class="md-actions"></div></aside>`;
  g.ui.appendChild(el);
  g.bindHud();
  return {
    el,
    sx: (x) => x + bgx,
    sy: (y) => y + SCENE_Y,
    body: el.querySelector<HTMLElement>('.md-body')!,
    actions: el.querySelector<HTMLElement>('.md-actions')!,
  };
}

function leaveButton(sh: Shell, label: string, onLeave: () => void): HTMLButtonElement {
  const b = html(`<button class="gbtn leave-btn">${icon('door')}<span>${label}</span></button>`) as HTMLButtonElement;
  b.addEventListener('click', onLeave);
  sh.el.appendChild(b);
  return b;
}

// --- Schatz ---------------------------------------------------------------------------------

export function mTreasureScreen(g: MobileGame, room: Room, done: () => void): void {
  const run = g.run!;
  const setting = {
    drifters: 'A chest lies hidden in the woods',
    ashclan: 'A forgotten cache among the ashes',
    wildwood: 'A secret beneath the ancient roots',
    tidebound: 'A lost treasure above the tide',
    sunlegion: 'An offering in the fallen temple',
    plague: 'A forgotten inheritance among the graves',
    deepforge: 'A hidden cache in the mountain halls',
  }[run.world];
  const sh = roomShell(g, 'treasure-scr', treasureBg(g.theme, false), 'Treasure', setting);
  const can = room.treasure === 'gold' ? 'Gold' : room.treasure === 'upgrade' ? 'A card upgrade' : 'Gold or a card upgrade';
  sh.body.innerHTML = `<div class="md-info"><div class="gpanel-title">Contains</div><p>${can}</p><p class="hint">Tap the chest to open it.</p></div>`;
  const hot = html(`<button class="chest-hot" aria-label="Open chest"></button>`);
  const anchor = TREASURE_ANCHOR[run.world];
  const ax = sh.sx(anchor.x);
  const ay = sh.sy(anchor.y);
  hot.style.left = `${ax - 24}px`;
  hot.style.top = `${ay - 38}px`;
  sh.el.appendChild(hot);
  hot.addEventListener('click', async () => {
    hot.remove();
    sh.el.classList.add('shake');
    await sleep(350);
    sh.el.classList.remove('shake');
    sh.el.style.backgroundImage = treasureBg(g.theme, true);
    burst(g.fx, ax, ay - 20, ['#ffe23a', '#fff4b0', '#f6c23a', '#ffffff'], 60, 90, 80);
    const upgradeable = run.upgradeable();
    const giveUpgrade = room.treasure === 'upgrade' || (room.treasure === 'both' && run.rnd() < 0.5);
    let body: string;
    if (giveUpgrade && upgradeable.length) {
      const d = upgradeable[Math.floor(run.rnd() * upgradeable.length)]!;
      d.stars++;
      body = `<div class="reward-card">${pcardHtml(withStars(d), { big: true })}</div><p><b>${d.card.name}</b> upgraded to ★${d.stars}!</p>`;
    } else {
      const gold = Math.round((40 + run.worldNo * 25 + run.rnd() * 40) * run.mods.goldMul);
      run.gold += gold;
      body = `<div class="big-gold">${icon('coin')}<b>+${gold}</b></div><p>Gold added to your purse.</p>`;
    }
    g.refreshHud();
    // Das Ergebnis ersetzt Panel und „Leave“ – weiter geht es mit Continue
    sh.el.querySelector('.m-panel')?.remove();
    sh.el.querySelector('.leave-btn')?.remove();
    const res = html(`<div class="gpanel treasure-result m-result pop"><div class="gpanel-title">You found</div>${body}<button class="gbtn primary big">Continue</button></div>`);
    res.querySelector('button')!.addEventListener('click', done);
    sh.el.appendChild(res);
  });
  leaveButton(sh, 'Leave', done);
}

// --- Shop ---------------------------------------------------------------------------------

export function mShopScreen(g: MobileGame, done: () => void): void {
  const run = g.run!;
  const sh = roomShell(g, 'shop-scr', shopBg(g.theme), 'Goblin Trader', 'Shiny cards, fair prices. Mostly.');
  const tabs = html(`<div class="shop-tabs" style="left:${sh.sx(196)}px;top:${sh.sy(152)}px"><button class="tab on" data-t="up">${icon('star')} Upgrade</button><button class="tab" data-t="buy">${icon('coin')} Buy</button></div>`);
  sh.el.appendChild(tabs);
  const counter = html(`<div class="shop-counter" style="left:${sh.sx(168)}px;top:${sh.sy(252)}px"></div>`);
  sh.el.appendChild(counter);
  const { body, actions } = sh;

  const pickN = <T,>(list: T[], n: number) => {
    const copy = [...list];
    const out: T[] = [];
    while (out.length < n && copy.length) out.push(copy.splice(Math.floor(run.rnd() * copy.length), 1)[0]!);
    return out;
  };
  const ups: DeckCard[] = pickN(run.upgradeable(), 3);
  const pool = CARDS2.filter((c) => c.race === run.world || c.race === 'drifters' || run.colors.includes(c.race));
  const offers: Card2[] = pickN(pool, 3);
  let bought = -1;
  let tab: 'up' | 'buy' = 'up';
  const coinBurst = () => burst(g.fx, 60, PANEL_Y + 60, ['#ffe23a', '#ffffff'], 30, 50, 40);

  const render = () => {
    tabs.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', (t as HTMLElement).dataset.t === tab));
    if (tab === 'up') {
      counter.innerHTML = ups.length ? ups.map((d, i) => tinyCard(withStars(d), i, d.stars >= 3 ? 'MAX' : `${run.upgradeCost(d)}`)).join('') : '<p class="shop-empty">Nothing left to upgrade.</p>';
    } else {
      counter.innerHTML = offers.map((c, i) => (bought >= 0 && bought !== i ? '' : tinyCard({ ...c, stars: 1 }, i, bought === i ? 'SOLD' : `${run.buyCost(c)}`))).join('');
    }
    body.innerHTML = '<p class="si-empty">Tap a card on the counter.</p>';
    actions.innerHTML = '';
    counter.querySelectorAll<HTMLElement>('.tiny').forEach((b) => b.addEventListener('click', () => select(Number(b.dataset.i), b)));
  };

  const select = (i: number, btn: HTMLElement) => {
    counter.querySelectorAll('.tiny').forEach((b) => b.classList.toggle('sel', b === btn));
    actions.innerHTML = '';
    if (tab === 'up') {
      const d = ups[i]!;
      body.innerHTML = cardDetail(withStars(d));
      if (d.stars >= 3) return;
      const cost = run.upgradeCost(d);
      const b = html(`<button class="gbtn primary" ${run.gold < cost ? 'disabled' : ''}>${icon('star')}<span>★${d.stars + 1}</span><span class="price">${icon('coin')}${cost}</span></button>`) as HTMLButtonElement;
      b.addEventListener('click', () => {
        if (run.gold < cost) return;
        run.gold -= cost;
        d.stars++;
        g.refreshHud();
        coinBurst();
        render();
        const again = counter.querySelector<HTMLElement>(`.tiny[data-i="${i}"]`);
        if (again) select(i, again);
      });
      actions.appendChild(b);
    } else {
      const c = offers[i]!;
      body.innerHTML = cardDetail({ ...c, stars: 1 });
      if (bought >= 0) return;
      const cost = run.buyCost(c);
      const b = html(`<button class="gbtn primary" ${run.gold < cost ? 'disabled' : ''}>${icon('coin')}<span>Buy</span><span class="price">${cost}</span></button>`) as HTMLButtonElement;
      b.addEventListener('click', () => {
        if (run.gold < cost || bought >= 0) return;
        run.gold -= cost;
        run.addCard(c);
        bought = i;
        g.refreshHud();
        counter.querySelectorAll<HTMLElement>('.tiny').forEach((t) => {
          if (Number(t.dataset.i) !== i) t.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(8px)' }], { duration: 300, fill: 'forwards' });
        });
        coinBurst();
        setTimeout(render, 320);
      });
      actions.appendChild(b);
    }
  };

  tabs.querySelectorAll<HTMLElement>('.tab').forEach((t) =>
    t.addEventListener('click', () => {
      tab = t.dataset.t as 'up' | 'buy';
      render();
    }),
  );
  render();
  leaveButton(sh, 'Leave', done);
}

// --- Enchanter ----------------------------------------------------------------------------

export function mEnchantScreen(g: MobileGame, done: () => void): void {
  const run = g.run!;
  // Ausschnitt weiter links, damit der Magier im Bild ist
  const sh = roomShell(g, 'enchant-scr', enchantBg(g.theme, run.world), 'The Enchanter', 'Choose one enchantment. It lasts for the whole run.', -70);
  const { body, actions } = sh;
  const choices: Enchant[] = [run.randomEnchant(), run.randomEnchant()];
  const spots = [
    { x: sh.sx(183), y: sh.sy(214) },
    { x: sh.sx(262), y: sh.sy(176) },
  ];
  body.innerHTML = '<p class="si-empty">Tap an orb to see its enchantment.</p>';
  choices.forEach((e, i) => {
    const r = RARITY[e.rarity];
    const cv = document.createElement('canvas');
    const gg = gem(r.color, r.dark);
    cv.width = gg.w;
    cv.height = gg.h;
    gg.draw(cv.getContext('2d')!, 0, 0);
    const b = html(`<button class="orb r-${e.rarity}" style="left:${spots[i]!.x - 14}px;top:${spots[i]!.y - 16}px;--rc:${r.color}"><img src="${cv.toDataURL()}" alt=""><span class="orb-label">${r.name}</span></button>`);
    b.style.animationDelay = `${i * -1.1}s`;
    b.addEventListener('click', () => {
      sh.el.querySelectorAll('.orb').forEach((o) => o.classList.toggle('sel', o === b));
      body.innerHTML = `
        <div class="ench-card m-ench r-${e.rarity}" style="--rc:${r.color};--rd:${r.dark}">
          <img class="ench-gem" src="${cv.toDataURL()}" alt="">
          <div class="md-text">
            <span class="ench-rarity">${r.name}</span>
            <div class="ench-name">${e.name}</div>
            <p class="ench-good">${icon('star')} ${e.text}</p>
            ${e.cost ? `<p class="ench-bad">${icon('skull')} ${e.cost}</p>` : ''}
          </div>
        </div>`;
      actions.innerHTML = '';
      const take = html(`<button class="gbtn primary">${icon('star')}<span>Take</span></button>`);
      take.addEventListener('click', async () => {
        take.setAttribute('disabled', '');
        run.enchants.push(e);
        g.refreshHud();
        burst(g.fx, spots[i]!.x, spots[i]!.y, [r.color, '#ffffff'], 50, 70, 40);
        sh.el.querySelectorAll('.orb').forEach((o) => (o as HTMLElement).animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(2)' }], { duration: 400, fill: 'forwards' }));
        await sleep(600);
        done();
      });
      actions.appendChild(take);
    });
    sh.el.appendChild(b);
  });
  leaveButton(sh, 'Leave', done);
}

// --- Pyre ----------------------------------------------------------------------------------

export function mPyreScreen(g: MobileGame, done: () => void): void {
  const run = g.run!;
  const place = PYRE_PLACE[run.world];
  const sh = roomShell(g, 'pyre-scr', pyreBg(g.theme, run.world), place.name, place.text);
  const { body, actions } = sh;
  const pool = [...run.deck];
  const three: DeckCard[] = [];
  while (three.length < 3 && pool.length) three.push(pool.splice(Math.floor(run.rnd() * pool.length), 1)[0]!);
  const row = html(`<div class="pyre-row m-pyre-row" style="top:${sh.sy(40)}px">${three.map((d, i) => `<button class="pyre-pick" data-i="${i}">${pcardHtml(withStars(d))}</button>`).join('')}</div>`);
  sh.el.appendChild(row);
  body.innerHTML = '<p class="si-empty">Tap a card to burn it.<br>Hold a card to read it.</p>';
  const fire = { x: sh.sx(320), y: sh.sy(270) };
  row.querySelectorAll<HTMLElement>('.pyre-pick').forEach((b) => {
    const d = three[Number(b.dataset.i)]!;
    onLongPress(b, () => zoomCard(g.ui, withStars(d)));
    b.addEventListener('click', () => {
      row.querySelectorAll('.pyre-pick').forEach((x) => x.classList.toggle('sel', x === b));
      body.innerHTML = cardDetail(withStars(d));
      actions.innerHTML = '';
      const small = run.deck.length <= 6;
      const burn = html(`<button class="gbtn danger" ${small ? 'disabled title="Your deck needs at least 6 cards"' : ''}>${icon('flame')}<span>${small ? 'Deck too small' : 'Remove'}</span></button>`) as HTMLButtonElement;
      burn.addEventListener('click', async () => {
        if (run.deck.length <= 6) return;
        burn.disabled = true;
        run.deck = run.deck.filter((x) => x !== d);
        g.refreshHud();
        const dx = fire.x - 43 - b.offsetLeft - row.offsetLeft;
        const dy = fire.y - 60 - row.offsetTop;
        await b.animate(
          [
            { transform: 'translate(0,0) rotate(0)', opacity: 1, filter: 'brightness(1)' },
            { transform: `translate(${dx}px, ${dy - 30}px) rotate(20deg) scale(.6)`, opacity: 1, filter: 'brightness(1.6) sepia(1)' },
            { transform: `translate(${dx}px, ${dy}px) rotate(30deg) scale(.2)`, opacity: 0, filter: 'brightness(.2)' },
          ],
          { duration: 900, easing: 'ease-in', fill: 'forwards' },
        ).finished;
        burst(g.fx, fire.x, fire.y, ['#ff8a3a', '#ffe23a', '#e8471f', '#5a5a62'], 50, 60, 70);
        await sleep(500);
        done();
      });
      actions.appendChild(burn);
    });
  });
  leaveButton(sh, 'Skip', done);
}


// Räume abseits des Kampfes: Schatz, Shop (Goblin-Stand), Enchanter (Magier)
// und Pyre (Karte entsorgen). Informationen zur Auswahl stehen immer rechts
// in einem gleich großen Panel.

import { audio } from '../audio/audio';
import { cardArtUrl, frameUrl, pcardHtml } from '../../lab/pcard';
import { icon } from '../../lab/pixels';
import { gem } from '../art/props';
import { TREASURE_ANCHOR } from '../art/roomArtwork';
import { enchantBg, pyreBg, shopBg, treasureBg } from '../art/scenes';
import { CARDS2, PYRE_PLACE, RARITY, type Card2, type Enchant } from '../data';
import { withStars, type Game } from '../game';
import type { DeckCard, Room } from '../run';
import { burst, html, sleep } from '../ui/anim';

// --- Gemeinsame Bausteine -----------------------------------------------------------------

/** Kleine Karte (52×72) zum Hinlegen auf Tische. */
function tinyCard(c: Card2, i: number, label = ''): string {
  let st = '';
  for (let k = 0; k < 3; k++) st += icon('star', k < c.stars ? '' : 'empty');
  return `
    <button class="tiny" data-i="${i}" style="--frame:url(${frameUrl()})">
      <div class="tiny-art">
        <img src="${cardArtUrl(c)}" alt="" draggable="false">
      </div>
      <div class="tiny-name">${c.name}</div>
      <div class="tiny-stars">${st}</div>
      ${label ? `<div class="tiny-price">${label}</div>` : ''}
    </button>`;
}

/** Rechtes Info-Panel mit fester Größe. */
function sideInfo(): HTMLElement {
  return html(`<aside class="side-info gpanel"><div class="si-body"><p class="si-empty">Select something to see its details.</p></div><div class="si-actions"></div></aside>`);
}

function roomShell(g: Game, cls: string, bg: string, title: string, sub: string): HTMLElement {
  const el = document.createElement('section');
  el.className = `scr room-scr ${cls}`;
  el.style.backgroundImage = bg;
  el.innerHTML = `${g.hudHtml()}<div class="room-title"><b>${title}</b><span>${sub}</span></div>`;
  g.ui.appendChild(el);
  g.bindHud();
  return el;
}

function leaveButton(el: HTMLElement, label: string, onLeave: () => void): HTMLButtonElement {
  const b = html(`<button class="gbtn leave-btn">${icon('door')}<span>${label}</span></button>`) as HTMLButtonElement;
  b.addEventListener('click', onLeave);
  el.appendChild(b);
  return b;
}

// --- Schatz ---------------------------------------------------------------------------------

export function treasureScreen(g: Game, room: Room, done: () => void): void {
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
  const el = roomShell(g, 'treasure-scr', treasureBg(g.theme, false), 'Treasure', setting);
  const can = room.treasure === 'gold' ? 'Gold' : room.treasure === 'upgrade' ? 'A card upgrade' : 'Gold or a card upgrade';
  const panel = html(`<div class="gpanel treasure-info"><div class="gpanel-title">Contains</div><p>${can}</p><p class="hint">Click the chest to open it.</p></div>`);
  el.appendChild(panel);
  const hot = html(`<button class="chest-hot" data-sfx="none" aria-label="Open chest"></button>`);
  const anchor = TREASURE_ANCHOR[run.world];
  hot.style.left = `${anchor.x - 24}px`;
  hot.style.top = `${anchor.y - 38}px`;
  el.appendChild(hot);
  hot.addEventListener('click', async () => {
    hot.remove();
    audio.play('chest', { jitter: 0 });
    el.classList.add('shake');
    await sleep(350);
    el.classList.remove('shake');
    el.style.backgroundImage = treasureBg(g.theme, true);
    burst(g.fx, anchor.x, anchor.y - 20, ['#ffe23a', '#fff4b0', '#f6c23a', '#ffffff'], 60, 90, 80);
    const upgradeable = run.upgradeable();
    const giveUpgrade = room.treasure === 'upgrade' || (room.treasure === 'both' && run.rnd() < 0.5);
    let body: string;
    if (giveUpgrade && upgradeable.length) {
      const d = upgradeable[Math.floor(run.rnd() * upgradeable.length)]!;
      d.stars++;
      body = `<div class="reward-card">${pcardHtml(withStars(d), { big: true })}</div><p><b>${d.card.name}</b> upgraded to ★${d.stars}!</p>`;
      audio.play('upgrade', { delay: 0.3 });
    } else {
      const gold = Math.round((40 + run.worldNo * 25 + run.rnd() * 40) * run.mods.goldMul);
      run.gold += gold;
      body = `<div class="big-gold">${icon('coin')}<b>+${gold}</b></div><p>Gold added to your purse.</p>`;
    }
    g.refreshHud();
    panel.remove();
    const res = html(`<div class="gpanel treasure-result pop"><div class="gpanel-title">You found</div>${body}<button class="gbtn primary">Continue</button></div>`);
    res.querySelector('button')!.addEventListener('click', done);
    el.appendChild(res);
  });
  leaveButton(el, 'Leave', done);
}

// --- Shop ---------------------------------------------------------------------------------

export function shopScreen(g: Game, done: () => void): void {
  const run = g.run!;
  const el = roomShell(g, 'shop-scr', shopBg(g.theme), 'Goblin Trader', 'Shiny cards, fair prices. Mostly.');
  const tabs = html(`<div class="shop-tabs"><button class="tab on" data-t="up">${icon('star')} Upgrade</button><button class="tab" data-t="buy">${icon('coin')} Buy</button></div>`);
  el.appendChild(tabs);
  const counter = html(`<div class="shop-counter"></div>`);
  el.appendChild(counter);
  const info = sideInfo();
  el.appendChild(info);
  const body = info.querySelector<HTMLElement>('.si-body')!;
  const actions = info.querySelector<HTMLElement>('.si-actions')!;

  // Angebote werden beim Betreten einmal festgelegt
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

  const render = () => {
    tabs.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', (t as HTMLElement).dataset.t === tab));
    if (tab === 'up') {
      counter.innerHTML = ups.length ? ups.map((d, i) => tinyCard(withStars(d), i, d.stars >= 3 ? 'MAX' : `${run.upgradeCost(d)}`)).join('') : '<p class="shop-empty">Nothing left to upgrade.</p>';
    } else {
      counter.innerHTML = offers.map((c, i) => (bought >= 0 && bought !== i ? '' : tinyCard({ ...c, stars: 1 }, i, bought === i ? 'SOLD' : `${run.buyCost(c)}`))).join('');
    }
    body.innerHTML = '<p class="si-empty">Select a card on the counter.</p>';
    actions.innerHTML = '';
    counter.querySelectorAll<HTMLElement>('.tiny').forEach((b) => b.addEventListener('click', () => select(Number(b.dataset.i), b)));
  };

  const select = (i: number, btn: HTMLElement) => {
    counter.querySelectorAll('.tiny').forEach((b) => b.classList.toggle('sel', b === btn));
    actions.innerHTML = '';
    if (tab === 'up') {
      const d = ups[i]!;
      body.innerHTML = pcardHtml(withStars(d), { big: true });
      if (d.stars >= 3) return;
      const cost = run.upgradeCost(d);
      const b = html(`<button class="gbtn primary" ${run.gold < cost ? 'disabled' : ''}>${icon('star')}<span>★${d.stars + 1}</span><span class="price">${icon('coin')}${cost}</span></button>`) as HTMLButtonElement;
      b.addEventListener('click', () => {
        if (run.gold < cost) return;
        run.gold -= cost;
        d.stars++;
        audio.play('coins');
        audio.play('upgrade', { delay: 0.12 });
        g.refreshHud();
        const r = btn.getBoundingClientRect();
        void r;
        burst(g.fx, 560, 140, ['#ffe23a', '#ffffff'], 30, 50, 40);
        render();
        const again = counter.querySelector<HTMLElement>(`.tiny[data-i="${i}"]`);
        if (again) select(i, again);
      });
      actions.appendChild(b);
    } else {
      const c = offers[i]!;
      body.innerHTML = pcardHtml({ ...c, stars: 1 }, { big: true });
      if (bought >= 0) return;
      const cost = run.buyCost(c);
      const b = html(`<button class="gbtn primary" ${run.gold < cost ? 'disabled' : ''}>${icon('coin')}<span>Buy</span><span class="price">${cost}</span></button>`) as HTMLButtonElement;
      b.addEventListener('click', () => {
        if (run.gold < cost || bought >= 0) return;
        run.gold -= cost;
        run.addCard(c);
        bought = i;
        audio.play('coins');
        audio.play('card_place', { delay: 0.25 });
        g.refreshHud();
        // Die anderen beiden verschwinden
        counter.querySelectorAll<HTMLElement>('.tiny').forEach((t) => {
          if (Number(t.dataset.i) !== i) t.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(8px)' }], { duration: 300, fill: 'forwards' });
        });
        burst(g.fx, 560, 140, ['#ffe23a', '#ffffff'], 30, 50, 40);
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
  leaveButton(el, 'Leave', done);
}

// --- Enchanter ----------------------------------------------------------------------------

export function enchantScreen(g: Game, done: () => void): void {
  const run = g.run!;
  const el = roomShell(g, 'enchant-scr', enchantBg(g.theme, run.world), 'The Enchanter', 'Choose one enchantment. It lasts for the whole run.');
  const info = sideInfo();
  el.appendChild(info);
  const body = info.querySelector<HTMLElement>('.si-body')!;
  const actions = info.querySelector<HTMLElement>('.si-actions')!;
  const choices: Enchant[] = [run.randomEnchant(), run.randomEnchant()];
  // Eine auf der Handfläche, eine schwebt daneben
  const spots = [
    { x: 183, y: 214 },
    { x: 262, y: 176 },
  ];
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
      el.querySelectorAll('.orb').forEach((o) => o.classList.toggle('sel', o === b));
      audio.play('chime', { rate: i ? 1.5 : 1, vol: 0.6 });
      body.innerHTML = `
        <div class="ench-card r-${e.rarity}" style="--rc:${r.color};--rd:${r.dark}">
          <div class="ench-rarity">${r.name}</div>
          <div class="ench-name">${e.name}</div>
          <img class="ench-gem" src="${cv.toDataURL()}" alt="">
          <p class="ench-good">${icon('star')} ${e.text}</p>
          ${e.cost ? `<p class="ench-bad">${icon('skull')} ${e.cost}</p>` : ''}
        </div>`;
      actions.innerHTML = '';
      const take = html(`<button class="gbtn primary">${icon('star')}<span>Take</span></button>`);
      take.addEventListener('click', async () => {
        run.enchants.push(e);
        audio.play('enchant', { jitter: 0 });
        g.refreshHud();
        burst(g.fx, spots[i]!.x, spots[i]!.y, [r.color, '#ffffff'], 50, 70, 40);
        el.querySelectorAll('.orb').forEach((o) => (o as HTMLElement).animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(2)' }], { duration: 400, fill: 'forwards' }));
        await sleep(600);
        done();
      });
      actions.appendChild(take);
    });
    el.appendChild(b);
  });
  leaveButton(el, 'Leave', done);
}

// --- Pyre ----------------------------------------------------------------------------------

export function pyreScreen(g: Game, done: () => void): void {
  const run = g.run!;
  const place = PYRE_PLACE[run.world];
  const el = roomShell(g, 'pyre-scr', pyreBg(g.theme, run.world), place.name, place.text);
  const info = sideInfo();
  el.appendChild(info);
  const body = info.querySelector<HTMLElement>('.si-body')!;
  const actions = info.querySelector<HTMLElement>('.si-actions')!;
  const pool = [...run.deck];
  const three: DeckCard[] = [];
  while (three.length < 3 && pool.length) three.push(pool.splice(Math.floor(run.rnd() * pool.length), 1)[0]!);
  const row = html(`<div class="pyre-row">${three.map((d, i) => `<button class="pyre-pick" data-i="${i}">${pcardHtml(withStars(d))}</button>`).join('')}</div>`);
  el.appendChild(row);
  row.querySelectorAll<HTMLElement>('.pyre-pick').forEach((b) =>
    b.addEventListener('click', () => {
      const d = three[Number(b.dataset.i)]!;
      row.querySelectorAll('.pyre-pick').forEach((x) => x.classList.toggle('sel', x === b));
      body.innerHTML = pcardHtml(withStars(d), { big: true });
      actions.innerHTML = '';
      const burn = html(`<button class="gbtn danger" ${run.deck.length <= 6 ? 'disabled title="Your deck needs at least 6 cards"' : ''}>${icon('flame')}<span>${run.deck.length <= 6 ? 'Deck too small' : 'Remove'}</span></button>`) as HTMLButtonElement;
      burn.addEventListener('click', async () => {
        if (run.deck.length <= 6) return;
        run.deck = run.deck.filter((x) => x !== d);
        audio.play('pyre', { jitter: 0 });
        g.refreshHud();
        await b.animate(
          [
            { transform: 'translate(0,0) rotate(0)', opacity: 1, filter: 'brightness(1)' },
            { transform: `translate(${320 - 43 - b.offsetLeft - row.offsetLeft}px, 110px) rotate(20deg) scale(.6)`, opacity: 1, filter: 'brightness(1.6) sepia(1)' },
            { transform: `translate(${320 - 43 - b.offsetLeft - row.offsetLeft}px, 140px) rotate(30deg) scale(.2)`, opacity: 0, filter: 'brightness(.2)' },
          ],
          { duration: 900, easing: 'ease-in', fill: 'forwards' },
        ).finished;
        burst(g.fx, 320, 270, ['#ff8a3a', '#ffe23a', '#e8471f', '#5a5a62'], 50, 60, 70);
        await sleep(500);
        done();
      });
      actions.appendChild(burn);
    }),
  );
  leaveButton(el, 'Skip', done);
}

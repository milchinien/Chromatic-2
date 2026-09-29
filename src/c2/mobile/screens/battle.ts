// =====================================================================
// Kampfbildschirm im Hochformat – gleicher Ablauf wie screens/battle.ts (PC):
//   Ziehen (3 Karten fliegen vom Stapel und drehen sich um) → 2 wählen
//   (erste = FRONT), ⇄ tauscht → FIGHT → Einheiten erscheinen (Antippen
//   überspringt) → Kartenschau mit Boni, bis man antippt → Kampf →
//   Überlebende laufen zur Burg
//   → nächste Runde, bis eine Burg fällt → Belohnungen.
//
// Anordnung: oben die Leisten (eigene Burg | Zeit | Gegner), darunter die
// gegnerische Burg, das Feld, die eigene Burg, dann die 4 Kartenplätze und
// ganz unten FIGHT / Bonus-Leiste / Pause / Tempo. Karten gedrückt halten =
// groß ansehen, Bonus-Leiste bzw. Boni der Kartenschau antippen = Details.
// =====================================================================

import { backArtUrl, barFrameUrl, cardArtUrl, frameUrl, pcardHtml } from '../../../lab/pcard';
import { CLASS_ICON } from '../../../lab/races';
import { icon } from '../../../lab/pixels';
import { classBonusDetail, pairBonuses, raceBonusDetail } from '../../bonusDetails';
import { CLASS_BONUS, RACE_BONUS, RACES, cardByName, type Card2 } from '../../data';
import { withStars } from '../../game';
import { ArenaView } from '../../render/arenaView';
import type { DeckCard, Room } from '../../run';
import { Arena, DT, type Deployed, type SideSpec } from '../../sim/arena';
import { Timeline, burst, flip, flyArc, html, localRect, sleep } from '../../ui/anim';
import { bindBonusPop, closeBonusPop } from '../../ui/bonusPop';
import { MobileArenaView } from '../arenaView';
import type { MobileGame } from '../game';
import { MW, battleLayout } from '../stage';
import { onLongPress, zoomCard } from '../zoom';

type Result = 'win' | 'lose';

const SMALL = { w: 86, h: 119 };
const BIG = { w: 124, h: 180 };

/** Kompakte Karte für die Kartenplätze (68×62). */
function miniCardHtml(c: Card2, rolled?: number): string {
  let st = '';
  for (let k = 0; k < 3; k++) st += icon('star', k < c.stars ? '' : 'empty');
  return `
    <article class="mcard" style="--frame:url(${frameUrl()});--rc:${RACES[c.race].art[3]}">
      <header class="mc-top">${icon(CLASS_ICON[c.cls])}<span>${c.name}</span></header>
      <div class="mc-art"><img src="${cardArtUrl(c)}" alt="" draggable="false"><span class="mc-troops">×${rolled ?? c.troops}</span></div>
      <footer class="mc-foot"><b class="mc-dmg">${c.dmg}</b><span class="mc-stars">${st}</span><b class="mc-hp">${c.hp}</b></footer>
    </article>`;
}

function miniFlipHtml(front: string): string {
  return `<div class="flipcard mini"><div class="flip-inner" style="transform:rotateY(180deg)"><div class="flip-front">${front}</div><div class="flip-back"><article class="mcard mback" style="--frame:url(${frameUrl()})"><i style="background-image:url(${backArtUrl()})"></i></article></div></div></div>`;
}

export function mobileBattleScreen(g: MobileGame, room: Room, onDone: (res: Result) => void): void {
  const run = g.run!;
  const L = battleLayout();
  const boss = room.kind === 'boss' ? run.boss : null;
  const arena = new Arena();
  arena.startBattle(run.castleHp, run.enemyCastle(room.stars, !!boss), boss, Math.floor(run.rnd() * 1e6));
  const viewA: ArenaView = new MobileArenaView(g.app, g.atlas, arena, g.theme);
  g.app.stage.addChild(viewA.root);
  if (import.meta.env.DEV) Object.assign(window, { __arena: arena, __view: viewA });
  g.app.canvas.style.display = 'block';

  // Positionen (Spielpixel)
  const SLOTS_X = [4, 74, 178, 248]; // du Front, du Back, Gegner Front, Gegner Back
  const PILE = { x: 146, y: L.slotY + 6 };
  const areaTop = 32;
  const areaBot = L.wallBot1 - 2;
  const areaH = areaBot - areaTop;
  // Hand: 2 große Karten oben, eine darunter (Dreieck); bei wenig Platz leicht überlappend
  const handGap = Math.min(6, areaH - BIG.h * 2);
  const handY0 = areaTop + Math.max(0, Math.floor((areaH - (BIG.h * 2 + handGap)) / 2));
  const HAND = [
    { x: MW / 2 - BIG.w - 4, y: handY0 },
    { x: MW / 2 + 4, y: handY0 },
    { x: MW / 2 - BIG.w / 2, y: handY0 + BIG.h + handGap },
  ];

  const tutorial = !localStorage.getItem('c2-tutorial') && run.battlesWon === 0;
  const tl = new Timeline();
  let speed = 1;
  let paused = false;
  /** show = Kartenschau, wartet auf Antippen */
  let phase: 'draw' | 'intro' | 'show' | 'fight' | 'end' = 'draw';
  /** Aktuelles Kartenpaar des Spielers (für die Bonus-Details) */
  const pair: [Card2 | null, Card2 | null] = [null, null];
  let usedMercs = false;
  let survivorsTotal = 0;
  /** Was gerade in den Plätzen liegt (für die Großansicht) */
  const slotCards: ({ card: Card2; rolled?: number } | null)[] = [null, null, null, null];
  let enemyRevealed = false;

  // --- DOM ----------------------------------------------------------------------------------
  const el = document.createElement('section');
  el.className = 'scr battle-scr world s-battle m-battle';
  el.style.setProperty('--frame', `url(${frameUrl()})`);
  el.style.setProperty('--bar-frame', `url(${barFrameUrl()})`);
  const enemyName = boss ? boss.name : `${RACES[run.world].name}`;
  el.innerHTML = `
    <header class="whud m-whud">
      <div class="wbar you">
        <div class="wbar-head"><i class="wbar-chip"></i><span class="wbar-name">You</span><b class="wbar-count"></b></div>
        <div class="wbar-track"><i class="trail"></i><i class="fill"></i></div>
      </div>
      <div class="wtimer"><b class="t-time">0:00</b><span class="wtimer-stars t-round"></span></div>
      <div class="wbar foe">
        <div class="wbar-head"><i class="wbar-chip"></i><span class="wbar-name">${enemyName}</span><b class="wbar-count"></b></div>
        <div class="wbar-track"><i class="trail"></i><i class="fill"></i></div>
        ${boss ? `<div class="boss-bar"><i></i><span>${boss.name}</span></div>` : ''}
      </div>
    </header>
    ${SLOTS_X.map((x, i) => `<div class="wslot bslot mslot" data-s="${i}" style="left:${x}px;top:${L.slotY}px"><span class="slot-label">${i % 2 === 0 ? 'Front' : 'Back'}</span><div class="slot-card empty"></div></div>`).join('')}
    <button class="swap-btn" style="left:${SLOTS_X[1]! - 9}px;top:${L.slotY - 12}px" title="Swap front and back">⇄</button>
    <div class="pile m-pile" style="left:${PILE.x}px;top:${PILE.y}px"><i style="background-image:url(${backArtUrl()})"></i><i style="background-image:url(${backArtUrl()})"></i><span class="pile-n">${run.deck.length}</span></div>
    <div class="m-controls" style="top:${L.barY}px">
      <button class="wbtn fight" disabled>${icon('swords')}<span>Fight!</span></button>
      <div class="bonus-line">${icon('star')}<span class="bonus-text">Choose 2</span><i class="bl-more">?</i></div>
      <button class="wbtn small pause-btn" disabled aria-label="Pause"><b class="pause-ico">II</b></button>
      <div class="wseg" role="group"><button class="seg active" data-sp="1">1×</button><button class="seg" data-sp="2">2×</button><button class="seg" data-sp="4">4×</button></div>
    </div>
    <div class="hand-layer" style="--area-top:${areaTop}px;--area-h:${areaH}px"></div>
    <div class="banner-layer"></div>`;
  g.ui.appendChild(el);

  const $ = <T extends HTMLElement = HTMLElement>(s: string) => el.querySelector<T>(s)!;
  const handLayer = $('.hand-layer');
  const fightBtn = $<HTMLButtonElement>('.fight');
  const pauseBtn = $<HTMLButtonElement>('.pause-btn');
  const bonusText = $('.bonus-text');
  const slotEls = [...el.querySelectorAll<HTMLElement>('.bslot')];
  const bars = [el.querySelector<HTMLElement>('.wbar.you')!, el.querySelector<HTMLElement>('.wbar.foe')!];

  const setPaused = (p: boolean) => {
    paused = p;
    pauseBtn.innerHTML = paused ? icon('play') : '<b class="pause-ico">II</b>';
    pauseBtn.classList.toggle('on', paused);
  };
  pauseBtn.addEventListener('click', () => setPaused(!paused));
  bindBonusPop(el.querySelector<HTMLElement>('.bonus-line')!, el, () => pairBonuses(pair[0], pair[1], run.mods.bonusMul), 'col');
  el.querySelectorAll<HTMLElement>('[data-sp]').forEach((b) =>
    b.addEventListener('click', () => {
      speed = Number(b.dataset.sp);
      el.querySelectorAll('[data-sp]').forEach((x) => x.classList.toggle('active', x === b));
    }),
  );
  // App im Hintergrund → Kampf anhalten
  const onHide = () => {
    if (document.hidden && phase === 'fight' && !paused) setPaused(true);
  };
  document.addEventListener('visibilitychange', onHide);
  // Antippen überspringt Aufstellung + Kartenschau
  el.addEventListener('pointerdown', (e) => {
    if (phase === 'intro' && e.isPrimary) {
      tl.skip();
      viewA.skipIntro();
    }
  });

  // --- HUD ------------------------------------------------------------------------------------
  const trail = [100, 100];
  const updateHud = () => {
    for (let t = 0; t < 2; t++) {
      const pct = (arena.baseHp[t]! / arena.baseMax[t]!) * 100;
      trail[t] = Math.max(pct, trail[t]! - 0.25);
      const track = bars[t]!.querySelector<HTMLElement>('.wbar-track')!;
      track.style.setProperty('--hp', `${pct}%`);
      track.style.setProperty('--trail', `${trail[t]}%`);
      bars[t]!.querySelector('.wbar-count')!.textContent = `${Math.ceil(arena.baseHp[t]!)}`;
    }
    const s = Math.floor(arena.time);
    $('.t-time').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    $('.t-round').textContent = `ROUND ${Math.max(1, arena.round)}`;
    if (boss) el.querySelector<HTMLElement>('.boss-bar i')!.style.width = `${(arena.bossHp / boss.hp) * 100}%`;
  };

  // --- Spielschleife -------------------------------------------------------------------------
  let acc = 0;
  let overResolve: (() => void) | null = null;
  const tick = () => {
    const dt = Math.min(0.1, g.app.ticker.deltaMS / 1000);
    const slow = paused ? 1 : viewA.timeScale(dt);
    const simDt = phase === 'fight' && !paused ? dt * speed * slow : phase === 'intro' || phase === 'show' ? dt : 0;
    acc += simDt;
    let steps = 0;
    while (acc >= DT && steps < 10) {
      arena.step();
      acc -= DT;
      steps++;
    }
    if (steps === 10) acc = 0;
    viewA.update(paused && phase === 'fight' ? 0 : phase === 'fight' ? dt * speed * slow : dt * slow);
    updateHud();
    if (phase === 'fight' && arena.state === 'over' && overResolve) {
      const r = overResolve;
      overResolve = null;
      r();
    }
  };
  g.app.ticker.add(tick);
  const cleanup = () => {
    g.app.ticker.remove(tick);
    document.removeEventListener('visibilitychange', onHide);
  };

  // --- Kartenplätze: antippen = groß ansehen (eigene Plätze beim Wählen: zurücklegen) -----------
  slotEls.forEach((s, i) => {
    const show = () => {
      const c = slotCards[i];
      if (!c || (i >= 2 && !enemyRevealed)) return;
      zoomCard(g.ui, c.card, c.rolled);
    };
    onLongPress(s, show);
    s.addEventListener('click', () => {
      if (phase === 'draw' && i < 2) return; // Zurücklegen, siehe unten
      show();
    });
  });

  // --- Karten ziehen ----------------------------------------------------------------------------
  const bonusOf = (a: Card2, b: Card2): string[] => {
    const out: string[] = [];
    if (a.race === b.race) out.push(`${RACE_BONUS[a.race].name}`);
    if (a.cls === b.cls) out.push(`${CLASS_BONUS[a.cls].name}`);
    return out;
  };

  const drawThree = (): DeckCard[] => {
    const pool = [...run.deck];
    const out: DeckCard[] = [];
    while (out.length < 3 && pool.length) {
      const weights = pool.map((d) => (out.some((o) => o.card.race === d.card.race || o.card.cls === d.card.cls) ? 1.6 : 1));
      let x = Math.random() * weights.reduce((s, w) => s + w, 0);
      let idx = 0;
      for (; idx < pool.length - 1; idx++) {
        x -= weights[idx]!;
        if (x <= 0) break;
      }
      out.push(pool.splice(idx, 1)[0]!);
    }
    return out;
  };

  const rollTroops = (c: Card2): number => (c.troops <= 1 ? 1 : Math.max(1, Math.round(c.troops * (0.55 + 0.45 * Math.random()))));

  const enemyPick = (): Deployed[] => {
    const deck = run.enemyDeck();
    const a = deck[Math.floor(Math.random() * deck.length)]!;
    const pairs = deck.filter((c) => c !== a && (c.race === a.race || c.cls === a.cls));
    const b = Math.random() < 0.4 && pairs.length ? pairs[Math.floor(Math.random() * pairs.length)]! : deck[Math.floor(Math.random() * deck.length)]!;
    const melee = (c: Card2) => ['Infantry', 'Cavalry', 'Beast', 'Swarm', 'Champion'].includes(c.cls);
    const [f, bk] = melee(b) && !melee(a) ? [b, a] : [a, b];
    const st = run.enemyStars();
    return [
      { card: f, stars: st, count: rollTroops(f) },
      { card: bk, stars: st, count: rollTroops(bk) },
    ];
  };

  const hint = (text: string, x: number, y: number, arrow: 'up' | 'down' | 'none' = 'none'): HTMLElement => {
    const h = html(`<div class="tut-hint ${arrow}" style="left:${x}px;top:${y}px">${text}</div>`);
    el.appendChild(h);
    return h;
  };

  // --- Eine Runde --------------------------------------------------------------------------------
  const playRound = async (): Promise<void> => {
    phase = 'draw';
    tl.reset();
    fightBtn.disabled = true;
    pauseBtn.disabled = true;
    el.classList.remove('fighting');
    enemyRevealed = false;
    bonusText.textContent = 'Choose 2';
    pair[0] = pair[1] = null;
    slotEls.forEach((s, i) => {
      s.querySelector('.slot-card')!.className = 'slot-card empty';
      s.querySelector('.slot-card')!.innerHTML = '';
      slotCards[i] = null;
    });

    // Gegner zieht verdeckt
    const enemy = enemyPick();
    for (let k = 0; k < 2; k++) {
      const slot = slotEls[2 + k]!.querySelector<HTMLElement>('.slot-card')!;
      slot.className = 'slot-card';
      const card = withStars({ card: enemy[k]!.card, stars: enemy[k]!.stars });
      slotCards[2 + k] = { card, rolled: enemy[k]!.count };
      slot.innerHTML = miniFlipHtml(miniCardHtml(card, enemy[k]!.count));
      void tl.play(slot, [{ transform: 'translateY(-120px) rotate(12deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 420, delay: 150 + k * 160, easing: 'cubic-bezier(.2,.8,.3,1)' });
    }

    // 3 Karten nacheinander vom Stapel
    const hand = drawThree();
    const rolls = hand.map((d) => rollTroops(d.card));
    handLayer.innerHTML = '<div class="hand-dim"></div>';
    handLayer.classList.add('on');
    const handEls: HTMLElement[] = [];
    for (let k = 0; k < hand.length; k++) {
      const c = html(`<div class="hand-card" data-k="${k}"><div class="flipcard big"><div class="flip-inner" style="transform:rotateY(180deg)"><div class="flip-front">${pcardHtml(withStars(hand[k]!), { big: true, rolled: rolls[k] })}</div><div class="flip-back"><article class="pc pc-back big" style="--frame:url(${frameUrl()})"><div class="pc-back-art" style="background-image:url(${backArtUrl()})"></div></article></div></div></div><span class="hand-tag"></span></div>`);
      handLayer.appendChild(c);
      handEls.push(c);
      el.querySelector('.pile-n')!.textContent = String(run.deck.length - k - 1);
      await flyArc(tl, c, { x: PILE.x, y: PILE.y, s: 0.2, r: -20 }, { x: HAND[k]!.x, y: HAND[k]!.y, s: 1, r: 0 }, 520, 60, 8);
      void flip(tl, c);
      burst(g.fx, HAND[k]!.x + BIG.w / 2, HAND[k]!.y + BIG.h / 2, ['#ffffff', '#fff4b0', RACES[hand[k]!.card.race].art[3]], 14, 60, 10);
      await sleep(90);
    }
    el.querySelector('.pile-n')!.textContent = String(run.deck.length);

    // Auswahl
    const chosen: (number | null)[] = [null, null];
    let hintEl: HTMLElement | null = tutorial && arena.round === 0 ? hint('Tap 2 of these 3 cards.<br>The first one fights in FRONT.<br>Hold a card to read it.', 60, Math.min(HAND[2]!.y + BIG.h + 8, L.slotY - 56), 'up') : null;

    const refresh = () => {
      handEls.forEach((h, k) => {
        const pos = chosen.indexOf(k);
        h.classList.toggle('picked', pos >= 0);
        h.querySelector('.hand-tag')!.textContent = pos === 0 ? 'FRONT' : pos === 1 ? 'BACK' : '';
      });
      for (let s = 0; s < 2; s++) {
        const slot = slotEls[s]!.querySelector<HTMLElement>('.slot-card')!;
        const k = chosen[s] ?? null;
        slot.className = k === null ? 'slot-card empty' : 'slot-card';
        slot.innerHTML = k === null ? '' : miniCardHtml(withStars(hand[k]!), rolls[k]);
        slotCards[s] = k === null ? null : { card: withStars(hand[k]!), rolled: rolls[k] };
      }
      const ready = chosen[0] !== null && chosen[1] !== null;
      pair[0] = ready ? hand[chosen[0]!]!.card : null;
      pair[1] = ready ? hand[chosen[1]!]!.card : null;
      fightBtn.disabled = !ready;
      if (ready) {
        const b = bonusOf(hand[chosen[0]!]!.card, hand[chosen[1]!]!.card);
        bonusText.textContent = b.length ? b.join(' + ') : 'No bonus';
        el.querySelector('.bonus-line')!.classList.toggle('lit', b.length > 0);
        if (hintEl && tutorial) {
          hintEl.remove();
          hintEl = hint('Same COLOR or same CLASS = bonus!<br>Now press FIGHT.', 8, L.barY - 40, 'down');
        }
      } else {
        bonusText.textContent = 'Choose 2';
        el.querySelector('.bonus-line')!.classList.remove('lit');
      }
    };

    const flyToSlot = async (k: number, s: number) => {
      const from = localRect(handEls[k]!);
      const clone = html(`<div class="fly-card">${miniCardHtml(withStars(hand[k]!), rolls[k])}</div>`);
      g.fx.appendChild(clone);
      await flyArc(new Timeline(), clone, { x: from.x + (BIG.w - 68) / 2, y: from.y + (BIG.h - 62) / 2, s: 1.6 }, { x: SLOTS_X[s]!, y: L.slotY, s: 1 }, 380, 30, 6);
      clone.remove();
    };

    await new Promise<void>((resolve) => {
      handEls.forEach((h, k) => {
        onLongPress(h, () => zoomCard(g.ui, withStars(hand[k]!), rolls[k]));
        h.addEventListener('click', async () => {
          const pos = chosen.indexOf(k);
          if (pos >= 0) chosen[pos] = null;
          else {
            const free = chosen.indexOf(null);
            if (free < 0) return;
            chosen[free] = k;
            await flyToSlot(k, free);
          }
          refresh();
        });
      });
      // Antippen einer eigenen Karte im Platz legt sie zurück
      for (let s = 0; s < 2; s++)
        slotEls[s]!.addEventListener('click', () => {
          if (phase !== 'draw' || chosen[s] === null) return;
          chosen[s] = null;
          refresh();
        });
      $('.swap-btn').onclick = () => {
        if (phase !== 'draw') return;
        [chosen[0], chosen[1]] = [chosen[1]!, chosen[0]!];
        refresh();
      };
      fightBtn.onclick = () => {
        if (chosen[0] === null || chosen[1] === null) return;
        hintEl?.remove();
        resolve();
      };
    });

    // --- FIGHT ---------------------------------------------------------------------------
    phase = 'intro';
    tl.reset();
    fightBtn.disabled = true;
    el.classList.add('fighting');
    const front = hand[chosen[0]!]!;
    const back = hand[chosen[1]!]!;
    if (front.card.name === 'Mercenary Company' || back.card.name === 'Mercenary Company') usedMercs = true;
    const rest = handEls.findIndex((_, k) => !chosen.includes(k));
    const anims: Promise<void>[] = [];
    handEls.forEach((h, k) => {
      if (k === rest) anims.push(flyArc(tl, h, { x: HAND[k]!.x, y: HAND[k]!.y }, { x: PILE.x, y: PILE.y, s: 0.2, r: 20 }, 420, 30, -10));
      else anims.push(tl.play(h, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 }));
    });
    await Promise.all(anims);
    handLayer.classList.remove('on');
    handLayer.innerHTML = '';

    // Gegnerkarten aufdecken
    enemyRevealed = true;
    for (let k = 0; k < 2; k++) void flip(tl, slotEls[2 + k]!.querySelector<HTMLElement>('.flipcard')!);

    const sides: [SideSpec, SideSpec] = [
      { front: { card: front.card, stars: front.stars, count: rolls[chosen[0]!] }, back: { card: back.card, stars: back.stars, count: rolls[chosen[1]!] }, mods: run.mods, baseHp: run.castleHp, power: 1 },
      { front: enemy[0]!, back: enemy[1]!, baseHp: 0, power: run.enemyPower(room.stars) },
    ];
    arena.deployRound(sides);
    viewA.playSpawnIntro();
    if (tutorial && arena.round === 1) hint('Tap to skip the intro.', 100, L.top + L.len / 2);
    await tl.wait(1500);
    viewA.skipIntro();
    el.querySelectorAll('.tut-hint').forEach((h) => h.remove());

    await showcase(sides);

    arena.begin();
    phase = 'fight';
    pauseBtn.disabled = false;
    if (tutorial && arena.round === 1) {
      const h = hint('Units that reach the enemy castle<br>deal 1 damage each.', 60, L.top + 30);
      setTimeout(() => h.remove(), 4500);
    }
    await new Promise<void>((r) => (overResolve = r));
    survivorsTotal += arena.survivorsAtBase[0]!;
  };

  /** Kartenschau: Gegnerkarten oben, eigene unten, dazwischen VS und die Boni. */
  const showcase = async (sides: [SideSpec, SideSpec]): Promise<void> => {
    const layer = el.querySelector<HTMLElement>('.banner-layer')!;
    const midY = areaTop + areaH / 2;
    const foeY = Math.max(areaTop + 2, midY - 50 - SMALL.h);
    const youY = Math.min(areaBot - SMALL.h - 2, midY + 50);
    const targets = [
      { x: MW / 2 - SMALL.w - 3, y: youY },
      { x: MW / 2 + 3, y: youY },
      { x: MW / 2 - SMALL.w - 3, y: foeY },
      { x: MW / 2 + 3, y: foeY },
    ];
    const cards = [sides[0].front, sides[0].back, sides[1].front, sides[1].back];
    const clones: HTMLElement[] = [];
    const flights: Promise<void>[] = [];
    cards.forEach((d, i) => {
      const c = html(`<div class="fly-card show">${pcardHtml(withStars({ card: d.card, stars: d.stars }), { team: i < 2 ? 0 : 1, rolled: d.count })}</div>`);
      layer.appendChild(c);
      clones.push(c);
      flights.push(flyArc(tl, c, { x: SLOTS_X[i]!, y: L.slotY, s: 68 / SMALL.w }, { ...targets[i]!, s: 1 }, 560 + i * 60, 50, i < 2 ? 10 : -10));
    });
    slotEls.forEach((s) => s.classList.add('away'));
    await Promise.all(flights);
    const vs = html(`<div class="vs" style="left:${MW / 2 - 9}px;top:${midY - 9}px">VS</div>`);
    layer.appendChild(vs);
    const bonusBox = (side: 0 | 1) => {
      const f = sides[side].front.card;
      const b = sides[side].back.card;
      const lines: string[] = [];
      if (f.race === b.race) lines.push(`<span class="bn race" style="--rc:${RACES[f.race].art[3]}">${icon('star')}<b>${RACE_BONUS[f.race].name}</b><em>${RACE_BONUS[f.race].text}</em></span>`);
      if (f.cls === b.cls) lines.push(`<span class="bn cls">${icon('star')}<b>${CLASS_BONUS[f.cls].name}</b><em>${CLASS_BONUS[f.cls].text}</em></span>`);
      if (!lines.length) lines.push(`<span class="bn none">No bonus</span>`);
      const box = html(`<div class="bonus-box ${side === 0 ? 'you' : 'foe'}" style="left:${MW / 2 - 148}px">${lines.join('')}</div>`);
      // Antippen eines Bonus: Details klappen nach oben auf
      const bm = side === 0 ? run.mods.bonusMul : 1;
      box.querySelectorAll<HTMLElement>('.bn').forEach((n) => {
        const items = n.classList.contains('race') ? [raceBonusDetail(f.race, bm)] : n.classList.contains('cls') ? [classBonusDetail(f.cls, bm)] : pairBonuses(f, b, bm);
        bindBonusPop(n, el, () => items, 'col');
      });
      // eigene Boni unter dem VS, gegnerische darüber (wachsen vom VS weg)
      if (side === 0) box.style.top = `${midY + 14}px`;
      else {
        box.style.top = 'auto';
        box.style.bottom = `calc(var(--H) - ${midY - 14}px)`;
      }
      return box;
    };
    // Ab hier nicht mehr überspringbar: die Kartenschau bleibt, bis man antippt
    phase = 'show';
    tl.reset();
    const bb = [bonusBox(0), bonusBox(1)];
    bb.forEach((b, i) => {
      layer.appendChild(b);
      b.querySelectorAll<HTMLElement>('.bn').forEach((n, k) => void tl.play(n, [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1.15)', offset: 0.6 }, { opacity: 1, transform: 'scale(1)' }], { duration: 380, delay: 120 + i * 140 + k * 160 }));
    });
    void tl.play(vs, [{ opacity: 0, transform: 'scale(3)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 300 });
    const go = html(`<div class="sc-continue" style="top:${Math.min(youY + SMALL.h + 8, L.slotY - 22)}px">${icon('play')}<span>Tap to start the battle</span></div>`);
    layer.appendChild(go);
    await waitForTap();
    closeBonusPop(el);
    go.remove();
    const back = clones.map((c, i) => flyArc(tl, c, { ...targets[i]!, s: 1 }, { x: SLOTS_X[i]!, y: L.slotY, s: 68 / SMALL.w }, 460, 40, i < 2 ? -8 : 8));
    [...bb, vs].forEach((x) => void tl.play(x, [{ opacity: 1 }, { opacity: 0 }], { duration: 250 }));
    await Promise.all(back);
    slotEls.forEach((s) => s.classList.remove('away'));
    layer.innerHTML = '';
  };

  /** Wartet in der Kartenschau auf ein Antippen (nicht auf einen Bonus, nicht zum Schließen der Details). */
  const waitForTap = () =>
    new Promise<void>((resolve) => {
      const t0 = performance.now();
      const onDown = (e: PointerEvent) => {
        if (!e.isPrimary || e.button > 0 || performance.now() - t0 < 250) return;
        if ((e.target as HTMLElement).closest('button, .bn, .bonus-line, .m-zoom')) return;
        // offene Details schließt das Antippen zuerst nur
        if (el.querySelector('.bpop')) return;
        el.removeEventListener('pointerdown', onDown, true);
        resolve();
      };
      el.addEventListener('pointerdown', onDown, true);
    });

  const banner = async (text: string, sub = ''): Promise<void> => {
    const layer = el.querySelector<HTMLElement>('.banner-layer')!;
    const b = html(`<div class="round-banner" style="top:${Math.round(L.top + L.len / 2 - 18)}px"><b>${text}</b>${sub ? `<span>${sub}</span>` : ''}</div>`);
    layer.appendChild(b);
    await b.animate([{ opacity: 0, transform: 'scaleY(0)' }, { opacity: 1, transform: 'scaleY(1)', offset: 0.2 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: 1400 }).finished;
    b.remove();
  };

  // --- Ende des Kampfes ------------------------------------------------------------------------
  const finish = async (won: boolean) => {
    phase = 'end';
    pauseBtn.disabled = true;
    setPaused(false);
    viewA.crumbleCastle(won ? 1 : 0);
    while (!viewA.crumbleDone) await sleep(100);
    await sleep(300);
    if (tutorial) localStorage.setItem('c2-tutorial', '1');
    if (won) showRewards();
    else showDefeat();
  };

  const panelTop = L.top + 10;

  const showDefeat = () => {
    run.lives = Math.max(0, run.lives - 1);
    const over = !!boss || run.lives <= 0;
    const p = html(`
      <div class="gpanel reward-panel lose" style="top:${panelTop}px">
        <div class="gpanel-title">Your castle has fallen</div>
        <div class="rw-list"></div>
        <button class="gbtn primary big rw-go" style="visibility:hidden">${over ? 'End Run' : 'Continue'}</button>
      </div>`);
    el.appendChild(p);
    const list = p.querySelector<HTMLElement>('.rw-list')!;
    const lines = [`${icon('heart')} <b>−1 life</b> <em>${run.lives} left</em>`, boss ? `${icon('skull')} <b>${boss.name}</b> <em>ends your run</em>` : `<em>No reward this time.</em>`];
    void listLines(list, lines).then(() => {
      const go = p.querySelector<HTMLElement>('.rw-go')!;
      go.style.visibility = 'visible';
      go.addEventListener('click', () => {
        cleanup();
        onDone('lose');
      });
    });
  };

  const listLines = async (list: HTMLElement, lines: string[]) => {
    for (const l of lines) {
      const row = html(`<div class="rw-row">${l}</div>`);
      list.appendChild(row);
      row.animate([{ opacity: 0, transform: 'translateX(-20px)' }, { opacity: 1, transform: 'none' }], { duration: 260, fill: 'forwards' });
      const r = localRect(row);
      burst(g.fx, r.x + 12, r.y + 6, ['#ffe23a', '#ffffff'], 10, 30, 10);
      await sleep(420);
    }
  };

  const showRewards = () => {
    run.battlesWon++;
    const gold = run.battleGold(room.stars) * (boss ? 3 : 1);
    const surv = Math.round(Math.min(40, survivorsTotal / 8) * run.mods.goldMul);
    const mercs = usedMercs ? 15 : 0;
    run.gold += gold + surv + mercs;
    const lines = [`${icon('coin')} <b>+${gold} gold</b> <em>${boss ? 'Boss defeated' : 'Victory'}</em>`];
    if (surv > 0) lines.push(`${icon('shield')} <b>+${surv} gold</b> <em>Survivor bonus</em>`);
    if (mercs) lines.push(`${icon('coin')} <b>+${mercs} gold</b> <em>Mercenaries paid</em>`);
    if (room.stars >= 3 || boss) {
      const up = run.upgradeable();
      if (up.length) {
        const d = up[Math.floor(run.rnd() * up.length)]!;
        d.stars++;
        lines.push(`${icon('star')} <b>${d.card.name}</b> <em>upgraded to ★${d.stars}</em>`);
      }
    }
    if (boss) {
      if (run.lives < 3) {
        run.lives++;
        lines.push(`${icon('heart')} <b>+1 life</b> <em>${run.lives} lives</em>`);
      }
      if (arena.bossFled) lines.push(`${icon('skull')} <b>${boss.name} fled</b> <em>no boss card</em>`);
    }
    const p = html(`
      <div class="gpanel reward-panel" style="top:${panelTop}px">
        <div class="gpanel-title">${boss ? `${boss.name} is defeated!` : 'Victory!'}</div>
        <div class="rw-list"></div>
        <div class="rw-pick"></div>
        <button class="gbtn primary big rw-go" style="visibility:hidden">Continue</button>
      </div>`);
    el.appendChild(p);
    const go = p.querySelector<HTMLElement>('.rw-go')!;
    void listLines(p.querySelector<HTMLElement>('.rw-list')!, lines).then(() => {
      if (boss && !arena.bossFled) {
        const pick = p.querySelector<HTMLElement>('.rw-pick')!;
        const names = [...new Set(boss.deck)];
        const opts: Card2[] = [];
        while (opts.length < 3 && names.length) opts.push(cardByName(names.splice(Math.floor(run.rnd() * names.length), 1)[0]!));
        pick.innerHTML = `<div class="rw-pick-title">Choose a card from ${boss.name}'s army<br><small>Hold a card to read it</small></div><div class="rw-pick-row">${opts.map((c, i) => `<button class="rw-card" data-i="${i}">${pcardHtml({ ...c, stars: 1 })}</button>`).join('')}</div>`;
        pick.querySelectorAll<HTMLElement>('.rw-card').forEach((b) => {
          const c = opts[Number(b.dataset.i)]!;
          onLongPress(b, () => zoomCard(g.ui, { ...c, stars: 1 }));
          b.addEventListener('click', () => {
            if (b.classList.contains('taken')) return;
            run.addCard(c);
            pick.querySelectorAll('.rw-card').forEach((x) => x.classList.toggle('gone', x !== b));
            b.classList.add('taken');
            go.style.visibility = 'visible';
          });
        });
      } else go.style.visibility = 'visible';
    });
    go.addEventListener('click', () => {
      cleanup();
      onDone('win');
    });
  };

  // --- Ablauf aller Runden -------------------------------------------------------------------------
  const loop = async () => {
    await sleep(400);
    for (;;) {
      await playRound();
      const out = arena.outcome;
      if (out === 'win') return finish(true);
      if (out === 'lose') return finish(false);
      await banner(`Round ${arena.round + 1}`, `${arena.survivorsAtBase[0]} of yours reached the castle`);
    }
  };
  void loop();
  updateHud();
}

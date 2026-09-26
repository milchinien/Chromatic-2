// =====================================================================
// Kampfbildschirm. Pro Runde:
//   Ziehen (3 Karten fliegen nacheinander vom Stapel und drehen sich um)
//   → 2 wählen, Front/Back tauschen → FIGHT
//   → Einheiten erscheinen (Partikel) → Standbild: alle 4 Karten fliegen in
//     die Mitte, Boni leuchten auf, Karten fliegen zurück (Linksklick = skip)
//   → Kampf → Überlebende laufen zur Burg (1 Schaden je Einheit)
//   → nächste Runde, bis eine Burg fällt. Dann zerbröckelt sie und die
//     Belohnungen werden nacheinander aufgelistet.
// =====================================================================

import { audio } from '../audio/audio';
import { BattleAudio } from '../audio/battleAudio';
import { barFrameUrl, cardBackHtml, flipCardHtml, frameUrl, pcardHtml } from '../../lab/pcard';
import { icon } from '../../lab/pixels';
import { CLASS_BONUS, RACE_BONUS, RACES, cardByName, type Card2 } from '../data';
import { withStars, type Game } from '../game';
import { Arena, DT, type Deployed, type SideSpec } from '../sim/arena';
import { enemyPick as pickEnemy, rollTroops } from '../sim/balance';
import { ArenaView } from '../render/arenaView';
import type { DeckCard, Room } from '../run';
import { Timeline, burst, flip, flyArc, html, localRect, sleep } from '../ui/anim';

type Result = 'win' | 'lose';

/** Abspielrate für einen Halbtonschritt. */
const semiRate = (n: number) => Math.pow(2, n / 12);

// Positionen (Spielpixel)
const SLOT_Y = 225;
const SLOTS_X = [19, 110, 443, 535]; // du Front, du Back, Gegner Front, Gegner Back
const PILE = { x: 204, y: 268 };
const HAND_Y = 58;
const HAND_X = [122, 258, 394];
const SMALL = { w: 86, h: 119 };
const BIG = { w: 124, h: 180 };

export function battleScreen(g: Game, room: Room, onDone: (res: Result) => void): void {
  const run = g.run!;
  const boss = room.kind === 'boss' ? run.boss : null;
  const arena = new Arena();
  arena.startBattle(run.castleHp, run.enemyCastle(room.stars, !!boss), boss, Math.floor(run.rnd() * 1e6), run.bossPower());
  const viewA = new ArenaView(g.app, g.atlas, arena, g.theme);
  g.app.stage.addChild(viewA.root);
  if (import.meta.env.DEV) Object.assign(window, { __arena: arena, __view: viewA });
  g.app.canvas.style.display = 'block';
  const sound = new BattleAudio(arena);

  const tutorial = !localStorage.getItem('c2-tutorial') && run.battlesWon === 0;
  const tl = new Timeline();
  let speed = 1;
  let paused = false;
  let phase: 'draw' | 'intro' | 'fight' | 'end' = 'draw';
  let usedMercs = false;
  let survivorsTotal = 0;

  // --- DOM ----------------------------------------------------------------------------------
  const el = document.createElement('section');
  el.className = 'scr battle-scr world s-battle';
  el.style.setProperty('--frame', `url(${frameUrl()})`);
  el.style.setProperty('--bar-frame', `url(${barFrameUrl()})`);
  const enemyName = boss ? boss.name : `${RACES[run.world].name} Warband`;
  el.innerHTML = `
    <header class="whud">
      <div class="wbar you">
        <div class="wbar-head"><i class="wbar-chip"></i><span class="wbar-name">Your Castle</span><b class="wbar-count"></b></div>
        <div class="wbar-track"><i class="trail"></i><i class="fill"></i></div>
      </div>
      <div class="wtimer"><b class="t-time">0:00</b><span class="wtimer-stars t-round"></span></div>
      <div class="wbar foe">
        <div class="wbar-head"><i class="wbar-chip"></i><span class="wbar-name">${enemyName}</span><b class="wbar-count"></b></div>
        <div class="wbar-track"><i class="trail"></i><i class="fill"></i></div>
        ${boss ? `<div class="boss-bar"><i></i><span>${boss.name}</span></div>` : ''}
      </div>
    </header>
    ${SLOTS_X.map((x, i) => `<div class="wslot bslot" data-s="${i}" style="left:${x}px"><span class="slot-label">${i % 2 === 0 ? 'Front' : 'Back'}</span><div class="slot-card empty"></div></div>`).join('')}
    <button class="swap-btn" data-sfx="card_whoosh" title="Swap front and back">⇄</button>
    <div class="pile">${cardBackHtml()}${cardBackHtml()}${cardBackHtml()}<span class="pile-n">${run.deck.length}</span></div>
    <div class="wcontrols bt-controls">
      <div class="bonus-line">${icon('star')}<span class="bonus-text">Choose 2 cards</span></div>
      <button class="wbtn fight" data-sfx="confirm" disabled>${icon('swords')}<span>Fight!</span></button>
      <div class="control-row">
        <button class="wbtn small pause-btn" disabled>Pause</button>
        <div class="wseg" role="group"><button class="seg active" data-sp="1">1×</button><button class="seg" data-sp="2">2×</button><button class="seg" data-sp="4">4×</button></div>
      </div>
    </div>
    <div class="hand-layer"></div>
    <div class="banner-layer"></div>`;
  g.ui.appendChild(el);

  const $ = <T extends HTMLElement = HTMLElement>(s: string) => el.querySelector<T>(s)!;
  const handLayer = $('.hand-layer');
  const fightBtn = $<HTMLButtonElement>('.fight');
  const pauseBtn = $<HTMLButtonElement>('.pause-btn');
  const bonusText = $('.bonus-text');
  const slotEls = [...el.querySelectorAll<HTMLElement>('.bslot')];
  const bars = [el.querySelector<HTMLElement>('.wbar.you')!, el.querySelector<HTMLElement>('.wbar.foe')!];

  pauseBtn.addEventListener('click', () => {
    paused = !paused;
    pauseBtn.textContent = paused ? 'Go' : 'Pause';
  });
  el.querySelectorAll<HTMLElement>('[data-sp]').forEach((b) =>
    b.addEventListener('click', () => {
      speed = Number(b.dataset.sp);
      el.querySelectorAll('[data-sp]').forEach((x) => x.classList.toggle('active', x === b));
    }),
  );
  // Linksklick überspringt Aufstellung + Kartenschau
  el.addEventListener('pointerdown', (e) => {
    if (phase === 'intro' && e.button === 0) {
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
      bars[t]!.querySelector('.wbar-count')!.innerHTML = `${Math.ceil(arena.baseHp[t]!)}<small>/${arena.baseMax[t]}</small>`;
    }
    const s = Math.floor(arena.time);
    $('.t-time').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    $('.t-round').textContent = `ROUND ${Math.max(1, arena.round)}`;
    if (boss) el.querySelector<HTMLElement>('.boss-bar i')!.style.width = `${(arena.bossHp / arena.bossMax) * 100}%`;
  };

  // --- Spielschleife -------------------------------------------------------------------------
  let acc = 0;
  let overResolve: (() => void) | null = null;
  const tick = () => {
    const dt = Math.min(0.1, g.app.ticker.deltaMS / 1000);
    // Zeitlupe bei großen Momenten (Boss fällt, eine Seite ist besiegt …)
    const slow = paused ? 1 : viewA.timeScale(dt);
    const simDt = phase === 'fight' && !paused ? dt * speed * slow : phase === 'intro' ? dt : 0;
    acc += simDt;
    let steps = 0;
    while (acc >= DT && steps < 10) {
      arena.step();
      acc -= DT;
      steps++;
    }
    if (steps === 10) acc = 0;
    sound.update(dt, slow, speed, paused);
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
    sound.stop();
  };

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
      // Karten, die mit einer gezogenen Karte ein Paar bilden, sind etwas wahrscheinlicher
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

  // Gegner-KI und Truppenwürfel teilen sich Spiel und Balance-Simulation (sim/balance.ts)
  const enemyPick = (): Deployed[] => pickEnemy(run.enemyDeck(), run.enemyStars());

  const smallAt = (i: number) => ({ x: SLOTS_X[i]!, y: SLOT_Y });

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
    bonusText.textContent = 'Choose 2 cards';
    slotEls.forEach((s) => {
      s.querySelector('.slot-card')!.className = 'slot-card empty';
      s.querySelector('.slot-card')!.innerHTML = '';
    });

    // Gegner zieht verdeckt
    const enemy = enemyPick();
    for (let k = 0; k < 2; k++) {
      const slot = slotEls[2 + k]!.querySelector<HTMLElement>('.slot-card')!;
      slot.className = 'slot-card';
      slot.innerHTML = flipCardHtml(pcardHtml(withStars({ uid: 0, card: enemy[k]!.card, stars: enemy[k]!.stars }), { team: 1, rolled: enemy[k]!.count }));
      void tl.play(slot, [{ transform: 'translateX(140px) rotate(12deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 420, delay: 150 + k * 160, easing: 'cubic-bezier(.2,.8,.3,1)' });
      audio.play('card_draw', { pan: 0.6, delay: (150 + k * 160) / 1000, vol: 0.7 });
    }

    // 3 Karten nacheinander vom Stapel
    const hand = drawThree();
    const rolls = hand.map((d) => rollTroops(d.card));
    handLayer.innerHTML = '<div class="hand-dim"></div><div class="hand-title">Choose 2 cards</div>';
    handLayer.classList.add('on');
    const handEls: HTMLElement[] = [];
    for (let k = 0; k < hand.length; k++) {
      const c = html(`<div class="hand-card" data-k="${k}">${flipCardHtml(pcardHtml(withStars(hand[k]!), { big: true, rolled: rolls[k] }), true)}<span class="hand-tag"></span></div>`);
      handLayer.appendChild(c);
      handEls.push(c);
      const deckCount = el.querySelector('.pile-n')!;
      deckCount.textContent = String(run.deck.length - k - 1);
      audio.play('card_draw', { pan: -0.2 + k * 0.2 });
      await flyArc(tl, c, { x: PILE.x, y: PILE.y, s: 0.33, r: -20 }, { x: HAND_X[k]!, y: HAND_Y, s: 1, r: 0 }, 520, 60, 8);
      audio.play('card_flip', { pan: -0.4 + k * 0.4 });
      void flip(tl, c);
      burst(g.fx, HAND_X[k]! + BIG.w / 2, HAND_Y + BIG.h / 2, ['#ffffff', '#fff4b0', RACES[hand[k]!.card.race].art[3]], 14, 70, 10);
      await sleep(90);
    }
    el.querySelector('.pile-n')!.textContent = String(run.deck.length);

    // Auswahl
    const chosen: (number | null)[] = [null, null]; // Hand-Index für Front/Back
    let hintEl: HTMLElement | null = tutorial && arena.round === 0 ? hint('Pick 2 of these 3 cards.<br>The first one fights in FRONT.', 250, 244, 'up') : null;

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
        slot.innerHTML = k === null ? '' : pcardHtml(withStars(hand[k]!), { rolled: rolls[k] });
      }
      const ready = chosen[0] !== null && chosen[1] !== null;
      fightBtn.disabled = !ready;
      if (ready) {
        const b = bonusOf(hand[chosen[0]!]!.card, hand[chosen[1]!]!.card);
        bonusText.textContent = b.length ? `Bonus: ${b.join(' + ')}` : 'No bonus';
        el.querySelector('.bonus-line')!.classList.toggle('lit', b.length > 0);
        if (b.length) audio.play('chime', { rate: b.length > 1 ? 1.26 : 1, vol: 0.7 });
        if (hintEl && tutorial) {
          hintEl.remove();
          hintEl = hint('Same COLOR or same CLASS = bonus!<br>Now press FIGHT.', 236, 206, 'down');
        }
      } else {
        bonusText.textContent = 'Choose 2 cards';
        el.querySelector('.bonus-line')!.classList.remove('lit');
      }
    };

    const flyToSlot = async (k: number, s: number) => {
      const from = localRect(handEls[k]!);
      const clone = html(`<div class="fly-card">${pcardHtml(withStars(hand[k]!), { rolled: rolls[k] })}</div>`);
      g.fx.appendChild(clone);
      await flyArc(new Timeline(), clone, { x: from.x, y: from.y, s: BIG.w / SMALL.w }, { ...smallAt(s), s: 1 }, 380, 30, 6);
      clone.remove();
    };

    await new Promise<void>((resolve) => {
      handEls.forEach((h, k) =>
        h.addEventListener('click', async () => {
          const pos = chosen.indexOf(k);
          if (pos >= 0) {
            chosen[pos] = null;
            audio.play('card_whoosh', { rate: 0.85 });
          } else {
            const free = chosen.indexOf(null);
            if (free < 0) return;
            chosen[free] = k;
            audio.play('card_whoosh');
            await flyToSlot(k, free);
            audio.play('card_place', { pan: -0.8 });
          }
          refresh();
        }),
      );
      // Klick auf eine Karte im Slot legt sie zurück
      for (let s = 0; s < 2; s++)
        slotEls[s]!.addEventListener('click', () => {
          if (phase !== 'draw' || chosen[s] === null) return;
          chosen[s] = null;
          audio.play('card_whoosh', { rate: 0.85 });
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
    const front = hand[chosen[0]!]!;
    const back = hand[chosen[1]!]!;
    if (front.card.name === 'Mercenary Company' || back.card.name === 'Mercenary Company') usedMercs = true;
    // Die dritte Karte geht zurück auf den Stapel, die gewählten verschwinden aus der Hand
    const rest = handEls.findIndex((_, k) => !chosen.includes(k));
    const anims: Promise<void>[] = [];
    handEls.forEach((h, k) => {
      if (k === rest) anims.push(flyArc(tl, h, { x: HAND_X[k]!, y: HAND_Y }, { x: PILE.x, y: PILE.y, s: 0.33, r: 20 }, 420, 30, -10));
      else anims.push(tl.play(h, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 }));
    });
    await Promise.all(anims);
    handLayer.classList.remove('on');
    handLayer.innerHTML = '';

    // Gegnerkarten aufdecken
    for (let k = 0; k < 2; k++) {
      audio.play('card_flip', { pan: 0.6 + k * 0.2, delay: k * 0.08 });
      void flip(tl, slotEls[2 + k]!.querySelector<HTMLElement>('.flipcard')!);
    }

    const sides: [SideSpec, SideSpec] = [
      { front: { card: front.card, stars: front.stars, count: rolls[chosen[0]!] }, back: { card: back.card, stars: back.stars, count: rolls[chosen[1]!] }, mods: run.mods, baseHp: run.castleHp, power: 1 },
      { front: enemy[0]!, back: enemy[1]!, baseHp: 0, power: run.enemyPower(room.stars, !!boss) },
    ];
    arena.deployRound(sides);
    viewA.playSpawnIntro();
    audio.play('deploy', { jitter: 0.02 });
    if (tutorial && arena.round === 1) hint('Left-click to skip the intro.', 262, 190);
    await tl.wait(1500);
    viewA.skipIntro();
    el.querySelectorAll('.tut-hint').forEach((h) => h.remove());

    // Kartenschau: alle 4 Karten fliegen in die Mitte, Boni leuchten auf
    await showcase(sides);

    arena.begin();
    audio.play(arena.round === 1 ? 'battle_start' : 'round', { jitter: 0 });
    phase = 'fight';
    pauseBtn.disabled = false;
    if (tutorial && arena.round === 1) {
      const h = hint('Units that reach the enemy castle<br>damage it. Stronger units hit harder.', 250, 70);
      setTimeout(() => h.remove(), 4500);
    }
    await new Promise<void>((r) => (overResolve = r));
    survivorsTotal += arena.survivorsAtBase[0]!;
  };

  const showcase = async (sides: [SideSpec, SideSpec]): Promise<void> => {
    const layer = el.querySelector<HTMLElement>('.banner-layer')!;
    const targets = [136, 226, 328, 418];
    const clones: HTMLElement[] = [];
    const cards = [sides[0].front, sides[0].back, sides[1].front, sides[1].back];
    const flights: Promise<void>[] = [];
    cards.forEach((d, i) => {
      const c = html(`<div class="fly-card show">${pcardHtml(withStars({ uid: 0, card: d.card, stars: d.stars }), { team: i < 2 ? 0 : 1, rolled: d.count })}</div>`);
      layer.appendChild(c);
      clones.push(c);
      flights.push(flyArc(tl, c, { ...smallAt(i), s: 1 }, { x: targets[i]!, y: 58, s: 1 }, 560 + i * 60, 50, i < 2 ? 10 : -10));
    });
    slotEls.forEach((s) => s.classList.add('away'));
    audio.play('card_whoosh', { pan: -0.4 });
    audio.play('card_whoosh', { pan: 0.4, delay: 0.08 });
    await Promise.all(flights);
    const vs = html(`<div class="vs">VS</div>`);
    audio.play('vs', { jitter: 0 });
    layer.appendChild(vs);
    // Boni unter den Karten
    const bonusBox = (side: 0 | 1) => {
      const f = sides[side].front.card;
      const b = sides[side].back.card;
      const lines: string[] = [];
      if (f.race === b.race) lines.push(`<span class="bn race" style="--rc:${RACES[f.race].art[3]}">${icon('star')}<b>${RACE_BONUS[f.race].name}</b><em>${RACE_BONUS[f.race].text}</em></span>`);
      if (f.cls === b.cls) lines.push(`<span class="bn cls">${icon('star')}<b>${CLASS_BONUS[f.cls].name}</b><em>${CLASS_BONUS[f.cls].text}</em></span>`);
      if (!lines.length) lines.push(`<span class="bn none">No bonus</span>`);
      return html(`<div class="bonus-box ${side === 0 ? 'you' : 'foe'}" style="left:${side === 0 ? 136 : 328}px">${lines.join('')}</div>`);
    };
    const bb = [bonusBox(0), bonusBox(1)];
    bb.forEach((b, i) => {
      layer.appendChild(b);
      b.querySelectorAll<HTMLElement>('.bn').forEach((n, k) => {
        if (!n.classList.contains('none')) audio.play('chime', { pan: i === 0 ? -0.5 : 0.5, delay: (120 + i * 140 + k * 160) / 1000, rate: semiRate(i * 2 + k * 4), vol: 0.6 });
        void tl.play(n, [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1.15)', offset: 0.6 }, { opacity: 1, transform: 'scale(1)' }], { duration: 380, delay: 120 + i * 140 + k * 160 });
      });
    });
    void tl.play(vs, [{ opacity: 0, transform: 'scale(3)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 300 });
    await tl.wait(2000);
    audio.play('card_whoosh', { rate: 0.9 });
    const back = clones.map((c, i) => flyArc(tl, c, { x: targets[i]!, y: 58, s: 1 }, { ...smallAt(i), s: 1 }, 460, 40, i < 2 ? -8 : 8));
    [...bb, vs].forEach((x) => void tl.play(x, [{ opacity: 1 }, { opacity: 0 }], { duration: 250 }));
    await Promise.all(back);
    slotEls.forEach((s) => s.classList.remove('away'));
    layer.innerHTML = '';
  };

  const banner = async (text: string, sub = ''): Promise<void> => {
    const layer = el.querySelector<HTMLElement>('.banner-layer')!;
    audio.play('round', { jitter: 0 });
    const b = html(`<div class="round-banner"><b>${text}</b>${sub ? `<span>${sub}</span>` : ''}</div>`);
    layer.appendChild(b);
    await b.animate([{ opacity: 0, transform: 'scaleY(0)' }, { opacity: 1, transform: 'scaleY(1)', offset: 0.2 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: 1400 }).finished;
    b.remove();
  };

  // --- Ende des Kampfes ------------------------------------------------------------------------
  const finish = async (won: boolean) => {
    phase = 'end';
    pauseBtn.disabled = true;
    sound.hush();
    viewA.crumbleCastle(won ? 1 : 0);
    audio.play('crumble', { pan: won ? 0.7 : -0.7, jitter: 0 });
    while (!viewA.crumbleDone) await sleep(100);
    await sleep(300);
    if (tutorial) localStorage.setItem('c2-tutorial', '1');
    audio.play(won ? 'victory' : 'defeat', { jitter: 0 });
    if (won) showRewards();
    else showDefeat();
  };

  const showDefeat = () => {
    run.lives = Math.max(0, run.lives - 1);
    const over = !!boss || run.lives <= 0;
    const p = html(`
      <div class="gpanel reward-panel lose">
        <div class="gpanel-title">Your castle has fallen</div>
        <div class="rw-list"></div>
        <button class="gbtn primary rw-go" style="visibility:hidden">${over ? 'End Run' : 'Continue'}</button>
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
      audio.play(l.includes('gold') ? 'coins' : l.includes('upgraded') ? 'upgrade' : 'card_place', { vol: 0.8 });
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
      <div class="gpanel reward-panel">
        <div class="gpanel-title">${boss ? `${boss.name} is defeated!` : 'Victory!'}</div>
        <div class="rw-list"></div>
        <div class="rw-pick"></div>
        <button class="gbtn primary rw-go" style="visibility:hidden">Continue</button>
      </div>`);
    el.appendChild(p);
    const go = p.querySelector<HTMLElement>('.rw-go')!;
    void listLines(p.querySelector<HTMLElement>('.rw-list')!, lines).then(() => {
      if (boss && !arena.bossFled) {
        // 1 Karte aus dem Boss-Deck wählen
        const pick = p.querySelector<HTMLElement>('.rw-pick')!;
        const names = [...new Set(boss.deck)];
        const opts: Card2[] = [];
        while (opts.length < 3 && names.length) opts.push(cardByName(names.splice(Math.floor(run.rnd() * names.length), 1)[0]!));
        pick.innerHTML = `<div class="rw-pick-title">Choose a card from ${boss.name}'s army</div><div class="rw-pick-row">${opts.map((c, i) => `<button class="rw-card" data-i="${i}">${pcardHtml({ ...c, stars: 1 })}</button>`).join('')}</div>`;
        pick.querySelectorAll<HTMLElement>('.rw-card').forEach((b) =>
          b.addEventListener('click', () => {
            run.addCard(opts[Number(b.dataset.i)]!);
            audio.play('upgrade');
            pick.querySelectorAll('.rw-card').forEach((x) => x.classList.toggle('gone', x !== b));
            b.classList.add('taken');
            go.style.visibility = 'visible';
          }),
        );
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
      const next = arena.round + 1;
      await banner(`Round ${next}`, next >= 4 ? `Siege! Castle damage ×${(1 + (next - 3) * 0.5).toFixed(1)}` : `${arena.survivorsAtBase[0]} of yours reached the castle`);
    }
  };
  void loop();
  updateHud();
}

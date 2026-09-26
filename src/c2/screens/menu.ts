// Hauptmenü im Röhrenmonitor-Stil: Titel und Knöpfe links, in der Mitte die
// Chromatic-Kerze, deren Flamme nach jedem Flackern die Farbe wechselt –
// Rahmen, Knöpfe und Lichtschein wechseln mit.

import { audio } from '../audio/audio';
import { mix } from '../../art/pixel';
import { pcardHtml } from '../../lab/pcard';
import { icon } from '../../lab/pixels';
import { CX, FLAME, FLAME_ORDER, HALO, WAX_TOP, candleBack, candleBody, flameSheet, haloSheet, sparkleSheet } from '../art/candle';
import { CARDS2, RACES } from '../data';
import type { Game } from '../game';

const TITLE_COLORS = FLAME_ORDER.map((r) => RACES[r].art[3]);

/** Setzt die Oberflächenfarben (--c1…--c4) auf eine Rassenfarbe. */
export function paintUi(root: HTMLElement, race: (typeof FLAME_ORDER)[number]): void {
  const a = RACES[race].art;
  root.style.setProperty('--c0', '#05040a');
  root.style.setProperty('--c1', a[0]);
  root.style.setProperty('--c2', a[1]);
  root.style.setProperty('--c3', a[3]);
  root.style.setProperty('--c4', mix(a[3], '#ffffff', 0.62));
}

export function menuScreen(g: Game): void {
  const letters = [...'CHROMATIC'].map((ch, i) => `<span style="--lc:${TITLE_COLORS[i % 7]};--d:${i * 0.1}s">${ch}</span>`).join('');
  const hasSave = !!localStorage.getItem('c2-save');
  const el = document.createElement('section');
  el.className = 'scr menu-scr';
  el.style.backgroundImage = `url(${candleBack()})`;
  el.innerHTML = `
    <div class="c-halo" style="left:${CX - HALO.w / 2}px;top:${WAX_TOP - 156}px;background-image:url(${haloSheet()})"></div>
    <div class="c-halo" style="left:${CX - HALO.w / 2}px;top:${WAX_TOP - 156}px;background-image:url(${haloSheet()});opacity:0"></div>
    <div class="c-sparkle" style="background-image:url(${sparkleSheet()})"></div>
    <div class="c-body" style="background-image:url(${candleBody()})"></div>
    <div class="c-flame" style="left:${CX - FLAME.w / 2}px;top:${WAX_TOP - 15 - (FLAME.h - 18)}px;background-image:url(${flameSheet()})"></div>
    <div class="c-flame" style="left:${CX - FLAME.w / 2}px;top:${WAX_TOP - 15 - (FLAME.h - 18)}px;background-image:url(${flameSheet()});opacity:0"></div>

    <div class="m-title">
      <div class="m-logo">${letters}<b class="m-two">2</b></div>
      <div class="m-sub">Roguelite Mass Battles</div>
    </div>

    <nav class="m-nav">
      <button class="gbtn primary" data-a="enter" data-sfx="confirm">${icon('play')}<span>Enter World</span></button>
      <button class="gbtn" data-a="continue" ${hasSave ? '' : 'disabled'}>${icon('refresh')}<span>Continue</span></button>
      <button class="gbtn" data-a="cards">${icon('cards')}<span>Cards</span></button>
      <button class="gbtn" data-a="settings">${icon('gear')}<span>Settings</span></button>
      <button class="gbtn danger" data-a="quit">${icon('door')}<span>Quit</span></button>
    </nav>

    <footer class="m-foot"><span class="m-flame-name"></span><span>v0.1</span></footer>`;
  g.ui.appendChild(el);

  // Flackern: die Flamme flackert laufend. Alle FADE_EVERY Frames blendet sie
  // weich in die nächste Farbe über: zwei Ebenen (alt/neu) wechseln die
  // Deckkraft, Lichtschein und Oberflächenfarben laufen im selben Tempo mit.
  const FRAME_MS = 190;
  const FADE_EVERY = 8; // Frames pro Farbe
  const FADE_MS = 1100;
  const flames = [...el.querySelectorAll<HTMLElement>('.c-flame')];
  const halos = [...el.querySelectorAll<HTMLElement>('.c-halo')];
  const name = el.querySelector<HTMLElement>('.m-flame-name')!;
  let frame = 0;
  let tick = 0;
  let color = 0;
  let front = 0; // welche Ebene gerade die aktuelle Farbe zeigt
  const rowOf = [0, 0]; // Farbe je Ebene
  g.root.style.setProperty('--fade', `${FADE_MS}ms`);
  const paint = () => {
    for (let k = 0; k < 2; k++) {
      flames[k]!.style.backgroundPosition = `${-frame * FLAME.w}px ${-rowOf[k]! * FLAME.h}px`;
      halos[k]!.style.backgroundPosition = `0 ${-rowOf[k]! * HALO.h}px`;
    }
  };
  const setColor = () => {
    const race = FLAME_ORDER[color]!;
    paintUi(g.root, race);
    name.textContent = `${RACES[race].name} flame`;
    name.style.color = RACES[race].art[3];
  };
  const fadeTo = (next: number) => {
    const back = 1 - front;
    rowOf[back] = next;
    paint();
    const ease = 'ease-in-out';
    for (const layer of [flames, halos]) {
      layer[back]!.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, easing: ease, fill: 'forwards' });
      layer[front]!.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, easing: ease, fill: 'forwards' });
    }
    front = back;
    color = next;
    setColor();
  };
  setColor();
  paint();
  const timer = window.setInterval(() => {
    if (!el.isConnected) {
      clearInterval(timer);
      return;
    }
    frame = (frame + 1) % FLAME.frames;
    tick++;
    if (tick % FADE_EVERY === 0) fadeTo((color + 1) % FLAME_ORDER.length);
    paint();
  }, FRAME_MS);

  let leaving = false; // Doppelklick auf „Enter World“/„Continue“ nur einmal ausführen
  el.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-a]');
    if (!b || b.disabled) return;
    switch (b.dataset.a) {
      case 'enter':
        if (leaving) return;
        leaving = true;
        g.chooseColors();
        break;
      case 'continue':
        if (leaving) return;
        leaving = true;
        g.continueRun();
        break;
      case 'cards':
        overlay(g, 'All Cards', `<div class="deck-scroll wide">${CARDS2.map((c) => pcardHtml(c)).join('')}</div>`);
        break;
      case 'settings':
        overlay(
          g,
          'Settings',
          `<div class="settings">
            <label><span>Fullscreen</span><button class="gbtn" data-fs>${document.fullscreenElement ? 'On' : 'Off'}</button></label>
            ${VOLUMES.map(([k, name]) => `<label><span>${name}</span><span class="vol" data-vol="${k}"><button class="gbtn small" data-d="-1">−</button><b></b><button class="gbtn small" data-d="1">+</button></span></label>`).join('')}
            <label><span>Sound</span><button class="gbtn" data-mute></button></label>
            <label><span>Tutorial hints</span><button class="gbtn" data-tut>Reset</button></label>
          </div>`,
          (o) => {
            const fs = o.querySelector<HTMLElement>('[data-fs]')!;
            fs.addEventListener('click', async () => {
              if (document.fullscreenElement) {
                localStorage.setItem('c2-windowed', '1');
                await document.exitFullscreen();
              } else {
                localStorage.removeItem('c2-windowed');
                await document.documentElement.requestFullscreen();
              }
              fs.textContent = document.fullscreenElement ? 'On' : 'Off';
            });
            bindVolumes(o);
            o.querySelector('[data-tut]')!.addEventListener('click', (ev) => {
              localStorage.removeItem('c2-tutorial');
              (ev.currentTarget as HTMLElement).textContent = 'Done';
            });
          },
        );
        break;
      case 'quit':
        overlay(g, 'Quit', `<p class="center">Close the browser tab to quit.<br>Thanks for playing!</p>`);
        break;
    }
  });
}

const VOLUMES: [VolumeKey, string][] = [
  ['master', 'Volume'],
  ['sfx', 'Battle'],
  ['ui', 'Interface'],
  ['amb', 'Ambience'],
];
type VolumeKey = 'master' | 'sfx' | 'ui' | 'amb';

/** Lautstärke in 10-%-Schritten, Ton an/aus (auch mit Taste M). */
function bindVolumes(o: HTMLElement): void {
  const show = () => {
    o.querySelectorAll<HTMLElement>('[data-vol]').forEach((v) => {
      v.querySelector('b')!.textContent = `${Math.round(audio.settings[v.dataset.vol as VolumeKey] * 100)}%`;
    });
    o.querySelector('[data-mute]')!.textContent = audio.settings.muted ? 'Off' : 'On';
  };
  o.querySelectorAll<HTMLElement>('[data-vol]').forEach((v) =>
    v.querySelectorAll<HTMLElement>('[data-d]').forEach((b) =>
      b.addEventListener('click', () => {
        const k = v.dataset.vol as VolumeKey;
        const next = Math.round(Math.max(0, Math.min(1, audio.settings[k] + Number(b.dataset.d) * 0.1)) * 10) / 10;
        audio.set({ [k]: next });
        show();
      }),
    ),
  );
  o.querySelector('[data-mute]')!.addEventListener('click', () => {
    audio.set({ muted: !audio.settings.muted });
    show();
  });
  show();
}

export function overlay(g: Game, title: string, body: string, bind?: (el: HTMLElement) => void): HTMLElement {
  const el = document.createElement('div');
  el.className = 'overlay';
  el.innerHTML = `<div class="gpanel ov-box"><div class="gpanel-title">${title}</div>${body}<button class="gbtn close">Close</button></div>`;
  const close = () => {
    el.remove();
    window.removeEventListener('keydown', esc);
  };
  const esc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  el.querySelector('.close')!.addEventListener('click', close);
  el.addEventListener('click', (e) => e.target === el && close());
  window.addEventListener('keydown', esc);
  g.ui.appendChild(el);
  bind?.(el);
  return el;
}

// =====================================================================
// Spielgerüst: 640×360-Bühne (ganzzahlig skaliert), Pixi für die Arena,
// DOM für die Oberfläche, Kreis-Übergänge und der Ablauf eines Runs.
// =====================================================================

import { Application, TextureSource } from 'pixi.js';
import { waitForRoomArtwork } from './art/roomArtwork';
import { audio } from './audio/audio';
import { WORLD_THEMES } from '../lab/palettes-crt';
import { uiRamp, type PaletteTheme } from '../lab/palettes';
import { pcardHtml } from '../lab/pcard';
import { icon } from '../lab/pixels';
import { RACES, type Card2, type RaceId } from './data';
import { buildGameAtlas, type GameAtlas } from './render/atlas';
import { Run, clearSave, loadRun, saveRun, type DeckCard, type Room } from './run';
import { battleScreen } from './screens/battle';
import { colorScreen } from './screens/colors';
import { deckRevealScreen } from './screens/deckReveal';
import { endScreen } from './screens/end';
import { forkScreen } from './screens/fork';
import { introScreen } from './screens/intro';
import { menuScreen } from './screens/menu';
import { enchantScreen, pyreScreen, shopScreen, treasureScreen } from './screens/rooms';
import { worldPickScreen } from './screens/worldpick';
import { iris, view } from './ui/anim';

export const W = 640;
export const H = 360;

TextureSource.defaultOptions.scaleMode = 'nearest';

/**
 * Ruft `fn` nur beim ersten Mal auf. Schützt Weiterleitungen vor Doppelklicks
 * (sonst entstehen z. B. zwei Kampfbildschirme oder ein Raum wird übersprungen).
 */
export function once<A extends unknown[]>(fn: (...a: A) => void): (...a: A) => void {
  let used = false;
  return (...a: A) => {
    if (used) return;
    used = true;
    fn(...a);
  };
}

/** Karte mit Stern-Stufe aus dem Deck als Card2 für die Kartenanzeige. */
export const withStars = (d: DeckCard): Card2 => ({ ...d.card, stars: d.stars });

export class Game {
  readonly app = new Application();
  atlas!: GameAtlas;
  readonly root: HTMLElement;
  readonly ui: HTMLElement;
  readonly fx: HTMLElement;
  private readonly irisLayer: HTMLElement;
  run: Run | null = null;
  theme: PaletteTheme = WORLD_THEMES.find((t) => t.id === 'w-drifters')!;
  /** Bildschirm-Wechsel laufen nacheinander (Warteschlange) */
  private queue: Promise<void> = Promise.resolve();

  constructor(host: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'game';
    host.appendChild(this.root);
    this.ui = document.createElement('div');
    this.ui.id = 'ui';
    this.fx = document.createElement('div');
    this.fx.id = 'fxl';
    this.irisLayer = document.createElement('div');
    this.irisLayer.id = 'irisl';
    view.root = this.root;
  }

  async init(): Promise<void> {
    await this.app.init({ width: W, height: H, background: '#000000', antialias: false, resolution: 1, roundPixels: true, preference: 'webgl' });
    this.app.canvas.id = 'arena';
    const frame = document.createElement('div');
    frame.className = 'crt-frame';
    this.root.append(this.app.canvas, this.ui, this.fx, frame, this.irisLayer);
    this.app.canvas.style.display = 'none';
    this.atlas = buildGameAtlas();
    window.addEventListener('resize', () => this.fit());
    document.addEventListener('fullscreenchange', () => this.fit());
    this.fit();
    // Vollbild als Standard: beim ersten Klick (Browser erlauben es nur nach einer Eingabe)
    const goFull = () => {
      if (localStorage.getItem('c2-windowed') !== '1' && !document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(() => undefined);
    };
    window.addEventListener('pointerdown', goFull, { once: true });
    this.bindSound();
  }

  /**
   * Ton: der Browser erlaubt ihn erst nach der ersten Eingabe. Alle Knöpfe
   * klingen beim Überfahren und Klicken; ein eigener Klang kommt über
   * data-sfx="…" (oder "none" für keinen).
   */
  private bindSound(): void {
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    const HOT = 'button, .hand-card, [data-sfx]';
    let hovered: Element | null = null;
    this.root.addEventListener('pointerover', (e) => {
      const el = (e.target as HTMLElement).closest(HOT);
      if (el === hovered) return;
      hovered = el;
      if (el && !(el as HTMLButtonElement).disabled && (el as HTMLElement).dataset.sfx !== 'none') audio.play('hover');
    });
    this.root.addEventListener(
      'click',
      (e) => {
        const el = (e.target as HTMLElement).closest<HTMLElement>(HOT);
        if (!el || (el as HTMLButtonElement).disabled) return;
        const id = el.dataset.sfx ?? 'click';
        if (id !== 'none') audio.play(id);
      },
      true,
    );
    window.addEventListener('keydown', (e) => {
      if (e.key === 'm' || e.key === 'M') audio.set({ muted: !audio.settings.muted });
    });
  }

  /**
   * 16:9 füllt den ganzen Bildschirm: stufenlose Skalierung statt nur ganzer
   * Faktoren (sonst bleibt ein dicker Rand). Pixel bleiben durch
   * image-rendering: pixelated scharf.
   */
  private fit(): void {
    const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
    view.scale = scale;
    this.root.style.transform = `scale(${scale})`;
    this.root.style.left = `${Math.round((window.innerWidth - W * scale) / 2)}px`;
    this.root.style.top = `${Math.round((window.innerHeight - H * scale) / 2)}px`;
  }

  /** Oberfläche in den Farben einer Welt. */
  setWorld(race: RaceId): void {
    this.theme = WORLD_THEMES.find((t) => t.race === race)!;
    const ramp = uiRamp(this.theme);
    ramp.forEach((c, i) => this.root.style.setProperty(`--c${i}`, c));
    for (const [k, c] of Object.entries(this.theme.accents ?? {})) this.root.style.setProperty(`--a-${k}`, c);
    this.root.dataset.world = race;
    audio.ambience(race);
  }

  /** Bildschirm wechseln, optional mit Kreis-Übergang. */
  go(build: () => void | Promise<void>, transition = true): Promise<void> {
    this.queue = this.queue.then(() => this.swap(build, transition));
    return this.queue;
  }

  private async swap(build: () => void | Promise<void>, transition: boolean): Promise<void> {
    if (transition) {
      audio.play('iris');
      await iris(this.irisLayer, 'close', 520);
    }
    this.ui.innerHTML = '';
    this.fx.innerHTML = '';
    this.app.canvas.style.display = 'none';
    this.app.stage.removeChildren();
    await build();
    await waitForRoomArtwork(this.ui);
    if (transition) {
      const old = [...this.irisLayer.children];
      const opening = iris(this.irisLayer, 'open', 520);
      old.forEach((e) => e.remove());
      await opening;
    }
  }

  // --- Obere Leiste außerhalb des Kampfes -------------------------------------------------

  hudHtml(): string {
    const r = this.run!;
    let lives = '';
    for (let i = 0; i < 3; i++) lives += icon('heart', i < r.lives ? '' : 'empty');
    let dots = '';
    for (let i = 0; i <= r.rooms; i++) dots += `<i class="${i < r.roomNo ? 'done' : i === r.roomNo ? 'now' : ''}${i === r.rooms ? ' boss' : ''}"></i>`;
    return `
      <header class="tophud">
        <div class="chip lives">${lives}</div>
        <div class="chip gold">${icon('coin')}<b>${r.gold}</b></div>
        <div class="chip world"><span>World ${r.worldNo} · ${RACES[r.world].name}</span><span class="dots">${dots}</span></div>
        <div class="spacer"></div>
        <div class="chip ench">${icon('star')}<b>${r.enchants.length}</b></div>
        <button class="gbtn small deck-btn">${icon('cards')}<span>Deck ${r.deck.length}</span></button>
      </header>`;
  }

  bindHud(scope: HTMLElement = this.ui): void {
    scope.querySelector('.deck-btn')?.addEventListener('click', () => this.showDeck());
  }

  refreshHud(): void {
    const old = this.ui.querySelector('.tophud');
    if (!old) return;
    const t = document.createElement('template');
    t.innerHTML = this.hudHtml().trim();
    old.replaceWith(t.content.firstElementChild!);
    this.bindHud();
  }

  /** Deck-Übersicht als Overlay. */
  showDeck(): void {
    const r = this.run!;
    const el = document.createElement('div');
    el.className = 'overlay deck-overlay';
    el.innerHTML = `
      <div class="gpanel deck-view">
        <div class="gpanel-title">Your Deck · ${r.deck.length} cards${r.enchants.length ? ` · ${r.enchants.length} enchantments` : ''}</div>
        <div class="deck-scroll">${r.deck.map((d) => pcardHtml(withStars(d))).join('')}</div>
        ${r.enchants.length ? `<div class="ench-list">${r.enchants.map((e) => `<span class="ench-chip r-${e.rarity}">${e.name}</span>`).join('')}</div>` : ''}
        <button class="gbtn close">Close</button>
      </div>`;
    el.querySelector('.close')!.addEventListener('click', () => el.remove());
    el.addEventListener('click', (e) => e.target === el && el.remove());
    this.ui.appendChild(el);
  }

  // --- Ablauf -------------------------------------------------------------------------------

  mainMenu(): void {
    this.setWorld('drifters');
    audio.ambience('menu');
    void this.go(() => menuScreen(this), this.ui.childElementCount > 0);
  }

  chooseColors(): void {
    void this.go(() => colorScreen(this, once((colors) => this.startRun(colors))));
  }

  startRun(colors: RaceId[]): void {
    this.run = new Run(colors);
    // Erst die gezogenen Startkarten zeigen, dann weiter in die erste Welt
    deckRevealScreen(
      this,
      once(() => {
        this.setWorld(this.run!.world);
        void this.go(() => introScreen(this, once(() => this.enterRoom({ kind: 'battle', stars: 1 }))));
      }),
    );
  }

  /** Gespeicherten Run fortsetzen (an der letzten Weggabelung). */
  continueRun(): void {
    const r = loadRun();
    if (!r) return;
    this.run = r;
    this.setWorld(r.world);
    this.toFork();
  }

  toFork(): void {
    const r = this.run!;
    if (r.lives <= 0) return this.gameOver();
    saveRun(r);
    void this.go(() => forkScreen(this, r.fork(), once((room) => this.enterRoom(room))));
  }

  enterRoom(room: Room): void {
    this.run!.lastRoom = room.kind;
    const done = once(() => {
      this.run!.completeRoom();
      this.toFork();
    });
    switch (room.kind) {
      case 'battle':
        void this.go(() => battleScreen(this, room, once((res) => (res === 'lose' && this.run!.lives <= 0 ? this.gameOver() : done()))));
        break;
      case 'boss':
        void this.go(() => battleScreen(this, room, once((res) => (res === 'lose' ? this.gameOver() : this.afterBoss()))));
        break;
      case 'treasure':
        void this.go(() => treasureScreen(this, room, done));
        break;
      case 'shop':
        void this.go(() => shopScreen(this, done));
        break;
      case 'enchant':
        void this.go(() => enchantScreen(this, done));
        break;
      case 'pyre':
        void this.go(() => pyreScreen(this, done));
        break;
    }
  }

  afterBoss(): void {
    const r = this.run!;
    r.defeated.push(r.world);
    if (r.worldNo >= 4) return this.victory();
    void this.go(() =>
      worldPickScreen(
        this,
        r.worldChoices(),
        once((race) => {
          r.defeated.pop();
          r.enterWorld(race);
          this.setWorld(race);
          void this.go(() => introScreen(this, once(() => this.toFork())));
        }),
      ),
    );
  }

  gameOver(): void {
    clearSave();
    audio.ambience('menu');
    void this.go(() => endScreen(this, false));
  }

  victory(): void {
    clearSave();
    audio.ambience('menu');
    void this.go(() => endScreen(this, true));
  }
}

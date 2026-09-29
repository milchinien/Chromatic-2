// Spielgerüst der Handy-Version: gleiche Abläufe wie Game (PC), aber Bühne im
// Hochformat, Touch-Bedienung und Hochformat-Bildschirme für Kampf und Räume.

import { icon } from '../../lab/pixels';
import { cardByName } from '../data';
import { Game } from '../game';
import { buildGameAtlas } from '../render/atlas';
import type { Room } from '../run';
import { view } from '../ui/anim';
import { mobileBattleScreen } from './screens/battle';
import { mEnchantScreen, mPyreScreen, mShopScreen, mTreasureScreen } from './screens/rooms';
import { MH, MW } from './stage';
import { zoomCard } from './zoom';

export class MobileGame extends Game {
  constructor(host: HTMLElement) {
    super(host);
    this.root.classList.add('m');
    this.root.style.setProperty('--W', `${MW}px`);
    this.root.style.setProperty('--H', `${MH}px`);
    view.irisR = Math.ceil(Math.hypot(MW / 2, MH / 2)) + 8;
  }

  override async init(): Promise<void> {
    await this.app.init({ width: MW, height: MH, background: '#000000', antialias: false, resolution: 1, roundPixels: true, preference: 'webgl' });
    this.app.canvas.id = 'arena';
    const frame = document.createElement('div');
    frame.className = 'crt-frame';
    this.root.append(this.app.canvas, this.ui, this.fx, frame, this.irisLayer);
    this.app.canvas.style.display = 'none';
    this.atlas = buildGameAtlas();

    const rotate = document.createElement('div');
    rotate.className = 'm-rotate';
    rotate.innerHTML = `<div class="m-rotate-box">${icon('refresh')}<b>Please rotate your device</b><span>Chromatic 2 is played upright.</span></div>`;
    document.body.appendChild(rotate);

    const refit = () => requestAnimationFrame(() => this.fit());
    window.addEventListener('resize', refit);
    window.addEventListener('orientationchange', refit);
    window.visualViewport?.addEventListener('resize', refit);
    document.addEventListener('fullscreenchange', refit);
    this.fit();

    // Vollbild + Hochformat beim ersten Antippen (nur wo der Browser es erlaubt)
    const goFull = () => {
      if (localStorage.getItem('c2-windowed') === '1' || document.fullscreenElement) return;
      const req = document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
      void req
        ?.then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('portrait'))
        .catch(() => undefined);
    };
    window.addEventListener('pointerup', goFull, { once: true });

    // Karten in Deck-Ansichten antippen → groß
    this.ui.addEventListener('click', (e) => {
      const card = (e.target as HTMLElement).closest<HTMLElement>('.deck-scroll .pc');
      if (!card) return;
      const name = card.querySelector('.pc-name')?.textContent;
      const found = name ? this.run?.deck.find((d) => d.card.name === name) : undefined;
      const stars = card.querySelectorAll('.pc-stars .ico:not(.empty)').length || 1;
      if (name) zoomCard(this.ui, { ...(found?.card ?? cardByName(name)), stars });
    });
  }

  /** Stufenlos einpassen, mittig; die Bühne ist immer hochkant. */
  protected override fit(): void {
    const vw = window.visualViewport?.width ?? window.innerWidth;
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const scale = Math.min(vw / MW, vh / MH);
    view.scale = scale;
    this.root.style.transform = `scale(${scale})`;
    this.root.style.left = `${Math.round((vw - MW * scale) / 2)}px`;
    this.root.style.top = `${Math.round((vh - MH * scale) / 2)}px`;
  }

  /** Kompakte obere Leiste: Leben, Gold, Weltfortschritt, Enchantments, Deck. */
  override hudHtml(): string {
    const r = this.run!;
    let lives = '';
    for (let i = 0; i < 3; i++) lives += icon('heart', i < r.lives ? '' : 'empty');
    let dots = '';
    for (let i = 0; i <= r.rooms; i++) dots += `<i class="${i < r.roomNo ? 'done' : i === r.roomNo ? 'now' : ''}${i === r.rooms ? ' boss' : ''}"></i>`;
    return `
      <header class="tophud">
        <div class="chip lives">${lives}</div>
        <div class="chip gold">${icon('coin')}<b>${r.gold}</b></div>
        <div class="chip world"><span>W${r.worldNo}</span><span class="dots">${dots}</span></div>
        <div class="spacer"></div>
        <div class="chip ench">${icon('star')}<b>${r.enchants.length}</b></div>
        <button class="gbtn small deck-btn">${icon('cards')}<span>${r.deck.length}</span></button>
      </header>`;
  }

  override enterRoom(room: Room): void {
    this.run!.lastRoom = room.kind;
    const done = () => {
      this.run!.completeRoom();
      this.toFork();
    };
    switch (room.kind) {
      case 'battle':
        void this.go(() => mobileBattleScreen(this, room, (res) => (res === 'lose' && this.run!.lives <= 0 ? this.gameOver() : done())));
        break;
      case 'boss':
        void this.go(() => mobileBattleScreen(this, room, (res) => (res === 'lose' ? this.gameOver() : this.afterBoss())));
        break;
      case 'treasure':
        void this.go(() => mTreasureScreen(this, room, done));
        break;
      case 'shop':
        void this.go(() => mShopScreen(this, done));
        break;
      case 'enchant':
        void this.go(() => mEnchantScreen(this, done));
        break;
      case 'pyre':
        void this.go(() => mPyreScreen(this, done));
        break;
    }
  }
}

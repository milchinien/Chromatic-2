// Start der Handy-Version (wird von ../main.ts nur auf Handys nachgeladen).

import './mobile.css';

import { frameUrl } from '../../lab/pcard';
import { setArenaField } from '../sim/arena';
import { MobileGame } from './game';
import { battleLayout, initStage } from './stage';

export async function bootMobile(): Promise<void> {
  initStage();
  const L = battleLayout();
  setArenaField({ fx0: L.fx0, fx1: L.fx1, fy0: L.fy0, fy1: L.fy1 });

  // Kein Zoomen per Doppeltippen/Kneifen, Browser-Gesten aus
  let meta = document.querySelector<HTMLMetaElement>('meta[name=viewport]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'viewport';
    document.head.appendChild(meta);
  }
  meta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
  document.documentElement.classList.add('c2-mobile');
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  // iOS: Kneif-Zoom trotz user-scalable=no verhindern
  document.addEventListener('gesturestart', (e) => e.preventDefault());

  await document.fonts.load('8px Silkscreen');
  await document.fonts.load('8px Tiny5');
  const game = new MobileGame(document.getElementById('app')!);
  await game.init();
  game.root.style.setProperty('--frame-url', `url(${frameUrl()})`);
  game.root.style.setProperty('--frame', `url(${frameUrl()})`);
  if (import.meta.env.DEV) Object.assign(window, { __game: game });
  game.mainMenu();
}

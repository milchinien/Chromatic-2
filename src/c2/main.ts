import '@fontsource/silkscreen/400.css';
import '@fontsource/silkscreen/700.css';
import '@fontsource/tiny5/400.css';
import '../lab/world.css';
import './c2.css';

import { frameUrl } from '../lab/pcard';
import { Game } from './game';

async function boot(): Promise<void> {
  await document.fonts.load('8px Silkscreen');
  await document.fonts.load('8px Tiny5');
  const game = new Game(document.getElementById('app')!);
  await game.init();
  game.root.style.setProperty('--frame-url', `url(${frameUrl()})`);
  game.root.style.setProperty('--frame', `url(${frameUrl()})`);
  if (import.meta.env.DEV) Object.assign(window, { __game: game });
  game.mainMenu();
}

void boot();

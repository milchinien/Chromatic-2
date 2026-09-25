// Ende eines Runs: Sieg nach der 4. Welt oder Niederlage.

import { icon } from '../../lab/pixels';
import { candleBack } from '../art/candle';
import { RACES } from '../data';
import type { Game } from '../game';

export function endScreen(g: Game, won: boolean): void {
  const r = g.run!;
  const el = document.createElement('section');
  el.className = `scr end-scr ${won ? 'won' : 'lost'}`;
  el.style.backgroundImage = `url(${candleBack()})`;
  el.innerHTML = `
    <div class="gpanel end-panel">
      <h1>${won ? 'Victory!' : 'Defeat'}</h1>
      <p>${won ? 'All four worlds bow to your banner.' : `Your campaign ends in ${RACES[r.world].name} lands.`}</p>
      <div class="end-stats">
        <span>World reached</span><b>${r.worldNo} / 4</b>
        <span>Battles won</span><b>${r.battlesWon}</b>
        <span>Bosses defeated</span><b>${r.defeated.length}</b>
        <span>Deck size</span><b>${r.deck.length}</b>
        <span>Enchantments</span><b>${r.enchants.length}</b>
        <span>Gold</span><b>${r.gold}</b>
      </div>
      <button class="gbtn primary big" data-menu>${icon('door')}<span>Main Menu</span></button>
    </div>`;
  g.ui.appendChild(el);
  el.querySelector('[data-menu]')!.addEventListener('click', () => g.mainMenu());
}

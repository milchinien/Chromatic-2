// Einführung in eine Welt: Weltkarte mit Route (Räume + Boss), Boss-Karte und
// ein kurzer Hinweis, was als Nächstes passiert. Führt in Welt 1 direkt zum
// ersten Kampf.

import { icon } from '../../lab/pixels';
import { mapBg } from '../art/scenes';
import { RACES } from '../data';
import type { Game } from '../game';
import { bossCardHtml } from './worldpick';

export function introScreen(g: Game, onGo: () => void): void {
  const r = g.run!;
  const first = r.worldNo === 1;
  const el = document.createElement('section');
  el.className = 'scr intro-scr';
  el.style.backgroundImage = `url(${mapBg()})`;
  let nodes = '';
  const n = r.rooms;
  for (let i = 0; i <= n; i++) {
    const boss = i === n;
    nodes += `<div class="route-node${boss ? ' boss' : ''}${i === 0 ? ' now' : ''}" style="--i:${i};--n:${n}">${boss ? icon('skull') : i === 0 ? icon('swords') : '?'}</div>`;
  }
  el.innerHTML = `
    ${g.hudHtml()}
    <div class="intro-head">
      <div class="intro-world">World ${r.worldNo} of 4</div>
      <h1 class="intro-name" style="--wc:${RACES[r.world].art[3]}">${worldName(r.world)}</h1>
    </div>
    <div class="route">${nodes}<div class="route-army">${icon('shield')}</div></div>
    <div class="intro-boss">${bossCardHtml(r.world)}</div>
    <div class="gpanel intro-hint">
      <div class="gpanel-title">${first ? 'Your campaign begins' : 'A new world'}</div>
      <p>${
        first
          ? `Your army of <b>${r.colors.map((c) => RACES[c].name).join(', ')}</b> marches into the Borderlands. Fight your way along the road – <b>${r.boss.name}</b> waits at the end.`
          : `Cross ${n} rooms of your choice, then face <b>${r.boss.name}</b>, ${r.boss.title}.`
      }</p>
      <p class="intro-small">${first ? 'Scouts report enemies right ahead. Prepare for battle!' : 'Choose your path wisely: every fork offers two rooms.'}</p>
      <button class="gbtn primary big" data-go data-sfx="confirm">${icon('swords')}<span>${first ? 'To Battle!' : 'March On'}</span></button>
    </div>`;
  g.ui.appendChild(el);
  g.bindHud();
  el.querySelector('[data-go]')!.addEventListener('click', onGo);
}

export function worldName(race: string): string {
  const names: Record<string, string> = {
    drifters: 'The Borderlands',
    ashclan: 'The Ashen Wastes',
    wildwood: 'The Wildwood',
    tidebound: 'The Drowned Coast',
    sunlegion: 'The Sun Empire',
    plague: 'The Plague Court',
    deepforge: 'The Deep Halls',
  };
  return names[race] ?? race;
}

// Nach dem Boss: Weltkarte mit zwei Wegen, am Ende je ein Boss auf einer
// Karte in seiner Farbe.

import { artBgUrl, frameUrl } from '../../lab/pcard';
import { icon } from '../../lab/pixels';
import { buildUnitFrames } from '../../art/sprites';
import { mapBg } from '../art/scenes';
import { BOSSES, RACE_BONUS, RACES, type RaceId } from '../data';
import type { Game } from '../game';
import { worldName } from './intro';

const bossSpriteCache = new Map<string, string>();

function bossSprite(race: RaceId): { url: string; w: number; h: number } {
  const b = BOSSES[race];
  const g = buildUnitFrames(b.kind, RACES[race].unit, 1).walk0;
  let url = bossSpriteCache.get(race);
  if (!url) {
    const c = document.createElement('canvas');
    c.width = g.w;
    c.height = g.h;
    g.draw(c.getContext('2d')!, 0, 0);
    url = c.toDataURL();
    bossSpriteCache.set(race, url);
  }
  return { url, w: g.w, h: g.h };
}

/** Boss als Karte in seiner Farbe. */
export function bossCardHtml(race: RaceId): string {
  const b = BOSSES[race];
  const sp = bossSprite(race);
  const s = sp.h > 20 ? 2 : 3;
  return `
    <article class="boss-card" style="--frame:url(${frameUrl()});--rc:${RACES[race].art[3]};--rd:${RACES[race].art[1]}">
      <header class="bc-top">${icon('skull')}<span>${b.name}</span></header>
      <div class="bc-art" style="background-image:url(${artBgUrl(race, 112, 70)})">
        <img src="${sp.url}" style="width:${sp.w * s}px;height:${sp.h * s}px" alt="">
      </div>
      <div class="bc-title">${b.title}</div>
      <div class="bc-race">${RACES[race].name} · ${RACES[race].color}</div>
      <p class="bc-passive"><b>${b.passive.name}:</b> ${b.passive.text}</p>
      <div class="bc-stats"><span class="crest-lite dmg">${b.dmg}</span><span class="crest-lite hp">${b.hp}</span></div>
    </article>`;
}

export function worldPickScreen(g: Game, choices: [RaceId, RaceId], onPick: (r: RaceId) => void): void {
  const el = document.createElement('section');
  el.className = 'scr worldpick-scr';
  el.style.backgroundImage = `url(${mapBg()})`;
  el.innerHTML = `
    ${g.hudHtml()}
    <div class="wp-title">Choose your next world</div>
    <svg class="wp-paths" viewBox="0 0 640 360" shape-rendering="crispEdges">
      <path d="M320 330 C 300 280, 200 270, 170 220" />
      <path d="M320 330 C 340 280, 440 270, 470 220" />
    </svg>
    <div class="wp-army">${icon('shield')}</div>
    ${choices
      .map(
        (r, i) => `
      <button class="wp-choice" data-r="${r}" style="left:${i === 0 ? 96 : 396}px">
        ${bossCardHtml(r)}
        <span class="wp-name" style="--rc:${RACES[r].art[3]}">${worldName(r)}</span>
        <span class="wp-bonus">${RACE_BONUS[r].name} world</span>
      </button>`,
      )
      .join('')}`;
  g.ui.appendChild(el);
  g.bindHud();
  el.querySelectorAll<HTMLButtonElement>('.wp-choice').forEach((b) => b.addEventListener('click', () => onPick(b.dataset.r as RaceId)));
}

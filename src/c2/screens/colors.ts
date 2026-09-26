// Farbwahl zu Beginn eines Runs: 3 von 7 Farben → Startdeck aus 10 Karten.

import { audio } from '../audio/audio';
import { artBgUrl } from '../../lab/pcard';
import { icon } from '../../lab/pixels';
import { candleBack } from '../art/candle';
import { CLASS_ICON } from '../../lab/races';
import { RACE_BONUS, RACE_ORDER, RACES, cardsOf, unitSprite, type RaceId } from '../data';
import { once, type Game } from '../game';

export function colorScreen(g: Game, onDone: (colors: RaceId[]) => void): void {
  const picked: RaceId[] = [];
  const el = document.createElement('section');
  el.className = 'scr colors-scr';
  el.style.backgroundImage = `url(${candleBack()})`;
  const tile = (r: RaceId) => {
    const units = cardsOf(r)
      .filter((c) => c.cls !== 'Siege' && c.cls !== 'Champion')
      .slice(0, 3)
      .map((c) => {
        const sp = unitSprite(c);
        return `<img src="${sp.url}" style="width:${sp.w}px;height:${sp.h}px" alt="">`;
      })
      .join('');
    return `
      <button class="race-tile" data-r="${r}" style="--rc:${RACES[r].art[3]};--rd:${RACES[r].art[1]}">
        <div class="race-art" style="background-image:url(${artBgUrl(r, 76, 40)})">${units}</div>
        <b>${RACES[r].name}</b>
        <span class="race-color">${RACES[r].color}</span>
        <ul class="race-cards">${cardsOf(r)
          .map((c) => `<li>${icon(CLASS_ICON[c.cls])}<span>${c.name}</span></li>`)
          .join('')}</ul>
        <span class="race-bonus">${RACE_BONUS[r].name}</span>
        <span class="race-bonus-text">${RACE_BONUS[r].text}</span>
        <i class="race-check">${icon('star')}</i>
      </button>`;
  };
  el.innerHTML = `
    <div class="gpanel colors-panel">
      <div class="gpanel-title">Choose 3 Colors</div>
      <p class="colors-hint">Your starting deck is built from 10 random cards of these colors.</p>
      <div class="race-grid">${RACE_ORDER.map(tile).join('')}</div>
      <div class="colors-foot">
        <span class="colors-count">0 / 3</span>
        <span class="colors-info">Pick two cards of the same color in battle to unlock its race bonus.</span>
        <button class="gbtn" data-back>Back</button>
        <button class="gbtn primary" data-go data-sfx="confirm" disabled>${icon('play')}<span>Begin</span></button>
      </div>
    </div>`;
  g.ui.appendChild(el);
  const count = el.querySelector('.colors-count')!;
  const go = el.querySelector<HTMLButtonElement>('[data-go]')!;
  const info = el.querySelector('.colors-info')!;
  el.querySelectorAll<HTMLButtonElement>('.race-tile').forEach((b) => {
    const r = b.dataset.r as RaceId;
    b.addEventListener('mouseenter', () => (info.textContent = `${RACES[r].name} · ${RACE_BONUS[r].name}: ${RACE_BONUS[r].text}`));
    b.addEventListener('click', () => {
      const i = picked.indexOf(r);
      if (i >= 0) {
        picked.splice(i, 1);
        audio.play('harp', { rate: 0.75, jitter: 0 });
      } else if (picked.length < 3) {
        picked.push(r);
        // aufsteigender Dreiklang: 1., 2., 3. Farbe
        audio.play('harp', { rate: [1, 1.26, 1.5][picked.length - 1], jitter: 0 });
      }
      el.querySelectorAll<HTMLElement>('.race-tile').forEach((t) => t.classList.toggle('on', picked.includes(t.dataset.r as RaceId)));
      count.textContent = `${picked.length} / 3`;
      go.disabled = picked.length !== 3;
    });
  });
  go.addEventListener('click', () => onDone([...picked]));
  el.querySelector('[data-back]')!.addEventListener('click', once(() => g.mainMenu()));
}

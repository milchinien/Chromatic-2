// Nach der Farbwahl: die 10 gezogenen Startkarten werden nacheinander
// aufgedeckt (nach Farbe sortiert). Erst ein Klick auf „Continue“ führt
// weiter in den Übergang zur ersten Welt. Linksklick überspringt die Animation.

import { audio } from '../audio/audio';
import { flipCardHtml, pcardHtml } from '../../lab/pcard';
import { icon } from '../../lab/pixels';
import { RACES } from '../data';
import { withStars, type Game } from '../game';
import { Timeline, burst, flip, html, localRect } from '../ui/anim';

export function deckRevealScreen(g: Game, onContinue: () => void): void {
  const run = g.run!;
  const order = run.colors;
  const deck = [...run.deck].sort((a, b) => order.indexOf(a.card.race) - order.indexOf(b.card.race) || a.card.cls.localeCompare(b.card.cls) || a.card.name.localeCompare(b.card.name));
  const counts = order.map((r) => `<span class="dr-count" style="--rc:${RACES[r].art[3]}">${RACES[r].name} <b>${deck.filter((d) => d.card.race === r).length}</b></span>`).join('');

  const el = html(`
    <div class="overlay deck-reveal">
      <div class="dr-title">Your starting deck</div>
      <div class="dr-grid">${deck.map((d) => `<div class="dr-card">${flipCardHtml(pcardHtml(withStars(d)))}</div>`).join('')}</div>
      <div class="dr-foot">
        <div class="dr-counts">${counts}</div>
        <button class="gbtn primary dr-go" data-sfx="confirm" style="visibility:hidden">${icon('play')}<span>Continue</span></button>
      </div>
    </div>`);
  g.ui.appendChild(el);

  const tl = new Timeline();
  const cards = [...el.querySelectorAll<HTMLElement>('.dr-card')];
  const go = el.querySelector<HTMLButtonElement>('.dr-go')!;
  // Linksklick irgendwo (außer auf „Continue“) zeigt sofort alles
  el.addEventListener('pointerdown', (e) => {
    if (e.button === 0 && !(e.target as HTMLElement).closest('.dr-go')) tl.skip();
  });

  void (async () => {
    await tl.play(el.querySelector('.dr-title')!, [{ opacity: 0, transform: 'translateY(-8px)' }, { opacity: 1, transform: 'none' }], { duration: 300 });
    for (let k = 0; k < cards.length; k++) {
      const c = cards[k]!;
      if (!tl.skipped) audio.play('card_draw', { pan: -0.6 + (k % 5) * 0.3 });
      await tl.play(c, [{ opacity: 0, transform: 'translateY(60px) scale(.6) rotate(-8deg)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,.8,.3,1)' });
      if (!tl.skipped) audio.play('card_flip', { pan: -0.6 + (k % 5) * 0.3 });
      void flip(tl, c, 300);
      if (!tl.skipped) {
        const r = localRect(c);
        burst(g.fx, r.x + r.w / 2, r.y + r.h / 2, ['#ffffff', '#fff4b0', RACES[deck[k]!.card.race].art[3]], 8, 40, 10);
      }
      await tl.wait(110);
    }
    await tl.wait(250);
    go.style.visibility = 'visible';
    void go.animate([{ opacity: 0, transform: 'scale(.8)' }, { opacity: 1, transform: 'none' }], { duration: 220 });
  })();

  go.addEventListener('click', () => {
    go.disabled = true;
    onContinue();
  });
}

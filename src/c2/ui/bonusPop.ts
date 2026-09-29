// Bonus-Details: ein Kasten, der über dem Auslöser nach oben aufklappt.
// Maus: beim Drüberfahren öffnen, beim Verlassen schließen. Touch: Antippen
// öffnet/schließt, Antippen woanders schließt.

import { bonusPopHtml, type BonusDetail } from '../bonusDetails';
import { html, localRect } from './anim';

export function closeBonusPop(scope: HTMLElement): void {
  scope.querySelectorAll('.bpop').forEach((e) => e.remove());
  scope.querySelectorAll('.bpop-open').forEach((e) => e.classList.remove('bpop-open'));
}

/** Öffnet die Details über `anchor` (`row` = nebeneinander, `col` = übereinander). */
export function openBonusPop(scope: HTMLElement, anchor: HTMLElement, items: BonusDetail[], dir: 'row' | 'col'): HTMLElement {
  closeBonusPop(scope);
  const pop = html(bonusPopHtml(items, dir));
  scope.appendChild(pop);
  const a = localRect(anchor);
  const s = localRect(scope);
  const w = pop.offsetWidth;
  const x = Math.max(4, Math.min(scope.offsetWidth - w - 4, a.x - s.x + a.w / 2 - w / 2));
  pop.style.left = `${Math.round(x)}px`;
  pop.style.bottom = `${Math.round(scope.offsetHeight - (a.y - s.y) + 3)}px`;
  anchor.classList.add('bpop-open');
  return pop;
}

export function bindBonusPop(trigger: HTMLElement, scope: HTMLElement, items: () => BonusDetail[], dir: 'row' | 'col'): void {
  const isOpen = () => trigger.classList.contains('bpop-open');
  let lastType = 'mouse';
  trigger.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'mouse') openBonusPop(scope, trigger, items(), dir);
  });
  trigger.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse' && isOpen()) closeBonusPop(scope);
  });
  trigger.addEventListener('pointerdown', (e) => (lastType = e.pointerType));
  trigger.addEventListener('click', () => {
    if (lastType === 'mouse') return;
    if (isOpen()) closeBonusPop(scope);
    else openBonusPop(scope, trigger, items(), dir);
  });
  // Antippen außerhalb schließt
  scope.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' && isOpen() && !trigger.contains(e.target as Node)) closeBonusPop(scope);
  });
}

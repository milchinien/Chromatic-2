// Karte groß anzeigen (doppelte Größe, damit der Kartentext auf dem Handy gut
// lesbar ist). Antippen irgendwo schließt die Ansicht wieder.

import { pcardHtml } from '../../lab/pcard';
import type { Card2 } from '../data';
import { html } from '../ui/anim';

export function zoomCard(layer: HTMLElement, card: Card2, rolled?: number): void {
  layer.querySelector('.m-zoom')?.remove();
  const el = html(`<div class="m-zoom"><div class="m-zoom-card">${pcardHtml(card, { big: true, rolled })}</div><span class="m-zoom-hint">Tap to close</span></div>`);
  // erst beim nächsten Antippen schließen (nicht mit dem Loslassen des Fingers, der geöffnet hat)
  const openedAt = performance.now();
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    if (performance.now() - openedAt > 250) el.remove();
  });
  layer.appendChild(el);
}

/**
 * Gedrückt halten → `onHold`; ein normales Antippen bleibt ein Klick.
 * Nach dem Halten wird der folgende Klick verschluckt.
 */
export function onLongPress(el: HTMLElement, onHold: () => void, ms = 380): void {
  let timer = 0;
  let held = false;
  let x0 = 0;
  let y0 = 0;
  const cancel = () => clearTimeout(timer);
  el.addEventListener('pointerdown', (e) => {
    held = false;
    x0 = e.clientX;
    y0 = e.clientY;
    cancel();
    timer = window.setTimeout(() => {
      held = true;
      onHold();
    }, ms);
  });
  el.addEventListener('pointermove', (e) => {
    if (Math.hypot(e.clientX - x0, e.clientY - y0) > 10) cancel();
  });
  el.addEventListener('pointerup', cancel);
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('pointerleave', cancel);
  el.addEventListener(
    'click',
    (e) => {
      if (!held) return;
      held = false;
      e.stopImmediatePropagation();
      e.preventDefault();
    },
    true,
  );
}

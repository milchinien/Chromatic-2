// Neues Kartendesign: neutraler Pixel-Rahmen (für alle Rassen gleich), nur
// das Bildfeld in der Mitte trägt die Rassenfarbe. Rahmen, Bildhintergrund
// und Wappen werden als Pixel-Bilder erzeugt (bleiben beim Skalieren scharf).

import { icon } from './pixels';
import { CLASS_ICON, RACES, type Card2, type RaceId } from './races';

const INK = '#141018';

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

const px = (ctx: CanvasRenderingContext2D, x: number, y: number, col: string, w = 1, h = 1) => {
  ctx.fillStyle = col;
  ctx.fillRect(x, y, w, h);
};

const cache = new Map<string, string>();
const cached = (key: string, make: () => string) => {
  let v = cache.get(key);
  if (!v) {
    v = make();
    cache.set(key, v);
  }
  return v;
};

/** 9-Slice-Rahmen (18×18, Slice 6): Tinte, Metallkante mit Fase, Nieten. */
export function frameUrl(): string {
  return cached('frame', () => {
    const [c, ctx] = canvas(18, 18);
    const L = '#c9c2b4';
    const M = '#948c7e';
    const D = '#5d574e';
    // Füllung
    px(ctx, 0, 0, '#211c26', 18, 18);
    // Außenkontur mit abgeschrägten Ecken
    px(ctx, 1, 0, INK, 16, 1);
    px(ctx, 1, 17, INK, 16, 1);
    px(ctx, 0, 1, INK, 1, 16);
    px(ctx, 17, 1, INK, 1, 16);
    ctx.clearRect(0, 0, 1, 1);
    ctx.clearRect(17, 0, 1, 1);
    ctx.clearRect(0, 17, 1, 1);
    ctx.clearRect(17, 17, 1, 1);
    // Metallband 4 px mit Licht von links oben
    px(ctx, 1, 1, M, 16, 4);
    px(ctx, 1, 13, M, 16, 4);
    px(ctx, 1, 1, M, 4, 16);
    px(ctx, 13, 1, M, 4, 16);
    px(ctx, 1, 1, L, 16, 1);
    px(ctx, 1, 1, L, 1, 16);
    px(ctx, 1, 16, D, 16, 1);
    px(ctx, 16, 1, D, 1, 16);
    // Innenkante
    px(ctx, 5, 5, INK, 8, 1);
    px(ctx, 5, 12, INK, 8, 1);
    px(ctx, 5, 5, INK, 1, 8);
    px(ctx, 12, 5, INK, 1, 8);
    px(ctx, 4, 4, D, 10, 1);
    px(ctx, 4, 4, D, 1, 10);
    px(ctx, 4, 13, L, 10, 1);
    px(ctx, 13, 4, L, 1, 10);
    // Nieten in den Ecken
    for (const [x, y] of [[2, 2], [14, 2], [2, 14], [14, 14]] as const) {
      px(ctx, x, y, L, 2, 2);
      px(ctx, x + 1, y + 1, D);
    }
    return c.toDataURL();
  });
}

/** 9-Slice-Rahmen für Balken (9×9, Slice 3): Tinte + 2 px Metall, dunkle Rinne innen. */
export function barFrameUrl(): string {
  return cached('barframe', () => {
    const [c, ctx] = canvas(9, 9);
    px(ctx, 0, 0, INK, 9, 9);
    ctx.clearRect(0, 0, 1, 1);
    ctx.clearRect(8, 0, 1, 1);
    ctx.clearRect(0, 8, 1, 1);
    ctx.clearRect(8, 8, 1, 1);
    px(ctx, 1, 1, '#948c7e', 7, 7);
    px(ctx, 1, 1, '#c9c2b4', 7, 1);
    px(ctx, 1, 1, '#c9c2b4', 1, 7);
    px(ctx, 1, 7, '#5d574e', 7, 1);
    px(ctx, 7, 1, '#5d574e', 1, 7);
    px(ctx, 3, 3, '#0c0a10', 3, 3);
    return c.toDataURL();
  });
}

/** Hintergrund des Bildfelds in der Rassenfarbe: Himmel mit Dithering, Boden, Funken. */
export function artBgUrl(race: RaceId, w: number, h: number): string {
  return cached(`art|${race}|${w}|${h}`, () => {
    const [c, ctx] = canvas(w, h);
    const [a0, a1, a2, a3] = RACES[race].art;
    const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const ground = h - Math.round(h * 0.26);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const t = (bayer[(y & 3) * 4 + (x & 3)]! + 0.5) / 16;
        let col: string;
        if (y < ground) {
          // Himmel: hell in der Mitte (Lichtschein hinter der Figur), dunkler zum Rand
          const d = Math.hypot((x - w / 2) / w, (y - ground * 0.6) / h) * 2.4;
          const v = Math.max(0, 2.2 - d * 1.6);
          const base = Math.floor(v);
          const col3 = [a1, a2, a3, a3];
          col = col3[Math.min(3, base + (v - base > t ? 1 : 0))]!;
        } else {
          const v = (y - ground) / (h - ground);
          col = v * 1.3 > t + 0.3 ? a0 : a1;
        }
        px(ctx, x, y, col);
      }
    // Horizontlinie + Grasbüschel
    for (let x = 0; x < w; x++) if ((x * 7) % 5 === 0) px(ctx, x, ground - 1, a1);
    let s = w * 31 + h;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < w / 3; k++) px(ctx, Math.floor(rnd() * w), ground + 1 + Math.floor(rnd() * (h - ground - 2)), a2);
    for (let k = 0; k < w / 6; k++) px(ctx, Math.floor(rnd() * w), Math.floor(rnd() * (ground - 4)), a3);
    return c.toDataURL();
  });
}

/** Wappen für DMG (rot, Schwert) und HP (grün, Herz): 34×12, Zahl kommt als Text dazu. */
export function crestUrl(kind: 'dmg' | 'hp'): string {
  return cached(`crest|${kind}`, () => {
    const [c, ctx] = canvas(34, 12);
    const [L, M, D] = kind === 'dmg' ? ['#f2735a', '#c8323c', '#7d1e2c'] : ['#9be070', '#3f9a3a', '#1f5b30'];
    px(ctx, 1, 0, INK, 32, 12);
    px(ctx, 0, 1, INK, 34, 10);
    px(ctx, 1, 1, M, 32, 10);
    px(ctx, 1, 1, L, 32, 1);
    px(ctx, 1, 1, L, 1, 10);
    px(ctx, 1, 10, D, 32, 1);
    px(ctx, 32, 1, D, 1, 10);
    // Symbol links
    const W = '#fff4e0';
    if (kind === 'dmg') {
      for (let i = 0; i < 6; i++) px(ctx, 3 + i, 8 - i, W);
      px(ctx, 3, 6, W);
      px(ctx, 5, 8, W);
      px(ctx, 2, 9, D);
    } else {
      for (const [x, y] of [[4, 3], [5, 3], [7, 3], [8, 3], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [8, 4], [9, 4], [3, 5], [4, 5], [5, 5], [6, 5], [7, 5], [8, 5], [9, 5], [4, 6], [5, 6], [6, 6], [7, 6], [8, 6], [5, 7], [6, 7], [7, 7], [6, 8]] as const) px(ctx, x, y, W);
    }
    px(ctx, 11, 2, D, 1, 8);
    return c.toDataURL();
  });
}

function starsHtml(n: number): string {
  let out = '';
  for (let i = 0; i < 3; i++) out += icon('star', i < n ? '' : 'empty');
  return `<span class="pc-stars">${out}</span>`;
}

/** Shared artwork for full-size cards and shop thumbnails. */
export function cardArtUrl(card: Pick<Card2, 'name'>): string {
  // The renamed mage uses the approved necromancer artwork from this asset set.
  const artName = card.name === 'Necromancer' ? 'Blight Witch' : card.name;
  const slug = artName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${import.meta.env.BASE_URL}card-art/v2/${slug}.png`;
}

export interface PCardOpts {
  big?: boolean;
  /** Gewürfelte Truppenzahl; wird als „×gewürfelt/max“ angezeigt */
  rolled?: number;
  team?: 0 | 1;
  selected?: boolean;
  index?: number;
  extra?: string;
}

export function pcardHtml(card: Card2, o: PCardOpts = {}): string {
  const big = !!o.big;
  const race = RACES[card.race];
  const cls = ['pc', big ? 'big' : '', o.selected ? 'selected' : '', o.extra ?? ''].filter(Boolean).join(' ');
  return `
    <article class="${cls}" style="--frame:url(${frameUrl()})"${o.index !== undefined ? ` data-card="${o.index}"` : ''}>
      <header class="pc-top">${icon(CLASS_ICON[card.cls])}<span class="pc-name">${card.name}</span></header>
      <div class="pc-art">
        <img class="pc-illustration" src="${cardArtUrl(card)}" alt="" draggable="false">
        <span class="pc-troops${o.rolled !== undefined ? ' rolled' : ''}">×${o.rolled ?? card.troops}${o.rolled !== undefined && card.troops > 1 ? `<small>/${card.troops}</small>` : ''}</span>
      </div>
      <div class="pc-type">${big ? `${race.name} · ${card.cls}` : card.cls}</div>
      ${starsHtml(card.stars)}
      ${big ? `<p class="pc-text">${card.text}</p>` : ''}
      <footer class="pc-stats">
        <span class="crest" style="background-image:url(${crestUrl('dmg')})">${card.dmg}</span>
        <span class="crest" style="background-image:url(${crestUrl('hp')})">${card.hp}</span>
      </footer>
    </article>`;
}

/** Innenbild der Kartenrückseite: Rautenmuster + Ring aus den 7 Farben. */
export function backArtUrl(): string {
  return cached('back', () => {
    const w = 74;
    const h = 107;
    const [c, ctx] = canvas(w, h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const d = (x + y) % 8 === 0 || (x - y + 800) % 8 === 0;
        px(ctx, x, y, d ? '#3a3146' : '#241e2c');
      }
    const cx = w / 2;
    const cy = h / 2;
    const cols = ['#d0383f', '#f6cc3a', '#3f9d3c', '#2f7fd8', '#7b40ab', '#8b919c', '#d2bd95'];
    for (let r = 16; r < 19; r++)
      for (let a = 0; a < 360; a += 1) {
        const ang = (a / 180) * Math.PI;
        px(ctx, Math.round(cx + Math.cos(ang) * r), Math.round(cy + Math.sin(ang) * r), cols[Math.floor(a / (360 / 7))]!);
      }
    for (let r = 0; r < 15; r++) for (let a = 0; a < 360; a += 3) {
      const ang = (a / 180) * Math.PI;
      px(ctx, Math.round(cx + Math.cos(ang) * r), Math.round(cy + Math.sin(ang) * r), r < 13 ? '#141018' : '#5d574e');
    }
    // „2“ in der Mitte
    const two = ['####', '...#', '.##.', '#...', '####'];
    two.forEach((row, y) => [...row].forEach((ch, x) => ch === '#' && px(ctx, cx - 4 + x * 2, cy - 5 + y * 2, '#f4ecd9', 2, 2)));
    return c.toDataURL();
  });
}

/** Rückseite einer Karte (gleiche Größe wie .pc). */
export function cardBackHtml(big = false): string {
  return `<article class="pc pc-back${big ? ' big' : ''}" style="--frame:url(${frameUrl()})"><div class="pc-back-art" style="background-image:url(${backArtUrl()})"></div></article>`;
}

/** Karte, die sich umdrehen lässt (Rückseite zuerst sichtbar). */
export function flipCardHtml(front: string, big = false): string {
  return `<div class="flipcard${big ? ' big' : ''}"><div class="flip-inner" style="transform:rotateY(180deg)"><div class="flip-front">${front}</div><div class="flip-back">${cardBackHtml(big)}</div></div></div>`;
}

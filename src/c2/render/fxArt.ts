// Pixel-Texturen für die Kampf-Effekte. Alles weiß (wird eingefärbt) und in
// mehreren festen Größen, damit Glühen, Rauch & Co. nie skaliert werden
// müssen: jedes Pixel bleibt ein Spielpixel.

import { PixelGrid } from '../../art/pixel';

/** Durchmesser der Größen-Sets (Glühen, Rauchwolken). */
export const GLOW_SIZES = [2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 56, 64];
export const PUFF_SIZES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 24];

const grey = (v: number, a = 1) => `rgba(${v},${v},${v},${a})`;

/** Weiches Licht in harten Stufen (Pixel-Look statt Verlauf). */
function glow(d: number): PixelGrid {
  const g = new PixelGrid(d, d);
  const c = (d - 1) / 2;
  const r = d / 2;
  const steps = d <= 6 ? 3 : d <= 16 ? 5 : 7;
  for (let y = 0; y < d; y++)
    for (let x = 0; x < d; x++) {
      const t = Math.hypot(x - c, y - c) / r;
      if (t >= 1) continue;
      const a = Math.ceil(Math.pow(1 - t, 1.7) * steps) / steps;
      if (a > 0) g.set(x, y, grey(255, Math.min(1, a)));
    }
  return g;
}

/** Rauch-/Staubwolke: runde Scheibe mit Licht oben links und Schatten unten rechts. */
function puff(d: number): PixelGrid {
  const g = new PixelGrid(d, d);
  const c = (d - 1) / 2;
  const r = d / 2;
  for (let y = 0; y < d; y++)
    for (let x = 0; x < d; x++) {
      const dx = (x - c) / r;
      const dy = (y - c) / r;
      const q = dx * dx + dy * dy;
      if (q >= 0.95) continue;
      // weicher Rand: äußerer Ring halb durchsichtig
      const rim = d > 4 && q > 0.62 ? 0.5 : 1;
      const s = dx + dy;
      g.set(x, y, s > 0.55 ? grey(150, rim) : s < -0.75 && d > 3 ? grey(255, rim) : grey(215, rim));
    }
  return g;
}

export function fxArtGrids() {
  const W = '#ffffff';
  const L = grey(200);
  const spark3 = new PixelGrid(3, 1).set(0, 0, grey(255, 0.45)).set(1, 0, L).set(2, 0, W);
  const spark6 = new PixelGrid(6, 1).set(0, 0, grey(255, 0.2)).set(1, 0, grey(255, 0.4)).set(2, 0, grey(255, 0.6)).set(3, 0, L).set(4, 0, W).set(5, 0, W);
  const star = new PixelGrid(5, 5).dots(grey(255, 0.55), [[2, 0], [0, 2], [4, 2], [2, 4]]).dots(W, [[2, 1], [1, 2], [2, 2], [3, 2], [2, 3]]);
  const flare = new PixelGrid(9, 9);
  for (let k = 0; k < 9; k++) {
    const a = 1 - Math.abs(k - 4) / 4.5;
    flare.set(k, 4, grey(255, a)).set(4, k, grey(255, a));
  }
  flare.dots(grey(255, 0.5), [[3, 3], [5, 3], [3, 5], [5, 5]]);
  // Hieb: Sichelbogen
  const slash = new PixelGrid(9, 9);
  for (let y = 0; y < 9; y++)
    for (let x = 0; x < 9; x++) {
      const d0 = Math.hypot(x - 1, y - 7);
      const d1 = Math.hypot(x - 0, y - 8.5);
      if (d0 < 7.6 && d1 > 6.2) slash.set(x, y, d0 > 6.8 ? W : grey(255, 0.55));
    }
  const flame = new PixelGrid(3, 5).dots(grey(255, 0.6), [[1, 0]]).rect(0, 1, 3, 3, L).dots(W, [[1, 1], [1, 2], [1, 3]]).dots(grey(255, 0.5), [[1, 4]]);
  const ember = new PixelGrid(2, 2).set(0, 0, W).set(1, 0, L).set(0, 1, L).set(1, 1, grey(255, 0.4));
  const leaf = new PixelGrid(3, 2).set(1, 0, W).set(2, 0, W).set(0, 1, L).set(1, 1, L);
  const snow = new PixelGrid(3, 3).dots(W, [[1, 1]]).dots(grey(255, 0.6), [[0, 0], [2, 0], [0, 2], [2, 2]]);
  const bubble = new PixelGrid(4, 4).dots(L, [[1, 0], [2, 0], [0, 1], [3, 1], [0, 2], [3, 2], [1, 3], [2, 3]]).set(1, 1, W);
  const chunk = new PixelGrid(3, 3).rect(0, 0, 3, 3, grey(190)).set(0, 0, W).set(1, 0, grey(235)).set(2, 2, grey(110)).set(1, 2, grey(140));
  const shard = new PixelGrid(2, 3).set(0, 0, W).set(0, 1, W).set(1, 1, L).set(1, 2, grey(160));
  const soul = new PixelGrid(3, 5).dots(W, [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]]).dots(grey(255, 0.55), [[0, 2], [2, 2], [1, 3]]).dots(grey(255, 0.25), [[0, 4], [2, 3]]);
  const cross = new PixelGrid(5, 5).rect(2, 0, 1, 5, W).rect(0, 2, 5, 1, W).set(2, 2, W);
  const pillar = new PixelGrid(5, 40);
  for (let y = 0; y < 40; y++) {
    const a = Math.min(1, (y / 40) * 1.4) * (y > 36 ? 0.6 : 1);
    pillar.set(2, y, grey(255, a)).set(1, y, grey(255, a * 0.5)).set(3, y, grey(255, a * 0.5));
    if (y % 2 === 0) pillar.set(0, y, grey(255, a * 0.18)).set(4, y, grey(255, a * 0.18));
  }
  const drop = new PixelGrid(1, 3).set(0, 0, grey(255, 0.35)).set(0, 1, grey(255, 0.7)).set(0, 2, W);
  return {
    glow: GLOW_SIZES.map(glow),
    puff: PUFF_SIZES.map(puff),
    spark3,
    spark6,
    star,
    flare,
    slash,
    flame,
    ember,
    leaf,
    snow,
    bubble,
    chunk,
    shard,
    soul,
    cross,
    pillar,
    drop,
  };
}

export type FxArtGrids = ReturnType<typeof fxArtGrids>;

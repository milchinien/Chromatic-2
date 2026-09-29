// Schlachtfeld im Hochformat – gleiche Pixel-Bausteine wie lab/battlefield.ts
// (Wiese mit Erdflecken, Burgmauer mit Türmen und Tor, Wald mit Bäumen),
// nur anders angeordnet: gegnerische Burg oben, eigene unten, Wald an den
// Seiten und unten, wo die Karten liegen.

import { Scene, uiRamp, type PaletteTheme } from '../../lab/palettes';
import { MH, MW, battleLayout, type BattleLayout } from './stage';

const FACE = 4; // sichtbare Vorderseite der Mauer
const TOWERS = [44, 160, 276];
const GATE = 102;

function scene(t: PaletteTheme): Scene {
  return new Scene(uiRamp(t), 99, MW, MH);
}

/** Liegt (x, y) auf Erde statt Gras? Mitte des Feldes ist zertrampelt. */
function isDirt(s: Scene, L: BattleLayout, x: number, y: number): boolean {
  const cy = (L.top + L.bottom) / 2;
  const mid = 1 - Math.min(1, Math.abs(y - cy) / (L.len * 0.45)) * 0.9;
  const band = 1 - Math.min(1, Math.abs(x - MW / 2) / 120);
  const n = s.fbm(x / 48, y / 40, 17, 4);
  return n + mid * band * 0.2 > 0.66;
}

function groundValue(s: Scene, L: BattleLayout, x: number, y: number): number {
  if (isDirt(s, L, x, y)) {
    const fine = s.fbm(x / 7, y / 7, 23, 2);
    return 0.55 + fine * 0.55;
  }
  const n = s.fbm(x / 70, y / 60, 3, 3);
  const fine = s.noise(x / 4, y / 4, 9);
  return 1.2 + n * 0.75 + (fine - 0.5) * 0.3;
}

function drawGround(s: Scene, L: BattleLayout): void {
  s.each((x, y) => {
    let v = groundValue(s, L, x, y);
    // Schatten der Burgmauern
    const d = Math.min(y - L.wallTop1 - FACE, L.wallBot0 - FACE - 1 - y);
    if (d >= 0 && d < 6) v -= 0.8 * (1 - d / 6);
    return Math.max(0, v);
  });
  // Grasbüschel, Blumen, Steinchen (gleiche Dichte wie am PC)
  const n = Math.round((2400 * MW * MH) / (640 * 360));
  for (let k = 0; k < n; k++) {
    const x = Math.floor(s.rnd() * MW);
    const y = Math.floor(s.rnd() * MH);
    const r = s.rnd();
    if (isDirt(s, L, x, y)) {
      if (r < 0.25) {
        s.set(x, y, 3);
        s.set(x + 1, y, 2);
        s.set(x, y + 1, 0);
        s.set(x + 1, y + 1, 0);
      }
    } else if (r < 0.7) {
      s.set(x, y, 2);
      s.set(x, y + 1, 0);
      if (r < 0.3) {
        s.set(x + 2, y + 1, 2);
        s.set(x + 2, y + 2, 0);
      }
    } else if (r < 0.78) {
      s.set(x, y, 4);
    }
  }
}

// --- Bäume (wie am PC) -------------------------------------------------------------------

function tree(s: Scene, cx: number, cy: number, r: number, seed: number): void {
  s.each(
    (x, y) => {
      const d = Math.hypot(x - cx - r * 0.35, (y - cy - r * 0.45) * 1.2) / r;
      return d < 1 && (x + y) % 2 === 0 ? 0 : null;
    },
    cx - r,
    cy - r,
    cx + r * 2,
    cy + r * 2,
  );
  s.each(
    (x, y) => {
      const n = s.fbm(x / 6, y / 6, seed, 3);
      const d = Math.hypot(x - cx, y - cy) / r + (n - 0.5) * 0.6;
      if (d > 1) return null;
      if (d > 0.9) return 0;
      const l = 1 - Math.hypot(x - cx + r * 0.4, y - cy + r * 0.45) / (r * 1.5);
      return Math.max(0.5, Math.min(3.3, 0.7 + l * 2.6 + (n - 0.5) * 0.9));
    },
    cx - r * 1.4,
    cy - r * 1.4,
    cx + r * 1.4,
    cy + r * 1.4,
  );
}

function drawForest(s: Scene, L: BattleLayout): void {
  const trees: [number, number, number][] = [];
  // Waldrand oben (hinter der gegnerischen Burg)
  for (let k = 0; k < 30; k++) trees.push([-10 + s.rnd() * (MW + 20), -8 + s.rnd() * 26, 9 + s.rnd() * 7]);
  // Links und rechts ein schmaler Waldstreifen am Feldrand
  for (let y = L.wallTop1 - 6; y < L.wallBot0 + 6; y += 9) {
    trees.push([-12 + s.rnd() * 18, y + s.rnd() * 6, 8 + s.rnd() * 6]);
    trees.push([MW + 12 - s.rnd() * 18, y + s.rnd() * 6, 8 + s.rnd() * 6]);
  }
  // Unten: dicht zugewachsen, hier liegen die Karten
  const band = MH + 12 - L.wallBot1;
  const n = Math.round((band * MW) / 150);
  for (let k = 0; k < n; k++) trees.push([-10 + s.rnd() * (MW + 20), L.wallBot1 + 2 + s.rnd() * band, 9 + s.rnd() * 8]);
  // Einzelne Büsche auf der Wiese nahe dem Rand
  for (let k = 0; k < 10; k++) {
    const left = s.rnd() < 0.5;
    trees.push([left ? 22 + s.rnd() * 12 : MW - 22 - s.rnd() * 12, L.top + 20 + s.rnd() * (L.len - 40), 4 + s.rnd() * 3]);
  }
  trees.sort((a, b) => a[1] - b[1]);
  trees.forEach(([x, y, r], i) => tree(s, x, y, r, 40 + i));
}

// --- Burg --------------------------------------------------------------------------------

/** Turm von oben (wie am PC): Zinnenkranz, Pyramidendach, Fahne. */
function tower(s: Scene, cx: number, ty: number): void {
  const half = 14;
  for (let y = ty - half; y <= ty + half; y++)
    for (let x = cx - half; x <= cx + half; x++) {
      const onEdge = Math.abs(x - cx) >= half - 2 || Math.abs(y - ty) >= half - 2;
      if (onEdge) {
        const merlon = ((x + y) >> 2) % 2 === 0;
        const lit = x - cx + (y - ty) < 0;
        s.shade(x, y, merlon ? (lit ? 3.8 : 3) : lit ? 2.2 : 1.4);
      } else s.shade(x, y, 1.6);
    }
  for (let k = -half - 1; k <= half + 1; k++) {
    s.set(cx + k, ty - half - 1, 0);
    s.set(cx + k, ty + half + 1, 0);
    s.set(cx - half - 1, ty + k, 0);
    s.set(cx + half + 1, ty + k, 0);
    if ((k + ty) % 2 === 0) {
      s.set(cx + k + 2, ty + half + 2, 0);
      s.set(cx + half + 2, ty + k + 2, 0);
    }
  }
  const r = 10;
  for (let y = ty - r; y <= ty + r; y++)
    for (let x = cx - r; x <= cx + r; x++) {
      const dx = x - cx;
      const dy = y - ty;
      if (Math.abs(dx) === r || Math.abs(dy) === r) {
        s.set(x, y, 0);
        continue;
      }
      if (Math.abs(dx) === Math.abs(dy)) {
        s.set(x, y, dx < 0 && dy < 0 ? 4 : 1);
        continue;
      }
      const face = Math.abs(dy) > Math.abs(dx) ? (dy < 0 ? 3.5 : 1.2) : dx < 0 ? 2.7 : 1.8;
      const k = Math.max(Math.abs(dx), Math.abs(dy));
      s.shade(x, y, face - (k % 3 === 0 ? 0.45 : 0));
    }
  s.set(cx, ty, 4);
  for (let k = 1; k <= 6; k++) s.set(cx, ty - k, 0);
  for (let y = ty - 6; y < ty - 3; y++) for (let x = cx + 1; x < cx + 6; x++) s.set(x, y, x === cx + 5 && y === ty - 4 ? 3 : 4);
}

/**
 * Waagrechte Mauer. `y0…y1` = Mauerkrone, die Vorderseite liegt zum Feld hin
 * (unten bei der gegnerischen Burg, oben bei der eigenen).
 */
function drawCastle(s: Scene, y0: number, y1: number, faceDown: boolean): void {
  for (let x = 0; x < MW; x++) {
    for (let y = y0; y < y1; y++) {
      const row = Math.floor(x / 4);
      const mortar = x % 4 === 0 || (y + (row % 2) * 4) % 8 === 0;
      const edge = y === (faceDown ? y0 : y1 - 1) ? -0.5 : 0;
      s.shade(x, y, (mortar ? 2.0 : 2.9 + (s.noise(x / 3, y / 3, 61) - 0.5) * 0.4) + edge);
    }
    // Wehrgang
    s.set(x, faceDown ? y0 + 7 : y1 - 8, 2);
    // Vorderseite zum Feld + Zinnen
    for (let k = 0; k < FACE; k++) s.shade(x, faceDown ? y1 + k : y0 - 1 - k, 1.35 - k * 0.15);
    s.set(x, faceDown ? y1 : y0 - 1, x % 6 < 3 ? 4 : 1);
    s.set(x, faceDown ? y1 + FACE : y0 - 1 - FACE, 0);
  }
  // Tor mit Zugbrücke
  for (let x = GATE - 9; x < GATE + 9; x++) {
    for (let k = 0; k < FACE; k++) s.set(x, faceDown ? y1 + k : y0 - 1 - k, 0);
    for (let k = FACE; k < FACE + 12; k++) {
      const y = faceDown ? y1 + k : y0 - 1 - k;
      s.shade(x, y, x % 3 === 0 ? 0.6 : 1.6 + (k % 5 === 0 ? -0.5 : 0));
    }
  }
  const cy = (y0 + y1) >> 1;
  for (const tx of TOWERS) tower(s, tx, cy);
}

function toCanvas(s: Scene): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = MW;
  c.height = MH;
  c.getContext('2d')!.putImageData(s.toImageData(), 0, 0);
  return c;
}

// --- Öffentlich ----------------------------------------------------------------------------

/** Boden + Wald (ohne Burgen). */
export function groundCanvasP(t: PaletteTheme): HTMLCanvasElement {
  const L = battleLayout();
  const s = scene(t);
  s.rect(0, 0, MW, MH, 0);
  drawGround(s, L);
  drawForest(s, L);
  return toCanvas(s);
}

/** [eigene Burg unten, gegnerische Burg oben] auf transparentem Grund. */
export function castleCanvasesP(t: PaletteTheme): HTMLCanvasElement[] {
  const L = battleLayout();
  const own = scene(t);
  drawCastle(own, L.wallBot0, L.wallBot1, false);
  const foe = scene(t);
  drawCastle(foe, L.wallTop0, L.wallTop1, true);
  return [toCanvas(own), toCanvas(foe)];
}

/** Nur der Wald (transparent), liegt über den Burgen. */
export function forestCanvasP(t: PaletteTheme): HTMLCanvasElement {
  const L = battleLayout();
  const s = scene(t);
  const probe = scene(t);
  drawGround(probe, L);
  (s as unknown as { rng: number }).rng = (probe as unknown as { rng: number }).rng;
  drawForest(s, L);
  return toCanvas(s);
}

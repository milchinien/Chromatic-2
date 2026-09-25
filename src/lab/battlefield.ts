// Top-Down-Schlachtfeld für den Kampfbildschirm: Wiese mit Erdflecken,
// links und rechts je eine Burgmauer mit Türmen, oben und unten Waldrand.
// Gezeichnet nur mit den 5 Oberflächenfarben des Designs (wie das Hauptmenü),
// Übergänge per Dithering.

import { Scene, uiRamp, type PaletteTheme } from './palettes';

const W = 640;
const H = 360;

/** Mauer-Geometrie (linke Burg; die rechte ist gespiegelt). */
const WALL_X0 = 6;
const WALL_X1 = 26;
const FACE = 4; // sichtbare Vorderseite der Mauer

/** Aufteilung des Bildschirms: wo die Wiese liegt, wo Wald ist, wo Türme stehen. */
export interface FieldLayout {
  /** Waldrand oben reicht bis hier */
  top: number;
  /** ab hier ist unten nur noch Wald */
  bottom: number;
  wallY0: number;
  wallY1: number;
  towers: number[];
  gate: number;
}

/** Klassisch: schmaler Waldrand oben und unten, Mauer über die ganze Höhe. */
export const LAYOUT_CLASSIC: FieldLayout = { top: 22, bottom: 336, wallY0: 0, wallY1: H, towers: [52, 142, 232, 322], gate: 187 };

/** Welt-Designs: schmaler Wald oben, breiter Wald unten, in dem die Karten liegen. */
export const LAYOUT_WORLD: FieldLayout = { top: 14, bottom: 214, wallY0: 4, wallY1: 226, towers: [30, 116, 202], gate: 159 };

/** Liegt (x, y) auf Erde statt Gras? */
function isDirt(s: Scene, x: number, y: number): boolean {
  // Mitte ist zertrampelt, zum Rand hin mehr Gras
  const mid = 1 - Math.min(1, Math.abs(x - W / 2) / 260) * 0.9;
  const band = 1 - Math.min(1, Math.abs(y - 160) / 120);
  const n = s.fbm(x / 48, y / 40, 17, 4);
  return n + mid * band * 0.2 > 0.66;
}

function groundValue(s: Scene, x: number, y: number): number {
  if (isDirt(s, x, y)) {
    const fine = s.fbm(x / 7, y / 7, 23, 2);
    return 0.55 + fine * 0.55;
  }
  const n = s.fbm(x / 70, y / 60, 3, 3);
  const fine = s.noise(x / 4, y / 4, 9);
  return 1.2 + n * 0.75 + (fine - 0.5) * 0.3;
}

function drawGround(s: Scene): void {
  s.each((x, y) => {
    let v = groundValue(s, x, y);
    // Schatten der Burgmauern
    const d = Math.min(x - (WALL_X1 + FACE), W - 1 - (WALL_X1 + FACE) - x);
    if (d >= 0 && d < 6) v -= 0.8 * (1 - d / 6);
    return Math.max(0, v);
  });
  // Grasbüschel, Blumen, Steinchen
  for (let k = 0; k < 2400; k++) {
    const x = Math.floor(s.rnd() * W);
    const y = Math.floor(s.rnd() * H);
    const r = s.rnd();
    if (isDirt(s, x, y)) {
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

// --- Bäume -------------------------------------------------------------------------------

function tree(s: Scene, cx: number, cy: number, r: number, seed: number): void {
  // Schlagschatten nach rechts unten
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
  // Krone, von links oben beleuchtet
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

function drawForest(s: Scene, L: FieldLayout): void {
  const trees: [number, number, number][] = [];
  // Waldrand oben und unten
  for (let k = 0; k < 70; k++) trees.push([40 + s.rnd() * 560, -8 + s.rnd() * (L.top + 8), 9 + s.rnd() * 7]);
  // Unten: so viele Bäume, dass der Streifen dicht zugewachsen ist
  const band = H + 12 - L.bottom;
  const n = Math.round((band * 640) / 150);
  for (let k = 0; k < n; k++) trees.push([-10 + s.rnd() * 660, L.bottom + 2 + s.rnd() * band, 9 + s.rnd() * 8]);
  // Einzelne Bäume und Büsche auf der Wiese nahe dem Rand
  for (let k = 0; k < 10; k++) {
    const top = s.rnd() < 0.5;
    trees.push([60 + s.rnd() * 520, top ? L.top + 12 + s.rnd() * 14 : L.bottom - 30 + s.rnd() * 20, 4 + s.rnd() * 3]);
  }
  trees.sort((a, b) => a[1] - b[1]);
  trees.forEach(([x, y, r], i) => tree(s, x, y, r, 40 + i));
}

// --- Burg -------------------------------------------------------------------------------------

function drawCastle(s: Scene, mirror: boolean, L: FieldLayout): void {
  const mx = (x: number) => (mirror ? W - 1 - x : x);
  const set = (x: number, y: number, v: number) => s.set(mx(x), y, v);
  const shade = (x: number, y: number, v: number) => s.shade(mx(x), y, v);

  // Mauerkrone mit Ziegelmuster
  for (let y = L.wallY0; y < L.wallY1; y++) {
    for (let x = WALL_X0; x < WALL_X1; x++) {
      const row = Math.floor(y / 4);
      const mortar = y % 4 === 0 || (x + (row % 2) * 4) % 8 === 0;
      const edge = x === WALL_X0 ? -0.5 : 0;
      shade(x, y, (mortar ? 2.0 : 2.9 + (s.noise(x / 3, y / 3, 61) - 0.5) * 0.4) + edge);
    }
    // Wehrgang
    set(WALL_X0 + 7, y, 2);
    // Vorderseite zur Feldseite hin + Zinnen
    for (let x = WALL_X1; x < WALL_X1 + FACE; x++) shade(x, y, 1.35 - (x - WALL_X1) * 0.15);
    set(WALL_X1, y, y % 6 < 3 ? 4 : 1);
    set(WALL_X1 + FACE, y, 0);
  }

  // Tor mit Zugbrücke
  for (let y = L.gate - 9; y < L.gate + 9; y++) {
    for (let x = WALL_X1; x < WALL_X1 + FACE; x++) set(x, y, 0);
    for (let x = WALL_X1 + FACE; x < WALL_X1 + FACE + 12; x++) shade(x, y, y % 3 === 0 ? 0.6 : 1.6 + (x % 5 === 0 ? -0.5 : 0));
  }

  // Türme: quadratisch mit Zinnenkranz, spitzes Dach in der Mitte
  for (const ty of L.towers) {
    const cx = (WALL_X0 + WALL_X1) >> 1;
    const half = 14;
    for (let y = ty - half; y <= ty + half; y++)
      for (let x = cx - half; x <= cx + half; x++) {
        const onEdge = Math.abs(x - cx) >= half - 2 || Math.abs(y - ty) >= half - 2;
        if (onEdge) {
          const merlon = ((x + y) >> 2) % 2 === 0;
          const lit = x - cx + (y - ty) < 0;
          shade(x, y, merlon ? (lit ? 3.8 : 3) : lit ? 2.2 : 1.4);
        } else shade(x, y, 1.6);
      }
    // Außenkontur + Schatten
    for (let k = -half - 1; k <= half + 1; k++) {
      set(cx + k, ty - half - 1, 0);
      set(cx + k, ty + half + 1, 0);
      set(cx - half - 1, ty + k, 0);
      set(cx + half + 1, ty + k, 0);
      if ((k + ty) % 2 === 0) {
        set(cx + k + 2, ty + half + 2, 0);
        set(cx + half + 2, ty + k + 2, 0);
      }
    }
    // Dach: vierseitige Pyramide von oben (oben/links im Licht)
    const r = 10;
    for (let y = ty - r; y <= ty + r; y++)
      for (let x = cx - r; x <= cx + r; x++) {
        const dx = x - cx;
        const dy = y - ty;
        if (Math.abs(dx) === r || Math.abs(dy) === r) {
          set(x, y, 0);
          continue;
        }
        if (Math.abs(dx) === Math.abs(dy)) {
          set(x, y, dx < 0 && dy < 0 ? 4 : 1);
          continue;
        }
        const face = Math.abs(dy) > Math.abs(dx) ? (dy < 0 ? 3.5 : 1.2) : dx < 0 ? 2.7 : 1.8;
        // Dachziegel-Reihen parallel zur Traufe
        const k = Math.max(Math.abs(dx), Math.abs(dy));
        shade(x, y, face - (k % 3 === 0 ? 0.45 : 0));
      }
    set(cx, ty, 4);
    // Fahne
    for (let k = 1; k <= 6; k++) set(cx, ty - k, 0);
    for (let y = ty - 6; y < ty - 3; y++) for (let x = cx + 1; x < cx + 6; x++) set(x, y, x === cx + 5 && y === ty - 4 ? 3 : 4);
  }
}

// --- Öffentlich ----------------------------------------------------------------------------

export function battlefieldScene(s: Scene, L: FieldLayout = LAYOUT_CLASSIC): void {
  drawGround(s);
  drawCastle(s, false, L);
  drawCastle(s, true, L);
  drawForest(s, L);
}

const cache = new Map<string, string>();

/** Schlachtfeld in den Farben eines Designs (gecacht). */
export function battlefieldUrl(t: PaletteTheme, L: FieldLayout = LAYOUT_CLASSIC): string {
  const key = `${t.id}|${L.bottom}`;
  let url = cache.get(key);
  if (!url) {
    const s = new Scene(uiRamp(t), 99);
    s.rect(0, 0, W, H, 0);
    battlefieldScene(s, L);
    url = s.toDataURL();
    cache.set(key, url);
  }
  return url;
}

/** Nur der Boden mit Wald, ohne Burgen (Spiel: Burgen sind eigene Sprites). */
export function groundCanvas(t: PaletteTheme, L: FieldLayout = LAYOUT_WORLD): HTMLCanvasElement {
  const s = new Scene(uiRamp(t), 99);
  s.rect(0, 0, W, H, 0);
  drawGround(s);
  // Wald unten muss über den Burgen liegen: Burgen werden im Spiel darunter
  // gezeichnet, deshalb hier nur Boden + Wald.
  drawForest(s, L);
  return toCanvas(s);
}

/** Nur eine Burg (links oder rechts) auf transparentem Grund. */
export function castleCanvas(t: PaletteTheme, right: boolean, L: FieldLayout = LAYOUT_WORLD): HTMLCanvasElement {
  const s = new Scene(uiRamp(t), 99);
  drawCastle(s, right, L);
  return toCanvas(s);
}

/** Nur der Wald (transparent), um ihn über die Burgen zu legen. */
export function forestCanvas(t: PaletteTheme, L: FieldLayout = LAYOUT_WORLD): HTMLCanvasElement {
  const s = new Scene(uiRamp(t), 99);
  // gleicher Zufall wie groundCanvas: erst die Boden-Zufallszahlen verbrauchen
  const probe = new Scene(uiRamp(t), 99);
  drawGround(probe);
  (s as unknown as { rng: number }).rng = (probe as unknown as { rng: number }).rng;
  drawForest(s, L);
  return toCanvas(s);
}

function toCanvas(s: Scene): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  c.getContext('2d')!.putImageData(s.toImageData(), 0, 0);
  return c;
}

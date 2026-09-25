// Vier Röhrenmonitor-Designs (26–29): je eine fast einfarbige Palette auf
// Schwarz – Inferno (Rot), Jungle (Grün), Nightfall (Nachtblau), Circuit
// (Neon-Lila). Nur die Farben stammen aus den Referenzbildern.

import { fixedRng, Scene, type PaletteTheme } from './palettes';

const W = 640;
const H = 360;

// --- Bausteine --------------------------------------------------------------------------

/** Kleine Plus-Funken wie in den Referenzen. */
function sparks(s: Scene, n: number, cols: number[], y0 = 0, y1 = H): void {
  for (let k = 0; k < n; k++) {
    const x = Math.floor(s.rnd() * W);
    const y = y0 + Math.floor(s.rnd() * (y1 - y0));
    const c = cols[Math.floor(s.rnd() * cols.length)]!;
    s.set(x, y, c);
    if (s.rnd() < 0.35) {
      s.set(x - 1, y, c);
      s.set(x + 1, y, c);
      s.set(x, y - 1, c);
      s.set(x, y + 1, c);
    }
  }
}

/** Schwebende Insel aus Steinblöcken mit herabhängenden Brocken. */
function island(s: Scene, x0: number, x1: number, top: number, depth: number, seed: number): void {
  for (let x = x0; x < x1; x++) {
    const edge = Math.min(x - x0, x1 - x) / 30;
    const d = Math.floor(depth * Math.min(1, edge) * (0.55 + s.fbm(x / 14, 0.5, seed, 3) * 0.7));
    for (let y = top; y < top + d; y++) {
      const bx = Math.floor((x + (Math.floor(y / 6) % 2) * 5) / 10);
      const by = Math.floor(y / 6);
      const mortar = y % 6 === 0 || (x + (Math.floor(y / 6) % 2) * 5) % 10 === 0;
      const shade = 1 + ((bx * 7 + by * 13) % 3) * 0.45 - (y - top) / (depth * 1.4);
      s.shade(x, y, mortar ? 0 : Math.max(0.4, shade));
    }
    // Oberkante hell (Licht von oben)
    s.set(x, top, 3);
    if ((x * 7) % 11 < 6) s.set(x, top + 1, 2);
  }
}

/** Kahler, verdrehter Baum als Silhouette. */
function deadTree(s: Scene, x: number, base: number, h: number, c: number, seed: number): void {
  const r = fixedRng(seed);
  const branch = (bx: number, by: number, ang: number, len: number, w: number) => {
    let cx = bx;
    let cy = by;
    for (let i = 0; i < len; i++) {
      ang += (r() - 0.5) * 0.35;
      cx += Math.cos(ang);
      cy += Math.sin(ang);
      for (let k = 0; k < w; k++) s.set(cx + k, cy, c);
      if (len > 8 && i > len * 0.4 && r() < 0.08) branch(cx, cy, ang + (r() < 0.5 ? -0.9 : 0.9), Math.floor(len * 0.5), Math.max(1, w - 1));
    }
  };
  branch(x, base, -Math.PI / 2, h, 3);
}

/** Säulen-Ruine aus Ziegeln. */
function pillar(s: Scene, x: number, base: number, w: number, h: number, seed: number): void {
  const r = fixedRng(seed);
  for (let y = base - h; y < base; y++) {
    const broken = y < base - h + 10 ? Math.floor(r() * 4) : 0;
    for (let xx = x + broken; xx < x + w - broken; xx++) {
      const mortar = y % 5 === 0 || (xx + (Math.floor(y / 5) % 2) * 4) % 8 === 0;
      const lit = xx < x + 3 ? 0.9 : xx > x + w - 4 ? -0.6 : 0;
      s.shade(xx, y, mortar ? 0.6 : 1.7 + lit + (r() - 0.5) * 0.3);
    }
  }
}

// --- Szenen ----------------------------------------------------------------------------

function infernoScene(s: Scene): void {
  // Glut vom unteren Rand
  s.each((x, y) => {
    const v = ((y - 200) / 160) * 1.4 + (s.fbm(x / 40, y / 30, 5) - 0.5) * 0.6;
    return v > 0.1 ? v : null;
  }, 0, 200, W, H);
  sparks(s, 90, [3, 4, 2]);
  // Große Insel rechts, kleine links
  island(s, 300, 640, 250, 110, 3);
  island(s, 40, 230, 290, 60, 4);
  island(s, 470, 590, 150, 30, 5);
  deadTree(s, 380, 250, 70, 2, 11);
  deadTree(s, 520, 250, 90, 2, 12);
  deadTree(s, 120, 290, 50, 1, 13);
  deadTree(s, 540, 150, 40, 3, 14);
  // Glühende Kreuze in der Ferne
  for (const [x, y] of [[160, 80], [250, 150], [600, 60], [80, 200]] as const) {
    for (let k = -3; k <= 3; k++) {
      s.set(x + k, y, 3);
      s.set(x, y + k, 3);
    }
    s.set(x, y, 4);
  }
}

function jungleScene(s: Scene): void {
  sparks(s, 60, [2, 3, 4], 0, 260);
  // Ruinen-Tempel mit Säulen
  pillar(s, 420, 280, 26, 170, 21);
  pillar(s, 520, 280, 30, 120, 22);
  pillar(s, 460, 140, 70, 26, 23);
  // Leuchtendes Auge
  const ex = 250;
  const ey = 110;
  for (let a = 0; a < 200; a++) {
    const t = (a / 200) * Math.PI * 2;
    s.set(ex + Math.cos(t) * 30, ey + Math.sin(t) * Math.abs(Math.sin(t)) * 14 * Math.sign(Math.sin(t)), 3);
  }
  s.disc(ex, ey, 8, 3);
  s.disc(ex, ey, 4, 0);
  s.set(ex - 2, ey - 2, 4);
  for (const [dx, dy] of [[-44, 0], [44, 0], [0, -22], [0, 22], [-32, -16], [32, -16], [-32, 16], [32, 16]] as const)
    s.line(ex + dx * 0.8, ey + dy * 0.8, ex + dx, ey + dy, 2);
  // Ranken von oben
  for (let k = 0; k < 26; k++) {
    let x = Math.floor(s.rnd() * W);
    const len = 30 + Math.floor(s.rnd() * 110);
    for (let y = 0; y < len; y++) {
      x += Math.round(Math.sin(y / 9 + k) * 0.6);
      s.set(x, y, 1);
      if (y % 7 === 0) {
        s.set(x - 1, y, 2);
        s.set(x + 1, y + 1, 2);
      }
    }
  }
  // Dichtes Gras und Blätter unten
  s.each((x, y) => {
    const n = s.fbm(x / 9, y / 9, 31);
    const top = 262 + Math.sin(x / 13) * 6 + n * 14;
    if (y < top) return null;
    return Math.max(0.3, 2.6 - (y - top) / 30 + (n - 0.5) * 1.4);
  }, 0, 250, W, H);
  for (let k = 0; k < 220; k++) {
    const x = Math.floor(s.rnd() * W);
    const y = 250 + Math.floor(s.rnd() * 30);
    const h = 3 + Math.floor(s.rnd() * 8);
    for (let i = 0; i < h; i++) s.set(x + (i % 3 === 0 ? 1 : 0), y + i, i < 2 ? 4 : 3);
  }
}

function nightfallScene(s: Scene): void {
  sparks(s, 110, [2, 3, 4]);
  // Mond
  s.each((x, y) => {
    const d = Math.hypot(x - 420, y - 78);
    if (d > 34) return null;
    const crater = s.fbm(x / 8, y / 8, 41) > 0.62 ? -0.8 : 0;
    return 2.6 + (1 - d / 34) * 0.9 + crater;
  }, 380, 40, 460, 118);
  // Insel mit Friedhof und Mauerruinen
  island(s, 80, 600, 240, 90, 42);
  pillar(s, 110, 240, 34, 110, 43);
  pillar(s, 470, 240, 40, 150, 44);
  pillar(s, 540, 240, 28, 90, 45);
  for (const x of [190, 220, 260, 300, 350]) {
    const h = 10 + ((x * 7) % 6);
    s.rect(x, 240 - h, 8, h, 2);
    s.rect(x + 1, 240 - h - 1, 6, 1, 2);
    s.rect(x + 3, 240 - h + 2, 2, 5, 1);
    s.rect(x + 1, 240 - h + 3, 6, 1, 1);
  }
  // Nebelschleier unter der Insel
  s.each((x, y) => {
    const n = s.fbm(x / 30, y / 12, 47);
    return n > 0.6 && (x + y) % 2 === 0 ? 1 : null;
  }, 0, 300, W, H);
}

function circuitScene(s: Scene): void {
  // Platinen-Leiterbahnen im rechten Winkel
  const r = fixedRng(61);
  for (let k = 0; k < 70; k++) {
    let x = Math.floor(r() * W);
    let y = Math.floor(r() * H);
    const c = r() < 0.25 ? 2 : 1;
    let dir = Math.floor(r() * 4);
    for (let seg = 0; seg < 6; seg++) {
      const len = 10 + Math.floor(r() * 50);
      for (let i = 0; i < len; i++) {
        x += dir === 0 ? 1 : dir === 2 ? -1 : 0;
        y += dir === 1 ? 1 : dir === 3 ? -1 : 0;
        s.set(x, y, c);
        s.set(x + (dir % 2 === 1 ? 1 : 0), y + (dir % 2 === 0 ? 1 : 0), c);
      }
      dir = (dir + (r() < 0.5 ? 1 : 3)) % 4;
    }
    s.rect(x - 2, y - 2, 5, 5, 3);
    s.rect(x - 1, y - 1, 3, 3, 0);
  }
  // Großer Chip
  const cx = 470;
  const cy = 190;
  for (let i = -44; i <= 44; i += 8) {
    s.rect(cx + i, cy - 56, 2, 10, 2);
    s.rect(cx + i, cy + 47, 2, 10, 2);
    s.rect(cx - 56, cy + i, 10, 2, 2);
    s.rect(cx + 47, cy + i, 10, 2, 2);
  }
  s.each((x, y) => 1 + (1 - Math.max(Math.abs(x - cx), Math.abs(y - cy)) / 46) * 1.4, cx - 46, cy - 46, cx + 47, cy + 47);
  s.rect(cx - 46, cy - 46, 93, 1, 4);
  s.rect(cx - 46, cy - 46, 1, 93, 3);
  s.rect(cx - 16, cy - 16, 33, 33, 0);
  s.rect(cx - 12, cy - 12, 25, 25, 3);
  s.rect(cx - 8, cy - 8, 17, 17, 4);
  // Leuchtpulse auf den Bahnen
  sparks(s, 50, [3, 4]);
}

// --- Animation: blinkende Funken ------------------------------------------------------

function twinkle(seed: number, n: number): (s: Scene, f: number) => void {
  return (s, f) => {
    const r = fixedRng(seed);
    for (let i = 0; i < n; i++) {
      const x = Math.floor(r() * W);
      const y = Math.floor(r() * H);
      const k = (f + Math.floor(r() * 6)) % 6;
      if (k === 0) {
        s.set(x, y, 4);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) s.set(x + dx, y + dy, 3);
      } else if (k === 1) s.set(x, y, 3);
    }
  };
}

// --- Neue Welt-Szenen ------------------------------------------------------------------

function oceanScene(s: Scene): void {
  sparks(s, 90, [2, 3, 4], 0, 200);
  // Mond
  s.each((x, y) => {
    const d = Math.hypot(x - 430, y - 90);
    return d > 30 ? null : 3 + (1 - d / 30) * 0.9 - (s.fbm(x / 7, y / 7, 81) > 0.63 ? 0.7 : 0);
  }, 400, 60, 461, 121);
  // Meer mit Wellen und Mondspiegelung
  s.each((x, y) => {
    const wave = Math.sin(x / 11 + y * 0.9) * 0.5 + Math.sin(x / 29 - y * 0.3) * 0.4;
    const glint = Math.abs(x - 430) < 6 + (y - 200) * 0.12 && (y + Math.floor(x / 3)) % 4 === 0 ? 2.2 : 0;
    return Math.min(4, 0.8 + (y - 200) / 160 + wave * 0.35 + glint);
  }, 0, 200, W, H);
  for (let y = 204; y < H; y += 7)
    for (let k = 0; k < 6; k++) {
      const x = Math.floor(s.rnd() * W);
      s.line(x, y, x + 6 + Math.floor(s.rnd() * 10), y, 3);
    }
  // Felsnadeln
  for (const [x, w, h] of [[70, 40, 150], [130, 26, 90], [560, 50, 170]] as const) {
    s.each((px, py) => {
      const top = 210 - h + Math.abs(px - x - w / 2) * 1.8 + s.fbm(px / 6, py / 6, 83) * 12;
      if (py < top) return null;
      return px < x + w / 2 ? 1.6 : 0.9;
    }, x, 210 - h, x + w, 214);
  }
  // Korallen am Ufer
  for (let k = 0; k < 40; k++) {
    const x = 40 + Math.floor(s.rnd() * 560);
    const h = 4 + Math.floor(s.rnd() * 10);
    for (let i = 0; i < h; i++) s.set(x + Math.round(Math.sin(i / 2)), 212 - i, i % 3 === 0 ? 4 : 3);
  }
}

function sunScene(s: Scene): void {
  // Morgenhimmel, Sonnenscheibe mit Strahlen
  s.each((x, y) => 0.4 + (1 - y / 260) * 1.6, 0, 0, W, 260);
  const cx = 420;
  const cy = 170;
  s.each((x, y) => {
    const d = Math.hypot(x - cx, y - cy);
    const ang = Math.atan2(y - cy, x - cx);
    if (d < 46) return d > 43 ? 4 : 3.2 + (1 - d / 46) * 0.8;
    const ray = Math.cos(ang * 12) > 0.75 && d < 170 ? 1.3 * (1 - d / 170) : 0;
    return ray > 0.05 ? Math.min(4, 1.6 + ray + (1 - d / 170) * 0.6) : null;
  }, cx - 170, 0, cx + 170, 260);
  // Tempel mit Säulen, Giebel und Bannern
  s.rect(250, 250, 340, 12, 3);
  s.rect(240, 262, 360, 8, 2);
  for (let k = 0; k < 7; k++) {
    const x = 262 + k * 48;
    s.each((px) => (px - x < 3 ? 3.6 : px - x > 12 ? 1.6 : 2.6), x, 150, x + 16, 250);
    s.rect(x - 3, 146, 22, 5, 3);
  }
  for (let i = 0; i < 40; i++) s.rect(250 + i * 8.5, 140 - Math.min(i, 40 - i) * 1.6, 9, 6, i % 2 ? 3 : 2);
  for (const bx of [300, 540]) {
    s.rect(bx, 160, 18, 44, 3);
    s.rect(bx + 5, 170, 8, 8, 4);
    for (let i = 0; i < 6; i++) s.set(bx + i * 3, 204 + (i % 2), 3);
  }
  // Boden
  s.each((x, y) => 1 + s.fbm(x / 20, y / 8, 91) * 0.8, 0, 270, W, H);
}

function forgeScene(s: Scene): void {
  // Bergmassiv
  for (let x = 0; x < W; x++) {
    const top = Math.floor(120 - s.fbm(x / 80, 0.5, 101, 5) * 110 + Math.abs(x - 320) * 0.08);
    for (let y = top; y < H; y++) s.shade(x, y, 1 + Math.max(0, 1 - (y - top) / 60) * 0.8 + (x % 23 === 0 ? -0.3 : 0));
  }
  // Tor in den Berg mit leuchtenden Runen
  s.each((x, y) => {
    const d = Math.hypot((x - 420) / 70, (y - 300) / 150);
    return d < 1 ? (d > 0.9 ? 3 : 0.3) : null;
  }, 350, 150, 491, H);
  for (let k = 0; k < 8; k++) {
    const x = 382 + k * 10;
    s.rect(x, 190, 3, 5, 4);
    s.set(x + 1, 196, 3);
  }
  // Zahnräder
  const gear = (gx: number, gy: number, r: number, v: number) => {
    s.each((x, y) => {
      const d = Math.hypot(x - gx, y - gy);
      const ang = Math.atan2(y - gy, x - gx);
      const tooth = Math.cos(ang * 10) > 0.3 ? r : r - 5;
      if (d > tooth) return null;
      if (d < r * 0.35) return d < r * 0.2 ? 0 : v + 0.8;
      return v + (x < gx ? 0.6 : 0);
    }, gx - r, gy - r, gx + r + 1, gy + r + 1);
  };
  gear(120, 250, 46, 2);
  gear(190, 300, 28, 1.6);
  gear(590, 110, 34, 1.8);
  // Funken der Esse
  sparks(s, 40, [3, 4], 150, H);
}

function roadScene(s: Scene): void {
  s.each((x, y) => 0.5 + (1 - y / 200) * 1.2, 0, 0, W, 200);
  sparks(s, 50, [3, 4], 0, 140);
  // Hügel
  for (let x = 0; x < W; x++) {
    const top = Math.floor(200 - s.fbm(x / 90, 0.3, 111, 4) * 60);
    for (let y = top; y < H; y++) s.shade(x, y, 1.2 + (y - top) / 200 + (s.noise(x / 3, y / 3, 112) - 0.5) * 0.3);
  }
  // Landstraße zum Horizont
  s.each((x, y) => {
    const half = 6 + (y - 200) * 0.45;
    return Math.abs(x - 330 - (y - 200) * 0.3) < half ? 2.4 + (s.noise(x / 2, y / 2, 113) - 0.5) * 0.6 : null;
  }, 0, 200, W, H);
  // Zelte: helle linke, dunkle rechte Seite
  for (const [x, y, w] of [[90, 250, 60], [180, 232, 44], [520, 240, 70]] as const) {
    const h = w * 0.55;
    s.each((px, py) => {
      const dx = px - (x + w / 2);
      if (py < y - h + Math.abs(dx) * 1.1) return null;
      return dx < 0 ? 3 : 2;
    }, x, y - h, x + w + 1, y);
    s.rect(x + w / 2 - 4, y - 14, 8, 14, 0);
    s.line(x + w / 2, y - h - 8, x + w / 2, y - h, 3);
  }
  // Lagerfeuer
  for (let i = 0; i < 12; i++) s.set(420 + (i % 4) - 2, 300 - Math.floor(i / 4) * 3, 4);
  s.rect(412, 302, 16, 3, 1);
}

// --- Designs -------------------------------------------------------------------------------

const world = (
  id: string,
  race: string,
  name: string,
  desc: string,
  colors: string[],
  accents: Record<string, string>,
  scene: (s: Scene) => void,
  seed: number,
): PaletteTheme => ({
  id,
  name,
  desc,
  colors,
  accents: { good: '#5cff7a', bad: '#ff3040', gold: '#ffe23a', gem: '#e23cff', ...accents },
  family: 'crt',
  race,
  scene,
  fx: { frames: 6, duration: 1.2, draw: twinkle(seed, 40) },
});

/** Die 7 Farb-Welten: Hintergrund und Oberfläche in der Boss-Farbe. */
export const WORLD_THEMES: PaletteTheme[] = [
  world('w-ashclan', 'ashclan', 'Ashclan', 'Rote Welt von Gorrak Ashmaw: schwebende Felsen, kahle Bäume, Glut.', ['#0b0002', '#4a000c', '#a1001a', '#ff2438', '#ffd3cc'], { good: '#2ee6b0' }, infernoScene, 71),
  world('w-wildwood', 'wildwood', 'Wildwood', 'Grüne Welt von Sylvara: Tempelruinen, Ranken und ein leuchtendes Auge.', ['#010a02', '#0a3a10', '#1e8a22', '#5cff3a', '#dcffd0'], {}, jungleScene, 72),
  world('w-tidebound', 'tidebound', 'Tidebound', 'Blaue Welt von Königin Nerissa: nächtliches Meer unter dem Mond, Felsnadeln und Korallen.', ['#00040c', '#06214a', '#0f55a8', '#2fb4e8', '#d4f4ff'], { good: '#ffe23a' }, oceanScene, 73),
  world('w-sunlegion', 'sunlegion', 'Sun Legion', 'Goldene Welt von Kaiser Aurelian: Sonnenscheibe mit Strahlen über einem Säulentempel.', ['#0c0700', '#4a2c00', '#a06a00', '#ffc21a', '#fff4c8'], { good: '#5cc8ff' }, sunScene, 74),
  world('w-plague', 'plague', 'Plague Court', 'Violette Welt von Morvath: Friedhof unter fahlem Mond, Ruinen auf einer schwebenden Insel.', ['#07000c', '#300a4a', '#7a1ab0', '#c65cff', '#f2d8ff'], { gem: '#5cff7a' }, nightfallScene, 75),
  world('w-deepforge', 'deepforge', 'Deepforge', 'Graue Welt von Thane Borin: Zwergentor im Berg, Runen, Zahnräder und Funken.', ['#050506', '#26282e', '#5c6068', '#a8adb6', '#f0f2f5'], {}, forgeScene, 76),
  world('w-drifters', 'drifters', 'Drifters', 'Farblose Welt von Rusk dem Banditenkönig: Söldnerlager an der Landstraße.', ['#0a0806', '#3a3128', '#7d6d5a', '#c9b79a', '#f5ecd9'], {}, roadScene, 77),
];

/** Weiteres Monitor-Design ohne eigene Welt. */
export const CRT_PALETTE_THEMES: PaletteTheme[] = [
  {
    id: 'circuit',
    name: 'Circuit',
    desc: 'Neon-Lila Platine: Leiterbahnen, Chip, pulsierende Lichtpunkte. Grün und Gold als Akzent.',
    colors: ['#08000f', '#3b0b5c', '#8e1cd6', '#e64bff', '#ffd6ff'],
    accents: { good: '#6aff5a', bad: '#ff3060', gold: '#ffd23a', gem: '#40e8ff' },
    family: 'crt',
    scene: circuitScene,
    fx: { frames: 6, duration: 1, draw: twinkle(74, 44) },
  },
];

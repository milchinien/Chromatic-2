// Pixel-Bausteine für das UI-Lab: Icons (als SVG, bleiben bei jeder
// Skalierung scharf), Hintergrund-Texturen (Canvas → DataURL) und die
// Kartenbilder in verschiedenen Farbpaletten.

import { buildUnitFrames, visualKindFor } from '../art/sprites';
import { cardById } from '../data/cards';

// --- Icons -------------------------------------------------------------------

const ICONS = {
  heart: ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'],
  coin: ['..###..', '.#####.', '###.###', '###.###', '###.###', '.#####.', '..###..'],
  star: ['...#...', '...#...', '#######', '.#####.', '..###..', '.##.##.', '#.....#'],
  sword: ['......#', '.....##', '....##.', '#..##..', '.###...', '..#....', '.#.#...'],
  swords: ['#.....#', '.#...#.', '..#.#..', '...#...', '..#.#..', '##...##', '##...##'],
  skull: ['.#####.', '#######', '#..#..#', '#######', '.##.##.', '.#####.', '.#.#.#.'],
  chest: ['.######.', '#......#', '########', '#..##..#', '#......#', '#......#', '########'],
  bag: ['..###..', '...#...', '.#####.', '#######', '###.###', '#######', '.#####.'],
  flame: ['...#...', '..##...', '..###.#', '.#####.', '###.###', '##...##', '##...##', '.#####.'],
  gear: ['..#.#..', '.#####.', '##...##', '.#...#.', '##...##', '.#####.', '..#.#..'],
  cards: ['..#####', '..#...#', '#####.#', '#...#.#', '#...###', '#...#..', '#####..'],
  door: ['.####.', '#....#', '#....#', '#...##', '#....#', '#....#', '#....#', '######'],
  play: ['#...', '##..', '###.', '####', '###.', '##..', '#...'],
  horse: ['......##', '.....###', '#######.', '#######.', '.#....#.', '.#....#.'],
  hand: ['........', '.######.', '#......#', '.####..#', '#......#', '.####..#', '...#####'],
  bow: ['.##....', '#..#...', '#...#..', '#....#.', '#...#..', '#..#...', '.##....'],
  staff: ['....##.', '...#..#', '....##.', '...#...', '..#....', '.#.....', '#......'],
  cross: ['..##..', '..##..', '######', '######', '..##..', '..##..', '..##..'],
  tower: ['#.#.#', '#####', '.###.', '.#.#.', '.###.', '.###.', '#####'],
  shield: ['#######', '#.....#', '#.###.#', '#.###.#', '.#...#.', '..#.#..', '...#...'],
  crown: ['#..#..#', '##.#.##', '#######', '#######'],
  refresh: ['.####.', '#....#', '#.....', '#...##', '#....#', '.####.'],
  lock: ['.###.', '#...#', '#...#', '#####', '##.##', '##.##', '#####'],
} as const;

export type IconName = keyof typeof ICONS;

export function icon(name: IconName, cls = ''): string {
  const rows = ICONS[name];
  const h = rows.length;
  const w = rows[0]!.length;
  let d = '';
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === '#') d += `M${x} ${y}h1v1h-1z`;
  });
  return `<svg class="ico ico-${name} ${cls}" style="--w:${w};--h:${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" aria-hidden="true"><path d="${d}" fill="currentColor"/></svg>`;
}

// --- Block-Schrift für das Terminal-Logo ------------------------------------------

const BLOCK: Record<string, string[]> = {
  C: ['.###', '#...', '#...', '#...', '.###'],
  H: ['#..#', '#..#', '####', '#..#', '#..#'],
  R: ['###.', '#..#', '###.', '#.#.', '#..#'],
  O: ['.##.', '#..#', '#..#', '#..#', '.##.'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
  A: ['.##.', '#..#', '####', '#..#', '#..#'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  '2': ['###.', '...#', '.##.', '#...', '####'],
  ' ': ['..', '..', '..', '..', '..'],
};

export function blockText(text: string): string {
  const lines = ['', '', '', '', ''];
  for (const ch of text) {
    const g = BLOCK[ch] ?? BLOCK[' ']!;
    g.forEach((row, i) => (lines[i] += row.replace(/#/g, '█').replace(/\./g, ' ') + ' '));
  }
  return lines.join('\n');
}

// --- Karten-Sprites -------------------------------------------------------------

function spriteCanvas(team: 0 | 1, spriteId = 'warhorse'): HTMLCanvasElement {
  const card = cardById(spriteId);
  const g = buildUnitFrames(visualKindFor(card), card.color, team).walk0;
  const c = document.createElement('canvas');
  c.width = g.w;
  c.height = g.h;
  const ctx = c.getContext('2d')!;
  for (let y = 0; y < g.h; y++)
    for (let x = 0; x < g.w; x++) {
      const col = g.get(x, y);
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 1, 1);
    }
  return c;
}

/** Färbt ein Sprite über die Helligkeit auf eine feste Palette um (dunkel → hell). */
function remap(src: HTMLCanvasElement, palette: readonly string[]): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const rgb = palette.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3]! < 40) {
      d[i + 3] = 0;
      continue;
    }
    const lum = (0.3 * d[i]! + 0.59 * d[i + 1]! + 0.11 * d[i + 2]!) / 255;
    const idx = Math.min(rgb.length - 1, Math.floor(Math.pow(lum, 0.8) * rgb.length * 1.15));
    const [r, g, b] = rgb[idx]!;
    d[i] = r!;
    d[i + 1] = g!;
    d[i + 2] = b!;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export interface Sprites {
  normal: string;
  enemy: string;
  gameboy: string;
  amber: string;
  w: number;
  h: number;
}

/** Ersetzt jede Farbe durch die ähnlichste Farbe der Palette. */
function nearest(src: HTMLCanvasElement, palette: readonly string[]): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const rgb = palette.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3]! < 40) {
      d[i + 3] = 0;
      continue;
    }
    let best = rgb[0]!;
    let bestD = Infinity;
    for (const p of rgb) {
      // gewichteter Abstand, ähnlich der Wahrnehmung
      const dist = 3 * (p[0] - d[i]!) ** 2 + 4 * (p[1] - d[i + 1]!) ** 2 + 2 * (p[2] - d[i + 2]!) ** 2;
      if (dist < bestD) {
        bestD = dist;
        best = p;
      }
    }
    [d[i], d[i + 1], d[i + 2]] = best;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

const paletteSprites = new Map<string, string>();

/**
 * Kartenbild in einer Palette. 'ramp': über die Helligkeit auf die Farben
 * (dunkel → hell sortiert); 'nearest': jeweils die ähnlichste Palettenfarbe.
 */
export function spriteInPalette(
  pal: readonly string[],
  mode: 'ramp' | 'nearest' | 'normal' = 'ramp',
  spriteId = 'warhorse',
  team: 0 | 1 = 0,
): string {
  const key = `${mode}|${spriteId}|${team}|${pal.join()}`;
  let url = paletteSprites.get(key);
  if (!url) {
    const src = spriteCanvas(team, spriteId);
    url = (mode === 'ramp' ? remap(src, pal) : mode === 'nearest' ? nearest(src, pal) : src).toDataURL();
    paletteSprites.set(key, url);
  }
  return url;
}

/** Größe eines Sprites in Pixeln. */
export function spriteSize(spriteId: string): [number, number] {
  const c = spriteCanvas(0, spriteId);
  return [c.width, c.height];
}

export function buildSprites(): Sprites {
  const base = spriteCanvas(0);
  return {
    normal: base.toDataURL(),
    enemy: spriteCanvas(1).toDataURL(),
    gameboy: remap(base, ['#0f380f', '#306230', '#8bac0f', '#9bbc0f']).toDataURL(),
    amber: remap(base, ['#3a2400', '#8a5a00', '#ffb000', '#ffd98a']).toDataURL(),
    w: base.width,
    h: base.height,
  };
}

// --- Texturen ------------------------------------------------------------------------

let seed = 12345;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

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

function wood(): string {
  const [c, ctx] = canvas(96, 48);
  const tones = ['#6b4226', '#5f3a21', '#734829', '#65402a'];
  for (let row = 0; row < 4; row++) {
    const y0 = row * 12;
    px(ctx, 0, y0, tones[row]!, 96, 12);
    for (let i = 0; i < 26; i++) px(ctx, Math.floor(rnd() * 96), y0 + 1 + Math.floor(rnd() * 10), '#4e2f1a', 2 + Math.floor(rnd() * 8), 1);
    for (let i = 0; i < 10; i++) px(ctx, Math.floor(rnd() * 96), y0 + 1 + Math.floor(rnd() * 10), '#80532f', 2 + Math.floor(rnd() * 5), 1);
    px(ctx, 0, y0, '#8a5a35', 96, 1);
    px(ctx, 0, y0 + 11, '#2e1a0d', 96, 1);
    const seam = (row * 37) % 96;
    px(ctx, seam, y0, '#2e1a0d', 1, 12);
    px(ctx, (seam + 2) % 96, y0 + 3, '#c9a27a');
    px(ctx, (seam + 2) % 96, y0 + 8, '#c9a27a');
  }
  return c.toDataURL();
}

function bricks(): string {
  const [c, ctx] = canvas(32, 16);
  px(ctx, 0, 0, '#0c0b0e', 32, 16);
  const brick = (x: number, y: number, w: number) => {
    const base = ['#2a282e', '#26242a', '#2e2b33'][Math.floor(rnd() * 3)]!;
    px(ctx, x, y, base, w, 7);
    px(ctx, x, y, '#38353e', w, 1);
    px(ctx, x, y + 6, '#1a181d', w, 1);
    for (let i = 0; i < 5; i++) px(ctx, x + Math.floor(rnd() * w), y + 1 + Math.floor(rnd() * 5), '#1f1d23');
  };
  brick(0, 0, 15);
  brick(16, 0, 15);
  brick(-8, 8, 15);
  brick(8, 8, 15);
  brick(24, 8, 15);
  return c.toDataURL();
}

function stars(): string {
  const [c, ctx] = canvas(160, 120);
  px(ctx, 0, 0, '#000000', 160, 120);
  const cols = ['#ffffff', '#9fb4ff', '#ffe08a', '#6a6a8a'];
  for (let i = 0; i < 70; i++) px(ctx, Math.floor(rnd() * 160), Math.floor(rnd() * 120), cols[Math.floor(rnd() * cols.length)]!);
  for (let i = 0; i < 4; i++) {
    const x = Math.floor(rnd() * 150) + 5;
    const y = Math.floor(rnd() * 110) + 5;
    px(ctx, x - 1, y, '#8899cc', 3, 1);
    px(ctx, x, y - 1, '#8899cc', 1, 3);
    px(ctx, x, y, '#ffffff');
  }
  return c.toDataURL();
}

function glass(): string {
  const [c, ctx] = canvas(128, 128);
  px(ctx, 0, 0, '#0b0910', 128, 128);
  const cols = ['#5a1420', '#1d4a24', '#16305e', '#6a5214', '#3c1a5a', '#2a2e36', '#4a1e3a'];
  const split = (x: number, y: number, w: number, h: number, depth: number) => {
    if (depth > 4 || (w < 20 && h < 20) || (depth > 2 && rnd() < 0.25)) {
      const col = cols[Math.floor(rnd() * cols.length)]!;
      px(ctx, x + 1, y + 1, col, w - 1, h - 1);
      px(ctx, x + 2, y + 2, 'rgba(255,255,255,0.12)', Math.max(1, w - 5), 1);
      px(ctx, x + 2, y + 2, 'rgba(255,255,255,0.12)', 1, Math.max(1, h - 5));
      return;
    }
    if (w > h) {
      const s = Math.floor(w * (0.35 + rnd() * 0.3));
      split(x, y, s, h, depth + 1);
      split(x + s, y, w - s, h, depth + 1);
    } else {
      const s = Math.floor(h * (0.35 + rnd() * 0.3));
      split(x, y, w, s, depth + 1);
      split(x, y + s, w, h - s, depth + 1);
    }
  };
  split(0, 0, 128, 128, 0);
  return c.toDataURL();
}

function clouds(): string {
  const [c, ctx] = canvas(200, 70);
  const blob = (cx: number, cy: number, r: number) => {
    for (let y = -r; y <= r; y++)
      for (let x = -r * 2; x <= r * 2; x++) {
        if ((x * x) / 4 + y * y > r * r) continue;
        px(ctx, cx + x, cy + y, y > r * 0.35 ? '#d7ecff' : '#ffffff');
      }
  };
  blob(40, 22, 7);
  blob(52, 18, 9);
  blob(64, 23, 6);
  blob(140, 48, 6);
  blob(152, 45, 8);
  return c.toDataURL();
}

function synth(): string {
  const W = 640;
  const H = 360;
  const [c, ctx] = canvas(W, H);
  const horizon = 214;
  const sky = ['#0d0221', '#170433', '#240747', '#34095a', '#4a0c6b', '#65107a'];
  sky.forEach((col, i) => px(ctx, 0, Math.floor((horizon / sky.length) * i), col, W, Math.ceil(horizon / sky.length)));
  for (let i = 0; i < 50; i++) px(ctx, Math.floor(rnd() * W), Math.floor(rnd() * 150), rnd() < 0.3 ? '#ff9de6' : '#c8b8ff');
  // Sonne mit Streifen
  const sx = 320;
  const sy = 180;
  const r = 62;
  const sunCols = ['#ffe25c', '#ffc24a', '#ff9a45', '#ff6f5a', '#ff4d8a', '#e8339c'];
  for (let y = -r; y <= 0; y++) {
    const band = Math.floor(((y + r) / r) * sunCols.length);
    const gap = y > -r * 0.55 && ((y + 200) % 8 < Math.floor((y + r) / 14));
    if (gap) continue;
    const half = Math.floor(Math.sqrt(r * r - y * y));
    px(ctx, sx - half, sy + y, sunCols[Math.min(band, sunCols.length - 1)]!, half * 2, 1);
  }
  // Berge
  for (let x = 0; x < W; x++) {
    const hgt = Math.floor(14 + Math.abs(Math.sin(x * 0.021) * 22) + Math.abs(Math.sin(x * 0.053) * 10));
    px(ctx, x, horizon - hgt, '#1a0630', 1, hgt);
    px(ctx, x, horizon - hgt, '#7a2a9a');
  }
  // Boden mit Gitter
  px(ctx, 0, horizon, '#12011f', W, H - horizon);
  let y = horizon;
  let step = 3;
  while (y < H) {
    px(ctx, 0, Math.floor(y), '#ff2bd6', W, 1);
    y += step;
    step *= 1.28;
  }
  for (let i = -24; i <= 24; i++) {
    const x1 = sx + i * 60;
    const steps = H - horizon;
    for (let t = 0; t <= steps; t++) {
      const x = Math.round(sx + ((x1 - sx) * t) / steps);
      px(ctx, x, horizon + t, '#b01a9a');
    }
  }
  px(ctx, 0, horizon, '#ff7af0', W, 1);
  return c.toDataURL();
}

function dither(a: string, b: string): string {
  const [c, ctx] = canvas(2, 2);
  px(ctx, 0, 0, a, 2, 2);
  px(ctx, 1, 0, b);
  px(ctx, 0, 1, b);
  return c.toDataURL();
}

export function installTextures(root: HTMLElement): void {
  const tx: Record<string, string> = {
    wood: wood(),
    bricks: bricks(),
    stars: stars(),
    glass: glass(),
    clouds: clouds(),
    synth: synth(),
    'gb-dither': dither('#8bac0f', '#9bbc0f'),
    'gb-dither-dark': dither('#306230', '#0f380f'),
  };
  for (const [k, v] of Object.entries(tx)) root.style.setProperty(`--tx-${k}`, `url(${v})`);
}

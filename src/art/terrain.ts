import { BASE_DEPTH, FIELD_H, FIELD_W } from '../sim/battle';
import { INK, PixelGrid, shade } from './pixel';
import { TEAM_COLORS } from './sprites';

// =====================================================================
// Prozedurale Pixel-Landschaft: Graswiese mit Erdflecken, Blumen, Steinen
// und einem Waldrand um das Schlachtfeld. Dazu die Burgmauern (Basen).
// =====================================================================

export const GROUND_W = 1920;
export const GROUND_H = 1200;
export const FIELD_OX = Math.floor((GROUND_W - FIELD_W) / 2);
export const FIELD_OY = Math.floor((GROUND_H - FIELD_H) / 2);

function hash(x: number, y: number, s: number): number {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(x: number, y: number, s: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s);
  const b = hash(xi + 1, yi, s);
  const c = hash(xi, yi + 1, s);
  const d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x: number, y: number, s: number): number {
  return valueNoise(x, y, s) * 0.55 + valueNoise(x * 2.1, y * 2.1, s + 1) * 0.3 + valueNoise(x * 4.3, y * 4.3, s + 2) * 0.15;
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

const GRASS = ['#35722a', '#418330', '#4d9437', '#5aa23f', '#6bb24a'];
const DIRT = ['#6f5335', '#80613e', '#927048', '#a28055'];

function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function buildGround(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = GROUND_W;
  c.height = GROUND_H;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(GROUND_W, GROUND_H);
  const grass = GRASS.map(hexToRgb);
  const dirt = DIRT.map(hexToRgb);
  const d = img.data;
  for (let y = 0; y < GROUND_H; y++) {
    for (let x = 0; x < GROUND_W; x++) {
      const fx = x - FIELD_OX;
      const fy = y - FIELD_OY;
      const inField = fx >= 0 && fx < FIELD_W && fy >= 0 && fy < FIELD_H;
      const dither = (BAYER[(y & 3) * 4 + (x & 3)]! / 16 - 0.5) * 0.14;
      const n = fbm(x / 70, y / 70, 1) + dither;
      // Erdflecken: im Feld häufiger (zertrampelt), mittig am meisten
      const mid = inField ? 1 - Math.abs(fy / FIELD_H - 0.5) * 1.4 : 0;
      const dn = fbm(x / 34, y / 34, 7) + mid * 0.06 + (inField ? 0 : -0.1) + dither * 0.6;
      let col: [number, number, number];
      if (dn > 0.72) {
        const k = Math.min(dirt.length - 1, Math.max(0, Math.floor((dn - 0.72) * 16 + fbm(x / 9, y / 9, 3) * 2)));
        col = dirt[k]!;
      } else {
        const k = Math.min(grass.length - 1, Math.max(0, Math.floor(n * grass.length * 1.05 - 0.4)));
        col = grass[k]!;
      }
      const o = (y * GROUND_W + x) * 4;
      d[o] = col[0];
      d[o + 1] = col[1];
      d[o + 2] = col[2];
      d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Details: Grasbüschel, Blumen, Steinchen
  const flowers = ['#f4f0e6', '#ffd54a', '#ff8fb1', '#9fd4ff'];
  for (let i = 0; i < 9000; i++) {
    const x = Math.floor(hash(i, 1, 11) * GROUND_W);
    const y = Math.floor(hash(i, 2, 11) * GROUND_H);
    const r = hash(i, 3, 11);
    const o = (y * GROUND_W + x) * 4;
    const isDirt = d[o]! > d[o + 1]!;
    if (r < 0.62) {
      ctx.fillStyle = isDirt ? '#5e452b' : '#2d6424';
      ctx.fillRect(x, y, 1, 2);
      if (!isDirt && r < 0.3) ctx.fillRect(x + 1, y + 1, 1, 1);
      ctx.fillStyle = isDirt ? '#a8875c' : '#7cc052';
      ctx.fillRect(x, y - 1, 1, 1);
    } else if (r < 0.8 && !isDirt) {
      ctx.fillStyle = flowers[Math.floor(hash(i, 4, 11) * flowers.length)]!;
      ctx.fillRect(x, y, 1, 1);
    } else if (r < 0.84) {
      ctx.fillStyle = '#8b8f96';
      ctx.fillRect(x, y, 2, 1);
      ctx.fillStyle = '#5b5f68';
      ctx.fillRect(x, y + 1, 2, 1);
    }
  }

  // Waldrand rund um das Feld
  const trees: { x: number; y: number; g: PixelGrid }[] = [];
  const treeGrids = [makeTree(0), makeTree(1), makeTree(2), makePine(0), makePine(1), makeBush()];
  for (let i = 0; i < 9000; i++) {
    const x = Math.floor(hash(i, 5, 21) * GROUND_W);
    const y = Math.floor(hash(i, 6, 21) * GROUND_H);
    const fx = x - FIELD_OX;
    const fy = y - FIELD_OY;
    // Abstand zum Feld (inkl. Platz für die Burgmauern links/rechts)
    const dx = fx < -40 ? -40 - fx : fx > FIELD_W + 40 ? fx - FIELD_W - 40 : 0;
    const dy = fy < -6 ? -6 - fy : fy > FIELD_H + 28 ? fy - FIELD_H - 28 : 0;
    if (dx === 0 && dy === 0) continue;
    const dist = Math.max(dx, dy);
    const dens = Math.min(1, dist / 36) * 0.95;
    if (hash(i, 7, 21) > dens) continue;
    const g = treeGrids[Math.floor(hash(i, 8, 21) * (dist < 20 ? treeGrids.length : treeGrids.length - 1))]!;
    trees.push({ x, y, g });
  }
  trees.sort((a, b) => a.y - b.y);
  for (const t of trees) {
    // Schatten
    ctx.fillStyle = 'rgba(12,30,10,0.35)';
    ctx.fillRect(t.x - Math.floor(t.g.w / 2) + 2, t.y - 1, t.g.w - 3, 2);
    t.g.draw(ctx, t.x - Math.floor(t.g.w / 2), t.y - t.g.h + 1);
  }
  return c;
}

function makeTree(v: number): PixelGrid {
  const base = ['#2f6b28', '#3a7a2c', '#2b5f2e'][v]!;
  const g = new PixelGrid(13, 16);
  g.rect(5, 11, 3, 4, '#6a4527').set(5, 11, '#4a2f1b');
  const blob: [number, number, number][] = [[6, 6, 5.2], [3.5, 8, 3.3], [9, 8, 3.3], [6, 3.5, 3.4]];
  for (let y = 0; y < 13; y++)
    for (let x = 0; x < 13; x++)
      for (const [cx, cy, r] of blob)
        if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) {
          const light = x + y < cx + cy - 1;
          g.set(x, y, light ? shade(base, 1.25) : y > cy + 1 ? shade(base, 0.75) : base);
        }
  g.dots(shade(base, 1.45), [[4, 3], [5, 2], [3, 6], [7, 4]]);
  return g.pad(1).outline(INK);
}

function makePine(v: number): PixelGrid {
  const base = ['#22553a', '#2a6344'][v]!;
  const g = new PixelGrid(11, 17);
  g.rect(5, 13, 1, 3, '#5a3a22');
  for (let y = 0; y < 14; y++) {
    const w = Math.floor(((y % 5) + 1 + y / 3) * 0.9);
    for (let x = 5 - w; x <= 5 + w; x++) g.set(x, y, x < 5 ? shade(base, 1.2) : x > 5 + w - 2 ? shade(base, 0.8) : base);
  }
  return g.pad(1).outline(INK);
}

function makeBush(): PixelGrid {
  const g = new PixelGrid(8, 6);
  for (let y = 0; y < 6; y++)
    for (let x = 0; x < 8; x++) if ((x - 3.5) ** 2 / 16 + (y - 3.2) ** 2 / 8 < 1) g.set(x, y, y < 3 ? '#57a03b' : '#3f7f2f');
  g.dots('#ff8fb1', [[2, 2], [5, 1]]);
  return g.pad(1).outline(INK);
}

// --- Burgmauer (Basis) ---------------------------------------------------------

export const BASE_CANVAS_W = 48;
export const BASE_PAD_Y = 40;

/** Mauer für Team 0 (links). Für Team 1 wird gespiegelt. */
export function buildBase(team: 0 | 1): HTMLCanvasElement {
  const H = FIELD_H + BASE_PAD_Y * 2;
  const g = new PixelGrid(BASE_CANVAS_W, H);
  const st = '#8f8d99';
  const stD = '#5f5d6b';
  const stL = '#b8b6c2';
  const { T, TD } = TEAM_COLORS[team];
  // Mauerkrone (Draufsicht) x 6..17, Vorderseite 18..21
  const wx0 = 6;
  const wx1 = BASE_DEPTH - 6;
  for (let y = 0; y < H; y++) {
    for (let x = wx0; x <= wx1; x++) {
      const brick = ((Math.floor(y / 4) % 2) * 3 + x) % 6 === 0 || y % 4 === 0;
      g.set(x, y, brick ? stD : (x + y * 3) % 11 === 0 ? stL : st);
    }
    // Zinnen an der Feldseite
    g.set(wx1 + 1, y, y % 6 < 3 ? stL : stD);
    g.set(wx1 + 2, y, y % 6 < 3 ? st : null);
    // Wehrgang
    g.set(wx0 + 4, y, shade(st, 0.9));
  }
  // Türme (3/4-Ansicht): Mauerwerk, Zinnen, spitzes Dach in Teamfarbe
  for (let ty = 30; ty < H + 20; ty += 74) {
    const cx = (wx0 + wx1) >> 1;
    const x0 = cx - 8;
    const w = 17;
    // Turmkörper
    for (let y = ty - 12; y <= ty; y++)
      for (let x = x0; x < x0 + w; x++) {
        const brick = y % 3 === 0 || ((Math.floor(y / 3) % 2) * 2 + x) % 4 === 0;
        g.set(x, y, x < x0 + 3 ? stD : x > x0 + w - 3 ? stL : brick ? stD : st);
      }
    g.rect(cx - 1, ty - 8, 3, 4, INK).set(cx, ty - 7, '#ffd76a');
    // Zinnen
    g.rect(x0 - 1, ty - 15, w + 2, 3, stL).rect(x0 - 1, ty - 13, w + 2, 1, stD);
    for (let x = x0 - 1; x < x0 + w + 1; x += 4) g.rect(x, ty - 17, 2, 2, stL);
    // Dach
    for (let r = 0; r < 12; r++) {
      const half = Math.floor((r * 9) / 12);
      for (let x = -half; x <= half; x++) {
        const col = x < -half / 3 ? shade(T, 1.2) : x > half / 2 ? TD : T;
        g.set(cx + x, ty - 29 + r, col);
      }
    }
    g.rect(cx - 9, ty - 17, 19, 1, TD);
    // Fahne
    g.line(cx, ty - 30, cx, ty - 35, '#5a3a22');
    g.rect(cx + 1, ty - 35, 5, 3, T).set(cx + 5, ty - 33, TD);
  }
  // Banner an der Mauer
  for (let by = 44; by < H - 20; by += 74) {
    g.rect(wx1 + 1, by, 3, 9, T).rect(wx1 + 1, by + 7, 3, 2, TD).set(wx1 + 2, by + 9, TD);
  }
  g.outline(INK);
  const c = document.createElement('canvas');
  c.width = BASE_CANVAS_W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  // Schatten der Mauer fällt aufs Feld
  ctx.fillStyle = 'rgba(10,20,10,0.35)';
  ctx.fillRect(team === 0 ? wx1 + 3 : BASE_CANVAS_W - wx1 - 7, 0, 4, H);
  (team === 0 ? g : g.flipX()).draw(ctx, 0, 0);
  return c;
}

/** Kleines Kachel-Muster (DataURL) für Pixel-Panels der Oberfläche. */
export function panelPattern(base: string, seed: number): string {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 16, 16);
  for (let i = 0; i < 18; i++) {
    const x = Math.floor(hash(i, seed, 3) * 16);
    const y = Math.floor(hash(i, seed, 4) * 16);
    ctx.fillStyle = hash(i, seed, 5) < 0.5 ? shade(base, 1.12) : shade(base, 0.86);
    ctx.fillRect(x, y, 1, 1);
  }
  return c.toDataURL();
}

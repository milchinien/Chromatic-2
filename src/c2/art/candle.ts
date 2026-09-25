// =====================================================================
// Die Chromatic-Kerze fürs Hauptmenü (nach dem Candle-Design aus dem
// UI-Lab): elfenbeinfarbenes Wachs mit Tropfen in allen 7 Farben. Die
// Flamme wechselt nach jedem Flackern in die nächste Farbe.
//
//   candleBack()  – dunkler Grund mit Sternen (640×360)
//   candleBody()  – Kerze + Wachspfütze, transparent (640×360)
//   flameSheet()  – Flamme + kleiner Schein: 4 Flacker-Frames × 7 Farben
//   haloSheet()   – großer Lichtschein je Farbe (7 Frames)
//   sparkleSheet()– funkelnde Glitzer (4 Frames)
// =====================================================================

import { mix } from '../../art/pixel';
import { Scene } from '../../lab/palettes';
import { RACES, RACE_ORDER, type RaceId } from '../data';

const W = 640;
const H = 360;
export const CX = 320;
/** Oberkante des Wachses */
export const WAX_TOP = 196;
const WAX_BOTTOM = 292;

/** Reihenfolge der Flammenfarben (Regenbogen). */
export const FLAME_ORDER: RaceId[] = ['ashclan', 'sunlegion', 'wildwood', 'tidebound', 'plague', 'deepforge', 'drifters'];

export const FLAME = { w: 96, h: 110, frames: 4 };
export const HALO = { w: 360, h: 280 };

const cache = new Map<string, string>();

function sheet(key: string, w: number, h: number, cols: number, rows: number, draw: (ctx: CanvasRenderingContext2D, col: number, row: number) => void): string {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = w * cols;
  c.height = h * rows;
  const ctx = c.getContext('2d')!;
  for (let r = 0; r < rows; r++)
    for (let k = 0; k < cols; k++) {
      ctx.save();
      ctx.translate(k * w, r * h);
      draw(ctx, k, r);
      ctx.restore();
    }
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}

function sceneUrl(key: string, draw: (s: Scene) => void): string {
  return sheet(key, W, H, 1, 1, (ctx) => {
    const s = new Scene(['#000000', '#0b0912', '#141019', '#1e1826', '#2a2234'], 21);
    draw(s);
    ctx.putImageData(s.toImageData(), 0, 0);
  });
}

const px = (ctx: CanvasRenderingContext2D, x: number, y: number, col: string, w = 1, h = 1) => {
  ctx.fillStyle = col;
  ctx.fillRect(x, y, w, h);
};

// --- Hintergrund ------------------------------------------------------------------------

export function candleBack(): string {
  return sceneUrl('c-back', (s) => {
    s.rect(0, 0, W, H, 0);
    // neutrale Vignette, zur Mitte etwas heller
    s.each((x, y) => Math.max(0, 2.2 - Math.hypot(x - CX, (y - 210) * 1.3) / 90));
    // Sterne mit vier Zacken in gedämpften Farben
    const sparkle = (x: number, y: number, len: number, col: string) => {
      for (let i = 1; i <= len; i++) {
        const c = i <= len / 2 ? col : '#3a3346';
        s.set(x + i, y, c);
        s.set(x - i, y, c);
        s.set(x, y + i, c);
        s.set(x, y - i, c);
      }
      s.set(x, y, '#f4ecd9');
    };
    for (let i = 0; i < 30; i++) {
      const x = Math.floor(s.rnd() * W);
      const y = Math.floor(s.rnd() * H);
      if (Math.abs(x - CX) < 70 && y > 90) continue;
      const race = RACE_ORDER[i % RACE_ORDER.length]!;
      sparkle(x, y, 1 + Math.floor(s.rnd() * 4), RACES[race].art[2]);
    }
    s.stars(90, [2, 3, 4]);
  });
}

// --- Kerze -----------------------------------------------------------------------------------

export function candleBody(): string {
  return sheet('c-body', W, H, 1, 1, (ctx) => {
    const ell = (cx: number, cy: number, rx: number, ry: number, col: string) => {
      for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
        for (let x = Math.floor(cx - rx); x <= cx + rx; x++) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) px(ctx, x, y, col);
    };
    // Wachspfütze mit Regenbogen-Rand
    ell(CX, WAX_BOTTOM + 3, 56, 11, '#1e1826');
    FLAME_ORDER.forEach((r, i) => {
      const a0 = (i / 7) * Math.PI * 2;
      for (let a = 0; a < (Math.PI * 2) / 7; a += 0.02) {
        const x = Math.round(CX + Math.cos(a0 + a) * 52);
        const y = Math.round(WAX_BOTTOM + 3 + Math.sin(a0 + a) * 9);
        px(ctx, x, y, RACES[r].art[2], 2, 1);
      }
    });
    ell(CX, WAX_BOTTOM + 2, 44, 8, '#8c8272');
    ell(CX, WAX_BOTTOM + 1, 34, 5, '#bdb29e');
    ell(CX, WAX_BOTTOM, 24, 3, '#e8dfcc');
    // Wachskörper mit Licht von links
    for (let x = CX - 15; x <= CX + 15; x++) {
      const t = (x - (CX - 15)) / 30;
      const col = t < 0.18 ? '#fff8e8' : t < 0.62 ? '#ece2cc' : t < 0.88 ? '#c8bca4' : '#968a74';
      px(ctx, x, WAX_TOP, col, 1, WAX_BOTTOM - WAX_TOP);
    }
    ell(CX, WAX_TOP, 15, 4, '#fff8e8');
    ell(CX, WAX_TOP, 11, 2, '#d8ccb4');
    // Tropfen in den 7 Farben (Regenbogen um den Rand)
    const drips: [number, number][] = [
      [-15, 30],
      [-10, 16],
      [-5, 42],
      [0, 12],
      [5, 24],
      [10, 36],
      [14, 20],
    ];
    drips.forEach(([dx, len], i) => {
      const art = RACES[FLAME_ORDER[i]!].art;
      const x = CX + dx;
      const w = i === 0 || i === 6 ? 2 : 3;
      px(ctx, x, WAX_TOP - 1, art[3], w, len);
      px(ctx, x + w - 1, WAX_TOP + 2, art[2], 1, len - 2);
      px(ctx, x, WAX_TOP + len - 1, art[2], w, 2);
      px(ctx, x, WAX_TOP - 1, mix(art[3], '#ffffff', 0.5), 1, Math.max(2, len - 6));
    });
    // Docht
    px(ctx, CX - 1, WAX_TOP - 14, '#1a1420', 2, 14);
    px(ctx, CX, WAX_TOP - 15, '#3a3040');
  });
}

// --- Flamme (4 Frames × 7 Farben) ---------------------------------------------------------------

export function flameSheet(): string {
  return sheet('c-flame', FLAME.w, FLAME.h, FLAME.frames, FLAME_ORDER.length, (ctx, f, row) => {
    const art = RACES[FLAME_ORDER[row]!].art;
    const outer = art[3];
    const mid = mix(art[3], '#ffffff', 0.45);
    const glowCol = art[2];
    const cx = FLAME.w / 2;
    const base = FLAME.h - 18; // Docht-Oberkante im Frame
    const sway = [0, 1, 0, -1][f]!;
    const top = [8, 11, 6, 10][f]!;
    // kleiner Schein um die Flamme
    const r = 26 + (f % 2) * 3;
    for (let y = 0; y < FLAME.h; y++)
      for (let x = 0; x < FLAME.w; x++) {
        const d = Math.hypot(x - cx - sway, (y - (base - 30)) * 0.8);
        if (d < r && (x + y + f) % 2 === 0) px(ctx, x, y, d < r * 0.6 ? glowCol : art[1]);
      }
    // Flamme
    for (let y = top; y < base; y++) {
      const t = (y - top) / (base - top);
      const w = Math.round(Math.pow(Math.sin(t * Math.PI * 0.92), 1.4) * 9);
      const off = Math.round((1 - t) * sway * 3 + Math.sin(t * 5) * 1.5);
      px(ctx, cx - w + off, y, outer, w * 2 + 1, 1);
      const mw = Math.floor(w * 0.62);
      if (t > 0.2) px(ctx, cx - mw + Math.round(off * 0.7), y, mid, mw * 2 + 1, 1);
      const iw = Math.floor(w * 0.3);
      if (t > 0.4) px(ctx, cx - iw + Math.round(off / 2), y, '#ffffff', iw * 2 + 1, 1);
    }
  });
}

// --- Großer Lichtschein (je Farbe ein Frame) -----------------------------------------------------

export function haloSheet(): string {
  return sheet('c-halo', HALO.w, HALO.h, 1, FLAME_ORDER.length, (ctx, _c, row) => {
    const art = RACES[FLAME_ORDER[row]!].art;
    const cx = HALO.w / 2;
    const cy = 110;
    const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    for (let y = 0; y < HALO.h; y++)
      for (let x = 0; x < HALO.w; x++) {
        const d = Math.hypot(x - cx, (y - cy) * 1.15) / (HALO.w / 2);
        const v = Math.max(0, 1 - d) * 2.2;
        const t = (bayer[(y & 3) * 4 + (x & 3)]! + 0.5) / 16;
        const lvl = Math.floor(v) + (v % 1 > t ? 1 : 0);
        if (lvl <= 0) continue;
        px(ctx, x, y, lvl === 1 ? art[0] : art[1]);
      }
  });
}

// --- Glitzer rund um die Kerze (4 Frames, neutral) -----------------------------------------------

export function sparkleSheet(): string {
  return sheet('c-sparkle', W, H, 4, 1, (ctx, f) => {
    let seed = 77;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 22; i++) {
      const a = r() * Math.PI * 2;
      const d = 56 + r() * 90;
      const x = Math.round(CX + Math.cos(a) * d);
      const y = Math.round(210 + Math.sin(a) * d * 0.7);
      const k = (f + i) % 4;
      if (k === 0) {
        px(ctx, x, y, '#ffffff');
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) px(ctx, x + dx, y + dy, '#b8b0c8');
      } else if (k === 1) px(ctx, x, y, '#d8d0e8');
    }
  });
}

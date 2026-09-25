// Hintergründe der Spielbildschirme (640×360). Wald-Szenen werden nur mit
// den 5 Farben der aktuellen Welt gezeichnet (wie die Arena), Requisiten
// (Truhe, Stand, Magier …) liegen in voller Farbe darüber.

import type { PixelGrid } from '../../art/pixel';
import { Scene, uiRamp, type PaletteTheme } from '../../lab/palettes';
import { RACES, type RaceId } from '../data';
import { chest, goblinStall, mage, pyreProp } from './props';
import { drawRoomScenery } from './roomScenery';
import { roomArtwork, TREASURE_ANCHOR } from './roomArtwork';

const W = 640;
const H = 360;
const cache = new Map<string, string>();

function render(key: string, ramp: readonly string[], draw: (s: Scene) => void, props: { g: PixelGrid; x: number; y: number }[] = []): string {
  const hit = cache.get(key);
  if (hit) return hit;
  const s = new Scene(ramp, 31);
  s.rect(0, 0, W, H, 0);
  draw(s);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.putImageData(s.toImageData(), 0, 0);
  for (const p of props) p.g.draw(ctx, Math.round(p.x - p.g.w / 2), Math.round(p.y - p.g.h));
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}

// --- Wald ------------------------------------------------------------------------------

function treeBlob(s: Scene, cx: number, cy: number, r: number, v: number, seed: number): void {
  s.each(
    (x, y) => {
      const n = s.fbm(x / 7, y / 7, seed, 3);
      const d = Math.hypot(x - cx, (y - cy) * 1.1) / r + (n - 0.5) * 0.6;
      if (d > 1) return null;
      const l = 1 - Math.hypot(x - cx + r * 0.4, y - cy + r * 0.5) / (r * 1.6);
      return Math.max(0.2, v + l * 1.4 + (n - 0.5) * 0.6 - (d > 0.9 ? 0.8 : 0));
    },
    cx - r * 1.4,
    cy - r * 1.4,
    cx + r * 1.4,
    cy + r * 1.4,
  );
}

/** Wald mit Weg: 'fork' = Weg teilt sich, 'clearing' = Lichtung in der Mitte. */
function forest(s: Scene, mode: 'fork' | 'clearing'): void {
  const horizon = 190;
  // Tiefe des Waldes: dunkel mit Lichtschimmer in der Mitte
  s.each((x, y) => {
    const glow = Math.max(0, 1 - Math.hypot((x - 320) / 320, (y - 150) / 170));
    return 0.2 + glow * 1.4 + (s.fbm(x / 40, y / 40, 3) - 0.5) * 0.5;
  }, 0, 0, W, horizon + 20);
  // Ferne Bäume
  for (let k = 0; k < 60; k++) {
    const x = s.rnd() * W;
    treeBlob(s, x, 150 + s.rnd() * 40, 14 + s.rnd() * 14, 0.5, 10 + k);
  }
  // Boden
  s.each((x, y) => {
    const depth = (y - horizon) / (H - horizon);
    return 0.9 + depth * 0.9 + (s.noise(x / 3, y / 3, 5) - 0.5) * 0.35;
  }, 0, horizon, W, H);
  // Weg(e)
  const onPath = (x: number, y: number): boolean => {
    const depth = (y - horizon) / (H - horizon);
    if (mode === 'clearing') {
      const clear = ((x - 320) / 150) ** 2 + ((y - 262) / 46) ** 2 < 1;
      const path = y > 262 && Math.abs(x - 320) < 30 + (y - 262) * 0.9;
      return clear || path;
    }
    const half = 12 + depth * 70;
    if (y > 262) return Math.abs(x - 320) < half;
    // Gabelung: zwei Äste nach links und rechts oben
    const t = (262 - y) / (262 - horizon);
    const bl = 320 - t * 170;
    const br = 320 + t * 170;
    const bw = 10 + depth * 55;
    return Math.abs(x - bl) < bw || Math.abs(x - br) < bw;
  };
  s.each((x, y) => (onPath(x, y) ? 2.2 + (s.noise(x / 2, y / 2, 7) - 0.5) * 0.7 + ((y - horizon) / (H - horizon)) * 0.6 : null), 0, horizon - 6, W, H);
  for (let k = 0; k < 500; k++) {
    const x = Math.floor(s.rnd() * W);
    const y = horizon + Math.floor(s.rnd() * (H - horizon));
    if (onPath(x, y)) {
      s.set(x, y, 3);
      s.set(x + 1, y + 1, 1);
    } else {
      s.set(x, y, 2);
      s.set(x, y + 1, 0);
    }
  }
  // Waldöffnungen am Ende der Wege
  const tunnel = (cx: number, cy: number) =>
    s.each((x, y) => {
      const d = Math.hypot((x - cx) / 34, (y - cy) / 30);
      return d < 1 ? (d < 0.7 ? 0 : 0.5) : null;
    }, cx - 36, cy - 32, cx + 36, cy + 32);
  if (mode === 'fork') {
    tunnel(150, 176);
    tunnel(490, 176);
  }
  // Lichtstrahlen
  s.each((x, y) => {
    const band = (x + y * 0.6) % 130;
    return band < 5 && (x + y) % 3 === 0 && y < horizon + 50 ? 3 : null;
  }, 180, 0, 460, horizon + 60);
  // Große Stämme im Vordergrund
  const trunk = (x0: number, w: number) =>
    s.each((x) => {
      const u = (x - x0) / w;
      return 0.3 + Math.sin(u * Math.PI) * 1.2 + (u < 0.25 ? 0.6 : 0) + ((x * 7) % 5 === 0 ? -0.3 : 0);
    }, x0, 0, x0 + w, H);
  trunk(-8, 46);
  trunk(52, 24);
  trunk(574, 30);
  trunk(612, 40);
  // Laubdach oben
  for (let k = 0; k < 40; k++) treeBlob(s, s.rnd() * W, -10 + s.rnd() * 50, 22 + s.rnd() * 20, 0.6, 80 + k);
  // Glühwürmchen
  for (let k = 0; k < 40; k++) {
    const x = Math.floor(s.rnd() * W);
    const y = 60 + Math.floor(s.rnd() * 240);
    s.set(x, y, 4);
    if (s.rnd() < 0.3) {
      s.set(x - 1, y, 3);
      s.set(x + 1, y, 3);
      s.set(x, y - 1, 3);
      s.set(x, y + 1, 3);
    }
  }
}

// CSS stacks keep the interactive foreground independent of generated scenery.
const raceOf = (t: PaletteTheme) => (t.race as RaceId) ?? 'drifters';
export const forkBg = (t: PaletteTheme, boss = false) =>
  `${roomArtwork(raceOf(t), boss ? 'boss' : 'fork')}, url("${render(`fork|${t.id}|${boss}`, uiRamp(t), (s) => drawRoomScenery(s, 'fork', raceOf(t), boss))}")`;

export const treasureBg = (t: PaletteTheme, open: boolean) =>
  `${roomArtwork(raceOf(t), 'treasure', [{ g: chest(open), ...TREASURE_ANCHOR[raceOf(t)] }], String(open))}, url("${render(`treasure|${t.id}`, uiRamp(t), (s) => drawRoomScenery(s, 'treasure', raceOf(t)))}")`;

export const shopBg = (t: PaletteTheme) =>
  `${roomArtwork(raceOf(t), 'shop', [{ g: goblinStall(), x: 250, y: 282 }])}, url("${render(`shop|${t.id}`, uiRamp(t), (s) => drawRoomScenery(s, 'shop', raceOf(t)))}")`;

export const enchantBg = (t: PaletteTheme, race: RaceId) =>
  `${roomArtwork(race, 'enchant', [{ g: mage(RACES[race].unit), x: 150, y: 330 }])}, url("${render(`enchant|${t.id}|${race}`, uiRamp(t), (s) => drawRoomScenery(s, 'enchant', race))}")`;

export const pyreBg = (t: PaletteTheme, race: RaceId) =>
  `${roomArtwork(race, 'pyre', [{ g: pyreProp(race), x: 320, y: 300 }])}, url("${render(`pyre|${t.id}|${race}`, uiRamp(t), (s) => drawRoomScenery(s, 'pyre', race))}")`;

export const clearingBg = (t: PaletteTheme) => render(`clearing|${t.id}`, uiRamp(t), (s) => forest(s, 'clearing'));

// --- Weltkarte -----------------------------------------------------------------------------

const MAP_RAMP = ['#030306', '#0b0a12', '#15131f', '#262233', '#3c364c'];

export function mapBg(): string {
  return render('map', MAP_RAMP, (s) => {
    // Pergament mit Flecken und Rand
    s.each((x, y) => {
      const edge = Math.min(x, W - x, y, H - y) / 40;
      const n = s.fbm(x / 50, y / 50, 3);
      return Math.min(4, 0.4 + Math.min(1, edge) * 1.2 + (n - 0.5) * 1.2);
    });
    // Gebirge, Wälder, Wellen als Kartenzeichen
    for (let k = 0; k < 40; k++) {
      const x = 40 + Math.floor(s.rnd() * 560);
      const y = 40 + Math.floor(s.rnd() * 280);
      if (s.rnd() < 0.5) {
        for (let i = 0; i < 7; i++) {
          s.set(x - i, y + i, 3);
          s.set(x + i, y + i, 3);
        }
      } else {
        s.disc(x, y, 3, 3);
        s.set(x, y + 4, 2);
        s.set(x, y + 5, 2);
      }
    }
    // Windrose
    for (let i = -14; i <= 14; i++) {
      s.set(580 + i, 300, 1);
      s.set(580, 300 + i, 1);
    }
    s.disc(580, 300, 3, 2);
  });
}

// Zweite Runde Paletten-Designs (17–24). Einige Paletten sind groß
// (bis 256 Farben); die Szenen wählen daraus eigene Farbreihen.

import { idleTheme } from './idle';
import { fixedRng, Scene, type PaletteTheme } from './palettes';

const W = 640;
const H = 360;

/** Organischer Farbklecks (Baumkrone, Wolke …), von links oben beleuchtet. */
function blob(s: Scene, cx: number, cy: number, r: number, ramp: readonly string[], seed: number, x0 = 0, x1 = W): void {
  s.use(ramp, () =>
    s.each(
      (x, y) => {
        const n = s.fbm(x / 11, y / 11, seed);
        const d = Math.hypot(x - cx, (y - cy) * 1.1) / r + (n - 0.5) * 0.7;
        if (d > 1) return null;
        const l = 1 - Math.hypot(x - cx + r * 0.45, y - cy + r * 0.5) / (r * 1.6);
        return Math.max(0, Math.min(s.steps, (l * 1.1 + (n - 0.5) * 0.5) * s.steps));
      },
      Math.max(x0, cx - r * 1.4),
      cy - r * 1.4,
      Math.min(x1, cx + r * 1.4),
      cy + r * 1.4,
    ),
  );
}

// --- 17 · Neon Alley ------------------------------------------------------------------

function alleyScene(s: Scene): void {
  s.each((x, y) => (y / 140) * 0.9, 0, 0, W, 140);
  s.stars(30, [2, 4], 80);
  // Hochhäuser dahinter
  let x = 0;
  while (x < W) {
    const w = 30 + Math.floor(s.rnd() * 50);
    const h = 60 + Math.floor(s.rnd() * 70);
    s.rect(x, 140 - h, w, h, 1);
    for (let yy = 144 - h; yy < 134; yy += 6)
      for (let xx = x + 3; xx < x + w - 3; xx += 5) if (s.rnd() < 0.22) s.rect(xx, yy, 2, 2, s.rnd() < 0.15 ? 3 : 2);
    x += w + Math.floor(s.rnd() * 6);
  }
  // Ladenzeile
  const base = 298;
  x = -10;
  let k = 0;
  while (x < W) {
    const w = 96 + Math.floor(s.rnd() * 60);
    const h = 150 + Math.floor(s.rnd() * 40);
    const top = base - h;
    s.rect(x, top, w, h, 1);
    s.rect(x, top, w, 3, 2);
    s.rect(x, top, 1, h, 0);
    // Leuchtschrift oben
    s.rect(x + 8, top + 10, 44, 9, 0);
    for (let i = 0; i < 7; i++) if (s.rnd() < 0.8) s.rect(x + 10 + i * 6, top + 12, 4, 5, i % 3 ? 3 : 4);
    const v = k % 4;
    if (v === 0) {
      s.rect(x + 10, base - 72, w - 20, 52, 3);
      s.rect(x + 10, base - 72, w - 20, 3, 4);
      for (let i = 0; i < 4; i++) s.rect(x + 18 + i * 18, base - 50, 7, 30, 1);
      for (let i = 0; i * 8 < w - 12; i++) s.rect(x + 6 + i * 8, base - 84, 8, 8, i % 2 ? 2 : 3);
    } else if (v === 1) {
      s.rect(x + 12, base - 82, w - 24, 82, 0);
      for (let yy = base - 80; yy < base; yy += 3) s.rect(x + 12, yy, w - 24, 1, 2);
      const cx = x + w / 2;
      const cy = top + 48;
      for (let d = -16; d <= 16; d++) {
        s.set(cx + d, cy - (16 - Math.abs(d)), 4);
        s.set(cx + d, cy + (16 - Math.abs(d)), 4);
      }
      s.rect(cx - 1, cy - 6, 2, 12, 3);
      s.rect(cx - 6, cy - 6, 12, 2, 3);
    } else if (v === 2) {
      for (let i = 0; i < 2; i++) {
        const mx = x + 14 + i * 30;
        s.rect(mx, base - 52, 24, 52, 3);
        s.rect(mx + 3, base - 48, 18, 20, 4);
        for (let j = 0; j < 3; j++) s.rect(mx + 4 + j * 6, base - 24, 3, 3, 1);
      }
      s.rect(x + w - 30, base - 60, 18, 60, 0);
    } else {
      for (let i = 0; i < 3; i++) {
        s.rect(x + 10 + i * ((w - 20) / 3), top + 30, (w - 20) / 3 - 4, 26, 3);
        s.rect(x + 10 + i * ((w - 20) / 3), top + 30, (w - 20) / 3 - 4, 2, 4);
      }
      s.rect(x + w / 2 - 12, base - 50, 24, 50, 0);
      s.rect(x + w / 2 - 12, base - 50, 24, 2, 3);
    }
    // senkrechtes Schild
    if (s.rnd() < 0.5) {
      s.rect(x + w - 10, top + 20, 7, 60, 0);
      for (let i = 0; i < 6; i++) s.rect(x + w - 8, top + 23 + i * 9, 3, 6, 3);
    }
    x += w + (s.rnd() < 0.5 ? 0 : 6);
    k++;
  }
  // Gehweg und nasse Straße mit Spiegelungen
  s.rect(0, base, W, 22, 1);
  s.rect(0, base, W, 1, 2);
  for (let xx = 0; xx < W; xx += 32) s.rect(xx, base + 1, 1, 21, 0);
  s.rect(0, base + 22, W, H - base - 22, 0);
  for (let i = 0; i < 120; i++) {
    const rx = Math.floor(s.rnd() * W);
    const ry = base + 26 + Math.floor(s.rnd() * (H - base - 30));
    s.rect(rx, ry, 4 + Math.floor(s.rnd() * 16), 1, s.rnd() < 0.5 ? 3 : 1);
  }
}

// --- 18 · Rainbow Harbor ------------------------------------------------------------------

function harborScene(s: Scene): void {
  const hz = 172;
  s.use(['#5da9ff', '#7ecff6', '#a7e1fc', '#d6feff'], () => s.each((x, y) => (y / hz) * 3, 0, 0, W, hz));
  // Regenbogen
  const bands = ['#d64642', '#fb7f00', '#f6e742', '#6ba53b', '#38a7df', '#8545b0'];
  for (let y = 0; y < hz; y++)
    for (let x = 60; x < 420; x++) {
      const b = Math.floor((150 - Math.hypot(x - 240, y - 205)) / 5);
      if (b < 0 || b > 5) continue;
      if (y > 130 && (x + y) % 2) continue;
      s.set(x, y, bands[b]!);
    }
  // Wolken
  const cloud = (cx: number, cy: number, r: number, seed: number) =>
    blob(s, cx, cy, r, ['#92b4cf', '#b0cfe5', '#dddee1', '#ffffff', '#ffffff'], seed);
  cloud(90, 70, 46, 3);
  cloud(140, 60, 34, 4);
  cloud(520, 56, 50, 5);
  cloud(580, 80, 38, 6);
  cloud(360, 120, 26, 7);
  // Hügel rechts
  s.use(['#17431d', '#215c1f', '#347423', '#4e8d2b', '#6ba53b', '#acd470'], () => {
    for (let x = 300; x < W; x++) {
      const top = Math.floor(hz - (x - 300) * 0.28 - s.fbm(x / 30, 1, 71) * 26);
      for (let y = top; y < hz + 20; y++) s.shade(x, y, 5 - (y - top) / 12 - s.noise(x / 6, y / 6, 72) * 1.2);
    }
  });
  // Meer
  s.use(['#115785', '#036aa1', '#1993ce', '#38a7df', '#7ecff6'], () =>
    s.each((x, y) => 1 + ((y - hz) / 80) * 2.6 + (s.noise(x / 9, y / 3, 73) - 0.5) * 0.8, 0, hz, W, 262),
  );
  for (let i = 0; i < 90; i++) s.rect(Math.floor(s.rnd() * W), hz + 4 + Math.floor(s.rnd() * 80), 3 + Math.floor(s.rnd() * 7), 1, '#d6feff');
  // Strand
  s.use(['#bb957f', '#d0b472', '#e7cf90', '#f2f0d6'], () =>
    s.each((x, y) => {
      const edge = 258 + Math.sin(x * 0.02) * 6;
      if (y < edge) return null;
      return 1.5 + (s.noise(x / 5, y / 5, 74) - 0.3) * 1.5;
    }, 0, 248, W, 300),
  );
  for (let x = 0; x < W; x++) s.set(x, Math.round(258 + Math.sin(x * 0.02) * 6), '#ffffff');
  // Blumenwiese vorne
  s.use(['#121904', '#17431d', '#215c1f', '#347423', '#4e8d2b', '#6ba53b'], () =>
    s.each((x, y) => (y < 294 + Math.sin(x * 0.03) * 8 ? null : 1 + s.fbm(x / 8, y / 8, 75) * 4.5), 0, 280, W, H),
  );
  const flowers = ['#d64642', '#fb7f00', '#f6e742', '#ffffff', '#f070bb', '#8545b0', '#38a7df', '#cb40a0'];
  for (let i = 0; i < 260; i++) {
    const fx = Math.floor(s.rnd() * W);
    const fy = 300 + Math.floor(s.rnd() * 60);
    const c = flowers[Math.floor(s.rnd() * flowers.length)]!;
    s.set(fx - 1, fy, c);
    s.set(fx + 1, fy, c);
    s.set(fx, fy - 1, c);
    s.set(fx, fy + 1, c);
    s.set(fx, fy, '#f6e742');
  }
  // Schiff
  for (let y = 0; y < 16; y++) s.rect(106 + y, 200 + y, 96 - y * 2, 1, y < 3 ? '#a27d69' : y < 10 ? '#583a2f' : '#40261e');
  s.rect(146, 124, 2, 78, '#40261e');
  s.rect(172, 134, 2, 68, '#40261e');
  for (const [mx, top, h] of [
    [147, 132, 56],
    [173, 142, 48],
  ] as const)
    for (let y = 0; y < h; y++) {
      const bulge = Math.floor(Math.sin((y / h) * Math.PI) * 5);
      s.rect(mx - 16 - bulge, top + y, 32 + bulge, 1, y % 14 === 13 ? '#c0a3a1' : '#f2f0d6');
      s.set(mx + 14, top + y, '#dfdcbf');
    }
  bands.forEach((c, i) => s.rect(148, 120 + i, 12, 1, c));
  // Dorf
  const house = (x: number, y: number, w: number, h: number, roof: string) => {
    s.rect(x, y, w, h, '#f2f0d6');
    s.rect(x + w - 4, y, 4, h, '#dabcb9');
    for (let i = 0; i < w / 2 + 3; i++) s.rect(x - 3 + i, y - i * 0.9, w + 6 - i * 2, 1, i % 4 === 0 ? '#cf7762' : roof);
    for (let i = 0; i < Math.floor(w / 12); i++) s.rect(x + 5 + i * 12, y + 6, 5, 6, '#324c6d');
  };
  s.rect(452, 138, 26, 90, '#a27d69');
  for (let y = 140; y < 226; y += 6) s.rect(452 + ((y / 6) % 2) * 6, y, 8, 1, '#8e7273');
  for (let i = 0; i < 16; i++) s.rect(448 + i, 138 - i, 34 - i * 2, 1, '#7e302e');
  house(486, 204, 44, 26, '#9b443c');
  house(538, 196, 52, 34, '#9b443c');
  house(600, 214, 30, 20, '#b65c4d');
  // Herbstbaum oben rechts
  s.rect(596, 110, 8, 150, '#40261e');
  blob(s, 610, 70, 62, ['#56153e', '#8e0024', '#c42531', '#d15a00', '#fb7f00', '#fac053'], 76);
}

// --- 19 · Backrooms ---------------------------------------------------------------------

const YELLOWS = ['#2c211d', '#362a24', '#46392f', '#544738', '#655842', '#786c4d', '#93885f', '#aaa669', '#c3c07e', '#d3d381', '#e0e0a3', '#e9eac0', '#f3f4de'];

function backroomsScene(s: Scene): void {
  const vx = 430;
  const vy = 196;
  const f = 190;
  const far = 9;
  s.use(YELLOWS, () => {
    s.each((x, y) => {
      const u = (x - vx) / f;
      const v = (y - vy) / f;
      const tS = Math.abs(u) > 1e-4 ? 1 / Math.abs(u) : 1e9;
      const tF = v > 1e-4 ? 0.55 / v : v < -1e-4 ? 0.5 / -v : 1e9;
      const t = Math.min(tS, tF, far);
      let lvl: number;
      if (t === far) {
        lvl = Math.abs(u * far) < 0.32 && v * far > -0.2 ? 4 : 8;
      } else if (t === tS) {
        const hy = v * t;
        lvl = Math.floor(t * 6) % 2 === 0 ? 8.6 : 9.3;
        if (t % 3 > 2.25 && hy > -0.32) lvl = 4.5;
        if (hy > 0.48) lvl = 6;
      } else if (v > 0) {
        lvl = 6.2 + s.fbm(u * t * 6, t * 3, 81) * 1.3;
      } else {
        const cx = u * t;
        lvl = 10.4;
        if (Math.abs(cx) < 0.3 && t % 1.4 < 0.6) lvl = 12.3;
        else if ((t * 2) % 1 < 0.06 || Math.abs((cx * 3) % 1) < 0.07) lvl = 9.2;
      }
      const fog = Math.min(1, t / far) * 0.4;
      lvl = lvl * (1 - fog) + 5.5 * fog;
      if (x < 250) lvl *= 0.25 + (0.75 * (x - 200)) / 50;
      return x < 200 ? null : Math.max(0, lvl);
    });
    // dunkles Panel links mit Schnörkeln
    s.each(
      (x, y) => {
        const w = Math.sin(x * 0.09 + Math.sin(y * 0.05) * 2.2) * Math.cos(y * 0.07 + Math.sin(x * 0.04) * 2);
        return Math.abs(w) < 0.14 ? 2.3 : 0.7 + s.noise(x / 4, y / 4, 82) * 0.6;
      },
      0,
      0,
      200,
      H,
    );
  });
  // schwebender Stuhl
  const c = '#46392f';
  s.rect(468, 110, 18, 3, c);
  s.rect(468, 88, 3, 34, c);
  s.rect(483, 113, 3, 14, c);
  s.rect(471, 113, 3, 12, c);
  s.rect(468, 88, 16, 3, c);
}

// --- 20 · Candle ------------------------------------------------------------------------

function candleScene(s: Scene): void {
  const cx = 320;
  s.use(['#000000', '#240142', '#290573', '#4a1cb8'], () =>
    s.each((x, y) => Math.max(0, 2.7 - Math.hypot(x - cx, (y - 200) * 1.25) / 64)),
  );
  // Sterne mit vier Zacken
  const sparkle = (x: number, y: number, len: number, col: string) => {
    for (let i = 1; i <= len; i++) {
      const c = i <= len / 2 ? '#cf84f0' : col;
      s.set(x + i, y, c);
      s.set(x - i, y, c);
      s.set(x, y + i, c);
      s.set(x, y - i, c);
    }
    s.set(x, y, '#e3b2fc');
  };
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(s.rnd() * W);
    const y = Math.floor(s.rnd() * H);
    if (Math.abs(x - cx) < 60) continue;
    sparkle(x, y, 1 + Math.floor(s.rnd() * 5), s.rnd() < 0.5 ? '#7312fc' : '#a065e3');
  }
  s.stars(60, ['#4a1cb8', '#7312fc']);
  // Wachspfütze
  const ell = (rx: number, ry: number, cy: number, col: string) => {
    for (let y = cy - ry; y <= cy + ry; y++)
      for (let x = cx - rx; x <= cx + rx; x++) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) s.set(x, y, col);
  };
  ell(50, 10, 294, '#4a1cb8');
  ell(40, 7, 293, '#7312fc');
  ell(28, 4, 291, '#a065e3');
  // Kerze
  for (let x = cx - 14; x <= cx + 14; x++) {
    const t = (x - (cx - 14)) / 28;
    const col = t < 0.2 ? '#e3b2fc' : t < 0.68 ? '#cf84f0' : t < 0.92 ? '#a065e3' : '#7312fc';
    s.rect(x, 192, 1, 98, col);
  }
  ell(14, 4, 192, '#e3b2fc');
  s.rect(cx - 16, 194, 4, 22, '#e3b2fc');
  s.rect(cx + 9, 194, 3, 34, '#cf84f0');
  s.rect(cx - 4, 194, 3, 12, '#e3b2fc');
  s.rect(cx - 1, 178, 2, 14, '#240142');
  // Die Flamme selbst ist animiert (candleFx)
}

/** Flackernde Flamme und funkelnde Glitzer um die Kerze. */
function candleFx(s: Scene, f: number): void {
  const cx = 320;
  const sway = [0, 1, 0, -1][f]!;
  const top = [138, 141, 136, 140][f]!;
  // Schein
  const glow = 20 + (f % 2) * 3;
  for (let y = 128; y < 192; y++)
    for (let x = cx - 28; x < cx + 28; x++)
      if (Math.hypot(x - cx - sway, (y - 162) * 0.8) < glow && (x + y + f) % 2 === 0) s.set(x, y, '#4a1cb8');
  for (let y = top; y < 180; y++) {
    const t = (y - top) / (180 - top);
    const w = Math.round(Math.pow(Math.sin(t * Math.PI * 0.92), 1.4) * 8);
    const off = Math.round((1 - t) * sway * 3 + Math.sin(t * 5) * 1.5);
    s.rect(cx - w + off, y, w * 2 + 1, 1, '#fdcd86');
    const iw = Math.floor(w * 0.45);
    if (t > 0.35) s.rect(cx - iw + Math.round(off / 2), y, iw * 2 + 1, 1, '#e3b2fc');
  }
  // kleine Glitzer rund um die Kerze
  const r = fixedRng(77);
  for (let i = 0; i < 16; i++) {
    const a = r() * Math.PI * 2;
    const d = 50 + r() * 70;
    const x = Math.round(cx + Math.cos(a) * d);
    const y = Math.round(200 + Math.sin(a) * d * 0.7);
    const k = (f + i) % 4;
    if (k === 0) {
      s.set(x, y, '#e3b2fc');
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) s.set(x + dx, y + dy, '#a065e3');
    } else if (k === 1) s.set(x, y, '#cf84f0');
  }
}

// --- 21 · Gallery (Portraits) --------------------------------------------------------------

function galleryScene(s: Scene): void {
  s.rect(0, 0, W, H, '#2b3643');
  s.use(['#254843'], () => s.each((x, y) => ((x + y * 2) % 9 === 0 ? 0 : null)));
  const bust = (cx: number, base: number, skin: string[], hair: string, hairHi: string, cloth: string, rim: string, seed: number) => {
    const hy = base - 118;
    // Schultern
    s.use([cloth], () => s.each((x, y) => (((x - cx) / 62) ** 2 + ((y - (base - 10)) / 44) ** 2 <= 1 && y >= base - 52 ? 0 : null), cx - 64, base - 56, cx + 64, H));
    s.rect(cx + 40, base - 40, 3, 40, rim);
    // Hals
    s.rect(cx - 10, hy + 26, 20, 40, skin[1]!);
    s.rect(cx + 6, hy + 26, 4, 40, skin[0]!);
    // Kopf
    s.use(skin, () =>
      s.each((x, y) => {
        const nx = (x - cx) / 26;
        const ny = (y - hy) / 33;
        const d = nx * nx + ny * ny;
        if (d > 1) return null;
        const nz = Math.sqrt(1 - d);
        const l = Math.max(0, -nx * 0.6 - ny * 0.35 + nz * 0.7);
        return Math.min(s.steps, 0.4 + l * s.steps);
      }, cx - 27, hy - 34, cx + 27, hy + 34),
    );
    s.each((x, y) => {
      const nx = (x - cx) / 26;
      const ny = (y - hy) / 33;
      const d = nx * nx + ny * ny;
      return d <= 1 && d > 0.78 && nx > 0.45 ? 0 : null;
    }, cx, hy - 34, cx + 27, hy + 34);
    s.use([rim], () =>
      s.each((x, y) => {
        const nx = (x - cx) / 26;
        const ny = (y - hy) / 33;
        const d = nx * nx + ny * ny;
        return d <= 1 && d > 0.8 && nx > 0.5 ? 0 : null;
      }, cx, hy - 34, cx + 27, hy + 34),
    );
    // Haare
    s.use([hair, hairHi], () =>
      s.each((x, y) => {
        const n = s.fbm(x / 7, y / 7, seed);
        const d = Math.hypot((x - cx) / 34, (y - (hy - 16)) / 26) + (n - 0.5) * 0.6;
        if (d > 1) return null;
        const inFace = ((x - cx) / 22) ** 2 + ((y - hy - 6) / 26) ** 2 < 1 && y > hy - 14;
        return inFace ? null : n > 0.62 ? 1 : 0;
      }, cx - 40, hy - 50, cx + 40, hy + 30),
    );
    // Gesicht
    s.rect(cx - 12, hy + 2, 5, 2, '#252422');
    s.rect(cx + 6, hy + 2, 5, 2, '#252422');
    s.set(cx - 11, hy + 2, '#eae6ce');
    s.set(cx + 7, hy + 2, '#eae6ce');
    s.rect(cx - 13, hy - 4, 7, 1, hair);
    s.rect(cx + 5, hy - 4, 7, 1, hair);
    s.rect(cx - 1, hy + 6, 2, 8, skin[0]!);
    s.rect(cx - 6, hy + 19, 11, 1, '#7b2f2c');
  };
  bust(70, 372, ['#432925', '#8a5a42', '#ae7058', '#d08561'], '#252422', '#432925', '#91322b', '#2098a4', 91);
  bust(200, 380, ['#643831', '#ae7058', '#dc755b', '#ffc697'], '#c5a134', '#ffc697', '#254843', '#dc755b', 92);
  bust(452, 378, ['#352c2e', '#643831', '#8a5a42', '#ae7058'], '#252422', '#533a44', '#eae6ce', '#2098a4', 93);
  bust(588, 372, ['#8a5a42', '#d08561', '#ffc697', '#eae6ce'], '#432925', '#7b2f2c', '#825985', '#c5a134', 94);
}

// --- 22 · Triptych -------------------------------------------------------------------------

function triptychScene(s: Scene): void {
  const A = [0, 212];
  const B = [226, 414];
  const C = [428, 640];
  s.rect(0, 0, W, H, '#090a14');
  // Herbst
  s.use(['#be772b', '#de9e41', '#e8c170'], () => s.each((x, y) => 2 - y / 120, A[0], 0, A[1], 200));
  s.use(['#241527', '#341c27', '#602c2c'], () => s.each((x, y) => 1 + s.noise(x / 10, y / 5, 101) * 1.2, A[0], 200, A[1], H));
  for (const [x, w] of [
    [30, 10],
    [120, 14],
    [176, 8],
  ] as const)
    s.rect(x, 120, w, 200, '#241527');
  for (const [x, y, r, sd] of [
    [30, 90, 50, 102],
    [120, 70, 60, 103],
    [190, 120, 44, 104],
    [70, 180, 36, 105],
  ] as const)
    blob(s, x, y, r, ['#341c27', '#602c2c', '#884b2b', '#be772b', '#de9e41', '#e8c170'], sd, A[0], A[1]);
  s.use(['#4d2b32', '#7a4841'], () => s.each((x, y) => (Math.abs(x - 100 - (y - 360) * 0.4) < (y - 250) * 0.4 ? 1 : null), A[0], 250, A[1], H));
  // Grüner Wald
  s.use(['#10141f', '#19332d'], () => s.each((x, y) => s.noise(x / 20, y / 20, 106) * 1.4, B[0], 0, B[1], H));
  s.rect(300, 60, 40, 300, '#151d28');
  s.rect(300, 60, 4, 300, '#202e37');
  for (const [x, y, r, sd] of [
    [250, 60, 56, 107],
    [390, 70, 54, 108],
    [320, 20, 50, 109],
    [240, 170, 34, 110],
  ] as const)
    blob(s, x, y, r, ['#19332d', '#25562e', '#468232', '#75a743', '#a8ca58'], sd, B[0], B[1]);
  for (let i = 0; i < 4; i++) {
    const y = 180 + i * 34;
    s.rect(308, y, 24, 28, '#4d2b32');
    s.rect(312, y + 6, 16, 14, '#a53030');
    s.rect(316, y + 9, 8, 8, '#de9e41');
    s.rect(318, y + 11, 4, 4, '#e8c170');
  }
  s.use(['#19332d', '#25562e'], () => s.each((x, y) => s.noise(x / 6, y / 4, 111) * 1.6, B[0], 320, B[1], H));
  // Nacht
  s.use(['#090a14', '#172038', '#253a5e', '#3c5e8b'], () => s.each((x, y) => 3 - y / 90, C[0], 0, C[1], H));
  for (const [x, y, r, sd] of [
    [480, 80, 44, 112],
    [560, 110, 50, 113],
    [620, 60, 36, 114],
  ] as const)
    blob(s, x, y, r, ['#172038', '#253a5e', '#3c5e8b', '#4f8fba', '#73bed3'], sd, C[0], C[1]);
  s.disc(590, 34, 11, '#ebede9');
  s.disc(595, 30, 10, '#172038');
  s.rect(470, 170, 30, 190, '#10141f');
  s.rect(466, 160, 38, 10, '#10141f');
  for (let i = 0; i < 4; i++) s.rect(466 + i * 10, 152, 6, 8, '#10141f');
  s.rect(530, 210, 80, 150, '#10141f');
  s.rect(560, 180, 20, 30, '#10141f');
  s.rect(482, 200, 4, 8, '#e8c170');
  for (const [x, y, r, sd] of [
    [450, 330, 40, 115],
    [540, 345, 46, 116],
    [630, 320, 30, 117],
  ] as const)
    blob(s, x, y, r, ['#241527', '#411d31', '#752438', '#a53030', '#cf573c'], sd, C[0], C[1]);
}

// --- 23 · Hexa -------------------------------------------------------------------------------

function hexaScene(s: Scene): void {
  s.rect(0, 0, W, H, '#14233a');
  const ramps = [
    ['#734c44', '#b55945', '#eb9661', '#f2b888'],
    ['#a57855', '#de9f47', '#fdd179', '#fee1b8'],
    ['#2f4d2f', '#44702d', '#819447', '#a6b04f'],
    ['#546756', '#89a477', '#a4c5af', '#cae6d9'],
    ['#303843', '#405273', '#6c81a1', '#96a9c1'],
    ['#3d3333', '#593e47', '#7a5859', '#a57855'],
  ];
  const a = 10;
  const cube = (cx: number, cy: number, r: string[]) => {
    for (let dy = -a; dy <= a; dy++)
      for (let dx = -Math.ceil(a * 0.87); dx <= Math.ceil(a * 0.87); dx++) {
        const adx = Math.abs(dx);
        if (adx > a * 0.866 || Math.abs(dy) > a - adx * 0.577) continue;
        const top = dy <= -adx * 0.577;
        const c = top ? r[2]! : dx < 0 ? r[1]! : r[0]!;
        s.set(cx + dx, cy + dy, c);
      }
    s.set(cx - 2, cy - a + 3, r[3]!);
    s.set(cx - 1, cy - a + 3, r[3]!);
  };
  const ball = (cx: number, cy: number, r: string[]) =>
    s.use(r, () =>
      s.each((x, y) => {
        const nx = (x - cx) / 8;
        const ny = (y - cy) / 8;
        const d = nx * nx + ny * ny;
        if (d > 1) return null;
        return Math.min(3, 0.3 + Math.max(0, -nx * 0.6 - ny * 0.6 + Math.sqrt(1 - d) * 0.6) * 3.2);
      }, cx - 9, cy - 9, cx + 10, cy + 10),
    );
  ramps.forEach((r, i) => {
    const gx = 30 + (i % 3) * 210;
    const gy = 22 + Math.floor(i / 3) * 96;
    for (let row = 0; row < 5; row++)
      for (let col = 0; col < 8 - (row % 2); col++) {
        const x = gx + col * 17.3 + (row % 2) * 8.66;
        const y = gy + row * 15;
        if ((row + col + i) % 5 === 0) ball(Math.round(x), Math.round(y), r);
        else cube(Math.round(x), Math.round(y), r);
      }
  });
  // Bäume unten
  s.rect(0, 330, W, 30, '#2f4d2f');
  s.use(['#2f4d2f', '#44702d'], () => s.each((x, y) => s.noise(x / 5, y / 3, 121) * 1.5, 0, 330, W, H));
  const tree = (x: number, r: number, ramp: string[], sd: number) => {
    s.rect(x - 3, 300, 6, 40, '#593e47');
    blob(s, x, 300 - r * 0.6, r, ramp, sd);
  };
  tree(60, 34, ['#2f4d2f', '#44702d', '#819447', '#a6b04f', '#d4c692'], 122);
  tree(140, 26, ['#546756', '#89a477', '#a4c5af', '#cae6d9'], 123);
  tree(470, 36, ['#734c44', '#b55945', '#eb9661', '#f2b888'], 124);
  tree(560, 28, ['#a57855', '#de9f47', '#fdd179', '#fee1b8'], 125);
  tree(620, 22, ['#2f4d2f', '#44702d', '#819447', '#a6b04f'], 126);
}

// --- 24 · Monster (Kampfbildschirm) -------------------------------------------------------------

function monsterScene(s: Scene): void {
  s.use(['#efb775', '#efd8a1'], () => s.each((x, y) => 1 - y / 110, 0, 0, W, 110));
  s.use(['#183f39', '#276468'], () =>
    s.each((x, y) => {
      const top = 84 + Math.abs(Math.sin(x * 0.07)) * -18 + s.noise(x / 9, 1, 131) * 10;
      return y < top ? null : y < 112 ? 1 - (y - top) / 30 : null;
    }, 0, 50, W, 112),
  );
  s.use(['#1f240a', '#39571c', '#a58c27'], () =>
    s.each((x, y) => {
      const stripe = Math.floor((y - 110) / 16) % 2 === 0 ? 0.35 : 0;
      return 1 + stripe + (s.noise(x / 24, y / 10, 132) - 0.5) * 0.25 + ((y - 110) / 250) * 0.3;
    }, 0, 110, W, H),
  );
  const platform = (cx: number, cy: number, rx: number, ry: number) => {
    s.use(['#724113', '#a58c27', '#efac28'], () =>
      s.each((x, y) => {
        const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (d > 1) return null;
        return d > 0.72 ? (y > cy ? 0 : 2) : 1.2 + (s.noise(x / 6, y / 3, 133) - 0.5) * 0.9;
      }, cx - rx, cy - ry, cx + rx + 1, cy + ry + 1),
    );
  };
  platform(470, 168, 110, 24);
  platform(170, 318, 150, 30);
  // Grasbüschel
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(s.rnd() * W);
    const y = 120 + Math.floor(s.rnd() * 240);
    s.set(x, y, '#39571c');
    s.set(x - 1, y + 1, '#39571c');
    s.set(x + 1, y + 1, '#39571c');
    s.set(x, y + 1, '#1f240a');
  }
}

export const MORE_PALETTE_THEMES: PaletteTheme[] = [
  {
    id: 'alley',
    name: 'Neon Alley',
    desc: 'Nächtliche Ladenstraße in Blau und Pink: Knöpfe wie Leuchtreklame mit Lauflichtern.',
    colors: ['#0000aa', '#000056', '#000034', '#ff72ff', '#ff00db'],
    scene: alleyScene,
  },
  {
    id: 'harbor',
    name: 'Rainbow Harbor',
    desc: 'Bunter Märchenhafen mit Regenbogen (256 Farben): Wimpel-Knöpfe in allen Farben.',
    colors: HARBOR_COLORS(),
    ui: ['#29140f', '#704f41', '#a27d69', '#e7cf90', '#f2f0d6'],
    accents: { red: '#d64642', orange: '#fb7f00', yellow: '#f6e742', green: '#6ba53b', blue: '#1993ce', violet: '#8545b0', sky: '#7ecff6' },
    sprite: 'normal',
    scene: harborScene,
  },
  {
    id: 'backrooms',
    name: 'Backrooms',
    desc: 'Endlose gelbe Flure: schlichtes Textmenü mit „<“-Auswahl, Fenster-Titelleiste, unheimlich ruhig.',
    colors: [...YELLOWS.slice().reverse(), '#3d3633', '#5d5451', '#726863', '#8a7f79', '#9f948e', '#b3a7a0', '#c8c0b5', '#d5ccbf', '#e5ddcc'],
    ui: ['#2c211d', '#544738', '#93885f', '#d3d381', '#f3f4de'],
    accents: { gray: '#8a7f79', light: '#e5ddcc', wall: '#c3c07e' },
    sprite: 'nearest',
    scene: backroomsScene,
  },
  {
    id: 'candle',
    name: 'Candle',
    desc: 'Eine Kerze im violetten Sternenhimmel: magische Glitzer-Rahmen, Flammen-Akzent, Mitte bleibt frei. Die Flamme flackert.',
    colors: ['#000000', '#240142', '#290573', '#4a1cb8', '#7312fc', '#a065e3', '#cf84f0', '#e3b2fc', '#fdcd86'],
    ui: ['#000000', '#240142', '#4a1cb8', '#a065e3', '#e3b2fc'],
    accents: { flame: '#fdcd86', violet: '#7312fc', pink: '#cf84f0' },
    sprite: 'nearest',
    scene: candleScene,
    fx: { frames: 4, duration: 0.5, draw: candleFx },
  },
  {
    id: 'gallery',
    name: 'Gallery',
    desc: 'Gedämpfte Porträt-Palette: Comic-Panels mit farbigen Schatten und Sprechblase.',
    colors: ['#252422', '#352c2e', '#373f35', '#432925', '#7b2f2c', '#643831', '#2b3643', '#533a44', '#254843', '#4f4c59', '#595652', '#714b65', '#5f7077', '#91322b', '#8a5a42', '#ae7058', '#dc755b', '#c5a134', '#d08561', '#825985', '#888f74', '#2098a4', '#ffc697', '#eae6ce'],
    ui: ['#252422', '#2b3643', '#5f7077', '#d08561', '#eae6ce'],
    accents: { teal: '#2098a4', red: '#91322b', gold: '#c5a134', peach: '#ffc697', purple: '#825985' },
    sprite: 'nearest',
    scene: galleryScene,
  },
  {
    id: 'triptych',
    name: 'Triptych',
    desc: 'Drei Bilder nebeneinander (Herbst, Wald, Nacht): Menü, Türen und Karte sitzen je in einem Bild.',
    colors: ['#172038', '#253a5e', '#3c5e8b', '#4f8fba', '#73bed3', '#a4dddb', '#19332d', '#25562e', '#468232', '#75a743', '#a8ca58', '#d0da91', '#4d2b32', '#7a4841', '#ad7757', '#c09473', '#d7b594', '#e7d5b3', '#341c27', '#602c2c', '#884b2b', '#be772b', '#de9e41', '#e8c170', '#241527', '#411d31', '#752438', '#a53030', '#cf573c', '#da863e', '#1e1d39', '#402751', '#7a367b', '#a23e8c', '#c65197', '#df84a5', '#090a14', '#10141f', '#151d28', '#202e37', '#394a50', '#577277', '#819796', '#a8b5b2', '#c7cfcc', '#ebede9'],
    ui: ['#090a14', '#341c27', '#884b2b', '#de9e41', '#e7d5b3'],
    accents: { moss: '#25562e', leaf: '#75a743', lime: '#a8ca58', night: '#172038', blue: '#3c5e8b', sky: '#73bed3', moon: '#ebede9' },
    sprite: 'nearest',
    scene: triptychScene,
  },
  {
    id: 'hexa',
    name: 'Hexa',
    desc: 'Isometrische Würfel und Kugeln auf Nachtblau: Sechseck-Knöpfe und Sechseck-Türen.',
    colors: ['#636663', '#87857c', '#bcad9f', '#f2b888', '#eb9661', '#b55945', '#734c44', '#3d3333', '#593e47', '#7a5859', '#a57855', '#de9f47', '#fdd179', '#fee1b8', '#d4c692', '#a6b04f', '#819447', '#44702d', '#2f4d2f', '#546756', '#89a477', '#a4c5af', '#cae6d9', '#f1f6f0', '#d5d6db', '#bbc3d0', '#96a9c1', '#6c81a1', '#405273', '#303843', '#14233a'],
    ui: ['#14233a', '#303843', '#405273', '#96a9c1', '#f1f6f0'],
    accents: { orange: '#eb9661', gold: '#fdd179', green: '#819447', red: '#b55945', mint: '#a4c5af' },
    sprite: 'nearest',
    scene: hexaScene,
  },
  {
    id: 'monster',
    name: 'Monster Battle',
    desc: 'Wie ein Monster-Sammelspiel auf dem Handheld: Textboxen mit Doppelrand, 2×2-Menü, HP-Balken.',
    colors: ['#1f240a', '#39571c', '#a58c27', '#efac28', '#efd8a1', '#ab5c1c', '#183f39', '#ef692f', '#efb775', '#a56243', '#773421', '#724113', '#2a1d0d', '#392a1c', '#684c3c', '#927e6a', '#276468', '#ef3a0c', '#45230d', '#3c9f9c', '#9b1a0a', '#36170c', '#550f0a', '#300f0a'],
    ui: ['#2a1d0d', '#684c3c', '#927e6a', '#efb775', '#efd8a1'],
    accents: { teal: '#3c9f9c', dteal: '#276468', green: '#39571c', red: '#ef3a0c', orange: '#ef692f', gold: '#efac28' },
    sprite: 'nearest',
    scene: monsterScene,
  },
  idleTheme(HARBOR_COLORS()),
];

/** Die 256-Farben-Palette des Märchenhafens (aus dem Beispielbild ausgelesen). */
function HARBOR_COLORS(): string[] {
  return '#1d0102 #130900 #001003 #1a0114 #000000 #131822 #252b34 #393e47 #4e535b #646870 #7b7e85 #92959b #aaadb2 #c3c5c9 #dddee1 #ffffff #311e22 #473135 #5e4649 #755c5d #8e7273 #a78a8a #c0a3a1 #dabcb9 #101e39 #203453 #324c6d #466587 #5d7fa0 #7699b8 #92b4cf #b0cfe5 #00151b #00242c #04343e #18444d #29545d #3b656d #4d767e #60888e #2b4339 #3a5649 #4b695a #5c7c6c #6f907e #84a491 #99b8a6 #afccba #52170b #6d2b16 #884025 #a15837 #b8724e #cd8e68 #e0aa87 #f0c8ab #522e0d #6f4011 #8a561c #a36d2d #bb8745 #d0a162 #e4bd83 #f7daaa #29140f #40261e #583a2f #704f41 #896555 #a27d69 #bb957f #7c1500 #922600 #a73700 #bc4800 #d15a00 #e76c00 #fb7f00 #ff9d4f #ffba81 #290520 #400b2f #56153e #6b234b #7f3558 #8f4965 #411116 #601e21 #7e302e #9b443c #b65c4d #cf7762 #e97970 #f58773 #fe987b #ffad8d #422700 #5c3a00 #75500f #8c6726 #a3803d #ba9a56 #d0b472 #e7cf90 #716854 #837a63 #958d73 #a7a084 #bab397 #ccc7aa #dfdcbf #f2f0d6 #b15901 #c77000 #dd8800 #efa323 #fac053 #614e00 #766000 #8b7400 #a18800 #b69d00 #c8b33c #d9c968 #dcbd00 #ead200 #f6e742 #fafabb #39000f #540017 #70001e #8e0024 #ad0027 #c42531 #d64642 #e36558 #a44d6e #bc577a #d16485 #e47391 #f4869e #ff9bac #ffb7bf #ffd1d3 #121904 #262f0d #3c471b #54602b #6e793f #899457 #a6af71 #c3ca8e #17431d #215c1f #347423 #4e8d2b #6ba53b #8bbd52 #acd470 #ceeb95 #002116 #003825 #005032 #006a3c #278249 #4b9a5a #6eb26d #91c985 #00544c #00695c #007e6b #229479 #47a788 #69ba99 #8bcdab #aedfc1 #008589 #009697 #00a8a5 #00b9b3 #00cbc0 #38dccc #68ead8 #92f8e4 #007492 #0089a7 #009fbc #2fb5cc #58c9da #7fdce7 #a8eef4 #d6feff #115785 #036aa1 #017eb9 #1993ce #38a7df #59bcec #7ecff6 #a7e1fc #151c53 #1e2e77 #254399 #2d5bb8 #3774d4 #478eec #5da9ff #89c3ff #0f0420 #1f123a #302355 #413670 #524b8b #6361a5 #7578bd #8890d4 #30114a #4b1e6f #682f91 #8545b0 #a15eca #bb7be0 #d49bf2 #eabdfe #534d6f #746b91 #978ab2 #bbacd2 #dfd0f0 #361f38 #533252 #70486b #8d6184 #a87c9c #c299b4 #661359 #9b1e80 #cb40a0 #f070bb #ffaed4 #587500 #759200 #95b000 #b7ce00 #dbeb48 #7e6cd9 #8683eb #8f9bfb #9eb3ff #b2caff #ff2d2d #ffff00 #22e040 #00e5ff #2060ff #ff30d0'.split(' ');
}

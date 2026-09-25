// Paletten-Designs für das UI-Lab. Jede Palette hat genau 5 Farben; die
// Hintergrundszene wird ausschließlich aus diesen Farben gezeichnet,
// Farbverläufe entstehen über geordnetes Dithering (Bayer 4×4).

export interface PaletteTheme {
  id: string;
  name: string;
  desc: string;
  /** Die komplette Palette (beliebige Reihenfolge) */
  colors: readonly string[];
  /** 5 Farben für die Oberfläche (dunkel → hell); fehlt es, wird `colors` sortiert */
  ui?: readonly string[];
  /** Zusätzliche Akzentfarben, als CSS-Variablen --a-<name> verfügbar */
  accents?: Readonly<Record<string, string>>;
  /** Kartenbild: über Helligkeit auf die UI-Farben (Standard), nächste Palettenfarbe, oder unverändert */
  sprite?: 'ramp' | 'nearest' | 'normal';
  /** Design-Familie mit gemeinsamem Stil (CSS-Klasse fam-<name>) */
  family?: string;
  /** Farb-Welt: Rasse, deren Karten dieses Design zeigt (siehe races.ts) */
  race?: string;
  scene: (s: Scene) => void;
  /** Animierte Ebene über der Szene: `frames` Bilder, transparent, im Wechsel abgespielt */
  fx?: { frames: number; duration: number; draw: (s: Scene, frame: number) => void };
}

/** Die 5 Oberflächenfarben eines Designs (dunkel → hell). */
export const uiRamp = (t: PaletteTheme) => t.ui ?? sortPalette(t.colors);

const W = 640;
const H = 360;

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

export const hexRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
const lum = (h: string) => {
  const [r, g, b] = hexRgb(h);
  return 0.3 * r + 0.59 * g + 0.11 * b;
};

/** Sortiert eine Palette von dunkel nach hell. */
export const sortPalette = (cols: readonly string[]) => [...cols].sort((a, b) => lum(a) - lum(b));

// --- Rauschen ----------------------------------------------------------------------

function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function noise(x: number, y: number, seed = 1): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, seed);
  const b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed);
  const d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x: number, y: number, seed = 1, oct = 4): number {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < oct; i++) {
    sum += noise(x * f, y * f, seed + i) * amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / (1 - Math.pow(0.5, oct));
}

// --- Zeichenfläche ----------------------------------------------------------------------

/** Farbe: Zahl = Stufe der aktuellen Farbreihe, Text = feste Hex-Farbe */
export type Col = number | string;

/** Bit 24 markiert gesetzte Pixel; ungesetzte bleiben transparent. */
const SET = 0x1000000;
const hexInt = (h: string) => parseInt(h.slice(1, 7), 16) | SET;

export class Scene {
  readonly w = W;
  readonly h = H;
  private readonly buf = new Uint32Array(W * H);
  private rng: number;
  private ramp: number[];

  constructor(ramp: readonly string[], seed = 7) {
    this.rng = seed;
    this.ramp = ramp.map(hexInt);
  }

  /** Zeichnet `fn` mit einer anderen Farbreihe (Stufen 0…n-1 statt 0…4). */
  use(ramp: readonly string[], fn: () => void): void {
    const prev = this.ramp;
    this.ramp = ramp.map(hexInt);
    try {
      fn();
    } finally {
      this.ramp = prev;
    }
  }

  get steps(): number {
    return this.ramp.length - 1;
  }

  rnd(): number {
    this.rng = (this.rng * 16807) % 2147483647;
    return this.rng / 2147483647;
  }

  noise = noise;
  fbm = fbm;

  set(x: number, y: number, c: Col): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    this.buf[y * W + x] = typeof c === 'string' ? hexInt(c) : this.ramp[Math.max(0, Math.min(this.ramp.length - 1, c))]!;
  }

  /** Setzt einen stufenlosen Wert 0…n, der per Dithering auf die Farbreihe verteilt wird. */
  shade(x: number, y: number, v: number): void {
    const base = Math.floor(v);
    const frac = v - base;
    const t = BAYER[(y & 3) * 4 + (x & 3)]!;
    this.set(x, y, frac > t ? base + 1 : base);
  }

  rect(x: number, y: number, w: number, h: number, i: Col): void {
    for (let j = 0; j < h; j++) for (let k = 0; k < w; k++) this.set(x + k, y + j, i);
  }

  /** Füllt jeden Pixel mit f(x, y) → Wert (oder null = unverändert). */
  each(f: (x: number, y: number) => number | null, x0 = 0, y0 = 0, x1 = W, y1 = H): void {
    for (let y = Math.max(0, y0); y < Math.min(H, y1); y++)
      for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
        const v = f(x, y);
        if (v !== null) this.shade(x, y, v);
      }
  }

  disc(cx: number, cy: number, r: number, i: Col): void {
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) this.set(x, y, i);
  }

  line(x0: number, y0: number, x1: number, y1: number, i: Col): void {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let k = 0; k <= n; k++) this.set(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, i);
  }

  stars(n: number, cols: Col[], y1 = H): void {
    for (let k = 0; k < n; k++) {
      const x = Math.floor(this.rnd() * W);
      const y = Math.floor(this.rnd() * y1);
      const c = cols[Math.floor(this.rnd() * cols.length)]!;
      this.set(x, y, c);
      if (this.rnd() < 0.12) {
        this.set(x - 1, y, c);
        this.set(x + 1, y, c);
        this.set(x, y - 1, c);
        this.set(x, y + 1, c);
      }
    }
  }

  toImageData(): ImageData {
    const img = new ImageData(W, H);
    for (let i = 0; i < this.buf.length; i++) {
      const v = this.buf[i]!;
      img.data[i * 4] = (v >> 16) & 255;
      img.data[i * 4 + 1] = (v >> 8) & 255;
      img.data[i * 4 + 2] = v & 255;
      img.data[i * 4 + 3] = v & SET ? 255 : 0;
    }
    return img;
  }

  toDataURL(): string {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    c.getContext('2d')!.putImageData(this.toImageData(), 0, 0);
    return c.toDataURL();
  }
}


// --- Animationen (transparente Ebenen) --------------------------------------------------

/** Fester Zufall für Animationen: gleiche Positionen in jedem Frame. */
export function fixedRng(seed: number): () => number {
  let v = seed;
  return () => (v = (v * 16807) % 2147483647) / 2147483647;
}

function ridgeFx(s: Scene, f: number): void {
  // Vogelschwarm mit Flügelschlag
  const birds: [number, number][] = [
    [150, 70],
    [164, 62],
    [176, 74],
    [190, 58],
    [204, 68],
    [222, 60],
  ];
  const up: [number, number][] = [[-2, -1], [-1, 0], [0, 0], [1, 0], [2, -1], [-3, -2], [3, -2]];
  const down: [number, number][] = [[-2, 1], [-1, 0], [0, 0], [1, 0], [2, 1]];
  birds.forEach(([x, y], i) => {
    const by = y + ((f + i) % 3 === 0 ? 1 : 0);
    for (const [dx, dy] of (f + i) % 2 === 0 ? up : down) s.set(x + f + dx, by + dy, 0);
  });
  // schwebende Pollen im Abendlicht
  const r = fixedRng(5);
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(r() * W);
    const y = 120 + Math.floor(r() * 200);
    const k = (f + Math.floor(r() * 6)) % 6;
    s.set(x + k, y - Math.floor(k / 2), k % 3 ? 4 : 3);
  }
  // flimmernder Sonnenrand
  for (let a = 0; a < 90; a++) {
    const rad = 37 + ((a + f) % 3);
    const ang = (a / 90) * Math.PI * 2;
    if ((a + f) % 2) s.set(430 + Math.cos(ang) * rad, 168 + Math.sin(ang) * rad, 4);
  }
}

function lanternFx(s: Scene, f: number): void {
  const lx = 320;
  // Flamme in der Laterne
  const h = [12, 10, 13, 11][f]!;
  const sway = [0, 1, 0, -1][f]!;
  for (let y = 0; y < h; y++) {
    const w = Math.max(1, Math.round(Math.sin(((y + 1) / (h + 1)) * Math.PI) * 3));
    s.rect(lx - w + (y > h / 2 ? sway : 0), 50 - y, w * 2, 1, y > h - 4 ? 3 : 4);
  }
  // pulsierender Lichtring an der Wand
  const rr = 70 + f * 3;
  for (let a = 0; a < 180; a++) {
    const ang = (a / 180) * Math.PI * 2;
    const x = Math.round(lx + Math.cos(ang) * rr);
    const y = Math.round(46 + Math.sin(ang) * rr * 0.8);
    if ((x + y) % 3 === 0) s.set(x, y, 3);
  }
  // Staub im Lichtkegel
  const r = fixedRng(9);
  for (let i = 0; i < 34; i++) {
    const x = lx - 140 + Math.floor(r() * 280);
    const y = 70 + Math.floor(r() * 200);
    const k = (f + Math.floor(r() * 4)) % 4;
    s.set(x + (k === 1 ? 1 : k === 3 ? -1 : 0), y - k * 2, k === 0 ? 3 : 4);
  }
}

function orbitFx(s: Scene, f: number): void {
  // funkelnde Sterne
  const r = fixedRng(21);
  for (let i = 0; i < 46; i++) {
    const x = Math.floor(r() * W);
    const y = Math.floor(r() * H);
    const k = (f + Math.floor(r() * 8)) % 8;
    if (k === 0) {
      s.set(x, y, 4);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        s.set(x + dx, y + dy, 3);
        s.set(x + dx * 2, y + dy * 2, 2);
      }
    } else if (k === 1 || k === 7) {
      s.set(x, y, 4);
      s.set(x - 1, y, 2);
      s.set(x + 1, y, 2);
    } else if (k < 4) s.set(x, y, 3);
  }
  // Sternschnuppe
  if (f >= 2 && f <= 5) {
    const t = (f - 2) / 3;
    const hx = Math.round(60 + t * 200);
    const hy = Math.round(30 + t * 70);
    for (let i = 0; i < 26; i++) s.set(hx - i, hy - Math.round(i * 0.35), i < 3 ? 4 : i < 12 ? 3 : 2);
  }
}

// --- Szenen ------------------------------------------------------------------------------

function slimyScene(s: Scene): void {
  s.stars(120, [4, 3, 2]);
  // Spiralgalaxie
  const cx = 360;
  const cy = 196;
  s.each((x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const rx = dx * 0.94 + dy * 0.34;
    const ry = (-dx * 0.34 + dy * 0.94) / 0.5;
    const r = Math.hypot(rx, ry);
    if (r > 120) return null;
    const a = Math.atan2(ry, rx);
    const arm = Math.pow(Math.cos(2 * (a - 2.4 * Math.log(r + 1))) * 0.5 + 0.5, 2.2);
    const fall = 1 - r / 120;
    const v = arm * fall * 3.4 + Math.exp(-r / 10) * 3 + (fbm(x / 14, y / 14, 3) - 0.5) * 1.2 * fall;
    return v < 0.55 ? null : Math.min(4, v);
  }, cx - 130, cy - 90, cx + 130, cy + 90);
  // kleine Schleimkugeln
  for (const [x, y, r] of [
    [90, 300, 10],
    [118, 312, 7],
    [560, 70, 14],
  ] as const) {
    s.each((px, py) => {
      const d = Math.hypot(px - x, py - y);
      if (d > r) return null;
      const lx = (px - x + r * 0.4) / r;
      const ly = (py - y + r * 0.4) / r;
      return 1.2 + 2.6 * Math.max(0, 1 - Math.hypot(lx, ly));
    }, x - r, y - r, x + r + 1, y + r + 1);
  }
}

function sunsetScene(s: Scene): void {
  const horizon = 236;
  s.each((x, y) => 1.9 + (y / horizon) * 1.9, 0, 0, W, horizon);
  // Sonne mit Streifenlücken unten
  const cx = 330;
  const r = 78;
  s.each((x, y) => {
    const d = Math.hypot(x - cx, y - horizon);
    if (d > r) return null;
    const fromBottom = horizon - y;
    if (fromBottom < 34 && (fromBottom % 9) < 1 + (34 - fromBottom) / 9) return null;
    return d < r - 3 ? 3 : 3.5;
  }, cx - r, horizon - r, cx + r + 1, horizon);
  // Wolken
  for (const [x, y, w] of [
    [470, 46, 60],
    [120, 76, 40],
    [540, 110, 34],
  ] as const) {
    s.each((px, py) => {
      const n = fbm(px / 9, py / 9, 5);
      const e = ((px - x) / w) ** 2 + ((py - y) / (w * 0.28)) ** 2;
      if (e + (0.5 - n) * 0.6 > 1) return null;
      return py > y + 3 ? 2 : 4;
    }, x - w, y - w, x + w, y + w);
  }
  // Vögel
  for (const [x, y] of [
    [200, 60],
    [214, 52],
    [228, 64],
  ] as const) {
    s.set(x - 2, y - 1, 1);
    s.set(x - 1, y, 1);
    s.set(x, y - 1, 1);
    s.set(x + 1, y, 1);
    s.set(x + 2, y - 1, 1);
  }
  // Meer
  s.each((x, y) => 1.4 + ((y - horizon) / 60) * 1.2, 0, horizon, W, 296);
  for (let y = horizon + 2; y < 296; y += 3) {
    const spread = 20 + (y - horizon) * 1.6;
    for (let k = 0; k < 4; k++) {
      const len = 6 + Math.floor(s.rnd() * 22);
      const x = cx - spread + Math.floor(s.rnd() * spread * 2);
      s.rect(x, y, len, 1, s.rnd() < 0.5 ? 3 : 4);
    }
  }
  // Strand
  s.each((x, y) => (y < 300 ? 4 : 3.3 + fbm(x / 20, y / 6, 9) * 0.6), 0, 296, W, H);
  // Sonnenschirm + zwei Silhouetten
  s.line(250, 330, 270, 290, 0);
  s.each((x, y) => (Math.hypot(x - 270, (y - 292) * 1.8) < 22 && y < 292 ? 1 : null), 245, 270, 296, 293);
  s.disc(284, 318, 4, 0);
  s.rect(280, 322, 9, 14, 0);
  s.disc(300, 320, 4, 0);
  s.rect(296, 324, 9, 12, 0);
  s.rect(270, 334, 50, 3, 1);
}

function noirScene(s: Scene): void {
  s.rect(0, 0, W, H, 0);
  // Fenster mit Stadt und Jalousien
  const wx = 300;
  const wy = 30;
  const ww = 220;
  const wh = 250;
  s.rect(wx - 4, wy - 4, ww + 8, wh + 8, 1);
  s.rect(wx, wy, ww, wh, 1);
  for (let b = 0; b < 9; b++) {
    const bx = wx + b * 26 + Math.floor(s.rnd() * 6);
    const bh = 80 + Math.floor(s.rnd() * 140);
    const bw = 18 + Math.floor(s.rnd() * 12);
    s.rect(bx, wy + wh - bh, bw, bh, 0);
    for (let y = wy + wh - bh + 4; y < wy + wh - 4; y += 6)
      for (let x = bx + 3; x < bx + bw - 3; x += 5) if (s.rnd() < 0.3) s.rect(x, y, 2, 3, 3);
  }
  for (let k = 0; k < 90; k++) {
    const x = wx + Math.floor(s.rnd() * ww);
    const y = wy + Math.floor(s.rnd() * wh);
    s.line(x, y, x - 1, y + 5, 2);
  }
  for (let y = wy; y < wy + wh; y += 10) {
    s.each((x) => 2.2 + (1 - (x - wx) / ww) * 1.6, wx, y, wx + ww, y + 4);
    s.rect(wx, y + 4, ww, 1, 0);
  }
  // Lichtstreifen der Jalousie an der Wand links
  s.each((x, y) => {
    if (x > 290) return null;
    const band = (y - (290 - x) * 0.42) % 20;
    const inside = y > 60 + (290 - x) * 0.25 && y < 340;
    return inside && band >= 0 && band < 8 ? 1 + Math.max(0, 1 - (290 - x) / 300) * 0.8 : null;
  });
  // Rauchwolke
  s.each((x, y) => {
    const e = ((x - 575) / 36) ** 2 + ((y - 110) / 60) ** 2;
    const n = fbm(x / 10, y / 10, 11);
    const v = (1.2 - e) * 2.5 + (n - 0.5) * 2.4;
    return v > 0.6 ? Math.min(4, 1 + v) : null;
  }, 525, 40, 625, 180);
}

function mountainScene(s: Scene): void {
  s.each((x, y) => 2.2 + (y / 210) * 1.9, 0, 0, W, 240);
  // Sonne mit geditherten Lichtringen
  s.each((x, y) => {
    const d = Math.hypot(x - 430, y - 168);
    return d > 34 && d < 70 ? 3 + Math.max(0, 1 - (d - 34) / 36) * 0.9 : null;
  }, 360, 98, 500, 238);
  s.disc(430, 168, 34, 4);
  const layer = (base: number, amp: number, freq: number, seed: number, v: number, haze: number) => {
    for (let x = 0; x < W; x++) {
      const top = Math.floor(base - fbm(x / freq, 0.5, seed, 5) * amp);
      for (let y = top; y < H; y++) s.shade(x, y, v + Math.max(0, 1 - (y - top) / 40) * haze);
    }
  };
  layer(236, 120, 90, 21, 3, 0.5);
  layer(268, 110, 70, 22, 2, 0.6);
  layer(302, 90, 50, 23, 1, 0.5);
  layer(338, 40, 30, 24, 0, 0);
  // Tannen
  const pine = (x: number, base: number, h: number) => {
    for (let k = 0; k < h; k++) {
      const half = Math.floor((k / h) * h * 0.22 * (1 + ((k % 9) / 9) * 0.6));
      s.rect(x - half, base - h + k, half * 2 + 1, 1, 0);
    }
    s.rect(x - 1, base - 6, 3, 8, 0);
  };
  pine(52, 360, 170);
  pine(110, 360, 120);
  pine(160, 360, 80);
  pine(610, 360, 60);
  // Toter Baum
  s.rect(22, 150, 5, 210, 0);
  s.line(24, 190, 8, 170, 0);
  s.line(24, 220, 40, 196, 0);
  // Strommast mit Leitung
  s.rect(346, 170, 4, 190, 0);
  s.rect(334, 178, 28, 3, 0);
  for (let x = 0; x < 90; x++) s.set(335 - x, 180 + Math.floor(Math.sin((x / 90) * Math.PI) * 14), 0);
}

function tavernScene(s: Scene): void {
  // Holzwand, vom Laternenlicht beleuchtet
  const lx = 320;
  const ly = 46;
  s.each((x, y) => {
    const plank = x % 26 === 0 ? -0.8 : 0;
    const grain = (noise(x / 3, y / 40, 31) - 0.5) * 0.5;
    const light = Math.max(0, 1 - Math.hypot(x - lx, (y - ly) * 1.3) / 330);
    const vign = Math.min(1, Math.min(x, W - x) / 60);
    return Math.max(0, 0.6 + light * 3 * vign + plank + grain);
  });
  // Regal mit Flaschen
  s.rect(24, 132, 190, 5, 3);
  s.rect(24, 137, 190, 2, 0);
  for (let k = 0; k < 8; k++) {
    const x = 34 + k * 22;
    const h = 14 + Math.floor(s.rnd() * 14);
    s.rect(x, 132 - h, 8, h, 2);
    s.rect(x + 2, 132 - h - 6, 4, 6, 2);
    s.rect(x + 1, 132 - h + 2, 1, h - 4, 4);
  }
  // Laterne
  s.line(lx, 0, lx, 30, 0);
  s.rect(lx - 9, 30, 18, 3, 0);
  s.rect(lx - 7, 33, 14, 20, 3);
  s.rect(lx - 4, 36, 8, 14, 4);
  s.rect(lx - 9, 53, 18, 3, 0);
  // Tisch vorne
  s.each((x, y) => (y < 312 ? 3 : 2 + (noise(x / 20, y / 3, 41) - 0.5)), 0, 306, W, H);
  s.rect(0, 305, W, 1, 4);
  s.rect(0, 318, W, 1, 1);
  // Krüge
  for (const x of [120, 470, 520]) {
    s.rect(x, 280, 18, 26, 2);
    s.rect(x + 2, 282, 3, 20, 4);
    s.rect(x + 18, 286, 6, 3, 2);
    s.rect(x + 22, 286, 3, 12, 2);
    s.rect(x, 278, 18, 3, 4);
  }
}

function planetScene(s: Scene): void {
  s.each((x, y) => {
    const n = fbm(x / 60, y / 40, 51, 5);
    return Math.max(0, (n - 0.42) * 3.4);
  });
  s.stars(70, [4, 3]);
  const sphere = (cx: number, cy: number, r: number, crater?: [number, number, number]) => {
    s.each((x, y) => {
      const nx = (x - cx) / r;
      const ny = (y - cy) / r;
      const d2 = nx * nx + ny * ny;
      if (d2 > 1) return null;
      const nz = Math.sqrt(1 - d2);
      const l = Math.max(0, -nx * 0.62 - ny * 0.5 + nz * 0.6);
      let v = 0.9 + l * 3.4;
      if (crater) {
        const cd = Math.hypot(x - crater[0], (y - crater[1]) * 1.25);
        if (cd < crater[2]) v = cd > crater[2] - 3 ? v + 0.6 : 0.4 + l * 0.8;
      }
      return Math.min(4, v);
    }, cx - r, cy - r, cx + r + 1, cy + r + 1);
  };
  sphere(480, 250, 150, [470, 300, 22]);
  sphere(330, 96, 26);
}

function forestScene(s: Scene): void {
  const gx = 430;
  const gy = 196;
  // Leuchtendes Blätterdach und Boden
  s.each((x, y) => {
    const glow = Math.exp(-Math.hypot(x - gx, (y - gy) * 1.4) / 150);
    const leaves = (fbm(x / 16, y / 16, 61) - 0.5) * 1.4;
    return Math.max(0, Math.min(4, 0.9 + glow * 3.4 + leaves));
  });
  // Weg in die Tiefe
  s.each((x, y) => {
    if (y < 220) return null;
    const t = (y - 220) / (H - 220);
    const half = 12 + t * 260;
    const cx = gx - t * 90;
    if (Math.abs(x - cx) > half) return 1.4 + (noise(x / 8, y / 3, 62) - 0.5);
    return 2.6 + (1 - t) * 1.4 + (noise(x / 6, y / 2, 63) - 0.5) * 0.6;
  }, 0, 220, W, H);
  // Baumstämme
  const trunk = (x: number, w: number, lean: number) => {
    for (let y = 0; y < H - 20; y++) {
      const ox = Math.floor(x + (y - H) * lean);
      s.rect(ox, y, w, 1, 0);
      s.set(ox + (ox < gx ? w - 1 : 0), y, 1);
    }
  };
  for (const [x, w, lean] of [
    [8, 14, 0.02],
    [44, 9, -0.01],
    [80, 16, 0.03],
    [130, 7, 0],
    [168, 11, 0.02],
    [214, 6, -0.02],
    [250, 5, 0.01],
    [560, 12, -0.03],
    [600, 18, -0.01],
    [528, 6, 0],
  ] as const)
    trunk(x, w, lean);
  // lange Schatten auf dem Boden
  s.each((x, y) => {
    const band = (x + (y - 220) * 1.8) % 70;
    return band < 10 ? 1 : null;
  }, 0, 250, 260, H);
}

function duskScene(s: Scene): void {
  s.rect(0, 0, W, H, 1);
  // diagonale Linien
  s.each((x, y) => ((x + y) % 14 === 0 && x > 300 ? 2 : null), 0, 0, W, 200);
  s.stars(24, [3], 180);
  // helle Welle mit Mond
  s.each((x, y) => (x > 330 && y > 150 + Math.sin(x * 0.018) * 40 - (x - 330) * 0.18 ? 4 : null));
  s.disc(560, 70, 30, 4);
  s.each((x, y) => (Math.abs(Math.hypot(x - 560, y - 70) - 30) < 1 ? 3 : null), 520, 30, 600, 110);
  // Blöcke
  const block = (x: number, y: number, w: number, h: number, depth: number, front: number) => {
    s.rect(x, y, w, h, front);
    s.rect(x, y - depth, w + depth, depth, 3);
    s.rect(x + w, y - depth, depth, h + depth, 2);
    s.rect(x - 1, y - depth - 1, w + depth + 2, 1, 0);
    s.rect(x - 1, y - depth, 1, h + depth, 0);
    s.rect(x + w + depth, y - depth, 1, h + depth, 0);
  };
  block(40, 170, 60, 200, 0, 0);
  block(120, 110, 70, 260, 10, 1);
  block(250, 200, 80, 170, 10, 1);
  block(300, 250, 90, 120, 10, 1);
  block(440, 270, 60, 100, 8, 2);
  // Kometenschweif
  for (let k = 0; k < 40; k++) s.set(180 + k * 0.6, 100 - Math.sqrt(k) * 6, k < 20 ? 4 : 3);
}

export const PALETTE_THEMES: PaletteTheme[] = [
  { id: 'slimy', name: 'Slimy', desc: 'Grün und Nachtblau: Weltraum-Schleim mit Galaxie, hohle Umriss-Schrift und Kugel-Knöpfe.', colors: ['#d1cb95', '#40985e', '#1a644e', '#04373b', '#0a1a2f'], scene: slimyScene },
  { id: 'sunset', name: 'Sunset Beach', desc: 'Warmer Sonnenuntergang am Strand: flache, sonnige Blöcke ohne harte Kanten.', colors: ['#f5ddbc', '#fabb64', '#fd724e', '#a02f40', '#5f2f45'], scene: sunsetScene },
  { id: 'noir', name: 'Noir', desc: 'Pink-Noir mit Jalousien und Regen: Filmbalken, schräge Knöpfe, harte Schatten.', colors: ['#292b30', '#613854', '#ab6c84', '#ffc4d1', '#ffe8e1'], scene: noirScene },
  { id: 'ridge', name: 'Ridge', desc: 'Bergsilhouetten in der Abendsonne: Menü rechts, Pfeil-Knöpfe, Panels mit Bergkante. Vögel und Pollen bewegen sich.', colors: ['#ffe18f', '#ff9f74', '#de4c63', '#7c183c', '#31112d'], scene: mountainScene, fx: { frames: 6, duration: 1.2, draw: ridgeFx } },
  { id: 'lantern', name: 'Lantern', desc: 'Dunkle Taverne im Laternenlicht: geschnitzte Holztafeln und Messingschilder. Die Flamme flackert, Staub tanzt im Licht.', colors: ['#100f13', '#3a213a', '#693540', '#914e3c', '#c7955c'], scene: tavernScene, fx: { frames: 4, duration: 0.8, draw: lanternFx } },
  { id: 'orbit', name: 'Orbit', desc: 'Planet im All: dünne Sci-Fi-Linien, nur Eckklammern statt Rahmen. Sterne funkeln, eine Sternschnuppe zieht vorbei.', colors: ['#fcbbab', '#b96889', '#583163', '#19112b', '#000000'], scene: planetScene, fx: { frames: 8, duration: 2.4, draw: orbitFx } },
  { id: 'sepia', name: 'Sepia Film', desc: 'Goldener Herbstwald wie ein alter Film: Filmstreifen-Rand und Titelkarten-Knöpfe.', colors: ['#000000', '#4e1503', '#9a641e', '#d6a956', '#fffda3'], scene: forestScene },
  { id: 'dusk', name: 'Dusk Blocks', desc: 'Geometrische Blöcke in der Dämmerung: flach, dicke Umrisse, harte versetzte Schatten.', colors: ['#2d2b33', '#453663', '#7c4a5a', '#bf6d69', '#eef0e0'], scene: duskScene },
];

const cache = new Map<string, string>();

/** Animationsstreifen: alle Frames nebeneinander (Breite 640 × frames). */
export function fxUrl(t: PaletteTheme): string | null {
  if (!t.fx) return null;
  const key = `fx:${t.id}`;
  let url = cache.get(key);
  if (!url) {
    const c = document.createElement('canvas');
    c.width = W * t.fx.frames;
    c.height = H;
    const ctx = c.getContext('2d')!;
    for (let f = 0; f < t.fx.frames; f++) {
      const s = new Scene(uiRamp(t), 1000 + f);
      t.fx.draw(s, f);
      ctx.putImageData(s.toImageData(), f * W, 0);
    }
    url = c.toDataURL();
    cache.set(key, url);
  }
  return url;
}

export function sceneUrl(t: PaletteTheme): string {
  let url = cache.get(t.id);
  if (!url) {
    const s = new Scene(uiRamp(t));
    s.rect(0, 0, W, H, 0);
    t.scene(s);
    url = s.toDataURL();
    cache.set(t.id, url);
  }
  return url;
}

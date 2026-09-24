// Design 25 · Idle Crystal – eigenes Design im Stil typischer Idle-Games:
// knallbunt, große Zahlen, schwebende Insel mit Regenbogen-Kristall.

import { fixedRng, type PaletteTheme, Scene } from './palettes';

const W = 640;

/** Winzige 3×5-Ziffern für aufsteigende „+123“-Zahlen. */
const DIGITS: Record<string, string[]> = {
  '+': ['...', '.#.', '###', '.#.', '...'],
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '.##', '..#', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '###'],
  K: ['#.#', '##.', '#..', '##.', '#.#'],
};

/** Schreibt Text mit dunklem Rand (wie Schadenszahlen in Idle-Games). */
function pixelText(s: Scene, text: string, x: number, y: number, col: string, outline = '#0f0420'): void {
  let cx = x;
  for (const ch of text) {
    const g = DIGITS[ch];
    if (!g) continue;
    for (let j = 0; j < 5; j++)
      for (let i = 0; i < 3; i++)
        if (g[j]![i] === '#')
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1]] as const) s.set(cx + i + dx, y + j + dy, outline);
    for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g[j]![i] === '#') s.set(cx + i, y + j, col);
    cx += 4;
  }
}

const RAINBOW = ['#ff2d2d', '#fb7f00', '#fac053', '#8bbd52', '#38dccc', '#3774d4', '#8545b0', '#f070bb', '#ffffff'];

function blobIsland(s: Scene, cx: number, cy: number, rx: number, depth: number, seed: number): void {
  // Grasdecke
  s.use(['#215c1f', '#347423', '#4e8d2b', '#6ba53b', '#8bbd52', '#acd470'], () =>
    s.each((x, y) => {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / (rx * 0.18)) ** 2;
      if (d > 1) return null;
      return 5 - d * 3 + (s.noise(x / 4, y / 4, seed) - 0.5);
    }, cx - rx, cy - rx * 0.2, cx + rx + 1, cy + rx * 0.2 + 1),
  );
  // Erde und Fels darunter, nach unten spitz zulaufend
  s.use(['#29140f', '#40261e', '#583a2f', '#8a561c', '#a36d2d', '#bb8745'], () =>
    s.each((x, y) => {
      const t = (y - cy) / depth;
      const half = rx * (1 - t) ** 1.3 * (0.85 + s.noise(x / 9, y / 9, seed + 1) * 0.3);
      if (Math.abs(x - cx) > half || y < cy + 2) return null;
      const side = (x - cx) / Math.max(1, half);
      return Math.max(0, 4.4 - t * 3 - side * 1.2 + (s.noise(x / 5, y / 3, seed + 2) - 0.5) * 1.2);
    }, cx - rx, cy, cx + rx + 1, cy + depth),
  );
  // Grasrand vorne
  for (let x = cx - rx + 4; x < cx + rx - 4; x++) {
    const edge = Math.round(cy + rx * 0.18 * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2)));
    s.set(x, edge, '#215c1f');
    if ((x * 7) % 5 === 0) s.set(x, edge + 1, '#347423');
  }
}

function idleScene(s: Scene): void {
  // Himmel
  s.use(['#2d5bb8', '#3774d4', '#478eec', '#5da9ff', '#7ecff6', '#a7e1fc'], () => s.each((x, y) => (y / 360) * 5.4));
  // Sonnenstrahlen hinter dem Kristall
  for (let y = 0; y < 360; y++)
    for (let x = 0; x < W; x++) {
      const a = Math.atan2(y - 150, x - 320);
      const d = Math.hypot(x - 320, y - 150);
      if (d < 36 || d > 330) continue;
      if (Math.floor(((a + Math.PI) / (Math.PI * 2)) * 24) % 2 === 0 && (x + y) % 2 === 0) s.set(x, y, d < 160 ? '#d6feff' : '#a8eef4');
    }
  // Wolken
  const cloud = (cx: number, cy: number, r: number, seed: number) => {
    s.use(['#92b4cf', '#b0cfe5', '#dddee1', '#ffffff', '#ffffff'], () =>
      s.each((x, y) => {
        const n = s.fbm(x / 10, y / 10, seed);
        const d = Math.hypot(x - cx, (y - cy) * 1.6) / r + (n - 0.5) * 0.6;
        if (d > 1) return null;
        return 4 - Math.max(0, (y - cy) / (r * 0.35)) * 2.4;
      }, cx - r * 1.3, cy - r, cx + r * 1.3, cy + r),
    );
  };
  cloud(70, 60, 40, 201);
  cloud(560, 44, 46, 202);
  cloud(610, 150, 30, 203);
  cloud(40, 190, 28, 204);
  // kleine schwebende Inseln
  blobIsland(s, 90, 250, 34, 44, 210);
  blobIsland(s, 560, 262, 40, 50, 220);
  s.rect(548, 246, 4, 12, '#40261e');
  s.use(['#215c1f', '#347423', '#4e8d2b', '#8bbd52'], () =>
    s.each((x, y) => (Math.hypot(x - 550, y - 236) < 13 ? 3 - Math.hypot(x - 544, y - 230) / 8 : null), 536, 222, 564, 250),
  );
  // Hauptinsel mit Wasserfall
  blobIsland(s, 320, 212, 96, 120, 230);
  s.use(['#1993ce', '#38a7df', '#7fdce7', '#d6feff'], () =>
    s.each((x, y) => (x >= 384 && x < 396 ? ((y + x * 3) % 7 < 2 ? 3 : 1 + ((x - 384) % 4 === 0 ? 1 : 0)) : null), 384, 220, 396, 360),
  );
  // Kristall
  const cx = 320;
  const top = 76;
  const sh1 = 104;
  const sh2 = 176;
  const bot = 206;
  const hw = 30;
  const inside = (x: number, y: number) => {
    const dx = Math.abs(x - cx);
    if (y < top || y > bot || dx > hw) return false;
    if (y < sh1) return dx <= ((y - top) / (sh1 - top)) * hw;
    if (y > sh2) return dx <= ((bot - y) / (bot - sh2)) * hw;
    return true;
  };
  for (let y = top - 1; y <= bot + 1; y++)
    for (let x = cx - hw - 1; x <= cx + hw + 1; x++) {
      if (inside(x, y)) {
        const col = x < cx - 10 ? 0 : x < cx + 10 ? 1 : 2;
        const row = y < sh1 ? 0 : y > sh2 ? 2 : 1;
        const shade = col === 0 ? 0 : col === 1 ? 1 : 2;
        const base = RAINBOW[(row * 3 + col) % 8]!;
        s.set(x, y, base);
        if (shade === 2 && (x + y) % 2 === 0) s.set(x, y, row === 1 ? '#302355' : '#524b8b');
        if (shade === 0 && (x + y) % 3 === 0) s.set(x, y, '#ffffff');
      } else if (inside(x - 1, y) || inside(x + 1, y) || inside(x, y - 1) || inside(x, y + 1)) s.set(x, y, '#0f0420');
    }
  // Facettenlinien + Glanz
  s.line(cx - 10, sh1, cx - 10, sh2, '#0f0420');
  s.line(cx + 10, sh1, cx + 10, sh2, '#0f0420');
  s.line(cx - hw, sh1, cx + hw, sh1, '#0f0420');
  s.line(cx - hw, sh2, cx + hw, sh2, '#0f0420');
  s.line(cx, top, cx - 10, sh1, '#0f0420');
  s.line(cx, top, cx + 10, sh1, '#0f0420');
  s.line(cx, bot, cx - 10, sh2, '#0f0420');
  s.line(cx, bot, cx + 10, sh2, '#0f0420');
  s.rect(cx - 24, sh1 + 6, 3, 40, '#ffffff');
  s.rect(cx - 24, sh1 + 50, 3, 6, '#ffffff');
  // kleine Kristalle auf der Insel
  const shard = (x: number, y: number, h: number, c: string) => {
    for (let i = 0; i < h; i++) {
      const w = Math.max(1, Math.round((i / h) * 5));
      s.rect(x - w, y - h + i, w * 2, 1, c);
    }
    s.set(x - 1, y - h + 2, '#ffffff');
  };
  shard(260, 214, 18, '#38dccc');
  shard(272, 216, 11, '#f070bb');
  shard(376, 214, 16, '#fac053');
  shard(388, 217, 9, '#8545b0');
  // Glitzer
  const r = fixedRng(240);
  for (let i = 0; i < 30; i++) {
    const x = Math.floor(r() * W);
    const y = Math.floor(r() * 200);
    s.set(x, y, '#ffffff');
    if (r() < 0.4) {
      s.set(x - 1, y, '#d6feff');
      s.set(x + 1, y, '#d6feff');
      s.set(x, y - 1, '#d6feff');
      s.set(x, y + 1, '#d6feff');
    }
  }
}

function idleFx(s: Scene, f: number): void {
  const n = 8;
  // aufsteigende Zahlen um den Kristall
  const nums: [string, number, number, number, string][] = [
    ['+125', 262, 120, 0, '#fac053'],
    ['+1K', 360, 96, 3, '#ffffff'],
    ['+48', 300, 70, 5, '#8bbd52'],
    ['+2K', 372, 150, 6, '#fac053'],
    ['+310', 244, 160, 2, '#38dccc'],
  ];
  for (const [txt, x, y, ph, col] of nums) {
    const k = (f + ph) % n;
    if (k > 5) continue;
    pixelText(s, txt, x, y - k * 5, k > 3 ? '#fb7f00' : col);
  }
  // drehende Münzen
  const coins: [number, number, number][] = [
    [214, 196, 0],
    [424, 186, 2],
    [236, 226, 4],
    [404, 232, 6],
  ];
  for (const [x, y, ph] of coins) {
    const k = (f + ph) % n;
    const bob = [0, -1, -2, -3, -3, -2, -1, 0][k]!;
    const w = [4, 3, 1, 3, 4, 3, 1, 3][k]!;
    for (let j = -4; j <= 4; j++) {
      const ww = Math.round(w * Math.sqrt(1 - (j / 4.6) ** 2));
      s.rect(x - ww - 1, y + j + bob, ww * 2 + 2, 1, '#422700');
    }
    for (let j = -3; j <= 3; j++) {
      const ww = Math.round(Math.max(0, w - 1) * Math.sqrt(1 - (j / 3.6) ** 2));
      s.rect(x - ww, y + j + bob, ww * 2 + 1, 1, j < 0 ? '#f6e742' : '#efa323');
    }
    if (w > 2) s.set(x - 1, y - 2 + bob, '#ffffff');
  }
  // pulsierender Ring um den Kristall
  const rr = 44 + (f % 4) * 3;
  for (let a = 0; a < 120; a++) {
    const ang = (a / 120) * Math.PI * 2;
    if ((a + f) % 3) continue;
    s.set(320 + Math.cos(ang) * rr, 141 + Math.sin(ang) * rr * 1.25, f % 2 ? '#ffffff' : '#d6feff');
  }
}

export function idleTheme(colors: string[]): PaletteTheme {
  return {
    id: 'idle',
    name: 'Idle Crystal',
    desc: 'Eigenes Design im Stil typischer Idle-Games, in allen Farben: große Zahlen mit Einkommen pro Sekunde, Bonbon-Knöpfe, Benachrichtigungen, Tab-Leiste und ein Regenbogen-Kristall auf einer Insel.',
    colors,
    ui: ['#0f0420', '#1e2e77', '#3774d4', '#89c3ff', '#ffffff'],
    accents: {
      green: '#6ba53b',
      lime: '#acd470',
      dgreen: '#215c1f',
      gold: '#fac053',
      dgold: '#b15901',
      orange: '#fb7f00',
      red: '#e36558',
      dred: '#8e0024',
      pink: '#f070bb',
      purple: '#8545b0',
      dpurple: '#30114a',
      cyan: '#38dccc',
      navy: '#151c53',
      sky: '#7ecff6',
    },
    sprite: 'normal',
    scene: idleScene,
    fx: { frames: 8, duration: 1.2, draw: idleFx },
  };
}

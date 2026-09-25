// Pixel-Requisiten der Räume in voller Farbe: Schatztruhe, Goblin-Stand,
// Magier, Orte zum Verbrennen von Karten. Alles aus Rechtecken gebaut,
// danach automatische Kontur.

import { INK, PixelGrid, mix, shade } from '../../art/pixel';
import type { Palette } from '../../art/sprites';
import type { RaceId } from '../data';

const WOOD = '#8b5a33';
const WOOD_D = '#56361f';
const WOOD_L = '#b07a48';
const GOLD = '#f6c23a';
const GOLD_D = '#a8741a';
const GOLD_L = '#fff0a0';

export function chest(open: boolean): PixelGrid {
  const g = new PixelGrid(40, 34);
  // Korpus
  g.rect(4, 16, 32, 16, WOOD).rect(4, 16, 32, 2, WOOD_L).rect(4, 30, 32, 2, WOOD_D);
  for (let x = 8; x < 36; x += 7) g.rect(x, 18, 1, 12, WOOD_D);
  g.rect(4, 16, 3, 16, GOLD).rect(33, 16, 3, 16, GOLD).rect(4, 16, 1, 16, GOLD_L).rect(35, 16, 1, 16, GOLD_D);
  // Schloss
  g.rect(17, 18, 6, 7, GOLD).rect(18, 19, 4, 1, GOLD_L).rect(19, 21, 2, 3, INK);
  if (open) {
    // Deckel nach hinten geklappt + Goldhaufen + Licht
    g.rect(4, 4, 32, 10, WOOD_D).rect(4, 4, 32, 2, WOOD).rect(4, 4, 3, 10, GOLD_D).rect(33, 4, 3, 10, GOLD_D);
    g.rect(7, 12, 26, 5, GOLD).rect(9, 11, 6, 2, GOLD_L).rect(20, 10, 8, 3, GOLD).rect(22, 10, 3, 1, GOLD_L);
    g.dots(GOLD_L, [[12, 13], [26, 14], [17, 12]]);
  } else {
    g.rect(3, 8, 34, 9, WOOD).rect(3, 8, 34, 2, WOOD_L).rect(5, 5, 30, 4, WOOD).rect(7, 4, 26, 2, WOOD_L);
    g.rect(3, 8, 3, 9, GOLD).rect(34, 8, 3, 9, GOLD).rect(3, 15, 34, 2, WOOD_D);
  }
  g.outline(INK);
  // Schatten
  g.rect(6, 33, 28, 1, 'rgba(0,0,0,0.4)');
  return g;
}

/** Holzstand mit gestreiftem Dach und Goblin dahinter. */
export function goblinStall(): PixelGrid {
  const g = new PixelGrid(170, 120);
  const RED = '#c8323c';
  const CREAM = '#f3e8c9';
  // Pfosten
  g.rect(8, 26, 6, 90, WOOD).rect(8, 26, 2, 90, WOOD_L).rect(156, 26, 6, 90, WOOD).rect(160, 26, 2, 90, WOOD_D);
  // Rückwand
  g.rect(14, 34, 142, 50, '#5a3a22');
  for (let y = 38; y < 84; y += 6) g.rect(14, y, 142, 1, '#4a2f1b');
  // Goblin
  const SK = '#6fb04a';
  const SKD = '#3f7a2c';
  const SKL = '#9ad66a';
  g.rect(70, 44, 30, 26, SK).rect(70, 44, 4, 26, SKD).rect(74, 45, 20, 3, SKL); // Kopf
  g.rect(60, 50, 10, 6, SK).rect(58, 48, 4, 4, SK).rect(100, 50, 10, 6, SK).rect(108, 48, 4, 4, SK); // Ohren
  g.rect(78, 52, 5, 5, '#fff4b0').rect(89, 52, 5, 5, '#fff4b0').rect(80, 54, 2, 2, INK).rect(91, 54, 2, 2, INK); // Augen
  g.rect(82, 62, 9, 2, INK).rect(83, 64, 2, 2, '#fff').rect(88, 64, 2, 2, '#fff'); // grinsender Mund
  g.rect(84, 57, 4, 4, SKD); // Nase
  g.rect(68, 38, 34, 8, '#7a3d8c').rect(76, 32, 18, 7, '#7a3d8c').rect(82, 28, 6, 5, '#7a3d8c').rect(70, 38, 34, 2, '#a05ab8'); // Kapuze
  g.rect(66, 70, 38, 14, '#7a3d8c').rect(66, 70, 38, 2, '#a05ab8'); // Körper
  g.rect(58, 72, 8, 10, SK).rect(104, 72, 8, 10, SK); // Hände auf dem Tresen
  g.rect(112, 66, 6, 10, GOLD).rect(113, 67, 2, 2, GOLD_L); // Münzen in der Hand
  // Tresen
  g.rect(2, 82, 166, 12, WOOD).rect(2, 82, 166, 2, WOOD_L).rect(2, 92, 166, 2, WOOD_D);
  g.rect(8, 94, 154, 24, WOOD_D);
  for (let x = 14; x < 160; x += 12) g.rect(x, 96, 1, 22, '#3f2716');
  // Schild
  g.rect(60, 100, 50, 12, CREAM).rect(60, 100, 50, 1, '#fff');
  // „SHOP“ in Pixeln
  const letters: Record<string, string[]> = {
    S: ['###', '#..', '###', '..#', '###'],
    H: ['#.#', '#.#', '###', '#.#', '#.#'],
    O: ['###', '#.#', '#.#', '#.#', '###'],
    P: ['###', '#.#', '###', '#..', '#..'],
  };
  let lx = 71;
  for (const ch of 'SHOP') {
    letters[ch]!.forEach((row, y) => [...row].forEach((c, x) => c === '#' && g.set(lx + x, 104 + y, RED)));
    lx += 8;
  }
  // Dach mit Streifen
  for (let x = 0; x < 170; x++) {
    const stripe = Math.floor(x / 14) % 2 === 0 ? RED : CREAM;
    const h = 22 + (x % 14 < 7 ? 0 : 0);
    g.rect(x, 10, 1, h, stripe);
    // gewellter Saum
    if ((x % 14) < 12) g.set(x, 32, stripe);
  }
  g.rect(0, 8, 170, 3, shade(RED, 0.7)).rect(0, 10, 170, 1, '#ff8a86');
  // Laterne
  g.rect(140, 40, 8, 10, GOLD).rect(141, 42, 6, 6, '#ffe86a').rect(143, 34, 2, 6, INK);
  return g.outline(INK);
}

/** Magier, der die Hand nach oben rechts ausstreckt (links im Bild). */
export function mage(p: Palette): PixelGrid {
  const g = new PixelGrid(90, 130);
  const robe = p.B;
  const robeD = p.D;
  const robeL = p.L;
  const skin = '#f2c29b';
  const skinD = '#c98a67';
  // Robe (weit, bis zum Boden)
  for (let y = 50; y < 126; y++) {
    const half = 12 + Math.floor((y - 50) * 0.28);
    g.rect(34 - half, y, half * 2, 1, robe);
    g.rect(34 - half, y, 3, 1, robeD);
    g.set(34 + half - 2, y, robeL);
  }
  g.rect(30, 50, 8, 76, robeD); // Mittelfalte
  g.rect(18, 86, 32, 4, GOLD).rect(18, 86, 32, 1, GOLD_L); // Gürtel
  // Kopf
  g.rect(26, 30, 16, 16, skin).rect(26, 42, 16, 4, skinD);
  g.rect(36, 35, 2, 2, INK).rect(30, 35, 2, 2, INK);
  // Bart
  g.rect(24, 40, 20, 18, '#e8e4dc').rect(28, 58, 12, 6, '#e8e4dc').rect(31, 64, 6, 4, '#e8e4dc').rect(24, 40, 3, 14, '#bdb8ae');
  g.rect(30, 44, 8, 2, '#8a8680');
  // Spitzhut
  for (let y = 0; y < 26; y++) {
    const half = Math.floor(y * 0.55);
    g.rect(38 - half - Math.floor(y * 0.15), y + 4, half * 2 + 1, 1, robe);
  }
  g.rect(14, 28, 42, 4, robeD).rect(14, 28, 42, 1, robeL);
  g.dots(GOLD_L, [[36, 14], [30, 20], [40, 24]]);
  // Stab in der linken Hand
  g.rect(12, 40, 3, 86, WOOD).rect(12, 40, 1, 86, WOOD_L);
  g.rect(8, 32, 11, 9, p.glow).rect(10, 34, 7, 5, '#ffffff');
  g.rect(15, 70, 6, 6, skin);
  // Rechter Arm nach oben rechts, Handfläche nach oben
  for (let k = 0; k < 30; k++) g.rect(44 + k, 62 - Math.floor(k * 0.7), 7, 7, k < 24 ? robe : skin);
  g.rect(48, 56, 20, 3, robeL);
  g.rect(72, 38, 12, 5, skin).rect(72, 42, 12, 2, skinD).rect(82, 35, 3, 5, skin).rect(71, 36, 3, 4, skin); // offene Hand
  g.outline(INK);
  g.rect(8, 127, 56, 2, 'rgba(0,0,0,0.4)');
  return g;
}

/** Der Ort, an dem in dieser Welt Karten verbrannt werden. */
export function pyreProp(race: RaceId): PixelGrid {
  const g = new PixelGrid(120, 70);
  const flame = (cx: number, base: number, h: number) => {
    for (let y = 0; y < h; y++) {
      const half = Math.max(1, Math.round(Math.sin(((y + 1) / (h + 1)) * Math.PI) * h * 0.35));
      const col = y < h * 0.3 ? '#fff4b0' : y < h * 0.6 ? '#ffb238' : '#e8471f';
      g.rect(cx - half, base - h + y, half * 2, 1, col);
    }
  };
  switch (race) {
    case 'ashclan': {
      for (let y = 0; y < 30; y++)
        for (let x = 0; x < 120; x++) {
          const d = ((x - 60) / 58) ** 2 + ((y - 15) / 14) ** 2;
          if (d < 1) g.set(x, y + 36, d > 0.8 ? '#4a2a22' : d > 0.55 ? '#c8321c' : (x + y) % 5 === 0 ? '#fff4b0' : '#ff8a1c');
        }
      flame(40, 50, 18);
      flame(78, 48, 22);
      break;
    }
    case 'wildwood': {
      g.rect(24, 20, 72, 44, '#6a4527').rect(24, 20, 72, 6, '#8a6a3a').rect(24, 20, 8, 44, '#4a2f1b');
      for (let r = 4; r < 30; r += 6) for (let a = 0; a < 40; a++) g.set(60 + Math.cos(a / 6.4) * r, 23 + Math.sin(a / 6.4) * r * 0.12, '#5a3a22');
      g.rect(20, 56, 12, 8, '#3f7a2c').rect(88, 50, 14, 14, '#3f7a2c');
      g.rect(30, 12, 10, 8, '#d23a3a').rect(32, 14, 2, 2, '#fff').rect(34, 20, 4, 6, '#f3e8c9');
      g.rect(80, 14, 8, 6, '#d23a3a').rect(82, 20, 3, 5, '#f3e8c9');
      break;
    }
    case 'tidebound': {
      for (let y = 0; y < 50; y++)
        for (let x = 0; x < 120; x++) {
          const dx = (x - 60) / 58;
          const dy = (y - 25) / 22;
          const d = Math.hypot(dx, dy);
          if (d > 1) continue;
          const ang = Math.atan2(dy, dx) + d * 7;
          g.set(x, y + 16, Math.sin(ang * 3) > 0.3 ? '#d4f4ff' : d < 0.3 ? '#06214a' : '#2f7fd8');
        }
      break;
    }
    case 'sunlegion': {
      g.rect(30, 34, 60, 30, '#e6dcc4').rect(30, 34, 60, 3, '#fff8e8').rect(84, 34, 6, 30, '#b8ab8e');
      g.rect(24, 60, 72, 6, '#d0c4a8');
      g.rect(44, 40, 32, 6, GOLD).rect(56, 46, 8, 14, GOLD_D);
      flame(60, 34, 26);
      break;
    }
    case 'plague': {
      g.rect(20, 40, 80, 24, '#1a1022').rect(20, 40, 80, 3, '#5a3a22');
      g.rect(8, 30, 20, 34, '#6a5a42').rect(100, 34, 16, 30, '#6a5a42');
      g.rect(84, 4, 22, 34, '#8a8a92').rect(84, 4, 22, 3, '#b0b0b8').rect(93, 10, 4, 14, '#5a5a62').rect(88, 14, 14, 4, '#5a5a62');
      g.dots('#9dff6a', [[40, 44], [70, 48], [55, 52]]);
      break;
    }
    case 'deepforge': {
      g.rect(20, 6, 80, 60, '#6a5a52').rect(20, 6, 80, 4, '#8a7a72');
      for (let y = 12; y < 66; y += 6) for (let x = 22 + ((y / 6) % 2) * 5; x < 98; x += 10) g.rect(x, y, 1, 5, '#4a3a32');
      for (let y = 12; y < 66; y += 6) g.rect(20, y, 80, 1, '#4a3a32');
      g.rect(40, 30, 40, 30, '#1a0c08');
      flame(60, 60, 24);
      g.rect(36, 26, 48, 4, '#3a2a22');
      break;
    }
    case 'drifters': {
      g.rect(34, 56, 52, 6, WOOD).rect(40, 52, 40, 6, WOOD_D).rect(30, 60, 60, 4, '#6a6a72');
      flame(60, 56, 30);
      g.rect(22, 58, 8, 6, '#8a8a92').rect(92, 58, 8, 6, '#8a8a92');
      break;
    }
  }
  return g.outline(INK);
}

/** Leuchtender Kristall/Enchantment in einer Seltenheitsfarbe (für die Anzeige). */
export function gem(color: string, dark: string): PixelGrid {
  const g = new PixelGrid(18, 22);
  const L = mix(color, '#ffffff', 0.6);
  for (let y = 0; y < 22; y++) {
    const half = y < 8 ? Math.floor(y * 1.1) + 1 : Math.max(1, Math.floor((22 - y) * 0.6));
    for (let x = 9 - half; x < 9 + half; x++) g.set(x, y, x < 9 ? (y < 8 ? L : color) : y < 8 ? color : dark);
  }
  g.rect(8, 2, 2, 5, '#ffffff');
  return g.outline(INK);
}

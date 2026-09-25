import { Scene } from '../../lab/palettes';
import type { RaceId } from '../data';

export type RoomScenery = 'fork' | 'treasure' | 'pyre' | 'enchant' | 'shop';
type Point = readonly [number, number];

// Authored silhouettes on the game's native pixel grid. Solid colour clusters
// do the drawing; ordered dithering is confined to soil and distant atmosphere.
function poly(s: Scene, points: readonly Point[], col: number): void {
  const lo = Math.max(0, Math.floor(Math.min(...points.map(p => p[1]))));
  const hi = Math.min(359, Math.ceil(Math.max(...points.map(p => p[1]))));
  for (let y = lo; y <= hi; y++) {
    const hits: number[] = [];
    points.forEach((a, i) => {
      const b = points[(i + 1) % points.length]!;
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y))
        hits.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
    });
    hits.sort((a, b) => a - b);
    for (let i = 0; i + 1 < hits.length; i += 2)
      s.rect(Math.ceil(hits[i]!), y, Math.floor(hits[i + 1]!) - Math.ceil(hits[i]!) + 1, 1, col);
  }
}

function oval(s: Scene, x: number, y: number, rx: number, ry: number, col: number): void {
  for (let j = -ry; j <= ry; j++) {
    const w = Math.floor(rx * Math.sqrt(Math.max(0, 1 - j * j / (ry * ry))));
    s.rect(x - w, y + j, w * 2 + 1, 1, col);
  }
}

function stone(s: Scene, x: number, y: number, w: number, h: number, light = 2): void {
  poly(s, [[x, y + 3], [x + 4, y], [x + w - 3, y + 1], [x + w, y + h - 3], [x + w - 2, y + h], [x, y + h]], 0);
  poly(s, [[x + 1, y + 3], [x + 5, y + 1], [x + w - 4, y + 2], [x + w - 3, y + h - 2], [x + 2, y + h - 2]], light);
  s.line(x + 4, y + 2, x + w - 5, y + 2, Math.min(3, light + 1));
  s.line(x + w - 5, y + 5, x + w - 4, y + h - 2, 1);
}

function grass(s: Scene, x: number, y: number, col = 1): void {
  s.line(x - 4, y - 3, x - 1, y, col);
  s.line(x, y - 6, x + 1, y, col);
  s.line(x + 5, y - 4, x + 2, y, col);
}

function crown(s: Scene, x: number, y: number, scale: number, col: number): void {
  const shape: Point[] = [[-40, 8], [-48, -2], [-43, -13], [-31, -16], [-34, -26], [-19, -32], [-8, -28], [2, -39], [20, -34], [24, -24], [39, -23], [43, -11], [36, -3], [45, 6], [31, 18], [16, 17], [6, 25], [-12, 19], [-28, 22]];
  poly(s, shape.map(([a, b]) => [x + Math.round(a * scale), y + Math.round(b * scale)]), col);
  // Short leaf clusters, never a full-screen noise pattern.
  for (let i = 0; i < 18; i++) {
    const xx = x + Math.floor((s.rnd() - .5) * 65 * scale);
    const yy = y + Math.floor((s.rnd() - .6) * 30 * scale);
    s.rect(xx, yy, 3 + Math.floor(s.rnd() * 5), 1, Math.min(2, col + 1));
    s.rect(xx - 1, yy + 1, 3, 1, col);
  }
}

function tree(s: Scene, x: number, base: number, w: number, lean: number, dark = false): void {
  poly(s, [[x - w, base + 5], [x - w / 2, base - 24], [x - w / 2 + lean, 0], [x + w / 2 + lean, 0], [x + w / 2, base - 18], [x + w + 12, base + 7], [x + 7, base + 3], [x, base - 5]], 0);
  if (!dark) {
    poly(s, [[x - w / 2 + 2, base - 16], [x - w / 2 + lean + 2, 0], [x + lean + 1, 0], [x - 1, base - 8], [x - w + 3, base + 2]], 2);
    poly(s, [[x, base - 20], [x + lean + 2, 0], [x + w / 2 + lean - 2, 0], [x + w / 2 - 2, base - 22], [x + w + 4, base + 4]], 1);
    for (let j = 0; j < 12; j++) {
      const y = 45 + j * 22;
      const xx = x + Math.round(lean * (1 - y / base));
      s.line(xx - 3, y, xx - 4, y + 11, 0);
      s.line(xx - 6, y + 2, xx - 6, y + 7, 3);
    }
  }
  poly(s, [[x, 133], [x - 34, 103], [x - 52, 68], [x - 34, 92], [x + 5, 113]], dark ? 0 : 1);
  poly(s, [[x + 1, 89], [x + 30, 65], [x + 47, 28], [x + 39, 68], [x + 10, 111]], 0);
}

function woodland(s: Scene, kind: RoomScenery): void {
  s.rect(0, 0, 640, 360, 0);
  s.each((x, y) => 1 + Math.max(0, 1 - Math.abs(x - 290) / 220) * .22, 30, 58, 607, 220);
  for (let i = 0; i < 22; i++) {
    const x = 18 + i * 29 + Math.floor(s.rnd() * 12);
    const y = 171 + Math.floor(s.rnd() * 26);
    const w = 3 + Math.floor(s.rnd() * 5);
    poly(s, [[x - 6, y], [x, y - 19], [x + 4, 47], [x + w + 4, 47], [x + w, y]], i % 3 ? 0 : 2);
    s.line(x + 4, 123, x - 10, 100, 0);
    s.line(x + 5, 101, x + 19, 84, 0);
  }
  poly(s, [[0, 186], [90, 178], [153, 193], [244, 181], [345, 192], [420, 180], [537, 191], [640, 177], [640, 360], [0, 360]], 1);
  // Broken patches of leaf litter instead of uniform stippling.
  for (let i = 0; i < 210; i++) {
    const x = Math.floor(s.rnd() * 640), y = 195 + Math.floor(s.rnd() * 165);
    s.rect(x, y, 2 + Math.floor(s.rnd() * 5), 1, i % 4 ? 0 : 2);
    if (i % 5 === 0) grass(s, x, y, 0);
  }
  for (const [x, y, k] of [[27, 176, 1], [102, 182, .8], [562, 183, 1.1], [624, 167, 1]] as const) crown(s, x, y, k, 0);
  // The title and the right-hand details panel have quiet backing.
  if (kind !== 'fork' && kind !== 'treasure') s.rect(469, 58, 139, 250, 0);
}

function path(s: Scene, points: readonly Point[]): void {
  poly(s, points, 2);
  // Only sparse, horizontal chips on the path, with no soft raster gradients.
}

function foreground(s: Scene, kind: RoomScenery): void {
  tree(s, 26, 344, 31, -12);
  tree(s, 611, 354, 35, 16);
  tree(s, 66, 280, 13, -18, true);
  if (kind === 'fork' || kind === 'treasure') tree(s, 569, 293, 15, 21, true);
  for (const [x, y, k] of [[17, 28, 1.5], [91, 7, 1.2], [163, -8, 1.3], [476, -12, 1.3], [555, 8, 1.4], [635, 30, 1.5]] as const) crown(s, x, y, k, 0);
  for (const [x, y] of [[51, 339], [90, 348], [551, 339], [590, 355], [48, 275], [579, 294]] as const) grass(s, x, y, 2);
}

function fork(s: Scene, boss: boolean, race: RaceId): void {
  if (boss) {
    path(s, [[278, 360], [301, 213], [302, 148], [339, 148], [341, 211], [378, 360]]);
    for (const x of [270, 349]) for (let j = 0; j < 7; j++) stone(s, x, 98 + j * 14, 21, 15, 1);
    stone(s, 269, 87, 102, 15, 2);
  } else {
    path(s, [[257, 360], [284, 277], [223, 232], [144, 176], [155, 169], [250, 216], [320, 253], [386, 215], [487, 170], [498, 179], [413, 235], [352, 281], [390, 360]]);
    // Uneven verges and a small route marker in the visible gap between panels.
    poly(s, [[260, 360], [281, 299], [277, 310], [269, 312], [271, 329], [249, 360]], 0);
    s.rect(318, 186, 5, 56, 0); s.rect(319, 187, 2, 53, 2);
    poly(s, [[296, 193], [323, 190], [333, 195], [324, 201], [296, 203]], 0);
    poly(s, [[298, 194], [322, 192], [329, 195], [323, 198], [298, 201]], 3);
    poly(s, [[311, 204], [336, 207], [343, 212], [334, 216], [310, 212]], 0);
    s.line(313, 206, 336, 210, 2);
    stone(s, 332, 242, 14, 8, 1);
  }
  for (let i = 0; i < 26; i++) {
    const y = 282 + i * 3, x = 294 + Math.floor(s.rnd() * 49);
    s.rect(x, y, 3 + i % 5, 1, i % 3 ? 1 : 3);
  }
  if (race === 'drifters' || race === 'wildwood' || race === 'plague') {
    tree(s, 248, 198, 15, -46, true);
    tree(s, 393, 193, 18, 42, true);
    if (race !== 'plague') { crown(s, 210, 62, .8, 0); crown(s, 422, 74, .9, 0); }
  } else if (!boss) {
    for (const x of [136, 476]) {
      if (race === 'deepforge' || race === 'sunlegion') {
        s.rect(x - 12, 113, 14, 68, 0); s.rect(x + 31, 113, 14, 68, 0);
        stone(s, x - 15, 103, 63, 14, 2);
        s.rect(x - 9, 118, 5, 43, 2); s.rect(x + 34, 118, 5, 43, 1);
      } else {
        stone(s, x - 10, 156, 16, 27, 1); stone(s, x + 29, 159, 20, 24, 1);
      }
    }
  }
}

function treasure(s: Scene): void {
  path(s, [[273, 360], [291, 314], [254, 287], [241, 249], [278, 224], [370, 230], [391, 270], [351, 309], [376, 360]]);
  // Ruined enclosure leaves the upper central reward panel unobstructed.
  for (const [x, top, rows] of [[166, 146, 8], [438, 161, 7]] as const) {
    for (let j = 0; j < rows; j++) stone(s, x + (j % 2) * 2, top + j * 13, 30, 14, 2);
    stone(s, x - 4, top - 5, 39, 10, 2);
    s.line(x + 9, top + 8, x + 4, top + 55, 0);
    for (let j = 0; j < 7; j++) s.rect(x + 3 + j % 3 * 3, top + j * 9, 8, 3, 1);
  }
  for (let i = 0; i < 6; i++) {
    stone(s, 188 + i * 14, 235 - i * 3, 19, 11, 1);
    stone(s, 383 + i * 10, 225 + i * 5, 18, 12, 1);
  }
  // Low stone plinth aligned to the chest's existing base (320, 282).
  stone(s, 271, 282, 100, 15, 1);
  stone(s, 278, 279, 86, 9, 3);
  s.line(302, 288, 299, 294, 0);
  for (const [x, y] of [[230, 283], [398, 280], [201, 263], [423, 258], [267, 307]] as const) grass(s, x, y, 0);
  poly(s, [[93, 285], [108, 263], [160, 269], [186, 285], [158, 289], [114, 280]], 0);
  s.line(109, 269, 162, 279, 2);
  stone(s, 404, 301, 23, 12, 1);
}

function pyre(s: Scene, race: RaceId): void {
  path(s, [[198, 360], [226, 315], [237, 265], [284, 243], [359, 252], [399, 297], [412, 360]]);
  if (race === 'sunlegion' || race === 'deepforge') {
    for (let i = 0; i < 3; i++) stone(s, 226 + i * 9, 308 - i * 7, 182 - i * 18, 10, 2);
    if (race === 'deepforge') {
      for (const x of [237, 392]) { s.rect(x, 244, 7, 61, 0); s.rect(x + 2, 246, 2, 57, 2); }
      for (let y = 250; y < 279; y += 5) s.rect(243, y, 153, 1, 0);
    }
  } else if (race === 'plague') {
    poly(s, [[261, 269], [352, 260], [389, 303], [285, 320]], 0);
    s.line(286, 316, 378, 302, 2);
    for (let i = 0; i < 6; i++) stone(s, 237 + i * 12, 300 + i % 3 * 5, 13, 7, 1);
  } else {
    oval(s, 318, 293, 102, 30, 0);
    oval(s, 318, 290, 84, 23, race === 'tidebound' ? 2 : 1);
    for (let i = 0; i < 15; i++) {
      const a = i * Math.PI * 2 / 15;
      stone(s, Math.round(312 + Math.cos(a) * 91), Math.round(288 + Math.sin(a) * 28), 13, 7, i < 8 ? 2 : 1);
    }
    if (race === 'wildwood') {
      for (const [x, y] of [[244, 314], [351, 312], [228, 286], [397, 300]] as const) {
        s.line(319, 284, x, y, 0); grass(s, x, y, 2);
      }
    }
  }
  // Split logs and bare silhouettes keep the card row above y=200 calm.
  for (let i = 0; i < 3; i++) {
    poly(s, [[102, 280 + i * 7], [170, 269 + i * 7], [179, 276 + i * 7], [110, 289 + i * 7]], 0);
    s.line(107, 282 + i * 7, 169, 272 + i * 7, 2);
    oval(s, 173, 274 + i * 7, 4, 3, 2);
  }
  if (race === 'drifters' || race === 'wildwood' || race === 'plague' || race === 'ashclan') {
    tree(s, 428, 248, 18, -2, true);
    s.line(430, 172, 444, 151, 2);
  }
  for (let i = 0; i < 42; i++) {
    const x = 258 + Math.floor(s.rnd() * 120), y = 270 + Math.floor(s.rnd() * 38);
    s.rect(x, y, 2, 1, i % 4 ? 0 : 2);
  }
}

function enchant(s: Scene): void {
  // Broken arch frames the mage and the two selectable gems, never the sidebar.
  for (const [x, top, rows] of [[85, 133, 12], [332, 142, 11]] as const) {
    for (let j = 0; j < rows; j++) stone(s, x, top + j * 15, 27, 16, 1);
    stone(s, x - 4, top, 35, 9, 2);
  }
  for (const [x, y, w] of [[99, 113, 35], [121, 95, 37], [150, 85, 39], [185, 80, 37], [219, 81, 33], [267, 97, 32], [293, 116, 37]] as const) stone(s, x, y, w, 20, 2);
  s.line(200, 83, 207, 95, 0);
  // Fitted flagstones below the mage's feet.
  oval(s, 221, 319, 133, 25, 0);
  oval(s, 221, 315, 126, 23, 2);
  for (let y = 301; y < 336; y += 8) {
    const half = Math.floor(122 * Math.sqrt(Math.max(0, 1 - ((y - 315) / 23) ** 2)));
    s.line(221 - half, y, 221 + half, y, 1);
    for (let x = 221 - half + (y % 3) * 12; x < 221 + half; x += 31) s.line(x, y, x + 2, y + 5, 1);
  }
  stone(s, 259, 255, 45, 13, 2);
  stone(s, 267, 267, 28, 39, 1);
  stone(s, 258, 306, 46, 9, 2);
  // A few carved marks, not decorative pseudo-text.
  for (const y of [166, 209, 252]) {
    s.line(342, y, 342, y + 10, 3);
    s.line(338, y + 3, 346, y + 7, 3);
  }
  for (const [x, y] of [[116, 180], [302, 159], [223, 137], [315, 234]] as const) {
    s.set(x, y, 3); s.set(x, y - 1, 2);
  }
  grass(s, 93, 323, 0); grass(s, 353, 323, 0);
}

function shop(s: Scene): void {
  // Timber landing supports the stall and the three cards extending below it.
  poly(s, [[135, 270], [346, 270], [390, 336], [109, 336]], 0);
  for (let j = 0; j < 9; j++) {
    const y = 274 + j * 7;
    const left = 134 - j * 3, right = 346 + j * 5;
    s.rect(left, y, right - left, 5, j % 3 === 0 ? 2 : 1);
    s.line(left + 2, y, right - 2, y, 2);
    for (const x of [145, 341]) s.set(x, y + 2, 0);
  }
  // Supply crates beside the awning, with visible end grain and bracing.
  const crate = (x: number, y: number, w: number, h: number) => {
    s.rect(x, y, w, h, 0); s.rect(x + 2, y + 2, w - 4, h - 4, 1);
    for (let i = 7; i < w - 2; i += 7) s.rect(x + i, y + 3, 1, h - 6, 0);
    s.rect(x + 2, y + 2, w - 4, 2, 3); s.rect(x + 2, y + h - 5, w - 4, 2, 2);
    s.line(x + 3, y + h - 7, x + w - 4, y + 6, 2);
  };
  crate(358, 248, 41, 34); crate(365, 226, 29, 23); crate(112, 253, 33, 27);
  s.rect(124, 155, 4, 96, 0);
  s.line(125, 156, 153, 165, 2); s.line(151, 165, 151, 181, 0);
  s.rect(145, 180, 13, 18, 0); s.rect(147, 183, 9, 11, 3); s.rect(151, 183, 1, 11, 1);
  s.rect(144, 178, 15, 3, 2); s.rect(145, 196, 13, 2, 2);
  // Low fence behind the trader, kept beneath the room title.
  for (const y of [216, 237]) s.rect(87, y, 326, 4, 1);
  for (const x of [96, 154, 353, 409]) {
    s.rect(x, 204, 5, 56, 0); s.rect(x + 1, 205, 2, 53, 2);
  }
  grass(s, 400, 290, 0); grass(s, 119, 297, 0);
}

function worldGround(s: Scene, race: RaceId): void {
  s.rect(0, 0, 640, 360, 0);
  s.rect(0, 65, 640, 150, 1);
  if (race === 'ashclan') {
    poly(s, [[0, 178], [73, 127], [127, 153], [203, 73], [254, 147], [308, 121], [360, 164], [442, 93], [508, 156], [575, 121], [640, 176], [640, 234], [0, 234]], 0);
    poly(s, [[178, 104], [203, 73], [224, 105], [211, 99], [202, 101], [192, 96]], 2);
    poly(s, [[199, 102], [193, 128], [204, 146], [192, 169], [205, 147], [199, 129], [204, 103]], 3);
    s.rect(0, 218, 640, 142, 1);
    for (let i = 0; i < 25; i++) {
      const x = Math.floor(s.rnd() * 640), y = 230 + Math.floor(s.rnd() * 125);
      s.line(x, y, x + 12, y + 4, 0); s.line(x + 12, y + 4, x + 22, y + 1, 0);
    }
  } else if (race === 'tidebound') {
    s.rect(0, 156, 640, 88, 2);
    for (let i = 0; i < 85; i++) {
      const x = Math.floor(s.rnd() * 640), y = 160 + Math.floor(s.rnd() * 84);
      s.rect(x, y, 8 + Math.floor(s.rnd() * 18), 1, i % 4 ? 1 : 3);
    }
    poly(s, [[0, 249], [91, 226], [176, 239], [235, 226], [364, 235], [436, 217], [550, 239], [640, 229], [640, 360], [0, 360]], 1);
    poly(s, [[0, 143], [72, 143], [87, 156], [115, 156], [140, 178], [0, 179]], 0);
    poly(s, [[530, 176], [555, 152], [572, 150], [582, 117], [611, 112], [640, 132], [640, 180]], 0);
    s.line(188, 111, 193, 113, 2); s.line(193, 113, 198, 110, 2);
  } else if (race === 'sunlegion') {
    s.rect(0, 196, 640, 164, 2);
    for (const x of [62, 153, 425, 535]) {
      s.rect(x, 75, 28, 140, 0); s.rect(x + 3, 77, 22, 131, 2);
      s.rect(x + 6, 79, 3, 127, 3); s.rect(x + 19, 79, 3, 127, 1);
      s.rect(x - 5, 74, 38, 7, 3); s.rect(x - 5, 205, 38, 9, 1);
    }
    s.rect(52, 67, 517, 7, 2);
    for (let y = 217; y < 360; y += 19) {
      s.line(0, y, 640, y, 1);
      for (let x = (y % 4) * 23; x < 640; x += 67) s.line(x, y + 1, x + 8, y + 18, 1);
    }
  } else if (race === 'deepforge') {
    for (let y = 66; y < 219; y += 18)
      for (let x = -25 + (y % 4) * 12; x < 640; x += 51) {
        s.rect(x + 1, y + 1, 49, 16, 1); s.line(x + 2, y + 1, x + 48, y + 1, 2);
        s.rect(x + 49, y + 2, 1, 15, 0); s.rect(x, y + 17, 51, 1, 0);
      }
    for (const x of [111, 385]) {
      poly(s, [[x, 206], [x, 126], [x + 14, 110], [x + 41, 110], [x + 55, 126], [x + 55, 206]], 0);
      for (let i = 0; i < 5; i++) s.rect(x + 5 + i * 10, 127, 3, 75, 2);
    }
    s.rect(0, 216, 640, 144, 1);
    for (const x of [75, 422]) {
      s.line(x, 223, x - 49, 359, 0); s.line(x + 6, 223, x - 43, 359, 2);
      for (let y = 244; y < 360; y += 17) s.line(x - (y - 223) * .36 - 7, y, x - (y - 223) * .36 + 15, y, 0);
    }
  }
}

function worldFrame(s: Scene, race: RaceId, kind: RoomScenery): void {
  if (race === 'drifters' || race === 'wildwood' || race === 'plague') {
    if (race !== 'plague') foreground(s, kind);
    else {
      tree(s, 29, 350, 32, -13); tree(s, 609, 347, 28, 18, true);
      tree(s, 78, 238, 12, -26, true); tree(s, 547, 242, 15, 31, true);
      for (const [x, y] of [[94, 240], [397, 320], [523, 227]] as const) {
        stone(s, x, y - 23, 17, 28, 1);
        s.line(x + 8, y - 17, x + 8, y - 6, 3); s.line(x + 5, y - 14, x + 11, y - 14, 3);
      }
      oval(s, 116, 330, 49, 8, 0); s.line(88, 331, 117, 331, 2);
      oval(s, 493, 340, 35, 6, 0);
    }
    if (race === 'wildwood') {
      for (const [x, y] of [[82, 297], [423, 317], [539, 285], [102, 219]] as const) {
        s.rect(x + 5, y - 12, 3, 13, 2);
        poly(s, [[x - 2, y - 12], [x + 1, y - 19], [x + 9, y - 21], [x + 15, y - 16], [x + 16, y - 11]], 3);
        s.rect(x + 2, y - 17, 3, 2, 4); s.rect(x + 10, y - 14, 2, 2, 1);
        grass(s, x - 9, y + 3, 2);
      }
      for (const x of [113, 441]) {
        for (let y = 56; y < 192; y++) {
          const xx = x + Math.round(Math.sin(y / 20) * 8);
          s.set(xx, y, 2);
          if (y % 13 === 0) { s.rect(xx - 4, y, 4, 2, 3); s.rect(xx + 1, y + 4, 5, 2, 2); }
        }
      }
      poly(s, [[45, 310], [105, 334], [173, 340], [196, 355], [169, 345], [101, 340], [42, 322]], 0);
    }
    return;
  }
  if (race === 'ashclan' || race === 'tidebound') {
    for (const [x, flip] of [[0, 1], [640, -1]] as const) {
      const shape: Point[] = [[0, 0], [57, 0], [46, 71], [59, 129], [40, 167], [54, 245], [77, 320], [64, 360], [0, 360]];
      poly(s, shape.map(([a, b]) => [x + a * flip, b]), 0);
      poly(s, [[x + 14 * flip, 0], [x + 40 * flip, 0], [x + 28 * flip, 89], [x + 43 * flip, 138], [x + 29 * flip, 187], [x + 38 * flip, 282], [x + 19 * flip, 328]], 1);
      for (let y = 28; y < 330; y += 39) s.line(x + 12 * flip, y, x + 34 * flip, y + 7, 2);
    }
    if (race === 'ashclan') {
      tree(s, 85, 249, 13, -17, true);
      for (const [x, y] of [[116, 326], [417, 335], [530, 289]] as const) {
        s.line(x, y, x + 13, y - 5, 3); s.line(x + 13, y - 5, x + 25, y - 2, 2);
        s.set(x + 5, y - 19, 3);
      }
    } else {
      for (const [x, y] of [[80, 311], [419, 321], [560, 266]] as const) {
        s.line(x, y, x + 3, y - 23, 2); s.line(x + 2, y - 10, x - 7, y - 18, 2);
        s.line(x + 3, y - 15, x + 11, y - 22, 3);
        s.line(x + 12, y, x + 15, y - 17, 2);
        stone(s, x - 9, y, 30, 8, 1);
      }
      s.line(82, 299, 109, 302, 3); s.line(408, 344, 439, 341, 3);
    }
  } else {
    for (const x of [17, 586]) {
      s.rect(x, 0, 37, 360, 0); s.rect(x + 4, 0, 27, 360, 1);
      s.rect(x + 6, 0, 5, 350, 2);
      for (let y = 48; y < 350; y += 44) {
        s.rect(x, y, 37, 6, 0); s.rect(x + 2, y + 1, 33, 2, 2);
        if (race === 'deepforge') { s.set(x + 8, y + 4, 3); s.set(x + 28, y + 4, 3); }
      }
    }
    if (race === 'sunlegion') {
      for (const x of [92, 523]) {
        poly(s, [[x, 90], [x + 23, 90], [x + 23, 152], [x + 11, 143], [x, 152]], 0);
        s.rect(x + 3, 92, 17, 42, 1); s.disc(x + 11, 109, 5, 3);
        for (const [dx, dy] of [[0, -9], [-9, 0], [9, 0], [0, 9]]) s.line(x + 11 + dx!, 109 + dy!, x + 11 + dx! * .7, 109 + dy! * .7, 3);
      }
    } else {
      for (const x of [80, 433]) {
        s.rect(x, 66, 2, 108, 2);
        for (let y = 71; y < 170; y += 9) s.rect(x - 1, y, 4, 4, 0);
        s.rect(x - 8, 172, 19, 13, 0); s.rect(x - 5, 175, 13, 6, 3);
      }
    }
  }
}

export function drawRoomScenery(s: Scene, kind: RoomScenery, race: RaceId = 'drifters', boss = false): void {
  if (race === 'drifters' || race === 'wildwood' || race === 'plague') woodland(s, kind);
  else worldGround(s, race);
  switch (kind) {
    case 'fork': fork(s, boss, race); break;
    case 'treasure': treasure(s); break;
    case 'pyre': pyre(s, race); break;
    case 'enchant': enchant(s); break;
    case 'shop': shop(s); break;
  }
  worldFrame(s, race, kind);
}

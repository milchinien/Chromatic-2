import type { CardDef, ColorId } from '../data/cards';
import { INK, PixelGrid, SHADOW, mix, shade } from './pixel';

// =====================================================================
// Figuren: Alle Einheiten werden prozedural aus Pixeln gebaut
// (Blickrichtung rechts) und bekommen automatisch eine Kontur + Schatten.
// Pro Figur gibt es: 2 Lauf-Frames, 1 Angriffs-Frame, 1 Treffer-Blitz, 1 Leiche.
// =====================================================================

export interface Palette {
  B: string; // Grundfarbe der Karte
  D: string; // dunkel
  L: string; // hell
  glow: string; // Magie/Effekte
  skin: string;
  skinD: string;
  animal: string; // Reittier-Fell
  stone: string; // Festungsmauer
  blood: string; // Farbe von Blut/Staub beim Tod
}

export const PALETTES: Record<ColorId, Palette> = {
  krieg: { B: '#d0383f', D: '#7e1f31', L: '#f5765a', glow: '#ffb238', skin: '#f2c29b', skinD: '#c98a67', animal: '#7c4a2c', stone: '#8d8080', blood: '#a3202c' },
  natur: { B: '#3f9d3c', D: '#1f5b30', L: '#94d856', glow: '#c2ff6e', skin: '#f2c29b', skinD: '#c98a67', animal: '#a06a3a', stone: '#7f8a72', blood: '#a3202c' },
  stein: { B: '#8b919c', D: '#4e5462', L: '#c8ccd2', glow: '#e9dcb0', skin: '#f2c29b', skinD: '#c98a67', animal: '#6b7282', stone: '#9a9aa3', blood: '#8a8a92' },
  untot: { B: '#7b40ab', D: '#40205e', L: '#b881e6', glow: '#7dffb4', skin: '#a9c09a', skinD: '#71886a', animal: '#e3dcc6', stone: '#6c6078', blood: '#5b3a79' },
  farblos: { B: '#d2bd95', D: '#8b7453', L: '#f3e8c9', glow: '#ffffff', skin: '#f2c29b', skinD: '#c98a67', animal: '#d9b574', stone: '#a79c86', blood: '#a3202c' },
};

export const TEAM_COLORS = [
  { T: '#3ec5ff', TD: '#1c6aa8' }, // Spieler: blau
  { T: '#ffcc33', TD: '#b0700f' }, // Gegner: gelb
] as const;

const METAL = '#dde1e7';
const METAL_D = '#6f7888';
const HELM = '#a9b0bc';
const WOOD = '#8b5a33';
const WOOD_D = '#56361f';
const BONE = '#ece5cf';
const BONE_D = '#b1a684';

type Frame = 'walk0' | 'walk1' | 'attack';

export type VisualKind =
  | 'warrior'
  | 'berserker'
  | 'ranger'
  | 'hammer'
  | 'mage'
  | 'necro'
  | 'healer'
  | 'mount'
  | 'stag'
  | 'wolf'
  | 'bonesteed'
  | 'camel'
  | 'tower'
  | 'bastion'
  | 'citadel'
  | 'tradepost'
  | 'skeleton'
  | 'ghoul';

export function visualKindFor(card: CardDef): VisualKind {
  switch (card.id) {
    case 'skeleton':
      return 'skeleton';
    case 'ghoul':
      return 'ghoul';
    case 'berserker':
      return 'berserker';
    case 'ranger':
      return 'ranger';
    case 'stonebreaker':
      return 'hammer';
    case 'necromancer':
      return 'necro';
    case 'forest-stag':
      return 'stag';
    case 'stone-wolf':
      return 'wolf';
    case 'bone-steed':
      return 'bonesteed';
    case 'nomad-camel':
      return 'camel';
    case 'root-bastion':
      return 'bastion';
    case 'death-citadel':
      return 'citadel';
    case 'trading-post':
      return 'tradepost';
  }
  switch (card.cls) {
    case 'krieger':
      return 'warrior';
    case 'festung':
      return 'tower';
    case 'reittier':
      return 'mount';
    case 'magier':
      return 'mage';
    case 'heiler':
      return 'healer';
  }
}

interface Ctx {
  p: Palette;
  T: string;
  TD: string;
  f: Frame;
}

// --- Menschen (12×13, Füße auf y=11, Schatten y=12) -------------------

const HUMAN_W = 12;
const HUMAN_H = 13;

function legs(g: PixelGrid, c: Ctx, col: string, feet = INK): void {
  if (c.f === 'walk1') {
    g.dots(col, [[5, 10], [7, 10]]).dots(feet, [[4, 11], [8, 11]]);
  } else {
    g.dots(col, [[5, 10], [7, 10]]).dots(feet, [[5, 11], [7, 11]]);
  }
}

function torso(g: PixelGrid, c: Ctx, main = c.p.B, dark = c.p.D, light = c.p.L): void {
  g.rect(4, 6, 4, 4, main).rect(4, 6, 1, 4, dark).set(7, 6, light).set(6, 6, light);
}

function head(g: PixelGrid, c: Ctx, skin = c.p.skin, skinD = c.p.skinD): void {
  g.rect(5, 3, 3, 3, skin).rect(5, 5, 3, 1, skinD).set(7, 4, INK);
}

function drawWarrior(c: Ctx, kind: 'warrior' | 'berserker' | 'hammer'): PixelGrid {
  const g = new PixelGrid(HUMAN_W, HUMAN_H);
  legs(g, c, c.p.D);
  torso(g, c);
  head(g, c);
  // Helm (+ Kamm in Kartenfarbe)
  g.rect(5, 2, 3, 1, c.p.B).set(5, 3, c.p.D).set(6, 3, c.p.B).set(7, 3, HELM).set(6, 2, c.p.L);
  if (kind === 'berserker') g.dots(BONE, [[4, 1], [8, 1], [4, 2], [8, 2]]);
  else g.dots(c.p.L, [[5, 1], [6, 1]]).set(4, 2, c.p.D);
  g.rect(4, 8, 4, 1, c.p.D).set(6, 8, '#c9a24a'); // Gürtel
  // Schild in Teamfarbe
  g.rect(3, 6, 2, 4, c.T).rect(3, 6, 1, 4, c.TD).set(4, 7, shade(c.T, 1.4));
  if (kind === 'hammer') {
    if (c.f === 'attack') {
      g.line(8, 8, 10, 8, WOOD).rect(10, 7, 2, 3, METAL).set(10, 9, METAL_D);
    } else {
      g.line(9, 5, 9, 9, WOOD).rect(8, 3, 3, 2, METAL).set(8, 4, METAL_D);
    }
    g.set(8, 8, c.p.skin);
  } else if (c.f === 'attack') {
    g.set(8, 7, c.p.skin).line(9, 7, 11, 7, METAL).set(9, 7, WOOD_D);
  } else {
    g.set(8, 8, c.p.skin).line(9, 3, 9, 7, METAL).set(9, 8, WOOD_D).set(10, 7, WOOD_D);
  }
  return g;
}

function drawRanger(c: Ctx): PixelGrid {
  const g = new PixelGrid(HUMAN_W, HUMAN_H);
  legs(g, c, WOOD_D);
  torso(g, c);
  head(g, c);
  // Kapuze
  g.rect(5, 2, 3, 1, c.p.B).rect(4, 3, 1, 3, c.p.D).set(5, 3, c.p.B);
  // Umhang in Teamfarbe
  g.rect(3, 6, 1, 4, c.T).set(3, 9, c.TD);
  // Bogen
  if (c.f === 'attack') {
    g.dots(WOOD, [[10, 4], [11, 5], [11, 6], [11, 7], [11, 8], [10, 9]]).line(10, 5, 10, 8, '#e8e0c8');
    g.line(8, 7, 11, 6, METAL).set(8, 7, c.p.skin);
  } else {
    g.dots(WOOD, [[9, 4], [10, 5], [10, 6], [10, 7], [10, 8], [9, 9]]).line(9, 5, 9, 8, '#e8e0c8');
    g.set(8, 7, c.p.skin);
  }
  return g;
}

function drawMage(c: Ctx, necro: boolean): PixelGrid {
  const g = new PixelGrid(HUMAN_W, HUMAN_H);
  // Robe bis zum Boden
  g.rect(4, 6, 4, 5, c.p.B).rect(4, 6, 1, 5, c.p.D).set(6, 6, c.p.L).set(7, 6, c.p.L);
  if (c.f === 'walk1') g.set(3, 10, c.p.D).set(8, 10, c.p.B);
  g.dots(INK, c.f === 'walk1' ? [[4, 11], [7, 11]] : [[5, 11], [7, 11]]);
  g.rect(4, 8, 4, 1, c.T); // Gürtel in Teamfarbe
  head(g, c);
  // Spitzhut
  g.rect(4, 2, 5, 1, c.p.D).rect(5, 1, 3, 1, c.p.B).set(5, 0, c.p.B).set(4, 0, c.p.L);
  // Stab
  const orb = necro ? BONE : c.p.glow;
  if (c.f === 'attack') {
    g.line(8, 9, 10, 4, WOOD).set(8, 8, c.p.skin);
    g.set(11, 3, orb).set(10, 2, necro ? INK : shade(orb, 1.5)).set(11, 2, orb).set(10, 3, orb);
  } else {
    g.line(9, 4, 9, 10, WOOD).set(8, 8, c.p.skin);
    g.set(9, 3, orb).set(9, 2, necro ? orb : shade(orb, 1.5));
    if (necro) g.set(9, 3, INK).set(8, 2, orb).set(10, 2, orb);
  }
  return g;
}

function drawHealer(c: Ctx): PixelGrid {
  const g = new PixelGrid(HUMAN_W, HUMAN_H);
  const robe = mix(c.p.L, '#ffffff', 0.35);
  g.rect(4, 6, 4, 5, robe).rect(4, 6, 1, 5, c.p.L).rect(5, 6, 1, 5, c.p.B);
  if (c.f === 'walk1') g.set(3, 10, c.p.L);
  g.dots(INK, c.f === 'walk1' ? [[4, 11], [7, 11]] : [[5, 11], [7, 11]]);
  g.set(6, 8, c.T).set(7, 8, c.T).set(4, 8, c.TD); // Schärpe
  head(g, c);
  // Kapuze
  g.rect(5, 2, 3, 1, c.p.B).rect(4, 3, 1, 3, c.p.B).set(5, 3, c.p.D).set(4, 2, c.p.D);
  // Stab mit Kreuz-Leuchten
  const gl = c.p.glow;
  if (c.f === 'attack') {
    g.line(9, 4, 9, 10, WOOD).set(8, 8, c.p.skin).dots(gl, [[9, 2], [8, 3], [10, 3], [9, 1], [7, 3], [11, 3]]).set(9, 3, '#ffffff');
  } else {
    g.line(9, 4, 9, 10, WOOD).set(8, 8, c.p.skin).dots(gl, [[9, 2], [8, 3], [10, 3]]).set(9, 3, shade(gl, 1.4));
  }
  return g;
}

function drawSkeleton(c: Ctx): PixelGrid {
  const g = new PixelGrid(HUMAN_W, HUMAN_H);
  legs(g, c, BONE, BONE_D);
  g.rect(5, 6, 3, 4, BONE).set(5, 7, BONE_D).set(6, 7, INK).set(6, 9, INK).set(5, 9, BONE_D);
  g.rect(5, 8, 3, 1, c.T);
  g.rect(5, 3, 3, 3, BONE).set(6, 4, INK).set(7, 5, BONE_D).set(5, 5, BONE_D);
  if (c.f === 'attack') g.set(8, 7, BONE).line(9, 7, 11, 7, METAL_D);
  else g.set(8, 8, BONE).line(9, 4, 9, 7, METAL_D);
  return g;
}

function drawGhoul(c: Ctx): PixelGrid {
  const g = new PixelGrid(HUMAN_W, HUMAN_H);
  const sk = '#8fa37e';
  const skD = '#5d6d52';
  legs(g, c, skD);
  g.rect(4, 6, 4, 4, '#4a3b5a').rect(4, 6, 1, 4, '#2d2338').rect(4, 9, 4, 1, c.T);
  g.rect(6, 4, 3, 3, sk).set(8, 5, '#ff4b4b').rect(6, 6, 3, 1, skD);
  if (c.f === 'attack') g.dots(sk, [[9, 6], [10, 6]]).dots(BONE, [[11, 5], [11, 7]]);
  else g.dots(sk, [[8, 8], [9, 8]]).set(10, 9, BONE);
  return g;
}

// --- Reittiere (16×13) ----------------------------------------------------

function drawMount(c: Ctx, kind: 'mount' | 'stag' | 'wolf' | 'bonesteed' | 'camel'): PixelGrid {
  const g = new PixelGrid(16, 13);
  const a = kind === 'bonesteed' ? BONE : c.p.animal;
  const aD = kind === 'bonesteed' ? BONE_D : shade(a, 0.7);
  // Beine
  const legX = c.f === 'walk1' ? [3, 6, 9, 12] : [4, 5, 10, 11];
  for (const x of legX) g.rect(x, 9, 1, 2, aD).set(x, 11, INK);
  // Körper
  g.rect(3, 5, 9, 4, a).rect(3, 8, 9, 1, aD);
  if (kind === 'bonesteed') g.dots(INK, [[5, 7], [7, 7], [9, 7]]);
  // Hals & Kopf
  if (kind === 'wolf') {
    g.rect(11, 4, 3, 3, a).rect(14, 5, 1, 2, a).dots(INK, [[13, 5], [14, 6]]).dots(a, [[11, 3], [13, 3]]);
  } else {
    g.rect(11, 3, 2, 4, a).rect(12, 2, 3, 2, a).set(14, 3, aD).set(13, 2, INK).set(12, 1, aD);
  }
  if (kind === 'stag') g.dots(BONE_D, [[11, 0], [12, 0], [13, 1], [11, 1], [14, 0]]);
  if (kind === 'camel') g.rect(6, 3, 3, 2, a).set(6, 3, aD);
  // Schweif
  g.rect(2, 5, 1, 3, aD);
  // Satteldecke in Teamfarbe
  g.rect(5, 5, 4, 2, c.T).rect(5, 6, 4, 1, c.TD);
  // Reiter
  const ry = kind === 'camel' ? -1 : 0;
  g.rect(6, 2 + ry, 3, 3, c.p.B).set(6, 2 + ry, c.p.D).set(8, 2 + ry, c.p.L);
  g.rect(7, 0 + ry, 2, 2, c.p.skin).set(8, 1 + ry, INK);
  if (ry === 0) g.rect(7, 0, 2, 1, METAL);
  // Lanze
  if (c.f === 'attack') g.line(9, 4 + ry, 15, 4 + ry, WOOD).set(15, 4 + ry, METAL);
  else g.line(9, 4 + ry, 14, 0, WOOD).set(14, 0, METAL);
  return g;
}

// --- Festungen (20×24) ------------------------------------------------------

function drawTower(c: Ctx, kind: 'tower' | 'bastion' | 'citadel' | 'tradepost'): PixelGrid {
  const g = new PixelGrid(20, 24);
  const st = c.p.stone;
  const stD = shade(st, 0.72);
  const stL = shade(st, 1.25);
  if (kind === 'tradepost') {
    // Holzhütte mit Markise
    g.rect(4, 11, 12, 10, WOOD).rect(4, 11, 1, 10, WOOD_D);
    for (let y = 13; y < 21; y += 3) g.rect(5, y, 11, 1, WOOD_D);
    for (let x = 3; x < 17; x++) g.rect(x, 8, 1, 3, x % 4 < 2 ? c.p.L : c.T);
    g.rect(3, 7, 14, 1, c.p.D);
    g.rect(8, 15, 4, 6, INK).rect(9, 16, 2, 2, c.f === 'attack' ? '#ffd76a' : WOOD_D);
    g.rect(15, 16, 3, 3, '#c9a24a').set(16, 16, '#ffe08a');
    g.line(10, 1, 10, 7, WOOD_D).rect(11, 1, 4, 3, c.T).set(11, 3, c.TD);
    return g;
  }
  // Turm
  g.rect(4, 8, 12, 13, st).rect(4, 8, 2, 13, stD).rect(14, 8, 2, 13, stL);
  for (let y = 10; y < 21; y += 3) for (let x = 5 + ((y / 3) % 2 === 0 ? 0 : 2); x < 15; x += 4) g.set(x, y, stD);
  // Zinnen
  for (let x = 3; x < 17; x += 3) g.rect(x, 5, 2, 3, st).set(x, 5, stL);
  g.rect(3, 7, 14, 1, stD);
  // Tor
  g.rect(8, 16, 4, 5, INK).rect(9, 17, 2, 4, WOOD_D);
  // Fenster (leuchtet beim Schuss)
  g.rect(9, 11, 2, 3, c.f === 'attack' ? c.p.glow : INK);
  if (c.f === 'attack') g.set(9, 11, '#ffffff');
  // Dach & Fahne
  g.rect(6, 3, 8, 2, c.p.B).rect(7, 2, 6, 1, c.p.B).rect(8, 1, 4, 1, c.p.L).rect(6, 4, 8, 1, c.p.D);
  g.line(10, 0, 10, 1, WOOD_D);
  g.rect(11, 0, 4, 2, c.T).set(14, 1, c.TD);
  if (kind === 'bastion') {
    // Wurzeln & Ranken
    g.dots(c.p.B, [[4, 20], [3, 21], [15, 20], [16, 21], [5, 14], [4, 15], [14, 12], [15, 13], [6, 9], [13, 17]]);
    g.dots(c.p.L, [[5, 13], [15, 12], [7, 9], [14, 18]]);
    if (c.f === 'attack') g.rect(9, 11, 2, 3, c.p.glow);
  }
  if (kind === 'citadel') {
    g.rect(8, 11, 4, 3, BONE).dots(INK, [[9, 12], [11, 12]]).set(10, 13, INK);
    g.dots(c.p.glow, [[9, 18], [10, 18]]);
  }
  return g;
}

// --- Frame-Erzeugung ------------------------------------------------------

function drawBody(kind: VisualKind, c: Ctx): PixelGrid {
  switch (kind) {
    case 'warrior':
    case 'berserker':
    case 'hammer':
      return drawWarrior(c, kind);
    case 'ranger':
      return drawRanger(c);
    case 'mage':
      return drawMage(c, false);
    case 'necro':
      return drawMage(c, true);
    case 'healer':
      return drawHealer(c);
    case 'skeleton':
      return drawSkeleton(c);
    case 'ghoul':
      return drawGhoul(c);
    case 'mount':
    case 'stag':
    case 'wolf':
    case 'bonesteed':
    case 'camel':
      return drawMount(c, kind);
    case 'tower':
    case 'bastion':
    case 'citadel':
    case 'tradepost':
      return drawTower(c, kind);
  }
}

export const isBuilding = (k: VisualKind) => k === 'tower' || k === 'bastion' || k === 'citadel' || k === 'tradepost';

/** Fügt eine Zeile Schatten unter der Figur hinzu. */
function withShadow(g: PixelGrid, building: boolean): PixelGrid {
  const out = new PixelGrid(g.w, g.h);
  let minX = g.w;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < g.h; y++)
    for (let x = 0; x < g.w; x++)
      if (g.get(x, y) !== null) {
        maxY = Math.max(maxY, y);
        if (y >= g.h - 5) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
        }
      }
  const sy = Math.min(g.h - 1, maxY + 1);
  out.rect(minX + 1, sy, Math.max(1, maxX - minX - 1), 1, SHADOW);
  out.rect(minX + 2, sy - 1, Math.max(1, maxX - minX - 3), 1, SHADOW);
  if (building) out.rect(minX + 1, sy - 2, Math.max(1, maxX - minX - 1), 1, SHADOW);
  for (let i = 0; i < g.px.length; i++) if (g.px[i] != null) out.px[i] = g.px[i] ?? null;
  return out;
}

export interface UnitFrames {
  /** Zeile (von oben), auf der die Füße stehen → Anker */
  footY: number;
  walk0: PixelGrid;
  walk1: PixelGrid;
  attack: PixelGrid;
  flash: PixelGrid;
  corpse: PixelGrid;
}

export function buildUnitFrames(kind: VisualKind, color: ColorId, team: 0 | 1): UnitFrames {
  const p = PALETTES[color];
  const t = TEAM_COLORS[team];
  const make = (f: Frame) => drawBody(kind, { p, T: t.T, TD: t.TD, f }).pad(1).outline(INK);
  const building = isBuilding(kind);
  const w0 = make('walk0');
  const w1 = make('walk1');
  const at = make('attack');
  const flash = withShadow(w0.map((c) => (c === INK ? shade(c, 1.6) : mix(c, '#ffffff', 0.65))), building);
  let corpse: PixelGrid;
  if (building) {
    corpse = rubble(p, w0.w, w0.h);
  } else {
    corpse = w0.rotate90().map((c) => (c === INK ? 'rgba(27,20,34,0.75)' : shade(c, 0.62)));
  }
  const face = (g: PixelGrid) => (team === 0 ? g : g.flipX());
  let footY = 0;
  for (let y = 0; y < w0.h; y++) for (let x = 0; x < w0.w; x++) if (w0.get(x, y) !== null) footY = y;
  return {
    footY,
    walk0: face(withShadow(w0, building)),
    walk1: face(withShadow(w1, building)),
    attack: face(withShadow(at, building)),
    flash: face(flash),
    corpse: face(corpse),
  };
}

function rubble(p: Palette, w: number, h: number): PixelGrid {
  const g = new PixelGrid(w, h);
  const st = p.stone;
  const pts: [number, number, string][] = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 40; i++) {
    const x = 3 + Math.floor(rnd() * 14);
    const y = h - 2 - Math.floor(rnd() * rnd() * 7);
    pts.push([x, y, rnd() < 0.5 ? st : shade(st, 0.7)]);
  }
  for (const [x, y, c] of pts) g.set(x, y, c);
  g.rect(8, h - 5, 1, 3, WOOD_D).rect(9, h - 5, 3, 2, p.B);
  return g.outline('rgba(27,20,34,0.6)');
}

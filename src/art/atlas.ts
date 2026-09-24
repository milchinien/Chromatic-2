import { Rectangle, Texture } from 'pixi.js';
import { CARDS, GHOUL, SKELETON, type CardDef } from '../data/cards';
import { INK, PixelGrid } from './pixel';
import { buildUnitFrames, isBuilding, visualKindFor } from './sprites';

// =====================================================================
// Ein einziger Textur-Atlas für alle Figuren & Effekte → die GPU kann
// Tausende Einheiten in wenigen Draw-Calls zeichnen.
// =====================================================================

export interface UnitTex {
  walk0: Texture;
  walk1: Texture;
  attack: Texture;
  flash: Texture;
  corpse: Texture;
  anchorY: number;
  building: boolean;
}

export interface FxTex {
  px1: Texture;
  px2: Texture;
  orb: Texture;
  arrow: Texture;
  rock: Texture;
  boulder: Texture;
  plus: Texture;
  crater: Texture;
  scorch: Texture;
}

export interface Atlas {
  units: UnitTex[];
  fx: FxTex;
  visOf: (card: CardDef, team: number) => number;
}

const ALL_CARDS: readonly CardDef[] = [...CARDS, SKELETON, GHOUL];

function fxGrids(): Record<keyof FxTex, PixelGrid> {
  const W = '#ffffff';
  const px1 = new PixelGrid(1, 1).set(0, 0, W);
  const px2 = new PixelGrid(2, 2).rect(0, 0, 2, 2, W);
  const orb = new PixelGrid(5, 5)
    .rect(1, 1, 3, 3, 'rgba(255,255,255,0.75)')
    .dots('rgba(255,255,255,0.35)', [[2, 0], [0, 2], [4, 2], [2, 4]])
    .set(2, 2, W);
  const arrow = new PixelGrid(6, 1).set(0, 0, '#f4f0e6').set(1, 0, '#8b5a33').set(2, 0, '#8b5a33').set(3, 0, '#8b5a33').set(4, 0, '#8b5a33').set(5, 0, '#dde1e7');
  const rock = new PixelGrid(3, 3).rect(0, 0, 3, 3, '#9a9aa3').set(0, 0, null).set(2, 2, '#5d5d66').set(1, 0, '#c8ccd2').pad(1).outline(INK);
  const boulder = new PixelGrid(5, 5)
    .rect(0, 1, 5, 3, '#8d8d96')
    .rect(1, 0, 3, 5, '#8d8d96')
    .dots('#c3c3cb', [[1, 1], [2, 1], [1, 2]])
    .dots('#5a5a63', [[3, 3], [2, 4], [4, 2]])
    .pad(1)
    .outline(INK);
  const plus = new PixelGrid(3, 3).dots(W, [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]]);
  // Krater (Felsbrocken-Einschlag) & Brandfleck als Boden-Decals
  const crater = new PixelGrid(15, 9);
  const scorch = new PixelGrid(11, 7);
  for (let y = 0; y < 9; y++)
    for (let x = 0; x < 15; x++) {
      const d = ((x - 7) / 7.5) ** 2 + ((y - 4) / 4.5) ** 2;
      if (d < 0.45) crater.set(x, y, 'rgba(40,28,20,0.55)');
      else if (d < 0.8) crater.set(x, y, 'rgba(70,52,36,0.45)');
      else if (d < 1 && (x + y) % 2 === 0) crater.set(x, y, 'rgba(120,96,70,0.4)');
    }
  for (let y = 0; y < 7; y++)
    for (let x = 0; x < 11; x++) {
      const d = ((x - 5) / 5.5) ** 2 + ((y - 3) / 3.5) ** 2;
      if (d < 0.5) scorch.set(x, y, 'rgba(25,18,16,0.45)');
      else if (d < 1 && (x * 3 + y) % 3 !== 0) scorch.set(x, y, 'rgba(40,30,24,0.3)');
    }
  return { px1, px2, orb, arrow, rock, boulder, plus, crater, scorch };
}

export function buildAtlas(): Atlas {
  const ATLAS_W = 1024;
  type Item = { g: PixelGrid; x: number; y: number };
  const items: Item[] = [];
  let cx = 0;
  let cy = 0;
  let rowH = 0;
  const place = (g: PixelGrid): Item => {
    if (cx + g.w + 1 > ATLAS_W) {
      cx = 0;
      cy += rowH + 1;
      rowH = 0;
    }
    const it = { g, x: cx, y: cy };
    cx += g.w + 1;
    rowH = Math.max(rowH, g.h);
    items.push(it);
    return it;
  };

  type UnitItems = { walk0: Item; walk1: Item; attack: Item; flash: Item; corpse: Item; footY: number; h: number; building: boolean };
  const unitItems: UnitItems[] = [];
  const index = new Map<string, number>();
  for (const card of ALL_CARDS) {
    const kind = visualKindFor(card);
    for (const team of [0, 1] as const) {
      const f = buildUnitFrames(kind, card.color, team);
      index.set(`${card.id}:${team}`, unitItems.length);
      unitItems.push({
        walk0: place(f.walk0),
        walk1: place(f.walk1),
        attack: place(f.attack),
        flash: place(f.flash),
        corpse: place(f.corpse),
        footY: f.footY,
        h: f.walk0.h,
        building: isBuilding(kind),
      });
    }
  }
  const fxG = fxGrids();
  const fxItems = Object.fromEntries(Object.entries(fxG).map(([k, g]) => [k, place(g)])) as Record<keyof FxTex, Item>;

  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_W;
  canvas.height = cy + rowH + 1;
  const ctx = canvas.getContext('2d')!;
  for (const it of items) it.g.draw(ctx, it.x, it.y);

  const base = Texture.from(canvas);
  base.source.scaleMode = 'nearest';
  const sub = (it: Item) => new Texture({ source: base.source, frame: new Rectangle(it.x, it.y, it.g.w, it.g.h) });

  const units: UnitTex[] = unitItems.map((u) => ({
    walk0: sub(u.walk0),
    walk1: sub(u.walk1),
    attack: sub(u.attack),
    flash: sub(u.flash),
    corpse: sub(u.corpse),
    anchorY: (u.footY + 1) / u.h,
    building: u.building,
  }));
  const fx = Object.fromEntries(Object.entries(fxItems).map(([k, it]) => [k, sub(it)])) as unknown as FxTex;

  return {
    units,
    fx,
    visOf: (card, team) => {
      const i = index.get(`${card.id}:${team}`);
      if (i === undefined) throw new Error(`Keine Figur für ${card.id}`);
      return i;
    },
  };
}

/** Optionales Umfärben der Kartenbilder (z. B. auf die Palette eines UI-Designs). */
let iconRemap: ((c: HTMLCanvasElement) => void) | null = null;
export function setIconRemap(fn: ((c: HTMLCanvasElement) => void) | null): void {
  iconRemap = fn;
}

/** Kartenbild für die Oberfläche (hochskaliert als PNG-DataURL). */
export function cardIconUrl(card: CardDef, scale: number, team: 0 | 1 = 0): string {
  const f = buildUnitFrames(visualKindFor(card), card.color, team);
  const g = f.walk0;
  const c = document.createElement('canvas');
  c.width = g.w * scale;
  c.height = g.h * scale;
  const ctx = c.getContext('2d')!;
  for (let y = 0; y < g.h; y++)
    for (let x = 0; x < g.w; x++) {
      const col = g.get(x, y);
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  iconRemap?.(c);
  return c.toDataURL();
}


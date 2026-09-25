// Textur-Atlas des Spiels: alle Figuren in der Farbe ihrer Rasse (Team 0/1),
// Beschwörungen, Mauern, Bosse und Effekte in EINEM Bild, damit die
// ParticleContainer alles in wenigen Draw-Calls zeichnen können.

import { Rectangle, Texture } from 'pixi.js';
import { fxGrids, type FxTex } from '../../art/atlas';
import { INK, PixelGrid } from '../../art/pixel';
import { buildUnitFrames, isBuilding, type VisualKind } from '../../art/sprites';
import { BOSSES, CARDS2, RACES, RACE_ORDER, type RaceId } from '../data';
import { fxArtGrids, type FxArtGrids } from './fxArt';

export interface UnitTex {
  walk0: Texture;
  walk1: Texture;
  attack: Texture;
  flash: Texture;
  corpse: Texture;
  anchorY: number;
  building: boolean;
}

/** Kampf-Effekte: Größen-Sets als Texture[], alles andere einzeln. */
export type FxArt = { [K in keyof FxArtGrids]: FxArtGrids[K] extends PixelGrid[] ? Texture[] : Texture };

export interface GameAtlas {
  units: Map<string, UnitTex>;
  fx: FxTex;
  art: FxArt;
  get(key: string): UnitTex;
}

/** Mauerstück für den Klassenbonus „Bulwark“ (Belagerung). */
function wallGrid(team: 0 | 1): PixelGrid {
  const g = new PixelGrid(12, 20);
  const st = '#9a96a2';
  const d = '#62606c';
  const l = '#c4c0cc';
  g.rect(1, 4, 10, 15, st).rect(1, 4, 2, 15, d).rect(9, 4, 2, 15, l);
  for (let y = 7; y < 19; y += 3) g.rect(1, y, 10, 1, d);
  for (let x = 1; x < 11; x += 3) g.rect(x, 2, 2, 2, st);
  g.rect(5, 0, 1, 4, '#5a3a22').rect(6, 0, 3, 2, team === 0 ? '#3ec5ff' : '#ffcc33');
  return g.pad(1).outline(INK);
}

export function buildGameAtlas(): GameAtlas {
  const W = 1024;
  type Item = { g: PixelGrid; x: number; y: number };
  const items: Item[] = [];
  let cx = 0;
  let cy = 0;
  let rowH = 0;
  const place = (g: PixelGrid): Item => {
    if (cx + g.w + 1 > W) {
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

  type Pending = { key: string; walk0: Item; walk1: Item; attack: Item; flash: Item; corpse: Item; footY: number; h: number; building: boolean };
  const pending: Pending[] = [];
  const seen = new Set<string>();
  const add = (key: string, kind: VisualKind, race: RaceId, team: 0 | 1) => {
    if (seen.has(key)) return;
    seen.add(key);
    const f = buildUnitFrames(kind, RACES[race].unit, team);
    pending.push({
      key,
      walk0: place(f.walk0),
      walk1: place(f.walk1),
      attack: place(f.attack),
      flash: place(f.flash),
      corpse: place(f.corpse),
      footY: f.footY,
      h: f.walk0.h,
      building: isBuilding(kind),
    });
  };

  for (const team of [0, 1] as const) {
    for (const c of CARDS2) add(`${c.race}|${c.kind}|${team}`, c.kind, c.race, team);
    for (const r of RACE_ORDER) add(`${r}|hammer|${team}`, 'hammer', r, team);
    add(`plague|ghoul|${team}`, 'ghoul', 'plague', team);
    add(`plague|skeleton|${team}`, 'skeleton', 'plague', team);
    add(`deepforge|tower|${team}`, 'tower', 'deepforge', team);
    // Mauer
    const wg = wallGrid(team);
    const wi = place(wg);
    const wc = place(wg.map((col) => (col === INK ? col : '#55525c')));
    pending.push({ key: `wall|${team}`, walk0: wi, walk1: wi, attack: wi, flash: place(wg.map(() => '#ffffff')), corpse: wc, footY: wg.h - 1, h: wg.h, building: true });
  }
  for (const b of Object.values(BOSSES)) add(`boss|${b.race}`, b.kind, b.race, 1);

  const fxG = fxGrids();
  const fxItems = Object.fromEntries(Object.entries(fxG).map(([k, g]) => [k, place(g)])) as Record<keyof FxTex, Item>;
  const artItems = Object.entries(fxArtGrids()).map(([k, g]) => [k, Array.isArray(g) ? g.map(place) : place(g)] as const);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = cy + rowH + 1;
  const ctx = canvas.getContext('2d')!;
  for (const it of items) it.g.draw(ctx, it.x, it.y);
  const base = Texture.from(canvas);
  base.source.scaleMode = 'nearest';
  const sub = (it: Item) => new Texture({ source: base.source, frame: new Rectangle(it.x, it.y, it.g.w, it.g.h) });

  const units = new Map<string, UnitTex>();
  for (const p of pending)
    units.set(p.key, {
      walk0: sub(p.walk0),
      walk1: sub(p.walk1),
      attack: sub(p.attack),
      flash: sub(p.flash),
      corpse: sub(p.corpse),
      anchorY: (p.footY + 1) / p.h,
      building: p.building,
    });
  const fx = Object.fromEntries(Object.entries(fxItems).map(([k, it]) => [k, sub(it)])) as unknown as FxTex;
  const art = Object.fromEntries(artItems.map(([k, it]) => [k, Array.isArray(it) ? it.map(sub) : sub(it as Item)])) as unknown as FxArt;
  const fallback = units.get('drifters|warrior|0')!;
  return { units, fx, art, get: (key) => units.get(key) ?? fallback };
}

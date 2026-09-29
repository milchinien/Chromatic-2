// Arena im Hochformat. Die Simulation bleibt waagrecht, diese Ansicht dreht
// nur die Positionen: Spieler unten, Gegner oben. Figuren, Geschosse und alle
// Effekte werden aufrecht gezeichnet (gleiche Texturen, gleiche Effekt-Routinen
// wie am PC); Strahlen, Flutwelle, Last Stand, Burgtreffer und das
// Zerbröckeln der Burg laufen hier senkrecht statt waagrecht.
//
// In der Simulation stecken manche Höhen als y-Versatz (Pfeil startet bei y−5,
// Treffer bei y−4 …). Beim Drehen wird dieser Versatz zurückgerechnet und als
// Bildschirmhöhe angewandt, sonst säßen Treffer seitlich neben den Figuren.

import { Particle, Rectangle, Sprite, Texture, type Application, type Graphics } from 'pixi.js';
import type { PaletteTheme } from '../../lab/palettes';
import { ArenaView, type Beam } from '../render/arenaView';
import type { GameAtlas } from '../render/atlas';
import { F_BOUNCE, F_FADEIN, F_FLICKER, F_LINEAR, F_ORIENT, F_WOBBLE, L_ADD, L_GROUND, L_GROUND_ADD, L_TOP, RAMP, rampOf } from '../render/particles';
import { Arena, P_ARROW, P_ROCK, type SimEvent } from '../sim/arena';
import { castleCanvasesP, forestCanvasP, groundCanvasP } from './field';
import { MH, MW, battleLayout, type BattleLayout } from './stage';

const hex = (c: string) => parseInt(c.slice(1, 7), 16);
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** Höhe (Simulations-y-Versatz) der Ereignisse, siehe arena.ts */
const H_HIT = 4;
const H_CAST = 6;
const H_SIEGE = 14;
const H_ARROW = 5;
const H_BOLT = 5;

export class MobileArenaView extends ArenaView {
  /** Wird erst nach dem Basis-Konstruktor gesetzt – dort nur über lay() zugreifen */
  private readonly L: BattleLayout = battleLayout();
  private readonly pBucket = new Int32Array(MH + 2);
  private readonly landY: number[] = [];

  constructor(app: Application, atlas: GameAtlas, arena: Arena, theme: PaletteTheme) {
    super(app, atlas, arena, theme);
  }

  // --- Bildschirmformat --------------------------------------------------------------------

  protected override get sw(): number {
    return MW;
  }

  protected override get sh(): number {
    return MH;
  }

  protected override get field(): { x0: number; x1: number; y0: number; y1: number } {
    const L = battleLayout();
    return { x0: L.fy0, x1: L.fy1, y0: L.top + 4, y1: L.bottom - 4 };
  }

  protected override groundCanvas(theme: PaletteTheme): HTMLCanvasElement {
    return groundCanvasP(theme);
  }

  protected override castleCanvases(theme: PaletteTheme): HTMLCanvasElement[] {
    return castleCanvasesP(theme);
  }

  protected override forestCanvas(theme: PaletteTheme): HTMLCanvasElement {
    return forestCanvasP(theme);
  }

  protected override dustColor(cv: HTMLCanvasElement): number {
    const L = battleLayout();
    const d = cv.getContext('2d')!.getImageData(L.fy0, L.top, L.fy1 - L.fy0, L.len).data;
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let i = 0; i < d.length; i += 4 * 97) {
      r += d[i]!;
      g += d[i + 1]!;
      b += d[i + 2]!;
      n++;
    }
    const f = (v: number) => Math.round(v / n + (255 - v / n) * 0.62);
    return (f(r) << 16) | (f(g) << 8) | f(b);
  }

  protected override unitVx(i: number): number {
    return this.arena.vy[i]!;
  }

  private sx(y: number, h = 0): number {
    return y + h;
  }

  private sy(x: number, h = 0): number {
    return this.L.top + (this.L.fx1 - x) - h;
  }

  // --- Einheiten ---------------------------------------------------------------------------

  protected override drawUnits(): void {
    const a = this.arena;
    const b = this.pBucket;
    const top = this.L.top;
    const fx1 = this.L.fx1;
    b.fill(0);
    const row = (i: number) => Math.min(MH, Math.max(0, Math.floor(top + fx1 - a.x[i]!)));
    for (let i = 0; i < a.hw; i++) if (a.alive[i]) b[row(i) + 1]!++;
    for (let k = 0; k <= MH; k++) b[k + 1]! += b[k]!;
    let n = 0;
    for (let i = 0; i < a.hw; i++) {
      if (!a.alive[i]) continue;
      this.order[b[row(i)]!++] = i;
      n++;
    }
    const live = a.state === 'fight' || a.state === 'march';
    const k60 = this.frameK;
    this.statusBudget = 70;
    const list = this.units.particleChildren;
    list.length = 0;
    for (let k = 0; k < n; k++) {
      const i = this.order[k]!;
      const t = a.types[a.type[i]!]!;
      const ut = this.atlas.get(t.visKey);
      let p = this.unitParts[i];
      if (!p) {
        p = new Particle({ texture: ut.walk0, anchorX: 0.5, anchorY: ut.anchorY });
        this.unitParts[i] = p;
      }
      if (this.introT >= 0 && this.introT < this.revealAt[i]!) continue;
      const x = this.sx(a.y[i]!);
      const y = this.sy(a.x[i]!);
      let justRevealed = false;
      if (this.introT >= 0 && !this.revealed[i]) {
        this.revealed[i] = 1;
        justRevealed = true;
        this.spawnFx(x, y, hex(t.glow), t.scale, false);
      }
      p.anchorY = ut.anchorY;
      const moving = Math.abs(a.vx[i]!) + Math.abs(a.vy[i]!) > 3;
      let tex = ut.walk0;
      if (a.flashT[i]! > 0 || justRevealed) tex = ut.flash;
      else if (a.atkT[i]! > 0) tex = ut.attack;
      else if (moving) tex = Math.floor(a.animT[i]!) % 2 === 0 ? ut.walk0 : ut.walk1;
      p.texture = tex;
      p.scaleX = p.scaleY = t.scale;
      p.x = Math.round(x);
      p.y = Math.round(y) - (moving && !ut.building && Math.floor(a.animT[i]! * 2) % 2 === 0 ? 1 : 0);
      let tint = 0xffffff;
      if (a.burnT[i]! > 0) tint = Math.floor(a.animT[i]! * 6) % 2 ? 0xffa070 : 0xffd0a0;
      else if (a.slowT[i]! > 0) tint = a.slowMul[i] === 0 ? 0xa8e8ff : 0xb8ffb0;
      else if (a.shield[i]! > 0) tint = 0xfff0b0;
      else if (a.lastStand[a.team[i]!]! < 0.85 && Math.floor(a.animT[i]! * 3 + i) % 3 === 0) tint = a.team[i] === 0 ? 0xfff2a0 : 0xffc0a0;
      p.tint = tint;
      list.push(p);
      if (live) this.unitFx(i, x, y, t.scale, tex.height * t.scale, t.speed, t.flying, t.boss, t.rage > 0, moving, k60);
    }
    this.units.update();
  }

  // --- Geschosse --------------------------------------------------------------------------

  protected override drawProjectiles(): void {
    const a = this.arena;
    const list = this.projs.particleChildren;
    const shadows = this.projShadows.particleChildren;
    const glows = this.projGlow.particleChildren;
    list.length = 0;
    shadows.length = 0;
    glows.length = 0;
    const fx = this.atlas.fx;
    const art = this.art;
    const k60 = this.frameK;
    for (let p = 0; p < a.pHw; p++) {
      if (!a.pAlive[p]) continue;
      let part = this.projParts[p];
      if (!part) {
        part = new Particle({ texture: fx.orb, anchorX: 0.5, anchorY: 0.5 });
        this.projParts[p] = part;
      }
      const kind = a.pKind[p]!;
      part.rotation = 0;
      part.tint = 0xffffff;
      if (kind === P_ROCK) {
        const u = Math.min(1, a.pT[p]! / a.pDur[p]!);
        // Start liegt 14 px „über“ der Belagerungswaffe, das Ziel am Boden
        const h = H_SIEGE * (1 - u);
        const gx = this.sx(a.pY[p]! + (a.pTY[p]! - a.pY[p]!) * u, h);
        const gy = this.sy(a.pX[p]! + (a.pTX[p]! - a.pX[p]!) * u);
        part.texture = fx.boulder;
        part.x = gx;
        part.y = gy - h - a.pZ[p]!;
        part.rotation = Math.floor(a.pT[p]! * 8) * (Math.PI / 2);
        let sh = this.shadowParts[p];
        if (!sh) {
          sh = new Particle({ texture: fx.px2, anchorX: 0.5, anchorY: 0.5, tint: 0x000000, alpha: 0.3 });
          this.shadowParts[p] = sh;
        }
        sh.x = Math.round(gx);
        sh.y = Math.round(gy + 4);
        sh.scaleX = 1.5 + (1 - a.pZ[p]! / 60) * 2;
        sh.alpha = 0.18 + (1 - a.pZ[p]! / 60) * 0.2;
        shadows.push(sh);
        const fire = a.types[a.pSrcType[p]!]?.ability === 'firepots';
        if (fire) {
          part.tint = 0xffc080;
          if (this.ok(0.9 * k60)) this.fx.emit({ tex: art.flame, x: part.x + rnd(-1, 1), y: part.y + 1, vz: 6, grav: -20, life: rnd(0.2, 0.35), ramp: RAMP.fireHot, layer: L_ADD, flags: F_FLICKER });
          if (this.ok(0.35 * k60)) this.fx.emit({ tex: art.puff, x: part.x, y: part.y + 2, vz: 4, grav: -8, life: rnd(0.5, 0.8), size: 2, size1: 5, ramp: RAMP.smoke, alpha: 0.5 });
          this.addGlow(glows, p, part.x, part.y, 12, 0xff8a3a, 0.55);
        } else if (this.ok(0.4 * k60)) this.fx.emit({ tex: art.puff, x: part.x, y: part.y + 2, life: 0.4, size: 2, size1: 4, ramp: RAMP.smokeLight, alpha: 0.45 });
      } else if (kind === P_ARROW) {
        part.texture = fx.arrow;
        part.x = this.sx(a.pY[p]!, H_ARROW);
        part.y = this.sy(a.pX[p]!, H_ARROW);
        // Richtung gedreht: Bildschirm (vy, −vx)
        part.rotation = Math.atan2(-a.pSX[p]!, a.pSY[p]!);
        if (this.ok(0.25 * k60)) this.fx.emit({ tex: fx.px1, x: part.x - Math.cos(part.rotation) * 4, y: part.y - Math.sin(part.rotation) * 4, life: 0.14, color: 0xf4ecd9, alpha: 0.45, flags: F_LINEAR });
      } else {
        const c = hex(a.pColor[p] ?? '#ffffff');
        part.texture = fx.orb;
        part.tint = c;
        part.x = this.sx(a.pY[p]!, H_BOLT);
        part.y = this.sy(a.pX[p]!, H_BOLT);
        this.addGlow(glows, p, part.x, part.y, 10, c, 0.6);
        if (this.ok(0.6 * k60))
          this.fx.emit({ tex: Math.random() < 0.5 ? art.ember : fx.px1, x: part.x + rnd(-1, 1), y: part.y + rnd(-1, 1), vx: -a.pSY[p]! * 0.08 + rnd(-5, 5), vy: a.pSX[p]! * 0.08 + rnd(-5, 5), life: rnd(0.2, 0.4), ramp: rampOf(c), layer: L_ADD, flags: F_FLICKER });
      }
      list.push(part);
    }
    this.projs.update();
    this.projShadows.update();
    this.projGlow.update();
  }

  // --- Ereignisse: Positionen drehen, dann die gemeinsamen Effekte ------------------------

  protected override onEvent(e: SimEvent): void {
    switch (e.t) {
      case 'death':
      case 'boom':
      case 'aura':
      case 'heal':
      case 'spawn':
        return super.onEvent({ ...e, x: this.sx(e.y), y: this.sy(e.x) } as SimEvent);
      case 'hit':
        return super.onEvent({ ...e, x: this.sx(e.y, H_HIT), y: this.sy(e.x, H_HIT) });
      case 'cast': {
        const h = e.siege ? H_SIEGE : H_CAST;
        return super.onEvent({ ...e, x: this.sx(e.y, h), y: this.sy(e.x, h), tx: this.sx(e.ty), ty: this.sy(e.tx) });
      }
      case 'chain': {
        const pts: number[] = [];
        for (let i = 0; i + 1 < e.pts.length; i += 2) pts.push(this.sx(e.pts[i + 1]!, H_HIT), this.sy(e.pts[i]!, H_HIT));
        return super.onEvent({ ...e, pts });
      }
      case 'text': {
        const h = e.text === 'FLED!' ? 30 : 0;
        // ganz lesbar lassen: Mitte der Schrift mindestens eine halbe Textbreite vom Rand
        const half = e.text.length * 4 + 8;
        const x = Math.max(half, Math.min(MW - half, this.sx(e.y, h)));
        return super.onEvent({ ...e, x, y: Math.max(this.L.top + 10, this.sy(e.x, h)) });
      }
      case 'beam':
        return this.beamFxV(e.x0, e.x1, e.y, hex(e.color), e.fx);
      case 'base':
        return this.baseFxV(e.team, e.y);
      case 'wave':
        return super.onEvent(e);
    }
  }

  /** Senkrechter Strahl: `x0`/`x1` = Simulations-x (Länge), `y` = Simulations-y (Spalte). */
  private beamFxV(x0: number, x1: number, y: number, c: number, kind: 'sun' | 'cannon'): void {
    const fx = this.fx;
    const art = this.art;
    const same = this.beams.reduce((n, b) => n + (b.fx === kind ? 1 : 0), 0);
    if (same >= (kind === 'sun' ? 5 : 8)) return;
    // Beam-Felder hier: x0/x1 = Bildschirm-y (entlang), y = Bildschirm-x (quer)
    const s0 = this.sy(x0) - 4;
    const s1 = this.sy(x1) - 4;
    const bx = Math.round(this.sx(y));
    const dir = s1 > s0 ? 1 : -1;
    const len = Math.abs(s1 - s0);
    this.beams.push({ x0: s0, x1: s1, y: bx, color: c, fx: kind, t: kind === 'sun' ? 0.55 : 0.3, max: kind === 'sun' ? 0.55 : 0.3 });
    if (kind === 'sun') {
      fx.emit({ tex: art.flare, x: bx, y: s0, life: 0.4, size: 2, color: 0xffffff, layer: L_ADD, flags: F_LINEAR });
      fx.emit({ tex: art.glow, x: bx, y: s0, life: 0.45, size: 32, size1: 10, ramp: RAMP.holy, layer: L_ADD });
      for (let d = 6; d < len; d += 9) {
        if (!this.ok(0.8)) continue;
        fx.emit({ tex: Math.random() < 0.4 ? art.star : art.ember, x: bx + rnd(-3, 3), y: s0 + dir * d, vx: rnd(-4, 4), vy: dir * rnd(4, 14), vz: rnd(4, 14), grav: -6, life: rnd(0.4, 0.9), ramp: RAMP.holy, layer: L_ADD, flags: F_FLICKER | F_FADEIN });
      }
      fx.emit({ tex: art.glow, x: bx, y: s0 + dir * len * 0.5, life: 0.5, size: 64, size1: 40, color: 0xfff0a0, alpha: 0.25, layer: L_GROUND_ADD });
    } else {
      fx.emit({ tex: art.glow, x: bx, y: s0 + dir * 6, life: 0.2, size: 28, size1: 8, ramp: RAMP.fireHot, layer: L_ADD });
      fx.emit({ tex: art.flare, x: bx, y: s0 + dir * 6, life: 0.12, size: 2, color: 0xfff6c0, layer: L_ADD, flags: F_LINEAR });
      for (let k = 0; k < 6; k++) fx.emit({ tex: art.puff, x: bx + rnd(-2, 2), y: s0 + dir * 8, vx: rnd(-12, 12), vy: dir * rnd(30, 90), drag: 4, life: rnd(0.3, 0.6), size: 5, size1: 3, ramp: RAMP.fire, layer: L_TOP });
      for (let d = 10; d < len; d += 13) {
        if (!this.ok(0.9)) continue;
        fx.emit({ tex: art.puff, x: bx + rnd(-2, 2), y: s0 + dir * d + rnd(-3, 3), vx: rnd(-3, 3), vy: dir * rnd(2, 10), vz: rnd(2, 8), grav: -3, drag: 1, life: rnd(0.6, 1.2), size: 2, size1: rnd(6, 9), ramp: RAMP.smokeLight, alpha: 0.55, flags: F_WOBBLE | F_FADEIN });
        if (d % 26 < 13) fx.emit({ tex: art.puff, x: bx + rnd(-3, 3), y: s0 + dir * d + 6, vx: rnd(-8, 8), vy: dir * 10, drag: 2.5, life: 0.6, size: 3, size1: 7, color: this.dust, alpha: 0.5, layer: L_GROUND });
      }
    }
  }

  protected override drawBeam(b: Beam, u: number, ga: Graphics): void {
    const y = Math.min(b.x0, b.x1);
    const h = Math.abs(b.x1 - b.x0);
    const x = b.y;
    if (b.fx === 'sun') {
      const th = Math.round(1 + u * 3 + (Math.random() < 0.5 ? 1 : 0));
      ga.rect(x - th * 2 - 2, y, th * 4 + 4, h).fill({ color: b.color, alpha: 0.12 * u });
      ga.rect(x - th - 1, y, th * 2 + 2, h).fill({ color: b.color, alpha: 0.4 * u });
      ga.rect(x - Math.floor(th / 2), y, Math.max(1, th), h).fill({ color: 0xffffff, alpha: Math.min(1, u * 1.6) });
      const dir = b.x1 > b.x0 ? 1 : -1;
      for (let q = 0; q < 4; q++) {
        const py = b.x0 + dir * (((this.time * 420 + q * 90) % h) || 0);
        ga.rect(x - 1, Math.round(py) - 3, 2, 6).fill({ color: 0xffffff, alpha: 0.7 * u });
      }
    } else {
      const th = u > 0.7 ? 4 : u > 0.4 ? 3 : u > 0.2 ? 2 : 1;
      ga.rect(x - th * 2, y, th * 4, h).fill({ color: 0xff8a3a, alpha: 0.18 * u });
      ga.rect(x - th, y, th * 2, h).fill({ color: b.color, alpha: 0.6 * u });
      ga.rect(x - (th > 2 ? 1 : 0), y, th > 2 ? 2 : 1, h).fill({ color: 0xffffff, alpha: u });
    }
  }

  /** Treffer an der Burg von `team` (0 = unten, 1 = oben). */
  private baseFxV(team: number, simY: number): void {
    const fx = this.fx;
    const art = this.art;
    this.castleFlash[team] = 1;
    const x = this.sx(simY);
    const y = team === 0 ? this.L.bottom + 4 : this.L.top - 4;
    const out = team === 0 ? -1 : 1; // ins Feld hinein
    fx.emit({ tex: art.glow, x, y: y - 6, life: 0.22, size: 18, size1: 6, color: 0xff6a5a, alpha: 0.8, layer: L_ADD });
    fx.emit({ tex: art.star, x, y: y - 6, life: 0.12, color: 0xffffff, layer: L_ADD, flags: F_LINEAR });
    for (let k = 0; k < 4; k++) fx.emit({ tex: art.chunk, x: x + rnd(-3, 3), y, z: rnd(4, 14), vx: rnd(-12, 12), vy: out * rnd(20, 60), vz: rnd(20, 60), grav: 280, life: 1.2, color: 0xb8b0a8, rot: rnd(0, 6), vr: rnd(-12, 12), size: 0.67, flags: F_BOUNCE });
    for (let k = 0; k < 3; k++) {
      const an = rnd(-1, 1);
      fx.emit({ tex: art.spark3, x, y: y - 6, vx: Math.sin(an) * 50, vy: out * Math.cos(an) * 80, drag: 4, life: 0.2, ramp: RAMP.spark, layer: L_ADD, flags: F_ORIENT });
    }
    if (this.ok(0.6)) fx.emit({ tex: art.puff, x, y: y + out * 4, vy: out * 10, vz: 6, grav: -4, drag: 2, life: 0.7, size: 3, size1: 8, color: this.dust, alpha: 0.6 });
  }

  protected override lastStandBand(ga: Graphics, t: number, s: number, color: number, alpha: number): void {
    const L = this.L;
    // gleiche Streifen wie am PC, nur quer zur Burg: ab der Mauer ins Feld hinein
    const xs = t === 0 ? L.fx0 - 8 + s * 6 : L.fx1 + 2 - s * 6;
    ga.rect(L.fy0 - 6, this.sy(xs + 6), L.fy1 - L.fy0 + 14, 6).fill({ color, alpha });
  }

  /** Flutwelle: waagrechte Wasserwand, die über das Feld rollt. */
  protected override drawWave(team: number, u: number): void {
    const g = this.gTop;
    const ga = this.gAdd;
    const L = this.L;
    const e = 1 - (1 - u) * (1 - u);
    // Team 0 (unten) wird nach unten gedrückt → Welle läuft nach unten
    const dir = team === 0 ? 1 : -1;
    const front = team === 0 ? L.top - 10 + e * (L.len + 20) : L.bottom + 10 - e * (L.len + 20);
    const fade = u < 0.8 ? 1 : (1 - u) / 0.2;
    for (let x = L.fy0 - 8; x < L.fy1 + 8; x += 2) {
      const wob = Math.sin(x * 0.18 + u * 22) * 3 + Math.sin(x * 0.05 - u * 9) * 4;
      const fy = Math.round(front + wob * dir);
      const back = (h: number) => (dir > 0 ? fy - h : fy);
      g.rect(x, back(46), 2, 46).fill({ color: 0x1a5a9a, alpha: 0.28 * fade });
      g.rect(x, back(20), 2, 20).fill({ color: 0x2a8ad0, alpha: 0.45 * fade });
      g.rect(x, back(8), 2, 8).fill({ color: 0x6ad0ff, alpha: 0.7 * fade });
      ga.rect(x, dir > 0 ? fy : fy - 3, 2, 3).fill({ color: 0xffffff, alpha: 0.85 * fade });
      if (Math.random() < 0.08 && this.ok(1))
        this.fx.emit({ tex: Math.random() < 0.5 ? this.atlas.fx.px2 : this.atlas.fx.px1, x, y: fy, z: rnd(0, 6), vx: rnd(-10, 10), vy: dir * rnd(60, 130), vz: rnd(30, 80), grav: 240, life: rnd(0.4, 0.7), ramp: RAMP.water, layer: L_TOP });
      if (Math.random() < 0.012 && this.ok(1))
        this.fx.emit({ tex: this.art.puff, x, y: fy, vy: dir * rnd(40, 70), vz: rnd(4, 12), grav: -4, drag: 3, life: rnd(0.3, 0.5), size: 4, size1: 8, color: 0xe8f8ff, alpha: 0.55 });
    }
  }

  // --- Burg zerbröckelt ---------------------------------------------------------------------

  override crumbleCastle(team: number): void {
    const cv = this.castleTex[team]!;
    const data = cv.getContext('2d')!.getImageData(0, 0, MW, MH).data;
    const base = Texture.from(cv);
    base.source.scaleMode = 'nearest';
    const B = 5;
    let minY = MH;
    let maxY = 0;
    this.landY.length = 0;
    for (let by = 0; by < MH; by += B)
      for (let bx = 0; bx < MW; bx += B) {
        let filled = false;
        for (let y = by; y < by + B && !filled; y++) for (let x = bx; x < bx + B; x++) if (data[(y * MW + x) * 4 + 3]! > 0) filled = true;
        if (!filled) continue;
        minY = Math.min(minY, by);
        maxY = Math.max(maxY, by);
        const t = new Texture({ source: base.source, frame: new Rectangle(bx, by, B, B) });
        const s = new Sprite(t);
        s.anchor.set(0.5);
        s.position.set(bx + B / 2, by + B / 2);
        this.root.addChildAt(s, this.root.getChildIndex(this.castles[team]!) + 1);
        this.crumble.push({ s, vx: (Math.random() - 0.5) * 30, vy: -Math.random() * 20, delay: 0, vr: (Math.random() - 0.5) * 6, started: false, landed: false });
        this.landY.push(by + 16 + Math.random() * 18);
      }
    // von außen zum Feld hin zerfallen lassen
    for (const b of this.crumble) {
      const u = (b.s.y - minY) / Math.max(1, maxY - minY);
      b.delay = (team === 0 ? 1 - u : u) * 1.2 + Math.random() * 0.5;
    }
    this.castles[team]!.visible = false;
    this.crumbleDone = false;
    this.crumbleT = 0;
    const cy = team === 0 ? (this.L.wallBot0 + this.L.wallBot1) / 2 : (this.L.wallTop0 + this.L.wallTop1) / 2;
    this.flash(0.35, 0xffe0c0);
    this.slowmo(0.7, 0.4);
    this.ring(MW / 2, cy, 10, 140, 0.9, 0xffffff, 2, false);
    for (let k = 0; k < 20; k++)
      this.fx.emit({ tex: this.art.puff, x: rnd(this.L.fy0, this.L.fy1), y: cy + rnd(-10, 10), vy: (team === 0 ? -1 : 1) * rnd(10, 40), vz: rnd(4, 14), grav: -4, drag: 1.2, life: rnd(1.4, 2.4), size: 8, size1: rnd(16, 24), color: this.dust, alpha: 0.7, flags: F_WOBBLE | F_FADEIN });
  }

  protected override updateCrumble(dt: number): void {
    if (!this.crumble.length) return;
    this.crumbleT += dt;
    let active = 0;
    this.crumble.forEach((b, k) => {
      if (this.crumbleT < b.delay) {
        active++;
        b.s.x += (Math.random() - 0.5) * 0.6;
        return;
      }
      if (b.s.alpha <= 0) return;
      if (!b.started) {
        b.started = true;
        if (this.ok(0.12)) this.fx.emit({ tex: this.art.puff, x: b.s.x, y: b.s.y, vx: rnd(-8, 8), vz: 4, grav: -6, drag: 1, life: rnd(1, 1.8), size: 5, size1: 14, color: this.dust, alpha: 0.55, flags: F_WOBBLE });
      }
      active++;
      b.vy += 220 * dt;
      b.s.x += b.vx * dt;
      b.s.y += b.vy * dt;
      b.s.rotation += b.vr * dt;
      const land = this.landY[k] ?? MH;
      if (b.s.y > land) {
        b.s.alpha -= dt * 3;
        if (!b.landed) {
          b.landed = true;
          if (this.ok(0.15)) this.fx.emit({ tex: this.art.puff, x: b.s.x, y: land, vx: rnd(-20, 20), vz: 6, grav: -4, drag: 2, life: rnd(0.8, 1.4), size: 4, size1: 12, color: this.dust, alpha: 0.6, flags: F_WOBBLE });
        }
      }
      if (Math.random() < 0.08) this.fx.emit({ tex: this.atlas.fx.px2, x: b.s.x, y: b.s.y, z: 2, vx: (Math.random() - 0.5) * 20, vy: -10, life: 0.6, color: 0xc8c0b0 });
    });
    this.arena.shake = Math.max(this.arena.shake, 0.6);
    if (active === 0 || this.crumbleT > 3.6) {
      for (const b of this.crumble) b.s.destroy();
      this.crumble = [];
      this.crumbleDone = true;
    }
  }
}


// Zeichnet die Arena (640×360): Boden in Welt-Farbe, Burgen (einzeln, damit
// sie zerbröckeln können), Waldrand, Leichen-Decals, Einheiten, Geschosse und
// alle Kampf-Effekte: Explosionen mit Feuerball, Rauch, Trümmern und
// Schockwelle, Lichtstrahlen, Kettenblitze, Flutwelle, Seelen, Glut,
// Umgebungspartikel je Welt, Blitzlicht und Zeitlupe bei großen Momenten.

import { Container, Graphics, Particle, ParticleContainer, Rectangle, RenderTexture, Sprite, Text, Texture, type Application, type IParticle } from 'pixi.js';
import { castleCanvas, forestCanvas, groundCanvas } from '../../lab/battlefield';
import type { PaletteTheme } from '../../lab/palettes';
import { Arena, FX0, FX1, FY0, FY1, MAX_UNITS, P_ARROW, P_ROCK, type ArenaState, type SimEvent } from '../sim/arena';
import type { FxArt, GameAtlas } from './atlas';
import { GLOW_SIZES } from './fxArt';
import { F_BOUNCE, F_FADEIN, F_FLICKER, F_LINEAR, F_ORIENT, F_STAMP, F_WOBBLE, L_ADD, L_GROUND, L_GROUND_ADD, L_TOP, Particles, RAMP, rampOf } from './particles';

const W = 640;
const H = 360;
/** Bodenkreise werden leicht gestaucht gezeichnet (Draufsicht von schräg oben). */
const SQUASH = 0.72;
const TEAM_SOUL = [0x9ae4ff, 0xffd08a];

const hex = (c: string) => parseInt(c.slice(1, 7), 16);
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;

export interface Stamp {
  tex: Texture;
  x: number;
  y: number;
  tint: number;
  alpha: number;
  anchor: number;
  scale: number;
}

export interface Ring {
  x: number;
  y: number;
  r0: number;
  r1: number;
  t: number;
  max: number;
  color: number;
  w: number;
  add: boolean;
  delay: number;
}

export interface Beam {
  x0: number;
  x1: number;
  y: number;
  color: number;
  fx: 'sun' | 'cannon';
  t: number;
  max: number;
}

export interface Chain {
  pts: number[];
  color: number;
  t: number;
  max: number;
}

export interface Block {
  s: Sprite;
  vx: number;
  vy: number;
  delay: number;
  vr: number;
  started: boolean;
  landed: boolean;
}

export class ArenaView {
  readonly root = new Container();
  protected readonly ground: Sprite;
  protected readonly decalRT: RenderTexture;
  protected readonly castles: Sprite[];
  protected readonly castleTex: HTMLCanvasElement[];
  protected readonly units: ParticleContainer;
  protected readonly unitParts: Particle[] = [];
  protected readonly projShadows: ParticleContainer;
  protected readonly projs: ParticleContainer;
  protected readonly projGlow: ParticleContainer;
  protected readonly projParts: Particle[] = [];
  protected readonly glowParts: Particle[] = [];
  protected readonly shadowParts: Particle[] = [];
  protected readonly fx: Particles;
  protected readonly art: FxArt;
  /** Bodenringe (normal / leuchtend), Strahlen & Blitze, Flutwelle, Blitzlicht */
  protected readonly gGround = new Graphics();
  protected readonly gGroundAdd = new Graphics();
  protected readonly gTop = new Graphics();
  protected readonly gAdd = new Graphics();
  protected readonly gScreen = new Graphics();
  protected readonly texts = new Container();
  protected readonly castleFlash = [0, 0];
  protected readonly rings: Ring[] = [];
  protected readonly beams: Beam[] = [];
  protected readonly chains: Chain[] = [];
  protected readonly waves: { team: number; t: number }[] = [];
  protected readonly stamps: Stamp[] = [];
  protected readonly stampLayer = new Container();
  protected readonly stampSprites: Sprite[] = [];
  protected readonly bucket = new Int32Array(H + 2);
  protected readonly order = new Int32Array(MAX_UNITS);
  /** Einblenden der Einheiten beim Aufstellen: Zeitpunkt je Einheit */
  protected readonly revealAt = new Float32Array(MAX_UNITS);
  protected readonly revealed = new Uint8Array(MAX_UNITS);
  protected introT = -1;
  protected crumble: Block[] = [];
  protected crumbleT = 0;
  crumbleDone = false;
  protected readonly dust: number;
  protected readonly race: string;
  protected time = 0;
  /** Bildschirm-Blitz */
  protected flashA = 0;
  protected flashC = 0xffffff;
  /** Zeitlupe (Echtzeit-Sekunden) */
  protected slowLeft = 0;
  protected slowDur = 0;
  protected slowScale = 1;
  protected lastState: ArenaState = 'over';
  /** Explosionsdichte der letzten Momente: dämpft Leuchtkerne, damit nichts zu Weiß verschmilzt */
  protected heat = 0;
  /** Sterbedichte: bei Massensterben blitzen nicht alle Silhouetten gleichzeitig auf */
  protected deathHeat = 0;
  /** Höchstzahl an Zustands-Partikeln (Brand, Frost, Staub …) pro Bild */
  protected statusBudget = 0;
  protected frameK = 1;

  constructor(
    protected readonly app: Application,
    protected readonly atlas: GameAtlas,
    protected readonly arena: Arena,
    theme: PaletteTheme,
  ) {
    const tex = (c: HTMLCanvasElement) => {
      const t = Texture.from(c);
      t.source.scaleMode = 'nearest';
      return t;
    };
    this.art = atlas.art;
    this.race = theme.race ?? 'drifters';
    const groundCv = this.groundCanvas(theme);
    this.dust = this.dustColor(groundCv);
    this.ground = new Sprite(tex(groundCv));
    this.decalRT = RenderTexture.create({ width: this.sw, height: this.sh, scaleMode: 'nearest' });
    const decal = new Sprite(this.decalRT);
    this.castleTex = this.castleCanvases(theme);
    this.castles = this.castleTex.map((c) => new Sprite(tex(c)));
    const forest = new Sprite(tex(this.forestCanvas(theme)));
    const dyn = { position: true, uvs: true, color: true, vertex: true, rotation: true };
    this.units = new ParticleContainer({ dynamicProperties: dyn, roundPixels: true });
    this.projShadows = new ParticleContainer({ dynamicProperties: dyn, roundPixels: true });
    this.projs = new ParticleContainer({ dynamicProperties: dyn });
    this.projGlow = new ParticleContainer({ dynamicProperties: dyn, roundPixels: true });
    this.projGlow.blendMode = 'add';
    this.fx = new Particles(this.art, (t, x, y, c) => this.stamps.push({ tex: t, x, y, tint: c, alpha: 0.85, anchor: 0, scale: 1 }));
    this.gGroundAdd.blendMode = 'add';
    this.gAdd.blendMode = 'add';
    this.gScreen.blendMode = 'add';
    const [pGround, pGroundAdd, pTop, pAdd] = this.fx.layers as [ParticleContainer, ParticleContainer, ParticleContainer, ParticleContainer];
    this.root.addChild(
      this.ground,
      decal,
      pGround,
      this.gGround,
      pGroundAdd,
      this.gGroundAdd,
      this.castles[0]!,
      this.castles[1]!,
      forest,
      this.projShadows,
      this.units,
      pTop,
      this.gTop,
      this.projs,
      this.projGlow,
      pAdd,
      this.gAdd,
      this.texts,
      this.gScreen,
    );
  }

  // --- Einstiegspunkte für andere Bildschirmformate (Handy-Version); PC: Standard ---------

  /** Größe der Arena in Bildschirmpixeln. */
  protected get sw(): number {
    return W;
  }

  protected get sh(): number {
    return H;
  }

  /** Wiese (Bildschirmkoordinaten) für Umgebungspartikel. */
  protected get field(): { x0: number; x1: number; y0: number; y1: number } {
    return { x0: FX0, x1: FX1, y0: FY0, y1: FY1 };
  }

  protected groundCanvas(theme: PaletteTheme): HTMLCanvasElement {
    return groundCanvas(theme);
  }

  protected castleCanvases(theme: PaletteTheme): HTMLCanvasElement[] {
    return [castleCanvas(theme, false), castleCanvas(theme, true)];
  }

  protected forestCanvas(theme: PaletteTheme): HTMLCanvasElement {
    return forestCanvas(theme);
  }

  protected dustColor(ground: HTMLCanvasElement): number {
    return dustColorOf(ground);
  }

  /** Waagrechte Bildschirmgeschwindigkeit einer Einheit (Staubwolken). */
  protected unitVx(i: number): number {
    return this.arena.vx[i]!;
  }

  clearDecals(): void {
    this.app.renderer.render({ container: new Container(), target: this.decalRT, clear: true });
    this.fx.clear();
  }

  /** Einheiten erscheinen nacheinander von der eigenen Burg aus, mit Lichtsäulen. */
  playSpawnIntro(): void {
    const a = this.arena;
    this.introT = 0;
    for (let i = 0; i < a.hw; i++) {
      if (!a.alive[i]) continue;
      const fromBase = a.team[i] === 0 ? a.x[i]! - FX0 : FX1 - a.x[i]!;
      this.revealAt[i] = 0.1 + (fromBase / 220) * 0.9 + Math.random() * 0.25;
      this.revealed[i] = 0;
    }
  }

  get introRunning(): boolean {
    return this.introT >= 0;
  }

  skipIntro(): void {
    if (this.introT >= 0) this.introT = 99;
  }

  /**
   * Zeitlupe für große Momente. Liefert den Faktor, mit dem der Kampfbildschirm
   * Simulation und Darstellung verlangsamt; `realDt` = echte Sekunden.
   */
  timeScale(realDt: number): number {
    if (this.slowLeft <= 0) return 1;
    this.slowLeft -= realDt;
    // die letzten 40 % weich zurück auf normale Geschwindigkeit
    const u = Math.max(0, this.slowLeft) / this.slowDur;
    return u > 0.4 ? this.slowScale : this.slowScale + (1 - this.slowScale) * (1 - u / 0.4);
  }

  protected slowmo(dur: number, scale: number): void {
    if (this.slowLeft > 0 && this.slowScale <= scale) return;
    this.slowLeft = this.slowDur = dur;
    this.slowScale = scale;
  }

  protected flash(a: number, color = 0xffffff): void {
    if (a >= this.flashA) {
      this.flashA = a;
      this.flashC = color;
    }
  }

  update(dt: number): void {
    this.time += dt;
    this.frameK = Math.min(4, dt * 60);
    this.heat = Math.max(0, this.heat - dt * 2.5);
    this.deathHeat = Math.max(0, this.deathHeat - dt * 20);
    const a = this.arena;
    if (this.lastState === 'fight' && a.state === 'march') {
      // Eine Seite ist gefallen: kurzer Atemzug
      this.slowmo(0.9, 0.3);
      this.flash(0.18);
    }
    this.lastState = a.state;
    this.consumeEvents();
    if (this.introT >= 0) {
      this.introT += dt;
      if (this.introT > 1.6) this.introT = -1;
    }
    this.drawUnits();
    this.drawProjectiles();
    this.ambient(dt);
    this.updateCrumble(dt);
    this.fx.update(dt);
    this.fx.draw();
    this.drawGraphics(dt);
    this.flushStamps();
    for (let t = 0; t < 2; t++) {
      this.castleFlash[t] = Math.max(0, this.castleFlash[t]! - dt * 4);
      if (!this.crumble.length || t === 0) this.castles[t]!.tint = this.castleFlash[t]! > 0 ? 0xff8a8a : 0xffffff;
    }
    const s = a.shake;
    this.root.x = s > 0 ? Math.round((Math.random() - 0.5) * s * 4) : 0;
    this.root.y = s > 0 ? Math.round((Math.random() - 0.5) * s * 4) : 0;
  }

  /** Optionaler Effekt? Wird bei vollem Partikelspeicher seltener. */
  protected ok(p: number): boolean {
    const l = this.fx.load;
    return Math.random() < p * (l > 0.6 ? Math.max(0, 1 - (l - 0.6) * 2.5) : 1);
  }

  // --- Einheiten ---------------------------------------------------------------------------

  protected drawUnits(): void {
    const a = this.arena;
    const b = this.bucket;
    b.fill(0);
    for (let i = 0; i < a.hw; i++) if (a.alive[i]) b[Math.min(H, Math.max(0, Math.floor(a.y[i]!))) + 1]!++;
    for (let k = 0; k <= H; k++) b[k + 1]! += b[k]!;
    let n = 0;
    for (let i = 0; i < a.hw; i++) {
      if (!a.alive[i]) continue;
      this.order[b[Math.min(H, Math.max(0, Math.floor(a.y[i]!)))]!++] = i;
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
      // Einblenden beim Aufstellen
      if (this.introT >= 0 && this.introT < this.revealAt[i]!) continue;
      let justRevealed = false;
      if (this.introT >= 0 && !this.revealed[i]) {
        this.revealed[i] = 1;
        justRevealed = true;
        this.spawnFx(a.x[i]!, a.y[i]!, hex(t.glow), t.scale, false);
      }
      p.anchorY = ut.anchorY;
      const moving = Math.abs(a.vx[i]!) + Math.abs(a.vy[i]!) > 3;
      let tex = ut.walk0;
      if (a.flashT[i]! > 0 || justRevealed) tex = ut.flash;
      else if (a.atkT[i]! > 0) tex = ut.attack;
      else if (moving) tex = Math.floor(a.animT[i]!) % 2 === 0 ? ut.walk0 : ut.walk1;
      p.texture = tex;
      p.scaleX = p.scaleY = t.scale;
      const x = a.x[i]!;
      const y = a.y[i]!;
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

  /** Zustände sichtbar machen: Brand, Frost, Schild, Wut, Staub, Boss-Aura. */
  protected unitFx(i: number, x: number, y: number, scale: number, h: number, speed: number, flying: boolean, boss: boolean, rage: boolean, moving: boolean, k60: number): void {
    if (this.statusBudget <= 0 && !boss) return;
    const a = this.arena;
    const fx = this.fx;
    const art = this.art;
    const n0 = fx.n;
    if (a.burnT[i]! > 0) {
      if (this.ok(0.16 * k60)) fx.emit({ tex: art.flame, x: x + rnd(-2, 2) * scale, y, z: rnd(1, h * 0.7), vz: rnd(12, 26), grav: -30, life: rnd(0.3, 0.5), ramp: RAMP.fire, alpha: 0.75, layer: L_ADD, flags: F_FLICKER | F_WOBBLE });
      if (this.ok(0.03 * k60)) fx.emit({ tex: art.puff, x: x + rnd(-2, 2), y, z: h, vz: 14, grav: -10, life: rnd(0.7, 1.1), size: 2, size1: 6, ramp: RAMP.smoke, alpha: 0.45, flags: F_WOBBLE });
    }
    if (a.slowT[i]! > 0 && a.slowMul[i] === 0 && this.ok(0.035 * k60))
      fx.emit({ tex: art.snow, x: x + rnd(-4, 4) * scale, y, z: rnd(0, h), vz: rnd(-4, 6), life: rnd(0.4, 0.7), ramp: RAMP.frost, layer: L_ADD, flags: F_FLICKER });
    if (a.shield[i]! > 0 && this.ok(0.02 * k60)) fx.emit({ tex: art.star, x: x + rnd(-3, 3), y, z: rnd(2, h), life: 0.3, ramp: RAMP.holy, layer: L_ADD, alpha: 0.9 });
    if (rage && a.hp[i]! < a.maxHp[i]! * 0.5 && this.ok(0.03 * k60))
      fx.emit({ tex: art.puff, x: x + rnd(-2, 2), y, z: h * 0.8, vz: 18, grav: -10, life: 0.5, size: 2, size1: 4, color: 0xff5a3a, alpha: 0.55, layer: L_ADD });
    if (moving && !flying && speed >= 30 && this.ok(0.05 * k60))
      fx.emit({ tex: art.puff, x: x + rnd(-2, 2), y: y + 1, vx: -this.unitVx(i) * 0.15, vy: rnd(-2, 2), vz: 6, grav: 10, drag: 2, life: rnd(0.45, 0.7), size: 2, size1: 5, color: this.dust, alpha: 0.5, layer: L_GROUND });
    if (boss && k60 > 0) {
      const pulse = 0.35 + Math.sin(this.time * 4) * 0.12;
      const c = hex(a.types[a.type[i]!]!.glow);
      fx.emit({ tex: art.glow, x, y, life: 0.02, size: 40, color: c, alpha: pulse, layer: L_GROUND_ADD });
      if (this.ok(0.25 * k60)) {
        const an = Math.random() * TAU;
        fx.emit({ tex: art.ember, x: x + Math.cos(an) * 12, y: y + Math.sin(an) * 6, z: rnd(0, 6), vz: rnd(14, 30), grav: -12, life: rnd(0.8, 1.4), ramp: rampOf(c), layer: L_ADD, flags: F_WOBBLE | F_FLICKER | F_FADEIN });
      }
    } else if (scale > 1 && this.ok(0.04 * k60)) {
      fx.emit({ tex: art.ember, x: x + rnd(-6, 6), y, z: rnd(0, h), vz: 12, grav: -8, life: 0.7, ramp: RAMP.holy, layer: L_ADD, flags: F_WOBBLE | F_FLICKER, alpha: 0.7 });
    }
    this.statusBudget -= fx.n - n0;
  }

  /** Einheit erscheint: Lichtsäule, Bodenschein, aufsteigende Funken. */
  protected spawnFx(x: number, y: number, color: number, scale: number, undead: boolean): void {
    const fx = this.fx;
    const art = this.art;
    if (undead) {
      // aus dem Boden kriechen: Erdbrocken, violetter Nebel
      for (let k = 0; k < 4; k++)
        fx.emit({ tex: art.chunk, x: x + rnd(-3, 3), y: y + rnd(-1, 1), vx: rnd(-20, 20), vy: rnd(-6, 6), vz: rnd(30, 60), grav: 260, life: 0.8, color: 0x6a5242, flags: F_BOUNCE, rot: rnd(0, 3), vr: rnd(-10, 10), size: 0.67 });
      fx.emit({ tex: art.glow, x, y, life: 0.5, size: 14, size1: 6, ramp: RAMP.arcane, alpha: 0.7, layer: L_GROUND_ADD });
      for (let k = 0; k < 2; k++) fx.emit({ tex: art.soul, x: x + rnd(-3, 3), y, z: 2, vz: rnd(10, 20), grav: -15, life: rnd(0.6, 0.9), ramp: RAMP.arcane, layer: L_ADD, flags: F_WOBBLE | F_FADEIN, alpha: 0.8 });
      return;
    }
    const big = scale > 1;
    if (big || this.ok(0.6)) fx.emit({ tex: art.pillar, x, y: y - 18 * (big ? 2 : 1), life: big ? 0.6 : 0.35, size: big ? 2 : 1, color, alpha: big ? 0.9 : 0.35, layer: L_ADD, flags: F_LINEAR });
    fx.emit({ tex: art.glow, x, y, life: 0.4, size: big ? 28 : 10, size1: big ? 10 : 4, color, alpha: 0.7, layer: L_GROUND_ADD });
    const n = big ? 16 : 2;
    for (let k = 0; k < n; k++) {
      if (!this.ok(1)) break;
      const an = Math.random() * TAU;
      fx.emit({ tex: k % 3 === 0 ? art.star : art.ember, x: x + Math.cos(an) * 3 * scale, y: y + Math.sin(an) * 1.5 * scale, z: rnd(0, 6), vx: Math.cos(an) * 8, vy: Math.sin(an) * 4, vz: rnd(18, 42), grav: 40, life: rnd(0.4, 0.8), ramp: rampOf(color), layer: L_ADD, flags: F_FLICKER });
    }
    if (big) this.ring(x, y, 2, 24, 0.45, color, 2, true);
  }

  // --- Geschosse --------------------------------------------------------------------------

  protected drawProjectiles(): void {
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
        part.texture = fx.boulder;
        part.x = a.pX[p]! + (a.pTX[p]! - a.pX[p]!) * u;
        part.y = a.pY[p]! + (a.pTY[p]! - a.pY[p]!) * u - a.pZ[p]!;
        part.rotation = Math.floor(a.pT[p]! * 8) * (Math.PI / 2);
        let sh = this.shadowParts[p];
        if (!sh) {
          sh = new Particle({ texture: fx.px2, anchorX: 0.5, anchorY: 0.5, tint: 0x000000, alpha: 0.3 });
          this.shadowParts[p] = sh;
        }
        sh.x = Math.round(part.x);
        sh.y = Math.round(part.y + a.pZ[p]! + 4);
        // Schatten wächst, je näher der Brocken dem Boden kommt
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
        part.x = a.pX[p]!;
        part.y = a.pY[p]!;
        part.rotation = Math.atan2(a.pSY[p]!, a.pSX[p]!);
        if (this.ok(0.25 * k60)) this.fx.emit({ tex: fx.px1, x: part.x - Math.cos(part.rotation) * 4, y: part.y - Math.sin(part.rotation) * 4, life: 0.14, color: 0xf4ecd9, alpha: 0.45, flags: F_LINEAR });
      } else {
        const c = hex(a.pColor[p] ?? '#ffffff');
        part.texture = fx.orb;
        part.tint = c;
        part.x = a.pX[p]!;
        part.y = a.pY[p]!;
        this.addGlow(glows, p, part.x, part.y, 10, c, 0.6);
        if (this.ok(0.6 * k60))
          this.fx.emit({ tex: Math.random() < 0.5 ? art.ember : fx.px1, x: part.x + rnd(-1, 1), y: part.y + rnd(-1, 1), vx: -a.pSX[p]! * 0.08 + rnd(-5, 5), vy: -a.pSY[p]! * 0.08 + rnd(-5, 5), life: rnd(0.2, 0.4), ramp: rampOf(c), layer: L_ADD, flags: F_FLICKER });
      }
      list.push(part);
    }
    this.projs.update();
    this.projShadows.update();
    this.projGlow.update();
  }

  protected addGlow(list: IParticle[], p: number, x: number, y: number, size: number, color: number, alpha: number): void {
    let g = this.glowParts[p];
    if (!g) {
      g = new Particle({ texture: this.art.glow[0]!, anchorX: 0.5, anchorY: 0.5 });
      this.glowParts[p] = g;
    }
    const pulse = Math.floor(this.time * 20 + p) % 2;
    g.texture = this.art.glow[Math.max(0, GLOW_SIZES.findIndex((s) => s >= size + pulse * 2))]!;
    g.x = x;
    g.y = y;
    g.tint = color;
    g.alpha = alpha;
    list.push(g);
  }

  // --- Ereignisse ------------------------------------------------------------------------

  protected consumeEvents(): void {
    const a = this.arena;
    for (const e of a.events) this.onEvent(e);
    a.events.length = 0;
  }

  protected onEvent(e: SimEvent): void {
    switch (e.t) {
      case 'death':
        return this.deathFx(e);
      case 'hit':
        return this.hitFx(e.x, e.y, hex(e.color), !!e.big);
      case 'boom':
        return this.boomFx(e.x, e.y, e.r, hex(e.color), e.fx);
      case 'aura':
        return this.auraFx(e.x, e.y, e.r, e.fx);
      case 'cast':
        return this.castFx(e.x, e.y, e.tx, hex(e.color), e.siege);
      case 'beam':
        return this.beamFx(e.x0, e.x1, e.y, hex(e.color), e.fx);
      case 'chain':
        return this.chainFx(e.pts, hex(e.color));
      case 'heal':
        this.fx.emit({ tex: this.atlas.fx.plus, x: e.x + rnd(-2, 2), y: e.y, vy: -14, life: 0.7, color: hex(e.color), layer: L_ADD });
        return;
      case 'spawn':
        return this.spawnFx(e.x, e.y, hex(e.color), e.big ? 2 : 1, !!e.undead);
      case 'base':
        return this.baseFx(e.team, e.y);
      case 'wave':
        this.waves.push({ team: e.team, t: 0 });
        this.flash(0.12, 0x8ae8ff);
        return;
      case 'text':
        return this.floatText(e.x, e.y, e.text, e.color);
    }
  }

  protected deathFx(e: Extract<SimEvent, { t: 'death' }>): void {
    const fx = this.fx;
    const art = this.art;
    const ut = this.atlas.get(e.vis);
    const c = hex(e.color);
    const scale = e.big ? 2 : 1;
    this.stamps.push({ tex: ut.corpse, x: e.x, y: e.y - 2, tint: 0xffffff, alpha: 0.9, anchor: 0.5, scale });
    // Blutspritzer, die als Flecken liegen bleiben
    const n = e.boss ? 60 : e.big ? 24 : 5;
    for (let k = 0; k < n; k++) {
      if (k > 1 && !this.ok(1)) break;
      const ang = Math.random() * TAU;
      const sp = 12 + Math.random() * (e.big ? 50 : 28);
      fx.emit({ tex: Math.random() < 0.3 ? this.atlas.fx.px2 : this.atlas.fx.px1, x: e.x, y: e.y, z: rnd(3, 7), vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp * 0.5, vz: rnd(30, 70), grav: 160, life: rnd(0.6, 1.1), color: c, flags: F_STAMP });
    }
    // weiße Silhouette blitzt auf und verpufft
    const h = ut.flash.height * scale;
    this.deathHeat++;
    if (e.big || this.ok(1 / (1 + this.deathHeat * 0.08)))
      fx.emit({ tex: ut.flash, x: e.x, y: e.y - h * (ut.anchorY - 0.5), life: 0.2, size: scale, size1: scale * 1.6, alpha: 0.6 / (1 + this.deathHeat * 0.02), layer: L_ADD, flags: F_LINEAR });
    // Seele steigt auf
    if (this.ok(e.big ? 1 : 0.3))
      fx.emit({ tex: art.soul, x: e.x, y: e.y, z: h * 0.6, vz: rnd(10, 18), grav: -14, life: rnd(0.9, 1.4), color: TEAM_SOUL[e.team]!, alpha: 0.75, layer: L_ADD, flags: F_WOBBLE | F_FADEIN });
    if (e.burning && this.ok(0.8)) {
      for (let k = 0; k < 3; k++) fx.emit({ tex: art.puff, x: e.x + rnd(-2, 2), y: e.y, z: rnd(1, 5), vz: rnd(10, 22), grav: -12, life: rnd(0.6, 1), size: 3, size1: 7, ramp: RAMP.fire, alpha: 0.85, flags: F_WOBBLE });
      fx.emit({ tex: art.glow, x: e.x, y: e.y - 3, life: 0.25, size: 14, size1: 4, color: 0xff8a3a, alpha: 0.6, layer: L_ADD });
    }
    if (e.flying && this.ok(0.8))
      for (let k = 0; k < 4; k++) fx.emit({ tex: art.leaf, x: e.x, y: e.y, z: h, vx: rnd(-14, 14), vy: rnd(-4, 4), vz: rnd(4, 16), grav: 30, drag: 1.5, life: rnd(0.9, 1.4), color: 0x3a3440, rot: rnd(0, 6), vr: rnd(-6, 6), flags: F_WOBBLE });
    if (e.big) {
      this.ring(e.x, e.y, 3, e.boss ? 60 : 26, e.boss ? 0.7 : 0.45, 0xffffff, 2, false);
      this.dustRing(e.x, e.y, e.boss ? 16 : 8, e.boss ? 40 : 22);
      this.debris(e.x, e.y, e.boss ? 24 : 8, 0x8a7a6a, e.boss ? 140 : 90);
      fx.emit({ tex: art.glow, x: e.x, y: e.y - h * 0.4, life: 0.35, size: e.boss ? 64 : 32, size1: 8, color: c, alpha: 0.8, layer: L_ADD });
    }
    if (e.boss) {
      this.flash(0.7);
      this.slowmo(1.6, 0.2);
      this.ring(e.x, e.y, 6, 110, 1.1, TEAM_SOUL[e.team]!, 3, true, 0.15);
      this.ring(e.x, e.y, 4, 80, 0.9, 0xffffff, 1, true, 0.3);
      fx.emit({ tex: art.pillar, x: e.x, y: e.y - 70, life: 1.4, size: 4, color: 0xffffff, alpha: 0.9, layer: L_ADD, flags: F_LINEAR });
      for (let k = 0; k < 40; k++) {
        const an = Math.random() * TAU;
        const sp = rnd(30, 120);
        fx.emit({ tex: k % 2 ? art.spark6 : art.star, x: e.x, y: e.y - 8, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp * 0.6, vz: rnd(20, 90), grav: 90, drag: 1.2, life: rnd(0.8, 1.6), ramp: RAMP.spark, layer: L_ADD, flags: F_ORIENT });
      }
      for (let k = 0; k < 10; k++) fx.emit({ tex: art.soul, x: e.x + rnd(-14, 14), y: e.y + rnd(-6, 6), z: rnd(0, 20), vz: rnd(20, 40), grav: -10, life: rnd(1.4, 2.2), color: TEAM_SOUL[e.team]!, layer: L_ADD, flags: F_WOBBLE | F_FADEIN });
    }
  }

  protected hitFx(x: number, y: number, c: number, big: boolean): void {
    const fx = this.fx;
    const art = this.art;
    if (!this.ok(big ? 1 : 0.9)) return;
    const ramp = c === 0xffffff ? RAMP.spark : rampOf(c);
    fx.emit({ tex: big ? art.flare : art.star, x, y, life: big ? 0.18 : 0.1, size: 1, color: c === 0xffffff ? 0xfff6c0 : c, layer: L_ADD, flags: F_LINEAR });
    const n = big ? 7 : 2;
    for (let k = 0; k < n; k++) {
      const an = Math.random() * TAU;
      const sp = rnd(35, big ? 110 : 70);
      fx.emit({ tex: art.spark3, x, y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp * 0.6, vz: rnd(0, 30), grav: 0, drag: 5, life: rnd(0.12, 0.22), ramp, layer: L_ADD, flags: F_ORIENT });
    }
    if (big) {
      fx.emit({ tex: art.slash, x, y: y - 1, life: 0.14, size: 1, rot: rnd(-0.6, 0.6), color: 0xffffff, layer: L_ADD, flags: F_LINEAR });
      this.dustRing(x, y + 3, 4, 12);
    } else if (c !== 0xffffff) {
      fx.emit({ tex: art.glow, x, y, life: 0.12, size: 8, size1: 3, color: c, alpha: 0.7, layer: L_ADD });
    }
  }

  // --- Explosionen & Flächen ---------------------------------------------------------------

  /** Helligkeit für Leuchtkerne: sinkt, wenn viele Explosionen gleichzeitig laufen. */
  protected get glowK(): number {
    return 1 / (1 + this.heat * 0.18);
  }

  protected boomFx(x: number, y: number, r: number, c: number, kind: string | undefined): void {
    const fx = this.fx;
    const art = this.art;
    this.heat += r / 12;
    switch (kind) {
      case 'fire':
      case 'meteor':
      case 'colossus': {
        const big = kind === 'colossus' ? 2 : kind === 'meteor' ? 1.4 : 1;
        this.stamps.push({ tex: this.atlas.fx.scorch, x, y, tint: 0xffffff, alpha: 0.9, anchor: 0.5, scale: Math.max(1, Math.round((r / 10) * big * 0.7)) });
        this.fireball(x, y, r * big);
        if (kind === 'meteor') {
          // Feuersäule vom Himmel
          fx.emit({ tex: art.pillar, x, y: y - 40, life: 0.5, size: 3, color: 0xff8a3a, alpha: 0.9, layer: L_ADD, flags: F_LINEAR });
          for (let k = 0; k < 8; k++) fx.emit({ tex: art.puff, x: x + rnd(-3, 3), y, z: k * 8, vz: rnd(10, 30), grav: -10, life: rnd(0.4, 0.8), size: 7, size1: 3, ramp: RAMP.fireHot, layer: L_ADD });
        }
        if (kind === 'colossus') {
          this.flash(0.45, 0xffa050);
          this.slowmo(0.8, 0.35);
          this.stamps.push({ tex: this.atlas.fx.crater, x, y, tint: 0xffffff, alpha: 0.9, anchor: 0.5, scale: 3 });
          this.debris(x, y, 26, 0x8a8a96, 150);
          this.ring(x, y, 4, r * 3, 0.6, 0xffffff, 2, false);
          this.ring(x, y, 4, r * 2.2, 0.5, 0xffa050, 3, true, 0.08);
          for (let k = 0; k < 10; k++) fx.emit({ tex: art.puff, x: x + rnd(-10, 10), y: y + rnd(-5, 5), z: rnd(2, 10), vx: rnd(-20, 20), vz: rnd(20, 45), grav: -15, drag: 1.5, life: rnd(1, 1.6), size: 6, size1: 16, ramp: RAMP.steam, alpha: 0.55, flags: F_WOBBLE | F_LINEAR });
        }
        return;
      }
      case 'boulder':
      case 'rock': {
        const heavy = kind === 'boulder';
        if (r >= 12) this.stamps.push({ tex: this.atlas.fx.crater, x, y, tint: 0xffffff, alpha: 0.9, anchor: 0.5, scale: Math.max(1, Math.round(r / 11)) });
        fx.emit({ tex: art.glow, x, y: y - 2, life: 0.14, size: r * 2.2, size1: r, color: 0xfff6d0, alpha: 0.6 * this.glowK, layer: L_ADD });
        fx.emit({ tex: art.flare, x, y: y - 2, life: 0.1, size: heavy ? 2 : 1, color: 0xffffff, layer: L_ADD, flags: F_LINEAR });
        this.ring(x, y, 2, r * 1.6, 0.4, 0xffffff, heavy ? 3 : 2, false);
        if (heavy) this.ring(x, y, 2, r * 2.6, 0.65, this.dust, 2, false, 0.06);
        this.dustRing(x, y, heavy ? 16 : 10, r * 1.4);
        // Staubfontäne nach oben
        for (let k = 0; k < (heavy ? 6 : 3); k++) fx.emit({ tex: art.puff, x: x + rnd(-4, 4), y, z: rnd(2, 6), vx: rnd(-10, 10), vz: rnd(30, 60), grav: 40, drag: 1.5, life: rnd(0.8, 1.2), size: 5, size1: rnd(10, 14), color: this.dust, alpha: 0.8, flags: F_WOBBLE });
        this.debris(x, y, heavy ? 16 : 8, 0xd8d0c8, heavy ? 120 : 80);
        for (let k = 0; k < (heavy ? 6 : 3); k++) {
          const an = Math.random() * TAU;
          fx.emit({ tex: art.spark3, x, y: y - 2, vx: Math.cos(an) * 90, vy: Math.sin(an) * 50, vz: rnd(20, 50), grav: 120, drag: 2, life: 0.3, ramp: RAMP.spark, layer: L_ADD, flags: F_ORIENT });
        }
        return;
      }
      case 'frost': {
        fx.emit({ tex: art.glow, x, y: y - 2, life: 0.4, size: 40, size1: 10, ramp: RAMP.frost, alpha: 0.9, layer: L_ADD });
        fx.emit({ tex: art.flare, x, y: y - 2, life: 0.16, size: 2, color: 0xe8fbff, layer: L_ADD, flags: F_LINEAR });
        fx.emit({ tex: art.glow, x, y, life: 1.2, size: 28, size1: 20, color: 0x8ae8ff, alpha: 0.35, layer: L_GROUND_ADD, flags: F_LINEAR });
        this.ring(x, y, 2, r * 2.2, 0.45, 0xbff4ff, 2, true);
        for (let k = 0; k < 18; k++) {
          const an = Math.random() * TAU;
          const sp = rnd(30, 75);
          fx.emit({ tex: art.shard, x, y: y - 2, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp * 0.6, vz: rnd(20, 60), grav: 180, drag: 1, life: rnd(0.4, 0.7), ramp: RAMP.frost, flags: F_ORIENT, layer: k % 2 ? L_ADD : L_TOP });
        }
        for (let k = 0; k < 6; k++) fx.emit({ tex: art.snow, x: x + rnd(-r, r), y: y + rnd(-r, r) * 0.6, z: rnd(0, 10), vz: -4, life: rnd(0.6, 1), ramp: RAMP.frost, layer: L_ADD, flags: F_FLICKER });
        for (let k = 0; k < 4; k++) fx.emit({ tex: art.puff, x: x + rnd(-4, 4), y: y + rnd(-2, 2), vx: rnd(-18, 18), vy: rnd(-6, 6), drag: 2.5, life: rnd(0.6, 0.9), size: 4, size1: 10, ramp: RAMP.frost, alpha: 0.45, layer: L_GROUND });
        return;
      }
      case 'whirl': {
        // Wirbel: Hiebe rundherum, die sich nach außen drehen
        for (let k = 0; k < 8; k++) {
          const an = (k / 8) * TAU + rnd(0, 0.3);
          const rr = r * 0.6;
          fx.emit({ tex: art.slash, x: x + Math.cos(an) * rr, y: y - 3 + Math.sin(an) * rr * SQUASH, vx: -Math.sin(an) * 70 + Math.cos(an) * 25, vy: (Math.cos(an) * 70 + Math.sin(an) * 25) * SQUASH, drag: 4, life: 0.22, rot: an + Math.PI / 2, vr: 18, color: 0xffffff, layer: L_ADD, flags: F_LINEAR });
        }
        this.ring(x, y, r * 0.4, r * 1.3, 0.3, 0xffffff, 3, true);
        this.ring(x, y, r * 0.2, r * 1.8, 0.4, 0xffffff, 1, false, 0.05);
        fx.emit({ tex: art.glow, x, y: y - 3, life: 0.2, size: 32, size1: 12, color: 0xffffff, alpha: 0.5, layer: L_ADD });
        this.dustRing(x, y, 10, r * 1.4);
        return;
      }
      case 'root': {
        fx.emit({ tex: art.glow, x, y, life: 0.8, size: 56, size1: 40, ramp: RAMP.heal, alpha: 0.4, layer: L_GROUND_ADD });
        this.ring(x, y, 4, r, 0.5, 0x7cd24a, 2, true);
        this.ring(x, y, 2, r * 0.7, 0.6, 0x3a6a2a, 1, false, 0.1);
        // Wurzeln brechen aus dem Boden
        for (let k = 0; k < 24; k++) {
          const an = Math.random() * TAU;
          const d = Math.sqrt(Math.random()) * r;
          fx.emit({ tex: art.chunk, x: x + Math.cos(an) * d, y: y + Math.sin(an) * d * SQUASH, vz: rnd(30, 70), grav: 260, life: 0.7, color: k % 2 ? 0x4a3a28 : 0x3a6a2a, flags: F_BOUNCE, size: 0.67 });
          fx.emit({ tex: art.leaf, x: x + Math.cos(an) * d, y: y + Math.sin(an) * d * SQUASH, vx: rnd(-10, 10), vz: rnd(30, 60), grav: 60, drag: 1.5, life: rnd(0.9, 1.5), ramp: [0xb8ff8a, 0x7cd24a, 0x4a9a3a], rot: rnd(0, 6), vr: rnd(-8, 8), flags: F_WOBBLE });
        }
        return;
      }
      case 'bloat':
      case 'spore': {
        const toxic = kind === 'bloat';
        const ramp = toxic ? RAMP.toxic : RAMP.spore;
        fx.emit({ tex: art.glow, x, y: y - 2, life: 0.25, size: 24, size1: 8, ramp, alpha: 0.8, layer: L_ADD });
        for (let k = 0; k < 7; k++) {
          const an = Math.random() * TAU;
          const sp = rnd(8, 26);
          fx.emit({ tex: art.puff, x, y, z: rnd(1, 5), vx: Math.cos(an) * sp, vy: Math.sin(an) * sp * 0.6, vz: rnd(2, 8), grav: -2, drag: 1.2, life: rnd(1.1, 1.8), size: 3, size1: rnd(8, 12), ramp, alpha: 0.5, flags: F_WOBBLE });
        }
        for (let k = 0; k < 8; k++)
          fx.emit({ tex: toxic ? art.bubble : art.ember, x: x + rnd(-r, r) * 0.8, y: y + rnd(-r, r) * 0.5, z: rnd(0, 6), vz: rnd(6, 16), grav: -6, life: rnd(0.8, 1.5), ramp, layer: L_ADD, flags: F_WOBBLE | F_FADEIN, alpha: 0.8 });
        if (toxic)
          for (let k = 0; k < 8; k++) {
            const an = Math.random() * TAU;
            fx.emit({ tex: this.atlas.fx.px2, x, y, z: 4, vx: Math.cos(an) * rnd(20, 50), vy: Math.sin(an) * rnd(10, 25), vz: rnd(30, 60), grav: 170, life: 1, color: 0x7cd24a, flags: F_STAMP });
          }
        return;
      }
      default: {
        // allgemeiner Knall (z. B. alte Ereignisse ohne Art)
        fx.emit({ tex: art.glow, x, y, life: 0.2, size: r * 2, size1: r * 0.5, ramp: rampOf(c), alpha: 0.8, layer: L_ADD });
        this.ring(x, y, 2, r * 1.3, 0.35, c, 1, true);
        const n = Math.min(30, 8 + r);
        for (let k = 0; k < n; k++) {
          const an = Math.random() * TAU;
          const sp = rnd(15, 15 + r * 2.5);
          fx.emit({ tex: k % 4 === 0 ? this.atlas.fx.px2 : this.atlas.fx.px1, x, y, z: 2, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp * 0.6, vz: rnd(30, 80), grav: 160, life: rnd(0.4, 0.8), color: k % 3 ? c : 0xffffff });
        }
      }
    }
  }

  /** Feuerball: Blitz, heiße Kugel, Flammenwolken, Glut und Rauch. */
  protected fireball(x: number, y: number, r: number): void {
    const fx = this.fx;
    const art = this.art;
    const k = this.glowK;
    fx.emit({ tex: art.glow, x, y: y - 4, life: 0.4, size: Math.min(64, r * 3.4), size1: r, ramp: RAMP.fireHot, alpha: 0.8 * k, layer: L_ADD });
    fx.emit({ tex: art.glow, x, y, life: 1.1, size: Math.min(64, r * 3.5), size1: r * 1.5, color: 0xff6a1f, alpha: 0.45 * k, layer: L_GROUND_ADD });
    if (k > 0.5) fx.emit({ tex: art.flare, x, y: y - 4, life: 0.14, size: r > 20 ? 3 : 2, color: 0xffffff, alpha: k, layer: L_ADD, flags: F_LINEAR });
    this.ring(x, y, 2, r * 1.8, 0.35, 0xffd84a, 2, true);
    this.ring(x, y, 2, r * 2.6, 0.5, 0xffffff, 1, false, 0.04);
    // heißer Kern: helle Wolken, die schnell durch die Feuerfarben laufen
    const n = Math.round(8 + r * 0.8);
    for (let k = 0; k < n; k++) {
      const an = Math.random() * TAU;
      const sp = rnd(10, 18 + r * 2.4);
      fx.emit({ tex: art.puff, x: x + Math.cos(an) * 2, y: y + Math.sin(an), z: rnd(2, 8), vx: Math.cos(an) * sp, vy: Math.sin(an) * sp * 0.6, vz: rnd(10, 40), grav: -18, drag: 2.5, life: rnd(0.6, 1.1), size: rnd(6, 10), size1: rnd(10, 18), ramp: RAMP.fire, flags: F_WOBBLE });
    }
    for (let k = 0; k < Math.round(4 + r * 0.3); k++) {
      const an = Math.random() * TAU;
      fx.emit({ tex: art.puff, x, y: y - 2, z: rnd(2, 8), vx: Math.cos(an) * r, vy: Math.sin(an) * r * 0.5, vz: rnd(15, 30), grav: -10, drag: 3, life: rnd(0.3, 0.5), size: rnd(8, 12), size1: 4, ramp: RAMP.fire, alpha: 0.9, layer: L_TOP });
    }
    for (let k = 0; k < Math.round(r * 0.8); k++) {
      const an = Math.random() * TAU;
      const sp = rnd(20, 50 + r * 2);
      fx.emit({ tex: art.ember, x, y: y - 2, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp * 0.6, vz: rnd(40, 110), grav: 90, drag: 1.2, life: rnd(0.8, 1.6), ramp: RAMP.spark, layer: L_ADD, flags: F_FLICKER | F_WOBBLE });
    }
    for (let k = 0; k < Math.round(3 + r * 0.25); k++)
      fx.emit({ tex: art.puff, x: x + rnd(-r, r) * 0.4, y: y + rnd(-2, 2), z: rnd(6, 14), vx: rnd(-6, 6), vz: rnd(8, 18), grav: -6, drag: 0.8, life: rnd(1.4, 2.2), size: 5, size1: rnd(12, 18), ramp: RAMP.smoke, alpha: 0.6, flags: F_WOBBLE | F_FADEIN });
  }

  protected dustRing(x: number, y: number, n: number, r: number): void {
    for (let k = 0; k < n; k++) {
      if (k > 2 && !this.ok(1)) return;
      const an = (k / n) * TAU + rnd(0, 0.4);
      const sp = rnd(0.8, 1.4) * r * 1.8;
      this.fx.emit({ tex: this.art.puff, x: x + Math.cos(an) * 2, y: y + Math.sin(an), vx: Math.cos(an) * sp, vy: Math.sin(an) * sp * SQUASH, vz: rnd(2, 10), grav: -4, drag: 3.2, life: rnd(0.6, 1.1), size: 4, size1: rnd(8, 12), color: this.dust, alpha: 0.8, flags: F_WOBBLE });
    }
  }

  protected debris(x: number, y: number, n: number, color: number, sp: number): void {
    for (let k = 0; k < n; k++) {
      if (k > 2 && !this.ok(1)) return;
      const an = Math.random() * TAU;
      const s = rnd(0.2, 1) * sp;
      this.fx.emit({ tex: Math.random() < 0.5 ? this.art.chunk : this.atlas.fx.px2, x, y, z: rnd(2, 6), vx: Math.cos(an) * s, vy: Math.sin(an) * s * 0.55, vz: rnd(50, 130), grav: 300, life: rnd(1.2, 2), color, rot: rnd(0, 6), vr: rnd(-14, 14), flags: F_BOUNCE });
    }
  }

  protected auraFx(x: number, y: number, r: number, kind: 'moon' | 'bless' | 'mend'): void {
    const fx = this.fx;
    const art = this.art;
    const ramp = kind === 'moon' ? RAMP.moon : kind === 'bless' ? RAMP.holy : RAMP.heal;
    const col = ramp[2]!;
    fx.emit({ tex: art.glow, x, y, life: 0.8, size: Math.min(64, r * 1.8), size1: r, color: col, alpha: 0.35, layer: L_GROUND_ADD, flags: F_FADEIN });
    this.ring(x, y, r * 0.2, r, 0.6, col, kind === 'moon' ? 2 : 1, true);
    const n = kind === 'moon' ? 18 : 10;
    for (let k = 0; k < n; k++) {
      if (!this.ok(1)) return;
      const an = Math.random() * TAU;
      const d = Math.sqrt(Math.random()) * r;
      const px = x + Math.cos(an) * d;
      const py = y + Math.sin(an) * d * SQUASH;
      if (kind === 'bless' && k < 4) fx.emit({ tex: art.pillar, x: px, y: py - 14, life: 0.5, size: 1, color: 0xfff0a0, alpha: 0.6, layer: L_ADD, flags: F_LINEAR });
      fx.emit({ tex: kind === 'mend' ? this.atlas.fx.plus : kind === 'bless' ? art.cross : art.star, x: px, y: py, z: rnd(0, 6), vz: rnd(10, 22), grav: -6, life: rnd(0.7, 1.1), ramp, layer: L_ADD, flags: F_FADEIN | F_WOBBLE, alpha: 0.9 });
    }
  }

  protected castFx(x: number, y: number, tx: number, c: number, siege: boolean): void {
    const fx = this.fx;
    const art = this.art;
    if (siege) {
      // Wurfarm schlägt aus: Staub unten, Holzsplitter
      const dir = tx > x ? 1 : -1;
      for (let k = 0; k < 4; k++) fx.emit({ tex: art.puff, x: x + rnd(-5, 5), y: y + 16, vx: rnd(-10, 10) + dir * 12, vz: rnd(4, 12), grav: -4, drag: 2.5, life: rnd(0.5, 0.9), size: 3, size1: 8, color: this.dust, alpha: 0.6, layer: L_GROUND });
      return;
    }
    if (!this.ok(0.85)) return;
    fx.emit({ tex: art.glow, x, y, life: 0.18, size: 12, size1: 4, color: c, alpha: 0.9, layer: L_ADD });
    fx.emit({ tex: art.glow, x, y: y + 6, life: 0.3, size: 14, size1: 8, color: c, alpha: 0.4, layer: L_GROUND_ADD });
    for (let k = 0; k < 3; k++) {
      const an = Math.random() * TAU;
      fx.emit({ tex: art.ember, x, y, vx: Math.cos(an) * 24, vy: Math.sin(an) * 14, vz: 10, life: rnd(0.25, 0.4), ramp: rampOf(c), layer: L_ADD, flags: F_FLICKER });
    }
  }

  protected beamFx(x0: number, x1: number, y: number, c: number, kind: 'sun' | 'cannon'): void {
    const fx = this.fx;
    const art = this.art;
    // bei vielen gleichzeitigen Strahlen nicht alles überblenden
    const same = this.beams.reduce((n, b) => n + (b.fx === kind ? 1 : 0), 0);
    if (same >= (kind === 'sun' ? 5 : 8)) return;
    const dir = x1 > x0 ? 1 : -1;
    const len = Math.abs(x1 - x0);
    const by = Math.round(y) - 4;
    this.beams.push({ x0, x1, y: by, color: c, fx: kind, t: kind === 'sun' ? 0.55 : 0.3, max: kind === 'sun' ? 0.55 : 0.3 });
    if (kind === 'sun') {
      fx.emit({ tex: art.flare, x: x0, y: by, life: 0.4, size: 2, color: 0xffffff, layer: L_ADD, flags: F_LINEAR });
      fx.emit({ tex: art.glow, x: x0, y: by, life: 0.45, size: 32, size1: 10, ramp: RAMP.holy, layer: L_ADD });
      for (let d = 6; d < len; d += 9) {
        if (!this.ok(0.8)) continue;
        fx.emit({ tex: Math.random() < 0.4 ? art.star : art.ember, x: x0 + dir * d, y: by + rnd(-3, 3), vx: dir * rnd(4, 14), vy: rnd(-4, 2), vz: rnd(4, 14), grav: -6, life: rnd(0.4, 0.9), ramp: RAMP.holy, layer: L_ADD, flags: F_FLICKER | F_FADEIN });
      }
      fx.emit({ tex: art.glow, x: x0 + dir * len * 0.5, y: by + 4, life: 0.5, size: 64, size1: 40, color: 0xfff0a0, alpha: 0.25, layer: L_GROUND_ADD });
    } else {
      // Kanone: Mündungsfeuer, Rauchspur, aufgewirbelter Staub
      fx.emit({ tex: art.glow, x: x0 + dir * 6, y: by, life: 0.2, size: 28, size1: 8, ramp: RAMP.fireHot, layer: L_ADD });
      fx.emit({ tex: art.flare, x: x0 + dir * 6, y: by, life: 0.12, size: 2, color: 0xfff6c0, layer: L_ADD, flags: F_LINEAR });
      for (let k = 0; k < 6; k++) fx.emit({ tex: art.puff, x: x0 + dir * 8, y: by + rnd(-2, 2), vx: dir * rnd(30, 90), vy: rnd(-12, 12), drag: 4, life: rnd(0.3, 0.6), size: 5, size1: 3, ramp: RAMP.fire, layer: L_TOP });
      for (let d = 10; d < len; d += 13) {
        if (!this.ok(0.9)) continue;
        fx.emit({ tex: art.puff, x: x0 + dir * d + rnd(-3, 3), y: by + rnd(-2, 2), vx: dir * rnd(2, 10), vy: rnd(-3, 3), vz: rnd(2, 8), grav: -3, drag: 1, life: rnd(0.6, 1.2), size: 2, size1: rnd(6, 9), ramp: RAMP.smokeLight, alpha: 0.55, flags: F_WOBBLE | F_FADEIN });
        if (d % 26 < 13) fx.emit({ tex: art.puff, x: x0 + dir * d, y: y + 2, vx: dir * 10, vy: rnd(-8, 8), drag: 2.5, life: 0.6, size: 3, size1: 7, color: this.dust, alpha: 0.5, layer: L_GROUND });
      }
    }
  }

  protected chainFx(pts: number[], c: number): void {
    if (this.chains.length >= 10) return;
    this.chains.push({ pts, color: c, t: 0.35, max: 0.35 });
    this.flash(0.06, 0xc8ffb0);
    for (let i = 0; i + 1 < pts.length; i += 2) {
      const x = pts[i]!;
      const y = pts[i + 1]!;
      this.fx.emit({ tex: this.art.glow, x, y, life: 0.3, size: 16, size1: 4, ramp: RAMP.electric, layer: L_ADD });
      for (let k = 0; k < 3; k++) {
        const an = Math.random() * TAU;
        this.fx.emit({ tex: this.art.spark3, x, y, vx: Math.cos(an) * 60, vy: Math.sin(an) * 40, drag: 5, life: 0.2, ramp: RAMP.electric, layer: L_ADD, flags: F_ORIENT });
      }
    }
  }

  protected baseFx(team: number, y: number): void {
    const fx = this.fx;
    const art = this.art;
    this.castleFlash[team] = 1;
    const x = team === 0 ? FX0 - 4 : FX1 + 4;
    const out = team === 0 ? 1 : -1;
    fx.emit({ tex: art.glow, x, y: y - 6, life: 0.22, size: 18, size1: 6, color: 0xff6a5a, alpha: 0.8, layer: L_ADD });
    fx.emit({ tex: art.star, x, y: y - 6, life: 0.12, color: 0xffffff, layer: L_ADD, flags: F_LINEAR });
    for (let k = 0; k < 4; k++) fx.emit({ tex: art.chunk, x, y: y + rnd(-3, 3), z: rnd(4, 14), vx: out * rnd(20, 60), vy: rnd(-12, 12), vz: rnd(20, 60), grav: 280, life: 1.2, color: 0xb8b0a8, rot: rnd(0, 6), vr: rnd(-12, 12), size: 0.67, flags: F_BOUNCE });
    for (let k = 0; k < 3; k++) {
      const an = rnd(-1, 1);
      fx.emit({ tex: art.spark3, x, y: y - 6, vx: out * Math.cos(an) * 80, vy: Math.sin(an) * 50, drag: 4, life: 0.2, ramp: RAMP.spark, layer: L_ADD, flags: F_ORIENT });
    }
    if (this.ok(0.6)) fx.emit({ tex: art.puff, x: x + out * 4, y, vx: out * 10, vz: 6, grav: -4, drag: 2, life: 0.7, size: 3, size1: 8, color: this.dust, alpha: 0.6 });
  }

  /** Expandierender Kreis auf dem Boden (Schockwelle, Magie). */
  protected ring(x: number, y: number, r0: number, r1: number, dur: number, color: number, w: number, add: boolean, delay = 0): void {
    if (this.rings.length > 120) return;
    this.rings.push({ x, y, r0, r1, t: 0, max: dur, color, w, add, delay });
  }

  // --- Umgebung ----------------------------------------------------------------------------

  /** Stimmung je Welt: Staub, Glut, Glühwürmchen, Regen, Lichtfunken, Sporen … */
  protected ambient(dt: number): void {
    const fx = this.fx;
    const art = this.art;
    if (fx.load > 0.5 || dt <= 0) return;
    const rate = dt * 60;
    const f = this.field;
    const fieldX = () => rnd(f.x0, f.x1);
    const fieldY = () => rnd(f.y0 - 4, f.y1 + 4);
    switch (this.race) {
      case 'ashclan':
        if (Math.random() < 0.35 * rate) fx.emit({ tex: art.ember, x: fieldX(), y: fieldY(), vx: rnd(-4, 8), vy: rnd(-4, 2), vz: rnd(6, 16), grav: -2, life: rnd(2, 4), ramp: RAMP.spark, layer: L_ADD, alpha: 0.8, flags: F_WOBBLE | F_FLICKER | F_FADEIN });
        if (Math.random() < 0.25 * rate) fx.emit({ tex: this.atlas.fx.px1, x: fieldX(), y: fieldY() - 30, vx: rnd(4, 10), vy: rnd(8, 14), life: rnd(3, 5), color: 0x8a8480, alpha: 0.6, flags: F_WOBBLE | F_FADEIN });
        break;
      case 'wildwood':
        if (Math.random() < 0.12 * rate) fx.emit({ tex: art.glow, x: fieldX(), y: fieldY(), vx: rnd(-4, 4), vy: rnd(-3, 3), z: rnd(4, 16), vz: rnd(-2, 2), life: rnd(3, 5), size: 4, color: 0xd8ff6a, alpha: 0.9, layer: L_ADD, flags: F_WOBBLE | F_FLICKER | F_FADEIN });
        if (Math.random() < 0.15 * rate) fx.emit({ tex: art.leaf, x: fieldX(), y: fieldY() - 40, vx: rnd(6, 14), vy: rnd(8, 14), life: rnd(4, 6), ramp: [0xb8e86a, 0x8ac84a, 0x6aa83a], rot: rnd(0, 6), vr: rnd(-2, 2), alpha: 0.8, flags: F_WOBBLE | F_FADEIN });
        break;
      case 'tidebound':
        for (let k = 0; k < 2; k++)
          if (Math.random() < 0.8 * rate) fx.emit({ tex: art.drop, x: rnd(f.x0 - 20, f.x1), y: fieldY(), z: rnd(90, 140), vx: 18, vz: -230, grav: 1, life: 1, color: 0xc8f0ff, alpha: 0.45, layer: L_TOP });
        if (Math.random() < 0.4 * rate) fx.emit({ tex: art.bubble, x: fieldX(), y: fieldY(), life: 0.25, size: 1, color: 0xc8f0ff, alpha: 0.4, layer: L_GROUND, flags: F_LINEAR });
        if (Math.random() < 0.05 * rate) fx.emit({ tex: art.puff, x: fieldX(), y: fieldY(), vx: rnd(3, 8), life: rnd(4, 6), size: 18, size1: 24, color: 0xd8f0ff, alpha: 0.12, layer: L_GROUND, flags: F_FADEIN | F_LINEAR });
        break;
      case 'sunlegion':
        if (Math.random() < 0.25 * rate) fx.emit({ tex: Math.random() < 0.3 ? art.star : this.atlas.fx.px1, x: fieldX(), y: fieldY(), vz: rnd(4, 10), grav: -1, life: rnd(2, 4), ramp: RAMP.holy, alpha: 0.8, layer: L_ADD, flags: F_WOBBLE | F_FLICKER | F_FADEIN });
        break;
      case 'plague':
        if (Math.random() < 0.2 * rate) fx.emit({ tex: art.ember, x: fieldX(), y: fieldY(), vx: rnd(-3, 3), vz: rnd(4, 10), grav: -2, life: rnd(3, 5), ramp: RAMP.arcane, alpha: 0.7, layer: L_ADD, flags: F_WOBBLE | F_FADEIN });
        if (Math.random() < 0.06 * rate) fx.emit({ tex: art.puff, x: fieldX(), y: fieldY(), vx: rnd(2, 6), life: rnd(5, 7), size: 16, size1: 24, color: 0x9ac86a, alpha: 0.14, layer: L_GROUND, flags: F_FADEIN | F_LINEAR });
        break;
      case 'deepforge':
        if (Math.random() < 0.12 * rate) fx.emit({ tex: art.spark3, x: fieldX(), y: fieldY(), z: rnd(60, 110), vx: rnd(-10, 10), vz: -20, grav: 160, life: 1.2, ramp: RAMP.spark, layer: L_ADD, flags: F_ORIENT | F_BOUNCE });
        if (Math.random() < 0.3 * rate) fx.emit({ tex: this.atlas.fx.px1, x: fieldX(), y: fieldY() - 30, vy: rnd(10, 20), life: rnd(2, 4), color: 0xa8a4a0, alpha: 0.5, flags: F_FADEIN });
        break;
      default:
        if (Math.random() < 0.3 * rate) fx.emit({ tex: this.atlas.fx.px1, x: fieldX(), y: fieldY(), vx: rnd(6, 16), vy: rnd(-2, 3), life: rnd(3, 6), color: 0xf4ecd9, alpha: 0.45, flags: F_WOBBLE | F_FADEIN });
    }
  }

  // --- Linien, Ringe, Wellen, Blitzlicht ------------------------------------------------------

  protected drawGraphics(dt: number): void {
    const gg = this.gGround;
    const gga = this.gGroundAdd;
    const gt = this.gTop;
    const ga = this.gAdd;
    gg.clear();
    gga.clear();
    gt.clear();
    ga.clear();

    for (let k = this.rings.length - 1; k >= 0; k--) {
      const r = this.rings[k]!;
      r.t += dt;
      const t = r.t - r.delay;
      if (t < 0) continue;
      if (t >= r.max) {
        this.rings.splice(k, 1);
        continue;
      }
      const u = t / r.max;
      const e = 1 - (1 - u) * (1 - u) * (1 - u);
      const rad = r.r0 + (r.r1 - r.r0) * e;
      const g = r.add ? gga : gg;
      const w = Math.max(1, Math.round(r.w * (1 - u) + 0.4));
      g.ellipse(Math.round(r.x), Math.round(r.y), Math.round(rad), Math.max(1, Math.round(rad * SQUASH))).stroke({ color: r.color, width: w, alpha: (r.add ? 0.9 : 0.55) * (1 - u) });
    }

    for (let k = this.beams.length - 1; k >= 0; k--) {
      const b = this.beams[k]!;
      b.t -= dt;
      if (b.t <= 0) {
        this.beams.splice(k, 1);
        continue;
      }
      this.drawBeam(b, b.t / b.max, ga);
    }

    for (let k = this.chains.length - 1; k >= 0; k--) {
      const c = this.chains[k]!;
      c.t -= dt;
      if (c.t <= 0) {
        this.chains.splice(k, 1);
        continue;
      }
      const a = Math.min(1, c.t / 0.15);
      // jedes Bild neu gezackt → knisternder Blitz
      const path: number[] = [];
      for (let i = 0; i + 3 < c.pts.length; i += 2) {
        const x0 = c.pts[i]!;
        const y0 = c.pts[i + 1]!;
        const x1 = c.pts[i + 2]!;
        const y1 = c.pts[i + 3]!;
        const dx = x1 - x0;
        const dy = y1 - y0;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const segs = Math.max(2, Math.round(len / 7));
        if (i === 0) path.push(x0, y0);
        for (let s = 1; s < segs; s++) {
          const off = (Math.random() - 0.5) * 7;
          path.push(x0 + (dx * s) / segs + nx * off, y0 + (dy * s) / segs + ny * off);
        }
        path.push(x1, y1);
      }
      ga.moveTo(path[0]!, path[1]!);
      for (let i = 2; i < path.length; i += 2) ga.lineTo(path[i]!, path[i + 1]!);
      ga.stroke({ color: c.color, width: 3, alpha: 0.35 * a });
      ga.moveTo(path[0]!, path[1]!);
      for (let i = 2; i < path.length; i += 2) ga.lineTo(path[i]!, path[i + 1]!);
      ga.stroke({ color: 0xffffff, width: 1, alpha: a });
    }

    for (let k = this.waves.length - 1; k >= 0; k--) {
      const wv = this.waves[k]!;
      wv.t += dt;
      const DUR = 0.85;
      if (wv.t > DUR) {
        this.waves.splice(k, 1);
        continue;
      }
      this.drawWave(wv.team, wv.t / DUR);
    }

    // Last Stand: pulsierendes Leuchten an der eigenen Burg
    const a = this.arena;
    if (a.state === 'fight')
      for (let t = 0; t < 2; t++) {
        if (a.lastStand[t]! >= 0.85) continue;
        const p = 0.5 + Math.sin(this.time * 6) * 0.5;
        const col = t === 0 ? 0xffe23a : 0xff6a3a;
        for (let s = 0; s < 5; s++) this.lastStandBand(ga, t, s, col, (0.16 - s * 0.03) * (0.5 + p * 0.5));
      }

    const gs = this.gScreen;
    gs.clear();
    if (this.flashA > 0.005) {
      gs.rect(0, 0, this.sw, this.sh).fill({ color: this.flashC, alpha: this.flashA });
      this.flashA = Math.max(0, this.flashA - dt * 2.8);
    }
  }

  /** Ein Sonnen- oder Kanonenstrahl (waagrecht). `u` = verbleibender Anteil 1…0. */
  protected drawBeam(b: Beam, u: number, ga: Graphics): void {
    const x = Math.min(b.x0, b.x1);
    const w = Math.abs(b.x1 - b.x0);
    if (b.fx === 'sun') {
      const th = Math.round(1 + u * 3 + (Math.random() < 0.5 ? 1 : 0));
      ga.rect(x, b.y - th * 2 - 2, w, th * 4 + 4).fill({ color: b.color, alpha: 0.12 * u });
      ga.rect(x, b.y - th - 1, w, th * 2 + 2).fill({ color: b.color, alpha: 0.4 * u });
      ga.rect(x, b.y - Math.floor(th / 2), w, Math.max(1, th)).fill({ color: 0xffffff, alpha: Math.min(1, u * 1.6) });
      // Lichtpakete, die am Strahl entlanglaufen
      const dir = b.x1 > b.x0 ? 1 : -1;
      for (let q = 0; q < 4; q++) {
        const px = b.x0 + dir * (((this.time * 420 + q * 90) % w) || 0);
        ga.rect(Math.round(px) - 3, b.y - 1, 6, 2).fill({ color: 0xffffff, alpha: 0.7 * u });
      }
    } else {
      const th = u > 0.7 ? 4 : u > 0.4 ? 3 : u > 0.2 ? 2 : 1;
      ga.rect(x, b.y - th * 2, w, th * 4).fill({ color: 0xff8a3a, alpha: 0.18 * u });
      ga.rect(x, b.y - th, w, th * 2).fill({ color: b.color, alpha: 0.6 * u });
      ga.rect(x, b.y - (th > 2 ? 1 : 0), w, th > 2 ? 2 : 1).fill({ color: 0xffffff, alpha: u });
    }
  }

  /** Streifen `s` (0 = an der Mauer) des Last-Stand-Leuchtens von Team `t`. */
  protected lastStandBand(ga: Graphics, t: number, s: number, color: number, alpha: number): void {
    const x = t === 0 ? FX0 - 8 + s * 6 : FX1 + 2 - s * 6;
    ga.rect(x, FY0 - 6, 6, FY1 - FY0 + 14).fill({ color, alpha });
  }

  /** Flutwelle: Wasserwand mit Gischtkante, Spritzern und Nebel. */
  protected drawWave(team: number, u: number): void {
    const g = this.gTop;
    const ga = this.gAdd;
    const e = 1 - (1 - u) * (1 - u);
    const dir = team === 0 ? -1 : 1; // Laufrichtung der Welle
    const front = team === 0 ? FX1 + 10 - e * (FX1 - FX0 + 20) : FX0 - 10 + e * (FX1 - FX0 + 20);
    const fade = u < 0.8 ? 1 : (1 - u) / 0.2;
    for (let y = FY0 - 8; y < FY1 + 8; y += 2) {
      const wob = Math.sin(y * 0.18 + u * 22) * 3 + Math.sin(y * 0.05 - u * 9) * 4;
      const fx = Math.round(front + wob * dir);
      const back = (w: number) => (dir < 0 ? fx : fx - w);
      g.rect(back(46), y, 46, 2).fill({ color: 0x1a5a9a, alpha: 0.28 * fade });
      g.rect(back(20), y, 20, 2).fill({ color: 0x2a8ad0, alpha: 0.45 * fade });
      g.rect(back(8), y, 8, 2).fill({ color: 0x6ad0ff, alpha: 0.7 * fade });
      ga.rect(dir < 0 ? fx - 3 : fx - 0, y, 3, 2).fill({ color: 0xffffff, alpha: 0.85 * fade });
      if (Math.random() < 0.08 && this.ok(1))
        this.fx.emit({ tex: Math.random() < 0.5 ? this.atlas.fx.px2 : this.atlas.fx.px1, x: fx, y, z: rnd(0, 6), vx: dir * rnd(60, 130), vy: rnd(-10, 10), vz: rnd(30, 80), grav: 240, life: rnd(0.4, 0.7), ramp: RAMP.water, layer: L_TOP });
      if (Math.random() < 0.012 && this.ok(1))
        this.fx.emit({ tex: this.art.puff, x: fx, y, vx: dir * rnd(40, 70), vz: rnd(4, 12), grav: -4, drag: 3, life: rnd(0.3, 0.5), size: 4, size1: 8, color: 0xe8f8ff, alpha: 0.55 });
    }
  }

  // --- Schrift ---------------------------------------------------------------------------------

  floatText(x: number, y: number, text: string, color: string): void {
    const t = new Text({ text, style: { fontFamily: 'Silkscreen', fontSize: 8, fill: color, stroke: { color: '#000000', width: 2 } } });
    t.resolution = 1;
    t.anchor.set(0.5);
    t.position.set(Math.round(x), Math.round(y));
    this.texts.addChild(t);
    this.fx.emit({ tex: this.art.glow, x, y, life: 0.5, size: 48, size1: 24, color: hex(color), alpha: 0.35, layer: L_ADD });
    let age = 0;
    const tick = () => {
      age += this.app.ticker.deltaMS / 1000;
      // aufploppen, kurz stehen, nach oben ausblenden
      const s = age < 0.12 ? 1 + (1 - age / 0.12) * 1.5 : 1;
      t.scale.set(Math.round(s * 2) / 2);
      if (age > 0.6) t.y -= 0.3;
      t.alpha = Math.min(1, (1.6 - age) * 2);
      if (age >= 1.6) {
        this.app.ticker.remove(tick);
        t.destroy();
      }
    };
    this.app.ticker.add(tick);
  }

  // --- Burg zerbröckelt ---------------------------------------------------------------------

  /** Zerlegt die Burg von `team` in Blöcke, die herabfallen. */
  crumbleCastle(team: number): void {
    const cv = this.castleTex[team]!;
    const ctx = cv.getContext('2d')!;
    const data = ctx.getImageData(0, 0, W, H).data;
    const base = Texture.from(cv);
    base.source.scaleMode = 'nearest';
    const B = 5;
    let minY = H;
    let maxY = 0;
    for (let by = 0; by < H; by += B)
      for (let bx = 0; bx < W; bx += B) {
        let filled = false;
        for (let y = by; y < by + B && !filled; y++) for (let x = bx; x < bx + B; x++) if (data[(y * W + x) * 4 + 3]! > 0) filled = true;
        if (!filled) continue;
        minY = Math.min(minY, by);
        maxY = Math.max(maxY, by);
        const t = new Texture({ source: base.source, frame: new Rectangle(bx, by, B, B) });
        const s = new Sprite(t);
        s.anchor.set(0.5);
        s.position.set(bx + B / 2, by + B / 2);
        this.root.addChildAt(s, this.root.getChildIndex(this.castles[team]!) + 1);
        this.crumble.push({ s, vx: (Math.random() - 0.5) * 30, vy: -Math.random() * 20, delay: 0, vr: (Math.random() - 0.5) * 6, started: false, landed: false });
      }
    // von oben nach unten zerfallen lassen
    for (const b of this.crumble) b.delay = ((b.s.y - minY) / Math.max(1, maxY - minY)) * 1.2 + Math.random() * 0.5;
    this.castles[team]!.visible = false;
    this.crumbleDone = false;
    this.crumbleT = 0;
    // Einsturz: Blitz, Schockwelle, erste Staubwolken
    const cx = team === 0 ? FX0 - 14 : FX1 + 14;
    const cy = (FY0 + FY1) / 2;
    this.flash(0.35, 0xffe0c0);
    this.slowmo(0.7, 0.4);
    this.ring(cx, cy, 10, 140, 0.9, 0xffffff, 2, false);
    for (let k = 0; k < 20; k++) this.fx.emit({ tex: this.art.puff, x: cx + rnd(-16, 16), y: rnd(FY0, FY1), vx: -Math.sign(cx - 320) * rnd(10, 40), vz: rnd(4, 14), grav: -4, drag: 1.2, life: rnd(1.4, 2.4), size: 8, size1: rnd(16, 24), color: this.dust, alpha: 0.7, flags: F_WOBBLE | F_FADEIN });
  }

  protected updateCrumble(dt: number): void {
    if (!this.crumble.length) return;
    this.crumbleT += dt;
    let active = 0;
    for (const b of this.crumble) {
      if (this.crumbleT < b.delay) {
        active++;
        b.s.x += (Math.random() - 0.5) * 0.6;
        continue;
      }
      if (b.s.alpha <= 0) continue;
      if (!b.started) {
        b.started = true;
        if (this.ok(0.12)) this.fx.emit({ tex: this.art.puff, x: b.s.x, y: b.s.y, vx: rnd(-8, 8), vz: 4, grav: -6, drag: 1, life: rnd(1, 1.8), size: 5, size1: 14, color: this.dust, alpha: 0.55, flags: F_WOBBLE });
      }
      active++;
      b.vy += 220 * dt;
      b.s.x += b.vx * dt;
      b.s.y += b.vy * dt;
      b.s.rotation += b.vr * dt;
      if (b.s.y > 214) {
        b.s.alpha -= dt * 3;
        if (!b.landed) {
          b.landed = true;
          if (this.ok(0.15)) this.fx.emit({ tex: this.art.puff, x: b.s.x, y: 212, vx: rnd(-20, 20), vz: 6, grav: -4, drag: 2, life: rnd(0.8, 1.4), size: 4, size1: 12, color: this.dust, alpha: 0.6, flags: F_WOBBLE });
        }
      }
      if (Math.random() < 0.08) this.fx.emit({ tex: this.atlas.fx.px2, x: b.s.x, y: b.s.y, z: 2, vx: (Math.random() - 0.5) * 20, vy: -10, life: 0.6, color: 0xc8c0b0 });
    }
    this.arena.shake = Math.max(this.arena.shake, 0.6);
    if (active === 0 || this.crumbleT > 3.6) {
      for (const b of this.crumble) b.s.destroy();
      this.crumble = [];
      this.crumbleDone = true;
    }
  }

  protected flushStamps(): void {
    if (this.stamps.length === 0) return;
    const layer = this.stampLayer;
    layer.removeChildren();
    for (let k = 0; k < this.stamps.length; k++) {
      const s = this.stamps[k]!;
      let sp = this.stampSprites[k];
      if (!sp) {
        sp = new Sprite();
        this.stampSprites[k] = sp;
      }
      sp.texture = s.tex;
      sp.anchor.set(s.anchor);
      sp.scale.set(s.scale);
      sp.position.set(Math.round(s.x), Math.round(s.y));
      sp.tint = s.tint;
      sp.alpha = s.alpha;
      layer.addChild(sp);
    }
    this.app.renderer.render({ container: layer, target: this.decalRT, clear: false });
    this.stamps.length = 0;
  }
}

/** Staubfarbe: aufgehellter Durchschnitt des Bodens. */
function dustColorOf(cv: HTMLCanvasElement): number {
  const d = cv.getContext('2d')!.getImageData(0, FY0, W, FY1 - FY0).data;
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
  const L = (v: number) => Math.round(v / n + (255 - v / n) * 0.62);
  return (L(r) << 16) | (L(g) << 8) | L(b);
}

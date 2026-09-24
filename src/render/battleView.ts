import { Application, Container, Graphics, Particle, ParticleContainer, RenderTexture, Sprite, Texture } from 'pixi.js';
import type { Atlas } from '../art/atlas';
import { BASE_CANVAS_W, BASE_PAD_Y, FIELD_OX, FIELD_OY, buildBase, buildGround } from '../art/terrain';
import { Battle, FIELD_H, FIELD_W, MAX_PROJ, MAX_UNITS, P_ARROW, P_BOULDER, P_PIERCE, P_ROCK, PROJ_COLORS } from '../sim/battle';

// =====================================================================
// Zeichnet die Schlacht: Boden, Leichen-Decals, Einheiten (y-sortiert),
// Geschosse, Pixel-Partikel, Strahlen, Burgmauern.
// =====================================================================

const MAX_FX = 6000;
const DECAL_PAD = 40;

interface Beam {
  x0: number;
  x1: number;
  y: number;
  color: number;
  t: number;
}

interface Stamp {
  tex: Texture;
  x: number;
  y: number;
  tint: number;
  alpha: number;
  ax: number;
  ay: number;
}

const hex = (c: string) => parseInt(c.slice(1, 7), 16);

export class BattleView {
  readonly world = new Container();
  private readonly ground: Sprite;
  private readonly decalRT: RenderTexture;
  private readonly units: ParticleContainer;
  private readonly unitParts: Particle[] = [];
  private readonly projShadows: ParticleContainer;
  private readonly projs: ParticleContainer;
  private readonly projParts: Particle[] = [];
  private readonly projShadowParts: Particle[] = [];
  private readonly fxPC: ParticleContainer;
  private readonly fxParts: Particle[] = [];
  private readonly beamsG = new Graphics();
  private readonly bases: Sprite[];
  private readonly baseFlash = [0, 0];

  // Pixel-Partikel (SoA)
  private readonly fX = new Float32Array(MAX_FX);
  private readonly fY = new Float32Array(MAX_FX);
  private readonly fZ = new Float32Array(MAX_FX);
  private readonly fVX = new Float32Array(MAX_FX);
  private readonly fVY = new Float32Array(MAX_FX);
  private readonly fVZ = new Float32Array(MAX_FX);
  private readonly fLife = new Float32Array(MAX_FX);
  private readonly fMax = new Float32Array(MAX_FX);
  private readonly fColor = new Uint32Array(MAX_FX);
  private readonly fStamp = new Uint8Array(MAX_FX);
  private readonly fKind = new Uint8Array(MAX_FX); // 0 = Pixel, 1 = Plus, 2 = 2×2
  private fN = 0;

  private readonly beams: Beam[] = [];
  private readonly stamps: Stamp[] = [];
  private readonly stampLayer = new Container();
  private readonly stampSprites: Sprite[] = [];

  // Sortierung nach y (Bucket-Sort)
  private readonly bucketStart = new Int32Array(FIELD_H + 2);
  private readonly order = new Int32Array(MAX_UNITS);

  constructor(
    private readonly app: Application,
    private readonly atlas: Atlas,
    private readonly battle: Battle,
  ) {
    const groundTex = Texture.from(buildGround());
    groundTex.source.scaleMode = 'nearest';
    this.ground = new Sprite(groundTex);
    this.ground.position.set(-FIELD_OX, -FIELD_OY);

    this.decalRT = RenderTexture.create({ width: FIELD_W + DECAL_PAD * 2, height: FIELD_H + DECAL_PAD * 2, scaleMode: 'nearest' });
    const decal = new Sprite(this.decalRT);
    decal.position.set(-DECAL_PAD, -DECAL_PAD);

    const dyn = { position: true, uvs: true, color: true, vertex: true, rotation: true };
    this.units = new ParticleContainer({ dynamicProperties: dyn, roundPixels: true });
    this.projShadows = new ParticleContainer({ dynamicProperties: dyn, roundPixels: true });
    this.projs = new ParticleContainer({ dynamicProperties: dyn, roundPixels: false });
    this.fxPC = new ParticleContainer({ dynamicProperties: dyn, roundPixels: true });

    this.bases = [0, 1].map((team) => {
      const t = Texture.from(buildBase(team as 0 | 1));
      t.source.scaleMode = 'nearest';
      const s = new Sprite(t);
      s.position.set(team === 0 ? 0 : FIELD_W - BASE_CANVAS_W, -BASE_PAD_Y);
      return s;
    });

    this.world.addChild(this.ground, decal, this.projShadows, this.units, this.bases[0]!, this.bases[1]!, this.projs, this.beamsG, this.fxPC);
  }

  /** Schlachtfeld für eine neue Aufstellung leeren. */
  clearDecals(): void {
    this.app.renderer.render({ container: new Container(), target: this.decalRT, clear: true });
    this.fN = 0;
    this.beams.length = 0;
  }

  /** Feld innerhalb der Ansicht zentrieren. */
  layout(viewW: number, viewH: number, top: number, bottom: number): void {
    const availH = viewH - top - bottom;
    this.world.position.set(Math.floor((viewW - FIELD_W) / 2), Math.floor(top + (availH - FIELD_H) / 2));
    this.baseX = this.world.x;
    this.baseY = this.world.y;
  }

  private baseX = 0;
  private baseY = 0;

  update(dt: number): void {
    this.consumeEvents();
    this.updateFx(dt);
    this.drawUnits();
    this.drawProjectiles();
    this.drawFx();
    this.drawBeams(dt);
    this.flushStamps();
    for (let t = 0; t < 2; t++) {
      this.baseFlash[t] = Math.max(0, this.baseFlash[t]! - dt * 4);
      this.bases[t]!.tint = this.baseFlash[t]! > 0 ? 0xff9a9a : 0xffffff;
    }
    const s = this.battle.shake;
    this.world.x = this.baseX + (s > 0 ? Math.round((Math.random() - 0.5) * s * 4) : 0);
    this.world.y = this.baseY + (s > 0 ? Math.round((Math.random() - 0.5) * s * 4) : 0);
  }

  // --- Einheiten -------------------------------------------------------------

  private drawUnits(): void {
    const b = this.battle;
    // Bucket-Sort nach y → weiter unten = weiter vorne
    const bs = this.bucketStart;
    bs.fill(0);
    for (let i = 0; i < b.hw; i++) if (b.alive[i]) bs[Math.min(FIELD_H, Math.max(0, Math.floor(b.y[i]!))) + 1]!++;
    for (let k = 0; k <= FIELD_H; k++) bs[k + 1]! += bs[k]!;
    let n = 0;
    for (let i = 0; i < b.hw; i++) {
      if (!b.alive[i]) continue;
      const k = Math.min(FIELD_H, Math.max(0, Math.floor(b.y[i]!)));
      this.order[bs[k]!++] = i;
      n++;
    }
    const list = this.units.particleChildren;
    list.length = n;
    for (let k = 0; k < n; k++) {
      const i = this.order[k]!;
      let p = this.unitParts[i];
      const t = b.types[b.type[i]!]!;
      const ut = this.atlas.units[t.vis]!;
      if (!p) {
        p = new Particle({ texture: ut.walk0, anchorX: 0.5, anchorY: ut.anchorY });
        this.unitParts[i] = p;
      }
      p.anchorY = ut.anchorY;
      const moving = Math.abs(b.vx[i]!) + Math.abs(b.vy[i]!) > 3;
      let tex = ut.walk0;
      if (b.flashT[i]! > 0) tex = ut.flash;
      else if (b.atkT[i]! > 0) tex = ut.attack;
      else if (moving) tex = Math.floor(b.animT[i]!) % 2 === 0 ? ut.walk0 : ut.walk1;
      p.texture = tex;
      p.x = Math.round(b.x[i]!);
      // leichtes Hüpfen beim Laufen
      p.y = Math.round(b.y[i]!) - (moving && !ut.building && Math.floor(b.animT[i]! * 2) % 2 === 0 ? 1 : 0);
      let tint = 0xffffff;
      if (b.burnT[i]! > 0) tint = Math.floor(b.animT[i]! * 6) % 2 ? 0xffb080 : 0xffd0a0;
      else if (b.slowT[i]! > 0) tint = 0xb8ffb0;
      else if (b.shield[i]! > 0) tint = 0xd0e8ff;
      else if (t.card.rage && b.hp[i]! < b.maxHp[i]! * 0.5) tint = 0xff9c9c;
      p.tint = tint;
      list[k] = p;
    }
    this.units.update();
  }

  // --- Geschosse -------------------------------------------------------------

  private drawProjectiles(): void {
    const b = this.battle;
    const list = this.projs.particleChildren;
    const shadows = this.projShadows.particleChildren;
    list.length = 0;
    shadows.length = 0;
    const fx = this.atlas.fx;
    for (let p = 0; p < b.pHw; p++) {
      if (!b.pAlive[p]) continue;
      let part = this.projParts[p];
      if (!part) {
        part = new Particle({ texture: fx.orb, anchorX: 0.5, anchorY: 0.5 });
        this.projParts[p] = part;
      }
      const kind = b.pKind[p]!;
      const z = b.pZ[p]!;
      part.rotation = 0;
      part.tint = 0xffffff;
      if (kind === P_ARROW) {
        part.texture = fx.arrow;
        part.rotation = Math.atan2(b.pVY[p]!, b.pVX[p]!);
      } else if (kind === P_BOULDER) {
        part.texture = fx.boulder;
        part.rotation = Math.floor(b.pT[p]! * 8) * (Math.PI / 2);
      } else if (kind === P_ROCK) {
        part.texture = fx.rock;
      } else {
        part.texture = fx.orb;
        part.tint = hex(PROJ_COLORS[kind] ?? '#ffffff');
        if (kind === P_PIERCE) part.tint = 0xe9f6ff;
      }
      part.x = b.pX[p]! + (kind === P_BOULDER || kind === P_ROCK ? (b.pTX[p]! - b.pX[p]!) * Math.min(1, b.pT[p]! / b.pDur[p]!) : 0);
      part.y = b.pY[p]! + (kind === P_BOULDER || kind === P_ROCK ? (b.pTY[p]! - b.pY[p]!) * Math.min(1, b.pT[p]! / b.pDur[p]!) : 0) - z;
      list.push(part);
      if (z > 0) {
        let sh = this.projShadowParts[p];
        if (!sh) {
          sh = new Particle({ texture: fx.px2, anchorX: 0.5, anchorY: 0.5, tint: 0x000000, alpha: 0.3 });
          this.projShadowParts[p] = sh;
        }
        sh.x = Math.round(part.x);
        sh.y = Math.round(part.y + z + 4);
        sh.scaleX = kind === P_BOULDER ? 2.5 : 1.2;
        shadows.push(sh);
      }
      // Leuchtspur hinter magischen Geschossen
      if (kind !== P_ARROW && kind !== P_BOULDER && kind !== P_ROCK && Math.random() < 0.5) {
        this.emit(part.x, part.y + 4, 4, 0, 0, 0, part.tint, 0.25, 0, 0);
      }
      if (kind === P_BOULDER && Math.random() < 0.3) this.emit(part.x, part.y + 4, 4, 0, 0, 0, 0x8d8d96, 0.4, 0, 0);
    }
    this.projs.update();
    this.projShadows.update();
    void MAX_PROJ;
  }

  // --- Ereignisse → Effekte ---------------------------------------------------

  private consumeEvents(): void {
    const b = this.battle;
    for (const e of b.events) {
      switch (e.t) {
        case 'death': {
          const ut = this.atlas.units[e.vis]!;
          const c = hex(e.color);
          this.stamps.push({ tex: ut.corpse, x: e.x, y: e.y - 2, tint: 0xffffff, alpha: 0.95, ax: 0.5, ay: 0.5 });
          const n = e.building ? 26 : 7;
          for (let k = 0; k < n; k++) {
            const a = Math.random() * Math.PI * 2;
            const sp = 15 + Math.random() * (e.building ? 60 : 35);
            this.emit(e.x, e.y, 3 + Math.random() * 4, Math.cos(a) * sp, Math.sin(a) * sp * 0.5, 30 + Math.random() * 40, c, 0.6 + Math.random() * 0.5, 1, Math.random() < 0.3 ? 2 : 0);
          }
          break;
        }
        case 'hit': {
          const c = hex(e.color);
          for (let k = 0; k < 3; k++) {
            const a = Math.random() * Math.PI * 2;
            this.emit(e.x, e.y, 2, Math.cos(a) * 30, Math.sin(a) * 30, 20, c, 0.18, 0, 0);
          }
          break;
        }
        case 'boom': {
          const c = hex(e.color);
          this.stamps.push({ tex: this.atlas.fx.crater, x: e.x, y: e.y, tint: 0xffffff, alpha: 1, ax: 0.5, ay: 0.5 });
          for (let k = 0; k < 30; k++) {
            const a = Math.random() * Math.PI * 2;
            const sp = 20 + Math.random() * e.r * 3;
            this.emit(e.x, e.y, 2, Math.cos(a) * sp, Math.sin(a) * sp * 0.6, 40 + Math.random() * 60, k % 3 ? c : 0x6f5335, 0.5 + Math.random() * 0.4, k % 3 === 0 ? 1 : 0, k % 4 === 0 ? 2 : 0);
          }
          for (let k = 0; k < 8; k++) this.emit(e.x + (Math.random() - 0.5) * e.r, e.y + (Math.random() - 0.5) * e.r * 0.5, 2, 0, -8, 5, 0xd8d0c0, 0.7, 0, 2);
          break;
        }
        case 'beam':
          this.beams.push({ x0: e.x0, x1: e.x1, y: e.y, color: hex(e.color), t: 0.3 });
          break;
        case 'heal':
          this.emit(e.x + (Math.random() - 0.5) * 4, e.y, 4, 0, -14, 0, hex(e.color), 0.7, 0, 1);
          break;
        case 'spawn': {
          const c = hex(e.color);
          for (let k = 0; k < 8; k++) {
            const a = Math.random() * Math.PI * 2;
            this.emit(e.x + Math.cos(a) * 3, e.y, 1, Math.cos(a) * 10, -10 - Math.random() * 12, 0, c, 0.5, 0, 0);
          }
          break;
        }
        case 'base': {
          this.baseFlash[e.team] = 1;
          const x = e.team === 0 ? 18 : FIELD_W - 18;
          for (let k = 0; k < 6; k++) {
            const a = Math.random() * Math.PI * 2;
            this.emit(x, e.y, 4, Math.cos(a) * 30, Math.sin(a) * 20, 30, k % 2 ? 0xffffff : 0xff5a5a, 0.5, 0, 0);
          }
          break;
        }
      }
    }
    b.events.length = 0;
  }

  // --- Partikel -----------------------------------------------------------------

  private emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, color: number, life: number, stamp: number, kind: number): void {
    if (this.fN >= MAX_FX) return;
    const i = this.fN++;
    this.fX[i] = x;
    this.fY[i] = y;
    this.fZ[i] = z;
    this.fVX[i] = vx;
    this.fVY[i] = vy;
    this.fVZ[i] = vz;
    this.fLife[i] = life;
    this.fMax[i] = life;
    this.fColor[i] = color;
    this.fStamp[i] = stamp;
    this.fKind[i] = kind;
  }

  private updateFx(dt: number): void {
    let w = 0;
    for (let i = 0; i < this.fN; i++) {
      this.fLife[i]! -= dt;
      const grav = this.fVZ[i] !== 0 || this.fStamp[i] ? 160 : 0;
      this.fVZ[i]! -= grav * dt;
      this.fX[i]! += this.fVX[i]! * dt;
      this.fY[i]! += this.fVY[i]! * dt;
      this.fZ[i]! += this.fVZ[i]! * dt;
      if (grav > 0 && this.fZ[i]! <= 0) {
        this.fZ[i] = 0;
        if (this.fStamp[i]) {
          // Blut/Staub bleibt am Boden liegen
          this.stamps.push({ tex: this.fKind[i] === 2 ? this.atlas.fx.px2 : this.atlas.fx.px1, x: this.fX[i]!, y: this.fY[i]!, tint: this.fColor[i]!, alpha: 0.85, ax: 0, ay: 0 });
          this.fLife[i] = 0;
        } else {
          this.fVX[i]! *= 0.5;
          this.fVY[i]! *= 0.5;
          this.fVZ[i] = 0;
        }
      }
      if (this.fLife[i]! <= 0) continue;
      if (w !== i) {
        this.fX[w] = this.fX[i]!;
        this.fY[w] = this.fY[i]!;
        this.fZ[w] = this.fZ[i]!;
        this.fVX[w] = this.fVX[i]!;
        this.fVY[w] = this.fVY[i]!;
        this.fVZ[w] = this.fVZ[i]!;
        this.fLife[w] = this.fLife[i]!;
        this.fMax[w] = this.fMax[i]!;
        this.fColor[w] = this.fColor[i]!;
        this.fStamp[w] = this.fStamp[i]!;
        this.fKind[w] = this.fKind[i]!;
      }
      w++;
    }
    this.fN = w;
  }

  private drawFx(): void {
    const list = this.fxPC.particleChildren;
    list.length = this.fN;
    const fx = this.atlas.fx;
    for (let i = 0; i < this.fN; i++) {
      let p = this.fxParts[i];
      if (!p) {
        p = new Particle({ texture: fx.px1, anchorX: 0, anchorY: 0 });
        this.fxParts[i] = p;
      }
      const k = this.fKind[i]!;
      p.texture = k === 1 ? fx.plus : k === 2 ? fx.px2 : fx.px1;
      p.x = this.fX[i]!;
      p.y = this.fY[i]! - this.fZ[i]!;
      p.tint = this.fColor[i]!;
      p.alpha = Math.min(1, (this.fLife[i]! / this.fMax[i]!) * 2.5);
      list[i] = p;
    }
    this.fxPC.update();
  }

  private drawBeams(dt: number): void {
    const g = this.beamsG;
    g.clear();
    for (let k = this.beams.length - 1; k >= 0; k--) {
      const bm = this.beams[k]!;
      bm.t -= dt;
      if (bm.t <= 0) {
        this.beams.splice(k, 1);
        continue;
      }
      const a = Math.min(1, bm.t / 0.15);
      const x = Math.min(bm.x0, bm.x1);
      const w = Math.abs(bm.x1 - bm.x0);
      const y = Math.round(bm.y) - 4;
      g.rect(x, y - 1, w, 3).fill({ color: bm.color, alpha: 0.45 * a });
      g.rect(x, y, w, 1).fill({ color: 0xffffff, alpha: 0.9 * a });
    }
  }

  private flushStamps(): void {
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
      sp.anchor.set(s.ax, s.ay);
      sp.position.set(Math.round(s.x + DECAL_PAD), Math.round(s.y + DECAL_PAD));
      sp.tint = s.tint;
      sp.alpha = s.alpha;
      layer.addChild(sp);
    }
    this.app.renderer.render({ container: layer, target: this.decalRT, clear: false });
    this.stamps.length = 0;
  }
}

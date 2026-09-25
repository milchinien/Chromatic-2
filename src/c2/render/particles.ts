// Partikel-Engine der Arena: flache Typed-Arrays, 4 Ebenen (Boden / Boden-Licht
// unter den Einheiten, Effekte / Licht darüber). Größen-Sets (Glühen, Rauch)
// werden über die passende Texturgröße statt über Skalierung gezeichnet, damit
// jedes Pixel ein Spielpixel bleibt. Farben laufen stufenweise durch Paletten
// („Rampen“), z. B. Weiß → Gelb → Orange → Rot → Rauch.

import { Particle, ParticleContainer, type Texture } from 'pixi.js';
import { GLOW_SIZES, PUFF_SIZES } from './fxArt';
import type { FxArt } from './atlas';

export const MAX_PARTICLES = 14000;

/** Ebenen */
export const L_GROUND = 0;
export const L_GROUND_ADD = 1;
export const L_TOP = 2;
export const L_ADD = 3;

/** Flags */
export const F_ORIENT = 1; // in Flugrichtung drehen
export const F_STAMP = 2; // beim Aufprall als Fleck in den Boden „einbrennen“
export const F_BOUNCE = 4; // abprallen (Trümmer)
export const F_FLICKER = 8;
export const F_LINEAR = 16; // gleichmäßig ausblenden statt erst am Ende
export const F_FADEIN = 32;
export const F_WOBBLE = 64; // seitlich schlingern (Glut, Seelen, Sporen)

export interface Emit {
  tex: Texture | Texture[];
  x: number;
  y: number;
  z?: number;
  vx?: number;
  vy?: number;
  vz?: number;
  life: number;
  /** Schwerkraft auf z (px/s²), negativ = steigt auf */
  grav?: number;
  /** Luftwiderstand (Anteil pro Sekunde) */
  drag?: number;
  /** Durchmesser (Sets) bzw. Skalierung (Einzeltexturen) am Anfang / Ende */
  size?: number;
  size1?: number;
  color?: number;
  ramp?: readonly number[];
  alpha?: number;
  layer?: number;
  flags?: number;
  rot?: number;
  vr?: number;
}

/** Farbrampen */
export const RAMP = {
  /** deckende Flammenwolken: beginnen bei Hellgelb, nicht Weiß (sonst weiße Flecken) */
  fire: [0xfff0a0, 0xffd84a, 0xffb830, 0xff9a2e, 0xff6a1f, 0xd8391c, 0x8a2a1c, 0x4a3a36],
  /** heller Kern – nur für additive Lichter */
  fireHot: [0xffffff, 0xffffff, 0xfff6b0, 0xffd84a, 0xffa12e, 0xff6a1f, 0xd8391c],
  smoke: [0x6a6464, 0x565252, 0x464242, 0x3a3636, 0x2e2c2c],
  smokeLight: [0xd8d0c4, 0xbab2a6, 0xa09a90, 0x8a847c],
  steam: [0xffffff, 0xeef4f6, 0xd6e0e4, 0xb8c4c8],
  frost: [0xffffff, 0xe8fbff, 0xbff4ff, 0x8ae8ff, 0x58b8e8, 0x3a7ec0],
  toxic: [0xf0ffd0, 0xc8ff8a, 0x9dff6a, 0x6ad24a, 0x4a9a3a, 0x2e5e2a],
  spore: [0xffffff, 0xfff6c0, 0xffe86a, 0xe0c040, 0xa08a30],
  holy: [0xffffff, 0xfffbe0, 0xfff0a0, 0xffd860, 0xe8a830],
  heal: [0xffffff, 0xe8ffe0, 0xb8ffa8, 0x7ce86a, 0x4ab84a],
  moon: [0xffffff, 0xeef8ff, 0xd6f4ff, 0xa8d8ff, 0x7aa8f0],
  arcane: [0xffffff, 0xf0e0ff, 0xd8b0ff, 0xc68aff, 0x9a5ae0, 0x6a3aa8],
  spark: [0xffffff, 0xfff6c0, 0xffd84a, 0xff9a2e],
  water: [0xffffff, 0xe0f8ff, 0x8ae8ff, 0x4ab8e8, 0x2a78c0],
  electric: [0xffffff, 0xf0ffe8, 0xc8ffb0, 0x8af0ff, 0x6ab0ff],
  blood: [0xffffff, 0xff8a8a],
} as const;

const rampCache = new Map<number, number[]>();

/** Rampe von Weiß über `c` zu einer dunklen Variante (für beliebige Glühfarben). */
export function rampOf(c: number): number[] {
  let r = rampCache.get(c);
  if (!r) {
    r = makeRamp(c);
    rampCache.set(c, r);
  }
  return r;
}

function makeRamp(c: number): number[] {
  const mix = (a: number, b: number, t: number) => {
    const r = ((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * t;
    const g = ((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * t;
    const bl = (a & 255) + ((b & 255) - (a & 255)) * t;
    return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
  };
  return [0xffffff, mix(0xffffff, c, 0.5), c, mix(c, 0x000000, 0.25), mix(c, 0x000000, 0.5)];
}

function sizeTable(sizes: readonly number[]): Uint8Array {
  const max = sizes[sizes.length - 1]!;
  const t = new Uint8Array(max + 1);
  for (let s = 0; s <= max; s++) {
    let best = 0;
    for (let k = 1; k < sizes.length; k++) if (Math.abs(sizes[k]! - s) < Math.abs(sizes[best]! - s)) best = k;
    t[s] = best;
  }
  return t;
}

export class Particles {
  readonly layers: ParticleContainer[];
  private readonly pool: Particle[] = [];
  private readonly x = new Float32Array(MAX_PARTICLES);
  private readonly y = new Float32Array(MAX_PARTICLES);
  private readonly z = new Float32Array(MAX_PARTICLES);
  private readonly vx = new Float32Array(MAX_PARTICLES);
  private readonly vy = new Float32Array(MAX_PARTICLES);
  private readonly vz = new Float32Array(MAX_PARTICLES);
  private readonly life = new Float32Array(MAX_PARTICLES);
  private readonly max = new Float32Array(MAX_PARTICLES);
  private readonly grav = new Float32Array(MAX_PARTICLES);
  private readonly drag = new Float32Array(MAX_PARTICLES);
  private readonly s0 = new Float32Array(MAX_PARTICLES);
  private readonly s1 = new Float32Array(MAX_PARTICLES);
  private readonly rot = new Float32Array(MAX_PARTICLES);
  private readonly vr = new Float32Array(MAX_PARTICLES);
  private readonly alpha = new Float32Array(MAX_PARTICLES);
  private readonly color = new Uint32Array(MAX_PARTICLES);
  private readonly seed = new Float32Array(MAX_PARTICLES);
  private readonly layer = new Uint8Array(MAX_PARTICLES);
  private readonly flags = new Uint8Array(MAX_PARTICLES);
  private readonly tex: (Texture | Texture[])[] = [];
  private readonly ramp: (readonly number[] | null)[] = [];
  private readonly glowTab = sizeTable(GLOW_SIZES);
  private readonly puffTab = sizeTable(PUFF_SIZES);
  private time = 0;
  n = 0;

  constructor(
    private readonly art: FxArt,
    private readonly onStamp: (tex: Texture, x: number, y: number, color: number) => void,
  ) {
    const dyn = { position: true, uvs: true, color: true, vertex: true, rotation: true };
    this.layers = [0, 1, 2, 3].map((l) => {
      const pc = new ParticleContainer({ dynamicProperties: dyn, roundPixels: true });
      if (l === L_GROUND_ADD || l === L_ADD) pc.blendMode = 'add';
      return pc;
    });
  }

  /** Auslastung 0…1 – optionale Effekte werden bei vollem Speicher ausgedünnt. */
  get load(): number {
    return this.n / MAX_PARTICLES;
  }

  clear(): void {
    this.n = 0;
  }

  emit(e: Emit): void {
    if (this.n >= MAX_PARTICLES) return;
    const i = this.n++;
    this.x[i] = e.x;
    this.y[i] = e.y;
    this.z[i] = e.z ?? 0;
    this.vx[i] = e.vx ?? 0;
    this.vy[i] = e.vy ?? 0;
    this.vz[i] = e.vz ?? 0;
    this.life[i] = this.max[i] = e.life;
    this.grav[i] = e.grav ?? 0;
    this.drag[i] = e.drag ?? 0;
    this.s0[i] = e.size ?? 1;
    this.s1[i] = e.size1 ?? e.size ?? 1;
    this.rot[i] = e.rot ?? 0;
    this.vr[i] = e.vr ?? 0;
    this.alpha[i] = e.alpha ?? 1;
    this.color[i] = e.color ?? 0xffffff;
    this.seed[i] = Math.random() * 100;
    this.layer[i] = e.layer ?? L_TOP;
    this.flags[i] = e.flags ?? 0;
    this.tex[i] = e.tex;
    this.ramp[i] = e.ramp ?? null;
  }

  update(dt: number): void {
    if (dt <= 0) return;
    this.time += dt;
    let w = 0;
    for (let i = 0; i < this.n; i++) {
      this.life[i]! -= dt;
      if (this.life[i]! <= 0) continue;
      const f = this.flags[i]!;
      const dr = this.drag[i]!;
      if (dr > 0) {
        const k = Math.max(0, 1 - dr * dt);
        this.vx[i]! *= k;
        this.vy[i]! *= k;
        if (this.grav[i] === 0) this.vz[i]! *= k;
      }
      const g = this.grav[i]!;
      this.vz[i]! -= g * dt;
      this.x[i]! += this.vx[i]! * dt;
      this.y[i]! += this.vy[i]! * dt;
      this.z[i]! += this.vz[i]! * dt;
      if (f & F_WOBBLE) this.x[i]! += Math.sin(this.time * 4 + this.seed[i]!) * 10 * dt;
      this.rot[i]! += this.vr[i]! * dt;
      if (g > 0 && this.z[i]! <= 0) {
        this.z[i] = 0;
        if (f & F_STAMP) {
          const t = this.tex[i]!;
          this.onStamp(Array.isArray(t) ? t[0]! : t, this.x[i]!, this.y[i]!, this.color[i]!);
          continue;
        }
        if (f & F_BOUNCE && this.vz[i]! < -25) {
          this.vz[i] = -this.vz[i]! * 0.35;
          this.vx[i]! *= 0.55;
          this.vy[i]! *= 0.55;
          this.vr[i]! *= 0.5;
        } else {
          this.vz[i] = 0;
          this.vx[i]! *= 0.4;
          this.vy[i]! *= 0.4;
          this.vr[i] = 0;
        }
      }
      if (w !== i) this.move(i, w);
      w++;
    }
    this.n = w;
  }

  private move(i: number, w: number): void {
    this.x[w] = this.x[i]!;
    this.y[w] = this.y[i]!;
    this.z[w] = this.z[i]!;
    this.vx[w] = this.vx[i]!;
    this.vy[w] = this.vy[i]!;
    this.vz[w] = this.vz[i]!;
    this.life[w] = this.life[i]!;
    this.max[w] = this.max[i]!;
    this.grav[w] = this.grav[i]!;
    this.drag[w] = this.drag[i]!;
    this.s0[w] = this.s0[i]!;
    this.s1[w] = this.s1[i]!;
    this.rot[w] = this.rot[i]!;
    this.vr[w] = this.vr[i]!;
    this.alpha[w] = this.alpha[i]!;
    this.color[w] = this.color[i]!;
    this.seed[w] = this.seed[i]!;
    this.layer[w] = this.layer[i]!;
    this.flags[w] = this.flags[i]!;
    this.tex[w] = this.tex[i]!;
    this.ramp[w] = this.ramp[i]!;
  }

  draw(): void {
    const lists = this.layers.map((l) => {
      l.particleChildren.length = 0;
      return l.particleChildren;
    });
    const glow = this.art.glow;
    for (let i = 0; i < this.n; i++) {
      let p = this.pool[i];
      if (!p) {
        p = new Particle({ texture: this.art.star, anchorX: 0.5, anchorY: 0.5 });
        this.pool[i] = p;
      }
      const lf = this.life[i]! / this.max[i]!;
      const u = 1 - lf;
      const e = 1 - (1 - u) * (1 - u);
      const s = this.s0[i]! + (this.s1[i]! - this.s0[i]!) * e;
      const t = this.tex[i]!;
      if (Array.isArray(t)) {
        const tab = t === glow ? this.glowTab : this.puffTab;
        p.texture = t[tab[Math.max(0, Math.min(tab.length - 1, Math.round(s)))]!]!;
        p.scaleX = p.scaleY = 1;
      } else {
        p.texture = t;
        p.scaleX = p.scaleY = s;
      }
      const f = this.flags[i]!;
      p.x = this.x[i]!;
      p.y = this.y[i]! - this.z[i]!;
      p.rotation = f & F_ORIENT ? Math.atan2(this.vy[i]! - this.vz[i]!, this.vx[i]!) : this.rot[i]!;
      const r = this.ramp[i];
      p.tint = r ? r[Math.min(r.length - 1, Math.floor(u * r.length))]! : this.color[i]!;
      let a = this.alpha[i]! * (f & F_LINEAR ? lf : Math.min(1, lf * 2.5));
      if (f & F_FADEIN) a *= Math.min(1, u * 6);
      if (f & F_FLICKER && Math.random() < 0.3) a *= 0.35;
      p.alpha = a;
      lists[this.layer[i]!]!.push(p);
    }
    for (const l of this.layers) l.update();
  }
}

// Kleiner Pixel-Zeichner: Figuren werden aus Rechtecken/Pixeln gebaut,
// danach bekommt alles automatisch eine dunkle Kontur (wie bei WorldBox).

export type Px = string | null;

export class PixelGrid {
  readonly px: Px[];
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.px = new Array<Px>(w * h).fill(null);
  }

  get(x: number, y: number): Px {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.px[y * this.w + x] ?? null;
  }

  set(x: number, y: number, c: Px): this {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    this.px[y * this.w + x] = c;
    return this;
  }

  rect(x: number, y: number, w: number, h: number, c: Px): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
    return this;
  }

  /** Mehrere Pixel als [x, y]-Liste. */
  dots(c: Px, pts: readonly (readonly [number, number])[]): this {
    for (const [x, y] of pts) this.set(x, y, c);
    return this;
  }

  line(x0: number, y0: number, x1: number, y1: number, c: Px): this {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
    return this;
  }

  /** Setzt eine Kontur um alle gefüllten Pixel (4er-Nachbarschaft). */
  outline(c: string, skip: ReadonlySet<string> = new Set()): this {
    const add: number[] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y) !== null) continue;
        const n = [this.get(x - 1, y), this.get(x + 1, y), this.get(x, y - 1), this.get(x, y + 1)];
        if (n.some((p) => p !== null && !skip.has(p))) add.push(y * this.w + x);
      }
    }
    for (const i of add) this.px[i] = c;
    return this;
  }

  /** Legt `other` darunter (nur wo hier nichts ist). */
  under(other: PixelGrid, ox = 0, oy = 0): this {
    for (let y = 0; y < other.h; y++)
      for (let x = 0; x < other.w; x++) {
        const c = other.get(x, y);
        if (c !== null && this.get(x + ox, y + oy) === null) this.set(x + ox, y + oy, c);
      }
    return this;
  }

  /** Rand hinzufügen (damit die Kontur nicht abgeschnitten wird). */
  pad(n: number): PixelGrid {
    const g = new PixelGrid(this.w + 2 * n, this.h + 2 * n);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) g.set(x + n, y + n, this.get(x, y));
    return g;
  }

  clone(): PixelGrid {
    const g = new PixelGrid(this.w, this.h);
    for (let i = 0; i < this.px.length; i++) g.px[i] = this.px[i] ?? null;
    return g;
  }

  flipX(): PixelGrid {
    const g = new PixelGrid(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) g.set(this.w - 1 - x, y, this.get(x, y));
    return g;
  }

  map(fn: (c: string) => Px): PixelGrid {
    const g = new PixelGrid(this.w, this.h);
    for (let i = 0; i < this.px.length; i++) {
      const c = this.px[i];
      g.px[i] = c == null ? null : fn(c);
    }
    return g;
  }

  /** Um 90° gedreht (liegende Leiche), Füße zeigen nach links. */
  rotate90(): PixelGrid {
    const g = new PixelGrid(this.h, this.w);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) g.set(this.h - 1 - y, x, this.get(x, y));
    return g;
  }

  draw(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const c = this.get(x, y);
        if (c === null) continue;
        ctx.fillStyle = c;
        ctx.fillRect(ox + x, oy + y, 1, 1);
      }
  }
}

// --- Farben ----------------------------------------------------------

/** Farbe abdunkeln/aufhellen (f < 1 dunkler, > 1 heller). */
export function shade(hex: string, f: number): string {
  if (!hex.startsWith('#')) return hex;
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(f < 1 ? v * f : v + (255 - v) * (f - 1))));
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** Mischt zwei Hex-Farben. */
export function mix(a: string, b: string, t: number): string {
  const na = parseInt(a.slice(1), 16);
  const nb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((na >> s) & 255) * (1 - t) + ((nb >> s) & 255) * t);
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
}

export const INK = '#1b1422';
export const SHADOW = 'rgba(12,8,20,0.38)';

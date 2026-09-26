// =====================================================================
// Kleine DSP-Werkstatt: alle Klänge des Spiels werden beim Start aus
// Rauschen, Oszillatoren, Filtern und Modal-Resonatoren berechnet
// (keine Sample-Dateien). Alles arbeitet auf Float32Array in 44,1 kHz.
// =====================================================================

export const SR = 44100;
const TAU = Math.PI * 2;

export type Rng = () => number;

/** Deterministischer Zufall (mulberry32), damit Varianten reproduzierbar sind. */
export function rng(seed: number): Rng {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const between = (r: Rng, a: number, b: number) => a + (b - a) * r();
export const len = (sec: number) => Math.max(1, Math.round(sec * SR));
export const buf = (sec: number) => new Float32Array(len(sec));
export const semi = (n: number) => Math.pow(2, n / 12);

// --- Quellen -------------------------------------------------------------------------------

export function white(sec: number, r: Rng): Float32Array {
  const b = buf(sec);
  for (let i = 0; i < b.length; i++) b[i] = r() * 2 - 1;
  return b;
}

/** Rosa Rauschen (Paul Kellet, gekürzt). */
export function pink(sec: number, r: Rng): Float32Array {
  const b = buf(sec);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < b.length; i++) {
    const w = r() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.099046;
    b1 = 0.963 * b1 + w * 0.2965164;
    b2 = 0.57 * b2 + w * 1.0526913;
    b[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
  }
  return b;
}

/** Braunes Rauschen: tief und weich (Rumpeln, Erde, Brandung). */
export function brown(sec: number, r: Rng): Float32Array {
  const b = buf(sec);
  let v = 0;
  for (let i = 0; i < b.length; i++) {
    v = (v + (r() * 2 - 1) * 0.02) * 0.998;
    b[i] = v * 3.5;
  }
  return b;
}

export type Freq = number | ((t: number) => number);
const fAt = (f: Freq, t: number) => (typeof f === 'number' ? f : f(t));

function blep(t: number, dt: number): number {
  if (t < dt) {
    t /= dt;
    return t + t - t * t - 1;
  }
  if (t > 1 - dt) {
    t = (t - 1) / dt;
    return t * t + t + t + 1;
  }
  return 0;
}

/** Oszillator mit bandbegrenzten Flanken (PolyBLEP), Frequenz darf sich ändern. */
export function osc(sec: number, f: Freq, type: 'sine' | 'saw' | 'square' | 'tri' = 'sine', phase = 0): Float32Array {
  const b = buf(sec);
  let ph = phase;
  let tri = 0;
  for (let i = 0; i < b.length; i++) {
    const dt = fAt(f, i / SR) / SR;
    let v: number;
    if (type === 'sine') v = Math.sin(ph * TAU);
    else if (type === 'saw') v = 2 * ph - 1 - blep(ph, dt);
    else {
      v = (ph < 0.5 ? 1 : -1) + blep(ph, dt) - blep((ph + 0.5) % 1, dt);
      if (type === 'tri') {
        tri = dt * 4 * v + (1 - dt * 4) * tri;
        v = tri;
      }
    }
    b[i] = v;
    ph += dt;
    ph -= Math.floor(ph);
  }
  return b;
}

/** Modal-Resonator: Summe gedämpfter Sinusschwingungen (Metall, Holz, Glas, Glocken). */
export interface Mode {
  f: number;
  a: number;
  /** Abklingzeit in Sekunden (bis −60 dB) */
  d: number;
  /** Startphase */
  p?: number;
}

export function modal(sec: number, modes: Mode[], onset = 0.0007): Float32Array {
  const b = buf(sec);
  const on = Math.max(1, Math.round(onset * SR));
  for (const m of modes) {
    if (m.f >= SR / 2.2) continue;
    const w = (TAU * m.f) / SR;
    const k = Math.exp(-6.9 / (m.d * SR));
    // rekursiver Sinus: billig und exakt
    let s1 = Math.sin(m.p ?? 0);
    let s0 = Math.sin((m.p ?? 0) - w);
    const c = 2 * Math.cos(w);
    let amp = m.a;
    for (let i = 0; i < b.length; i++) {
      const s = c * s1 - s0;
      s0 = s1;
      s1 = s;
      b[i]! += s0 * amp * (i < on ? i / on : 1);
      amp *= k;
      if (amp < 1e-5) break;
    }
  }
  return b;
}

/** Karplus-Strong-Saite (Bogensehne, Harfe, Laute). */
export function pluck(sec: number, f: number, r: Rng, bright = 0.5, decay = 0.996): Float32Array {
  const b = buf(sec);
  const n = Math.max(2, Math.round(SR / f));
  const line = new Float32Array(n);
  for (let i = 0; i < n; i++) line[i] = r() * 2 - 1;
  let prev = 0;
  for (let i = 0; i < b.length; i++) {
    const k = i % n;
    const v = line[k]!;
    b[i] = v;
    const nv = (v * bright + prev * (1 - bright)) * decay;
    prev = v;
    line[k] = nv;
  }
  return b;
}

// --- Filter --------------------------------------------------------------------------------

export type FilterType = 'lp' | 'hp' | 'bp' | 'peak' | 'notch';

/** RBJ-Biquad; Frequenz darf eine Funktion der Zeit sein (alle 16 Samples neu berechnet). */
export function filter(x: Float32Array, type: FilterType, f: Freq, q = 0.707, gainDb = 0): Float32Array {
  let b0 = 0, b1 = 0, b2 = 0, a1 = 0, a2 = 0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const A = Math.pow(10, gainDb / 40);
  const coef = (fc: number) => {
    const w = (TAU * Math.min(SR * 0.45, Math.max(10, fc))) / SR;
    const cw = Math.cos(w);
    const al = Math.sin(w) / (2 * q);
    let a0: number;
    switch (type) {
      case 'lp':
        b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al;
        break;
      case 'hp':
        b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al;
        break;
      case 'bp':
        b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al;
        break;
      case 'notch':
        b0 = 1; b1 = -2 * cw; b2 = 1; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al;
        break;
      case 'peak':
        b0 = 1 + al * A; b1 = -2 * cw; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cw; a2 = 1 - al / A;
        break;
    }
    b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
  };
  const dyn = typeof f !== 'number';
  coef(fAt(f, 0));
  const out = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) {
    if (dyn && (i & 15) === 0) coef(fAt(f, i / SR));
    const xi = x[i]!;
    const y = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = xi; y2 = y1; y1 = y;
    out[i] = y;
  }
  return out;
}

export const lp = (x: Float32Array, f: Freq, q = 0.707) => filter(x, 'lp', f, q);
export const hp = (x: Float32Array, f: Freq, q = 0.707) => filter(x, 'hp', f, q);
export const bp = (x: Float32Array, f: Freq, q = 1) => filter(x, 'bp', f, q);

// --- Hüllkurven & Formen -------------------------------------------------------------------

/** Anstieg (linear) und exponentielles Abklingen; `tau` = Zeit bis −60 dB. */
export function ad(sec: number, attack: number, tau: number, hold = 0): Float32Array {
  const b = buf(sec);
  const na = Math.max(1, attack * SR);
  const nh = hold * SR;
  const k = Math.exp(-6.9 / (tau * SR));
  let v = 1;
  for (let i = 0; i < b.length; i++) {
    if (i < na) b[i] = i / na;
    else if (i < na + nh) b[i] = 1;
    else {
      b[i] = v;
      v *= k;
    }
  }
  return b;
}

/** Stückweise lineare Hüllkurve aus [Zeit, Wert]-Punkten. */
export function env(sec: number, pts: [number, number][]): Float32Array {
  const b = buf(sec);
  let k = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    while (k < pts.length - 2 && t > pts[k + 1]![0]) k++;
    const [t0, v0] = pts[k]!;
    const [t1, v1] = pts[Math.min(k + 1, pts.length - 1)]!;
    const u = t1 > t0 ? Math.min(1, Math.max(0, (t - t0) / (t1 - t0))) : 1;
    b[i] = v0 + (v1 - v0) * u;
  }
  return b;
}

/** Glockenform (Anschwellen & Abschwellen) zwischen t0 und t1. */
export function bell(sec: number, t0: number, t1: number, shape = 2): Float32Array {
  const b = buf(sec);
  for (let i = 0; i < b.length; i++) {
    const u = (i / SR - t0) / (t1 - t0);
    b[i] = u <= 0 || u >= 1 ? 0 : Math.pow(Math.sin(Math.PI * u), shape);
  }
  return b;
}

/** Weiche Zufallskurve (für Wind, Böen, Flackern), Werte 0…1. */
export function drift(sec: number, rate: number, r: Rng, smooth = 3): Float32Array {
  const b = buf(sec);
  const step = Math.max(1, Math.round(SR / rate));
  let a = r();
  let c = r();
  for (let i = 0; i < b.length; i++) {
    const k = i % step;
    if (k === 0 && i > 0) {
      a = c;
      c = r();
    }
    const u = k / step;
    const s = u * u * (3 - 2 * u);
    b[i] = a + (c - a) * s;
  }
  let out: Float32Array = b;
  for (let s = 0; s < smooth; s++) out = lp(out, rate * 2, 0.5);
  return out;
}

// --- Rechnen -------------------------------------------------------------------------------

export function mul(a: Float32Array, b: Float32Array | number): Float32Array {
  if (typeof b === 'number') {
    for (let i = 0; i < a.length; i++) a[i]! *= b;
    return a;
  }
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) a[i]! *= b[i]!;
  for (let i = n; i < a.length; i++) a[i] = 0;
  return a;
}

/** `src` ab `at` Sekunden mit `gain` in `dst` mischen. */
export function add(dst: Float32Array, src: Float32Array, gain = 1, at = 0): Float32Array {
  const o = Math.round(at * SR);
  const n = Math.min(src.length, dst.length - o);
  for (let i = Math.max(0, -o); i < n; i++) dst[i + o]! += src[i]! * gain;
  return dst;
}

/** Weiche Sättigung (tanh), Pegel bleibt ungefähr gleich. */
export function sat(x: Float32Array, drive = 2): Float32Array {
  const k = 1 / Math.tanh(drive);
  for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i]! * drive) * k;
  return x;
}

export function peak(x: Float32Array): number {
  let m = 0;
  for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i]!));
  return m;
}

export function norm(x: Float32Array, to = 0.9): Float32Array {
  const m = peak(x);
  return m > 0 ? mul(x, to / m) : x;
}

/** Klickfreie Ränder. */
export function fade(x: Float32Array, inSec = 0.002, outSec = 0.02): Float32Array {
  const ni = Math.min(x.length, Math.round(inSec * SR));
  const no = Math.min(x.length, Math.round(outSec * SR));
  for (let i = 0; i < ni; i++) x[i]! *= i / ni;
  for (let i = 0; i < no; i++) x[x.length - 1 - i]! *= i / no;
  return x;
}

/** Kurzer Einschwinger-Knack (gefiltertes Rauschen), z. B. Anschlag, Schnappen. */
export function click(sec: number, r: Rng, f = 3000, q = 0.8, tau = 0.004): Float32Array {
  return mul(bp(white(sec, r), f, q), ad(sec, 0.0003, tau));
}

/** Schlag-Körper: Sinus mit fallender Tonhöhe (Trommel, Aufprall, Plumps). */
export function thump(sec: number, f0: number, f1: number, drop: number, tau: number): Float32Array {
  const s = osc(sec, (t) => f1 + (f0 - f1) * Math.exp(-t / drop), 'sine');
  return mul(s, ad(sec, 0.001, tau));
}

/** Zeitversatz (Frühreflexion/Echo). */
export function echo(x: Float32Array, delay: number, gain: number, taps = 1, damp = 3000): Float32Array {
  let src = x;
  for (let k = 1; k <= taps; k++) {
    src = lp(src, damp);
    add(x, src, Math.pow(gain, k), delay * k);
  }
  return x;
}

/** Aus Mono ein breites Stereopaar (leicht verzögert und unterschiedlich gefärbt). */
export function widen(x: Float32Array, ms = 11, tilt = 0.25): [Float32Array, Float32Array] {
  const d = Math.round((ms / 1000) * SR);
  const L = new Float32Array(x.length);
  const R = new Float32Array(x.length);
  const lo = lp(x, 1800);
  for (let i = 0; i < x.length; i++) {
    const v = x[i]!;
    const dv = i >= d ? x[i - d]! : 0;
    const side = (v - (lo[i] ?? 0)) * tilt;
    L[i] = v * 0.8 + dv * 0.2 + side;
    R[i] = dv * 0.8 + v * 0.2 - side;
  }
  return [L, R];
}

/** Macht einen Puffer nahtlos wiederholbar: das Ende wird in den Anfang geblendet. */
export function loopify(x: Float32Array, xf: number): Float32Array {
  const n = Math.round(xf * SR);
  const out = x.slice(0, x.length - n);
  for (let i = 0; i < n; i++) {
    const u = i / n;
    // gleiche Leistung
    out[i] = x[i]! * Math.sin((u * Math.PI) / 2) + x[x.length - n + i]! * Math.cos((u * Math.PI) / 2);
  }
  return out;
}

/** Streut `count` Ereignisse zeitlich über [t0, t1] (Dichte über `curve`). */
export function scatter(dst: Float32Array, count: number, t0: number, t1: number, r: Rng, make: (k: number) => Float32Array, gain: (k: number) => number = () => 1, curve = 1): Float32Array {
  for (let k = 0; k < count; k++) {
    const u = Math.pow(r(), curve);
    add(dst, make(k), gain(k), t0 + (t1 - t0) * u);
  }
  return dst;
}

/** Hall-Impulsantwort (Stereo): dichtes, abklingendes, zu den Höhen hin dunkleres Rauschen. */
export function impulse(sec: number, decay: number, r: Rng, pre = 0.012): [Float32Array, Float32Array] {
  const mk = (seed: number) => {
    const rr = rng(seed);
    const n = white(sec, rr);
    // Frühreflexionen
    const e = ad(sec, pre, decay);
    const x = mul(n, e);
    // mit der Zeit dunkler werden
    return lp(x, (t) => 9000 * Math.exp(-t * 2.2) + 700, 0.5);
  };
  const s = Math.floor(r() * 1e9);
  return [norm(mk(s), 0.5), norm(mk(s + 7), 0.5)];
}

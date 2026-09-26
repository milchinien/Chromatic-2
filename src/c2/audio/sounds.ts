// =====================================================================
// Klangrezepte. Jeder Klang wird aus mehreren Schichten gebaut (Anschlag,
// Körper, Nachklang) und in mehreren Varianten berechnet, damit sich
// nichts wie eine Wiederholung anhört. Lautstärke, Stimmenzahl und
// Mindestabstand stehen direkt beim Rezept.
// =====================================================================

import {
  SR,
  ad,
  add,
  bell,
  between,
  bp,
  brown,
  buf,
  click,
  drift,
  echo,
  env,
  fade,
  filter,
  hp,
  loopify,
  lp,
  modal,
  mul,
  norm,
  osc,
  pink,
  pluck,
  sat,
  scatter,
  semi,
  thump,
  white,
  widen,
  type Rng,
} from './dsp';

const TAU = Math.PI * 2;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export type Out = Float32Array | [Float32Array, Float32Array];
export type Bus = 'sfx' | 'ui' | 'amb';

export interface Recipe {
  /** Anzahl Varianten */
  n: number;
  bus: Bus;
  /** Grundlautstärke (linear) */
  vol: number;
  /** gleichzeitige Stimmen */
  max?: number;
  /** Mindestabstand zwischen zwei Starts in ms */
  gap?: number;
  /** Hallanteil */
  send?: number;
  /** Endlosschleife (Atmosphäre, Schlachtenlärm) */
  loop?: boolean;
  /** erst berechnen, wenn gebraucht */
  lazy?: boolean;
  gen: (r: Rng, v: number) => Out;
}

// --- Bausteine ------------------------------------------------------------------------------

/** Metall (Klinge, Rüstung, Amboss): unharmonische Teiltöne. */
function metal(sec: number, f0: number, r: Rng, decay = 0.3, bright = 1): Float32Array {
  const ratios = [1, 1.52, 2.13, 2.66, 3.3, 4.1, 5.07, 6.2];
  return modal(
    sec,
    ratios.map((k, i) => ({
      f: f0 * k * between(r, 0.97, 1.03),
      a: Math.pow(i + 1, -0.7) * between(r, 0.5, 1) * (i > 3 ? bright : 1),
      d: decay * between(r, 0.6, 1.2) * (1 - i * 0.07),
      p: r() * TAU,
    })),
  );
}

/** Holz / Stein: wenige, schnell verklingende Teiltöne. */
function wood(sec: number, f0: number, r: Rng, decay = 0.05): Float32Array {
  const amp = [1, 0.5, 0.3, 0.15];
  const dk = [1, 0.6, 0.4, 0.25];
  return modal(
    sec,
    [1, 2.7, 4.3, 6.1].map((k, i) => ({ f: f0 * k * between(r, 0.96, 1.04), a: amp[i]!, d: decay * dk[i]!, p: r() * TAU })),
  );
}

/** Glas / Kristall / Zauberglöckchen. */
function glass(sec: number, f0: number, r: Rng, decay = 0.6): Float32Array {
  const amp = [1, 0.35, 0.15, 0.06];
  const dk = [1, 0.55, 0.3, 0.18];
  return modal(
    sec,
    [1, 2.76, 5.4, 8.93].map((k, i) => ({ f: f0 * k, a: amp[i]!, d: decay * dk[i]!, p: r() * TAU })),
  );
}

/** Kirchenglocke (Hum, Prime, kleine Terz, Quinte, Oktave …). */
function bellTone(sec: number, f0: number, r: Rng, decay = 3): Float32Array {
  const k = [0.5, 1, 1.19, 1.5, 2, 2.51, 2.66, 3.01, 4.1];
  const a = [0.6, 1, 0.5, 0.35, 0.5, 0.25, 0.2, 0.15, 0.1];
  const d = [1.3, 1, 0.8, 0.6, 0.5, 0.35, 0.3, 0.25, 0.18];
  return modal(sec, k.map((x, i) => ({ f: f0 * x * between(r, 0.998, 1.002), a: a[i]!, d: decay * d[i]!, p: r() * TAU })), 0.002);
}

/** Münze: hell, lang nachklingend. */
function coin(sec: number, r: Rng): Float32Array {
  const f0 = between(r, 2300, 3600);
  const x = modal(sec, [1, 2.71, 5.1, 8.2, 11.3].map((k, i) => ({ f: f0 * k * between(r, 0.99, 1.01), a: [1, 0.6, 0.4, 0.2, 0.1][i]!, d: [0.45, 0.32, 0.2, 0.12, 0.08][i]! * between(r, 0.7, 1.2), p: r() * TAU })));
  return add(x, click(sec, r, 6000, 1, 0.0015), 0.4);
}

/** Luftzug: gefiltertes Rauschen, dessen Mitte von f0 nach f1 wandert. */
function whoosh(sec: number, r: Rng, f0: number, f1: number, t0: number, t1: number, q = 1.2, shape = 1.5): Float32Array {
  const n = bp(pink(sec, r), (t) => f0 + (f1 - f0) * clamp01((t - t0) / (t1 - t0)), q);
  return mul(n, bell(sec, t0, t1, shape));
}

/** Knistern: viele winzige Knacke. */
function crackles(dst: Float32Array, r: Rng, n: number, t0: number, t1: number, gain = 0.5, curve = 1): Float32Array {
  return scatter(dst, n, t0, t1, r, () => click(0.02, r, between(r, 1500, 6500), 0.9, between(r, 0.0006, 0.0028)), () => gain * r() * r(), curve);
}

/** Steine / Trümmer, die aufschlagen. */
function stones(dst: Float32Array, r: Rng, n: number, t0: number, t1: number, gain = 0.5, curve = 1, fLo = 500, fHi = 1600): Float32Array {
  return scatter(
    dst,
    n,
    t0,
    t1,
    r,
    () => add(wood(0.14, between(r, fLo, fHi), r, between(r, 0.02, 0.05)), click(0.14, r, 3200, 0.7, 0.0018), 0.6),
    () => gain * (0.25 + 0.75 * r()),
    curve,
  );
}

/** Knarren (Holz, Seil, Wurzeln): Haftgleit-Impulse durch Holzresonanzen. */
function creak(sec: number, r: Rng, t0: number, t1: number, rate0 = 90, rate1 = 140): Float32Array {
  const x = buf(sec);
  let t = t0;
  while (t < t1) {
    const i = Math.round(t * SR);
    if (i < x.length) x[i] = between(r, 0.4, 1) * (r() < 0.5 ? -1 : 1);
    const rate = rate0 + (rate1 - rate0) * ((t - t0) / (t1 - t0));
    t += (1 / rate) * between(r, 0.8, 1.2);
  }
  const y = add(add(bp(x, 420, 6), bp(x, 980, 7), 0.8), bp(x, 1900, 6), 0.4);
  return mul(y, bell(sec, t0, t1, 0.6));
}

/** Blechbläser (Kriegshorn, Fanfare). Ton beginnt bei t0 und dauert dur Sekunden. */
function brass(sec: number, f: number, r: Rng, t0: number, dur: number, o: { bend?: number; bright?: number; growl?: number; vol?: number } = {}): Float32Array {
  const bend = o.bend ?? -1.2;
  const bright = o.bright ?? 1;
  const e = env(sec, [
    [0, 0],
    [t0, 0],
    [t0 + 0.05, 0.75],
    [t0 + 0.14, 1],
    [t0 + Math.max(0.15, dur - 0.08), 0.85],
    [t0 + dur + 0.22, 0],
    [sec, 0],
  ]);
  const ef = (t: number) => e[Math.min(e.length - 1, Math.floor(t * SR))]!;
  const vib = between(r, 4.8, 5.6);
  const fr = (t: number) => {
    const u = Math.max(0, t - t0);
    return f * semi(bend * Math.exp(-u / 0.07)) * (1 + 0.005 * Math.sin(TAU * vib * u) * Math.min(1, u / 0.4));
  };
  const a = osc(sec, fr, 'saw');
  const b = osc(sec, (t) => fr(t) * 1.0045, 'saw', r());
  const c = osc(sec, (t) => fr(t) * 0.5, 'sine');
  const x = new Float32Array(a.length);
  for (let i = 0; i < x.length; i++) x[i] = a[i]! + b[i]! * 0.8 + c[i]! * 0.4;
  let y = filter(x, 'lp', (t) => 160 + 2800 * bright * Math.pow(ef(t), 1.8), 1.3);
  y = filter(y, 'peak', 1150, 1.1, 5);
  y = filter(y, 'peak', 2600, 2, 2 * bright);
  mul(y, e);
  add(y, mul(mul(bp(white(sec, r), 1500, 1.2), e), 0.05));
  return mul(sat(y, 1.4 + (o.growl ?? 0)), o.vol ?? 1);
}

/** Große Kriegstrommel. */
function drum(sec: number, f: number, r: Rng): Float32Array {
  const n = buf(sec);
  add(n, thump(sec, f * 2.3, f, 0.022, 0.75));
  add(n, mul(bp(white(sec, r), f * 4, 0.8), ad(sec, 0.0005, 0.12)), 0.45);
  add(n, click(sec, r, 1100, 0.8, 0.008), 0.3);
  return sat(n, 1.3);
}

/** Pauke mit Wirbel-Anteil (für Fanfaren). */
function timpani(sec: number, f: number, r: Rng): Float32Array {
  const x = modal(sec, [1, 1.5, 1.99, 2.44].map((k, i) => ({ f: f * k, a: [1, 0.5, 0.3, 0.15][i]!, d: [1.6, 1, 0.7, 0.4][i]!, p: r() })));
  add(x, mul(lp(white(sec, r), 900), ad(sec, 0.001, 0.08)), 0.5);
  return sat(x, 1.2);
}

/** Wasser-Tropfen („Plink“: Tonhöhe steigt). */
function drop(sec: number, r: Rng, f = 900): Float32Array {
  const f0 = f * between(r, 0.8, 1.3);
  const x = osc(sec, (t) => f0 * (1 + 1.2 * (1 - Math.exp(-t / 0.018))), 'sine');
  return mul(x, ad(sec, 0.0008, 0.06));
}

/** Vogelruf: ein paar Zwitscher-Silben mit Obertönen. */
function birdCall(r: Rng): Float32Array {
  const kind = Math.floor(r() * 3);
  const syll = kind === 0 ? 2 + Math.floor(r() * 3) : kind === 1 ? 6 + Math.floor(r() * 6) : 1;
  const len = kind === 1 ? 0.028 : kind === 2 ? 0.35 : 0.07;
  const f0 = between(r, 2600, 4200);
  const sec = syll * (len + 0.03) + 0.1;
  const out = buf(sec);
  for (let s = 0; s < syll; s++) {
    const up = kind === 1 ? (s % 2 ? 1.18 : 1) : 1;
    const x = osc(len + 0.02, (t) => {
      const u = t / len;
      if (kind === 2) return f0 * 0.8 * (1 + 0.35 * Math.sin(u * Math.PI) + 0.04 * Math.sin(TAU * 28 * t));
      return f0 * up * (1 + (kind === 0 ? 0.5 * u : 0.15 * Math.sin(u * Math.PI)));
    });
    const h = osc(len + 0.02, (t) => f0 * up * 2 * (1 + (kind === 0 ? 0.5 * (t / len) : 0)));
    add(x, h, 0.12);
    mul(x, bell(len + 0.02, 0, len, 1.2));
    add(out, x, 1, s * (len + (kind === 1 ? 0.012 : 0.05)));
  }
  return out;
}

/** Mono-Klang auf ein Stereopaar legen (konstante Leistung). */
function panAdd(L: Float32Array, R: Float32Array, src: Float32Array, pan: number, gain = 1, at = 0): void {
  const a = ((pan + 1) * Math.PI) / 4;
  add(L, src, Math.cos(a) * gain, at);
  add(R, src, Math.sin(a) * gain, at);
}

const stereo = (sec: number): [Float32Array, Float32Array] => [buf(sec), buf(sec)];
const normS = (s: [Float32Array, Float32Array], to = 0.9): [Float32Array, Float32Array] => {
  let m = 0;
  for (const c of s) for (let i = 0; i < c.length; i++) m = Math.max(m, Math.abs(c[i]!));
  if (m > 0) for (const c of s) mul(c, to / m);
  return s;
};
/** Gleichanteil entfernen (braunes Rauschen und tiefe Schläge driften sonst von der Nulllinie). */
const dcBlock = (x: Float32Array) => hp(x, 16, 0.6);
const loopS = (s: [Float32Array, Float32Array], xf = 2): [Float32Array, Float32Array] => [loopify(dcBlock(s[0]), xf), loopify(dcBlock(s[1]), xf)];
const done = (x: Float32Array, to = 0.9, out = 0.03) => fade(norm(dcBlock(x), to), 0.001, out);

// --- Kampf: Nahkampf -----------------------------------------------------------------------

function clash(r: Rng): Float32Array {
  const sec = 0.6;
  const f0 = between(r, 1300, 2500);
  const x = metal(sec, f0, r, between(r, 0.18, 0.4), between(r, 0.6, 1));
  add(x, metal(sec, f0 * between(r, 1.12, 1.45), r, 0.15, 0.7), 0.45, between(r, 0, 0.004));
  add(x, mul(bp(white(sec, r), 5200, 1.6), ad(sec, 0.0003, 0.035)), 0.6); // Kratzen
  add(x, click(sec, r, 4000, 0.9, 0.002), 1.2);
  add(x, thump(sec, 260, 140, 0.01, 0.05), 0.5);
  return done(hp(sat(x, 1.6), 180), 0.9, 0.08);
}

function thud(r: Rng): Float32Array {
  const sec = 0.3;
  const x = mul(lp(brown(sec, r), (t) => 200 + 900 * Math.exp(-t / 0.02)), ad(sec, 0.0008, 0.09));
  add(x, thump(sec, between(r, 170, 230), 70, 0.018, 0.13), 0.7);
  add(x, click(sec, r, between(r, 1400, 2200), 0.8, 0.003), 0.35);
  return done(sat(x, 1.5), 0.9);
}

function impactBig(r: Rng): Float32Array {
  const sec = 0.9;
  const x = thump(sec, 140, 38, 0.04, 0.55);
  add(x, mul(lp(brown(sec, r), (t) => 150 + 1500 * Math.exp(-t / 0.03)), ad(sec, 0.001, 0.3)), 0.9);
  add(x, metal(sec, between(r, 700, 1000), r, 0.35, 0.6), 0.25);
  add(x, click(sec, r, 2500, 0.7, 0.004), 0.6);
  return done(sat(x, 2), 0.95, 0.1);
}

// --- Kampf: Fernkampf & Magie --------------------------------------------------------------

function bow(r: Rng): Float32Array {
  const sec = 0.4;
  const x = mul(pluck(sec, between(r, 150, 230), r, 0.6, 0.985), ad(sec, 0.001, 0.14));
  add(x, click(sec, r, 1800, 0.9, 0.002), 0.5);
  add(x, whoosh(sec, r, 900, 3200, 0.01, 0.2, 1.4, 1.2), 0.9);
  return done(hp(x, 120), 0.8);
}

function arrowHit(r: Rng): Float32Array {
  const sec = 0.18;
  const x = wood(sec, between(r, 550, 900), r, 0.035);
  add(x, click(sec, r, 3000, 0.9, 0.002), 0.8);
  add(x, mul(lp(brown(sec, r), 500), ad(sec, 0.0005, 0.03)), 0.6);
  return done(x, 0.8);
}

function cast(r: Rng): Float32Array {
  const sec = 0.7;
  const f0 = between(r, 500, 800);
  const x = buf(sec);
  let pc = 0;
  let pm = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    const fc = f0 * (1 + 0.7 * (1 - Math.exp(-t / 0.09)));
    const idx = 2.5 * Math.exp(-t / 0.12) + 0.4;
    pm += (fc * 2.01) / SR;
    pc += fc / SR;
    x[i] = Math.sin(TAU * pc + idx * Math.sin(TAU * pm));
  }
  mul(x, ad(sec, 0.012, 0.4));
  add(x, whoosh(sec, r, 1000, 3500, 0, 0.3, 1.3), 1.4);
  scatter(x, 6, 0.02, 0.3, r, () => glass(0.2, between(r, 3000, 7000), r, between(r, 0.05, 0.12)), () => between(r, 0.1, 0.3));
  return done(x, 0.8, 0.1);
}

function spark(r: Rng): Float32Array {
  // Einschlag eines Zauberballs (klein)
  const sec = 0.3;
  const x = mul(bp(white(sec, r), (t) => 4000 * Math.exp(-t / 0.06) + 800, 1), ad(sec, 0.0005, 0.08));
  scatter(x, 4, 0, 0.06, r, () => glass(0.25, between(r, 2500, 6000), r, between(r, 0.04, 0.1)), () => between(r, 0.1, 0.25));
  add(x, thump(sec, 300, 120, 0.01, 0.05), 0.3);
  return done(x, 0.7);
}

function chainLightning(r: Rng): Float32Array {
  const sec = 1.1;
  const x = buf(sec);
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    const dens = 0.35 * Math.exp(-t / 0.18) + 0.02 * Math.exp(-t / 0.5);
    if (r() < dens) x[i] = (r() * 2 - 1) * (0.5 + 0.5 * Math.exp(-t / 0.2));
  }
  let y = add(hp(x, 900), bp(x, 3200, 1.2), 1.5);
  const buzz = mul(osc(sec, (t) => 110 + 30 * Math.sin(TAU * 7 * t), 'saw'), ad(sec, 0.002, 0.3));
  mul(buzz, drift(sec, 70, r, 1));
  y = add(y, lp(buzz, 2500), 0.5);
  add(y, mul(lp(brown(sec, r), 260), ad(sec, 0.02, 0.9)), 0.9, 0.04); // Donner
  return done(sat(y, 1.8), 0.9, 0.1);
}

function sunbeam(r: Rng): Float32Array {
  const sec = 1.3;
  const f = between(r, 220, 262);
  const x = buf(sec);
  for (const k of [1, 1.5, 2, 2.52, 3]) add(x, osc(sec, f * k * between(r, 0.997, 1.003), 'saw', r()), 1 / k);
  let y = filter(x, 'lp', (t) => 700 + 5500 * (1 - Math.exp(-t / 0.08)), 0.9);
  mul(y, ad(sec, 0.03, 0.9));
  add(y, whoosh(sec, r, 1500, 6000, 0, 0.5, 1), 1.2);
  scatter(y, 10, 0.05, 0.8, r, () => glass(0.4, between(r, 2200, 5000), r, 0.2), () => between(r, 0.05, 0.15));
  y = hp(y, 150);
  return done(y, 0.8, 0.2);
}

function cannon(r: Rng): Float32Array {
  const sec = 1.6;
  const x = mul(lp(white(sec, r), (t) => 7000 * Math.exp(-t / 0.03) + 400), ad(sec, 0.0004, 0.28));
  add(x, thump(sec, 130, 36, 0.035, 0.7), 1.1);
  add(x, mul(lp(brown(sec, r), 220), ad(sec, 0.02, 1.2)), 0.8);
  echo(x, 0.13, 0.35, 2, 1500);
  return done(sat(x, 2.2), 0.95, 0.15);
}

// --- Kampf: Belagerung & Flächen -----------------------------------------------------------

function siegeLaunch(r: Rng): Float32Array {
  const sec = 1;
  const x = creak(sec, r, 0, 0.22, 70, 160);
  add(x, thump(sec, 120, 60, 0.02, 0.2), 0.8, 0.2);
  add(x, wood(sec, 190, r, 0.12), 0.5, 0.2);
  add(x, whoosh(sec, r, 400, 1200, 0.22, 0.85, 1.2), 1.2);
  return done(x, 0.8, 0.1);
}

function boomRock(r: Rng, heavy: boolean): Float32Array {
  const sec = heavy ? 2 : 1.3;
  const x = thump(sec, heavy ? 95 : 120, heavy ? 30 : 42, heavy ? 0.07 : 0.05, heavy ? 0.9 : 0.45);
  add(x, mul(lp(brown(sec, r), (t) => 120 + 900 * Math.exp(-t / 0.05)), ad(sec, 0.002, heavy ? 0.8 : 0.4)), 1);
  add(x, click(sec, r, 1800, 0.6, 0.006), 0.8);
  stones(x, r, heavy ? 30 : 14, 0.04, heavy ? 0.9 : 0.55, 0.35, 1.8);
  add(x, mul(hp(white(sec, r), 2500), ad(sec, 0.01, heavy ? 0.6 : 0.3)), 0.08);
  if (heavy) echo(x, 0.11, 0.3, 1, 1200);
  return done(sat(x, heavy ? 2.2 : 1.7), 0.95, 0.15);
}

function boomFire(r: Rng, big = 1): Float32Array {
  const sec = 1.6 * big;
  const x = mul(lp(pink(sec, r), (t) => 150 + 2200 * Math.exp(-t / 0.1), 0.9), env(sec, [[0, 0], [0.015, 1], [0.25, 0.5], [1.2 * big, 0]]));
  add(x, thump(sec, 90, 40, 0.06, 0.5 * big), 0.9);
  add(x, mul(bp(pink(sec, r), 420, 0.6), ad(sec, 0.06, 1.1 * big)), 0.4);
  crackles(x, r, Math.round(40 * big), 0.05, 1.3 * big, 0.6, 1.6);
  return done(sat(x, 1.8), 0.95, 0.15);
}

function frost(r: Rng): Float32Array {
  const sec = 1.1;
  const x = buf(sec);
  scatter(x, 22, 0, 0.16, r, () => glass(0.8, between(r, 2000, 8000), r, between(r, 0.08, 0.5)), () => between(r, 0.1, 0.4), 1.6);
  add(x, mul(hp(white(sec, r), 3000), ad(sec, 0.0005, 0.12)), 0.6);
  add(x, mul(bp(white(sec, r), 1100, 1.5), ad(sec, 0.001, 0.07)), 0.6);
  add(x, thump(sec, 400, 200, 0.01, 0.06), 0.3);
  return done(x, 0.85, 0.15);
}

function whirl(r: Rng): Float32Array {
  const sec = 0.7;
  const sp = between(r, 3.5, 5);
  const x = mul(bp(pink(sec, r), (t) => 1100 + 800 * Math.sin(TAU * sp * t), 2.2), bell(sec, 0, 0.55, 1));
  add(x, metal(sec, between(r, 2400, 3200), r, 0.2, 0.5), 0.15, 0.05);
  return done(x, 0.8, 0.1);
}

function roots(r: Rng): Float32Array {
  const sec = 1.6;
  const x = mul(lp(brown(sec, r), 130), env(sec, [[0, 0], [0.08, 1], [0.6, 0.6], [1.5, 0]]));
  add(x, creak(sec, r, 0.02, 0.7, 60, 110), 0.7);
  add(x, creak(sec, r, 0.25, 1.1, 90, 50), 0.5);
  scatter(x, 5, 0.02, 0.5, r, () => add(click(0.2, r, 1300, 0.7, 0.008), wood(0.2, between(r, 180, 300), r, 0.08), 0.6), () => between(r, 0.4, 0.8));
  stones(x, r, 8, 0.05, 0.6, 0.15, 1.5, 300, 700);
  return done(x, 0.85, 0.2);
}

function bloat(r: Rng): Float32Array {
  const sec = 0.9;
  const x = thump(sec, 340, 80, 0.012, 0.09);
  add(x, mul(lp(white(sec, r), 1300), ad(sec, 0.0008, 0.05)), 0.7);
  add(x, mul(bp(white(sec, r), (t) => 500 + 900 * Math.sin(TAU * 17 * t) ** 2, 4), ad(sec, 0.004, 0.2)), 0.8);
  scatter(x, 9, 0.05, 0.7, r, () => {
    const f = between(r, 250, 650);
    return mul(osc(0.06, (t) => f * (1 + 3 * t)), ad(0.06, 0.002, 0.03));
  }, () => between(r, 0.1, 0.3), 1.5);
  return done(sat(x, 1.4), 0.85, 0.1);
}

function spore(r: Rng): Float32Array {
  const sec = 0.8;
  const x = mul(lp(pink(sec, r), (t) => 2600 * Math.exp(-t / 0.15) + 300), ad(sec, 0.02, 0.55));
  add(x, mul(hp(white(sec, r), 5000), ad(sec, 0.01, 0.3)), 0.12);
  return done(x, 0.7, 0.1);
}

function colossus(r: Rng): Float32Array {
  const sec = 3.2;
  const x = boomRock(r, true);
  const y = buf(sec);
  add(y, x);
  add(y, thump(sec, 70, 22, 0.12, 1.6), 1);
  add(y, metal(sec, 150, r, 1.6, 0.5), 0.35);
  add(y, mul(hp(white(sec, r), 1800), env(sec, [[0, 0], [0.05, 1], [1.8, 0]])), 0.15); // Dampf
  stones(y, r, 24, 0.1, 1.4, 0.3, 1.6);
  return done(sat(y, 2), 0.97, 0.3);
}

function meteor(r: Rng): Float32Array {
  const sec = 2.4;
  const y = buf(sec);
  add(y, mul(bp(pink(sec, r), (t) => 700 + 3000 * t, 1.5), env(sec, [[0, 0], [0.13, 1], [0.14, 0]])), 0.6);
  add(y, boomFire(r, 1.3), 1, 0.12);
  add(y, thump(sec, 90, 28, 0.08, 1), 0.8, 0.12);
  return done(y, 0.97, 0.2);
}

// --- Kampf: Heilen, Beschwören, Tod --------------------------------------------------------

function aura(r: Rng, root: number, chord: number[], bright: number): Float32Array {
  const sec = 1.8;
  const x = buf(sec);
  chord.forEach((k, i) => add(x, glass(sec, root * k * between(r, 0.998, 1.002), r, 1.1 * bright), 0.5, i * 0.045));
  mul(x, env(sec, [[0, 0], [0.06, 1], [sec, 1]]));
  const trem = osc(sec, 6);
  for (let i = 0; i < x.length; i++) x[i]! *= 0.85 + 0.15 * trem[i]!;
  add(x, whoosh(sec, r, 2000, 5000, 0, 0.6, 0.8), 0.25 * bright);
  return done(x, 0.7, 0.3);
}

function spawn(r: Rng): Float32Array {
  const sec = 0.4;
  const f = between(r, 350, 500);
  const x = mul(osc(sec, (t) => f * (1 + 2 * (1 - Math.exp(-t / 0.05)))), ad(sec, 0.002, 0.16));
  add(x, whoosh(sec, r, 2500, 6000, 0, 0.2, 1), 0.8);
  scatter(x, 3, 0.02, 0.12, r, () => glass(0.25, between(r, 3000, 6000), r, 0.08), () => 0.15);
  return done(x, 0.6);
}

function spawnUndead(r: Rng): Float32Array {
  const sec = 1.1;
  const x = mul(bp(pink(sec, r), (t) => 420 + 300 * Math.sin(Math.PI * t * 1.2), 6), bell(sec, 0, 1, 1));
  const lo = add(osc(sec, 78), osc(sec, 79.3), 1);
  add(x, mul(lo, bell(sec, 0, 1, 1.5)), 0.08);
  add(x, mul(hp(white(sec, r), 4000), bell(sec, 0, 0.7)), 0.03);
  return done(x, 0.7, 0.1);
}

function death(r: Rng): Float32Array {
  const sec = 0.4;
  const x = thump(sec, between(r, 130, 170), 60, 0.02, 0.12);
  add(x, mul(lp(brown(sec, r), 450), ad(sec, 0.002, 0.12)), 0.8);
  scatter(x, 3 + Math.floor(r() * 3), 0.02, 0.18, r, () => metal(0.1, between(r, 2800, 5200), r, 0.03, 0.4), () => between(r, 0.05, 0.18));
  return done(x, 0.75, 0.05);
}

function deathBig(r: Rng): Float32Array {
  const sec = 1.2;
  const x = thump(sec, 100, 32, 0.05, 0.6);
  add(x, mul(lp(brown(sec, r), 260), ad(sec, 0.003, 0.5)), 1);
  add(x, metal(sec, between(r, 800, 1100), r, 0.35, 0.5), 0.2, 0.01);
  stones(x, r, 7, 0.02, 0.35, 0.2, 1.4, 400, 900);
  return done(sat(x, 1.8), 0.9, 0.1);
}

function deathBoss(r: Rng): Float32Array {
  const sec = 5.5;
  const x = buf(sec);
  add(x, thump(sec, 70, 24, 0.14, 2), 1);
  add(x, mul(lp(brown(sec, r), 180), ad(sec, 0.01, 2.4)), 1);
  add(x, bellTone(sec, 110, r, 4.5), 0.5, 0.05);
  // dunkler Chor-Akkord aus verstimmten Sägezähnen
  const pad = buf(sec);
  for (const f of [110, 130.8, 164.8, 220])
    for (const d of [0.996, 1.004]) add(pad, osc(sec, f * d, 'saw', r()), 0.15);
  add(x, mul(lp(pad, 900, 0.8), env(sec, [[0, 0], [0.5, 1], [2.5, 0.6], [5.4, 0]])), 0.6);
  add(x, whoosh(sec, r, 300, 4000, 0.1, 2.2, 0.9), 0.4);
  return done(sat(x, 1.5), 0.97, 0.5);
}

function deathFly(r: Rng): Float32Array {
  const sec = 0.5;
  const x = buf(sec);
  for (let k = 0; k < 4; k++) add(x, whoosh(0.08, r, 700, 1400, 0, 0.07, 1.5), 0.6 - k * 0.12, k * 0.07);
  add(x, death(r), 0.5, 0.25);
  return done(x, 0.7);
}

function baseHit(r: Rng): Float32Array {
  const sec = 0.5;
  const x = thump(sec, 170, 70, 0.02, 0.2);
  add(x, wood(sec, between(r, 200, 280), r, 0.09), 0.6);
  add(x, mul(lp(brown(sec, r), 600), ad(sec, 0.001, 0.12)), 0.6);
  stones(x, r, 4, 0.03, 0.2, 0.15, 1, 700, 1400);
  return done(sat(x, 1.6), 0.9);
}

function wave(r: Rng): Out {
  const sec = 2.6;
  const mk = () => {
    const e = env(sec, [[0, 0], [0.4, 1], [1.2, 0.6], [2.5, 0]]);
    const ef = (t: number) => e[Math.min(e.length - 1, Math.floor(t * SR))]!;
    const x = mul(lp(pink(sec, r), (t) => 250 + 3800 * ef(t) ** 1.5, 0.6), e);
    add(x, mul(hp(white(sec, r), 3000), env(sec, [[0, 0], [0.5, 0], [0.8, 1], [2.4, 0]])), 0.12);
    scatter(x, 18, 0.3, 2, r, () => drop(0.1, r, between(r, 300, 900)), () => between(r, 0.03, 0.1));
    return x;
  };
  return normS([fade(dcBlock(mk()), 0.01, 0.2), fade(dcBlock(mk()), 0.01, 0.2)], 0.9);
}

// --- Kampf: Signale -------------------------------------------------------------------------

function hornCall(r: Rng, notes: [number, number, number][], o: { bright?: number; growl?: number } = {}): Float32Array {
  const end = Math.max(...notes.map(([, t, d]) => t + d)) + 0.6;
  const x = buf(end);
  for (const [f, t, d] of notes) {
    add(x, brass(end, f, r, t, d, o), 1);
    add(x, brass(end, f * 1.5, r, t + 0.01, d, { ...o, bright: (o.bright ?? 1) * 0.7 }), 0.3);
  }
  return done(hp(x, 60), 0.85, 0.3);
}

function battleStart(r: Rng): Float32Array {
  const sec = 3.4;
  const x = buf(sec);
  const hits: [number, number, number][] = [
    [0, 58, 0.7],
    [0.36, 58, 0.55],
    [0.54, 64, 0.6],
    [0.9, 52, 1],
  ];
  for (const [t, f, g] of hits) add(x, drum(1.5, f, r), g, t);
  add(x, hornCall(r, [[110, 0.9, 0.35], [146.8, 1.3, 1.3]]), 0.8);
  return done(x, 0.95, 0.3);
}

function roundBanner(r: Rng): Float32Array {
  const sec = 1.8;
  const x = drum(sec, 55, r);
  add(x, drum(sec, 62, r), 0.5, 0.2);
  add(x, whoosh(sec, r, 200, 1500, 0, 0.5, 0.8), 0.3);
  return done(x, 0.9, 0.3);
}

function crumble(r: Rng): Out {
  const sec = 4.2;
  const mk = () => {
    const x = mul(lp(brown(sec, r), 100), env(sec, [[0, 0], [0.25, 1], [1.6, 0.7], [4, 0]]));
    stones(x, r, 70, 0.1, 2.4, 0.4, 1.3, 400, 1400);
    scatter(x, 12, 0.2, 2.2, r, () => thump(0.4, between(r, 110, 150), 50, 0.02, 0.2), () => between(r, 0.3, 0.7), 1.2);
    add(x, mul(bp(white(sec, r), 2500, 0.5), bell(sec, 0.2, 3.8, 1)), 0.05);
    return sat(x, 1.5);
  };
  return normS([fade(dcBlock(mk()), 0.01, 0.3), fade(dcBlock(mk()), 0.01, 0.3)], 0.95);
}

function victory(r: Rng): Float32Array {
  const sec = 4.2;
  const x = buf(sec);
  const C = 261.6;
  const notes: [number, number, number][] = [
    [C, 0, 0.17],
    [C * semi(4), 0.2, 0.17],
    [C * semi(7), 0.4, 0.17],
    [C * 2, 0.6, 1.7],
  ];
  for (const [f, t, d] of notes) add(x, brass(sec, f, r, t, d, { bend: -0.6, bright: 1.1 }), 0.6);
  for (const k of [1, semi(4), semi(7)]) add(x, brass(sec, C * k * 0.5, r, 0.6, 1.7, { bend: -0.3, bright: 0.6 }), 0.3);
  add(x, timpani(sec, 65.4, r), 0.8, 0.6);
  add(x, timpani(sec, 98, r), 0.5, 0.4);
  scatter(x, 14, 0.6, 1.6, r, () => glass(1, C * 4 * semi([0, 4, 7, 12][Math.floor(r() * 4)]!), r, 0.8), () => between(r, 0.05, 0.12));
  return done(hp(x, 50), 0.9, 0.5);
}

function defeat(r: Rng): Float32Array {
  const sec = 5;
  const x = buf(sec);
  const A = 110;
  add(x, brass(sec, A, r, 0, 1.1, { bend: -0.5, bright: 0.6 }), 0.7);
  add(x, brass(sec, A * semi(-1), r, 1.1, 0.9, { bend: -0.3, bright: 0.55 }), 0.7);
  add(x, brass(sec, A * semi(-5), r, 2.0, 2.2, { bend: -0.3, bright: 0.45, growl: 0.4 }), 0.8);
  for (const t of [0, 1.1, 2]) add(x, lp(drum(2, 48, r), 600), 0.7, t);
  add(x, bellTone(sec, 98, r, 3.5), 0.3, 2.0);
  return done(x, 0.9, 0.5);
}

// --- Oberfläche -----------------------------------------------------------------------------

function uiHover(r: Rng): Float32Array {
  const sec = 0.06;
  const x = glass(sec, between(r, 2400, 2900), r, 0.03);
  add(x, click(sec, r, 5000, 1, 0.001), 0.3);
  return done(x, 0.5, 0.01);
}

function uiClick(r: Rng): Float32Array {
  const sec = 0.12;
  const x = wood(sec, between(r, 950, 1150), r, 0.05);
  add(x, click(sec, r, 2600, 0.9, 0.0018), 0.9);
  add(x, thump(sec, 240, 130, 0.01, 0.035), 0.5);
  return done(x, 0.8, 0.02);
}

function uiConfirm(r: Rng): Float32Array {
  const sec = 0.8;
  const x = uiClick(r);
  const y = buf(sec);
  add(y, x);
  add(y, glass(sec, 659.3 * 2, r, 0.5), 0.3, 0.01);
  add(y, glass(sec, 987.8 * 2, r, 0.6), 0.3, 0.08);
  return done(y, 0.8, 0.2);
}

function cardDraw(r: Rng): Float32Array {
  const sec = 0.22;
  const x = mul(bp(white(sec, r), (t) => 2300 + 18000 * t, 0.7), bell(sec, 0, 0.16, 1));
  add(x, click(sec, r, 5000, 1, 0.0015), 0.4, 0.15);
  return done(x, 0.6);
}

function cardFlip(r: Rng): Float32Array {
  const sec = 0.14;
  const x = click(sec, r, 3500, 0.7, 0.003);
  add(x, click(sec, r, 2600, 0.7, 0.003), 0.7, between(r, 0.014, 0.022));
  add(x, whoosh(sec, r, 1500, 3500, 0, 0.07, 1), 0.5);
  return done(x, 0.6);
}

function cardPlace(r: Rng): Float32Array {
  const sec = 0.15;
  const x = mul(lp(white(sec, r), 900), ad(sec, 0.0008, 0.03));
  add(x, thump(sec, 180, 110, 0.01, 0.05), 0.5);
  add(x, click(sec, r, 4200, 1, 0.0012), 0.3);
  return done(x, 0.7);
}

function cardWhoosh(r: Rng): Float32Array {
  const sec = 0.35;
  return done(whoosh(sec, r, 500, 2600, 0, 0.3, 1.3), 0.6, 0.02);
}

function vsSlam(r: Rng): Float32Array {
  const sec = 2;
  const x = buf(sec);
  add(x, impactBig(r), 1);
  add(x, metal(sec, 330, r, 1.3, 0.5), 0.3);
  add(x, thump(sec, 75, 28, 0.1, 0.9), 0.8);
  return done(sat(x, 1.5), 0.95, 0.3);
}

function chime(r: Rng): Float32Array {
  const sec = 1.2;
  const f = 1046.5;
  const x = glass(sec, f, r, 0.9);
  add(x, glass(sec, f * 2, r, 0.5), 0.25, 0.03);
  add(x, whoosh(sec, r, 3000, 7000, 0, 0.3, 1), 0.08);
  return done(x, 0.7, 0.2);
}

function coins(r: Rng, n: number): Float32Array {
  const sec = 0.5 + n * 0.06;
  const x = buf(sec);
  let t = 0;
  for (let k = 0; k < n; k++) {
    add(x, coin(0.5, r), between(r, 0.4, 1) * (1 - k / (n * 1.5)), t);
    t += between(r, 0.02, 0.07) * (1 + k * 0.05);
  }
  return done(x, 0.8, 0.1);
}

function upgrade(r: Rng): Float32Array {
  const sec = 1.6;
  const x = buf(sec);
  const scale = [0, 2, 4, 7, 9, 12, 16];
  scale.forEach((s, i) => add(x, glass(sec, 784 * semi(s), r, 0.7), 0.4, i * 0.055));
  add(x, whoosh(sec, r, 800, 6000, 0, 0.5, 0.9), 0.25);
  return done(x, 0.8, 0.3);
}

function chestOpen(r: Rng): Float32Array {
  const sec = 2;
  const x = creak(sec, r, 0, 0.45, 55, 120);
  add(x, wood(sec, 240, r, 0.1), 0.8, 0.45);
  add(x, thump(sec, 160, 80, 0.02, 0.1), 0.5, 0.45);
  add(x, coins(r, 12), 0.7, 0.5);
  scatter(x, 10, 0.5, 1.2, r, () => glass(0.6, between(r, 2500, 5000), r, 0.3), () => between(r, 0.05, 0.12));
  return done(x, 0.85, 0.3);
}

function enchant(r: Rng): Float32Array {
  const sec = 2;
  const x = buf(sec);
  for (const k of [1, 1.26, 1.5, 2, 2.52]) {
    const f = 330 * k;
    add(x, mul(osc(sec, (t) => f * (1 + 0.25 * (1 - Math.exp(-t / 0.4))) * (1 + 0.003 * Math.sin(TAU * 5 * t)), 'tri'), env(sec, [[0, 0], [0.4, 1], [1.9, 0]])), 0.2);
  }
  add(x, whoosh(sec, r, 400, 5000, 0, 1, 0.7), 0.6);
  scatter(x, 18, 0.2, 1.3, r, () => glass(0.6, between(r, 2000, 6000), r, 0.35), () => between(r, 0.05, 0.14));
  return done(x, 0.8, 0.3);
}

function pyre(r: Rng): Float32Array {
  const sec = 2.4;
  const x = mul(lp(pink(sec, r), (t) => 300 + 2500 * Math.exp(-((t - 0.25) ** 2) / 0.05)), env(sec, [[0, 0], [0.25, 1], [1, 0.5], [2.3, 0]]));
  add(x, thump(sec, 90, 45, 0.05, 0.4), 0.5, 0.2);
  crackles(x, r, 80, 0.2, 2.2, 0.7, 1.3);
  return done(sat(x, 1.5), 0.85, 0.3);
}

function iris(r: Rng): Float32Array {
  const sec = 0.6;
  const x = whoosh(sec, r, 180, 700, 0, 0.55, 0.9, 1.2);
  add(x, mul(lp(brown(sec, r), 150), bell(sec, 0, 0.55)), 0.4);
  return done(x, 0.6, 0.05);
}

function harp(r: Rng): Float32Array {
  const sec = 1.4;
  const x = pluck(sec, 392, r, 0.55, 0.9985);
  const body = add(x, bp(x, 260, 2), 0.4);
  mul(body, ad(sec, 0.001, 1.3));
  return done(body, 0.7, 0.2);
}

// --- Atmosphäre (Endlosschleifen) ------------------------------------------------------------

const AMB = 16;
const AMB_XF = 2.5;

function wind(sec: number, r: Rng, lo: number, hi: number, gust = 0.18): Float32Array {
  const d = drift(sec, gust, r, 2);
  const x = bp(pink(sec, r), (t) => lo + (hi - lo) * d[Math.min(d.length - 1, Math.floor(t * SR))]!, 0.9);
  const g = drift(sec, gust * 1.3, r, 2);
  for (let i = 0; i < x.length; i++) x[i]! *= 0.35 + 0.65 * g[i]!;
  return x;
}

function rustle(sec: number, r: Rng, f = 3500, rate = 7): Float32Array {
  const x = hp(white(sec, r), f);
  const a = drift(sec, rate, r, 1);
  const b = drift(sec, 0.3, r, 1);
  for (let i = 0; i < x.length; i++) x[i]! *= Math.pow(a[i]!, 3) * b[i]!;
  return lp(x, 9000);
}

function ambience(r: Rng, world: string): Out {
  const sec = AMB + AMB_XF;
  const [L, R] = stereo(sec);
  const both = (mk: () => Float32Array, g: number) => {
    add(L, mk(), g);
    add(R, mk(), g);
  };
  switch (world) {
    case 'menu': {
      both(() => lp(brown(sec, r), 160), 0.25);
      // Kerzenflamme: leises, flatterndes Atmen
      both(() => {
        const x = lp(pink(sec, r), 500);
        const d = drift(sec, 3, r, 1);
        for (let i = 0; i < x.length; i++) x[i]! *= 0.3 + 0.7 * d[i]!;
        return x;
      }, 0.35);
      const c = buf(sec);
      crackles(c, r, 26, 0, sec, 0.35);
      panAdd(L, R, c, 0.1, 1);
      break;
    }
    case 'drifters':
      both(() => wind(sec, r, 300, 900), 0.7);
      both(() => rustle(sec, r, 3000, 5), 0.15);
      scatter(L, 2, 1, sec - 2, r, () => lp(birdCall(r), 5000), () => 0.04);
      break;
    case 'ashclan': {
      both(() => wind(sec, r, 150, 450, 0.12), 0.6);
      both(() => {
        const x = lp(brown(sec, r), 350);
        const d = drift(sec, 2, r, 1);
        for (let i = 0; i < x.length; i++) x[i]! *= 0.5 + 0.5 * d[i]!;
        return x;
      }, 0.5);
      const c = buf(sec);
      crackles(c, r, 90, 0, sec, 0.5);
      const [a, b] = widen(c, 7);
      add(L, a, 0.8);
      add(R, b, 0.8);
      break;
    }
    case 'wildwood': {
      both(() => rustle(sec, r, 2200, 6), 0.3);
      both(() => wind(sec, r, 400, 1200, 0.1), 0.25);
      for (let k = 0; k < 9; k++) {
        const call = lp(birdCall(r), 7000);
        panAdd(L, R, call, between(r, -0.9, 0.9), between(r, 0.05, 0.12), between(r, 0.3, sec - 1));
      }
      break;
    }
    case 'tidebound': {
      for (const ch of [L, R]) {
        for (let k = 0; k < 4; k++) {
          const w = 5.5;
          const e = env(w, [[0, 0], [2, 1], [2.8, 0.8], [w, 0]]);
          const ef = (t: number) => e[Math.min(e.length - 1, Math.floor(t * SR))]!;
          const x = mul(lp(pink(w, r), (t) => 300 + 2400 * ef(t) ** 2, 0.6), e);
          add(ch, x, 0.9, k * 4 + between(r, 0, 1.2));
        }
        add(ch, lp(brown(sec, r), 200), 0.3);
      }
      break;
    }
    case 'sunlegion': {
      both(() => wind(sec, r, 500, 1300, 0.1), 0.35);
      for (const ch of [L, R]) {
        const c = bp(white(sec, r), between(r, 4600, 5600), 7);
        const pulse = osc(sec, between(r, 38, 48), 'sine');
        const phrase = drift(sec, 0.25, r, 2);
        for (let i = 0; i < c.length; i++) c[i]! *= (0.5 + 0.5 * pulse[i]!) ** 2 * Math.max(0, phrase[i]! * 1.6 - 0.5);
        add(ch, c, 0.5);
      }
      break;
    }
    case 'plague': {
      const drone = buf(sec);
      for (const f of [55, 55.4, 82.6, 110.3]) add(drone, osc(sec, f, 'saw', r()), 0.25);
      const d = lp(drone, 260, 0.8);
      add(L, d, 0.5);
      add(R, d, 0.45);
      // Fliegen
      for (let k = 0; k < 2; k++) {
        const wob = drift(sec, 4, r, 1);
        const fly = osc(sec, (t) => 180 + 60 * wob[Math.min(wob.length - 1, Math.floor(t * SR))]!, 'saw');
        const near = drift(sec, 0.3, r, 2);
        const y = bp(fly, 450, 1);
        for (let i = 0; i < y.length; i++) y[i]! *= Math.max(0, near[i]! * 1.8 - 0.8);
        panAdd(L, R, y, k ? 0.6 : -0.6, 0.12);
      }
      const drips = buf(sec);
      scatter(drips, 6, 0.5, sec - 1, r, () => echo(drop(0.6, r, 800), 0.09, 0.4, 3, 2500), () => between(r, 0.1, 0.25));
      panAdd(L, R, drips, -0.3, 1);
      break;
    }
    case 'deepforge': {
      both(() => lp(brown(sec, r), 90), 0.5);
      both(() => wind(sec, r, 120, 300, 0.08), 0.25);
      for (let k = 0; k < 3; k++) {
        const t = k * (sec / 3) + between(r, 0.3, 1.5);
        const hit = () => echo(lp(metal(2.5, 820, r, 1.4, 0.6), 2800), 0.23, 0.35, 3, 1800);
        panAdd(L, R, hit(), between(r, -0.8, 0.8), 0.12, t);
        panAdd(L, R, hit(), between(r, -0.8, 0.8), 0.08, t + 0.42);
      }
      const drips = buf(sec);
      scatter(drips, 8, 0.3, sec - 1, r, () => echo(drop(0.8, r, 1000), 0.14, 0.45, 4, 2500), () => between(r, 0.08, 0.2));
      panAdd(L, R, drips, 0.35, 1);
      break;
    }
  }
  return normS(loopS([L, R], AMB_XF), 0.55);
}

// --- Schlachtenlärm (Endlosschleifen, Lautstärke folgt der Kampfdichte) ------------------------

const BED = 8;

function bedMelee(r: Rng): Out {
  const sec = BED + 1.5;
  const [L, R] = stereo(sec);
  for (let k = 0; k < 90; k++) {
    const f0 = between(r, 1400, 3600);
    const s = add(metal(0.35, f0, r, between(r, 0.06, 0.18), 0.6), click(0.35, r, 4000, 0.9, 0.0015), 0.7);
    panAdd(L, R, s, between(r, -0.8, 0.8), between(r, 0.1, 0.5) ** 1.5, between(r, 0, sec - 0.4));
  }
  for (let k = 0; k < 140; k++) {
    const s = mul(lp(brown(0.2, r), 500), ad(0.2, 0.001, 0.06));
    panAdd(L, R, s, between(r, -0.8, 0.8), between(r, 0.2, 0.8), between(r, 0, sec - 0.3));
  }
  return normS(loopS([lp(L, 7500), lp(R, 7500)], 1.5), 0.6);
}

function bedMarch(r: Rng): Out {
  const sec = BED + 1.5;
  const [L, R] = stereo(sec);
  for (let k = 0; k < 360; k++) {
    const s = add(mul(lp(brown(0.15, r), 300), ad(0.15, 0.002, 0.05)), thump(0.15, 120, 70, 0.01, 0.04), 0.3);
    panAdd(L, R, s, between(r, -0.9, 0.9), between(r, 0.2, 0.6), between(r, 0, sec - 0.2));
  }
  for (let k = 0; k < 120; k++) panAdd(L, R, metal(0.1, between(r, 3500, 6000), r, 0.03, 0.4), between(r, -0.9, 0.9), 0.03, between(r, 0, sec - 0.2));
  add(L, lp(brown(sec, r), 110), 0.4);
  add(R, lp(brown(sec, r), 110), 0.4);
  return normS(loopS([L, R], 1.5), 0.6);
}

function bedArrows(r: Rng): Out {
  const sec = BED + 1.5;
  const [L, R] = stereo(sec);
  for (let k = 0; k < 70; k++) {
    const d = between(r, 0.15, 0.3);
    const w = whoosh(d + 0.05, r, between(r, 2500, 4000), between(r, 900, 1500), 0, d, 2, 1.3);
    panAdd(L, R, w, between(r, -0.8, 0.8), between(r, 0.2, 0.7), between(r, 0, sec - 0.35));
  }
  return normS(loopS([L, R], 1.5), 0.55);
}

// --- Rezeptbuch -----------------------------------------------------------------------------

const worlds = ['menu', 'drifters', 'ashclan', 'wildwood', 'tidebound', 'sunlegion', 'plague', 'deepforge'];

export const RECIPES: Record<string, Recipe> = {
  // Oberfläche
  hover: { n: 3, bus: 'ui', vol: 0.12, gap: 40, max: 2, gen: uiHover },
  click: { n: 3, bus: 'ui', vol: 0.45, gap: 30, max: 3, gen: uiClick },
  confirm: { n: 2, bus: 'ui', vol: 0.5, gap: 60, send: 0.15, gen: uiConfirm },
  card_draw: { n: 4, bus: 'ui', vol: 0.5, max: 3, gen: cardDraw },
  card_flip: { n: 4, bus: 'ui', vol: 0.5, max: 4, gen: cardFlip },
  card_place: { n: 4, bus: 'ui', vol: 0.6, max: 3, gen: cardPlace },
  card_whoosh: { n: 3, bus: 'ui', vol: 0.4, max: 4, gen: cardWhoosh },
  vs: { n: 1, bus: 'ui', vol: 0.8, send: 0.35, gen: vsSlam },
  chime: { n: 1, bus: 'ui', vol: 0.4, send: 0.3, max: 4, gen: chime },
  coin: { n: 5, bus: 'ui', vol: 0.3, gap: 30, max: 4, gen: (r) => done(coin(0.6, r), 0.8, 0.1) },
  coins: { n: 3, bus: 'ui', vol: 0.5, gap: 80, gen: (r) => coins(r, 10) },
  upgrade: { n: 2, bus: 'ui', vol: 0.5, send: 0.3, gen: upgrade },
  chest: { n: 1, bus: 'ui', vol: 0.7, send: 0.2, gen: chestOpen },
  enchant: { n: 1, bus: 'ui', vol: 0.6, send: 0.4, gen: enchant },
  pyre: { n: 1, bus: 'ui', vol: 0.7, send: 0.2, gen: pyre },
  iris: { n: 2, bus: 'ui', vol: 0.35, gap: 200, gen: iris },
  harp: { n: 2, bus: 'ui', vol: 0.4, send: 0.3, max: 4, gen: harp },
  victory: { n: 1, bus: 'ui', vol: 0.75, send: 0.35, gen: victory },
  defeat: { n: 1, bus: 'ui', vol: 0.75, send: 0.4, gen: defeat },
  // Kampf
  clash: { n: 8, bus: 'sfx', vol: 0.32, gap: 65, max: 6, send: 0.12, gen: clash },
  thud: { n: 6, bus: 'sfx', vol: 0.45, gap: 60, max: 6, gen: thud },
  impact: { n: 3, bus: 'sfx', vol: 0.6, gap: 80, max: 3, send: 0.15, gen: impactBig },
  bow: { n: 5, bus: 'sfx', vol: 0.3, gap: 70, max: 4, gen: bow },
  arrow_hit: { n: 4, bus: 'sfx', vol: 0.3, gap: 70, max: 4, gen: arrowHit },
  cast: { n: 4, bus: 'sfx', vol: 0.3, gap: 90, max: 3, send: 0.25, gen: cast },
  spark: { n: 4, bus: 'sfx', vol: 0.25, gap: 90, max: 3, send: 0.15, gen: spark },
  chain: { n: 3, bus: 'sfx', vol: 0.5, gap: 150, max: 2, send: 0.25, gen: chainLightning },
  sunbeam: { n: 2, bus: 'sfx', vol: 0.45, gap: 200, max: 2, send: 0.3, gen: sunbeam },
  cannon: { n: 3, bus: 'sfx', vol: 0.7, gap: 120, max: 3, send: 0.3, gen: cannon },
  launch: { n: 3, bus: 'sfx', vol: 0.4, gap: 120, max: 3, gen: siegeLaunch },
  rock: { n: 4, bus: 'sfx', vol: 0.55, gap: 70, max: 4, send: 0.2, gen: (r) => boomRock(r, false) },
  boulder: { n: 3, bus: 'sfx', vol: 0.75, gap: 100, max: 3, send: 0.3, gen: (r) => boomRock(r, true) },
  fire: { n: 4, bus: 'sfx', vol: 0.55, gap: 80, max: 4, send: 0.2, gen: (r) => boomFire(r) },
  frost: { n: 3, bus: 'sfx', vol: 0.45, gap: 80, max: 3, send: 0.35, gen: frost },
  whirl: { n: 3, bus: 'sfx', vol: 0.4, gap: 120, max: 2, gen: whirl },
  roots: { n: 2, bus: 'sfx', vol: 0.6, gap: 200, max: 2, send: 0.2, gen: roots },
  bloat: { n: 3, bus: 'sfx', vol: 0.45, gap: 70, max: 3, gen: bloat },
  spore: { n: 2, bus: 'sfx', vol: 0.35, gap: 70, max: 3, gen: spore },
  colossus: { n: 1, bus: 'sfx', vol: 0.9, gap: 400, max: 1, send: 0.35, gen: colossus },
  meteor: { n: 2, bus: 'sfx', vol: 0.8, gap: 150, max: 2, send: 0.35, gen: meteor },
  aura_moon: { n: 2, bus: 'sfx', vol: 0.3, gap: 250, max: 2, send: 0.5, gen: (r) => aura(r, 587, [1, 1.19, 1.5, 2], 0.8) },
  aura_bless: { n: 2, bus: 'sfx', vol: 0.3, gap: 250, max: 2, send: 0.5, gen: (r) => aura(r, 784, [1, 1.26, 1.5, 2], 1) },
  aura_mend: { n: 2, bus: 'sfx', vol: 0.28, gap: 250, max: 2, send: 0.4, gen: (r) => aura(r, 440, [1, 1.5, 2], 0.6) },
  spawn: { n: 4, bus: 'sfx', vol: 0.25, gap: 60, max: 3, send: 0.2, gen: spawn },
  spawn_undead: { n: 3, bus: 'sfx', vol: 0.35, gap: 120, max: 2, send: 0.35, gen: spawnUndead },
  death: { n: 6, bus: 'sfx', vol: 0.4, gap: 70, max: 6, gen: death },
  death_big: { n: 3, bus: 'sfx', vol: 0.65, gap: 90, max: 3, send: 0.2, gen: deathBig },
  death_boss: { n: 1, bus: 'sfx', vol: 0.9, max: 1, send: 0.5, gen: deathBoss },
  death_fly: { n: 3, bus: 'sfx', vol: 0.35, gap: 80, max: 2, gen: deathFly },
  base_hit: { n: 4, bus: 'sfx', vol: 0.45, gap: 60, max: 4, send: 0.2, gen: baseHit },
  wave: { n: 1, bus: 'sfx', vol: 0.7, gap: 500, send: 0.3, gen: wave },
  crumble: { n: 1, bus: 'sfx', vol: 0.85, send: 0.35, gen: crumble },
  battle_start: { n: 1, bus: 'sfx', vol: 0.8, send: 0.35, gen: battleStart },
  round: { n: 1, bus: 'sfx', vol: 0.7, send: 0.3, gen: roundBanner },
  horn_last: { n: 1, bus: 'sfx', vol: 0.7, gap: 800, send: 0.4, gen: (r) => hornCall(r, [[146.8, 0, 0.3], [146.8, 0.4, 0.3], [196, 0.8, 1.2]], { bright: 1.1 }) },
  horn_foe: { n: 1, bus: 'sfx', vol: 0.55, gap: 800, send: 0.45, gen: (r) => hornCall(r, [[87.3, 0, 1.6]], { bright: 0.7, growl: 0.8 }) },
  horn_good: { n: 1, bus: 'sfx', vol: 0.6, send: 0.4, gen: (r) => hornCall(r, [[146.8, 0, 0.25], [220, 0.3, 0.9]]) },
  horn_bad: { n: 1, bus: 'sfx', vol: 0.55, send: 0.45, gen: (r) => hornCall(r, [[110, 0, 0.5], [103.8, 0.55, 1]], { bright: 0.6 }) },
  deploy: { n: 1, bus: 'sfx', vol: 0.45, send: 0.4, gen: (r) => done(add(whoosh(1.6, r, 200, 3000, 0, 1.4, 0.8, 1.2), lp(pink(1.6, r), 300), 0.1), 0.8, 0.2) },
  // Schleifen
  bed_melee: { n: 1, bus: 'sfx', vol: 0.55, loop: true, gen: bedMelee },
  bed_march: { n: 1, bus: 'sfx', vol: 0.32, loop: true, gen: bedMarch },
  bed_arrows: { n: 1, bus: 'sfx', vol: 0.4, loop: true, gen: bedArrows },
};

for (const w of worlds) RECIPES[`amb_${w}`] = { n: 1, bus: 'amb', vol: 1, loop: true, lazy: true, gen: (r) => ambience(r, w) };

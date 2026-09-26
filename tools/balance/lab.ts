// =====================================================================
// Balance-Labor: rechnet tausende Kämpfe parallel (worker_threads) und
// wertet sie aus. Aufruf:  node tools/balance/run-one.mjs lab.ts <experiment>
//   cards    – Stärke jeder Karte (logistische Bewertung aus Zufallspaaren)
//   bonus    – Wert jedes Rassen- und Klassenbonus
//   champs   – Champions gegen normale Paare
//   curve    – Schwierigkeit eines ganzen Runs Welt für Welt (inkl. Bosse)
// =====================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { Worker, isMainThread, parentPort } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { BOSSES, CARDS2, cardByName, newMods, type Card2, type Mods, type RaceId } from '../../src/c2/data';
import type { Deployed, SideSpec } from '../../src/c2/sim/arena';
import { REGULAR, CHAMPIONS, simBattle, simRound, type PlayerCard } from '../../src/c2/sim/balance';
import { startingDeck } from '../../src/c2/run';

// --- Aufgaben (serialisierbar) ---------------------------------------------------------

interface Slot {
  name: string;
  stars: number;
  count?: number;
}
interface Side {
  front: Slot;
  back: Slot;
  power?: number;
  mods?: Mods;
  bonus?: { race?: boolean; cls?: boolean };
}
/** Kartenwerte während der Kalibrierung: Name → [HP-, Schaden-, Truppen-Faktor] */
type Scales = Record<string, [number, number, number]>;
type Task =
  | { kind: 'round'; a: Side; b: Side; seed: number; boss?: RaceId; scales?: Scales }
  | {
      kind: 'battle';
      deck: [string, number][];
      mods: Mods;
      playerCastle: number;
      enemyDeck: string[];
      enemyStars: number;
      enemyPower: number;
      enemyCastle: number;
      boss?: RaceId;
      bossPower?: number;
      seed: number;
    };

let troopF: Record<string, number> = {};
/** Truppenzahl folgt der Kalibrierung (die Zahl im Auftrag stammt vom unveränderten Kartenwert) */
const dep = (s: Slot): Deployed => ({ card: cardByName(s.name), stars: s.stars, count: s.count === undefined ? undefined : Math.max(1, Math.round(s.count * (troopF[s.name] ?? 1))) });
const spec = (s: Side, team: number): SideSpec => ({ front: dep(s.front), back: dep(s.back), mods: s.mods, baseHp: team === 0 ? 1 : 0, power: s.power ?? 1, bonus: s.bonus });

const BASE = new Map(CARDS2.map((c) => [c.name, { hp: c.hp, dmg: c.dmg, troops: c.troops }]));
let applied = '';
function applyScales(sc: Scales | undefined): void {
  const key = JSON.stringify(sc ?? {});
  if (key === applied) return;
  applied = key;
  troopF = Object.fromEntries(Object.entries(sc ?? {}).map(([k, v]) => [k, v[2]]));
  for (const c of CARDS2 as Card2[]) {
    const b = BASE.get(c.name)!;
    const f = sc?.[c.name] ?? [1, 1, 1];
    c.hp = b.hp * f[0];
    c.dmg = b.dmg * f[1];
    c.troops = Math.max(1, b.troops * f[2]);
  }
}

function runTask(t: Task): unknown {
  applyScales(t.kind === 'round' ? t.scales : undefined);
  if (t.kind === 'round') return simRound(spec(t.a, 0), spec(t.b, 1), t.seed, t.boss ? BOSSES[t.boss] : null);
  return simBattle({
    deck: t.deck.map(([n, s]) => ({ card: cardByName(n), stars: s })),
    mods: t.mods,
    playerCastle: t.playerCastle,
    enemyDeck: t.enemyDeck.map(cardByName),
    enemyStars: t.enemyStars,
    enemyPower: t.enemyPower,
    enemyCastle: t.enemyCastle,
    boss: t.boss ? BOSSES[t.boss] : null,
    bossPower: t.bossPower,
    seed: t.seed,
  });
}


// --- Parallel rechnen ----------------------------------------------------------------------

async function pool<R>(tasks: Task[], label = ''): Promise<R[]> {
  const n = Math.max(1, cpus().length - 1);
  const file = fileURLToPath(import.meta.url);
  const workers = Array.from({ length: n }, () => new Worker(file));
  const out = new Array<R>(tasks.length);
  let next = 0;
  let done = 0;
  const t0 = Date.now();
  await new Promise<void>((resolve) => {
    const feed = (w: Worker) => {
      if (next >= tasks.length) return;
      const id = next++;
      w.postMessage({ id, task: tasks[id] });
    };
    for (const w of workers) {
      w.on('message', (m: { id: number; res: R }) => {
        out[m.id] = m.res;
        done++;
        if (done % 200 === 0) process.stderr.write(`\r${label} ${done}/${tasks.length} (${((Date.now() - t0) / 1000).toFixed(0)} s)   `);
        if (done === tasks.length) resolve();
        else feed(w);
      });
      feed(w);
    }
  });
  process.stderr.write('\n');
  await Promise.all(workers.map((w) => w.terminate()));
  return out;
}

// --- Hilfen --------------------------------------------------------------------------------

let seed = 12345;
const rnd = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const pick = <T>(a: readonly T[]) => a[Math.floor(rnd() * a.length)]!;
const avgCount = (c: Card2) => (c.troops <= 1 ? 1 : Math.round(c.troops * 0.775));
const MELEE = new Set(['Infantry', 'Cavalry', 'Beast', 'Swarm', 'Champion']);
const order = (a: Card2, b: Card2): [Card2, Card2] => (MELEE.has(b.cls) && !MELEE.has(a.cls) ? [b, a] : [a, b]);
const side = (a: Card2, b: Card2, stars = 1, extra: Partial<Side> = {}): Side => {
  const [f, k] = order(a, b);
  return { front: { name: f.name, stars, count: avgCount(f) }, back: { name: k.name, stars, count: avgCount(k) }, ...extra };
};
const noBonus = (a: Card2, b: Card2) => a.race !== b.race && a.cls !== b.cls;
const fmt = (x: number, d = 2) => (x >= 0 ? ' ' : '') + x.toFixed(d);

/**
 * Logistische Bewertung: P(A gewinnt) = σ(Σ Stärke A − Σ Stärke B).
 * `feats` je Kampf: Liste [Index, Vorzeichen]; y = 1 wenn A gewinnt.
 */
function logistic(n: number, rows: { f: [number, number][]; y: number }[], iters = 400, l2 = 0.02): number[] {
  const w = new Array<number>(n).fill(0);
  for (let it = 0; it < iters; it++) {
    const g = new Array<number>(n).fill(0);
    for (const r of rows) {
      let z = 0;
      for (const [i, s] of r.f) z += w[i]! * s;
      const p = 1 / (1 + Math.exp(-z));
      for (const [i, s] of r.f) g[i]! += (r.y - p) * s;
    }
    for (let i = 0; i < n; i++) w[i]! += (0.5 * g[i]!) / (rows.length / 8) - l2 * w[i]! * 0.01;
  }
  return w;
}

// --- Experimente ---------------------------------------------------------------------------

async function cards(n = 3000): Promise<void> {
  const tasks: Task[] = [];
  const meta: [Card2, Card2, Card2, Card2][] = [];
  while (tasks.length < n) {
    const a = pick(REGULAR);
    const b = pick(REGULAR);
    const c = pick(REGULAR);
    const d = pick(REGULAR);
    if (a === b || c === d || !noBonus(a, b) || !noBonus(c, d)) continue;
    tasks.push({ kind: 'round', a: side(a, b), b: side(c, d), seed: Math.floor(rnd() * 1e9) });
    meta.push([a, b, c, d]);
  }
  const res = await pool<{ winner: number; castleDmg: [number, number]; time: number }>(tasks, 'cards');
  const idx = new Map(REGULAR.map((c, i) => [c.name, i]));
  const rows = res
    .map((r, k) => {
      const [a, b, c, d] = meta[k]!;
      return { f: [[idx.get(a.name)!, 1], [idx.get(b.name)!, 1], [idx.get(c.name)!, -1], [idx.get(d.name)!, -1]] as [number, number][], y: r.winner === 0 ? 1 : r.winner === 1 ? 0 : 0.5 };
    });
  const w = logistic(REGULAR.length, rows);
  const mean = w.reduce((s, x) => s + x, 0) / w.length;
  const wins = REGULAR.map(() => [0, 0]);
  rows.forEach((r) => r.f.forEach(([i, s]) => { wins[i]![1]!++; wins[i]![0]! += s > 0 ? r.y : 1 - r.y; }));
  const times = res.map((r) => r.time);
  console.log(`\nKarten-Stärke (logit, 0 = Durchschnitt), ${n} Runden, Ø Rundendauer ${(times.reduce((s, x) => s + x, 0) / times.length).toFixed(1)} s`);
  REGULAR.map((c, i) => ({ c, r: w[i]! - mean, wr: wins[i]![0]! / wins[i]![1]! }))
    .sort((x, y) => y.r - x.r)
    .forEach(({ c, r, wr }) => console.log(`${c.name.padEnd(18)} ${c.race.padEnd(10)} ${c.cls.padEnd(9)} ${fmt(r)}  win ${(wr * 100).toFixed(0)}%`));
  console.log('JSON ' + JSON.stringify(Object.fromEntries(REGULAR.map((c, i) => [c.name, +(w[i]! - mean).toFixed(3)]))));
}

/** Wert eines Bonus: gleiches Paar mit und ohne Bonus gegen dieselben Gegner. */
async function bonus(per = 160): Promise<void> {
  const tasks: Task[] = [];
  const meta: { key: string; on: boolean }[] = [];
  const races = [...new Set(REGULAR.map((c) => c.race))];
  const classes = [...new Set(REGULAR.map((c) => c.cls))];
  const add = (key: string, a: Card2, b: Card2, which: 'race' | 'cls') => {
    let c: Card2, d: Card2;
    do {
      c = pick(REGULAR);
      d = pick(REGULAR);
    } while (c === d || !noBonus(c, d));
    const s = Math.floor(rnd() * 1e9);
    const opp = side(c, d);
    for (const on of [true, false]) {
      tasks.push({ kind: 'round', a: side(a, b, 1, { bonus: { [which]: on } }), b: opp, seed: s });
      meta.push({ key, on });
    }
  };
  for (const r of races) {
    const pool = REGULAR.filter((c) => c.race === r);
    for (let k = 0; k < per; k++) {
      const a = pick(pool);
      let b = pick(pool);
      if (pool.length > 1) while (b === a) b = pick(pool);
      add(`race ${r}`, a, b, 'race');
    }
  }
  for (const cl of classes) {
    const pool = REGULAR.filter((c) => c.cls === cl);
    for (let k = 0; k < per; k++) add(`class ${cl}`, pick(pool), pick(pool), 'cls');
  }
  const res = await pool<{ winner: number }>(tasks, 'bonus');
  const agg = new Map<string, { on: number; off: number; n: number }>();
  res.forEach((r, k) => {
    const m = meta[k]!;
    const a = agg.get(m.key) ?? { on: 0, off: 0, n: 0 };
    const y = r.winner === 0 ? 1 : r.winner === 1 ? 0 : 0.5;
    if (m.on) a.on += y;
    else {
      a.off += y;
      a.n++;
    }
    agg.set(m.key, a);
  });
  const logit = (p: number) => Math.log(Math.max(0.01, Math.min(0.99, p)) / (1 - Math.max(0.01, Math.min(0.99, p))));
  console.log('\nBonus-Wert (Sieg mit / ohne, Differenz in logit)');
  [...agg.entries()]
    .map(([k, a]) => ({ k, on: a.on / a.n, off: a.off / a.n, d: logit(a.on / a.n) - logit(a.off / a.n) }))
    .sort((x, y) => y.d - x.d)
    .forEach(({ k, on, off, d }) => console.log(`${k.padEnd(18)} ${(on * 100).toFixed(0).padStart(3)}% / ${(off * 100).toFixed(0).padStart(3)}%  ${fmt(d)}`));
}

/** Champion + normale Karte gegen zwei normale Karten. */
async function champs(per = 120): Promise<void> {
  const tasks: Task[] = [];
  const meta: string[] = [];
  for (const ch of CHAMPIONS)
    for (let k = 0; k < per; k++) {
      let a: Card2, c: Card2, d: Card2;
      do {
        a = pick(REGULAR);
        c = pick(REGULAR);
        d = pick(REGULAR);
      } while (c === d || !noBonus(ch, a) || !noBonus(c, d));
      tasks.push({ kind: 'round', a: side(ch, a), b: side(c, d), seed: Math.floor(rnd() * 1e9) });
      meta.push(ch.name);
    }
  // Vergleich: normale Karte statt Champion
  for (let k = 0; k < per; k++) {
    let a: Card2, b: Card2, c: Card2, d: Card2;
    do {
      a = pick(REGULAR);
      b = pick(REGULAR);
      c = pick(REGULAR);
      d = pick(REGULAR);
    } while (a === b || c === d || !noBonus(a, b) || !noBonus(c, d));
    tasks.push({ kind: 'round', a: side(a, b), b: side(c, d), seed: Math.floor(rnd() * 1e9) });
    meta.push('(normale Karte)');
  }
  const res = await pool<{ winner: number }>(tasks, 'champs');
  const agg = new Map<string, [number, number]>();
  res.forEach((r, k) => {
    const a = agg.get(meta[k]!) ?? [0, 0];
    a[0] += r.winner === 0 ? 1 : r.winner === 1 ? 0 : 0.5;
    a[1]++;
    agg.set(meta[k]!, a);
  });
  console.log('\nChampion + Karte gegen 2 Karten (Siegquote)');
  for (const [k, [w, n]] of agg) console.log(`${k.padEnd(18)} ${((w / n) * 100).toFixed(0)}%`);
}

// --- Run-Kurve -------------------------------------------------------------------------------

/**
 * Typischer Spielerstand je Welt (Annahme aus dem Belohnungsfluss):
 * Welt 1 = Startdeck, danach mehr Sterne, ein paar Karten und Enchantments.
 */
function playerAt(world: number, colors: RaceId[]): { deck: [string, number][]; mods: Mods; castle: number } {
  const pool = REGULAR.filter((c) => colors.includes(c.race));
  const deck: [string, number][] = startingDeck(colors, rnd).map((c) => [c.name, 1]);
  // gekaufte Karten / Boss-Karten
  const bought = [0, 2, 3, 4][world - 1]!;
  for (let i = 0; i < bought; i++) deck.push([pick(i % 3 === 2 ? CARDS2.filter((c) => colors.includes(c.race)) : pool).name, 1]);
  // Aufwertungen: ~2 pro Welt
  const ups = [0, 3, 6, 10][world - 1]!;
  for (let i = 0; i < ups; i++) {
    const d = deck.filter((x) => x[1] < 3);
    if (d.length) pick(d)[1]++;
  }
  const mods = newMods();
  const ench = [0, 1, 2, 3][world - 1]!;
  // durchschnittliches Enchantment: ~ +12 % auf einen Kampfwert
  for (let i = 0; i < ench; i++) {
    const k = i % 3;
    if (k === 0) mods.dmgMul *= 1.12;
    else if (k === 1) mods.hpMul *= 1.14;
    else mods.troopMul *= 1.16;
  }
  return { deck, mods, castle: 300 };
}

async function curve(per = 60): Promise<void> {
  // Run-Parameter wie in run.ts (hier gespiegelt, damit Varianten testbar sind)
  const { Run } = await import('../../src/c2/run');
  const tasks: Task[] = [];
  const meta: string[] = [];
  const bossMeta: Record<number, string> = {};
  const races: RaceId[] = ['ashclan', 'wildwood', 'tidebound', 'sunlegion', 'plague', 'deepforge', 'drifters'];
  for (let world = 1; world <= 4; world++) {
    for (let k = 0; k < per; k++) {
      const colors = [...races].sort(() => rnd() - 0.5).slice(0, 3);
      const p = playerAt(world, colors);
      const run = new Run(colors, 1 + Math.floor(rnd() * 1e5));
      run.worldNo = world;
      const boss: RaceId = world === 1 ? 'drifters' : pick(races.filter((r) => r !== 'drifters' && (r !== 'plague' || world >= 3)));
      run.world = boss;
      const starsOpts = world === 1 ? [1] : world === 2 ? [1, 2, 3] : world === 3 ? [2, 3, 4] : [3, 4, 5];
      const st = pick(starsOpts);
      const base = { kind: 'battle' as const, deck: p.deck, mods: p.mods, playerCastle: p.castle, enemyDeck: run.enemyDeck().map((c) => c.name), enemyStars: run.enemyStars(), bossPower: run.bossPower(), seed: Math.floor(rnd() * 1e9) };
      tasks.push({ ...base, enemyPower: run.enemyPower(st), enemyCastle: run.enemyCastle(st, false) });
      meta.push(`W${world} Kampf`);
      if (k % 2 === 0) {
        const bs = starsOpts[starsOpts.length - 1]!;
        tasks.push({ ...base, enemyPower: run.enemyPower(bs, true), enemyCastle: run.enemyCastle(bs, true), boss });
        meta.push(`W${world} Boss`);
        bossMeta[tasks.length - 1] = boss;
      }
    }
  }
  const res = await pool<{ won: boolean; rounds: number; time: number; castleLeft: number; dealt: number; taken: number }>(tasks, 'curve');
  const agg = new Map<string, { w: number; n: number; r: number; t: number; c: number; d: number; k: number }>();
  const perBoss = new Map<string, [number, number]>();
  res.forEach((r, k) => {
    const b = bossMeta[k];
    if (b) {
      const pb = perBoss.get(b) ?? [0, 0];
      pb[0] += r.won ? 1 : 0;
      pb[1]++;
      perBoss.set(b, pb);
    }
    const a = agg.get(meta[k]!) ?? { w: 0, n: 0, r: 0, t: 0, c: 0, d: 0, k: 0 };
    a.d += r.dealt / r.rounds;
    a.k += r.taken / r.rounds;
    a.w += r.won ? 1 : 0;
    a.n++;
    a.r += r.rounds;
    a.t += r.time;
    a.c += r.castleLeft;
    agg.set(meta[k]!, a);
  });
  console.log('\nRun-Kurve: Siegquote, Runden, Spielzeit (Minuten), eigene Burg übrig');
  console.log('Bosse: ' + [...perBoss].map(([b, [w, n]]) => `${b} ${((w / n) * 100).toFixed(0)}% (${n})`).join(', '));
  for (const [k, a] of agg) console.log(`${k.padEnd(12)} win ${((a.w / a.n) * 100).toFixed(0).padStart(3)}%  Runden ${(a.r / a.n).toFixed(1)}  Zeit ${(a.t / a.n / 60).toFixed(1)} min  Burg ${((a.c / a.n) * 100).toFixed(0)}%  Schaden/Runde ${(a.d / a.n).toFixed(0)} / ${(a.k / a.n).toFixed(0)}`);
}

/**
 * Kalibrierung: misst die Stärke aller Karten (Champions mit Zielwert
 * CHAMP_TARGET über dem Durchschnitt) und skaliert HP/Schaden, bis alle
 * gleich stark sind. Stärkungen gehen mehr auf Schaden, Schwächungen mehr
 * auf HP – so werden Kämpfe eher kürzer.
 */
const CHAMP_TARGET = 0.9;
const LOGS_FILE = fileURLToPath(new URL('./calib-state.json', import.meta.url));

/**
 * Stellschraube je Karte. v > 0 = stärker. Massenkarten werden über die
 * Truppenzahl geschwächt (Einzelwerte bleiben), schwache Karten bekommen
 * bessere Einzelwerte; Heiler über die Truppenzahl; Belagerung/Champions
 * über HP und Schaden.
 */
function lever(c: Card2, v: number): [number, number, number] {
  // Feinschliff: Truppenzahl (fein abstufbar); Belagerung und Champions über HP/Schaden
  if (c.cls === 'Siege' || c.cls === 'Champion') return v > 0 ? [Math.exp(v * 0.45), Math.exp(v * 0.55), 1] : [Math.exp(v * 0.55), Math.exp(v * 0.45), 1];
  return [1, 1, Math.exp(v * 0.6)];
}
async function calibrate(iters = 5, n = 2400): Promise<void> {
  const all = [...REGULAR, ...CHAMPIONS];
  const logS = new Map(all.map((c) => [c.name, 0]));
  // an einem gespeicherten Zwischenstand weitermachen
  try {
    const saved = JSON.parse(readFileSync(LOGS_FILE, 'utf8')) as Record<string, number>;
    for (const [k, v] of Object.entries(saved)) if (logS.has(k)) logS.set(k, v);
    console.log('Zwischenstand geladen');
  } catch {
    /* frisch beginnen */
  }
  const scales = (): Scales => {
    const o: Scales = {};
    for (const c of all) {
      const v = logS.get(c.name)!;
      o[c.name] = lever(c, v);
    }
    return o;
  };
  let slope = 1.6;
  let prev: Map<string, number> | null = null;
  for (let it = 0; it < iters; it++) {
    const sc = scales();
    const tasks: Task[] = [];
    const meta: Card2[][] = [];
    while (tasks.length < n) {
      const champ = rnd() < 0.2;
      const a = champ ? pick(CHAMPIONS) : pick(REGULAR);
      const b = pick(REGULAR);
      const c = rnd() < 0.2 ? pick(CHAMPIONS) : pick(REGULAR);
      const d = pick(REGULAR);
      if (a === b || c === d || !noBonus(a, b) || !noBonus(c, d)) continue;
      tasks.push({ kind: 'round', a: side(a, b), b: side(c, d), seed: Math.floor(rnd() * 1e9), scales: sc });
      meta.push([a, b, c, d]);
    }
    const res = await pool<{ winner: number; time: number }>(tasks, `calib ${it + 1}/${iters}`);
    const idx = new Map(all.map((c, i) => [c.name, i]));
    const rows = res.map((r, k) => {
      const [a, b, c, d] = meta[k]!;
      return { f: [[idx.get(a.name)!, 1], [idx.get(b.name)!, 1], [idx.get(c.name)!, -1], [idx.get(d.name)!, -1]] as [number, number][], y: r.winner === 0 ? 1 : r.winner === 1 ? 0 : 0.5 };
    });
    const w = logistic(all.length, rows);
    const regMean = REGULAR.reduce((s2, c) => s2 + w[idx.get(c.name)!]!, 0) / REGULAR.length;
    const err = new Map(all.map((c) => [c.name, w[idx.get(c.name)!]! - regMean - (c.cls === 'Champion' ? CHAMP_TARGET : 0)]));
    // Steigung aus der letzten Änderung schätzen (robust gemittelt)
    if (prev) {
      let num = 0;
      let den = 0;
      for (const c of all) {
        const dl = (logS.get(c.name)! - (lastLog.get(c.name) ?? 0));
        const dr = err.get(c.name)! - prev.get(c.name)!;
        num += dl * dr;
        den += dl * dl;
      }
      if (den > 1e-6) slope = Math.max(0.8, Math.min(4, num / den));
    }
    const rms = Math.sqrt([...err.values()].reduce((s2, e) => s2 + e * e, 0) / all.length);
    const avgT = res.reduce((s2, r) => s2 + r.time, 0) / res.length;
    console.log(`\nDurchgang ${it + 1}: Fehler (RMS) ${rms.toFixed(2)} logit, Steigung ${slope.toFixed(2)}, Ø Runde ${avgT.toFixed(1)} s`);
    prev = err;
    lastLog = new Map(logS);
    for (const c of all) logS.set(c.name, logS.get(c.name)! - (err.get(c.name)! / slope) * 0.85);
    writeFileSync(LOGS_FILE, JSON.stringify(Object.fromEntries(logS)));
  }
  const sc = scales();
  console.log('\nNeue Werte (HP / Schaden):');
  for (const c of all) {
    const b = BASE.get(c.name)!;
    const [h, d, tr] = sc[c.name]!;
    console.log(`${c.name.padEnd(18)} troops ${String(b.troops).padStart(4)} → ${(b.troops * tr).toFixed(0).padStart(4)}   hp ${String(b.hp).padStart(4)} → ${(b.hp * h).toFixed(1).padStart(6)}   dmg ${String(b.dmg).padStart(3)} → ${(b.dmg * d).toFixed(1).padStart(5)}`);
  }
  console.log('SCALES ' + JSON.stringify(sc));
}
let lastLog = new Map<string, number>();

/** Jeder Boss einzeln in Welt 2, 3 und 4 (Rusk in Welt 1). */
async function bosses(per = 40): Promise<void> {
  const { Run } = await import('../../src/c2/run');
  const races: RaceId[] = ['ashclan', 'wildwood', 'tidebound', 'sunlegion', 'plague', 'deepforge', 'drifters'];
  const tasks: Task[] = [];
  const meta: string[] = [];
  for (const boss of races)
    for (const world of boss === 'drifters' ? [1] : boss === 'plague' ? [3, 4] : [2, 3, 4])
      for (let k = 0; k < per; k++) {
        const colors = [...races].sort(() => rnd() - 0.5).slice(0, 3);
        const p = playerAt(world, colors);
        const run = new Run(colors, 1 + Math.floor(rnd() * 1e5));
        run.worldNo = world;
        run.world = boss;
        const bs = [1, 3, 4, 5][world - 1]!;
        tasks.push({ kind: 'battle', deck: p.deck, mods: p.mods, playerCastle: p.castle, enemyDeck: run.enemyDeck().map((c) => c.name), enemyStars: run.enemyStars(), bossPower: run.bossPower(), seed: Math.floor(rnd() * 1e9), enemyPower: run.enemyPower(bs, true), enemyCastle: run.enemyCastle(bs, true), boss });
        meta.push(`${boss.padEnd(10)} W${world}`);
      }
  const res = await pool<{ won: boolean; rounds: number }>(tasks, 'bosses');
  const agg = new Map<string, [number, number, number]>();
  res.forEach((r, k) => {
    const a = agg.get(meta[k]!) ?? [0, 0, 0];
    a[0] += r.won ? 1 : 0;
    a[1]++;
    a[2] += r.rounds;
    agg.set(meta[k]!, a);
  });
  console.log('\nBosse: Siegquote des Spielers, Runden');
  for (const [k, [w, n, r]] of agg) console.log(`${k}  ${((w / n) * 100).toFixed(0).padStart(3)}%  ${(r / n).toFixed(1)}`);
}

async function main(): Promise<void> {
  const exp = process.argv[3] ?? 'cards';
  const n = process.argv[4] ? Number(process.argv[4]) : undefined;
  const t0 = Date.now();
  if (exp === 'cards') await cards(n);
  else if (exp === 'bonus') await bonus(n);
  else if (exp === 'champs') await champs(n);
  else if (exp === 'curve') await curve(n);
  else if (exp === 'calibrate') await calibrate(n ?? 5);
  else if (exp === 'bosses') await bosses(n);
  console.log(`(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}

if (!isMainThread) {
  parentPort!.on('message', (msg: { id: number; task: Task }) => parentPort!.postMessage({ id: msg.id, res: runTask(msg.task) }));
} else {
  void main();
}

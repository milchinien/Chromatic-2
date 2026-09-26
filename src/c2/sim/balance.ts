// =====================================================================
// Kämpfe ohne Grafik durchrechnen: eine einzelne Runde oder einen ganzen
// Kampf (mehrere Runden, Karten ziehen wie im Spiel). Wird vom
// Balance-Editor (balance.html) und vom Node-Werkzeug tools/balance
// benutzt, außerdem teilt der Kampfbildschirm die Gegner-KI von hier.
// =====================================================================

import { BOSSES, CARDS2, maxTroops, type Boss, type Card2, type Mods, type RaceId } from '../data';
import { Arena, DT, type Deployed, type SideSpec } from './arena';

/** Truppen werden beim Aufdecken gewürfelt: zwischen 55 % und 100 % des Kartenwerts. */
export function rollTroops(c: Card2, rnd: () => number = Math.random, stars = 1, mods?: Mods | null): number {
  const max = maxTroops(c, stars, mods);
  return max <= 1 || c.cls === 'Siege' ? max : Math.max(1, Math.round(max * (0.55 + 0.45 * rnd())));
}

const MELEE = new Set(['Infantry', 'Cavalry', 'Beast', 'Swarm', 'Champion']);

/** Gegner-KI: eine zufällige Karte, 40 % Chance auf eine passende zweite; Nahkampf nach vorne. */
export function enemyPick(deck: Card2[], stars: number, rnd: () => number = Math.random): [Deployed, Deployed] {
  const a = deck[Math.floor(rnd() * deck.length)]!;
  const pairs = deck.filter((c) => c !== a && (c.race === a.race || c.cls === a.cls));
  const b = rnd() < 0.4 && pairs.length ? pairs[Math.floor(rnd() * pairs.length)]! : deck[Math.floor(rnd() * deck.length)]!;
  const [f, bk] = MELEE.has(b.cls) && !MELEE.has(a.cls) ? [b, a] : [a, b];
  return [
    { card: f, stars, count: rollTroops(f, rnd, stars) },
    { card: bk, stars, count: rollTroops(bk, rnd, stars) },
  ];
}

export interface PlayerCard {
  card: Card2;
  stars: number;
}

/**
 * Spieler-KI für Simulationen: zieht 3 Karten und nimmt das Paar mit den
 * meisten Boni (bei Gleichstand das stärkere), Nahkampf nach vorne.
 */
export function playerPick(deck: PlayerCard[], rnd: () => number = Math.random, mods?: Mods): [Deployed, Deployed] {
  const pool = [...deck];
  const hand: PlayerCard[] = [];
  while (hand.length < 3 && pool.length) hand.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]!);
  let best: [PlayerCard, PlayerCard] = [hand[0]!, hand[1] ?? hand[0]!];
  let bestScore = -1;
  for (let i = 0; i < hand.length; i++)
    for (let j = i + 1; j < hand.length; j++) {
      const a = hand[i]!;
      const b = hand[j]!;
      const score = (a.card.race === b.card.race ? 2 : 0) + (a.card.cls === b.card.cls ? 2 : 0) + (a.stars + b.stars) * 0.3 + rnd() * 0.5;
      if (score > bestScore) {
        bestScore = score;
        best = [a, b];
      }
    }
  const [a, b] = best;
  const [f, bk] = MELEE.has(b.card.cls) && !MELEE.has(a.card.cls) ? [b, a] : [a, b];
  return [
    { card: f.card, stars: f.stars, count: rollTroops(f.card, rnd, f.stars, mods) },
    { card: bk.card, stars: bk.stars, count: rollTroops(bk.card, rnd, bk.stars, mods) },
  ];
}

export interface RoundResult {
  /** Burgschaden, den jede Seite der anderen zugefügt hat */
  castleDmg: [number, number];
  /** Wer die Runde gewonnen hat (mehr Burgschaden), -1 = unentschieden */
  winner: 0 | 1 | -1;
  /** Spielzeit der Runde in Sekunden */
  time: number;
  spawned: [number, number];
  kills: [number, number];
}

let shared: Arena | null = null;
/** Eine Arena wiederverwenden (sie reserviert viel Speicher). */
export const sharedArena = () => (shared ??= new Arena());

/** Rechnet eine Runde durch, die schon aufgestellt ist (deployRound). */
export function runRound(arena: Arena, maxTime = 200): RoundResult {
  const before = [arena.baseHp[0]!, arena.baseHp[1]!];
  arena.begin();
  const maxSteps = Math.round(maxTime / DT);
  let s = 0;
  while (arena.state !== 'over' && s < maxSteps) {
    arena.step();
    arena.events.length = 0;
    s++;
  }
  const dealt: [number, number] = [before[1]! - arena.baseHp[1]!, before[0]! - arena.baseHp[0]!];
  return {
    castleDmg: dealt,
    winner: dealt[0] > dealt[1] ? 0 : dealt[1] > dealt[0] ? 1 : -1,
    time: arena.time,
    spawned: [arena.spawned[0]!, arena.spawned[1]!],
    kills: [arena.kills[0]!, arena.kills[1]!],
  };
}

/** Eine einzelne Runde zweier fest vorgegebener Aufstellungen. */
export function simRound(a: SideSpec, b: SideSpec, seed: number, boss: Boss | null = null): RoundResult {
  const arena = sharedArena();
  arena.startBattle(100000, 100000, boss, seed);
  arena.deployRound([a, b]);
  return runRound(arena);
}

export interface BattleSetup {
  deck: PlayerCard[];
  mods: Mods;
  playerCastle: number;
  enemyDeck: Card2[];
  enemyStars: number;
  enemyPower: number;
  enemyCastle: number;
  boss: Boss | null;
  bossPower?: number;
  seed: number;
  maxRounds?: number;
}

export interface BattleResult {
  won: boolean;
  rounds: number;
  /** gesamte Kampfzeit in Spielsekunden */
  time: number;
  /** verbleibende eigene Burg-HP in Prozent */
  castleLeft: number;
  enemyCastleLeft: number;
  /** Burgschaden je Runde: vom Spieler zugefügt / erlitten (Summen) */
  dealt: number;
  taken: number;
}

/** Ein ganzer Kampf wie im Spiel: Runde um Runde, bis eine Burg fällt. */
export function simBattle(s: BattleSetup): BattleResult {
  const arena = sharedArena();
  let seed = s.seed;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  arena.startBattle(s.playerCastle, s.enemyCastle, s.boss, s.seed, s.bossPower ?? 1);
  let time = 0;
  let rounds = 0;
  let dealt = 0;
  let taken = 0;
  const maxRounds = s.maxRounds ?? 12;
  while (rounds < maxRounds) {
    rounds++;
    const mine = playerPick(s.deck, rnd, s.mods);
    const theirs = enemyPick(s.enemyDeck, s.enemyStars, rnd);
    arena.deployRound([
      { front: mine[0], back: mine[1], mods: s.mods, baseHp: s.playerCastle, power: 1 },
      { front: theirs[0], back: theirs[1], baseHp: 0, power: s.enemyPower },
    ]);
    const rr = runRound(arena);
    time += rr.time;
    dealt += rr.castleDmg[0];
    taken += rr.castleDmg[1];
    if (arena.outcome !== 'next') break;
  }
  return {
    won: arena.outcome === 'win',
    rounds,
    time,
    castleLeft: arena.baseHp[0]! / arena.baseMax[0]!,
    enemyCastleLeft: arena.baseHp[1]! / arena.baseMax[1]!,
    dealt,
    taken,
  };
}

/** Alle Karten außer Champions (Startdeck-fähig). */
export const REGULAR = CARDS2.filter((c) => c.cls !== 'Champion');
export const CHAMPIONS = CARDS2.filter((c) => c.cls === 'Champion');
export const bossOf = (r: RaceId) => BOSSES[r];

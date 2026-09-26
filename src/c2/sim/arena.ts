// =====================================================================
// Arena-Simulation für Chromatic 2. Massenschlacht auf dem 640×360-Feld
// der Kampfansicht (Wiese zwischen den Burgmauern). Flache Typed-Arrays,
// Spatial Hash, feste Schrittweite 1/60 s.
//
// Ablauf einer Runde: deploy (Standbild) → fight → march (eine Seite ist
// tot, Überlebende laufen zur gegnerischen Burg, je 1 Schaden) → over.
// =====================================================================

import type { VisualKind } from '../../art/sprites';
import { Grid } from '../../sim/grid';
import {
  ABILITY,
  BOSSES,
  CLASS_STATS,
  RACES,
  cardsOf,
  type Ability,
  type AttackKind,
  type Boss,
  type Card2,
  type CardClass,
  type Mods,
  type RaceId,
  maxTroops,
} from '../data';

export const FX0 = 32; // linke Burgmauer (Feldseite)
export const FX1 = 608; // rechte Burgmauer
export const FY0 = 26;
export const FY1 = 208;
export const DT = 1 / 60;
/** Nur Speicherrahmen der Simulation – kein Spiel-Limit. */
export const MAX_UNITS = 30000;
const MAX_PROJ = 6000;
const CELL = 16;
const DMG_SCALE = 0.3;
const MAX_PER_CARD = 1200;
const ROUND_RUSH = 38; // danach laufen alle direkt zur Burg
/** Burgschaden, wenn ein ganzes Heer (alle HP der Runde) die Burg erreicht */
export const CASTLE_ARMY = 100;
/** Burgschaden je Boss, der die Burg erreicht */
const BOSS_CASTLE = 40;

/** Anteil von HP/Schaden, mit dem Gefallene durch „Undeath“ wieder aufstehen. */
const UNDEATH_KEEP = 0.6;

/** Wandering Magus: Magie je nach Farbe der anderen Karte. */
const ADAPT: Record<RaceId, Ability | null> = {
  ashclan: 'firebolt',
  wildwood: 'chain',
  tidebound: 'frostnova',
  sunlegion: 'sunbeam',
  plague: 'poison',
  deepforge: 'cannon',
  drifters: null,
};

/** Art einer Explosion bzw. eines Flächeneffekts (nur für die Darstellung). */
export type BoomFx = 'fire' | 'rock' | 'boulder' | 'frost' | 'whirl' | 'root' | 'bloat' | 'spore' | 'colossus' | 'meteor';
export type AuraFx = 'moon' | 'bless' | 'mend';

export type SimEvent =
  | { t: 'death'; x: number; y: number; vis: string; team: number; big: boolean; color: string; boss?: boolean; burning?: boolean; flying?: boolean }
  | { t: 'hit'; x: number; y: number; color: string; big?: boolean }
  | { t: 'boom'; x: number; y: number; r: number; color: string; fx?: BoomFx }
  | { t: 'aura'; x: number; y: number; r: number; fx: AuraFx }
  | { t: 'cast'; x: number; y: number; tx: number; ty: number; color: string; siege: boolean }
  | { t: 'beam'; x0: number; y: number; x1: number; color: string; fx: 'sun' | 'cannon' }
  | { t: 'chain'; pts: number[]; color: string }
  | { t: 'heal'; x: number; y: number; color: string }
  | { t: 'base'; team: number; y: number }
  | { t: 'spawn'; x: number; y: number; color: string; big: boolean; undead?: boolean }
  | { t: 'wave'; team: number }
  | { t: 'text'; x: number; y: number; text: string; color: string };

/** Eine Karte, wie sie in einer Runde ins Feld geht. */
export interface Deployed {
  card: Card2;
  /** Gewürfelte Truppenzahl (vor Boni); fehlt sie, gilt der Kartenwert */
  count?: number;
  stars: number;
}

export interface SideSpec {
  front: Deployed;
  back: Deployed;
  mods?: Mods;
  /** Burg-HP zu Beginn des Kampfes */
  baseHp: number;
  /** Truppen-Multiplikator (Gegner-Stärke nach Sternen) */
  power: number;
  /** Nur Balance-Editor: Rassen-/Klassenbonus erzwingen (true) oder abschalten (false) */
  bonus?: { race?: boolean; cls?: boolean };
}

export interface UType {
  visKey: string;
  card: Card2 | null;
  race: RaceId;
  cls: CardClass | 'Summon';
  team: number;
  hp: number;
  dmg: number;
  interval: number;
  speed: number;
  range: number;
  attack: AttackKind;
  radius: number;
  scale: number;
  building: boolean;
  ability: Ability | null;
  flying: boolean;
  armor: number;
  rangedArmor: number;
  /** Rot (Ashclan): Stärke der Wut, 0 = keine */
  rage: number;
  regen: number;
  undeath: number;
  charge: boolean;
  doubleFirst: boolean;
  champion: boolean;
  boss: boolean;
  /** Mauerstück: Gegner können nicht hindurch */
  wall?: boolean;
  glow: string;
  blood: string;
  /** Kartenwerte inkl. Sterne (ohne Boni/Enchantments): Grundlage für Beschwörungen & Gift */
  raw: { hp: number; dmg: number };
}

export interface BonusInfo {
  team: number;
  race: RaceId | null;
  cls: CardClass | null;
}

export type ArenaState = 'deploy' | 'fight' | 'march' | 'over';

const GLOW: Record<RaceId, string> = {
  ashclan: '#ff8a3a',
  wildwood: '#9dff6a',
  tidebound: '#8ae8ff',
  sunlegion: '#fff0a0',
  plague: '#c68aff',
  deepforge: '#e0e4ea',
  drifters: '#f4ecd9',
};

export class Arena {
  // --- Einheiten ---
  readonly alive = new Uint8Array(MAX_UNITS);
  readonly gen = new Uint32Array(MAX_UNITS);
  readonly team = new Uint8Array(MAX_UNITS);
  readonly type = new Uint16Array(MAX_UNITS);
  readonly x = new Float32Array(MAX_UNITS);
  readonly y = new Float32Array(MAX_UNITS);
  readonly vx = new Float32Array(MAX_UNITS);
  readonly vy = new Float32Array(MAX_UNITS);
  readonly hp = new Float32Array(MAX_UNITS);
  readonly maxHp = new Float32Array(MAX_UNITS);
  readonly cd = new Float32Array(MAX_UNITS);
  readonly target = new Int32Array(MAX_UNITS);
  readonly targetGen = new Uint32Array(MAX_UNITS);
  readonly retarget = new Float32Array(MAX_UNITS);
  readonly burnT = new Float32Array(MAX_UNITS);
  readonly burnDps = new Float32Array(MAX_UNITS);
  readonly slowT = new Float32Array(MAX_UNITS);
  readonly slowMul = new Float32Array(MAX_UNITS);
  readonly shield = new Float32Array(MAX_UNITS);
  readonly flashT = new Float32Array(MAX_UNITS);
  readonly atkT = new Float32Array(MAX_UNITS);
  readonly animT = new Float32Array(MAX_UNITS);
  readonly abilT = new Float32Array(MAX_UNITS);
  readonly hitsTaken = new Uint16Array(MAX_UNITS);
  readonly firstHit = new Uint8Array(MAX_UNITS);
  readonly summoned = new Uint8Array(MAX_UNITS);
  hw = 0;
  private readonly free: number[] = [];

  // --- Geschosse ---
  readonly pAlive = new Uint8Array(MAX_PROJ);
  readonly pKind = new Uint8Array(MAX_PROJ);
  readonly pTeam = new Uint8Array(MAX_PROJ);
  readonly pX = new Float32Array(MAX_PROJ);
  readonly pY = new Float32Array(MAX_PROJ);
  readonly pSX = new Float32Array(MAX_PROJ);
  readonly pSY = new Float32Array(MAX_PROJ);
  readonly pTX = new Float32Array(MAX_PROJ);
  readonly pTY = new Float32Array(MAX_PROJ);
  readonly pZ = new Float32Array(MAX_PROJ);
  readonly pT = new Float32Array(MAX_PROJ);
  readonly pDur = new Float32Array(MAX_PROJ);
  readonly pTarget = new Int32Array(MAX_PROJ);
  readonly pTargetGen = new Uint32Array(MAX_PROJ);
  readonly pDmg = new Float32Array(MAX_PROJ);
  readonly pSrcType = new Uint16Array(MAX_PROJ);
  readonly pColor: string[] = [];
  pHw = 0;
  private readonly pFree: number[] = [];

  readonly types: UType[] = [];
  readonly events: SimEvent[] = [];
  /** Nur für den Ton: Nahkampfhiebe und abgeschossene Pfeile seit dem letzten Abholen */
  readonly sfxTally = { melee: 0, arrows: 0, arrowX: 0 };

  state: ArenaState = 'over';
  time = 0;
  round = 0;
  readonly baseHp = [0, 0];
  readonly baseMax = [0, 0];
  readonly kills = [0, 0];
  readonly counts = [0, 0];
  readonly spawned = [0, 0];
  readonly survivorsAtBase = [0, 0];
  readonly championsSlain = [0, 0];
  readonly bonuses: BonusInfo[] = [];
  deaths = 0;
  shake = 0;
  boss: Boss | null = null;
  bossIdx = -1;
  bossHp = 0;
  /** volle Boss-HP (für die Anzeige) */
  bossMax = 0;
  private bossPower = 1;
  bossFled = false;
  bossDead = false;
  private readonly summons = [0, 0];
  /** Bewegliche Einheiten je Team zu Rundenbeginn / jetzt */
  private readonly roundMobile = [0, 0];
  readonly mobileNow = [0, 0];
  /** Schaden, den ein Team gerade nimmt (Last Stand < 1) */
  readonly lastStand = [1, 1];
  /** Schadensbonus im Last Stand */
  readonly lastStandDmg = [1, 1];
  private readonly lastStandShown = [false, false];
  private readonly bannerAlive = [0, 0];
  /** Field Chaplain lebt: die andere Karte macht +10 % Schaden */
  private readonly chaplainAlive = [0, 0];
  /** Gold-Bonus aktiv (Stärke, 0 = aus) */
  private readonly discipline = [0, 0];
  private readonly mods: (Mods | undefined)[] = [undefined, undefined];
  private passiveT = 0;
  private readonly armyHp = [1, 1];
  private readonly tideT = [0, 0];
  private readonly grids = [new Grid(640, 240, CELL, MAX_UNITS), new Grid(640, 240, CELL, MAX_UNITS)];
  private readonly teamIds = [new Int32Array(MAX_UNITS), new Int32Array(MAX_UNITS)];
  private readonly teamN = [0, 0];
  private readonly centroidY = [117, 117];
  private readonly pushX = new Float32Array(MAX_UNITS);
  private readonly pushY = new Float32Array(MAX_UNITS);
  /** Pro Einheit zwischengespeicherte Typwerte (spart Objekt-Lookups in den heißen Schleifen) */
  private readonly uRad = new Float64Array(MAX_UNITS);
  private readonly uScale = new Float64Array(MAX_UNITS);
  private readonly uFlags = new Uint8Array(MAX_UNITS);
  /** Kopie der Rasterinhalte in Rasterreihenfolge (je Team) – lineare Speicherzugriffe in separate() */
  private readonly gX = [new Float32Array(MAX_UNITS), new Float32Array(MAX_UNITS)];
  private readonly gY = [new Float32Array(MAX_UNITS), new Float32Array(MAX_UNITS)];
  private readonly gR = [new Float64Array(MAX_UNITS), new Float64Array(MAX_UNITS)];
  private readonly gS = [new Float64Array(MAX_UNITS), new Float64Array(MAX_UNITS)];
  private readonly gF = [new Uint8Array(MAX_UNITS), new Uint8Array(MAX_UNITS)];
  /** Gebäude je Team (Mauern, Belagerung) für blockByBuildings */
  private readonly buildIds = [new Int32Array(MAX_UNITS), new Int32Array(MAX_UNITS)];
  private readonly buildN = [0, 0];
  /** Einheiten mit „taunt“ je Team (verändern die Zielsuche) */
  private readonly tauntN = [0, 0];
  /** Suchreihenfolge von jeder Zelle nach außen (Zeilen / Spalten), siehe outwardTable */
  private readonly rowOrd = outwardTable(240 / CELL);
  private readonly colOrd = outwardTable(640 / CELL);
  private rng = 1;
  private tick = 0;

  random(): number {
    let s = this.rng;
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    this.rng = s >>> 0;
    return this.rng / 4294967296;
  }

  // -----------------------------------------------------------------------
  // Kampf & Runden
  // -----------------------------------------------------------------------

  /** Neuer Kampf: Burgen auffüllen, optional Boss. */
  /** `bossPower` = Stärke des Bosses je nach Welt (HP und Schaden). */
  startBattle(playerBase: number, enemyBase: number, boss: Boss | null, seed: number, bossPower = 1): void {
    this.bossPower = bossPower;
    this.baseHp[0] = this.baseMax[0] = Math.max(50, playerBase);
    this.baseHp[1] = this.baseMax[1] = enemyBase;
    this.boss = boss;
    this.bossMax = boss ? boss.hp * bossPower : 0;
    this.bossHp = this.bossMax;
    this.bossDead = false;
    this.bossFled = false;
    this.round = 0;
    this.rng = (seed * 2654435761) >>> 0 || 7;
    this.state = 'over';
  }

  private clearUnits(): void {
    this.alive.fill(0);
    this.pAlive.fill(0);
    this.hw = 0;
    this.pHw = 0;
    this.free.length = 0;
    this.pFree.length = 0;
    this.types.length = 0;
    this.necroTypes[0] = this.necroTypes[1] = -1;
    this.events.length = 0;
    this.bonuses.length = 0;
    this.summons[0] = this.summons[1] = 0;
    this.spawned[0] = this.spawned[1] = 0;
    this.survivorsAtBase[0] = this.survivorsAtBase[1] = 0;
    this.championsSlain[0] = this.championsSlain[1] = 0;
    this.kills[0] = this.kills[1] = 0;
    this.time = 0;
    this.deaths = 0;
    this.passiveT = 0;
    this.bossIdx = -1;
  }

  /** Stellt beide Heere für eine neue Runde auf (Standbild bis begin()). */
  deployRound(sides: [SideSpec, SideSpec]): void {
    this.clearUnits();
    this.round++;
    for (let tm = 0; tm < 2; tm++) {
      const s = sides[tm]!;
      this.mods[tm] = s.mods;
      // Boni lassen sich (Balance-Editor) erzwingen oder abschalten
      const sameRace = s.bonus?.race ?? s.front.card.race === s.back.card.race;
      const sameCls = s.bonus?.cls ?? s.front.card.cls === s.back.card.cls;
      const info: BonusInfo = { team: tm, race: sameRace ? s.front.card.race : null, cls: sameCls ? s.front.card.cls : null };
      this.bonuses.push(info);
      this.discipline[tm] = info.race === 'sunlegion' ? (s.mods?.bonusMul ?? 1) : 0;
      this.deployCard(tm, s.front, info, 'front', s.power, s.back.card.race);
      this.deployCard(tm, s.back, info, 'back', s.power, s.front.card.race);
      this.applyClassBonusSpawns(tm, info, s);
    }
    if (this.boss) this.spawnBoss();
    if (this.boss?.race === 'deepforge' && this.round === 1) this.buildWall(1, 1.4);
    this.countUnits();
    this.state = 'deploy';
  }

  begin(): void {
    if (this.state !== 'deploy') return;
    this.state = 'fight';
    // Gesamt-HP je Heer: Grundlage für den Burgschaden
    this.armyHp[0] = this.armyHp[1] = 0;
    for (let i = 0; i < this.hw; i++) if (this.alive[i] && !this.types[this.type[i]!]!.building && !this.types[this.type[i]!]!.boss) this.armyHp[this.team[i]!]! += this.maxHp[i]!;
    this.countMobile();
    this.roundMobile[0] = Math.max(1, this.mobileNow[0]!);
    this.roundMobile[1] = Math.max(1, this.mobileNow[1]!);
    this.lastStand[0] = this.lastStand[1] = 1;
    this.lastStandShown[0] = this.lastStandShown[1] = false;
    // Tidal Wave: Gegner zu Beginn zurückdrängen
    for (const b of this.bonuses) if (b.race === 'tidebound') this.tidalWave(1 - b.team, 30, 1.5, 0.07 * (this.mods[b.team]?.bonusMul ?? 1));
    this.tideT[0] = this.tideT[1] = 0;
  }

  private visKey(race: RaceId, kind: VisualKind, team: number): string {
    return `${race}|${kind}|${team}`;
  }

  /** Einheitentyp aus Karte + Sternen + Boni + Mods. `partner` = Rasse der anderen Karte. */
  private makeType(tm: number, d: Deployed, info: BonusInfo, partner: RaceId | null = null): number {
    const c = d.card;
    const cs = CLASS_STATS[c.cls];
    const m = this.mods[tm];
    const bm = m?.bonusMul ?? 1;
    // Champions sind eine einzige Einheit: sie bekommen den Truppen-Anteil der
    // Sterne (+30 % je Stern) zusätzlich auf HP und Schaden
    const starMul = (1 + 0.15 * (d.stars - 1)) * (c.cls === 'Champion' ? 1 + 0.3 * (d.stars - 1) : 1);
    let hp = c.hp * starMul * (m?.hpMul ?? 1) * (m?.classHp[c.cls] ?? 1);
    let dmg = c.dmg * starMul * DMG_SCALE * (m?.dmgMul ?? 1) * (m?.raceDmg[c.race] ?? 1);
    let speed = cs.speed * (m?.speedMul ?? 1);
    // Bogenschützen-Paar: 30 % schneller (dazu doppelte erste Salve)
    const interval = cs.interval / (m?.atkSpeedMul ?? 1) / (info.cls === 'Archers' && c.cls === 'Archers' ? 1 + 0.28 * bm : 1);
    // Rassenbonus
    if (info.race === 'deepforge') hp *= 1 + 0.5 * bm;
    if (info.race === 'drifters') {
      hp *= 1 + 0.2 * bm;
      dmg *= 1 + 0.2 * bm;
    }
    // Klassenbonus
    if (info.cls === 'Infantry' && c.cls === 'Infantry') hp *= 1 + 0.17 * bm;
    if (info.cls === 'Beast' && c.cls === 'Beast') {
      hp *= 1 + 0.12 * bm;
      dmg *= 1 + 0.12 * bm;
      speed *= 1 + 0.12 * bm;
    }
    if (info.cls === 'Cavalry' && c.cls === 'Cavalry') {
      speed *= 1 + 1 * bm;
      hp *= 1 + 0.2 * bm;
    }
    let ability = ABILITY[c.name] ?? null;
    // Wandering Magus: nutzt die Magie der anderen Karte
    if (ability === 'adapt') ability = ADAPT[partner ?? 'drifters'];
    const t: UType = {
      visKey: this.visKey(c.race, c.kind, tm),
      card: c,
      race: c.race,
      cls: c.cls,
      team: tm,
      hp,
      dmg,
      interval,
      speed,
      range: cs.range,
      attack: cs.attack,
      radius: cs.radius * (m?.sizeMul ?? 1),
      scale: cs.scale * (m?.sizeMul ?? 1),
      building: c.cls === 'Siege',
      ability,
      flying: ability === 'flying' || ability === 'leap',
      armor: ability === 'armor' ? 3 * DMG_SCALE : 0,
      rangedArmor: ability === 'shieldwall' ? 0.5 : 1,
      rage: info.race === 'ashclan' ? bm : 0,
      regen: (info.race === 'wildwood' ? 0.12 * bm : 0) + (m?.regenPct ?? 0),
      undeath: info.race === 'plague' ? Math.min(1, 0.8 * bm) : 0,
      charge: ability === 'charge' || ability === 'stuncharge' || (info.cls === 'Cavalry' && c.cls === 'Cavalry'),
      doubleFirst: info.cls === 'Archers' && c.cls === 'Archers',
      champion: c.cls === 'Champion',
      boss: false,
      glow: GLOW[c.race],
      blood: RACES[c.race].unit.blood,
      raw: { hp: c.hp * starMul, dmg: c.dmg * starMul },
    };
    if (c.cls === 'Champion') t.radius = 6 * (m?.sizeMul ?? 1);
    if (ability === 'colossus') t.speed = 16;
    // The Lich zaubert aus der Ferne und hält Abstand
    if (ability === 'harvest') {
      t.attack = 'bolt';
      t.range = 90;
    }
    this.types.push(t);
    return this.types.length - 1;
  }

  private readonly necroTypes: number[] = [-1, -1];

  /** Einheitentyp „Necromancer“ für Beschwörungen durch The Lich (je Team gecacht). */
  private necroType(tm: number): number {
    const cached = this.necroTypes[tm]!;
    if (cached >= 0 && this.types[cached]) return cached;
    const card = cardsOf('plague').find((k) => k.name === 'Necromancer');
    if (!card) return -1;
    const info = this.bonuses.find((b) => b.team === tm) ?? { team: tm, race: null, cls: null };
    const ti = this.makeType(tm, { card, stars: 1 }, info);
    this.necroTypes[tm] = ti;
    return ti;
  }

  private summonType(tm: number, race: RaceId, kind: VisualKind, cls: CardClass | 'Summon', hp: number, dmg: number, opts: Partial<UType> = {}): number {
    const key = this.visKey(race, kind, tm);
    const found = this.types.findIndex((t) => t.visKey === key && t.card === null && t.hp === hp && t.boss === !!opts.boss);
    if (found >= 0) return found;
    const m = this.mods[tm];
    const t: UType = {
      visKey: key,
      card: null,
      race,
      cls,
      team: tm,
      hp: hp * (m?.hpMul ?? 1),
      dmg: dmg * DMG_SCALE * (m?.dmgMul ?? 1),
      interval: 1,
      speed: 24 * (m?.speedMul ?? 1),
      range: 0,
      attack: 'melee',
      radius: 2.6,
      scale: 1,
      building: false,
      ability: null,
      flying: false,
      armor: 0,
      rangedArmor: 1,
      rage: 0,
      regen: m?.regenPct ?? 0,
      undeath: 0,
      charge: false,
      doubleFirst: false,
      champion: false,
      boss: false,
      glow: GLOW[race],
      blood: RACES[race].unit.blood,
      raw: { hp, dmg },
      ...opts,
    };
    this.types.push(t);
    return this.types.length - 1;
  }

  private deployCard(tm: number, d: Deployed, info: BonusInfo, slot: 'front' | 'back', power: number, partner: RaceId): void {
    const ti = this.makeType(tm, d, info, partner);
    const t = this.types[ti]!;
    const c = d.card;
    const m = this.mods[tm];
    const bm = m?.bonusMul ?? 1;
    // d.count ist schon gewürfelt aus der Höchstzahl (Sterne + Enchantments, siehe maxTroops);
    // nur die Gegner-Stärke kommt noch dazu – nicht bei Belagerung und Champions
    let n = (d.count ?? maxTroops(c, d.stars, m)) * (t.building ? 1 : power);
    if (info.cls === 'Infantry' && c.cls === 'Infantry') n *= 1 + 0.17 * bm;
    if (info.cls === 'Swarm' && c.cls === 'Swarm') n *= 1 + 0.2 * bm;
    n = Math.max(1, Math.min(MAX_PER_CARD, Math.round(n)));
    if (c.cls === 'Champion') n = 1;
    const dir = tm === 0 ? 1 : -1;
    const base = tm === 0 ? FX0 : FX1;
    if (t.building) {
      // Belagerung steht an der eigenen Mauer
      const count = Math.min(n, 8);
      for (let k = 0; k < count; k++) {
        const y = FY0 + 20 + ((k + 0.5) * (FY1 - FY0 - 40)) / count;
        this.spawn(ti, base + dir * (16 + (k % 2) * 14), y);
      }
      return;
    }
    const zoneX0 = slot === 'front' ? 70 : 20;
    const zoneW = slot === 'front' ? 90 : 48;
    const h = FY1 - FY0 - 12;
    const sp = Math.max(3, Math.min(7, Math.sqrt((zoneW * h) / n)));
    const perCol = Math.max(1, Math.floor(h / sp));
    const cols = Math.ceil(n / perCol);
    for (let k = 0; k < n; k++) {
      const col = Math.floor(k / perCol);
      const row = k % perCol;
      const colN = Math.min(perCol, n - col * perCol);
      const px = zoneX0 + zoneW - (col * zoneW) / Math.max(1, cols) - (cols === 1 ? zoneW / 2 : 0) + (this.random() - 0.5) * 2;
      const py = (FY0 + FY1) / 2 + (row - (colN - 1) / 2) * sp + (this.random() - 0.5) * 2;
      this.spawn(ti, base + dir * px, py);
    }
  }

  private applyClassBonusSpawns(tm: number, info: BonusInfo, s: SideSpec): void {
    const dir = tm === 0 ? 1 : -1;
    const base = tm === 0 ? FX0 : FX1;
    const race = s.front.card.race;
    const bm = this.mods[tm]?.bonusMul ?? 1;
    if (info.cls === 'Mage') {
      // Beschwört zufällige Truppen vor dem Heer
      const pool = cardsOf(race).filter((k) => k.cls === 'Infantry' || k.cls === 'Swarm' || k.cls === 'Beast');
      const pick = pool[Math.floor(this.random() * pool.length)] ?? cardsOf('drifters')[0]!;
      const ti = this.summonType(tm, pick.race, pick.kind, pick.cls, pick.hp, pick.dmg);
      const n = Math.round(20 * bm);
      for (let k = 0; k < n; k++) this.spawn(ti, base + dir * (175 + this.random() * 20), FY0 + 10 + this.random() * (FY1 - FY0 - 20), true);
    }
    if (info.cls === 'Priest') {
      const ti = this.summonType(tm, race, 'hammer', 'Summon', 170 * bm, 18, { scale: 2, radius: 6, speed: 18, interval: 1.2 });
      for (let k = 0; k < 2; k++) this.spawn(ti, base + dir * 170, FY0 + (FY1 - FY0) * (k === 0 ? 0.3 : 0.7), true);
    }
    if (info.cls === 'Siege') this.buildWall(tm, 0.3 * bm);
  }

  private buildWall(tm: number, strength: number): void {
    const dir = tm === 0 ? 1 : -1;
    const base = tm === 0 ? FX0 : FX1;
    const ti = this.summonType(tm, 'deepforge', 'tower', 'Summon', 90 * strength, 0, { building: true, wall: true, radius: 7, scale: 1, speed: 0, attack: 'melee', visKey: `wall|${tm}` });
    // Lückenlos vom oberen bis zum unteren Feldrand
    for (let y = FY0 + 4; y <= FY1 + 2; y += 12) this.spawn(ti, base + dir * 190, y, true);
  }

  private spawnBoss(): void {
    const b = this.boss!;
    if (this.bossHp <= 0) return;
    const ti = this.summonType(1, b.race, b.kind, 'Summon', b.hp * this.bossPower, b.dmg * this.bossPower, {
      boss: true,
      scale: 3,
      radius: 10,
      speed: 14,
      interval: 1.4,
      visKey: `boss|${b.race}`,
    });
    const i = this.spawn(ti, FX1 - 70, (FY0 + FY1) / 2, true);
    if (i >= 0) {
      this.hp[i] = this.bossHp;
      this.maxHp[i] = this.bossMax;
      this.bossIdx = i;
    }
  }

  spawn(ti: number, x: number, y: number, summoned = false): number {
    const i = this.free.length > 0 ? this.free.pop()! : this.hw < MAX_UNITS ? this.hw++ : -1;
    if (i < 0) return -1;
    const t = this.types[ti]!;
    this.alive[i] = 1;
    this.gen[i]!++;
    this.team[i] = t.team;
    this.type[i] = ti;
    this.x[i] = x;
    this.y[i] = Math.max(FY0, Math.min(FY1, y));
    this.vx[i] = 0;
    this.vy[i] = 0;
    this.hp[i] = t.hp;
    this.maxHp[i] = t.hp;
    this.cd[i] = this.random() * t.interval;
    this.target[i] = -1;
    this.retarget[i] = this.random() * 0.3;
    this.burnT[i] = 0;
    this.slowT[i] = 0;
    this.slowMul[i] = 1;
    this.shield[i] = 0;
    this.flashT[i] = 0;
    this.atkT[i] = 0;
    this.animT[i] = this.random() * 10;
    this.abilT[i] = 1 + this.random() * 2;
    this.hitsTaken[i] = 0;
    this.firstHit[i] = 1;
    this.summoned[i] = summoned ? 1 : 0;
    this.cacheType(i, t);
    this.spawned[t.team]!++;
    if (summoned && this.state !== 'over') this.events.push({ t: 'spawn', x, y, color: t.glow, big: t.scale > 1, undead: /\|(skeleton|ghoul)\|/.test(t.visKey) });
    return i;
  }

  private cacheType(i: number, t: UType): void {
    this.uRad[i] = t.radius;
    this.uScale[i] = t.scale;
    this.uFlags[i] = (t.flying ? U_FLYING : 0) | (t.building ? U_BUILDING : 0) | (t.wall ? U_WALL : 0) | (t.ability === 'taunt' ? U_TAUNT : 0);
  }

  // -----------------------------------------------------------------------
  // Simulation
  // -----------------------------------------------------------------------

  step(): void {
    if (this.state === 'deploy') {
      for (let i = 0; i < this.hw; i++) if (this.alive[i]) this.animT[i]! += DT * 0.4;
      return;
    }
    if (this.state !== 'fight' && this.state !== 'march') return;
    this.time += DT;
    this.shake = Math.max(0, this.shake - DT * 6);
    this.buildGrids();
    this.bossPassive();
    this.tideTick();
    this.tick++;
    if (this.tick % 2 === 0) {
      for (let i = 0; i < this.hw; i++) if (this.alive[i]) this.updateUnit(i);
    } else {
      for (let i = this.hw - 1; i >= 0; i--) if (this.alive[i]) this.updateUnit(i);
    }
    this.separate();
    this.blockByBuildings();
    this.updateProjectiles();
    this.countUnits();
    this.updateLastStand();
    this.checkRound();
  }

  private buildGrids(): void {
    this.teamN[0] = this.teamN[1] = 0;
    this.buildN[0] = this.buildN[1] = 0;
    this.tauntN[0] = this.tauntN[1] = 0;
    this.bannerAlive[0] = this.bannerAlive[1] = 0;
    this.chaplainAlive[0] = this.chaplainAlive[1] = 0;
    let sy0 = 0;
    let sy1 = 0;
    for (let i = 0; i < this.hw; i++) {
      if (!this.alive[i]) continue;
      const tm = this.team[i]!;
      this.teamIds[tm]![this.teamN[tm]!++] = i;
      if (this.uFlags[i]! & U_BUILDING) this.buildIds[tm]![this.buildN[tm]!++] = i;
      if (this.uFlags[i]! & U_TAUNT) this.tauntN[tm]!++;
      if (tm === 0) sy0 += this.y[i]!;
      else sy1 += this.y[i]!;
      const ab = this.types[this.type[i]!]!.ability;
      if (ab === 'banner') this.bannerAlive[tm] = 1;
      else if (ab === 'chaplain') this.chaplainAlive[tm] = 1;
    }
    for (let tm = 0; tm < 2; tm++) this.grids[tm]!.build(this.teamIds[tm]!, this.teamN[tm]!, this.x, this.yGrid());
    if (this.teamN[0]) this.centroidY[0] = sy0 / this.teamN[0]!;
    if (this.teamN[1]) this.centroidY[1] = sy1 / this.teamN[1]!;
  }

  /** Das Raster beginnt bei y=0, die Einheiten stehen bei FY0…FY1 – kein Versatz nötig. */
  private yGrid(): Float32Array {
    return this.y;
  }

  private countUnits(): void {
    let a = 0;
    let b = 0;
    for (let i = 0; i < this.hw; i++) if (this.alive[i]) this.team[i] === 0 ? a++ : b++;
    this.counts[0] = a;
    this.counts[1] = b;
  }

  private countMobile(): void {
    this.mobileNow[0] = this.mobileNow[1] = 0;
    for (let i = 0; i < this.hw; i++) if (this.alive[i] && !this.types[this.type[i]!]!.building) this.mobileNow[this.team[i]!]!++;
  }

  /**
   * Last Stand: Wenn von einem Heer nur noch wenige übrig sind, halten sie
   * deutlich mehr aus – beim Spieler stärker als beim Gegner. So entstehen
   * knappe Enden statt einseitiger Runden.
   */
  private updateLastStand(): void {
    this.countMobile();
    const ratio = [this.mobileNow[0]! / this.roundMobile[0]!, this.mobileNow[1]! / this.roundMobile[1]!];
    for (let tm = 0; tm < 2; tm++) {
      if (this.state !== 'fight' || this.mobileNow[tm] === 0) {
        this.lastStand[tm] = 1;
        this.lastStandDmg[tm] = 1;
        continue;
      }
      // Rückstand gegenüber dem Gegner + „nur noch wenige übrig“
      const behind = Math.max(0, Math.min(1, (ratio[1 - tm]! - ratio[tm]! - 0.05) / 0.3));
      const few = Math.max(0, Math.min(1, (0.35 - ratio[tm]!) / 0.35));
      const k = Math.max(behind, few * 0.7);
      const player = tm === 0;
      this.lastStand[tm] = 1 - (player ? 0.6 : 0.3) * k;
      this.lastStandDmg[tm] = 1 + (player ? 0.9 : 0.3) * k;
      if (k > 0.35 && !this.lastStandShown[tm]) {
        this.lastStandShown[tm] = true;
        this.events.push({ t: 'text', x: player ? 150 : 490, y: 60, text: 'LAST STAND!', color: player ? '#ffe23a' : '#ff8a6a' });
      }
    }
  }

  private mobile(tm: number): number {
    let n = 0;
    for (let i = 0; i < this.hw; i++) if (this.alive[i] && this.team[i] === tm && !this.types[this.type[i]!]!.building) n++;
    return n;
  }

  private checkRound(): void {
    const m0 = this.mobile(0);
    const m1 = this.mobile(1);
    if (this.state === 'fight') {
      if (m0 === 0 || m1 === 0 || this.time > ROUND_RUSH) this.state = 'march';
    }
    if (this.bossDead || this.bossFled) {
      this.endRound();
      return;
    }
    if (this.baseHp[0]! <= 0 || this.baseHp[1]! <= 0) {
      this.endRound();
      return;
    }
    if (this.state === 'march' && m0 + m1 === 0) this.endRound();
    else if (this.time > ROUND_RUSH + 40) this.endRound();
  }

  private endRound(): void {
    this.state = 'over';
    if (this.bossIdx >= 0 && this.alive[this.bossIdx]) this.bossHp = this.hp[this.bossIdx]!;
    const m = this.mods[0];
    if (m?.castleHeal) this.baseHp[0] = Math.min(this.baseMax[0]!, this.baseHp[0]! + m.castleHeal);
  }

  /**
   * Belagerung: ab Runde 4 trifft jede Einheit die Burg härter (+50 % je Runde),
   * damit sich zwei gleich starke Heere nicht endlos gegenseitig auslöschen.
   */
  get siegeMul(): number {
    return 1 + Math.max(0, this.round - 3) * 0.5;
  }

  /** Ergebnis des ganzen Kampfes (nach einer Runde abfragen). */
  get outcome(): 'win' | 'lose' | 'next' {
    if (this.baseHp[0]! <= 0) return 'lose';
    if (this.baseHp[1]! <= 0 || this.bossDead || this.bossFled) return 'win';
    return 'next';
  }

  private validTarget(i: number): boolean {
    const t = this.target[i]!;
    return t >= 0 && this.alive[t] === 1 && this.gen[t] === this.targetGen[i];
  }

  private nearestEnemy(team: number, x: number, y: number, maxCells: number, preferWounded = false): number {
    const g = this.grids[1 - team]!;
    const cols = g.cols;
    const rows = g.rows;
    const cs = g.cs;
    const cellStart = g.cellStart;
    const items = g.items;
    const X = this.x;
    const Y = this.y;
    const cx = g.cellX(x);
    const cy = g.cellY(y);
    // Zellen, die garantiert keinen Näheren enthalten, werden übersprungen
    // (untere Schranke der Distanz; Suchreihenfolge und Ergebnis bleiben gleich).
    // SLACK: Einheiten können sich seit dem Rasterbau im selben Schritt etwas
    // aus ihrer Zelle bewegt haben (Laufen, Rückstoß durch Ansturm/Wirbel).
    const SLACK = 8;
    const prune = !preferWounded;
    const wMin = this.tauntN[1 - team]! > 0 ? 0.05 : 1;
    let best = -1;
    let bestD = Infinity;
    for (let r = 1; r <= maxCells; r = r < 3 ? r + 1 : r * 2) {
      const x0 = Math.max(0, cx - r);
      const x1 = Math.min(cols - 1, cx + r);
      const y0 = Math.max(0, cy - r);
      const y1 = Math.min(rows - 1, cy + r);
      // von der eigenen Zelle nach außen: der Nächste wird früh gefunden,
      // danach fallen weiter entfernte Zellen durch die Schranke weg
      // die ersten n Einträge ab der eigenen Zelle liegen genau im Radius r
      const nr = Math.min(cy, r) + Math.min(rows - 1 - cy, r) + 1;
      const nc = Math.min(cx, r) + Math.min(cols - 1 - cx, r) + 1;
      const rowBase = cy * rows;
      const colBase = cx * cols;
      for (let oy = 0; oy < nr; oy++) {
        const yy = this.rowOrd[rowBase + oy]!;
        const row = yy * cols;
        // Zellen einer Zeile liegen hintereinander: leerer Abschnitt in O(1) erkennbar
        if (cellStart[row + x0] === cellStart[row + x1 + 1]) continue;
        const ddy = Math.max(0, (yy > 0 && y < yy * cs ? yy * cs - y : yy < rows - 1 && y > (yy + 1) * cs ? y - (yy + 1) * cs : 0) - SLACK);
        const ddy2 = ddy * ddy;
        if (prune && bestD !== Infinity && ddy2 * wMin >= bestD) continue;
        for (let ox = 0; ox < nc; ox++) {
          const xx = this.colOrd[colBase + ox]!;
          const c = yy * cols + xx;
          let k = cellStart[c]!;
          const e = cellStart[c + 1]!;
          if (k === e) continue;
          if (prune && bestD !== Infinity) {
            const ddx = Math.max(0, (xx > 0 && x < xx * cs ? xx * cs - x : xx < cols - 1 && x > (xx + 1) * cs ? x - (xx + 1) * cs : 0) - SLACK);
            if ((ddx * ddx + ddy2) * wMin >= bestD) continue;
          }
          for (; k < e; k++) {
            const j = items[k]!;
            const dx = X[j]! - x;
            const dy = Y[j]! - y;
            let d = dx * dx + dy * dy;
            if (preferWounded) d *= 0.2 + this.hp[j]! / this.maxHp[j]!;
            if (this.uFlags[j]! & U_TAUNT) d *= 0.05;
            if (d < bestD) {
              bestD = d;
              best = j;
            }
          }
        }
      }
      if (best >= 0) return best;
      if (r >= maxCells) break;
    }
    return best;
  }

  private randomEnemy(team: number): number {
    const n = this.teamN[1 - team]!;
    if (n === 0) return -1;
    return this.teamIds[1 - team]![Math.floor(this.random() * n)]!;
  }

  private forEachInRadius(team: number, x: number, y: number, r: number, fn: (j: number) => void): void {
    const g = this.grids[team]!;
    const x0 = g.cellX(x - r);
    const x1 = g.cellX(x + r);
    const y0 = g.cellY(y - r);
    const y1 = g.cellY(y + r);
    const r2 = r * r;
    for (let cy = y0; cy <= y1; cy++)
      for (let cx = x0; cx <= x1; cx++) {
        const c = cy * g.cols + cx;
        for (let k = g.cellStart[c]!, e = g.cellStart[c + 1]!; k < e; k++) {
          const j = g.items[k]!;
          if (!this.alive[j]) continue;
          const dx = this.x[j]! - x;
          const dy = this.y[j]! - y;
          if (dx * dx + dy * dy <= r2) fn(j);
        }
      }
  }

  private updateUnit(i: number): void {
    const t = this.types[this.type[i]!]!;
    const tm = this.team[i]!;
    const dir = tm === 0 ? 1 : -1;

    if (this.flashT[i]! > 0) this.flashT[i]! -= DT;
    if (this.atkT[i]! > 0) this.atkT[i]! -= DT;
    if (this.slowT[i]! > 0) {
      this.slowT[i]! -= DT;
      if (this.slowT[i]! <= 0) this.slowMul[i] = 1;
    }
    if (this.burnT[i]! > 0) {
      this.burnT[i]! -= DT;
      this.damage(i, this.burnDps[i]! * DT, -1, false, false);
      if (!this.alive[i]) return;
    }
    if (t.regen > 0 && this.hp[i]! < this.maxHp[i]!) this.hp[i] = Math.min(this.maxHp[i]!, this.hp[i]! + this.maxHp[i]! * t.regen * DT);

    // Boss: Flucht unter 25 % (Rusk)
    if (t.boss && this.boss?.passive.name === 'Cowardly' && this.hp[i]! < this.maxHp[i]! * 0.25) {
      this.x[i]! += 30 * DT;
      this.animT[i]! += DT * 3;
      if (this.x[i]! > FX1 - 4) {
        this.bossFled = true;
        this.alive[i] = 0;
        this.free.push(i);
        this.events.push({ t: 'text', x: FX1 - 40, y: this.y[i]! - 30, text: 'FLED!', color: '#ffe23a' });
      }
      return;
    }

    const lowHp = this.hp[i]! < this.maxHp[i]! * 0.5;
    const speed = t.speed * this.slowMul[i]!;
    this.abilityTick(i, t);

    // Im Marsch: direkt zur gegnerischen Burg
    const marching = this.state === 'march' || this.time > ROUND_RUSH;
    if (marching && !t.building) {
      const tx = tm === 0 ? FX1 + 4 : FX0 - 4;
      const tgt = this.nearestEnemy(tm, this.x[i]!, this.y[i]!, 2);
      if (tgt >= 0) {
        this.target[i] = tgt;
        this.targetGen[i] = this.gen[tgt]!;
      } else {
        this.moveToward(i, tx, this.y[i]!, speed, t);
        this.checkBase(i, t);
        return;
      }
    }

    this.retarget[i]! -= DT;
    if (!this.validTarget(i) || this.retarget[i]! <= 0) {
      this.retarget[i] = 0.25 + this.random() * 0.2;
      const j = t.building || t.attack === 'siege' ? (this.validTarget(i) ? this.target[i]! : this.randomEnemy(tm)) : this.nearestEnemy(tm, this.x[i]!, this.y[i]!, 12, t.ability === 'flying');
      this.target[i] = j;
      if (j >= 0) this.targetGen[i] = this.gen[j]!;
    }

    if (this.cd[i]! > 0) this.cd[i]! -= DT;
    const tgt = this.validTarget(i) ? this.target[i]! : -1;
    let dvx = 0;
    let dvy = 0;
    if (tgt >= 0) {
      const tt = this.types[this.type[tgt]!]!;
      const dx = this.x[tgt]! - this.x[i]!;
      const dy = this.y[tgt]! - this.y[i]!;
      const d = Math.hypot(dx, dy) || 0.001;
      const reach = t.attack === 'melee' ? t.radius + tt.radius + 1.5 : t.attack === 'heal' ? t.range : t.range;
      if (d > reach && !t.building) {
        dvx = (dx / d) * speed;
        dvy = (dy / d) * speed;
      } else {
        if ((t.attack === 'bolt' || t.attack === 'arrow' || t.attack === 'heal') && tt.attack === 'melee' && d < (t.champion ? 60 : 18)) {
          dvx = (-dx / d) * speed;
          dvy = (-dy / d) * speed * 0.5;
        }
        if (this.cd[i]! <= 0 && t.dmg > 0) {
          this.cd[i] = t.interval;
          this.attack(i, t, tgt, lowHp);
          if (t.doubleFirst && this.firstHit[i]) this.attack(i, t, tgt, lowHp);
          this.firstHit[i] = 0;
        }
      }
    } else if (!t.building) {
      dvx = dir * speed;
      dvy = Math.sign(this.centroidY[1 - tm]! - this.y[i]!) * speed * 0.15;
    }
    if (t.building) return;
    const a = 0.2;
    this.vx[i] = this.vx[i]! + (dvx - this.vx[i]!) * a;
    this.vy[i] = this.vy[i]! + (dvy - this.vy[i]!) * a;
    this.x[i] = Math.max(FX0 - 6, Math.min(FX1 + 6, this.x[i]! + this.vx[i]! * DT));
    this.y[i] = Math.max(FY0, Math.min(FY1, this.y[i]! + this.vy[i]! * DT));
    const moving = Math.abs(this.vx[i]!) + Math.abs(this.vy[i]!) > 3;
    this.animT[i]! += DT * (moving ? Math.max(2, speed / 9) : 0.4);
  }

  private moveToward(i: number, tx: number, ty: number, speed: number, t: UType): void {
    const dx = tx - this.x[i]!;
    const dy = ty - this.y[i]!;
    const d = Math.hypot(dx, dy) || 1;
    this.vx[i] = this.vx[i]! + ((dx / d) * speed - this.vx[i]!) * 0.2;
    this.vy[i] = this.vy[i]! * 0.8;
    this.x[i]! += this.vx[i]! * DT;
    this.y[i] = Math.max(FY0, Math.min(FY1, this.y[i]! + this.vy[i]! * DT));
    this.animT[i]! += DT * Math.max(2, t.speed / 9);
  }

  private checkBase(i: number, t: UType): void {
    const tm = this.team[i]!;
    if ((tm === 0 && this.x[i]! >= FX1) || (tm === 1 && this.x[i]! <= FX0)) {
      const enemy = 1 - tm;
      // Jede Einheit trifft die Burg mit ihrem Anteil an den HP des eigenen Heeres:
      // ein ganzes Heer macht CASTLE_ARMY Schaden, egal ob 12 Magier oder 240 Zombies
      const dmg = (t.boss ? BOSS_CASTLE : Math.max(0.2, (CASTLE_ARMY * this.maxHp[i]!) / Math.max(1, this.armyHp[tm]!))) * this.siegeMul;
      this.baseHp[enemy] = Math.max(0, this.baseHp[enemy]! - dmg);
      this.survivorsAtBase[tm]!++;
      this.events.push({ t: 'base', team: enemy, y: this.y[i]! });
      this.remove(i);
    }
  }

  // --- Fähigkeiten mit eigenem Zeitgeber ---------------------------------------------

  private abilityTick(i: number, t: UType): void {
    const ab = t.ability;
    if (!ab || this.state !== 'fight') return;
    this.abilT[i]! -= DT;
    if (this.abilT[i]! > 0) return;
    const tm = this.team[i]!;
    const x = this.x[i]!;
    const y = this.y[i]!;
    switch (ab) {
      case 'whirlwind':
        this.abilT[i] = 5;
        this.forEachInRadius(1 - tm, x, y, 14, (j) => {
          this.damage(j, t.dmg * 0.5, i, false, false);
          this.x[j]! += Math.sign(this.x[j]! - x || 1) * 7;
        });
        this.events.push({ t: 'boom', x, y, r: 16, color: '#ffffff', fx: 'whirl' });
        break;
      case 'moonheal':
        this.abilT[i] = 4;
        this.forEachInRadius(tm, x, y, 44, (j) => (this.hp[j] = Math.min(this.maxHp[j]!, this.hp[j]! + this.maxHp[j]! * 0.2)));
        this.events.push({ t: 'aura', x, y, r: 44, fx: 'moon' });
        break;
      case 'blessing':
        this.abilT[i] = 4;
        this.forEachInRadius(tm, x + (tm === 0 ? 30 : -30), y, 30, (j) => (this.shield[j] = Math.max(this.shield[j]!, t.dmg * 2.5)));
        this.events.push({ t: 'aura', x: x + (tm === 0 ? 30 : -30), y, r: 30, fx: 'bless' });
        break;
      case 'chaplain':
        this.abilT[i] = 3;
        this.forEachInRadius(tm, x, y, 30, (j) => (this.hp[j] = Math.min(this.maxHp[j]!, this.hp[j]! + this.maxHp[j]! * 0.1)));
        this.events.push({ t: 'aura', x, y, r: 30, fx: 'mend' });
        break;
      case 'raise': {
        // Necromancer: alle 3 s ein Skelett vor sich aus dem Boden
        // stark: alle 2,5 s zwei zähe Skelette, ohne Obergrenze
        this.abilT[i] = 2.5;
        const st = this.summonType(tm, 'plague', 'skeleton', 'Summon', t.raw.hp * 1.15, t.raw.dmg * 1.6);
        const dir = tm === 0 ? 1 : -1;
        for (let n = 0; n < 2; n++) this.spawn(st, x + dir * (6 + this.random() * 8), y + (this.random() - 0.5) * 14, true);
        this.atkT[i] = 0.3;
        break;
      }
      case 'harvest': {
        // The Lich: alle 4 s erhebt sich ein Necromancer an seiner Seite
        this.abilT[i] = 4;
        const nt = this.necroType(tm);
        if (nt < 0) break;
        const dir = tm === 0 ? 1 : -1;
        const j = this.spawn(nt, x - dir * (10 + this.random() * 8), y + (this.random() - 0.5) * 24, true);
        if (j >= 0) this.abilT[j] = 1.5;
        this.atkT[i] = 0.3;
        break;
      }
      case 'root':
        this.abilT[i] = 6;
        this.forEachInRadius(1 - tm, x, y, 34, (j) => {
          this.slowT[j] = 3;
          this.slowMul[j] = 0;
        });
        this.events.push({ t: 'boom', x, y, r: 34, color: '#7cd24a', fx: 'root' });
        break;
      default:
        this.abilT[i] = 999;
    }
  }

  private attack(i: number, t: UType, tgt: number, lowHp: boolean): void {
    const tm = this.team[i]!;
    // Wut: +20 %, unter 50 % HP doppelter Schaden
    let dmg = t.dmg * (t.rage ? (lowHp ? 1 + 1 * t.rage : 1 + 0.2 * t.rage) : 1) * (this.bannerAlive[tm] ? 1.15 : 1) * (this.chaplainAlive[tm] && t.ability !== 'chaplain' ? 1.1 : 1);
    dmg *= this.lastStandDmg[tm]!;
    if (t.ability === 'pack') dmg *= 1.3;
    if (t.ability === 'harvest') dmg += this.deaths * 2 * DMG_SCALE * 0.1;
    if (t.champion) dmg *= Math.pow(1.25, this.championsSlain[tm]!);
    if (t.charge && this.firstHit[i]) dmg *= 3;
    this.atkT[i] = 0.18;
    const x = this.x[i]!;
    const y = this.y[i]!;
    const tx = this.x[tgt]!;
    const ty = this.y[tgt]!;
    switch (t.attack) {
      case 'melee': {
        this.sfxTally.melee++;
        if (t.ability === 'tentacles') {
          let n = 0;
          this.forEachInRadius(1 - tm, x, y, t.radius + 14, (j) => {
            if (n++ < 4) this.damage(j, dmg, i, true, false);
          });
        } else this.damage(tgt, dmg, i, true, false);
        // Champions und Bosse spalten: jeder Hieb trifft bis zu 4 weitere Gegner ums Ziel
        if (t.champion || t.boss) {
          let n = 0;
          this.forEachInRadius(1 - tm, tx, ty, t.radius + 6, (j) => {
            if (j !== tgt && n++ < 3) this.damage(j, dmg * 0.35, i, true, false);
          });
        }
        if (t.ability === 'burn') this.ignite(tgt, t.dmg * 0.4, 2);
        if (t.ability === 'grip' || (t.ability === 'stuncharge' && this.firstHit[i])) {
          this.slowT[tgt] = 1.5;
          this.slowMul[tgt] = 0;
        }
        if (t.charge && this.firstHit[i]) {
          this.x[tgt]! += (tm === 0 ? 1 : -1) * 6;
          this.events.push({ t: 'hit', x: tx, y: ty - 3, color: '#ffffff', big: true });
        }
        break;
      }
      case 'arrow':
        this.fire(P_ARROW, i, x, y - 5, tx, ty, 190, dmg, tgt, 0);
        this.sfxTally.arrows++;
        this.sfxTally.arrowX += x;
        break;
      case 'bolt': {
        if (t.ability === 'chain') {
          const pts = [x, y - 6, tx, ty - 4];
          this.damage(tgt, dmg, i, false, true);
          let last = tgt;
          const hit = new Set([tgt]);
          for (let k = 0; k < 4; k++) {
            let best = -1;
            let bd = 900;
            this.forEachInRadius(1 - tm, this.x[last]!, this.y[last]!, 30, (j) => {
              if (hit.has(j)) return;
              const d = (this.x[j]! - this.x[last]!) ** 2 + (this.y[j]! - this.y[last]!) ** 2;
              if (d < bd) {
                bd = d;
                best = j;
              }
            });
            if (best < 0) break;
            hit.add(best);
            this.damage(best, dmg * 0.7, i, false, true);
            pts.push(this.x[best]!, this.y[best]! - 4);
            last = best;
          }
          this.events.push({ t: 'chain', pts, color: '#c8ffb0' });
        } else if (t.ability === 'sunbeam' || t.ability === 'cannon') {
          // Sonnenstrahl (bzw. Magus neben Deepforge: durchschlagender Steinschuss)
          const sun = t.ability === 'sunbeam';
          this.lineDamage(tm, x, ty, dmg * 0.4, i, 6);
          this.events.push({ t: 'beam', x0: x, y: ty, x1: tm === 0 ? FX1 : FX0, color: sun ? '#fff0a0' : '#ffd9a0', fx: sun ? 'sun' : 'cannon' });
        } else {
          this.fire(P_BOLT, i, x, y - 6, tx, ty, 140, dmg, tgt, 0);
          this.events.push({ t: 'cast', x, y: y - 6, tx, ty, color: t.glow, siege: false });
        }
        break;
      }
      case 'heal': {
        this.fire(P_BOLT, i, x, y - 6, tx, ty, 140, dmg, tgt, 0);
        this.events.push({ t: 'cast', x, y: y - 6, tx, ty, color: t.glow, siege: false });
        break;
      }
      case 'siege': {
        if (t.ability === 'cannon') {
          this.lineDamage(tm, x, ty, dmg * 0.5, i, 6);
          this.events.push({ t: 'beam', x0: x, y: ty, x1: tm === 0 ? FX1 : FX0, color: '#ffd9a0', fx: 'cannon' });
          this.shake = Math.min(1.4, this.shake + 0.25);
        } else {
          const p = this.fire(P_ROCK, i, x, y - 14, tx + (this.random() - 0.5) * 10, ty + (this.random() - 0.5) * 10, 0, dmg, -1, 0);
          if (p >= 0) this.pDur[p] = 1 + Math.abs(tx - x) / 700;
          if (p >= 0) this.events.push({ t: 'cast', x, y: y - 14, tx, ty, color: t.glow, siege: true });
        }
        break;
      }
    }
  }

  /** Strich-Angriff (Kanone, Sonnenstrahl): trifft die ersten `maxHits` Gegner in einer Linie. */
  private lineDamage(tm: number, x: number, y: number, dmg: number, src: number, maxHits = 6): void {
    const dir = tm === 0 ? 1 : -1;
    const g = this.grids[1 - tm]!;
    const cy0 = g.cellY(y - 6);
    const cy1 = g.cellY(y + 6);
    const hits: number[] = [];
    for (let cy = cy0; cy <= cy1; cy++)
      for (let cx = 0; cx < g.cols; cx++) {
        const c = cy * g.cols + cx;
        for (let k = g.cellStart[c]!, e = g.cellStart[c + 1]!; k < e; k++) {
          const j = g.items[k]!;
          if (this.alive[j] && Math.abs(this.y[j]! - y) < 5 && (this.x[j]! - x) * dir > 0) hits.push(j);
        }
      }
    hits.sort((a, b) => (this.x[a]! - this.x[b]!) * dir);
    for (let k = 0; k < Math.min(maxHits, hits.length); k++) this.damage(hits[k]!, dmg, src, false, true);
  }

  private ignite(j: number, dps: number, dur: number): void {
    if (!this.alive[j]) return;
    this.burnT[j] = Math.max(this.burnT[j]!, dur);
    this.burnDps[j] = Math.max(this.burnDps[j]!, dps);
  }

  private fire(kind: number, src: number, x: number, y: number, tx: number, ty: number, speed: number, dmg: number, tgt: number, _z: number): number {
    const p = this.pFree.length > 0 ? this.pFree.pop()! : this.pHw < MAX_PROJ ? this.pHw++ : -1;
    if (p < 0) return -1;
    this.pAlive[p] = 1;
    this.pKind[p] = kind;
    this.pTeam[p] = this.team[src]!;
    this.pX[p] = x;
    this.pY[p] = y;
    this.pSX[p] = x;
    this.pSY[p] = y;
    this.pTX[p] = tx;
    this.pTY[p] = ty;
    this.pZ[p] = 0;
    this.pT[p] = 0;
    this.pDur[p] = speed > 0 ? 6 : 1;
    this.pDmg[p] = dmg;
    this.pSrcType[p] = this.type[src]!;
    this.pTarget[p] = tgt;
    this.pTargetGen[p] = tgt >= 0 ? this.gen[tgt]! : 0;
    this.pColor[p] = this.types[this.type[src]!]!.glow;
    const d = Math.hypot(tx - x, ty - y) || 1;
    this.pSX[p] = ((tx - x) / d) * speed; // Geschwindigkeit
    this.pSY[p] = ((ty - y) / d) * speed;
    return p;
  }

  private killProj(p: number): void {
    this.pAlive[p] = 0;
    this.pFree.push(p);
  }

  private updateProjectiles(): void {
    for (let p = 0; p < this.pHw; p++) {
      if (!this.pAlive[p]) continue;
      this.pT[p]! += DT;
      const st = this.types[this.pSrcType[p]!]!;
      const tm = this.pTeam[p]!;
      if (this.pKind[p] === P_ROCK) {
        const u = Math.min(1, this.pT[p]! / this.pDur[p]!);
        this.pZ[p] = 4 * 60 * u * (1 - u);
        if (u >= 1) {
          const x = this.pTX[p]!;
          const y = this.pTY[p]!;
          const ab = st.ability;
          const r = ab === 'boulder' ? 22 : ab === 'firepots' ? 14 : 12;
          this.forEachInRadius(1 - tm, x, y, r, (j) => {
            this.damage(j, this.pDmg[p]! * (ab === 'boulder' ? 1 : 0.8), -1, false, true);
            if (ab === 'firepots') this.ignite(j, st.dmg * 0.3, 5);
          });
          if (ab === 'corpsecart') {
            const zt = this.summonType(tm, 'plague', 'ghoul', 'Summon', st.raw.hp * 0.16, st.raw.dmg * 0.17);
            for (let k = 0; k < 3; k++) this.spawn(zt, x + (this.random() - 0.5) * 10, y + (this.random() - 0.5) * 8, true);
          }
          this.events.push({ t: 'boom', x, y, r, color: ab === 'firepots' ? '#ff8a3a' : '#c8c0b0', fx: ab === 'firepots' ? 'fire' : ab === 'boulder' ? 'boulder' : 'rock' });
          this.shake = Math.min(1.4, this.shake + (ab === 'boulder' ? 0.3 : 0.12));
          this.killProj(p);
        }
        continue;
      }
      const tgt = this.pTarget[p]!;
      const valid = tgt >= 0 && this.alive[tgt] && this.gen[tgt] === this.pTargetGen[p];
      if (valid) {
        this.pTX[p] = this.x[tgt]!;
        this.pTY[p] = this.y[tgt]! - 4;
      }
      const dx = this.pTX[p]! - this.pX[p]!;
      const dy = this.pTY[p]! - this.pY[p]!;
      const d = Math.hypot(dx, dy);
      const sp = Math.hypot(this.pSX[p]!, this.pSY[p]!) || 140;
      if (d <= sp * DT + 1) {
        if (valid) {
          const ab = st.ability;
          if (st.attack === 'heal') {
            this.damage(tgt, this.pDmg[p]!, -1, false, true);
          } else if (ab === 'frostnova') {
            this.forEachInRadius(1 - tm, this.pTX[p]!, this.pTY[p]!, 11, (j) => {
              this.damage(j, this.pDmg[p]! * 0.6, -1, false, true);
              this.slowT[j] = 2;
              this.slowMul[j] = 0;
            });
            this.events.push({ t: 'boom', x: this.pTX[p]!, y: this.pTY[p]!, r: 11, color: '#bff4ff', fx: 'frost' });
          } else {
            this.damage(tgt, this.pDmg[p]!, -1, false, true);
            if (ab === 'slow') {
              this.slowT[tgt] = 2;
              this.slowMul[tgt] = 0.75;
            }
            if (ab === 'firebolt') this.ignite(tgt, st.dmg * 0.5, 3);
            if (ab === 'poison') {
              this.burnT[tgt] = 4;
              this.burnDps[tgt] = this.burnDps[tgt]! + st.dmg * 0.25;
            }
          }
          this.events.push({ t: 'hit', x: this.pTX[p]!, y: this.pTY[p]!, color: this.pColor[p] ?? '#fff' });
        }
        this.killProj(p);
        continue;
      }
      this.pSX[p] = (dx / d) * sp;
      this.pSY[p] = (dy / d) * sp;
      this.pX[p]! += this.pSX[p]! * DT;
      this.pY[p]! += this.pSY[p]! * DT;
      if (this.pT[p]! > this.pDur[p]!) this.killProj(p);
    }
  }

  /** Schaden. `src` = Angreifer (für Kill-Effekte) oder -1. */
  damage(i: number, dmg: number, src: number, melee: boolean, ranged: boolean, carry = 0): void {
    if (!this.alive[i]) return;
    const t = this.types[this.type[i]!]!;
    const tm = this.team[i]!;
    if (ranged) dmg *= t.rangedArmor;
    let armor = t.armor;
    dmg = Math.max(dmg * 0.25, dmg - armor);
    // Disziplin (Gold): weniger Schaden
    if (this.discipline[tm]) dmg *= 1 - Math.min(0.6, 0.35 * this.discipline[tm]!);
    dmg *= this.lastStand[tm]!;
    if (this.shield[i]! > 0) {
      const a = Math.min(this.shield[i]!, dmg);
      this.shield[i]! -= a;
      dmg -= a;
    }
    this.hp[i]! -= dmg;
    if (dmg > 0.05) this.flashT[i] = 0.06;
    if (melee && this.random() < 0.2) this.events.push({ t: 'hit', x: this.x[i]!, y: this.y[i]! - 4, color: '#ffffff' });
    // Riposte: jeder 3. Nahkampftreffer wird doppelt erwidert
    if (melee && t.ability === 'riposte' && src >= 0 && this.alive[src]) {
      if (++this.hitsTaken[i]! % 3 === 0) this.damage(src, t.dmg * 2, -1, false, false);
    }
    if (t.boss) this.bossHp = Math.max(0, this.hp[i]!);
    if (this.hp[i]! <= 0) {
      const excess = -this.hp[i]!;
      const x = this.x[i]!;
      const y = this.y[i]!;
      this.kill(i, src);
      // Überschuss-Schaden springt auf einen Gegner direkt daneben über (bis zu 2-mal):
      // starke Einzelkämpfer verpuffen ihre Kraft so nicht an schwachen Massen
      if (carry < 2 && excess > 0.3 && (melee || ranged) && src >= 0) {
        let best = -1;
        let bd = 100;
        this.forEachInRadius(tm, x, y, 9, (j) => {
          const d = (this.x[j]! - x) ** 2 + (this.y[j]! - y) ** 2;
          if (d < bd) {
            bd = d;
            best = j;
          }
        });
        if (best >= 0) this.damage(best, excess / Math.max(0.25, this.lastStand[tm]!), src, melee, ranged, carry + 1);
      }
    }
  }

  private kill(i: number, src: number): void {
    const t = this.types[this.type[i]!]!;
    const tm = this.team[i]!;
    const x = this.x[i]!;
    const y = this.y[i]!;
    this.kills[1 - tm]!++;
    this.deaths++;
    if (t.champion) this.championsSlain[1 - tm]!++;
    if (t.boss) {
      this.bossDead = true;
      this.bossHp = 0;
      this.shake = 2;
    }
    this.events.push({ t: 'death', x, y, vis: t.visKey, team: tm, big: t.scale > 1 || t.building, color: t.blood, boss: t.boss, burning: this.burnT[i]! > 0, flying: t.flying });
    this.remove(i);
    // Beim Tod
    if (t.ability === 'bloat' || t.ability === 'sporecloud') {
      this.forEachInRadius(1 - tm, x, y, 12, (j) => {
        if (t.ability === 'bloat') this.ignite(j, t.hp * 0.02 + 1 * DMG_SCALE, 3);
        else {
          this.slowT[j] = 2;
          this.slowMul[j] = 0.5;
        }
      });
      this.events.push({ t: 'boom', x, y, r: 12, color: t.ability === 'bloat' ? '#9dff6a' : '#ffe86a', fx: t.ability === 'bloat' ? 'bloat' : 'spore' });
    }
    if (t.ability === 'colossus') {
      this.forEachInRadius(1 - tm, x, y, 26, (j) => this.damage(j, t.dmg * 4, -1, false, false));
      this.events.push({ t: 'boom', x, y, r: 26, color: '#ffb060', fx: 'colossus' });
      this.shake = 1.6;
    }
    // Untote stehen wieder auf
    const endless = this.boss?.passive.name === 'Endless Dead' && tm === 1;
    const riseChance = endless ? Math.max(0.6, t.undeath) : t.undeath;
    const killer = src >= 0 ? this.types[this.type[src]!] : undefined;
    const zombifiedBy = killer?.ability === 'zombify' && this.alive[src];
    if (!t.boss && !t.building && (zombifiedBy || (riseChance > 0 && this.random() < riseChance))) {
      const zt = zombifiedBy ? 1 - tm : tm;
      if (this.summons[zt]! < 1500) {
        // Zombie Horde: neue Zombies haben die Werte der Horde. Untote Gefallene
        // (Rassenbonus, Morvath) stehen mit einem Teil ihrer alten Kraft auf.
        const keep = endless ? 0.3 : UNDEATH_KEEP;
        const zr = zombifiedBy ? killer!.raw : { hp: Math.max(4, t.raw.hp * keep), dmg: Math.max(3, t.raw.dmg * keep) };
        const ti = this.summonType(zt, 'plague', 'ghoul', 'Summon', Math.round(zr.hp), Math.round(zr.dmg));
        this.spawn(ti, x, y, true);
        this.summons[zt]!++;
      }
    }
  }

  private remove(i: number): void {
    this.alive[i] = 0;
    this.free.push(i);
  }

  /** Blau (Tidebound): alle 10 s eine weitere Flutwelle, die Gegner zurückwirft und bremst. */
  private tideTick(): void {
    if (this.state !== 'fight') return;
    for (const b of this.bonuses) {
      if (b.race !== 'tidebound') continue;
      this.tideT[b.team]! += DT;
      if (this.tideT[b.team]! >= 12) {
        this.tideT[b.team] = 0;
        this.tidalWave(1 - b.team, 20, 1.5, 0.07 * (this.mods[b.team]?.bonusMul ?? 1));
      }
    }
  }

  private tidalWave(team: number, dist: number, slow = 0, dmgPct = 0): void {
    const dir = team === 0 ? -1 : 1;
    for (let i = 0; i < this.hw; i++) {
      if (!this.alive[i] || this.team[i] !== team) continue;
      const t = this.types[this.type[i]!]!;
      if (t.building || t.boss) continue;
      this.x[i] = Math.max(FX0 + 2, Math.min(FX1 - 2, this.x[i]! + dir * dist));
      if (slow > 0) {
        this.slowT[i] = Math.max(this.slowT[i]!, slow);
        this.slowMul[i] = Math.min(this.slowMul[i]!, 0.5);
      }
      if (dmgPct > 0) this.damage(i, this.maxHp[i]! * dmgPct, -1, false, false);
    }
    this.events.push({ t: 'wave', team });
  }

  // --- Boss-Passiv --------------------------------------------------------------------------

  private bossPassive(): void {
    if (!this.boss || this.state !== 'fight') return;
    this.passiveT += DT;
    const p = this.boss.passive.name;
    if (p === 'Scorched Earth' && this.passiveT >= 8) {
      this.passiveT = 0;
      const x = FX0 + 60 + this.random() * 300;
      const y = FY0 + 20 + this.random() * (FY1 - FY0 - 40);
      this.forEachInRadius(0, x, y, 20, (j) => this.ignite(j, 3 * DMG_SCALE, 5));
      this.events.push({ t: 'boom', x, y, r: 20, color: '#ff5a2a', fx: 'meteor' });
    } else if (p === 'Overgrowth' && this.passiveT >= 6) {
      this.passiveT = 0;
      for (let k = 0; k < this.teamN[0]!; k++) {
        const j = this.teamIds[0]![k]!;
        if (this.types[this.type[j]!]!.race === 'wildwood') continue;
        this.slowT[j] = 2;
        this.slowMul[j] = 0.6;
        this.damage(j, 0.5 * DMG_SCALE, -1, false, false);
      }
      this.events.push({ t: 'text', x: 320, y: 60, text: 'OVERGROWTH', color: '#9dff6a' });
    } else if (p === 'Rising Tide' && this.passiveT >= 20) {
      this.passiveT = 0;
      this.tidalWave(0, 40);
    } else if (p === 'Endless Legion' && this.passiveT >= 15) {
      this.passiveT = 0;
      const leg = cardsOf('sunlegion').find((k) => k.name === 'Legionnaires')!;
      const ti = this.summonType(1, 'sunlegion', leg.kind, 'Infantry', leg.hp, leg.dmg);
      for (let k = 0; k < 15; k++) this.spawn(ti, FX1 - 10 - this.random() * 20, FY0 + 10 + this.random() * (FY1 - FY0 - 20), true);
    }
  }

  // --- Kollision ------------------------------------------------------------------------------

  private separate(): void {
    const pushX = this.pushX;
    const pushY = this.pushY;
    const X = this.x;
    const Y = this.y;
    const alive = this.alive;
    const rad = this.uRad;
    const scl = this.uScale;
    const flags = this.uFlags;
    // Rasterinhalte mit aktuellen Positionen in Rasterreihenfolge kopieren
    for (let tm = 0; tm < 2; tm++) {
      const items = this.grids[tm]!.items;
      const gx = this.gX[tm]!;
      const gy = this.gY[tm]!;
      const gr = this.gR[tm]!;
      const gs = this.gS[tm]!;
      const gf = this.gF[tm]!;
      for (let n = 0, e = this.teamN[tm]!; n < e; n++) {
        const j = items[n]!;
        gx[n] = X[j]!;
        gy[n] = Y[j]!;
        gr[n] = rad[j]!;
        gs[n] = scl[j]!;
        gf[n] = alive[j] ? flags[j]! : U_DEAD;
      }
    }
    for (let tm = 0; tm < 2; tm++) {
      const ids = this.teamIds[tm]!;
      for (let k = 0; k < this.teamN[tm]!; k++) {
        const i = ids[k]!;
        pushX[i] = 0;
        pushY[i] = 0;
        if (!alive[i]) continue;
        const fi = flags[i]!;
        if (fi & U_BUILDING) continue;
        const flyI = fi & U_FLYING;
        const ri = rad[i]!;
        const si = scl[i]!;
        let px = 0;
        let py = 0;
        const x = X[i]!;
        const y = Y[i]!;
        for (let q = 0; q < 2; q++) {
          const gt = q === 0 ? tm : 1 - tm;
          const g = this.grids[gt]!;
          const gx = this.gX[gt]!;
          const gy = this.gY[gt]!;
          const gr = this.gR[gt]!;
          const gs = this.gS[gt]!;
          const gf = this.gF[gt]!;
          const cols = g.cols;
          const cx = g.cellX(x);
          const cy = g.cellY(y);
          const cellStart = g.cellStart;
          const items = g.items;
          const xa = cx > 0 ? cx - 1 : 0;
          const xb = cx < cols - 1 ? cx + 1 : cols - 1;
          const ya = cy > 0 ? cy - 1 : 0;
          const yb = cy < g.rows - 1 ? cy + 1 : g.rows - 1;
          let checks = 0;
          for (let yy = ya; yy <= yb && checks < 28; yy++) {
            // die drei Zellen einer Zeile liegen im Raster direkt hintereinander
            const row = yy * cols;
            for (let n = cellStart[row + xa]!, e = cellStart[row + xb + 1]!; n < e && checks < 28; n++) {
              const f = gf[n]!;
              // Fliegende nur untereinander; Gebäude blockieren hart (blockByBuildings)
              if (f & (U_DEAD | U_BUILDING) || (f & U_FLYING) !== flyI || items[n] === i) continue;
              checks++;
              const dx = x - gx[n]!;
              const dy = y - gy[n]!;
              const rr = ri + gr[n]!;
              const d2 = dx * dx + dy * dy;
              if (d2 >= rr * rr) continue;
              if (d2 < 0.0001) {
                // exakt übereinander: deterministisch auseinanderziehen
                const a = ((i * 2654435761) >>> 0) / 4294967296;
                px += Math.cos(a * 6.283) * 0.6;
                py += Math.sin(a * 6.283) * 0.6;
                continue;
              }
              const d = Math.sqrt(d2);
              const o = (rr - d) / d;
              const sj = gs[n]!;
              const w = sj > si ? 1.4 : sj < si ? 0.4 : 1;
              px += dx * o * w;
              py += dy * o * w;
            }
          }
        }
        // Schub pro Schritt begrenzen: sonst werden Einheiten in dichten Massen
        // weit weggeschleudert (auch durch Mauern) und „ploppen“ wieder heraus
        px *= 0.45;
        py *= 0.45;
        const len = Math.hypot(px, py);
        const MAX_PUSH = 1.2;
        if (len > MAX_PUSH) {
          px *= MAX_PUSH / len;
          py *= MAX_PUSH / len;
        }
        pushX[i] = px;
        pushY[i] = py;
      }
    }
    for (let tm = 0; tm < 2; tm++) {
      const ids = this.teamIds[tm]!;
      for (let k = 0; k < this.teamN[tm]!; k++) {
        const i = ids[k]!;
        if (!alive[i]) continue;
        const nx = X[i]! + pushX[i]!;
        const ny = Y[i]! + pushY[i]!;
        X[i] = nx < FX0 - 6 ? FX0 - 6 : nx > FX1 + 6 ? FX1 + 6 : nx;
        Y[i] = ny < FY0 ? FY0 : ny > FY1 ? FY1 : ny;
      }
    }
  }

  /**
   * Gegnerische Gebäude (Mauern, Belagerung) sind feste Hindernisse: niemand
   * wird durch sie hindurchgeschoben. Eigene Gebäude sind durchlaufbar.
   * Geprüft werden nur Gebäude in der Nähe (±3 Zellen waagrecht, ±1 senkrecht).
   */
  private blockByBuildings(): void {
    const X = this.x;
    const Y = this.y;
    for (let tm = 0; tm < 2; tm++) {
      const bn = this.buildN[1 - tm]!;
      if (bn === 0) continue;
      const bids = this.buildIds[1 - tm]!;
      const ids = this.teamIds[tm]!;
      const g = this.grids[1 - tm]!;
      for (let k = 0; k < this.teamN[tm]!; k++) {
        const i = ids[k]!;
        if (!this.alive[i] || this.uFlags[i]! & (U_BUILDING | U_FLYING)) continue;
        const ri = this.uRad[i]!;
        const cx = g.cellX(X[i]!);
        const cy = g.cellY(Y[i]!);
        for (let b = 0; b < bn; b++) {
          const j = bids[b]!;
          if (!this.alive[j]) continue;
          const xj = X[j]!;
          const yj = Y[j]!;
          if (Math.abs(g.cellX(xj) - cx) > 3 || Math.abs(g.cellY(yj) - cy) > 1) continue;
          const wall = this.uFlags[j]! & U_WALL;
          const rr = ri + this.uRad[j]!;
          if (!wall && Math.abs(X[i]! - xj) > rr) continue;
          const dx = X[i]! - xj;
          const dy = Y[i]! - yj;
          if (wall) {
            // Mauer = durchgehende Linie: Gegner bleiben auf ihrer Seite
            if (Math.abs(dy) > 7) continue;
            const ownerLeft = this.team[j] === 0;
            if (ownerLeft && X[i]! < xj + rr) X[i] = xj + rr;
            else if (!ownerLeft && X[i]! > xj - rr) X[i] = xj - rr;
            continue;
          }
          const d2 = dx * dx + dy * dy;
          if (d2 >= rr * rr) continue;
          if (d2 < 0.0001) {
            X[i]! += tm === 0 ? -rr : rr;
            continue;
          }
          const d = Math.sqrt(d2);
          X[i]! += (dx / d) * (rr - d);
          Y[i] = Math.max(FY0, Math.min(FY1, Y[i]! + (dy / d) * (rr - d)));
        }
      }
    }
  }
}

/**
 * Für jede Zelle c (0…n-1) die Reihenfolge c, c-1, c+1, c-2, c+2, … innerhalb
 * 0…n-1, hintereinander in einer Tabelle (Eintrag c * n + k).
 */
function outwardTable(n: number): Int32Array {
  const t = new Int32Array(n * n);
  for (let c = 0; c < n; c++) {
    let k = c * n;
    t[k++] = c;
    for (let d = 1; c - d >= 0 || c + d < n; d++) {
      if (c - d >= 0) t[k++] = c - d;
      if (c + d < n) t[k++] = c + d;
    }
  }
  return t;
}

const U_FLYING = 1;
const U_BUILDING = 2;
const U_WALL = 4;
const U_TAUNT = 8;
/** nur in gF: Einheit ist inzwischen tot */
const U_DEAD = 128;

export const P_ARROW = 0;
export const P_BOLT = 1;
export const P_ROCK = 2;

export { BOSSES };

import { PALETTES } from '../art/sprites';
import { GHOUL, SKELETON, type AttackKind, type CardDef } from '../data/cards';
import { Grid } from './grid';

// =====================================================================
// Massen-Kampfsimulation. Alles in flachen Typed-Arrays (Structure of
// Arrays), feste Schrittweite 1/60 s. Die Darstellung liest nur daraus
// und aus der Ereignis-Liste (Tode, Treffer, Effekte).
// =====================================================================

export const FIELD_W = 800;
export const FIELD_H = 360;
export const BASE_DEPTH = 24; // Breite der Basis-Zone an jedem Rand
export const BASE_HP = 300;
export const MAX_UNITS = 16000;
export const MAX_PROJ = 8000;
export const DT = 1 / 60;
export const MAX_TIME = 90;

const DMG_SCALE = 0.15;
const SUMMON_CAP = 1500;
const CELL = 16;

export type SimEvent =
  | { t: 'death'; x: number; y: number; vis: number; team: number; building: boolean; color: string }
  | { t: 'hit'; x: number; y: number; color: string }
  | { t: 'boom'; x: number; y: number; r: number; color: string }
  | { t: 'beam'; x0: number; y: number; x1: number; color: string }
  | { t: 'heal'; x: number; y: number; color: string }
  | { t: 'base'; team: number; y: number }
  | { t: 'spawn'; x: number; y: number; color: string };

/** Eine im Kampf verwendete Kartenvariante (inkl. Stufe & Seite). */
export interface UnitType {
  card: CardDef;
  vis: number; // Index in den Textur-Atlas (visuelle Figur)
  team: number;
  hp: number;
  dmg: number;
  interval: number;
  speed: number;
  range: number;
  radius: number;
  building: boolean;
  melee: boolean;
  glow: string;
  blood: string;
}

export interface SideSetup {
  card: CardDef;
  count: number;
  level: number;
}

export type BattleState = 'setup' | 'running' | 'done';

export class Battle {
  // --- Einheiten (SoA) ---
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
  readonly shield = new Float32Array(MAX_UNITS);
  readonly flashT = new Float32Array(MAX_UNITS);
  readonly atkT = new Float32Array(MAX_UNITS);
  readonly animT = new Float32Array(MAX_UNITS);
  readonly summonT = new Float32Array(MAX_UNITS);
  readonly buffDmgT = new Float32Array(MAX_UNITS);
  readonly buffHasteT = new Float32Array(MAX_UNITS);
  readonly revived = new Uint8Array(MAX_UNITS);
  readonly summoned = new Uint8Array(MAX_UNITS);
  hw = 0; // höchster jemals benutzter Index + 1
  private readonly free: number[] = [];

  // --- Geschosse ---
  readonly pAlive = new Uint8Array(MAX_PROJ);
  readonly pKind = new Uint8Array(MAX_PROJ); // Index in PROJ_KINDS
  readonly pTeam = new Uint8Array(MAX_PROJ);
  readonly pX = new Float32Array(MAX_PROJ);
  readonly pY = new Float32Array(MAX_PROJ);
  readonly pZ = new Float32Array(MAX_PROJ); // Höhe (Bogenwurf)
  readonly pVX = new Float32Array(MAX_PROJ);
  readonly pVY = new Float32Array(MAX_PROJ);
  readonly pTX = new Float32Array(MAX_PROJ);
  readonly pTY = new Float32Array(MAX_PROJ);
  readonly pT = new Float32Array(MAX_PROJ); // vergangene Zeit
  readonly pDur = new Float32Array(MAX_PROJ); // Flugdauer (Bogen) / max. Lebenszeit
  readonly pTarget = new Int32Array(MAX_PROJ);
  readonly pTargetGen = new Uint32Array(MAX_PROJ);
  readonly pDmg = new Float32Array(MAX_PROJ);
  readonly pSrcType = new Uint16Array(MAX_PROJ);
  readonly pHits = new Int32Array(MAX_PROJ * 3);
  readonly pHitCount = new Uint8Array(MAX_PROJ);
  pHw = 0;
  private readonly pFree: number[] = [];

  readonly types: UnitType[] = [];
  readonly events: SimEvent[] = [];

  state: BattleState = 'setup';
  time = 0;
  readonly baseHp = [BASE_HP, BASE_HP];
  readonly kills = [0, 0];
  readonly baseHits = [0, 0];
  readonly counts = [0, 0];
  readonly summons = [0, 0];
  winner: -1 | 0 | 1 | 2 = -1; // 2 = unentschieden
  shake = 0;

  private readonly grids = [
    new Grid(FIELD_W, FIELD_H, CELL, MAX_UNITS),
    new Grid(FIELD_W, FIELD_H, CELL, MAX_UNITS),
  ];
  private readonly teamIds = [new Int32Array(MAX_UNITS), new Int32Array(MAX_UNITS)];
  private readonly teamN = [0, 0];
  private readonly centroidY = [FIELD_H / 2, FIELD_H / 2];
  private readonly pushX = new Float32Array(MAX_UNITS);
  private readonly pushY = new Float32Array(MAX_UNITS);
  private rng = 12345;
  private tick = 0;

  constructor(private readonly visOf: (card: CardDef, team: number) => number) {}

  random(): number {
    // xorshift32 – deterministisch
    let s = this.rng;
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    this.rng = s >>> 0;
    return this.rng / 4294967296;
  }

  // -------------------------------------------------------------------
  // Aufbau
  // -------------------------------------------------------------------

  typeFor(card: CardDef, team: number, level: number): number {
    const found = this.types.findIndex((t) => t.card === card && t.team === team);
    if (found >= 0) return found;
    const mul = 1 + 0.15 * (level - 1);
    const haste = Math.min(1.5, 1 + 0.025 * (level - 1));
    const building = card.cls === 'festung';
    const t: UnitType = {
      card,
      vis: this.visOf(card, team),
      team,
      hp: card.hp * mul,
      dmg: card.dmg * mul * DMG_SCALE,
      interval: card.interval / haste,
      speed: card.speed,
      range: card.range,
      radius: building ? 9 : card.cls === 'reittier' ? 4.5 : 3.2,
      building,
      melee: card.attack === 'melee',
      glow: '',
      blood: '',
    };
    this.types.push(t);
    return this.types.length - 1;
  }

  setup(sides: [SideSetup, SideSetup], seed = 1): void {
    this.alive.fill(0);
    this.pAlive.fill(0);
    this.hw = 0;
    this.pHw = 0;
    this.free.length = 0;
    this.pFree.length = 0;
    this.types.length = 0;
    this.events.length = 0;
    this.time = 0;
    this.baseHp[0] = this.baseHp[1] = BASE_HP;
    this.kills[0] = this.kills[1] = 0;
    this.baseHits[0] = this.baseHits[1] = 0;
    this.summons[0] = this.summons[1] = 0;
    this.winner = -1;
    this.state = 'setup';
    this.rng = (seed * 2654435761) >>> 0 || 1;

    sides.forEach((side, team) => {
      const ti = this.typeFor(side.card, team, side.level);
      // Beschwörungen dieser Seite vorab anlegen (gleiche Stufe)
      this.typeFor(SKELETON, team, side.level);
      this.typeFor(GHOUL, team, side.level);
      this.spawnFormation(ti, side.count);
    });
    this.countUnits();
  }

  private spawnFormation(ti: number, n: number): void {
    const t = this.types[ti]!;
    const building = t.building;
    const mount = t.card.cls === 'reittier';
    // Aufstellungs-Zone: von der Mauer bis max. 250 px ins Feld
    const zoneW = building ? 90 : 220;
    const zoneH = FIELD_H - 40;
    let sx = building ? 26 : mount ? 11 : 7;
    let sy = building ? 28 : mount ? 9 : 7;
    // Bei sehr vielen Einheiten enger zusammenrücken
    const squeeze = Math.min(1, Math.sqrt((zoneW * zoneH) / (n * sx * sy)));
    sx *= squeeze;
    sy *= squeeze;
    // Kompakter Block statt dünner Säule
    const blockH = Math.min(zoneH, Math.sqrt(n) * sy * 1.7);
    const perCol = Math.max(1, Math.floor(blockH / sy));
    const cols = Math.ceil(n / perCol);
    const front = building ? BASE_DEPTH + 28 + (cols - 1) * sx : Math.min(BASE_DEPTH + 16 + zoneW, BASE_DEPTH + 70 + cols * sx);
    for (let k = 0; k < n; k++) {
      const col = Math.floor(k / perCol);
      const inCol = k % perCol;
      const colN = Math.min(perCol, n - col * perCol);
      const jitter = building ? 0 : 1.4;
      const px = front - col * sx + (this.random() - 0.5) * jitter * 2;
      const py = FIELD_H / 2 + (inCol - (colN - 1) / 2) * sy + (col % 2 ? sy / 2 : 0) + (this.random() - 0.5) * jitter * 2;
      this.spawn(ti, t.team === 0 ? px : FIELD_W - px, py);
    }
  }

  spawn(ti: number, x: number, y: number): number {
    const i = this.free.length > 0 ? this.free.pop()! : this.hw < MAX_UNITS ? this.hw++ : -1;
    if (i < 0) return -1;
    const t = this.types[ti]!;
    this.alive[i] = 1;
    this.gen[i]!++;
    this.team[i] = t.team;
    this.type[i] = ti;
    this.x[i] = x;
    this.y[i] = Math.max(6, Math.min(FIELD_H - 4, y));
    this.vx[i] = 0;
    this.vy[i] = 0;
    this.hp[i] = t.hp;
    this.maxHp[i] = t.hp;
    this.cd[i] = this.random() * t.interval;
    this.target[i] = -1;
    this.retarget[i] = this.random() * 0.3;
    this.burnT[i] = 0;
    this.slowT[i] = 0;
    this.shield[i] = 0;
    this.flashT[i] = 0;
    this.atkT[i] = 0;
    this.animT[i] = this.random() * 10;
    this.summonT[i] = t.card.summon ? t.card.summon.every * (0.3 + this.random() * 0.7) : 0;
    this.buffDmgT[i] = 0;
    this.buffHasteT[i] = 0;
    this.revived[i] = 0;
    this.summoned[i] = 0;
    return i;
  }

  start(): void {
    if (this.state === 'setup') this.state = 'running';
  }

  // -------------------------------------------------------------------
  // Simulation
  // -------------------------------------------------------------------

  step(): void {
    if (this.state !== 'running') {
      // Leichtes Idle-Wippen auch vor dem Kampf
      for (let i = 0; i < this.hw; i++) if (this.alive[i]) this.animT[i]! += DT * 0.35;
      return;
    }
    this.time += DT;
    this.shake = Math.max(0, this.shake - DT * 6);
    this.buildGrids();

    // Reihenfolge jedes Tick umdrehen, damit keine Seite systematisch zuerst handelt
    this.tick++;
    if (this.tick % 2 === 0) {
      for (let i = 0; i < this.hw; i++) if (this.alive[i]) this.updateUnit(i);
    } else {
      for (let i = this.hw - 1; i >= 0; i--) if (this.alive[i]) this.updateUnit(i);
    }
    this.separate();
    this.updateProjectiles();
    this.countUnits();
    this.checkEnd();
  }

  private buildGrids(): void {
    this.teamN[0] = this.teamN[1] = 0;
    let sy0 = 0;
    let sy1 = 0;
    for (let i = 0; i < this.hw; i++) {
      if (!this.alive[i]) continue;
      const tm = this.team[i]!;
      this.teamIds[tm]![this.teamN[tm]!++] = i;
      if (tm === 0) sy0 += this.y[i]!;
      else sy1 += this.y[i]!;
    }
    for (let tm = 0; tm < 2; tm++) this.grids[tm]!.build(this.teamIds[tm]!, this.teamN[tm]!, this.x, this.y);
    if (this.teamN[0]) this.centroidY[0] = sy0 / this.teamN[0]!;
    if (this.teamN[1]) this.centroidY[1] = sy1 / this.teamN[1]!;
  }

  private countUnits(): void {
    let a = 0;
    let b = 0;
    for (let i = 0; i < this.hw; i++) if (this.alive[i]) this.team[i] === 0 ? a++ : b++;
    this.counts[0] = a;
    this.counts[1] = b;
  }

  private validTarget(i: number): boolean {
    const t = this.target[i]!;
    return t >= 0 && this.alive[t] === 1 && this.gen[t] === this.targetGen[i];
  }

  /** Nächster Gegner in wachsenden Ringen um (x, y). */
  private nearestEnemy(team: number, x: number, y: number, maxCells: number): number {
    const g = this.grids[1 - team]!;
    const cx = g.cellX(x);
    const cy = g.cellY(y);
    let best = -1;
    let bestD = Infinity;
    for (let r = 1; r <= maxCells; r = r < 3 ? r + 1 : r * 2) {
      const x0 = Math.max(0, cx - r);
      const x1 = Math.min(g.cols - 1, cx + r);
      const y0 = Math.max(0, cy - r);
      const y1 = Math.min(g.rows - 1, cy + r);
      for (let yy = y0; yy <= y1; yy++) {
        for (let xx = x0; xx <= x1; xx++) {
          const c = yy * g.cols + xx;
          for (let k = g.cellStart[c]!, e = g.cellStart[c + 1]!; k < e; k++) {
            const j = g.items[k]!;
            const dx = this.x[j]! - x;
            const dy = this.y[j]! - y;
            const d = dx * dx + dy * dy;
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

  private updateUnit(i: number): void {
    const t = this.types[this.type[i]!]!;
    const card = t.card;
    const tm = this.team[i]!;
    const dir = tm === 0 ? 1 : -1;

    // Zeitgeber
    if (this.flashT[i]! > 0) this.flashT[i]! -= DT;
    if (this.atkT[i]! > 0) this.atkT[i]! -= DT;
    if (this.slowT[i]! > 0) this.slowT[i]! -= DT;
    if (this.buffDmgT[i]! > 0) this.buffDmgT[i]! -= DT;
    if (this.buffHasteT[i]! > 0) this.buffHasteT[i]! -= DT;
    if (this.burnT[i]! > 0) {
      this.burnT[i]! -= DT;
      this.damage(i, this.burnDps[i]! * DT, -1, false);
      if (!this.alive[i]) return;
    }

    const lowHp = this.hp[i]! < this.maxHp[i]! * 0.5;
    let speed = t.speed * (this.slowT[i]! > 0 ? 0.5 : 1) * (card.panic && lowHp ? 1.6 : 1);
    const hasteMul = this.buffHasteT[i]! > 0 ? 0.75 : 1;

    // Beschwören
    if (card.summon) {
      this.summonT[i]! -= DT;
      if (this.summonT[i]! <= 0) {
        this.summonT[i] = card.summon.every;
        this.summonUnit(tm, card.summon.kind, this.x[i]! + dir * (t.building ? 12 : 5), this.y[i]! + (this.random() - 0.5) * 6);
        this.atkT[i] = 0.3;
      }
    }

    // Heiler-Unterstützung
    if (card.support) this.support(i, t);

    // Ziel suchen
    this.retarget[i]! -= DT;
    if (!this.validTarget(i) || this.retarget[i]! <= 0) {
      this.retarget[i] = 0.25 + this.random() * 0.2;
      const j = t.building ? (this.validTarget(i) ? this.target[i]! : this.randomEnemy(tm)) : this.nearestEnemy(tm, this.x[i]!, this.y[i]!, 10);
      this.target[i] = j;
      if (j >= 0) this.targetGen[i] = this.gen[j]!;
    }

    let dvx = 0;
    let dvy = 0;
    const tgt = this.validTarget(i) ? this.target[i]! : -1;
    if (this.cd[i]! > 0) this.cd[i]! -= DT / hasteMul;

    if (tgt >= 0) {
      const tt = this.types[this.type[tgt]!]!;
      const dx = this.x[tgt]! - this.x[i]!;
      const dy = this.y[tgt]! - this.y[i]!;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.001;
      const reach = t.melee ? t.radius + tt.radius + 1.5 : t.range;
      if (d > reach) {
        dvx = (dx / d) * speed;
        dvy = (dy / d) * speed;
      } else {
        // Magier weichen Nahkämpfern aus (Kiting)
        if (card.cls === 'magier' && tt.melee && d < 22 && !tt.building) {
          dvx = (-dx / d) * speed;
          dvy = (-dy / d) * speed * 0.6;
        }
        if (this.cd[i]! <= 0 && card.attack !== 'none') {
          this.cd[i] = t.interval;
          this.attack(i, t, tgt, lowHp);
        }
      }
    } else if (!t.building) {
      // Kein Gegner in Sicht: Richtung gegnerische Basis marschieren
      dvx = dir * speed;
      dvy = Math.sign(this.centroidY[1 - tm]! - this.y[i]!) * speed * 0.15;
    }

    if (t.building) return;
    // Sanft beschleunigen
    const a = 0.18;
    this.vx[i] = this.vx[i]! + (dvx - this.vx[i]!) * a;
    this.vy[i] = this.vy[i]! + (dvy - this.vy[i]!) * a;
    this.x[i] = this.x[i]! + this.vx[i]! * DT;
    this.y[i] = Math.max(6, Math.min(FIELD_H - 4, this.y[i]! + this.vy[i]! * DT));
    const moving = Math.abs(this.vx[i]!) + Math.abs(this.vy[i]!) > 3;
    this.animT[i]! += DT * (moving ? speed / 9 : 0.35);

    // Basis erreicht
    if ((tm === 0 && this.x[i]! >= FIELD_W - BASE_DEPTH) || (tm === 1 && this.x[i]! <= BASE_DEPTH)) {
      const enemy = 1 - tm;
      this.baseHp[enemy] = Math.max(0, this.baseHp[enemy]! - 1);
      this.baseHits[tm]!++;
      this.events.push({ t: 'base', team: enemy, y: this.y[i]! });
      this.remove(i);
    }
  }

  private attack(i: number, t: UnitType, tgt: number, lowHp: boolean): void {
    const card = t.card;
    let dmg = t.dmg * (card.rage && lowHp ? 1.5 : 1) * (this.buffDmgT[i]! > 0 ? 1.25 : 1);
    this.atkT[i] = 0.18;
    const kind: AttackKind = card.attack;
    const x = this.x[i]!;
    const y = this.y[i]!;
    const tx = this.x[tgt]!;
    const ty = this.y[tgt]!;
    const glow = colorOf(card);
    switch (kind) {
      case 'melee':
        this.damage(tgt, dmg, i, true);
        break;
      case 'arrow':
      case 'bolt':
      case 'fireball':
      case 'frost': {
        const k = kind === 'arrow' ? P_ARROW : kind === 'fireball' ? P_FIRE : kind === 'frost' ? P_FROST : P_BOLT;
        const sp = kind === 'arrow' ? 200 : 140;
        const oy = t.building ? -14 : -5;
        this.fire(k, i, x, y + oy, tx, ty, sp, dmg, tgt);
        break;
      }
      case 'pierce': {
        const dx = tx - x;
        const dy = ty - y;
        const d = Math.hypot(dx, dy) || 1;
        const p = this.fire(P_PIERCE, i, x, y - 5, tx, ty, 160, dmg * 0.55, -1);
        if (p >= 0) {
          this.pVX[p] = (dx / d) * 160;
          this.pVY[p] = (dy / d) * 160;
          this.pDur[p] = (t.range + 50) / 160;
        }
        break;
      }
      case 'rock':
      case 'boulder': {
        const big = kind === 'boulder';
        const p = this.fire(big ? P_BOULDER : P_ROCK, i, x, y + (t.building ? -16 : -6), tx + (this.random() - 0.5) * 8, ty + (this.random() - 0.5) * 8, 0, dmg, -1);
        if (p >= 0) this.pDur[p] = big ? 1.1 + Math.abs(tx - x) / 900 : 0.6;
        break;
      }
      case 'beam': {
        // Wurzelstrahl: trifft alles in dieser Reihe vor der Bastion
        const dir = this.team[i] === 0 ? 1 : -1;
        const g = this.grids[1 - this.team[i]!]!;
        const cy0 = g.cellY(ty - 6);
        const cy1 = g.cellY(ty + 6);
        dmg *= 0.6;
        for (let cy = cy0; cy <= cy1; cy++)
          for (let cx = 0; cx < g.cols; cx++) {
            const c = cy * g.cols + cx;
            for (let k = g.cellStart[c]!, e = g.cellStart[c + 1]!; k < e; k++) {
              const j = g.items[k]!;
              if (this.alive[j] && Math.abs(this.y[j]! - ty) < 5 && (this.x[j]! - x) * dir > 0) this.damage(j, dmg, i, false);
            }
          }
        this.events.push({ t: 'beam', x0: x + dir * 8, y: ty, x1: dir > 0 ? FIELD_W : 0, color: glow });
        break;
      }
      case 'none':
        break;
    }
  }

  private fire(kind: number, src: number, x: number, y: number, tx: number, ty: number, speed: number, dmg: number, tgt: number): number {
    const p = this.pFree.length > 0 ? this.pFree.pop()! : this.pHw < MAX_PROJ ? this.pHw++ : -1;
    if (p < 0) return -1;
    this.pAlive[p] = 1;
    this.pKind[p] = kind;
    this.pTeam[p] = this.team[src]!;
    this.pX[p] = x;
    this.pY[p] = y;
    this.pZ[p] = 0;
    this.pTX[p] = tx;
    this.pTY[p] = ty;
    this.pT[p] = 0;
    this.pDur[p] = 8;
    this.pDmg[p] = dmg;
    this.pSrcType[p] = this.type[src]!;
    this.pTarget[p] = tgt;
    this.pTargetGen[p] = tgt >= 0 ? this.gen[tgt]! : 0;
    this.pHitCount[p] = 0;
    const dx = tx - x;
    const dy = ty - y;
    const d = Math.hypot(dx, dy) || 1;
    this.pVX[p] = (dx / d) * speed;
    this.pVY[p] = (dy / d) * speed;
    return p;
  }

  private killProj(p: number): void {
    this.pAlive[p] = 0;
    this.pFree.push(p);
  }

  private updateProjectiles(): void {
    for (let p = 0; p < this.pHw; p++) {
      if (!this.pAlive[p]) continue;
      const kind = this.pKind[p]!;
      this.pT[p]! += DT;
      const srcType = this.types[this.pSrcType[p]!]!;
      if (kind === P_BOULDER || kind === P_ROCK) {
        // Bogenwurf: lineare Bewegung + Parabel-Höhe
        const u = Math.min(1, this.pT[p]! / this.pDur[p]!);
        const h = kind === P_BOULDER ? 70 : 26;
        this.pZ[p] = 4 * h * u * (1 - u);
        if (u >= 1) {
          const r = kind === P_BOULDER ? 20 : 10;
          this.areaDamage(this.pTeam[p]!, this.pTX[p]!, this.pTY[p]!, r, this.pDmg[p]! * (kind === P_BOULDER ? 0.9 : 0.6), -1);
          this.events.push({ t: 'boom', x: this.pTX[p]!, y: this.pTY[p]!, r, color: kind === P_BOULDER ? '#9a9aa3' : '#c8ccd2' });
          if (kind === P_BOULDER) this.shake = Math.min(1.5, this.shake + 0.35);
          this.killProj(p);
        }
        continue;
      }
      if (kind === P_PIERCE) {
        this.pX[p]! += this.pVX[p]! * DT;
        this.pY[p]! += this.pVY[p]! * DT;
        const j = this.nearestEnemy(this.pTeam[p]!, this.pX[p]!, this.pY[p]!, 1);
        if (j >= 0 && Math.hypot(this.x[j]! - this.pX[p]!, this.y[j]! - 3 - this.pY[p]!) < 5) {
          const base = p * 3;
          const n = this.pHitCount[p]!;
          let already = false;
          for (let k = 0; k < n; k++) if (this.pHits[base + k] === j) already = true;
          if (!already) {
            this.damage(j, this.pDmg[p]!, -1, false);
            this.events.push({ t: 'hit', x: this.pX[p]!, y: this.pY[p]!, color: '#e9f6ff' });
            this.pHits[base + n] = j;
            this.pHitCount[p] = n + 1;
            if (n + 1 >= 3) {
              this.killProj(p);
              continue;
            }
          }
        }
        if (this.pT[p]! > this.pDur[p]! || this.pX[p]! < 0 || this.pX[p]! > FIELD_W) this.killProj(p);
        continue;
      }
      // Zielsuchende Geschosse
      const tgt = this.pTarget[p]!;
      if (tgt >= 0 && this.alive[tgt] && this.gen[tgt] === this.pTargetGen[p]) {
        this.pTX[p] = this.x[tgt]!;
        this.pTY[p] = this.y[tgt]! - 4;
      }
      const dx = this.pTX[p]! - this.pX[p]!;
      const dy = this.pTY[p]! - this.pY[p]!;
      const d = Math.hypot(dx, dy);
      const sp = Math.hypot(this.pVX[p]!, this.pVY[p]!) || 140;
      if (d <= sp * DT + 1) {
        if (tgt >= 0 && this.alive[tgt] && this.gen[tgt] === this.pTargetGen[p]) {
          this.damage(tgt, this.pDmg[p]!, -1, false);
          if (kind === P_FIRE) {
            this.burnT[tgt] = 3;
            this.burnDps[tgt] = srcType.dmg * 0.45;
          } else if (kind === P_FROST) {
            this.slowT[tgt] = 2;
          }
          this.events.push({ t: 'hit', x: this.pTX[p]!, y: this.pTY[p]!, color: PROJ_COLORS[kind] ?? '#ffffff' });
        }
        this.killProj(p);
        continue;
      }
      this.pVX[p] = (dx / d) * sp;
      this.pVY[p] = (dy / d) * sp;
      this.pX[p]! += this.pVX[p]! * DT;
      this.pY[p]! += this.pVY[p]! * DT;
      if (this.pT[p]! > this.pDur[p]!) this.killProj(p);
    }
  }

  private areaDamage(team: number, x: number, y: number, r: number, dmg: number, src: number): void {
    const g = this.grids[1 - team]!;
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
          const dx = this.x[j]! - x;
          const dy = this.y[j]! - y;
          if (this.alive[j] && dx * dx + dy * dy <= r2) this.damage(j, dmg, src, false);
        }
      }
  }

  private support(i: number, t: UnitType): void {
    const kind = t.card.support!;
    this.summonT[i]! -= DT;
    if (this.summonT[i]! > 0) return;
    this.summonT[i] = t.interval;
    const tm = this.team[i]!;
    const g = this.grids[tm]!;
    const r = kind === 'dmgaura' || kind === 'hasteaura' ? 26 : 22;
    const x = this.x[i]!;
    const y = this.y[i]!;
    const x0 = g.cellX(x - r);
    const x1 = g.cellX(x + r);
    const y0 = g.cellY(y - r);
    const y1 = g.cellY(y + r);
    let n = 0;
    const max = kind === 'shield' ? 4 : 8;
    const heal = kind === 'bigheal' ? 2.2 : kind === 'heal' ? 1.1 : kind === 'lifedrain' ? 0.6 : 0;
    for (let cy = y0; cy <= y1 && n < max; cy++)
      for (let cx = x0; cx <= x1 && n < max; cx++) {
        const c = cy * g.cols + cx;
        for (let k = g.cellStart[c]!, e = g.cellStart[c + 1]!; k < e && n < max; k++) {
          const j = g.items[k]!;
          if (j === i || !this.alive[j]) continue;
          const dx = this.x[j]! - x;
          const dy = this.y[j]! - y;
          if (dx * dx + dy * dy > r * r) continue;
          if (heal > 0) {
            if (this.hp[j]! >= this.maxHp[j]!) continue;
            this.hp[j] = Math.min(this.maxHp[j]!, this.hp[j]! + heal);
            if (n < 2) this.events.push({ t: 'heal', x: this.x[j]!, y: this.y[j]! - 8, color: '#8dff8a' });
          } else if (kind === 'shield') {
            if (this.shield[j]! > 0) continue;
            this.shield[j] = 3;
            if (n < 2) this.events.push({ t: 'heal', x: this.x[j]!, y: this.y[j]! - 8, color: '#bfe3ff' });
          } else if (kind === 'dmgaura') {
            this.buffDmgT[j] = t.interval + 0.2;
          } else {
            this.buffHasteT[j] = t.interval + 0.2;
          }
          n++;
        }
      }
    if (kind === 'dmgaura' || kind === 'hasteaura') this.events.push({ t: 'heal', x, y: y - 10, color: kind === 'dmgaura' ? '#ff9a6a' : '#fff3a0' });
  }

  private summonUnit(team: number, kind: 'skeleton' | 'ghoul', x: number, y: number): number {
    if (this.summons[team]! >= SUMMON_CAP) return -1;
    const card = kind === 'skeleton' ? SKELETON : GHOUL;
    const ti = this.types.findIndex((t) => t.card === card && t.team === team);
    if (ti < 0) return -1;
    const j = this.spawn(ti, x, y);
    if (j >= 0) {
      this.summoned[j] = 1;
      this.summons[team]!++;
      this.events.push({ t: 'spawn', x, y, color: kind === 'skeleton' ? '#7dffb4' : '#b881e6' });
    }
    return j;
  }

  /** Schaden anwenden. `src` = Angreifer-Index (für Kill-Effekte) oder -1. */
  damage(i: number, dmg: number, src: number, melee: boolean): void {
    if (!this.alive[i]) return;
    if (this.shield[i]! > 0) {
      const a = Math.min(this.shield[i]!, dmg);
      this.shield[i]! -= a;
      dmg -= a;
    }
    this.hp[i]! -= dmg;
    if (dmg > 0.05) this.flashT[i] = 0.06;
    if (melee && this.random() < 0.25) this.events.push({ t: 'hit', x: this.x[i]!, y: this.y[i]! - 4, color: '#ffffff' });
    if (src >= 0 && this.alive[src]) {
      const st = this.types[this.type[src]!]!;
      if (st.card.support === 'lifedrain') this.hp[src] = Math.min(this.maxHp[src]!, this.hp[src]! + dmg);
    }
    if (this.hp[i]! <= 0) this.kill(i, src);
  }

  private kill(i: number, src: number): void {
    const t = this.types[this.type[i]!]!;
    const tm = this.team[i]!;
    const x = this.x[i]!;
    const y = this.y[i]!;
    this.kills[1 - tm]!++;
    // Knochenross: steht wieder auf und hinterlässt eine Kopie
    if (t.card.revive && !this.revived[i] && this.random() < t.card.revive) {
      this.revived[i] = 1;
      this.hp[i] = this.maxHp[i]! * 0.5;
      this.events.push({ t: 'spawn', x, y, color: '#7dffb4' });
      const c = this.spawn(this.type[i]!, x - (tm === 0 ? 6 : -6), y + (this.random() - 0.5) * 6);
      if (c >= 0) {
        this.revived[c] = 1;
        this.hp[c] = this.maxHp[c]! * 0.5;
      }
      return;
    }
    this.events.push({ t: 'death', x, y, vis: t.vis, team: tm, building: t.building, color: bloodOf(t.card) });
    this.remove(i);
    if (src >= 0 && this.alive[src]) {
      const st = this.types[this.type[src]!]!;
      const stm = this.team[src]!;
      if (st.card.raiseOnKill && this.random() < st.card.raiseOnKill) this.summonUnit(stm, 'skeleton', x, y);
      if (st.card === GHOUL) this.summonUnit(stm, 'ghoul', x, y);
    }
  }

  private remove(i: number): void {
    if (this.summoned[i]) this.summons[this.team[i]!]!--;
    this.alive[i] = 0;
    this.free.push(i);
  }

  /**
   * Einheiten schieben sich gegenseitig weg (beide Teams). Erst werden alle
   * Verschiebungen berechnet, dann gleichzeitig angewendet – sonst hätte die
   * zuerst berechnete Seite einen systematischen Vor-/Nachteil.
   */
  private separate(): void {
    const pushX = this.pushX;
    const pushY = this.pushY;
    for (let tm = 0; tm < 2; tm++) {
      const ids = this.teamIds[tm]!;
      for (let k = 0; k < this.teamN[tm]!; k++) {
        const i = ids[k]!;
        pushX[i] = 0;
        pushY[i] = 0;
        if (!this.alive[i]) continue;
        const ti = this.types[this.type[i]!]!;
        if (ti.building) continue;
        const ri = ti.radius;
        let px = 0;
        let py = 0;
        const x = this.x[i]!;
        const y = this.y[i]!;
        // Eigenes Team und Gegner mit getrenntem Prüf-Budget
        for (const gt of [tm, 1 - tm]) {
          const g = this.grids[gt]!;
          const cx = g.cellX(x);
          const cy = g.cellY(y);
          let checks = 0;
          for (let yy = Math.max(0, cy - 1); yy <= Math.min(g.rows - 1, cy + 1); yy++)
            for (let xx = Math.max(0, cx - 1); xx <= Math.min(g.cols - 1, cx + 1); xx++) {
              const c = yy * g.cols + xx;
              for (let q = g.cellStart[c]!, e = g.cellStart[c + 1]!; q < e && checks < 16; q++) {
                const j = g.items[q]!;
                if (j === i || !this.alive[j]) continue;
                checks++;
                const dx = x - this.x[j]!;
                const dy = y - this.y[j]!;
                const rr = ri + this.types[this.type[j]!]!.radius;
                const d2 = dx * dx + dy * dy;
                if (d2 >= rr * rr) continue;
                if (d2 < 0.0001) {
                  px += (i < j ? -1 : 1) * 0.3;
                  continue;
                }
                const d = Math.sqrt(d2);
                const o = (rr - d) / d;
                px += dx * o;
                py += dy * o;
              }
            }
        }
        pushX[i] = px * 0.3;
        pushY[i] = py * 0.3;
      }
    }
    for (let tm = 0; tm < 2; tm++) {
      const ids = this.teamIds[tm]!;
      for (let k = 0; k < this.teamN[tm]!; k++) {
        const i = ids[k]!;
        if (!this.alive[i]) continue;
        this.x[i]! += pushX[i]!;
        this.y[i] = Math.max(6, Math.min(FIELD_H - 4, this.y[i]! + pushY[i]!));
      }
    }
  }

  private checkEnd(): void {
    const mobile = [0, 0];
    for (let i = 0; i < this.hw; i++) if (this.alive[i] && !this.types[this.type[i]!]!.building) mobile[this.team[i]!]!++;
    let done = false;
    const [c0, c1] = this.counts as [number, number];
    if (this.baseHp[0]! <= 0 || this.baseHp[1]! <= 0) done = true;
    else if (c0 === 0 && c1 === 0) done = true;
    else if ((c0 === 0 && mobile[1] === 0) || (c1 === 0 && mobile[0] === 0)) done = true;
    else if (this.time >= MAX_TIME) done = true;
    if (!done) return;
    this.state = 'done';
    const [a, b] = this.baseHp as [number, number];
    if (a !== b) this.winner = a > b ? 0 : 1;
    else if (this.counts[0] !== this.counts[1]) this.winner = this.counts[0]! > this.counts[1]! ? 0 : 1;
    else this.winner = 2;
  }
}

// --- Geschoss-Arten ---------------------------------------------------------

export const P_ARROW = 0;
export const P_BOLT = 1;
export const P_FIRE = 2;
export const P_FROST = 3;
export const P_PIERCE = 4;
export const P_ROCK = 5;
export const P_BOULDER = 6;
export const PROJ_COLORS = ['#e8e0c8', '#b8d8ff', '#ffb238', '#c2ff6e', '#e9f6ff', '#c8ccd2', '#9a9aa3'];

const colorOf = (c: CardDef) => PALETTES[c.color].glow;
const bloodOf = (c: CardDef) => (c === SKELETON ? '#e3dcc6' : PALETTES[c.color].blood);

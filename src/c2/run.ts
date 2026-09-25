// =====================================================================
// Zustand eines Runs: Deck, Gold, Leben, Welten, Räume, Enchantments.
// Ein Run hat 4 Welten. Welt 1 ist die Drifters-Welt von Rusk, danach
// wählt der Spieler vor jeder Welt zwischen 2 Farb-Bossen.
// =====================================================================

import {
  BOSSES,
  CARDS2,
  RACE_ORDER,
  cardByName,
  newMods,
  restoreEnchant,
  rollEnchant,
  type Boss,
  type Card2,
  type Enchant,
  type EnchantSpec,
  type Mods,
  type RaceId,
  type RoomKind,
} from './data';

export interface DeckCard {
  uid: number;
  card: Card2;
  stars: number;
}

export interface Room {
  kind: RoomKind;
  /** Schwierigkeit/Belohnung 1–5 */
  stars: number;
  /** Nur Schatzraum: was drin sein kann */
  treasure?: 'gold' | 'upgrade' | 'both';
}

export interface SaveData {
  colors: RaceId[];
  deck: [string, number][];
  gold: number;
  lives: number;
  worldNo: number;
  world: RaceId;
  roomNo: number;
  enchants: EnchantSpec[];
  defeated: RaceId[];
  battlesWon: number;
  seed: number;
  lastRoom?: RoomKind;
}

const SAVE_KEY = 'c2-save';

export const saveRun = (r: Run) => localStorage.setItem(SAVE_KEY, JSON.stringify(r.toJSON()));
export const clearSave = () => localStorage.removeItem(SAVE_KEY);
export function loadRun(): Run | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? Run.fromJSON(JSON.parse(raw) as SaveData) : null;
  } catch {
    return null;
  }
}

export const WORLDS_PER_RUN = 4;
/** Räume vor dem Boss: Welt 1 hat 5, jede weitere Welt einen mehr. */
export const roomsInWorld = (worldNo: number) => 4 + worldNo;

const WORLD_STARS: [number, number][] = [
  [1, 1],
  [1, 3],
  [2, 4],
  [3, 5],
];

export class Run {
  deck: DeckCard[] = [];
  gold = 60;
  lives = 3;
  worldNo = 1;
  world: RaceId = 'drifters';
  /** Wie viele Räume dieser Welt schon geschafft sind */
  roomNo = 0;
  enchants: Enchant[] = [];
  defeated: RaceId[] = [];
  battlesWon = 0;
  /** Art des zuletzt betretenen Raums (steuert die Gabelung) */
  lastRoom: RoomKind = 'battle';
  private uid = 1;
  seed: number;

  constructor(
    readonly colors: RaceId[],
    seed = Date.now() % 100000,
  ) {
    this.seed = seed || 1;
    // Startdeck: 10 zufällige Karten aus den 3 Farben, ohne Champions
    const pool = CARDS2.filter((c) => colors.includes(c.race) && c.cls !== 'Champion');
    for (let i = 0; i < 10; i++) this.addCard(pool[Math.floor(this.rnd() * pool.length)]!);
  }

  rnd(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  addCard(card: Card2, stars = 1): DeckCard {
    const d = { uid: this.uid++, card, stars };
    this.deck.push(d);
    return d;
  }

  get boss(): Boss {
    return BOSSES[this.world];
  }

  get mods(): Mods {
    const m = newMods();
    for (const e of this.enchants) e.apply(m);
    return m;
  }

  get castleHp(): number {
    return 500 + this.mods.baseHp;
  }

  /** Sterne der Räume in dieser Welt. */
  private starRange(): [number, number] {
    return WORLD_STARS[Math.min(WORLD_STARS.length - 1, this.worldNo - 1)]!;
  }

  private randStars(): number {
    const [a, b] = this.starRange();
    return a + Math.floor(this.rnd() * (b - a + 1));
  }

  get rooms(): number {
    return roomsInWorld(this.worldNo);
  }

  get isBossNext(): boolean {
    return this.roomNo >= this.rooms;
  }

  /**
   * Zwei Wege an der Gabelung.
   * - Nach einem Kampf ist immer mindestens ein „guter“ Raum dabei
   *   (Schatz, Shop, Enchanter, Pyre).
   * - Nach einem guten Raum ist fast immer ein Kampf dran, damit man nicht
   *   von Belohnung zu Belohnung zum Boss laufen kann.
   */
  fork(): [Room, Room] {
    if (this.isBossNext) {
      const b: Room = { kind: 'boss', stars: this.starRange()[1] };
      return [b, b];
    }
    const good: RoomKind[] = ['treasure', 'shop', 'enchant', 'pyre'];
    const make = (kind: RoomKind): Room => {
      const r: Room = { kind, stars: this.randStars() };
      if (kind === 'treasure') r.treasure = this.rnd() < 0.45 ? 'gold' : this.rnd() < 0.6 ? 'upgrade' : 'both';
      return r;
    };
    const randGood = (not?: RoomKind) => {
      const pool = good.filter((k) => k !== not && (k !== 'pyre' || this.deck.length > 6));
      return pool[Math.floor(this.rnd() * pool.length)]!;
    };
    let a: Room;
    let b: Room;
    if (this.lastRoom === 'battle' || this.lastRoom === 'boss') {
      a = make(randGood());
      b = this.rnd() < 0.55 ? make('battle') : make(randGood(a.kind));
    } else {
      a = make('battle');
      b = this.rnd() < 0.8 ? make('battle') : make(randGood(this.lastRoom));
      // Zwei Kämpfe: unterschiedliche Schwierigkeit anbieten
      if (b.kind === 'battle' && b.stars === a.stars) b.stars = Math.min(5, a.stars + 1);
    }
    return this.rnd() < 0.5 ? [a, b] : [b, a];
  }

  /** Belohnung, die ein Raum verspricht (für das Info-Panel). */
  rewardText(r: Room): string[] {
    switch (r.kind) {
      case 'battle':
        return [`~${this.battleGold(r.stars)} gold`, r.stars >= 3 ? 'Card upgrade' : 'Survivor bonus'];
      case 'boss':
        return [`~${this.battleGold(r.stars) * 3} gold`, 'Choose a card from the boss deck', '+1 life'];
      case 'treasure':
        return r.treasure === 'gold' ? ['Gold'] : r.treasure === 'upgrade' ? ['Card upgrade'] : ['Gold or card upgrade'];
      case 'shop':
        return ['Buy or upgrade cards'];
      case 'enchant':
        return ['1 of 2 enchantments'];
      case 'pyre':
        return ['Remove 1 of 3 cards'];
    }
  }

  battleGold(stars: number): number {
    return Math.round((20 + stars * 12 + this.worldNo * 6) * this.mods.goldMul);
  }

  // --- Gegner ------------------------------------------------------------------------------

  /** Deck des Gegners in dieser Welt (Boss-Deck = Boss-Farbe + Drifters). */
  enemyDeck(): Card2[] {
    return this.boss.deck.map(cardByName);
  }

  enemyStars(): number {
    return Math.min(3, Math.max(1, this.worldNo - 1));
  }

  /** Truppen-Faktor des Gegners nach Raum-Sternen. */
  enemyPower(stars: number): number {
    return 0.55 + stars * 0.15 + (this.worldNo - 1) * 0.1;
  }

  enemyCastle(stars: number, boss: boolean): number {
    return boss ? 700 + this.worldNo * 200 : 260 + stars * 110 + this.worldNo * 60;
  }

  // --- Ablauf ------------------------------------------------------------------------------

  completeRoom(): void {
    this.roomNo++;
  }

  /** Nach dem Boss: zwei neue Welten zur Wahl. */
  worldChoices(): [RaceId, RaceId] {
    const open = RACE_ORDER.filter((r) => r !== 'drifters' && !this.defeated.includes(r) && r !== this.world);
    // Morvath (Plague Court) erst ab Welt 3
    const allowed = open.filter((r) => r !== 'plague' || this.worldNo + 1 >= 3);
    const pool = allowed.length >= 2 ? allowed : open;
    const a = pool[Math.floor(this.rnd() * pool.length)]!;
    const rest = pool.filter((r) => r !== a);
    const b = rest[Math.floor(this.rnd() * rest.length)] ?? a;
    return [a, b];
  }

  enterWorld(race: RaceId): void {
    this.defeated.push(this.world);
    this.world = race;
    this.worldNo++;
    this.roomNo = 0;
    this.lastRoom = 'battle';
  }

  get runWon(): boolean {
    return this.worldNo >= WORLDS_PER_RUN && this.defeated.includes(this.world);
  }

  randomEnchant(): Enchant {
    const cls = this.deck[Math.floor(this.rnd() * this.deck.length)]?.card.cls ?? 'Infantry';
    const race = this.colors[Math.floor(this.rnd() * this.colors.length)]!;
    return rollEnchant(() => this.rnd(), race, cls);
  }

  /** Zufällige Deck-Karte, die noch verbessert werden kann. */
  upgradeable(): DeckCard[] {
    return this.deck.filter((d) => d.stars < 3);
  }

  upgradeCost(d: DeckCard): number {
    return 40 + d.stars * 35;
  }

  // --- Spielstand ------------------------------------------------------------------------

  toJSON(): SaveData {
    return {
      colors: this.colors,
      deck: this.deck.map((d) => [d.card.name, d.stars] as [string, number]),
      gold: this.gold,
      lives: this.lives,
      worldNo: this.worldNo,
      world: this.world,
      roomNo: this.roomNo,
      enchants: this.enchants.map((e) => e.spec).filter((x): x is EnchantSpec => !!x),
      defeated: this.defeated,
      battlesWon: this.battlesWon,
      seed: this.seed,
      lastRoom: this.lastRoom,
    };
  }

  static fromJSON(d: SaveData): Run {
    const r = new Run(d.colors, d.seed);
    r.deck = [];
    for (const [name, stars] of d.deck) r.addCard(cardByName(name), stars);
    r.gold = d.gold;
    r.lives = d.lives;
    r.worldNo = d.worldNo;
    r.world = d.world;
    r.roomNo = d.roomNo;
    r.enchants = d.enchants.map(restoreEnchant);
    r.defeated = d.defeated;
    r.battlesWon = d.battlesWon;
    r.lastRoom = d.lastRoom ?? 'battle';
    return r;
  }

  buyCost(c: Card2): number {
    return c.cls === 'Champion' ? 150 : 60 + Math.round(c.dmg + c.hp / 10);
  }
}

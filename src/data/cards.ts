// =====================================================================
// Kartendaten für den Chromatic-2-Prototypen.
// 5 Farben × 5 Klassen, Werte angelehnt an Chromatic 1. Die Truppenzahlen
// sind für den Massen-Kampf hochskaliert (Faktor ~25).
// =====================================================================

export type ColorId = 'krieg' | 'natur' | 'stein' | 'untot' | 'farblos';
export type ClassId = 'krieger' | 'festung' | 'reittier' | 'magier' | 'heiler';

/** Wie eine Einheit angreift. */
export type AttackKind =
  | 'melee'
  | 'arrow' // Einzelschuss, gerade
  | 'bolt' // Magie-Geschoss, Einzelziel
  | 'fireball' // Brand
  | 'frost' // Verlangsamung
  | 'pierce' // durchschlägt bis zu 3 Gegner
  | 'rock' // kleiner Fels mit Flächenschaden
  | 'boulder' // großer Fels im Bogen, großer Flächenschaden
  | 'beam' // sofortiger Strahl über die ganze Reihe
  | 'none';

export type SupportKind = 'heal' | 'bigheal' | 'shield' | 'lifedrain' | 'dmgaura' | 'hasteaura';

export interface CardDef {
  readonly id: string;
  readonly name: string;
  readonly color: ColorId;
  readonly cls: ClassId;
  /** Ausgemustert (in Chromatic 1 nicht im Startdeck). */
  readonly retired: boolean;
  readonly ability: string;
  readonly dmg: number;
  readonly hp: number;
  /** Sekunden zwischen Angriffen */
  readonly interval: number;
  /** Pixel pro Sekunde */
  readonly speed: number;
  readonly range: number;
  readonly attack: AttackKind;
  readonly support?: SupportKind;
  readonly rage?: boolean; // < 50 % HP: DMG ×1,5
  readonly panic?: boolean; // < 50 % HP: Tempo ×1,6
  readonly raiseOnKill?: number; // Chance, dass ein Opfer zum eigenen Skelett wird
  readonly revive?: number; // Chance, nach dem Tod aufzustehen + Kopie
  readonly summon?: { kind: 'skeleton' | 'ghoul'; every: number };
  readonly defaultCount: number;
}

export const COLORS: readonly ColorId[] = ['krieg', 'natur', 'stein', 'untot', 'farblos'];
export const CLASSES: readonly ClassId[] = ['krieger', 'festung', 'reittier', 'magier', 'heiler'];

export const COLOR_LABEL: Record<ColorId, string> = {
  krieg: 'Krieg',
  natur: 'Natur',
  stein: 'Stein',
  untot: 'Untot',
  farblos: 'Farblos',
};

export const CLASS_LABEL: Record<ClassId, string> = {
  krieger: 'Krieger',
  festung: 'Festung',
  reittier: 'Reittier',
  magier: 'Magier',
  heiler: 'Heiler',
};

interface ClassBase {
  dmg: number;
  hp: number;
  interval: number;
  speed: number;
  range: number;
  attack: AttackKind;
  count: number;
}

// Tempo ≈ 0,55 × Chromatic 1: die Figuren sind viel kleiner, das Feld wirkt größer.
const BASE: Record<ClassId, ClassBase> = {
  krieger: { dmg: 15, hp: 8, interval: 1.0, speed: 32, range: 0, attack: 'melee', count: 300 },
  festung: { dmg: 20, hp: 25, interval: 2.2, speed: 0, range: 9999, attack: 'arrow', count: 30 },
  reittier: { dmg: 12, hp: 10, interval: 0.9, speed: 47, range: 0, attack: 'melee', count: 260 },
  magier: { dmg: 10, hp: 6, interval: 1.3, speed: 21, range: 70, attack: 'bolt', count: 320 },
  heiler: { dmg: 8, hp: 12, interval: 1.4, speed: 25, range: 40, attack: 'bolt', count: 260 },
};

type Spec = Partial<Omit<CardDef, 'color' | 'cls' | 'name' | 'id'>> & { name: string; ability: string };

const SPECS: Record<ClassId, Record<ColorId, Spec>> = {
  krieger: {
    krieg: { name: 'Berserker', ability: 'Schneller. Unter 50 % HP wütend: Schaden ×1,5.', rage: true, speed: 38 },
    natur: { name: 'Ranger', ability: 'Krieger mit Fernkampf-Pfeil.', attack: 'arrow', range: 60 },
    stein: { name: 'Stonebreaker', ability: 'Mehr HP, langsamer. Unter 50 % HP wütend.', rage: true, hp: 12, speed: 26 },
    untot: { name: 'Gravewarden', ability: '40 %: Ein getöteter Gegner wird zum eigenen Skelett.', raiseOnKill: 0.4 },
    farblos: { name: 'Mercenary', ability: 'Mehr Schaden, wird wütend. Farblos-Bonus.', rage: true, dmg: 19, hp: 12 },
  },
  festung: {
    krieg: { name: 'War Keep', ability: 'Pfeilturm mit erhöhtem Schaden.', retired: true, dmg: 28 },
    natur: { name: 'Root Bastion', ability: 'Sofortiger Wurzelstrahl, trifft die ganze Reihe.', attack: 'beam', dmg: 12 },
    stein: { name: 'Stone Fortress', ability: 'Felsbrocken im Bogen mit großem Flächenschaden.', attack: 'boulder', interval: 3.0 },
    untot: { name: 'Death Citadel', ability: 'Greift nicht an. Beschwört alle 3 s einen Ghul, der sich bei jedem Kill verdoppelt.', attack: 'none', summon: { kind: 'ghoul', every: 3 } },
    farblos: { name: 'Trading Post', ability: 'Kaum Schaden (erzeugt im echten Spiel EXP).', dmg: 5, hp: 29 },
  },
  reittier: {
    krieg: { name: 'Warhorse', ability: 'Unter 50 % HP: Panik-Galopp (schneller).', panic: true },
    natur: { name: 'Forest Stag', ability: 'Unter 50 % HP: Panik-Galopp (schneller).', panic: true, retired: true },
    stein: { name: 'Stone Wolf', ability: 'Unter 50 % HP: Panik-Galopp (schneller).', panic: true, retired: true },
    untot: { name: 'Bone Steed', ability: '25 %: Steht nach dem Tod wieder auf und hinterlässt eine Kopie.', revive: 0.25 },
    farblos: { name: 'Nomad Camel', ability: 'Farblos-Bonus: +4 HP, +2 Schaden.', dmg: 14, hp: 14 },
  },
  magier: {
    krieg: { name: 'Fire Mage', ability: 'Feuerball setzt Ziele 3 s in Brand.', attack: 'fireball' },
    natur: { name: 'Forest Sage', ability: 'Dornen-Geschoss verlangsamt Gegner.', attack: 'frost' },
    stein: { name: 'Stone Conjurer', ability: 'Wirft kleine Felsen mit Flächenschaden.', attack: 'rock', retired: true },
    untot: { name: 'Necromancer', ability: 'Macht keinen Schaden, beschwört regelmäßig Skelette.', attack: 'none', summon: { kind: 'skeleton', every: 4 } },
    farblos: { name: 'Time Sage', ability: 'Geschoss durchschlägt bis zu 3 Gegner.', attack: 'pierce', dmg: 12, hp: 10 },
  },
  heiler: {
    krieg: { name: 'Field Medic', ability: 'Aura: Verbündete in der Nähe machen mehr Schaden.', support: 'dmgaura', retired: true },
    natur: { name: 'Nature Healer', ability: 'Stärkste Dauerheilung.', support: 'bigheal' },
    stein: { name: 'Stone Keeper', ability: 'Legt Schilde auf Verbündete.', support: 'shield' },
    untot: { name: 'Soul Healer', ability: 'Greift an und heilt dabei Verbündete (Lebensraub).', support: 'lifedrain', retired: true },
    farblos: { name: 'Prayer Weaver', ability: 'Aura: Verbündete greifen schneller an.', support: 'hasteaura', retired: true, dmg: 10, hp: 16 },
  },
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, '-');

export const CARDS: readonly CardDef[] = CLASSES.flatMap((cls) =>
  COLORS.map((color): CardDef => {
    const b = BASE[cls];
    const s = SPECS[cls][color];
    return {
      id: slug(s.name),
      color,
      cls,
      retired: false,
      dmg: b.dmg,
      hp: b.hp,
      interval: b.interval,
      speed: b.speed,
      range: b.range,
      attack: b.attack,
      support: cls === 'heiler' ? 'heal' : undefined,
      defaultCount: b.count,
      ...s,
    };
  }),
);

export const cardById = (id: string): CardDef => {
  const c = CARDS.find((x) => x.id === id);
  if (!c) throw new Error(`Unbekannte Karte: ${id}`);
  return c;
};

/** Beschworene Einheiten (nicht im Deck). */
export const SKELETON: CardDef = {
  id: 'skeleton', name: 'Skelett', color: 'untot', cls: 'krieger', retired: false,
  ability: '', dmg: 8, hp: 5, interval: 1.0, speed: 30, range: 0, attack: 'melee', defaultCount: 0,
};

export const GHOUL: CardDef = {
  id: 'ghoul', name: 'Ghul', color: 'untot', cls: 'krieger', retired: false,
  ability: '', dmg: 12, hp: 9, interval: 0.9, speed: 36, range: 0, attack: 'melee', defaultCount: 0,
};

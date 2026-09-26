// =====================================================================
// Spieldaten für Chromatic 2: Klassenwerte, Fähigkeiten der 36 Karten,
// Rassen- und Klassenboni, Bosse, Enchantments und Raumtypen.
// Karten & Rassen selbst stehen in lab/races.ts (gemeinsam mit dem UI-Lab).
// =====================================================================

import type { VisualKind } from '../art/sprites';
import { CARDS2, type Card2, type CardClass, type RaceId } from '../lab/races';

export { CARDS2, RACES, RACE_ORDER, cardsOf, unitSprite, type Card2, type CardClass, type RaceId } from '../lab/races';

// --- Klassen ---------------------------------------------------------------------------

export type AttackKind = 'melee' | 'arrow' | 'bolt' | 'siege' | 'heal';

export interface ClassStats {
  interval: number;
  speed: number;
  range: number;
  attack: AttackKind;
  radius: number;
  /** Sprite-Vergrößerung auf dem Feld */
  scale: number;
}

export const CLASS_STATS: Record<CardClass, ClassStats> = {
  Infantry: { interval: 1.0, speed: 24, range: 0, attack: 'melee', radius: 3.3, scale: 1 },
  Archers: { interval: 1.5, speed: 20, range: 64, attack: 'arrow', radius: 3.1, scale: 1 },
  Cavalry: { interval: 0.9, speed: 38, range: 0, attack: 'melee', radius: 4.4, scale: 1 },
  Mage: { interval: 1.7, speed: 18, range: 74, attack: 'bolt', radius: 3.1, scale: 1 },
  Priest: { interval: 1.4, speed: 18, range: 44, attack: 'heal', radius: 3.1, scale: 1 },
  Siege: { interval: 3.4, speed: 0, range: 9999, attack: 'siege', radius: 7, scale: 1 },
  Beast: { interval: 0.8, speed: 34, range: 0, attack: 'melee', radius: 4, scale: 1 },
  Swarm: { interval: 1.0, speed: 26, range: 0, attack: 'melee', radius: 2.8, scale: 1 },
  Champion: { interval: 1.2, speed: 20, range: 0, attack: 'melee', radius: 7, scale: 2 },
};

// --- Fähigkeiten -------------------------------------------------------------------------

export type Ability =
  | 'burn'
  | 'charge'
  | 'firepots'
  | 'whirlwind'
  | 'slow'
  | 'leap'
  | 'chain'
  | 'moonheal'
  | 'pack'
  | 'sporecloud'
  | 'root'
  | 'riposte'
  | 'frostnova'
  | 'grip'
  | 'tentacles'
  | 'shieldwall'
  | 'sunbeam'
  | 'blessing'
  | 'boulder'
  | 'banner'
  | 'bloat'
  | 'poison'
  | 'raise'
  | 'corpsecart'
  | 'flying'
  | 'zombify'
  | 'harvest'
  | 'armor'
  | 'stuncharge'
  | 'cannon'
  | 'colossus'
  | 'paid'
  | 'volley'
  | 'adapt'
  | 'chaplain'
  | 'taunt'
  /** nur Wandering Magus neben Ashclan: Feuerbolzen setzen in Brand */
  | 'firebolt';

export const ABILITY: Record<string, Ability> = {
  'Ash Brute': 'burn',
  'Boar Riders': 'charge',
  'Fire Catapult': 'firepots',
  Skullcrusher: 'whirlwind',
  'Thorn Archers': 'slow',
  'Stag Knights': 'leap',
  'Storm Caller': 'chain',
  'Moon Singer': 'moonheal',
  'Wolf Pack': 'pack',
  Sporelings: 'sporecloud',
  'Elder Treant': 'root',
  'Coral Guard': 'riposte',
  'Frost Sister': 'frostnova',
  'Snapjaw Crabs': 'grip',
  'Abyssal Kraken': 'tentacles',
  Legionnaires: 'shieldwall',
  'Dawn Invoker': 'sunbeam',
  'Sun Priestess': 'blessing',
  Trebuchet: 'boulder',
  'Lord Commander': 'banner',
  Bloaters: 'bloat',
  'Bone Archers': 'poison',
  Necromancer: 'raise',
  'Corpse Cart': 'corpsecart',
  'Carrion Crows': 'flying',
  'Zombie Horde': 'zombify',
  'The Lich': 'harvest',
  Ironbeards: 'armor',
  'Bear Riders': 'stuncharge',
  'Mountain Cannon': 'cannon',
  'Steam Colossus': 'colossus',
  'Mercenary Company': 'paid',
  'Militia Bowmen': 'volley',
  'Wandering Magus': 'adapt',
  'Field Chaplain': 'chaplain',
  'Hired Giant': 'taunt',
};

/**
 * Höchstzahl an Truppen einer Karte: steigt mit dem Kartenlevel (+40 % je Stern)
 * und durch Enchantments. Champions sind immer 1, Belagerung 1 (★3: 2) und ohne
 * Enchantments. Beim Aufdecken wird zwischen 55 % und 100 % davon gewürfelt.
 */
export function maxTroops(card: Card2, stars: number, mods?: Mods | null): number {
  if (card.cls === 'Champion') return 1;
  if (card.cls === 'Siege') return Math.max(1, Math.round(card.troops * (1 + 0.3 * (stars - 1))));
  return Math.max(1, Math.round(card.troops * (1 + 0.4 * (stars - 1)) * (mods?.troopMul ?? 1) * (mods?.raceTroops[card.race] ?? 1)));
}

export const cardByName = (name: string): Card2 => {
  const c = CARDS2.find((k) => k.name === name);
  if (!c) throw new Error(`Unbekannte Karte: ${name}`);
  return c;
};

// --- Boni -----------------------------------------------------------------------------------

export const RACE_BONUS: Record<RaceId, { name: string; text: string }> = {
  ashclan: { name: 'Rage', text: '+20 % damage, below 50 % HP: damage ×2' },
  wildwood: { name: 'Regeneration', text: 'Heals 12 % HP per second' },
  tidebound: { name: 'Tidal Wave', text: 'Every 12 s a wave hits all enemies, pushes them back and slows them briefly' },
  sunlegion: { name: 'Discipline', text: '−35 % damage taken' },
  plague: { name: 'Undeath', text: 'Half of the fallen rise again as zombies' },
  deepforge: { name: 'Iron Blood', text: 'HP +50 %' },
  drifters: { name: 'Hired Hands', text: '+20 % damage and HP' },
};

export const CLASS_BONUS: Record<CardClass, { name: string; text: string }> = {
  Infantry: { name: 'Formation', text: 'Troops and HP +17 %' },
  Archers: { name: 'Opening Volley', text: 'Attack speed +28 %, first volley fires twice' },
  Cavalry: { name: 'Stampede', text: 'Speed ×2, HP +20 %, charge on first hit' },
  Mage: { name: 'Conjuring', text: 'Summons troops in front of the army' },
  Priest: { name: 'Guardians', text: 'Summons 2 giants with lots of HP' },
  Siege: { name: 'Bulwark', text: 'Builds a wall in front of the army' },
  Beast: { name: 'Wild', text: 'Speed, damage and HP +12 %' },
  Swarm: { name: 'Endless', text: 'Troops +20 %' },
  Champion: { name: 'Duel', text: 'Damage ×1.25 per champion slain' },
};

// --- Bosse -------------------------------------------------------------------------------

export interface Boss {
  race: RaceId;
  name: string;
  title: string;
  hp: number;
  dmg: number;
  kind: VisualKind;
  passive: { name: string; text: string };
  deck: string[];
}

export const BOSSES: Record<RaceId, Boss> = {
  drifters: {
    race: 'drifters',
    name: 'Rusk',
    title: 'the Bandit King',
    hp: 3100,
    dmg: 60,
    kind: 'hammer',
    passive: { name: 'Cowardly', text: 'Below 25 % HP he tries to flee.' },
    deck: ['Mercenary Company', 'Mercenary Company', 'Mercenary Company', 'Militia Bowmen', 'Militia Bowmen', 'Militia Bowmen', 'Field Chaplain', 'Wandering Magus'],
  },
  ashclan: {
    race: 'ashclan',
    name: 'Gorrak Ashmaw',
    title: 'the Burning Warchief',
    hp: 3200,
    dmg: 75,
    kind: 'berserker',
    passive: { name: 'Scorched Earth', text: 'Every 8 s a random spot of the field catches fire.' },
    deck: ['Ash Brute', 'Ash Brute', 'Boar Riders', 'Boar Riders', 'Fire Catapult', 'Skullcrusher', 'Mercenary Company', 'Militia Bowmen'],
  },
  wildwood: {
    race: 'wildwood',
    name: 'Sylvara',
    title: 'Heart of the Forest',
    hp: 2700,
    dmg: 55,
    kind: 'healer',
    passive: { name: 'Overgrowth', text: 'Thorn hedges grow and slow all non-Wildwood units.' },
    deck: ['Thorn Archers', 'Thorn Archers', 'Wolf Pack', 'Sporelings', 'Moon Singer', 'Storm Caller', 'Elder Treant', 'Field Chaplain'],
  },
  tidebound: {
    race: 'tidebound',
    name: 'Queen Nerissa',
    title: 'of the Deep',
    hp: 2600,
    dmg: 70,
    kind: 'mage',
    passive: { name: 'Rising Tide', text: 'Every 20 s a flood wave pushes your army back.' },
    deck: ['Coral Guard', 'Coral Guard', 'Coral Guard', 'Snapjaw Crabs', 'Snapjaw Crabs', 'Frost Sister', 'Abyssal Kraken', 'Wandering Magus'],
  },
  sunlegion: {
    race: 'sunlegion',
    name: 'Emperor Aurelian',
    title: 'of the Sun',
    hp: 1800,
    dmg: 60,
    kind: 'mount',
    passive: { name: 'Endless Legion', text: 'Every 15 s, 15 fresh Legionnaires march in.' },
    deck: ['Legionnaires', 'Legionnaires', 'Sun Priestess', 'Dawn Invoker', 'Trebuchet', 'Lord Commander', 'Mercenary Company', 'Field Chaplain'],
  },
  plague: {
    race: 'plague',
    name: 'Morvath',
    title: 'the Undying',
    hp: 1700,
    dmg: 45,
    kind: 'necro',
    passive: { name: 'Endless Dead', text: 'Most of his fallen rise again as zombies.' },
    deck: ['Zombie Horde', 'Zombie Horde', 'Bloaters', 'Bone Archers', 'Necromancer', 'Carrion Crows', 'Corpse Cart', 'The Lich'],
  },
  deepforge: {
    race: 'deepforge',
    name: 'Thane Borin',
    title: 'Deephammer',
    hp: 2700,
    dmg: 70,
    kind: 'hammer',
    passive: { name: 'Iron Bastion', text: 'His army starts behind a stone wall.' },
    deck: ['Ironbeards', 'Ironbeards', 'Ironbeards', 'Bear Riders', 'Bear Riders', 'Mountain Cannon', 'Steam Colossus', 'Hired Giant'],
  },
};

// --- Enchantments -----------------------------------------------------------------------

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'greed';

export const RARITY: Record<Rarity, { name: string; color: string; dark: string; weight: number }> = {
  common: { name: 'Common', color: '#b8b8c0', dark: '#5e5e68', weight: 40 },
  uncommon: { name: 'Uncommon', color: '#5cd65c', dark: '#1f6e2a', weight: 26 },
  rare: { name: 'Rare', color: '#4a9dff', dark: '#1c4a96', weight: 14 },
  epic: { name: 'Epic', color: '#b45cff', dark: '#58218e', weight: 8 },
  legendary: { name: 'Legendary', color: '#ffc93a', dark: '#96650e', weight: 3 },
  greed: { name: 'Greed', color: '#ff3a3a', dark: '#7e1016', weight: 10 },
};

/** Wirkungen auf das eigene Heer, von Enchantments aufaddiert. */
export interface Mods {
  troopMul: number;
  hpMul: number;
  dmgMul: number;
  atkSpeedMul: number;
  speedMul: number;
  sizeMul: number;
  baseHp: number;
  regenPct: number;
  castleHeal: number;
  goldMul: number;
  raceTroops: Partial<Record<RaceId, number>>;
  raceDmg: Partial<Record<RaceId, number>>;
  classHp: Partial<Record<CardClass, number>>;
  bonusMul: number;
}

export const newMods = (): Mods => ({
  troopMul: 1,
  hpMul: 1,
  dmgMul: 1,
  atkSpeedMul: 1,
  speedMul: 1,
  sizeMul: 1,
  baseHp: 0,
  regenPct: 0,
  castleHeal: 0,
  goldMul: 1,
  raceTroops: {},
  raceDmg: {},
  classHp: {},
  bonusMul: 1,
});

export interface Enchant {
  id: string;
  name: string;
  rarity: Rarity;
  text: string;
  /** Nachteil (nur Greed) */
  cost?: string;
  apply: (m: Mods) => void;
  /** Rezept zum Wiederherstellen aus einem Spielstand */
  spec?: EnchantSpec;
}

export type EnchantSpec = { greed: string } | { maker: number; rarity: Exclude<Rarity, 'greed'>; race: RaceId; cls: CardClass };

export function restoreEnchant(spec: EnchantSpec): Enchant {
  if ('greed' in spec) return { ...GREED.find((g) => g.id === spec.greed)!, spec };
  return { ...MAKERS[spec.maker]!(spec.rarity, spec.race, spec.cls), spec };
}

const TIER: Record<Exclude<Rarity, 'greed'>, number> = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 6 };
const RACE_NAMES: Record<RaceId, string> = {
  ashclan: 'Ashclan',
  wildwood: 'Wildwood',
  tidebound: 'Tidebound',
  sunlegion: 'Sun Legion',
  plague: 'Plague Court',
  deepforge: 'Deepforge',
  drifters: 'Drifters',
};

type Maker = (r: Exclude<Rarity, 'greed'>, race: RaceId, cls: CardClass) => Enchant;

export const MAKERS: Maker[] = [
  (r) => ({ id: 'troops', name: 'Reinforcements', rarity: r, text: `+${TIER[r] * 12} % max troops`, apply: (m) => (m.troopMul *= 1 + TIER[r] * 0.12) }),
  (r) => ({ id: 'basehp', name: 'Stone Walls', rarity: r, text: `+${TIER[r] * 25} castle HP`, apply: (m) => (m.baseHp += TIER[r] * 25) }),
  (r) => ({ id: 'regen', name: 'Field Rations', rarity: r, text: `Units heal ${TIER[r] * 0.5} % HP per second`, apply: (m) => (m.regenPct += TIER[r] * 0.005) }),
  (r) => ({ id: 'dmg', name: 'Whetstones', rarity: r, text: `+${TIER[r] * 6} % damage`, apply: (m) => (m.dmgMul *= 1 + TIER[r] * 0.06) }),
  (r) => ({ id: 'hp', name: 'Chain Mail', rarity: r, text: `+${TIER[r] * 7} % unit HP`, apply: (m) => (m.hpMul *= 1 + TIER[r] * 0.07) }),
  (r) => ({ id: 'haste', name: 'War Drums', rarity: r, text: `+${TIER[r] * 5} % attack speed`, apply: (m) => (m.atkSpeedMul *= 1 + TIER[r] * 0.05) }),
  (r) => ({ id: 'heal', name: 'Masons', rarity: r, text: `Castle heals ${TIER[r] * 10} HP each round`, apply: (m) => (m.castleHeal += TIER[r] * 10) }),
  (r) => ({ id: 'gold', name: 'Tax Collector', rarity: r, text: `+${TIER[r] * 10} % gold`, apply: (m) => (m.goldMul *= 1 + TIER[r] * 0.1) }),
  (r, race) => ({
    id: `race-${race}`,
    name: `${RACE_NAMES[race]} Banner`,
    rarity: r,
    text: `${RACE_NAMES[race]} cards: +${TIER[r] * 20} % max troops`,
    apply: (m) => (m.raceTroops[race] = (m.raceTroops[race] ?? 1) * (1 + TIER[r] * 0.2)),
  }),
  (r, race) => ({
    id: `rdmg-${race}`,
    name: `${RACE_NAMES[race]} Fury`,
    rarity: r,
    text: `${RACE_NAMES[race]} cards: +${TIER[r] * 12} % damage`,
    apply: (m) => (m.raceDmg[race] = (m.raceDmg[race] ?? 1) * (1 + TIER[r] * 0.12)),
  }),
  (r, _race, cls) => ({
    id: `cls-${cls}`,
    name: `${cls} Drill`,
    rarity: r,
    text: `${cls} cards: +${TIER[r] * 15} % HP`,
    apply: (m) => (m.classHp[cls] = (m.classHp[cls] ?? 1) * (1 + TIER[r] * 0.15)),
  }),
  (r) => ({ id: 'bonus', name: 'Harmony', rarity: r, text: `Race & class bonuses +${TIER[r] * 10} % stronger`, apply: (m) => (m.bonusMul *= 1 + TIER[r] * 0.1) }),
];

export const GREED: Enchant[] = [
  { id: 'frenzy', name: 'Frenzy', rarity: 'greed', text: 'Attack speed +500 %', cost: 'Damage −66 %', apply: (m) => ((m.atkSpeedMul *= 6), (m.dmgMul *= 0.34)) },
  { id: 'titans', name: 'Titans', rarity: 'greed', text: 'Units 2× size and 2× HP', cost: '0.5× speed, 0.5× attack speed', apply: (m) => ((m.sizeMul *= 2), (m.hpMul *= 2), (m.speedMul *= 0.5), (m.atkSpeedMul *= 0.5)) },
  { id: 'glass', name: 'Glass Cannon', rarity: 'greed', text: 'Damage ×3', cost: 'Unit HP ×0.4', apply: (m) => ((m.dmgMul *= 3), (m.hpMul *= 0.4)) },
  { id: 'horde', name: 'The Horde', rarity: 'greed', text: 'Troops ×2.5', cost: 'HP ×0.5, damage ×0.7', apply: (m) => ((m.troopMul *= 2.5), (m.hpMul *= 0.5), (m.dmgMul *= 0.7)) },
  { id: 'bloodpact', name: 'Blood Pact', rarity: 'greed', text: 'Damage ×2', cost: 'Castle HP −50 %', apply: (m) => ((m.dmgMul *= 2), (m.baseHp -= 150)) },
  { id: 'midas', name: 'Midas Touch', rarity: 'greed', text: 'Gold ×3', cost: 'Troops ×0.7', apply: (m) => ((m.goldMul *= 3), (m.troopMul *= 0.7)) },
  { id: 'quicksilver', name: 'Quicksilver', rarity: 'greed', text: 'Speed ×2.5, attack speed ×1.5', cost: 'Unit HP ×0.5', apply: (m) => ((m.speedMul *= 2.5), (m.atkSpeedMul *= 1.5), (m.hpMul *= 0.5)) },
  { id: 'ironwall', name: 'Iron Wall', rarity: 'greed', text: 'Unit HP ×3', cost: 'Damage ×0.4', apply: (m) => ((m.hpMul *= 3), (m.dmgMul *= 0.4)) },
];

export function rollRarity(rnd: () => number): Rarity {
  const entries = Object.entries(RARITY) as [Rarity, { weight: number }][];
  const total = entries.reduce((s, [, v]) => s + v.weight, 0);
  let x = rnd() * total;
  for (const [k, v] of entries) {
    x -= v.weight;
    if (x <= 0) return k;
  }
  return 'common';
}

export function rollEnchant(rnd: () => number, race: RaceId, cls: CardClass): Enchant {
  const r = rollRarity(rnd);
  if (r === 'greed') {
    const g = GREED[Math.floor(rnd() * GREED.length)]!;
    return { ...g, spec: { greed: g.id } };
  }
  const maker = Math.floor(rnd() * MAKERS.length);
  return { ...MAKERS[maker]!(r, race, cls), spec: { maker, rarity: r, race, cls } };
}

// --- Räume -----------------------------------------------------------------------------------

export type RoomKind = 'battle' | 'treasure' | 'shop' | 'enchant' | 'pyre' | 'boss';

export const ROOM_INFO: Record<RoomKind, { name: string; text: string }> = {
  battle: { name: 'Battle', text: 'Fight an army of this world.' },
  treasure: { name: 'Treasure', text: 'A chest waits in the woods.' },
  shop: { name: 'Shop', text: 'A goblin sells and upgrades cards.' },
  enchant: { name: 'Enchanter', text: 'A mage offers a lasting enchantment.' },
  pyre: { name: 'Pyre', text: 'Burn one card to thin your deck.' },
  boss: { name: 'Boss', text: 'The ruler of this world.' },
};

/** Ort, an dem in jeder Welt Karten entsorgt werden. */
export const PYRE_PLACE: Record<RaceId, { name: string; text: string }> = {
  ashclan: { name: 'Lava Pit', text: 'Throw a card into the molten rock.' },
  wildwood: { name: 'Rotting Stump', text: 'Let the forest swallow a card.' },
  tidebound: { name: 'Whirlpool', text: 'Give a card to the deep.' },
  sunlegion: { name: 'Sun Altar', text: 'Sacrifice a card to the eternal flame.' },
  plague: { name: 'Open Grave', text: 'Bury a card for good.' },
  deepforge: { name: 'Furnace', text: 'Melt a card down in the forge.' },
  drifters: { name: 'Campfire', text: 'Burn a card for warmth.' },
};

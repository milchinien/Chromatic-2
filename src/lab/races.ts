// Die 7 Rassen/Farben und alle 36 Karten aus docs/design.md, dazu die
// Kartenbilder. Einheiten werden IMMER in der Farbe ihrer Rasse gezeichnet –
// unabhängig davon, in welcher Farb-Welt gekämpft wird.

import { buildUnitFrames, PALETTES, type Palette, type VisualKind } from '../art/sprites';
import type { IconName } from './pixels';

export type RaceId = 'ashclan' | 'wildwood' | 'tidebound' | 'sunlegion' | 'plague' | 'deepforge' | 'drifters';

export interface Race {
  id: RaceId;
  name: string;
  /** Farbname für die Oberfläche */
  color: string;
  /** Hintergrund des Kartenbilds (dunkel → hell) */
  art: readonly [string, string, string, string];
  /** Farben der Figuren */
  unit: Palette;
}

export const RACES: Record<RaceId, Race> = {
  ashclan: { id: 'ashclan', name: 'Ashclan', color: 'Red', art: ['#2a0508', '#6e1018', '#b8242c', '#f0603f'], unit: PALETTES.krieg },
  wildwood: { id: 'wildwood', name: 'Wildwood', color: 'Green', art: ['#06200c', '#12501e', '#2a8a2c', '#7cd24a'], unit: PALETTES.natur },
  tidebound: {
    id: 'tidebound',
    name: 'Tidebound',
    color: 'Blue',
    art: ['#04142e', '#0b3a78', '#1a6fc0', '#5cc4f0'],
    unit: { B: '#2f7fd8', D: '#17407e', L: '#6cc4ff', glow: '#9ff0ff', skin: '#9fd6c8', skinD: '#5f9a8c', animal: '#3a6fa0', stone: '#6f8aa6', blood: '#2a5f9a' },
  },
  sunlegion: {
    id: 'sunlegion',
    name: 'Sun Legion',
    color: 'Gold',
    art: ['#2e1c02', '#6e4606', '#b8820e', '#f6cc3a'],
    unit: { B: '#e0a922', D: '#8a5a10', L: '#ffe27a', glow: '#fff4b0', skin: '#f2c29b', skinD: '#c98a67', animal: '#efe6d0', stone: '#d8cfb8', blood: '#a3202c' },
  },
  plague: { id: 'plague', name: 'Plague Court', color: 'Violet', art: ['#160522', '#3c0f5e', '#6e2aa0', '#b070e0'], unit: PALETTES.untot },
  deepforge: { id: 'deepforge', name: 'Deepforge', color: 'Grey', art: ['#111317', '#2c3038', '#555b66', '#9aa1ad'], unit: PALETTES.stein },
  drifters: { id: 'drifters', name: 'Drifters', color: 'Colorless', art: ['#1f1a14', '#4a3f32', '#857260', '#cdbb9c'], unit: PALETTES.farblos },
};

export const RACE_ORDER: readonly RaceId[] = ['ashclan', 'wildwood', 'tidebound', 'sunlegion', 'plague', 'deepforge', 'drifters'];

export type CardClass = 'Infantry' | 'Archers' | 'Cavalry' | 'Mage' | 'Priest' | 'Siege' | 'Beast' | 'Swarm' | 'Champion';

export const CLASS_ICON: Record<CardClass, IconName> = {
  Infantry: 'shield',
  Archers: 'bow',
  Cavalry: 'horse',
  Mage: 'staff',
  Priest: 'cross',
  Siege: 'tower',
  Beast: 'horse',
  Swarm: 'skull',
  Champion: 'crown',
};

export interface Card2 {
  name: string;
  race: RaceId;
  cls: CardClass;
  troops: number;
  dmg: number;
  hp: number;
  text: string;
  /** Welche Pixel-Figur das Kartenbild zeigt */
  kind: VisualKind;
  stars: number;
}

const c = (race: RaceId, name: string, cls: CardClass, troops: number, dmg: number, hp: number, kind: VisualKind, text: string, stars = 1): Card2 => ({
  name,
  race,
  cls,
  troops,
  dmg,
  hp,
  kind,
  text,
  stars,
});

export const CARDS2: readonly Card2[] = [
  c('ashclan', 'Ash Brute', 'Infantry', 71, 8, 11, 'berserker', 'Burning Blade: Hits set the target on fire for 2 s.'),
  c('ashclan', 'Boar Riders', 'Cavalry', 45, 14, 20, 'mount', 'Charge: First hit deals triple damage and knocks the target back.', 2),
  c('ashclan', 'Fire Catapult', 'Siege', 4, 138, 166, 'tower', 'Hurls firepots that leave burning ground for 5 s.'),
  c('ashclan', 'Skullcrusher', 'Champion', 1, 164, 990, 'hammer', 'Whirlwind: Every 4 s, spins and hurls all nearby enemies away.', 3),

  c('wildwood', 'Thorn Archers', 'Archers', 95, 6, 8, 'ranger', 'Thorned arrows slow the target by 25 % for 2 s.'),
  c('wildwood', 'Stag Knights', 'Cavalry', 40, 15, 27, 'stag', 'Leap: Jumps over the enemy front line and attacks the backline first.', 2),
  c('wildwood', 'Storm Caller', 'Mage', 12, 20, 12, 'mage', 'Chain Lightning: jumps between up to 5 enemies.', 3),
  c('wildwood', 'Moon Singer', 'Priest', 43, 5, 21, 'healer', 'Every 4 s, a wave of moonlight heals all allies in a large area.'),
  c('wildwood', 'Wolf Pack', 'Beast', 56, 11, 16, 'wolf', 'Pack Hunter: +10 % damage for each wolf nearby (max +50 %).'),
  c('wildwood', 'Sporelings', 'Swarm', 330, 3, 3, 'ghoul', 'On death, releases a spore cloud that slows enemies.'),
  c('wildwood', 'Elder Treant', 'Champion', 1, 96, 1432, 'bastion', 'Root Grip: Every 6 s, roots all enemies in a large circle for 3 s.', 2),

  c('tidebound', 'Coral Guard', 'Infantry', 76, 8, 16, 'warrior', 'Riposte: Every 3rd melee hit taken is countered for double damage.'),
  c('tidebound', 'Frost Sister', 'Mage', 19, 23, 16, 'mage', 'Frost Nova: freezes all enemies in a small area for 2 s.', 2),
  c('tidebound', 'Snapjaw Crabs', 'Beast', 39, 14, 30, 'wolf', 'Grip: Holds its target in place until one of them dies.'),
  c('tidebound', 'Abyssal Kraken', 'Champion', 1, 78, 1125, 'citadel', 'Four tentacles attack four different targets at once.', 3),

  c('sunlegion', 'Legionnaires', 'Infantry', 108, 6, 10, 'warrior', 'Shield Wall: Ranged damage from the front is halved.', 2),
  c('sunlegion', 'Dawn Invoker', 'Mage', 10, 30, 17, 'mage', 'Sunbeam: A beam of light hits an entire line and blinds (30 % miss chance for 3 s).'),
  c('sunlegion', 'Sun Priestess', 'Priest', 21, 9, 34, 'healer', 'Blessing: Places light shields on the front line (absorb 10 damage).'),
  c('sunlegion', 'Trebuchet', 'Siege', 2, 87, 109, 'tower', 'Huge range and blast radius, but very slow to reload.'),
  c('sunlegion', 'Lord Commander', 'Champion', 1, 131, 1027, 'mount', 'Banner of the Sun: All allies +15 % damage. If he falls, allies lose morale.', 3),

  c('plague', 'Bloaters', 'Infantry', 53, 5, 18, 'ghoul', 'On death, explodes into a poison cloud.'),
  c('plague', 'Bone Archers', 'Archers', 68, 5, 7, 'skeleton', 'Poisoned arrows: 2 damage per second for 4 s, stacks.', 2),
  c('plague', 'Necromancer', 'Mage', 9, 7, 14, 'necro', 'Raises two skeleton warriors from the ground every 2.5 s.'),
  c('plague', 'Corpse Cart', 'Siege', 2, 42, 66, 'citadel', 'Flings corpses that rise as zombies where they land.'),
  c('plague', 'Carrion Crows', 'Beast', 95, 10, 9, 'wolf', 'Flying. Prefers wounded targets.'),
  c('plague', 'Zombie Horde', 'Swarm', 305, 3, 4, 'ghoul', 'Enemies killed by zombies rise as new zombies.', 2),
  c('plague', 'The Lich', 'Champion', 1, 79, 941, 'necro', 'Soul Harvest: +2 damage for every unit that dies. Raises a Necromancer every 4 s.', 3),

  c('deepforge', 'Ironbeards', 'Infantry', 72, 10, 9, 'hammer', 'Armor 3: Every hit taken deals 3 less damage.', 2),
  c('deepforge', 'Bear Riders', 'Cavalry', 24, 30, 28, 'wolf', 'Crushing Charge: stuns enemies hit by the charge for 1.5 s.'),
  c('deepforge', 'Mountain Cannon', 'Siege', 2, 100, 60, 'tower', 'Fires a straight shot that pierces through an entire line.'),
  c('deepforge', 'Steam Colossus', 'Champion', 1, 500, 1920, 'tradepost', 'Trample: Rolls over enemies. Explodes on death, dealing massive area damage.', 3),

  c('drifters', 'Mercenary Company', 'Infantry', 108, 8, 12, 'warrior', 'Paid in Advance: Earn gold after each battle for surviving troops.'),
  c('drifters', 'Militia Bowmen', 'Archers', 129, 5, 7, 'ranger', 'Volley: Fire all at once every 3 s.'),
  c('drifters', 'Wandering Magus', 'Mage', 11, 40, 23, 'mage', "Adapts: Uses the magic of your other card's color.", 2),
  c('drifters', 'Field Chaplain', 'Priest', 24, 9, 33, 'healer', "Heals nearby allies and gives your other card's troops +10 % damage."),
  c('drifters', 'Hired Giant', 'Champion', 1, 178, 1448, 'hammer', 'Taunt: All nearby enemies must attack the giant.', 3),
];

export const cardsOf = (race: RaceId) => CARDS2.filter((k) => k.race === race);

// --- Figuren in Rassenfarbe --------------------------------------------------------------

const spriteCache = new Map<string, { url: string; w: number; h: number }>();

/** Pixel-Figur einer Karte in der Farbe ihrer Rasse (Team 0 = blaue, 1 = gelbe Abzeichen). */
export function unitSprite(card: Card2, team: 0 | 1 = 0): { url: string; w: number; h: number } {
  const key = `${card.race}|${card.kind}|${team}`;
  let hit = spriteCache.get(key);
  if (!hit) {
    const g = buildUnitFrames(card.kind, RACES[card.race].unit, team).walk0;
    const cv = document.createElement('canvas');
    cv.width = g.w;
    cv.height = g.h;
    const ctx = cv.getContext('2d')!;
    for (let y = 0; y < g.h; y++)
      for (let x = 0; x < g.w; x++) {
        const col = g.get(x, y);
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(x, y, 1, 1);
      }
    hit = { url: cv.toDataURL(), w: g.w, h: g.h };
    spriteCache.set(key, hit);
  }
  return hit;
}

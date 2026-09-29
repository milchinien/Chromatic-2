// Ausführliche Beschreibung der Rassen- und Klassenboni für die Bonus-Details
// im Kampf (Hover am PC, Antippen am Handy). Die Zahlen entsprechen der
// Simulation (sim/arena.ts) und berücksichtigen das Enchantment „Harmony“
// (bonusMul).

import { icon } from '../lab/pixels';
import { CLASS_BONUS, RACE_BONUS, RACES, type Card2, type CardClass, type RaceId } from './data';

export interface BonusDetail {
  kind: 'race' | 'class' | 'none';
  name: string;
  /** Art des Bonus und wen er betrifft */
  tag: string;
  /** Kurztext wie auf der Karte */
  text: string;
  lines: string[];
  color: string;
}

const num = (v: number) => String(Math.round(v * 100) / 100);
const pct = (v: number) => `${Math.round(v * 10) / 10} %`;

function harmony(bm: number): string[] {
  return bm > 1.001 ? [`Harmony: this bonus is ${Math.round((bm - 1) * 100)} % stronger.`] : [];
}

export function raceBonusDetail(r: RaceId, bm = 1): BonusDetail {
  const lines: Record<RaceId, string[]> = {
    ashclan: ['Every unit below 50 % HP deals ×1.5 damage.', 'The more they bleed, the harder they hit.'],
    wildwood: [`Every unit heals ${pct(bm)} of its max HP per second.`, 'Keeps working for the whole round.'],
    tidebound: ['When the battle starts, a flood wave pushes every enemy unit back.', 'Siege weapons and bosses are not moved.'],
    sunlegion: ['Every hit against this army deals 0.5 less damage per 10 living allies.', 'Up to −2.5 per hit with 50+ allies – big armies get tougher.', 'A hit always deals at least 25 %.'],
    plague: [`${pct(20 * bm)} of the fallen units rise again as zombies.`, 'The zombies keep fighting for this army.'],
    deepforge: [`All units have ×${num(1 + bm)} HP.`],
    drifters: [`All units get +${pct(10 * bm)} HP and +${pct(10 * bm)} damage.`],
  };
  return {
    kind: 'race',
    name: RACE_BONUS[r].name,
    tag: `Race bonus · ${RACES[r].name} · whole army`,
    text: RACE_BONUS[r].text,
    lines: [...lines[r], ...(r === 'ashclan' || r === 'tidebound' || r === 'sunlegion' ? [] : harmony(bm))],
    color: RACES[r].art[3],
  };
}

export function classBonusDetail(c: CardClass, bm = 1): BonusDetail {
  const lines: Record<CardClass, string[]> = {
    Infantry: [`+${pct(50 * bm)} troops.`, `+${pct(50 * bm)} HP for every soldier.`],
    Archers: ['Every archer fires its first volley twice.', 'A huge opening strike before the armies meet.'],
    Cavalry: [`Riders move ×${num(1 + bm)} as fast.`, 'Every rider’s first hit is a charge: ×3 damage and it knocks the target back.'],
    Mage: [`${Math.round(24 * bm)} extra warriors appear in front of the army every round.`, 'They are infantry, swarms or beasts of the front card’s color.'],
    Priest: ['2 hammer giants join the army every round.', `${Math.round(260 * bm)} HP each, heavy melee hits.`],
    Siege: ['A stone wall is built across the whole field in front of the army.', `Every wall segment has ${Math.round(90 * bm)} HP – enemies must break through.`],
    Beast: [`Speed, damage and HP ×${num(1 + 0.5 * bm)} for all beasts.`],
    Swarm: [`Troops ×${num(1 + 2 * bm)}.`],
    Champion: ['Champions deal ×1.25 damage for every enemy champion slain this round.'],
  };
  return {
    kind: 'class',
    name: CLASS_BONUS[c].name,
    tag: `Class bonus · ${c} · both cards`,
    text: CLASS_BONUS[c].text,
    lines: [...lines[c], ...(c === 'Archers' || c === 'Champion' ? [] : harmony(bm))],
    color: '#ffd23a',
  };
}

/** Boni eines Kartenpaars (Front + Back). Ohne Paar: ein Hinweis, wie man Boni bekommt. */
export function pairBonuses(a: Card2 | null, b: Card2 | null, bm = 1): BonusDetail[] {
  const out: BonusDetail[] = [];
  if (a && b && a.race === b.race) out.push(raceBonusDetail(a.race, bm));
  if (a && b && a.cls === b.cls) out.push(classBonusDetail(a.cls, bm));
  if (!out.length)
    out.push({
      kind: 'none',
      name: a && b ? 'No bonus' : 'Bonuses',
      tag: 'How to get a bonus',
      text: a && b ? 'These two cards share neither color nor class.' : 'Choose 2 cards for this round.',
      lines: ['Same COLOR (race) → race bonus for the whole army.', 'Same CLASS → class bonus for both cards.', 'Both at once → both bonuses!'],
      color: '#b8ad9a',
    });
  return out;
}

export function bonusPopHtml(items: BonusDetail[], dir: 'row' | 'col'): string {
  return `
    <div class="bpop ${dir}">
      ${items
        .map(
          (d) => `
        <div class="bpop-item k-${d.kind}" style="--bc:${d.color}">
          <div class="bpop-head">${icon('star')}<b>${d.name}</b></div>
          <div class="bpop-tag">${d.tag}</div>
          <p class="bpop-text">${d.text}</p>
          <ul class="bpop-lines">${d.lines.map((l) => `<li>${l}</li>`).join('')}</ul>
        </div>`,
        )
        .join('')}
    </div>`;
}

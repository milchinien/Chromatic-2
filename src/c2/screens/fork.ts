// Weggabelung im Wald: zwei Wege, im Vordergrund je ein Info-Panel mit Raum,
// Schwierigkeit und möglicher Belohnung. Vor dem Boss nur ein Weg.

import { icon, type IconName } from '../../lab/pixels';
import { forkBg } from '../art/scenes';
import { BOSSES, ROOM_INFO, type RoomKind } from '../data';
import type { Game } from '../game';
import type { Room } from '../run';

const ROOM_ICON: Record<RoomKind, IconName> = {
  battle: 'swords',
  treasure: 'chest',
  shop: 'bag',
  enchant: 'star',
  pyre: 'flame',
  boss: 'skull',
};

function stars(n: number): string {
  let s = '';
  for (let i = 0; i < 5; i++) s += icon('star', i < n ? '' : 'empty');
  return s;
}

function roomPanel(g: Game, r: Room, side: 'left' | 'right' | 'center'): string {
  const run = g.run!;
  const info = ROOM_INFO[r.kind];
  const title = r.kind === 'boss' ? `${BOSSES[run.world].name}` : info.name;
  const text = r.kind === 'boss' ? `${BOSSES[run.world].title}. ${BOSSES[run.world].passive.name}: ${BOSSES[run.world].passive.text}` : info.text;
  const showStars = r.kind === 'battle' || r.kind === 'boss';
  return `
    <button class="room-card k-${r.kind} ${side}">
      <div class="rc-icon">${icon(ROOM_ICON[r.kind])}</div>
      <div class="rc-name">${title}</div>
      ${showStars ? `<div class="rc-stars" title="Difficulty">${stars(r.stars)}</div>` : ''}
      <p class="rc-text">${text}</p>
      <div class="rc-reward"><span>Reward</span>${run.rewardText(r).map((t) => `<b>${t}</b>`).join('')}</div>
      <div class="rc-go">${r.kind === 'boss' ? 'Face the boss' : 'Take this path'} ${icon('play')}</div>
    </button>`;
}

export function forkScreen(g: Game, rooms: [Room, Room], onPick: (r: Room) => void): void {
  const el = document.createElement('section');
  el.className = 'scr fork-scr';
  el.style.backgroundImage = forkBg(g.theme, rooms[0].kind === 'boss');
  const boss = rooms[0].kind === 'boss';
  el.innerHTML = `
    ${g.hudHtml()}
    <div class="fork-title">${boss ? 'The path ends here' : 'The road forks'}</div>
    ${boss ? roomPanel(g, rooms[0], 'center') : roomPanel(g, rooms[0], 'left') + roomPanel(g, rooms[1], 'right')}`;
  g.ui.appendChild(el);
  g.bindHud();
  el.querySelectorAll<HTMLButtonElement>('.room-card').forEach((b, i) => b.addEventListener('click', () => onPick(rooms[boss ? 0 : i]!)));
}

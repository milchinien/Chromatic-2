import { cardIconUrl } from '../art/atlas';
import { PALETTES } from '../art/sprites';
import { CARDS, CLASSES, CLASS_LABEL, COLORS, COLOR_LABEL, type CardDef } from '../data/cards';
import { BASE_HP, type Battle, type SideSetup } from '../sim/battle';

// =====================================================================
// DOM-Oberfläche: Karten-Slots, Kartenauswahl, HUD, Ergebnis-Fenster.
// =====================================================================

export interface UiHandlers {
  onSideChange: () => void;
  onFight: () => void;
  onPause: () => void;
  onSpeed: (s: number) => void;
  onReset: () => void;
}

const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`Element fehlt: ${sel}`);
  return el;
};

const iconCache = new Map<string, string>();
function icon(card: CardDef, scale: number, team: 0 | 1 = 0): string {
  const key = `${card.id}:${scale}:${team}`;
  let url = iconCache.get(key);
  if (!url) {
    url = cardIconUrl(card, scale, team);
    iconCache.set(key, url);
  }
  return url;
}

function cardVars(card: CardDef): string {
  const p = PALETTES[card.color];
  return `--c:${p.B};--cd:${p.D};--cl:${p.L}`;
}

const fmt = (n: number, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toLocaleString('de-DE');

const SIDE_NAME = ['Deine Armee', 'Gegner'];
const MAX_COUNT = 3000;

export class Ui {
  private pickerSide = 0;
  private locked = false;
  private hudTick = 0;

  constructor(
    private readonly sides: [SideSetup, SideSetup],
    private readonly h: UiHandlers,
  ) {
    $('#btn-fight').addEventListener('click', () => h.onFight());
    $('#btn-pause').addEventListener('click', () => h.onPause());
    $('#btn-reset').addEventListener('click', () => h.onReset());
    document.querySelectorAll<HTMLButtonElement>('.btn-speed').forEach((b) =>
      b.addEventListener('click', () => h.onSpeed(Number(b.dataset.speed))),
    );
    $('#picker-close').addEventListener('click', () => this.closePicker());
    $('#picker').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.closePicker();
    });
    $('#result-again').addEventListener('click', () => {
      this.hideResult();
      h.onReset();
    });
    $('#result-close').addEventListener('click', () => this.hideResult());
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closePicker();
        this.hideResult();
      }
      if (e.code === 'Space' && $('#picker').classList.contains('hidden')) {
        e.preventDefault();
        if (!this.locked) h.onFight();
        else h.onPause();
      }
    });
    this.buildPickerGrid();
    this.renderSlots();
  }

  // --- Karten-Slots -------------------------------------------------------------

  renderSlots(): void {
    for (const side of [0, 1] as const) {
      const s = this.sides[side];
      const el = $(`.slot[data-side="${side}"]`);
      const c = s.card;
      el.innerHTML = `
        <div class="card" style="${cardVars(c)}" title="Karte wählen">
          <div class="card-name">${c.name}</div>
          <div class="card-art"><img src="${icon(c, c.cls === 'festung' ? 3 : 4, side)}" alt=""></div>
          <div class="card-sub">${CLASS_LABEL[c.cls]} · ${COLOR_LABEL[c.color]}</div>
          <div class="card-change">${this.locked ? '' : '▸ Karte wählen'}</div>
        </div>
        <div class="opts px-box">
          <div class="opt-label">${SIDE_NAME[side]}<span class="team-chip team-${side}"></span></div>
          <div>
            <div class="opt-label">Truppen <b class="count">${s.count}</b></div>
            <input type="range" class="count-range" min="10" max="${MAX_COUNT}" step="10" value="${s.count}" ${this.locked ? 'disabled' : ''}>
          </div>
          <div class="opt-label" style="align-items:center">Stufe
            <span class="stepper">
              <button class="btn lvl-down" ${this.locked ? 'disabled' : ''}>−</button>
              <b class="lvl">${s.level}</b>
              <button class="btn lvl-up" ${this.locked ? 'disabled' : ''}>+</button>
            </span>
          </div>
        </div>`;
      $('.card', el).addEventListener('click', () => {
        if (!this.locked) this.openPicker(side);
      });
      const range = $<HTMLInputElement>('.count-range', el);
      range.addEventListener('input', () => {
        s.count = Number(range.value);
        $('.count', el).textContent = String(s.count);
        this.h.onSideChange();
      });
      $('.lvl-down', el).addEventListener('click', () => this.setLevel(side, s.level - 1));
      $('.lvl-up', el).addEventListener('click', () => this.setLevel(side, s.level + 1));
    }
  }

  private setLevel(side: number, lvl: number): void {
    const s = this.sides[side]!;
    s.level = Math.max(1, Math.min(15, lvl));
    $(`.slot[data-side="${side}"] .lvl`).textContent = String(s.level);
    this.h.onSideChange();
  }

  setLocked(locked: boolean): void {
    if (this.locked === locked) return;
    this.locked = locked;
    this.renderSlots();
  }

  setControls(state: Battle['state'], paused: boolean, speed: number): void {
    const fight = $<HTMLButtonElement>('#btn-fight');
    fight.disabled = state !== 'setup';
    fight.textContent = state === 'setup' ? 'Kampf!' : state === 'running' ? 'Kampf läuft' : 'Vorbei';
    const pause = $<HTMLButtonElement>('#btn-pause');
    pause.disabled = state !== 'running';
    pause.textContent = paused ? 'Weiter' : 'Pause';
    document.querySelectorAll<HTMLButtonElement>('.btn-speed').forEach((b) => b.classList.toggle('active', Number(b.dataset.speed) === speed));
  }

  // --- Kartenauswahl -------------------------------------------------------------

  private buildPickerGrid(): void {
    const grid = $('#picker-grid');
    let html = '<div></div>';
    for (const color of COLORS) {
      html += `<div class="grid-head" style="color:${PALETTES[color].L}">${COLOR_LABEL[color]}</div>`;
    }
    for (const cls of CLASSES) {
      html += `<div class="grid-row-head">${CLASS_LABEL[cls]}</div>`;
      for (const color of COLORS) {
        const c = CARDS.find((x) => x.cls === cls && x.color === color)!;
        html += `<div class="tile ${c.retired ? 'retired' : ''}" data-id="${c.id}" style="${cardVars(c)}">
          ${c.retired ? '<span class="badge" style="top:4px">alt</span>' : ''}
          <img src="${icon(c, c.cls === 'festung' ? 2 : 3)}" alt="">
          <div class="tile-name">${c.name}</div>
        </div>`;
      }
    }
    grid.innerHTML = html;
    grid.querySelectorAll<HTMLElement>('.tile').forEach((t) => {
      const card = CARDS.find((c) => c.id === t.dataset.id)!;
      t.addEventListener('mouseenter', () => this.showDetail(card));
      t.addEventListener('click', () => {
        const s = this.sides[this.pickerSide]!;
        s.card = card;
        s.count = card.defaultCount;
        this.closePicker();
        this.renderSlots();
        this.h.onSideChange();
      });
    });
  }

  private showDetail(c: CardDef): void {
    const stats: [string, string][] = [
      ['Schaden', fmt(c.dmg, 0)],
      ['HP', fmt(c.hp, 0)],
      ['Angriffstakt', `${fmt(c.interval)} s`],
      ['Tempo', c.speed === 0 ? 'statisch' : fmt(c.speed, 0)],
      ['Reichweite', c.cls === 'festung' ? 'ganzes Feld' : c.range > 0 ? `${c.range} px` : 'Nahkampf'],
      ['Truppen', String(c.defaultCount)],
    ];
    $('#picker-detail').innerHTML = `
      <h3 style="color:${PALETTES[c.color].L}">${c.name}</h3>
      <div class="note">${CLASS_LABEL[c.cls]} · ${COLOR_LABEL[c.color]}</div>
      <div class="art"><img src="${icon(c, c.cls === 'festung' ? 4 : 6, this.pickerSide as 0 | 1)}" alt=""></div>
      <p>${c.ability}</p>
      <div class="detail-stats">${stats.map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join('')}</div>
      ${c.retired ? '<div class="note">In Chromatic 1 ausgemustert.</div>' : ''}`;
  }

  openPicker(side: number): void {
    this.pickerSide = side;
    $('#picker-title').textContent = `Karte wählen – ${SIDE_NAME[side]}`;
    const cur = this.sides[side]!.card;
    document.querySelectorAll<HTMLElement>('.tile').forEach((t) => t.classList.toggle('selected', t.dataset.id === cur.id));
    this.showDetail(cur);
    $('#picker').classList.remove('hidden');
  }

  closePicker(): void {
    $('#picker').classList.add('hidden');
  }

  // --- HUD & Ergebnis --------------------------------------------------------------

  updateHud(b: Battle, fps: number, paused: boolean): void {
    if (++this.hudTick % 6 !== 0) return;
    for (const t of [0, 1] as const) {
      const el = $(`.hud-side[data-team="${t}"]`);
      const hp = b.baseHp[t]!;
      $<HTMLElement>('.hpbar-fill', el).style.width = `${(hp / BASE_HP) * 100}%`;
      $('.hpbar-text', el).textContent = `${Math.ceil(hp)} / ${BASE_HP}`;
      $('.units', el).textContent = b.counts[t]!.toLocaleString('de-DE');
    }
    const s = Math.floor(b.time);
    $('#time').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    $('#status').textContent = b.state === 'setup' ? 'Aufstellung' : b.state === 'done' ? 'Kampf vorbei' : paused ? 'Pausiert' : 'Kampf';
    $('#fps').textContent = `${Math.round(fps)} FPS · ${(b.counts[0]! + b.counts[1]!).toLocaleString('de-DE')} Einheiten`;
  }

  showResult(b: Battle): void {
    const title = $('#result-title');
    title.textContent = b.winner === 0 ? 'Sieg!' : b.winner === 1 ? 'Niederlage' : 'Unentschieden';
    title.style.color = b.winner === 0 ? 'var(--blue)' : b.winner === 1 ? 'var(--gold)' : 'var(--text)';
    const row = (label: string, a: string | number, c: string | number) => `<span>${label}</span><b>${a}</b><b>${c}</b>`;
    $('#result-stats').innerHTML =
      `<span></span><span class="h">Du</span><span class="h">Gegner</span>` +
      row('Basis-HP', Math.ceil(b.baseHp[0]!), Math.ceil(b.baseHp[1]!)) +
      row('Besiegte Gegner', b.kills[0]!, b.kills[1]!) +
      row('Überlebende', b.counts[0]!, b.counts[1]!) +
      row('Basistreffer', b.baseHits[0]!, b.baseHits[1]!) +
      `<span>Dauer</span><b>${Math.round(b.time)} s</b><span></span>`;
    $('#result-stats').classList.add('px-inset');
    $('#result').classList.remove('hidden');
  }

  hideResult(): void {
    $('#result').classList.add('hidden');
  }
}

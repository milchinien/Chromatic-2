// =====================================================================
// Balance-Editor (balance.html): zwei Heere frei zusammenstellen – Karten,
// Sterne, Truppenzahl, Boni, Enchantments, Boss – und den Kampf entweder
// ansehen oder hundertfach ohne Grafik durchrechnen lassen.
// =====================================================================

import '@fontsource/silkscreen/400.css';
import './editor.css';

import { Application, TextureSource } from 'pixi.js';
import { WORLD_THEMES } from '../lab/palettes-crt';
import {
  BOSSES,
  CARDS2,
  CLASS_BONUS,
  GREED,
  MAKERS,
  RACE_BONUS,
  RACE_ORDER,
  RACES,
  RARITY,
  cardByName,
  newMods,
  restoreEnchant,
  type CardClass,
  type EnchantSpec,
  type Mods,
  type RaceId,
  type Rarity,
} from '../c2/data';
import { buildGameAtlas } from '../c2/render/atlas';
import { ArenaView } from '../c2/render/arenaView';
import { Arena, DT, type Deployed, type SideSpec } from '../c2/sim/arena';
import { rollTroops, runRound, sharedArena } from '../c2/sim/balance';

TextureSource.defaultOptions.scaleMode = 'nearest';

// --- Zustand ---------------------------------------------------------------------------

type Tri = 'auto' | 'on' | 'off';
interface SlotState {
  name: string;
  stars: number;
  /** feste Truppenzahl; leer = wie im Spiel würfeln (55–100 %) */
  count: number | null;
}
interface SideState {
  front: SlotState;
  back: SlotState;
  power: number;
  race: Tri;
  cls: Tri;
  enchants: EnchantSpec[];
  castle: number;
}

const CLASSES: CardClass[] = ['Infantry', 'Archers', 'Cavalry', 'Mage', 'Priest', 'Siege', 'Beast', 'Swarm', 'Champion'];
const RARITIES = (Object.keys(RARITY) as Rarity[]).filter((r) => r !== 'greed') as Exclude<Rarity, 'greed'>[];

const KEY = 'c2-balance-editor';
const initial = (): { sides: [SideState, SideState]; boss: RaceId | ''; bossPower: number; world: RaceId } => ({
  sides: [
    { front: { name: 'Ash Brute', stars: 1, count: null }, back: { name: 'Thorn Archers', stars: 1, count: null }, power: 1, race: 'auto', cls: 'auto', enchants: [], castle: 300 },
    { front: { name: 'Legionnaires', stars: 1, count: null }, back: { name: 'Militia Bowmen', stars: 1, count: null }, power: 1, race: 'auto', cls: 'auto', enchants: [], castle: 70 },
  ],
  boss: '',
  bossPower: 1,
  world: 'drifters',
});
let state = initial();
try {
  const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
  if (saved?.sides) state = { ...state, ...saved };
} catch {
  /* frisch */
}
const save = () => localStorage.setItem(KEY, JSON.stringify(state));

// --- Umrechnen in Simulations-Aufstellungen ----------------------------------------------

function modsOf(s: SideState): Mods | undefined {
  if (!s.enchants.length) return undefined;
  const m = newMods();
  for (const e of s.enchants) restoreEnchant(e).apply(m);
  return m;
}

const tri = (t: Tri) => (t === 'auto' ? undefined : t === 'on');

function specOf(s: SideState, team: number, rnd = Math.random): SideSpec {
  const dep = (x: SlotState): Deployed => {
    const card = cardByName(x.name);
    return { card, stars: x.stars, count: x.count ?? rollTroops(card, rnd) };
  };
  return { front: dep(s.front), back: dep(s.back), mods: modsOf(s), baseHp: team === 0 ? s.castle : 0, power: s.power, bonus: { race: tri(s.race), cls: tri(s.cls) } };
}

const bossOf = () => (state.boss ? BOSSES[state.boss] : null);

// --- Oberfläche -----------------------------------------------------------------------------

const app = document.getElementById('app')!;
app.innerHTML = `
  <header class="ed-head">
    <h1>Chromatic 2 · Balance-Editor</h1>
    <span class="ed-hint">Links dein Heer (Team 0, bekommt wie im Spiel den stärkeren Last Stand), rechts der Gegner.</span>
    <button data-act="swap">⇄ Seiten tauschen</button>
    <button data-act="reset">Zurücksetzen</button>
  </header>
  <main class="ed-main">
    <section class="side" data-side="0"></section>
    <section class="mid">
      <div class="stage"></div>
      <div class="watch-bar">
        <button data-act="watch">▶ Runde ansehen</button>
        <button data-act="next" disabled>Nächste Runde</button>
        <span class="seg"><button data-sp="1" class="on">1×</button><button data-sp="2">2×</button><button data-sp="4">4×</button></span>
        <span class="live"></span>
      </div>
      <div class="global">
        <label>Welt (Boden) <select data-g="world">${RACE_ORDER.map((r) => `<option value="${r}">${RACES[r].name}</option>`).join('')}</select></label>
        <label>Boss <select data-g="boss"><option value="">– keiner –</option>${RACE_ORDER.map((r) => `<option value="${r}">${BOSSES[r].name}</option>`).join('')}</select></label>
        <label>Boss-Stärke <input data-g="bossPower" type="number" step="0.05" min="0.2"></label>
      </div>
      <div class="batch">
        <label>Durchläufe <input class="n" type="number" value="200" min="10" step="10"></label>
        <button data-act="rounds">Einzelne Runden rechnen</button>
        <button data-act="battles">Ganze Kämpfe rechnen (Burgen)</button>
        <div class="progress"><i></i></div>
        <div class="result"></div>
      </div>
    </section>
    <section class="side" data-side="1"></section>
  </main>`;

const cardOptions = (sel: string) => {
  let out = '';
  for (const r of RACE_ORDER) {
    out += `<optgroup label="${RACES[r].name} (${RACES[r].color})">`;
    for (const c of CARDS2.filter((k) => k.race === r)) out += `<option value="${c.name}"${c.name === sel ? ' selected' : ''}>${c.name} · ${c.cls} · ×${c.troops} ⚔${c.dmg} ♥${c.hp}</option>`;
    out += '</optgroup>';
  }
  return out;
};

function enchantRow(e: EnchantSpec, k: number): string {
  const isGreed = 'greed' in e;
  const type = isGreed ? `g:${e.greed}` : `m:${e.maker}`;
  const types = [
    ...MAKERS.map((mk, i) => `<option value="m:${i}"${type === `m:${i}` ? ' selected' : ''}>${mk('common', 'ashclan', 'Infantry').name}</option>`),
    ...GREED.map((g) => `<option value="g:${g.id}"${type === `g:${g.id}` ? ' selected' : ''}>Greed: ${g.name}</option>`),
  ].join('');
  const text = restoreEnchant(e);
  return `<div class="ench" data-k="${k}">
    <select data-e="type">${types}</select>
    ${
      isGreed
        ? ''
        : `<select data-e="rarity">${RARITIES.map((r) => `<option${r === e.rarity ? ' selected' : ''}>${r}</option>`).join('')}</select>
           <select data-e="race">${RACE_ORDER.map((r) => `<option value="${r}"${r === e.race ? ' selected' : ''}>${RACES[r].name}</option>`).join('')}</select>
           <select data-e="cls">${CLASSES.map((c) => `<option${c === e.cls ? ' selected' : ''}>${c}</option>`).join('')}</select>`
    }
    <button data-e="del">✕</button>
    <small>${text.text}${text.cost ? ` · <em>${text.cost}</em>` : ''}</small>
  </div>`;
}

function slotHtml(s: SlotState, key: 'front' | 'back'): string {
  return `<div class="slot" data-slot="${key}">
    <h3>${key === 'front' ? 'Vorne' : 'Hinten'}</h3>
    <select data-f="name">${cardOptions(s.name)}</select>
    <div class="row">
      <label>Sterne <select data-f="stars">${[1, 2, 3].map((n) => `<option${n === s.stars ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
      <label>Truppen <input data-f="count" type="number" min="1" placeholder="würfeln" value="${s.count ?? ''}"></label>
    </div>
    <p class="card-text">${cardByName(s.name).text}</p>
  </div>`;
}

function bonusInfo(s: SideState): string {
  const f = cardByName(s.front.name);
  const b = cardByName(s.back.name);
  const race = s.race === 'on' || (s.race === 'auto' && f.race === b.race);
  const cls = s.cls === 'on' || (s.cls === 'auto' && f.cls === b.cls);
  const lines: string[] = [];
  if (race) lines.push(`<b>${RACE_BONUS[f.race].name}</b> ${RACE_BONUS[f.race].text}`);
  if (cls) lines.push(`<b>${CLASS_BONUS[f.cls].name}</b> ${CLASS_BONUS[f.cls].text}`);
  return lines.length ? lines.join('<br>') : 'Kein Bonus';
}

function renderSide(i: 0 | 1): void {
  const s = state.sides[i];
  const el = app.querySelector<HTMLElement>(`.side[data-side="${i}"]`)!;
  const opt = (v: Tri) => ['auto', 'on', 'off'].map((x) => `<option value="${x}"${x === v ? ' selected' : ''}>${x === 'auto' ? 'automatisch' : x === 'on' ? 'erzwingen' : 'aus'}</option>`).join('');
  el.innerHTML = `
    <h2>${i === 0 ? 'Dein Heer' : 'Gegner'}</h2>
    ${slotHtml(s.front, 'front')}
    ${slotHtml(s.back, 'back')}
    <div class="row">
      <label>Rassenbonus <select data-s="race">${opt(s.race)}</select></label>
      <label>Klassenbonus <select data-s="cls">${opt(s.cls)}</select></label>
    </div>
    <p class="bonus">${bonusInfo(s)}</p>
    <div class="row">
      <label>Truppen-Faktor <input data-s="power" type="number" step="0.05" min="0.1" value="${s.power}"></label>
      <label>Burg-HP <input data-s="castle" type="number" step="10" min="10" value="${s.castle}"></label>
    </div>
    <h3>Enchantments</h3>
    <div class="enchants">${s.enchants.map(enchantRow).join('')}</div>
    <button data-s="addEnchant">+ Enchantment</button>`;
}

function renderAll(): void {
  renderSide(0);
  renderSide(1);
  app.querySelector<HTMLSelectElement>('[data-g="world"]')!.value = state.world;
  app.querySelector<HTMLSelectElement>('[data-g="boss"]')!.value = state.boss;
  app.querySelector<HTMLInputElement>('[data-g="bossPower"]')!.value = String(state.bossPower);
  save();
}

// Eingaben der Seiten
for (const i of [0, 1] as const) {
  const el = app.querySelector<HTMLElement>(`.side[data-side="${i}"]`)!;
  el.addEventListener('change', (ev) => {
    const t = ev.target as HTMLInputElement | HTMLSelectElement;
    const s = state.sides[i];
    const slot = t.closest<HTMLElement>('[data-slot]')?.dataset.slot as 'front' | 'back' | undefined;
    if (slot && t.dataset.f) {
      const x = s[slot];
      if (t.dataset.f === 'name') {
        x.name = t.value;
        x.count = null;
      } else if (t.dataset.f === 'stars') x.stars = Number(t.value);
      else if (t.dataset.f === 'count') x.count = t.value ? Math.max(1, Number(t.value)) : null;
    }
    if (t.dataset.s === 'race' || t.dataset.s === 'cls') s[t.dataset.s] = t.value as Tri;
    if (t.dataset.s === 'power') s.power = Math.max(0.1, Number(t.value) || 1);
    if (t.dataset.s === 'castle') s.castle = Math.max(10, Number(t.value) || 100);
    const row = t.closest<HTMLElement>('.ench');
    if (row && t.dataset.e) {
      const k = Number(row.dataset.k);
      const cur = s.enchants[k]!;
      if (t.dataset.e === 'type') {
        const [kind, v] = t.value.split(':') as [string, string];
        s.enchants[k] = kind === 'g' ? { greed: v } : { maker: Number(v), rarity: 'rare', race: 'ashclan', cls: 'Infantry' };
      } else if (!('greed' in cur)) {
        if (t.dataset.e === 'rarity') cur.rarity = t.value as Exclude<Rarity, 'greed'>;
        if (t.dataset.e === 'race') cur.race = t.value as RaceId;
        if (t.dataset.e === 'cls') cur.cls = t.value as CardClass;
      }
    }
    renderSide(i);
    save();
  });
  el.addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement;
    const s = state.sides[i];
    if (t.dataset.s === 'addEnchant') s.enchants.push({ maker: 3, rarity: 'rare', race: 'ashclan', cls: 'Infantry' });
    else if (t.dataset.e === 'del') s.enchants.splice(Number(t.closest<HTMLElement>('.ench')!.dataset.k), 1);
    else return;
    renderSide(i);
    save();
  });
}

app.querySelector('.global')!.addEventListener('change', (ev) => {
  const t = ev.target as HTMLInputElement;
  if (t.dataset.g === 'world') state.world = t.value as RaceId;
  if (t.dataset.g === 'boss') state.boss = t.value as RaceId | '';
  if (t.dataset.g === 'bossPower') state.bossPower = Math.max(0.2, Number(t.value) || 1);
  save();
});

app.querySelector('[data-act="swap"]')!.addEventListener('click', () => {
  state.sides = [state.sides[1], state.sides[0]];
  const c = state.sides[0].castle;
  state.sides[0].castle = state.sides[1].castle;
  state.sides[1].castle = c;
  renderAll();
});
app.querySelector('[data-act="reset"]')!.addEventListener('click', () => {
  state = initial();
  renderAll();
});

// --- Ansehen ---------------------------------------------------------------------------------

const pixi = new Application();
const arena = new Arena();
let view: ArenaView | null = null;
let speed = 1;
let watching = false;
let atlas: ReturnType<typeof buildGameAtlas> | null = null;
const live = app.querySelector<HTMLElement>('.live')!;
const nextBtn = app.querySelector<HTMLButtonElement>('[data-act="next"]')!;

async function initStage(): Promise<void> {
  await pixi.init({ width: 640, height: 360, background: '#000', antialias: false, resolution: 1, roundPixels: true, preference: 'webgl' });
  app.querySelector('.stage')!.appendChild(pixi.canvas);
  atlas = buildGameAtlas();
  let acc = 0;
  pixi.ticker.add(() => {
    if (!view) return;
    const dt = Math.min(0.1, pixi.ticker.deltaMS / 1000);
    const slow = view.timeScale(dt);
    if (watching) {
      acc += dt * speed * slow;
      let n = 0;
      while (acc >= DT && n < 12) {
        arena.step();
        acc -= DT;
        n++;
      }
      if (n === 12) acc = 0;
    }
    view.update(watching ? dt * speed * slow : dt);
    live.textContent = `${arena.state} · ${arena.time.toFixed(1)} s · Einheiten ${arena.counts[0]} : ${arena.counts[1]} · Burg ${Math.ceil(arena.baseHp[0]!)} : ${Math.ceil(arena.baseHp[1]!)}${arena.boss ? ` · Boss ${Math.ceil(arena.bossHp)}` : ''}`;
    if (watching && arena.state === 'over') {
      watching = false;
      nextBtn.disabled = arena.outcome !== 'next';
      live.textContent += ` · ${arena.outcome === 'win' ? 'links gewinnt den Kampf' : arena.outcome === 'lose' ? 'rechts gewinnt den Kampf' : 'Runde vorbei'}`;
    }
  });
}

function deployAndWatch(fresh: boolean): void {
  if (!atlas) return;
  if (fresh) arena.startBattle(state.sides[0].castle, state.sides[1].castle, bossOf(), Math.floor(Math.random() * 1e9), state.bossPower);
  arena.deployRound([specOf(state.sides[0], 0), specOf(state.sides[1], 1)]);
  if (view) pixi.stage.removeChildren();
  const theme = WORLD_THEMES.find((t) => t.race === state.world) ?? WORLD_THEMES[0]!;
  view = new ArenaView(pixi, atlas, arena, theme);
  pixi.stage.addChild(view.root);
  view.playSpawnIntro();
  nextBtn.disabled = true;
  watching = false;
  setTimeout(() => {
    view?.skipIntro();
    arena.begin();
    watching = true;
  }, 900);
}

app.querySelector('[data-act="watch"]')!.addEventListener('click', () => deployAndWatch(true));
nextBtn.addEventListener('click', () => deployAndWatch(false));
app.querySelectorAll<HTMLElement>('[data-sp]').forEach((b) =>
  b.addEventListener('click', () => {
    speed = Number(b.dataset.sp);
    app.querySelectorAll('[data-sp]').forEach((x) => x.classList.toggle('on', x === b));
  }),
);

// --- Durchrechnen --------------------------------------------------------------------------------

const bar = app.querySelector<HTMLElement>('.progress i')!;
const result = app.querySelector<HTMLElement>('.result')!;
let busy = false;

/** Rechnet `n` Aufgaben in Häppchen, damit die Seite bedienbar bleibt. */
async function chunked(n: number, work: (k: number) => void): Promise<void> {
  let k = 0;
  while (k < n) {
    const t0 = performance.now();
    while (k < n && performance.now() - t0 < 60) work(k++);
    bar.style.width = `${(k / n) * 100}%`;
    await new Promise((r) => setTimeout(r, 0));
  }
}

const pct = (x: number) => `${(x * 100).toFixed(0)} %`;
const ci = (p: number, n: number) => `± ${(196 * Math.sqrt((p * (1 - p)) / n)).toFixed(0)} %`;

app.querySelector('[data-act="rounds"]')!.addEventListener('click', async () => {
  if (busy) return;
  busy = true;
  const n = Math.max(10, Number(app.querySelector<HTMLInputElement>('.n')!.value) || 200);
  let win = 0;
  let dmgA = 0;
  let dmgB = 0;
  let time = 0;
  let killsA = 0;
  let killsB = 0;
  const a = sharedArena();
  await chunked(n, () => {
    a.startBattle(1e6, 1e6, bossOf(), Math.floor(Math.random() * 1e9), state.bossPower);
    a.deployRound([specOf(state.sides[0], 0), specOf(state.sides[1], 1)]);
    const r = runRound(a);
    win += r.winner === 0 ? 1 : r.winner === -1 ? 0.5 : 0;
    dmgA += r.castleDmg[0];
    dmgB += r.castleDmg[1];
    time += r.time;
    killsA += r.kills[0];
    killsB += r.kills[1];
  });
  const p = win / n;
  result.innerHTML = `<table>
    <tr><th>Runden</th><td>${n}</td></tr>
    <tr><th>Links gewinnt</th><td><b>${pct(p)}</b> <small>${ci(p, n)}</small></td></tr>
    <tr><th>Burgschaden je Runde</th><td>${(dmgA / n).toFixed(1)} : ${(dmgB / n).toFixed(1)}</td></tr>
    <tr><th>Kills je Runde</th><td>${(killsA / n).toFixed(0)} : ${(killsB / n).toFixed(0)}</td></tr>
    <tr><th>Rundendauer</th><td>${(time / n).toFixed(1)} s</td></tr>
  </table><p class="note">Sieger einer Runde = wer mehr Burgschaden macht. Ein ganzes Heer an der Burg = 100 Schaden.</p>`;
  busy = false;
});

app.querySelector('[data-act="battles"]')!.addEventListener('click', async () => {
  if (busy) return;
  busy = true;
  const n = Math.max(10, Math.round((Number(app.querySelector<HTMLInputElement>('.n')!.value) || 200) / 4));
  let win = 0;
  let rounds = 0;
  let time = 0;
  let left = 0;
  const a = sharedArena();
  await chunked(n, () => {
    a.startBattle(state.sides[0].castle, state.sides[1].castle, bossOf(), Math.floor(Math.random() * 1e9), state.bossPower);
    let r = 0;
    while (r < 15) {
      r++;
      a.deployRound([specOf(state.sides[0], 0), specOf(state.sides[1], 1)]);
      time += runRound(a).time;
      if (a.outcome !== 'next') break;
    }
    rounds += r;
    if (a.outcome === 'win') win++;
    left += a.baseHp[0]! / a.baseMax[0]!;
  });
  const p = win / n;
  result.innerHTML = `<table>
    <tr><th>Kämpfe</th><td>${n}</td></tr>
    <tr><th>Links gewinnt</th><td><b>${pct(p)}</b> <small>${ci(p, n)}</small></td></tr>
    <tr><th>Runden je Kampf</th><td>${(rounds / n).toFixed(1)}</td></tr>
    <tr><th>Kampfdauer</th><td>${(time / n / 60).toFixed(1)} min (ohne Kartenwahl)</td></tr>
    <tr><th>Eigene Burg übrig</th><td>${pct(left / n)}</td></tr>
  </table><p class="note">Jede Runde mit denselben Karten; Truppen werden neu gewürfelt, falls leer.</p>`;
  busy = false;
});

renderAll();
void initStage();

import '@fontsource/vt323/400.css';
import '@fontsource/silkscreen/400.css';
import '@fontsource/silkscreen/700.css';
import '@fontsource/press-start-2p/400.css';
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';
import '@fontsource/jersey-10/400.css';
import '@fontsource/tiny5/400.css';
import './lab.css';
import './themes.css';
import './palette-themes.css';
import './palette-themes-2.css';
import './screens.css';
import './favorites.css';
import './idle.css';
import './buttons.css';

import { fxUrl, PALETTE_THEMES, sceneUrl, uiRamp, type PaletteTheme } from './palettes';
import { MORE_PALETTE_THEMES } from './palettes-more';
import { blockText, buildSprites, icon, installTextures, spriteInPalette, spriteSize, type IconName, type Sprites } from './pixels';

interface Theme {
  id: string;
  name: string;
  desc: string;
  /** Welches Kartenbild die Karte nutzt */
  sprite: keyof Omit<Sprites, 'w' | 'h'>;
  /** Nur bei Paletten-Designs: die Farben + Szene */
  palette?: PaletteTheme;
}

const THEMES: Theme[] = [
  { id: 'tavern', name: 'Tavern', desc: 'Holz und Pergament: klassisches Fantasy-RPG, warm und handgemacht.', sprite: 'normal' },
  { id: 'keep', name: 'Iron Keep', desc: 'Dunkler Stein, Eisennieten und Blutrot: düster und ernst.', sprite: 'normal' },
  { id: 'quest', name: 'Quest Window', desc: 'Blaue JRPG-Fenster mit Handcursor: Retro-Konsolen-Look wie auf dem SNES.', sprite: 'normal' },
  { id: 'neon', name: 'Neon Grid', desc: 'Synthwave: Neonlinien, Pixelsonne und chromatische Verschiebung im Logo.', sprite: 'normal' },
  { id: 'pocket', name: 'Pocket', desc: 'Nur 4 Grüntöne wie auf dem Game Boy: extrem reduziert.', sprite: 'gameboy' },
  { id: 'glass', name: 'Chromatic Glass', desc: 'Buntglas in den Rassenfarben, Knöpfe als geschliffene Edelsteine.', sprite: 'normal' },
  { id: 'cozy', name: 'Cozy', desc: 'Hell und verspielt: dicke 3D-Knöpfe, Himmel und Wolken.', sprite: 'normal' },
  { id: 'terminal', name: 'Terminal', desc: 'Bernstein-Monitor mit Scanlines: alles als Text.', sprite: 'amber' },
  ...[...PALETTE_THEMES, ...MORE_PALETTE_THEMES].map((p): Theme => ({ id: p.id, name: p.name, desc: p.desc, sprite: 'normal', palette: p })),
];

/** Die ausgebauten Lieblings-Designs: nur sie haben Deck-, Shop- und Kampfbildschirm. */
const FAVORITES = ['ridge', 'lantern', 'orbit', 'candle', 'idle'];

type ScreenKind = 'menu' | 'deck' | 'shop' | 'battle';
const SCREENS: { id: ScreenKind; name: string }[] = [
  { id: 'menu', name: 'Hauptmenü' },
  { id: 'deck', name: 'Deck' },
  { id: 'shop', name: 'Shop' },
  { id: 'battle', name: 'Kampf' },
];

const SCREEN_W = 640;
const SCREEN_H = 360;

const sprites = buildSprites();
installTextures(document.documentElement);

// --- Beispielkarten ----------------------------------------------------------------

interface DemoCard {
  name: string;
  race: string;
  cls: string;
  icon: IconName;
  troops: number;
  dmg: number;
  hp: number;
  text: string;
  /** Sprite aus dem ersten Prototyp */
  sprite: string;
  stars: number;
}

const DECK: DemoCard[] = [
  { name: 'Boar Riders', race: 'Ashclan', cls: 'Cavalry', icon: 'horse', troops: 60, dmg: 18, hp: 26, text: 'Charge: First hit deals triple damage and knocks the target back.', sprite: 'warhorse', stars: 2 },
  { name: 'Ash Brute', race: 'Ashclan', cls: 'Infantry', icon: 'shield', troops: 150, dmg: 14, hp: 20, text: 'Burning Blade: Hits set the target on fire for 2 s.', sprite: 'berserker', stars: 1 },
  { name: 'Thorn Archers', race: 'Wildwood', cls: 'Archers', icon: 'bow', troops: 120, dmg: 9, hp: 12, text: 'Thorned arrows slow the target by 25 % for 2 s.', sprite: 'ranger', stars: 1 },
  { name: 'Storm Caller', race: 'Wildwood', cls: 'Mage', icon: 'staff', troops: 12, dmg: 22, hp: 14, text: 'Chain Lightning: jumps between up to 5 enemies.', sprite: 'forest-sage', stars: 3 },
  { name: 'Moon Singer', race: 'Wildwood', cls: 'Priest', icon: 'cross', troops: 15, dmg: 4, hp: 16, text: 'Every 4 s, a wave of moonlight heals all allies in a large area.', sprite: 'nature-healer', stars: 1 },
  { name: 'Ironbeards', race: 'Deepforge', cls: 'Infantry', icon: 'shield', troops: 100, dmg: 12, hp: 11, text: 'Armor 3: Every hit taken deals 3 less damage.', sprite: 'stonebreaker', stars: 1 },
  { name: 'Bone Archers', race: 'Plague Court', cls: 'Archers', icon: 'bow', troops: 100, dmg: 7, hp: 10, text: 'Poisoned arrows: 2 damage per second for 4 s, stacks.', sprite: 'gravewarden', stars: 2 },
  { name: 'Blight Witch', race: 'Plague Court', cls: 'Mage', icon: 'staff', troops: 12, dmg: 14, hp: 12, text: 'Throws a plague cloud that lingers and poisons everything inside.', sprite: 'necromancer', stars: 1 },
];

const SHOP: DemoCard[] = [
  { name: 'Mercenary Co.', race: 'Drifters', cls: 'Infantry', icon: 'shield', troops: 150, dmg: 12, hp: 18, text: 'Paid in Advance: Earn gold after each battle for surviving troops.', sprite: 'mercenary', stars: 1 },
  { name: 'Trebuchet', race: 'Sun Legion', cls: 'Siege', icon: 'tower', troops: 2, dmg: 60, hp: 80, text: 'Huge range and blast radius, but very slow to reload.', sprite: 'stone-fortress', stars: 1 },
  { name: 'Wolf Pack', race: 'Wildwood', cls: 'Beast', icon: 'horse', troops: 60, dmg: 12, hp: 18, text: 'Pack Hunter: +10 % damage for each wolf nearby.', sprite: 'stone-wolf', stars: 1 },
];

const ENEMY: DemoCard[] = [
  { name: 'Bone Archers', race: 'Plague Court', cls: 'Archers', icon: 'bow', troops: 100, dmg: 7, hp: 10, text: '', sprite: 'gravewarden', stars: 2 },
  { name: 'Blight Witch', race: 'Plague Court', cls: 'Mage', icon: 'staff', troops: 12, dmg: 14, hp: 12, text: '', sprite: 'necromancer', stars: 1 },
];

// --- Bausteine ------------------------------------------------------------------------

function logoLetters(text: string): string {
  return [...text].map((ch) => `<span class="l">${ch}</span>`).join('');
}

/** Liefert das Kartenbild einer Einheit im Stil des Designs. */
function spriteFor(t: Theme, spriteId: string, team: 0 | 1 = 0): string {
  const p = t.palette;
  if (!p) return spriteId === 'warhorse' && team === 0 ? sprites[t.sprite] : spriteInPalette([], 'normal', spriteId, team);
  const mode = p.sprite ?? 'ramp';
  return spriteInPalette(mode === 'ramp' ? uiRamp(p) : p.colors, mode, spriteId, team);
}

function unitImg(src: string, spriteId: string, x: number, y: number, s: number, cls = ''): string {
  const [w, h] = spriteSize(spriteId);
  return `<img class="unit ${cls}" src="${src}" style="--x:${x}px;--y:${y}px;width:${w * s}px;height:${h * s}px" alt="">`;
}

function starsHtml(n: number, max = 3): string {
  let out = '';
  for (let i = 0; i < max; i++) out += icon('star', i < n ? '' : 'empty');
  return `<span class="card-stars">${out}</span>`;
}

function cardHtml(t: Theme, c: DemoCard, opts: { mini?: boolean; team?: 0 | 1; extra?: string; index?: number } = {}): string {
  const src = spriteFor(t, c.sprite, opts.team ?? 0);
  const art = opts.mini
    ? unitImg(src, c.sprite, 22, 8, 2)
    : unitImg(src, c.sprite, 14, 6, 2, 'back') + unitImg(src, c.sprite, 58, 8, 2, 'back') + unitImg(src, c.sprite, 30, 14, 3);
  return `
    <article class="card${opts.mini ? ' mini' : ''}${opts.extra ? ` ${opts.extra}` : ''}"${opts.index !== undefined ? ` data-card="${opts.index}"` : ''}>
      <div class="card-top">
        <span class="card-class">${icon(c.icon)}</span>
        <span class="card-name">${c.name}</span>
        <span class="card-troops">×${c.troops}</span>
      </div>
      <div class="card-art">${art}</div>
      ${opts.mini ? starsHtml(c.stars) : `<div class="card-type">${c.race} · ${c.cls}</div>`}
      ${opts.mini ? '' : `<p class="card-text">${c.text}</p>`}
      <div class="card-stats">
        <span class="stat dmg">${icon('sword')}<b>${c.dmg}</b></span>
        <span class="stat hp">${icon('heart')}<b>${c.hp}</b></span>
      </div>
    </article>`;
}

const topbar = () => `
    <header class="topbar">
      <div class="stat-chip lives">${icon('heart')}${icon('heart')}${icon('heart', 'empty')}</div>
      <div class="stat-chip gold">${icon('coin')}<span class="num-plain">120</span><span class="num-big">1.24M</span><small class="rate">+3.5K/s</small></div>
      <div class="stat-chip gems">${icon('star')}<span>48</span></div>
      <div class="stat-chip world"><span>World 2</span>${icon('star')}${icon('star')}${icon('star', 'empty')}</div>
      <div class="spacer"></div>
      <div class="segmented" role="group">
        <button class="seg active">1×</button><button class="seg">2×</button><button class="seg">4×</button>
      </div>
    </header>`;

// --- Bildschirme ------------------------------------------------------------------------

function menuBody(t: Theme): string {
  return `
    ${topbar()}
    <div class="logo">
      <div class="logo-line"><span class="logo-main">${logoLetters('CHROMATIC')}</span><span class="logo-num">2</span></div>
      <pre class="logo-ascii">${blockText('CHROMATIC 2')}</pre>
      <div class="logo-sub">Roguelite Mass Battles</div>
    </div>

    <nav class="menu">
      <button class="btn primary" data-act="run">${icon('play')}<span>New Run</span></button>
      <button class="btn" disabled>${icon('play')}<span>Continue</span></button>
      <button class="btn" data-act="goto" data-to="deck">${icon('cards')}<span>Deck</span><i class="badge">3</i></button>
      <button class="btn">${icon('gear')}<span>Settings</span></button>
      <button class="btn danger" data-act="quit">${icon('door')}<span>Quit</span></button>
    </nav>

    <section class="doors-panel panel">
      <div class="panel-title">Choose a Door</div>
      <div class="doors">
        <button class="door selected">${icon('swords')}<span class="door-name">Battle</span><span class="door-stars">${icon('star')}${icon('star')}</span></button>
        <button class="door" data-act="goto" data-to="shop">${icon('bag')}<span class="door-name">Shop</span><span class="door-stars">${icon('star')}</span></button>
        <button class="door">${icon('chest')}<span class="door-name">Treasure</span><span class="door-stars">${icon('star')}${icon('star')}${icon('star')}</span></button>
      </div>
    </section>

    ${cardHtml(t, DECK[0]!)}

    <footer class="foot"><span class="blink">Press Enter</span><span class="ver">v0.0.1</span></footer>
    ${tabbar('menu')}`;
}

/** Tab-Leiste unten (nur im Idle-Design sichtbar). */
function tabbar(active: ScreenKind): string {
  const tab = (id: ScreenKind, ic: IconName, label: string, badge = '') =>
    `<button class="tab${id === active ? ' active' : ''}" data-act="goto" data-to="${id}">${icon(ic)}<span>${label}</span>${badge ? `<i class="badge">${badge}</i>` : ''}</button>`;
  return `<nav class="tabbar">
      ${tab('menu', 'play', 'Run')}
      ${tab('deck', 'cards', 'Deck', '3')}
      ${tab('shop', 'bag', 'Shop', '!')}
      ${tab('battle', 'swords', 'Battle')}
      <button class="tab">${icon('crown')}<span>Prestige</span></button>
    </nav>`;
}

function deckBody(t: Theme): string {
  return `
    ${topbar()}
    <header class="page-head">
      <h2 class="page-title">${icon('cards')}<span>Your Deck</span><em>${DECK.length} cards</em></h2>
      <div class="segmented filter" role="group">
        <button class="seg active">All</button><button class="seg">Ashclan</button><button class="seg">Wildwood</button><button class="seg">Plague</button>
      </div>
    </header>
    <section class="deck-panel panel">
      <div class="deck-grid">
        ${DECK.map((c, i) => cardHtml(t, c, { mini: true, index: i, extra: i === 0 ? 'selected' : '' })).join('')}
      </div>
      <div class="scroll"><i></i></div>
    </section>
    <aside class="detail">
      <div class="detail-card">${cardHtml(t, DECK[0]!)}</div>
      <div class="detail-actions">
        <button class="btn primary" data-act="toast" data-msg="Upgraded!">${icon('star')}<span>Upgrade</span><span class="price">${icon('coin')}80</span></button>
        <button class="btn" disabled>${icon('lock')}<span>Burn</span></button>
        <button class="btn" data-act="goto" data-to="menu">${icon('door')}<span>Back</span></button>
      </div>
    </aside>
    <footer class="foot"><span>Pair two cards of the same race or class for a bonus.</span><span class="ver">v0.0.1</span></footer>
    ${tabbar('deck')}`;
}

function shopBody(t: Theme): string {
  const offers = SHOP.map((c, i) => {
    const sold = i === 1;
    return `
      <div class="offer${sold ? ' sold' : ''}">
        ${i === 0 ? '<span class="ribbon">Best Deal</span>' : ''}
        ${cardHtml(t, c)}
        <button class="btn ${sold ? '' : 'primary'} buy" ${sold ? 'disabled' : 'data-act="buy"'}>${sold ? `${icon('lock')}<span>Sold</span>` : `${icon('coin')}<span>${[95, 140, 70][i]}</span>`}</button>
      </div>`;
  }).join('');
  const upgrades = DECK.slice(0, 4)
    .map(
      (c) => `
      <div class="up-row">
        <img class="up-icon" src="${spriteFor(t, c.sprite)}" alt="">
        <span class="up-name">${c.name}</span>
        ${starsHtml(c.stars)}
        <button class="btn up-btn" ${c.stars >= 3 ? 'disabled' : 'data-act="toast" data-msg="Upgraded!"'}>${c.stars >= 3 ? 'MAX' : `+${icon('star')}${[60, 40, 40, 0][DECK.indexOf(c)]}`}</button>
      </div>`,
    )
    .join('');
  return `
    ${topbar()}
    <header class="page-head">
      <h2 class="page-title">${icon('bag')}<span>Wandering Merchant</span><em>World 2 · Room 5</em></h2>
    </header>
    <section class="offers panel">
      <div class="panel-title">For Sale</div>
      <div class="offer-row">${offers}</div>
    </section>
    <aside class="upgrades panel">
      <div class="panel-title">Upgrade Cards</div>
      <div class="up-list">${upgrades}</div>
      <div class="shop-actions">
        <button class="btn" data-act="toast" data-msg="New offers!">${icon('refresh')}<span>Reroll</span><span class="price">${icon('coin')}20</span></button>
        <button class="btn danger" data-act="goto" data-to="menu">${icon('door')}<span>Leave</span></button>
      </div>
    </aside>
    <footer class="foot"><span>Buy new cards or upgrade the ones you have.</span><span class="ver">v0.0.1</span></footer>
    ${tabbar('shop')}`;
}

function battleBody(t: Theme): string {
  // Kleine Armeen aufs Feld stellen
  let field = '';
  let seed = 3;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const army = (team: 0 | 1, ids: string[], x0: number, x1: number) => {
    for (let i = 0; i < 34; i++) {
      const id = ids[i % ids.length]!;
      const x = x0 + rnd() * (x1 - x0);
      const y = 132 + rnd() * 128;
      const [w, h] = spriteSize(id);
      field += `<img class="f-unit" src="${spriteFor(t, id, team)}" style="left:${Math.round(x)}px;top:${Math.round(y)}px;width:${w}px;height:${h}px;z-index:${Math.round(y)}" alt="">`;
    }
  };
  army(0, ['warhorse', 'forest-sage', 'warhorse'], 150, 290);
  army(1, ['gravewarden', 'necromancer', 'gravewarden'], 350, 490);
  return `
    <div class="field">${field}</div>
    <header class="hud">
      <div class="army you">
        <div class="army-head"><span>Your Army</span><b>342</b></div>
        <div class="bar"><i style="width:76%"></i></div>
      </div>
      <div class="hud-mid">
        <div class="timer">1:24</div>
        <div class="dps">+1.2K DPS</div>
        <div class="hud-sub">Battle · ${icon('star')}${icon('star')}</div>
      </div>
      <div class="army foe">
        <div class="army-head"><b>268</b><span>Plague Court</span></div>
        <div class="bar"><i style="width:58%"></i></div>
      </div>
    </header>
    <div class="bonus-badge">${icon('star')}<span>Bonus: none — try same race or class</span></div>
    <footer class="dock">
      <div class="slots you">
        <div class="slot"><span class="slot-label">Front</span>${cardHtml(t, DECK[0]!, { mini: true })}</div>
        <div class="slot"><span class="slot-label">Back</span>${cardHtml(t, DECK[3]!, { mini: true })}</div>
      </div>
      <div class="controls panel">
        <button class="btn primary fight" data-act="fight">${icon('swords')}<span>Fight!</span></button>
        <div class="control-row">
          <button class="btn small">Pause</button>
          <div class="segmented" role="group"><button class="seg active">1×</button><button class="seg">2×</button><button class="seg">4×</button></div>
        </div>
      </div>
      <div class="slots foe">
        <div class="slot"><span class="slot-label">Front</span>${cardHtml(t, ENEMY[0]!, { mini: true, team: 1 })}</div>
        <div class="slot"><span class="slot-label">Back</span>${cardHtml(t, ENEMY[1]!, { mini: true, team: 1 })}</div>
      </div>
    </footer>`;
}

function screenHtml(t: Theme, kind: ScreenKind): string {
  const p = t.palette;
  let vars = '';
  let fx = '';
  if (p) {
    vars = [
      ...uiRamp(p).map((c, i) => `--c${i}:${c}`),
      ...Object.entries(p.accents ?? {}).map(([k, c]) => `--a-${k}:${c}`),
      `--scene:url(${sceneUrl(p)})`,
    ].join(';');
    const fxu = fxUrl(p);
    if (fxu && p.fx) {
      vars += `;--fx:url(${fxu});--fx-n:${p.fx.frames};--fx-dur:${p.fx.duration}s`;
      fx = '<div class="fx"></div>';
    }
  }
  const body = kind === 'deck' ? deckBody(t) : kind === 'shop' ? shopBody(t) : kind === 'battle' ? battleBody(t) : menuBody(t);
  return `
  <div class="screen theme-${t.id}${p ? ' pal' : ''} s-${kind}" data-theme="${t.id}" style="${vars}">
    <div class="bg"></div>
    ${fx}
    ${body}
    <div class="toast"></div>
    <div class="dialog-wrap">
      <div class="dialog panel">
        <div class="panel-title">${icon('skull')}<span>Abandon Run?</span></div>
        <p>All progress in this run will be lost.</p>
        <div class="dialog-btns">
          <button class="btn danger" data-act="close">Abandon</button>
          <button class="btn" data-act="close">Stay</button>
        </div>
      </div>
    </div>
  </div>`;
}

// --- Lab-Steuerung ---------------------------------------------------------------

const view = document.getElementById('lab-view')!;
const tabs = document.getElementById('lab-tabs')!;
const gridBtn = document.getElementById('lab-grid')!;
const favBtn = document.getElementById('lab-fav')!;
const screenTabs = document.getElementById('lab-screens')!;
const nameEl = document.getElementById('lab-name')!;
const descEl = document.getElementById('lab-desc')!;
const swatchEl = document.getElementById('lab-swatches')!;

const params = new URLSearchParams(location.hash.slice(1));
let favOnly = params.get('fav') !== '0';
let gridMode = params.has('all');
let screenKind: ScreenKind = (SCREENS.find((s) => s.id === params.get('screen'))?.id ?? 'menu') as ScreenKind;
const fromHash = THEMES.findIndex((t) => t.id === params.get('theme'));
let current = fromHash >= 0 ? fromHash : THEMES.findIndex((t) => t.id === (localStorage.getItem('c2-ui-lab-theme') ?? 'ridge'));
if (current < 0) current = 0;

const visible = () => (favOnly ? THEMES.filter((t) => FAVORITES.includes(t.id)) : THEMES);
const isFav = (t: Theme) => FAVORITES.includes(t.id);

function fitScale(availW: number, availH: number): number {
  const s = Math.min(availW / SCREEN_W, availH / SCREEN_H);
  // Ab 2× ganzzahlig, dann bleiben alle Pixel gleich groß.
  return s >= 2 ? Math.floor(s) : s;
}

function frame(t: Theme, scale: number, kind: ScreenKind): string {
  return `<div class="frame" style="width:${SCREEN_W * scale}px;height:${SCREEN_H * scale}px">
      <div class="scaler" style="transform:scale(${scale})">${screenHtml(t, kind)}</div>
    </div>`;
}

function renderTabs(): void {
  tabs.innerHTML = visible()
    .map((t) => {
      const i = THEMES.indexOf(t);
      return `<button class="lab-btn lab-tab${!gridMode && i === current ? ' active' : ''}" data-i="${i}"><span class="num">${i + 1}</span>${t.name}</button>`;
    })
    .join('');
  const t = THEMES[current]!;
  const showScreens = gridMode ? favOnly : isFav(t);
  screenTabs.innerHTML = showScreens
    ? SCREENS.map((s) => `<button class="lab-btn lab-screen${s.id === screenKind ? ' active' : ''}" data-s="${s.id}">${s.name}</button>`).join('')
    : '';
  favBtn.classList.toggle('active', favOnly);
  gridBtn.classList.toggle('active', gridMode);
}

function render(): void {
  renderTabs();
  const W = view.clientWidth - 16;
  const H = view.clientHeight - 16;
  if (gridMode) {
    const list = visible();
    const cols = favOnly ? 2 : W > 1000 ? 4 : 2;
    const rows = Math.ceil(list.length / cols);
    let scale = (W - 20 - (cols - 1) * 12) / cols / SCREEN_W;
    if (favOnly) scale = Math.min(scale, (H - rows * 24 - (rows - 1) * 12) / rows / SCREEN_H);
    nameEl.textContent = favOnly ? `Favoriten · ${SCREENS.find((s) => s.id === screenKind)!.name}` : `Alle ${THEMES.length} Designs`;
    swatchEl.innerHTML = '';
    descEl.textContent = 'Klicke auf ein Design, um es groß anzusehen.';
    view.className = 'grid';
    view.style.setProperty('--cols', String(cols));
    view.innerHTML = list
      .map((t) => {
        const i = THEMES.indexOf(t);
        const kind = favOnly ? screenKind : 'menu';
        return `<div class="thumb" data-i="${i}"><div class="thumb-label"><span class="num">${i + 1}</span>${t.name}</div>${frame(t, scale, kind)}</div>`;
      })
      .join('');
  } else {
    const t = THEMES[current]!;
    const kind = isFav(t) ? screenKind : 'menu';
    nameEl.textContent = `${current + 1} · ${t.name}`;
    descEl.textContent = t.desc;
    swatchEl.innerHTML = (t.palette?.colors ?? []).map((c) => `<i style="background:${c}" title="${c}"></i>`).join('');
    view.className = 'single';
    view.innerHTML = frame(t, fitScale(W, H), kind);
    localStorage.setItem('c2-ui-lab-theme', t.id);
  }
  const hash = new URLSearchParams();
  hash.set('theme', THEMES[current]!.id);
  hash.set('screen', screenKind);
  if (!favOnly) hash.set('fav', '0');
  if (gridMode) hash.set('all', '1');
  history.replaceState(null, '', `#${hash}`);
}

function show(i: number): void {
  current = i;
  gridMode = false;
  render();
}

/** Nächstes/voriges Design innerhalb der sichtbaren Liste. */
function step(d: number): void {
  const list = visible();
  const pos = list.indexOf(THEMES[current]!);
  const next = list[(pos + d + list.length) % list.length]!;
  show(THEMES.indexOf(next));
}

function setScreen(kind: ScreenKind): void {
  screenKind = kind;
  render();
}

tabs.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('.lab-tab');
  if (b) show(Number(b.dataset.i));
});
screenTabs.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('.lab-screen');
  if (b) setScreen(b.dataset.s as ScreenKind);
});
gridBtn.addEventListener('click', () => {
  gridMode = !gridMode;
  render();
});
favBtn.addEventListener('click', () => {
  favOnly = !favOnly;
  if (favOnly && !isFav(THEMES[current]!)) current = THEMES.findIndex((t) => t.id === FAVORITES[0]);
  render();
});

let toastTimer = 0;
function toast(screen: HTMLElement, msg: string): void {
  const el = screen.querySelector<HTMLElement>('.toast')!;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('show'), 1400);
}

view.addEventListener('click', (e) => {
  const el = e.target as HTMLElement;
  if (gridMode) {
    const th = el.closest<HTMLElement>('.thumb');
    if (th) show(Number(th.dataset.i));
    return;
  }
  const screen = el.closest<HTMLElement>('.screen');
  if (!screen) return;
  const theme = THEMES.find((t) => t.id === screen.dataset.theme)!;
  const actEl = el.closest<HTMLElement>('[data-act]');
  const act = actEl?.dataset.act;
  if (act === 'goto' && isFav(theme)) {
    setScreen(actEl!.dataset.to as ScreenKind);
    return;
  }
  const door = el.closest('.door');
  if (door) {
    screen.querySelectorAll('.door').forEach((d) => d.classList.toggle('selected', d === door));
    return;
  }
  const seg = el.closest('.seg');
  if (seg) {
    seg.parentElement!.querySelectorAll('.seg').forEach((s) => s.classList.toggle('active', s === seg));
    return;
  }
  const mini = el.closest<HTMLElement>('.deck-grid .card');
  if (mini) {
    screen.querySelectorAll('.deck-grid .card').forEach((c) => c.classList.toggle('selected', c === mini));
    screen.querySelector('.detail-card')!.innerHTML = cardHtml(theme, DECK[Number(mini.dataset.card)]!);
    return;
  }
  if (act === 'quit') screen.querySelector('.dialog-wrap')!.classList.add('open');
  if (act === 'close') screen.querySelector('.dialog-wrap')!.classList.remove('open');
  if (act === 'run') {
    if (isFav(theme)) {
      toast(screen, 'Starting new run…');
      window.setTimeout(() => (location.href = `index.html?theme=${theme.id}`), 450);
    } else toast(screen, 'Starting new run…');
  }
  if (act === 'toast') toast(screen, actEl!.dataset.msg ?? '');
  if (act === 'buy') {
    const offer = actEl!.closest('.offer')!;
    offer.classList.add('sold');
    actEl!.outerHTML = `<button class="btn buy" disabled>${icon('lock')}<span>Sold</span></button>`;
    toast(screen, 'Added to your deck!');
  }
  if (act === 'fight') {
    screen.classList.toggle('fighting');
    actEl!.querySelector('span')!.textContent = screen.classList.contains('fighting') ? 'Retreat' : 'Fight!';
  }
});

// --- Klick-Effekte ----------------------------------------------------------------
// Jeder Klick auf ein Bedienelement spielt eine Drück-Animation (.clicked) und
// erzeugt an der Klickstelle Partikel (.cfx). Aussehen legt jedes Design in CSS fest.

const CLICKABLE = '.btn, .seg, .door, .tab, .deck-grid .card';

view.addEventListener('pointerdown', (e) => {
  if (gridMode) return;
  const target = (e.target as HTMLElement).closest<HTMLElement>(CLICKABLE);
  const screen = target?.closest<HTMLElement>('.screen');
  if (!target || !screen || (target as HTMLButtonElement).disabled) return;

  target.classList.remove('clicked');
  void target.offsetWidth; // Animation neu starten
  target.classList.add('clicked');
  window.setTimeout(() => target.classList.remove('clicked'), 450);

  const rect = screen.getBoundingClientRect();
  const scale = rect.width / SCREEN_W;
  const fx = document.createElement('i');
  fx.className = 'cfx';
  fx.style.left = `${Math.round((e.clientX - rect.left) / scale)}px`;
  fx.style.top = `${Math.round((e.clientY - rect.top) / scale)}px`;
  fx.innerHTML = '<b></b>'.repeat(10) + '<em>+1</em>';
  screen.appendChild(fx);
  window.setTimeout(() => fx.remove(), 900);
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') step(1);
  else if (e.key === 'ArrowLeft') step(-1);
  else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    const i = SCREENS.findIndex((s) => s.id === screenKind);
    setScreen(SCREENS[(i + (e.key === 'ArrowDown' ? 1 : -1) + SCREENS.length) % SCREENS.length]!.id);
  } else if (e.key === 'g' || e.key === 'G') {
    gridMode = !gridMode;
    render();
  } else if (e.key === 'f' || e.key === 'F') favBtn.click();
  else if (/^[1-9]$/.test(e.key)) show(Number(e.key) - 1);
  else if (e.key === 'Escape') document.querySelectorAll('.dialog-wrap.open').forEach((d) => d.classList.remove('open'));
});

window.addEventListener('resize', render);
document.fonts.ready.then(render);
render();

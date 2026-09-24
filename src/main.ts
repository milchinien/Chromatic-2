import '@fontsource/vt323/400.css';
import '@fontsource/silkscreen/400.css';
import '@fontsource/silkscreen/700.css';
import './style.css';
import './fonts.css';
import './game-themes.css';

import { Application, TextureSource } from 'pixi.js';
import { buildAtlas } from './art/atlas';
import { panelPattern } from './art/terrain';
import { cardById } from './data/cards';
import { BattleView } from './render/battleView';
import { Battle, DT, FIELD_H, FIELD_W, type SideSetup } from './sim/battle';
import { Ui } from './ui/ui';
import { applyThemeDom, applyThemeRenderer, readThemeId } from './game/theme';

TextureSource.defaultOptions.scaleMode = 'nearest';

const SPEEDS = [1, 2, 4];

async function boot(): Promise<void> {
  // Optionales UI-Design aus dem UI-Lab (index.html?theme=…)
  const themeId = readThemeId();
  if (themeId) applyThemeDom(themeId);

  const stage = document.getElementById('stage')!;
  const app = new Application();
  await app.init({ background: '#16261a', antialias: false, resolution: 1, autoDensity: false, roundPixels: true, preference: 'webgl' });
  stage.appendChild(app.canvas);

  document.documentElement.style.setProperty('--panel-pattern', `url(${panelPattern('#2a2136', 3)})`);

  const theme = themeId ? applyThemeRenderer(themeId, app) : null;

  const atlas = buildAtlas();
  const battle = new Battle(atlas.visOf);
  const view = new BattleView(app, atlas, battle);
  app.stage.addChild(view.world);

  const sides: [SideSetup, SideSetup] = [
    { card: cardById('berserker'), count: 300, level: 1 },
    { card: cardById('fire-mage'), count: 320, level: 1 },
  ];
  if (import.meta.env.DEV) Object.assign(window, { __c2: { battle, sides, setup: () => setupBattle() } });
  let seed = 1;
  let paused = false;
  let speed = 1;
  let resultShown = false;

  const setupBattle = () => {
    battle.setup(sides, seed);
    view.clearDecals();
    paused = false;
    resultShown = false;
    ui.setLocked(false);
  };

  const ui = new Ui(sides, {
    onSideChange: () => {
      if (battle.state === 'setup') setupBattle();
    },
    onFight: () => {
      if (battle.state !== 'setup') return;
      battle.start();
      ui.setLocked(true);
    },
    onPause: () => {
      if (battle.state === 'running') paused = !paused;
    },
    onSpeed: (s) => {
      if (SPEEDS.includes(s)) speed = s;
    },
    onReset: () => {
      seed++;
      setupBattle();
    },
  });

  // Zurück zum UI-Lab + Schlachtfeld-Palette an/aus
  if (theme) {
    const row = document.createElement('div');
    row.className = 'row theme-row';
    row.innerHTML = `<a class="btn btn-small" href="ui-lab.html#theme=${theme.id}&screen=menu">&lt; UI-Lab</a><button class="btn btn-small" id="btn-palette">Palette: an</button>`;
    document.querySelector('.hud-center')!.appendChild(row);
    const btn = document.getElementById('btn-palette')!;
    const toggle = () => (btn.textContent = `Palette: ${theme.togglePalette() ? 'an' : 'aus'}`);
    btn.addEventListener('click', toggle);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'p' || e.key === 'P') toggle();
    });
  }

  // --- Skalierung: ganzzahlig, damit die Pixel scharf bleiben ------------------
  const resize = () => {
    const dpr = window.devicePixelRatio || 1;
    const css = getComputedStyle(document.documentElement);
    const hud = parseFloat(css.getPropertyValue('--hud-h')) || 64;
    const dock = parseFloat(css.getPropertyValue('--dock-h')) || 150;
    const W = Math.floor(window.innerWidth * dpr);
    const H = Math.floor(window.innerHeight * dpr);
    const fitW = W / (FIELD_W + 64);
    const fitH = (H - (hud + dock) * dpr) / (FIELD_H + 24);
    const scale = Math.max(1, Math.floor(Math.min(fitW, fitH)));
    const vw = Math.ceil(W / scale);
    const vh = Math.ceil(H / scale);
    app.renderer.resize(vw, vh);
    app.canvas.style.width = `${(vw * scale) / dpr}px`;
    app.canvas.style.height = `${(vh * scale) / dpr}px`;
    view.layout(vw, vh, (hud * dpr) / scale, (dock * dpr) / scale);
    document.documentElement.style.setProperty('--p', `${Math.max(2, Math.round(scale / dpr))}px`);
  };
  window.addEventListener('resize', resize);
  resize();
  setupBattle();

  // --- Hauptschleife -----------------------------------------------------------
  let acc = 0;
  let fps = 60;
  app.ticker.add((ticker) => {
    const dt = Math.min(0.1, ticker.deltaMS / 1000);
    fps = fps * 0.95 + (1000 / Math.max(1, ticker.deltaMS)) * 0.05;
    const running = battle.state === 'running' && !paused;
    const simDt = running ? dt * speed : battle.state === 'setup' ? dt : 0;
    acc += simDt;
    let steps = 0;
    while (acc >= DT && steps < 12) {
      battle.step();
      acc -= DT;
      steps++;
    }
    if (steps === 12) acc = 0;
    view.update(running ? dt * speed : battle.state === 'done' ? dt : 0);
    ui.updateHud(battle, fps, paused);
    ui.setControls(battle.state, paused, speed);
    if (battle.state === 'done' && !resultShown) {
      resultShown = true;
      setTimeout(() => ui.showResult(battle), 700);
    }
  });
}

void boot();

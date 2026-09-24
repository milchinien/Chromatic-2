// =====================================================================
// UI-Designs aus dem UI-Lab im echten Kampfbildschirm.
// Aufruf: index.html?theme=ridge (bzw. lantern, orbit, candle, idle).
// Übernommen werden nur Farbpalette, Knopf-Design und Schrift:
//  - HTML-Oberfläche: CSS-Klasse gtheme-<id> + Palettenfarben als Variablen
//  - Schlachtfeld: Shader färbt alles auf die Palette um (Dithering),
//    die beiden Teamfarben bekommen eigene, gut unterscheidbare Farben
//  - Kartenbilder: gleiche Umfärbung im Canvas
// =====================================================================

import { Filter, GlProgram, UniformGroup, defaultFilterVert, type Application } from 'pixi.js';
import { setIconRemap } from '../art/atlas';
import { TEAM_COLORS } from '../art/sprites';
import { PALETTE_THEMES, uiRamp, type PaletteTheme } from '../lab/palettes';
import { MORE_PALETTE_THEMES } from '../lab/palettes-more';

interface GameTheme {
  /** Farbreihe für das Schlachtfeld (dunkel → hell); null = keine Umfärbung */
  ramp: string[] | null;
  /** Ersatz für Teamfarbe hell/dunkel: [Spieler, Spieler dunkel, Gegner, Gegner dunkel] */
  team: [string, string, string, string];
}

const GAME_THEMES: Record<string, GameTheme> = {
  ridge: { ramp: null, team: ['#ffe18f', '#ff9f74', '#7c183c', '#31112d'] },
  lantern: { ramp: null, team: ['#c7955c', '#914e3c', '#3a213a', '#100f13'] },
  orbit: { ramp: null, team: ['#fcbbab', '#b96889', '#583163', '#19112b'] },
  candle: {
    ramp: ['#000000', '#240142', '#290573', '#4a1cb8', '#7312fc', '#a065e3', '#cf84f0', '#e3b2fc'],
    team: ['#fdcd86', '#cf84f0', '#4a1cb8', '#240142'],
  },
  idle: { ramp: null, team: ['#3ec5ff', '#1c6aa8', '#ffcc33', '#b0700f'] },
};

const MAX_COLORS = 16;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

const hexRgb = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];

const FRAGMENT = /* glsl */ `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform float uPal[${MAX_COLORS * 3}];
uniform float uCount;
uniform float uTeam[24];
uniform float uOn;

// Bayer 4×4 ohne Tabelle (GLSL ES 1.0 kennt keine Array-Konstruktoren)
float bayer2(vec2 p) { return mod(2.0 * p.x + 3.0 * p.y, 4.0); }
float bayer(vec2 p) {
  vec2 a = mod(p, 2.0);
  vec2 b = mod(floor(p / 2.0), 2.0);
  return (4.0 * bayer2(a) + bayer2(b) + 0.5) / 16.0;
}

void main() {
  vec4 c = texture(uTexture, vTextureCoord);
  if (uOn < 0.5 || c.a <= 0.0) { finalColor = c; return; }
  vec3 rgb = c.rgb / c.a;

  // Teamfarben erhalten eigene Palettenfarben
  for (int i = 0; i < 4; i++) {
    vec3 src = vec3(uTeam[i * 6], uTeam[i * 6 + 1], uTeam[i * 6 + 2]);
    if (distance(rgb, src) < 0.07) {
      finalColor = vec4(vec3(uTeam[i * 6 + 3], uTeam[i * 6 + 4], uTeam[i * 6 + 5]) * c.a, c.a);
      return;
    }
  }

  // Helligkeit → Palettenstufe, mit geordnetem Dithering
  float l = dot(rgb, vec3(0.3, 0.59, 0.11));
  l = clamp((l - 0.06) / 0.86, 0.0, 1.0);
  float n = uCount - 1.0;
  float v = clamp(l * n + (bayer(floor(gl_FragCoord.xy)) - 0.5) * 0.85, 0.0, n);
  float idx = floor(v + 0.5);
  vec3 o = vec3(uPal[0], uPal[1], uPal[2]);
  for (int i = 0; i < ${MAX_COLORS}; i++) {
    if (float(i) == idx) o = vec3(uPal[i * 3], uPal[i * 3 + 1], uPal[i * 3 + 2]);
  }
  finalColor = vec4(o * c.a, c.a);
}
`;

export interface ActiveTheme {
  id: string;
  /** Schlachtfeld-Umfärbung an/aus */
  togglePalette(): boolean;
}

function findPaletteTheme(id: string): PaletteTheme | undefined {
  return [...PALETTE_THEMES, ...MORE_PALETTE_THEMES].find((t) => t.id === id);
}

/** Liest ?theme=… und richtet das Design ein. Gibt null zurück, wenn kein Design gewählt ist. */
export function readThemeId(): string | null {
  const id = new URLSearchParams(location.search).get('theme');
  return id && GAME_THEMES[id] && findPaletteTheme(id) ? id : null;
}

/** Setzt Klassen, CSS-Variablen und Kartenbild-Umfärbung (vor dem Aufbau der Oberfläche aufrufen). */
export function applyThemeDom(id: string): void {
  const p = findPaletteTheme(id)!;
  const gt = GAME_THEMES[id]!;
  const root = document.documentElement;
  document.body.classList.add('gtheme', `gtheme-${id}`);
  // Die Pixelschrift braucht etwas mehr Platz in HUD und Dock
  root.style.setProperty('--dock-h', '206px');
  root.style.setProperty('--hud-h', '76px');
  uiRamp(p).forEach((c, i) => root.style.setProperty(`--c${i}`, c));
  for (const [k, c] of Object.entries(p.accents ?? {})) root.style.setProperty(`--a-${k}`, c);
  const [t0, t0d, t1, t1d] = gt.team;
  root.style.setProperty('--team0', t0);
  root.style.setProperty('--team0d', t0d);
  root.style.setProperty('--team1', t1);
  root.style.setProperty('--team1d', t1d);

  const ramp = rampFor(id);
  if (ramp) {
    const pal = ramp.map(hexRgb);
    const teams = TEAM_COLORS.flatMap((t) => [t.T, t.TD]).map((h, i) => [hexRgb(h), hexRgb(gt.team[i]!)] as const);
    setIconRemap((c) => {
      const ctx = c.getContext('2d')!;
      const img = ctx.getImageData(0, 0, c.width, c.height);
      const d = img.data;
      const scale = Math.max(1, Math.round(c.width / 24));
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3]! < 10) continue;
        const r = d[i]!;
        const g = d[i + 1]!;
        const b = d[i + 2]!;
        const team = teams.find(([src]) => Math.hypot(src[0] - r, src[1] - g, src[2] - b) < 18);
        let out: [number, number, number];
        if (team) out = team[1];
        else {
          const px = (i / 4) % c.width;
          const py = Math.floor(i / 4 / c.width);
          const bay = (BAYER[(Math.floor(py / scale) % 4) * 4 + (Math.floor(px / scale) % 4)]! + 0.5) / 16;
          let l = (0.3 * r + 0.59 * g + 0.11 * b) / 255;
          l = Math.min(1, Math.max(0, (l - 0.06) / 0.86));
          const n = pal.length - 1;
          const idx = Math.round(Math.min(n, Math.max(0, l * n + (bay - 0.5) * 0.85)));
          out = pal[idx]!;
        }
        [d[i], d[i + 1], d[i + 2]] = out;
      }
      ctx.putImageData(img, 0, 0);
    });
  }

  // Titel in Einzelbuchstaben zerlegen (für bunte oder wippende Logos)
  const title = document.querySelector('.title');
  if (title) title.innerHTML = [...(title.textContent ?? '')].map((ch) => (ch === ' ' ? ' ' : `<span class="l">${ch}</span>`)).join('');
}

function rampFor(id: string): string[] | null {
  const gt = GAME_THEMES[id]!;
  if (id === 'idle') return null; // Idle nutzt alle Farben
  return gt.ramp ?? [...uiRamp(findPaletteTheme(id)!)];
}

/** Hängt den Paletten-Shader an das Schlachtfeld. */
export function applyThemeRenderer(id: string, app: Application): ActiveTheme {
  const ramp = rampFor(id);
  let on = true;
  let filter: Filter | null = null;
  if (ramp) {
    const pal = new Float32Array(MAX_COLORS * 3);
    ramp.forEach((h, i) => hexRgb(h).forEach((v, k) => (pal[i * 3 + k] = v / 255)));
    const team = new Float32Array(24);
    TEAM_COLORS.flatMap((t) => [t.T, t.TD]).forEach((src, i) => {
      hexRgb(src).forEach((v, k) => (team[i * 6 + k] = v / 255));
      hexRgb(GAME_THEMES[id]!.team[i]!).forEach((v, k) => (team[i * 6 + 3 + k] = v / 255));
    });
    const uniforms = new UniformGroup({
      uPal: { value: pal, type: 'f32', size: MAX_COLORS * 3 },
      uCount: { value: ramp.length, type: 'f32' },
      uTeam: { value: team, type: 'f32', size: 24 },
      uOn: { value: 1, type: 'f32' },
    });
    filter = new Filter({
      glProgram: GlProgram.from({ vertex: defaultFilterVert, fragment: FRAGMENT, name: 'palette-filter' }),
      resources: { paletteUniforms: uniforms },
    });
    app.stage.filters = [filter];
    app.stage.filterArea = app.screen;
  }
  installClickFx();
  return {
    id,
    togglePalette() {
      if (!filter) return false;
      on = !on;
      app.stage.filters = on ? [filter] : [];
      return on;
    },
  };
}

/** Drück-Animation und Partikel bei jedem Klick auf Knöpfe, Karten und Kacheln. */
function installClickFx(): void {
  document.addEventListener('pointerdown', (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('.btn, .card, .tile');
    if (!target || (target as HTMLButtonElement).disabled) return;
    target.classList.remove('clicked');
    void target.offsetWidth;
    target.classList.add('clicked');
    window.setTimeout(() => target.classList.remove('clicked'), 450);
    const fx = document.createElement('i');
    fx.className = 'gfx';
    fx.style.left = `${e.clientX}px`;
    fx.style.top = `${e.clientY}px`;
    fx.innerHTML = '<b></b>'.repeat(10) + '<em>+1</em>';
    document.body.appendChild(fx);
    window.setTimeout(() => fx.remove(), 900);
  });
}

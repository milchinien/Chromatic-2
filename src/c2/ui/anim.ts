// Animations-Helfer für die DOM-Oberfläche (Web Animations API).
// Alle Koordinaten sind Spielpixel (640×360), unabhängig von der Skalierung.

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Überspringbare Abfolge: skip() beendet laufende Animationen und Pausen sofort. */
export class Timeline {
  skipped = false;
  private running = new Set<Animation>();
  private waits = new Set<() => void>();

  reset(): void {
    this.skipped = false;
  }

  skip(): void {
    if (this.skipped) return;
    this.skipped = true;
    for (const a of this.running) a.finish();
    for (const w of this.waits) w();
    this.running.clear();
    this.waits.clear();
  }

  wait(ms: number): Promise<void> {
    if (this.skipped) return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(id);
        this.waits.delete(done);
        resolve();
      };
      const id = setTimeout(done, ms);
      this.waits.add(done);
    });
  }

  play(el: Element, frames: Keyframe[], opts: KeyframeAnimationOptions): Promise<void> {
    const a = el.animate(frames, { fill: 'forwards', ...opts });
    if (this.skipped) a.finish();
    this.running.add(a);
    return a.finished.then(
      () => void this.running.delete(a),
      () => void this.running.delete(a),
    );
  }
}

/** Skalierung des Spielfelds (wird von game.ts gesetzt). */
export const view = { scale: 1, root: null as HTMLElement | null };

/** Rechteck eines Elements in Spielpixeln. */
export function localRect(el: Element): { x: number; y: number; w: number; h: number } {
  const r = el.getBoundingClientRect();
  const root = view.root!.getBoundingClientRect();
  return { x: (r.left - root.left) / view.scale, y: (r.top - root.top) / view.scale, w: r.width / view.scale, h: r.height / view.scale };
}

/** Element an absolute Spielkoordinaten setzen. */
export function place(el: HTMLElement, x: number, y: number): void {
  el.style.left = `${Math.round(x)}px`;
  el.style.top = `${Math.round(y)}px`;
}

export function html(markup: string): HTMLElement {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstElementChild as HTMLElement;
}

/**
 * Lässt ein Element im Bogen von A nach B fliegen (mit Drehung und
 * Skalierung). Das Element muss absolut in `layer` liegen.
 */
export function flyArc(
  tl: Timeline,
  el: HTMLElement,
  from: { x: number; y: number; s?: number; r?: number },
  to: { x: number; y: number; s?: number; r?: number },
  ms: number,
  lift = 40,
  spin = 0,
): Promise<void> {
  const fs = from.s ?? 1;
  const ts = to.s ?? 1;
  const fr = from.r ?? 0;
  const tr = to.r ?? 0;
  const mid = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - lift };
  const frames: Keyframe[] = [];
  for (let k = 0; k <= 8; k++) {
    const t = k / 8;
    const x = (1 - t) ** 2 * from.x + 2 * (1 - t) * t * mid.x + t * t * to.x;
    const y = (1 - t) ** 2 * from.y + 2 * (1 - t) * t * mid.y + t * t * to.y;
    const s = fs + (ts - fs) * t + Math.sin(t * Math.PI) * 0.12;
    const r = fr + (tr - fr) * t + Math.sin(t * Math.PI) * spin;
    frames.push({ transform: `translate(${x}px, ${y}px) scale(${s}) rotate(${r}deg)`, offset: t });
  }
  el.style.left = '0px';
  el.style.top = '0px';
  el.style.transformOrigin = '0 0';
  return tl.play(el, frames, { duration: ms, easing: 'cubic-bezier(.3,.7,.3,1)' });
}

/** Karte umdrehen: Rückseite → Vorderseite (Element enthält .flip-front und .flip-back). */
export function flip(tl: Timeline, el: HTMLElement, ms = 360): Promise<void> {
  const inner = el.querySelector<HTMLElement>('.flip-inner');
  if (!inner) return Promise.resolve();
  return tl.play(inner, [{ transform: 'rotateY(180deg)' }, { transform: 'rotateY(0deg)' }], { duration: ms, easing: 'ease-out' });
}

/**
 * Kreis-Übergang. close: Schwarz wächst von der Mitte nach außen, bis alles
 * schwarz ist. open: das Bild erscheint wieder von der Mitte nach außen.
 */
export function iris(layer: HTMLElement, mode: 'close' | 'open', ms = 650): Promise<void> {
  const el = document.createElement('div');
  el.className = `iris ${mode}`;
  layer.appendChild(el);
  const maxR = 380;
  return new Promise((resolve) => {
    const t0 = performance.now();
    const step = () => {
      const u = Math.min(1, (performance.now() - t0) / ms);
      // in 8-px-Schritten wachsen, damit es pixelig wirkt
      const r = Math.round((u * u * maxR) / 8) * 8;
      if (mode === 'close') el.style.setProperty('--r', `${r}px`);
      else el.style.setProperty('--r', `${r}px`);
      if (u < 1) requestAnimationFrame(step);
      else {
        if (mode === 'open') el.remove();
        else el.dataset.done = '1';
        resolve();
      }
    };
    step();
  });
}

/** Entfernt einen geschlossenen Kreis-Übergang (Bild bleibt schwarz bis open()). */
export function clearIris(layer: HTMLElement): void {
  layer.querySelectorAll('.iris.close').forEach((e) => e.remove());
}

/** Pixel-Partikel-Explosion in der DOM-Ebene (Münzen, Funken, Glut). */
export function burst(layer: HTMLElement, x: number, y: number, colors: string[], n = 20, spread = 60, up = 50): void {
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    p.className = 'px-part';
    const size = Math.random() < 0.3 ? 2 : 1;
    p.style.cssText = `left:${Math.round(x)}px;top:${Math.round(y)}px;width:${size}px;height:${size}px;background:${colors[i % colors.length]}`;
    layer.appendChild(p);
    const ang = Math.random() * Math.PI * 2;
    const dist = spread * (0.3 + Math.random() * 0.7);
    const dx = Math.cos(ang) * dist;
    const dy = Math.sin(ang) * dist * 0.6 - up * Math.random();
    const a = p.animate(
      [
        { transform: 'translate(0,0)', opacity: 1 },
        { transform: `translate(${dx * 0.6}px, ${dy - 12}px)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${dx}px, ${dy + 24}px)`, opacity: 0 },
      ],
      { duration: 600 + Math.random() * 500, easing: 'cubic-bezier(.2,.6,.4,1)' },
    );
    a.finished.then(() => p.remove());
  }
}

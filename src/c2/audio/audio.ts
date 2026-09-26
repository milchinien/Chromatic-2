// =====================================================================
// Sound-Engine: berechnet die Klänge im Hintergrund (sounds.ts), spielt sie
// über ein kleines Mischpult ab und verwaltet Stimmen, Hall, Atmosphäre und
// die Lautstärke-Einstellungen.
//
//   Stimme → Panorama → Bus (Effekte / Oberfläche / Atmosphäre)
//                     ↘ Hall-Send
//   Effekte → Dämpfer (Tiefpass für Zeitlupe/Pause) → Kompressor ┐
//   Oberfläche, Atmosphäre, Hall ───────────────────────────────── Master → Limiter
// =====================================================================

import { SR, impulse, rng } from './dsp';
import { RECIPES, type Bus, type Out } from './sounds';
// eingebettet (Blob), damit er auch in der Offline-Version von file:// startet
import SoundWorker from './worker?worker&inline';

export interface PlayOpts {
  /** Lautstärke-Faktor */
  vol?: number;
  /** Panorama −1 (links) … 1 (rechts) */
  pan?: number;
  /** Tonhöhe/Tempo */
  rate?: number;
  /** zufällige Tonhöhen-Abweichung (Anteil), Standard 0,04 */
  jitter?: number;
  /** Verzögerung in Sekunden */
  delay?: number;
  /** Variante erzwingen */
  variant?: number;
}

export interface Settings {
  master: number;
  sfx: number;
  ui: number;
  amb: number;
  muted: boolean;
}

const KEY = 'c2-audio';
const MAX_VOICES = 48;

interface Voice {
  src: AudioBufferSourceNode;
  id: string;
  end: number;
}

export interface LoopHandle {
  set(level: number, time?: number): void;
  stop(time?: number): void;
}

class AudioEngine {
  ctx: AudioContext | null = null;
  settings: Settings = { master: 0.8, sfx: 0.9, ui: 0.8, amb: 0.7, muted: false };

  private raw = new Map<string, Out[]>();
  private bufs = new Map<string, AudioBuffer[]>();
  private voices: Voice[] = [];
  private lastStart = new Map<string, number>();
  private lastVariant = new Map<string, number>();

  // Berechnung im Worker: eine Warteschlange, dringende Klänge (Schleifen) zuerst
  private worker: Worker | null = null;
  /** kein Worker möglich: im Haupt-Thread rechnen (ein Klang pro Takt) */
  private local = false;
  private queue: string[] = [];
  private inFlight: string | null = null;
  private waiters = new Map<string, (() => void)[]>();

  private master!: GainNode;
  private buses!: Record<Bus, GainNode>;
  private muffle!: BiquadFilterNode;
  private reverb!: ConvolverNode;
  private reverbIn!: GainNode;
  private ambLevel!: GainNode;
  private amb: { key: string; handle: LoopHandle } | null = null;
  private ambWanted: string | null = null;

  constructor() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Settings> | null;
      if (s) this.settings = { ...this.settings, ...s };
    } catch {
      /* alte Einstellungen ignorieren */
    }
    this.prepare();
  }

  // --- Klänge berechnen -------------------------------------------------------------------

  /** Startet die Berechnung aller Klänge im Hintergrund. */
  private prepare(): void {
    try {
      this.worker = new SoundWorker();
      this.worker.onmessage = (e: MessageEvent<{ id: string; out: Out[] }>) => this.finish(e.data.id, e.data.out);
      this.worker.onerror = () => this.fallback();
    } catch {
      this.fallback();
    }
    for (const id of Object.keys(RECIPES)) if (!RECIPES[id]!.lazy) void this.ensure(id);
  }

  private fallback(): void {
    this.worker?.terminate();
    this.worker = null;
    this.local = true;
    // eine bereits verschickte Anfrage neu einreihen
    if (this.inFlight) this.queue.unshift(this.inFlight);
    this.inFlight = null;
    this.pump();
  }

  private finish(id: string, out: Out[]): void {
    this.raw.set(id, out);
    this.inFlight = null;
    for (const w of this.waiters.get(id) ?? []) w();
    this.waiters.delete(id);
    this.pump();
  }

  private ensure(id: string, urgent = false): Promise<void> {
    if (this.raw.has(id)) return Promise.resolve();
    return new Promise((resolve) => {
      const list = this.waiters.get(id) ?? [];
      list.push(resolve);
      this.waiters.set(id, list);
      if (this.inFlight !== id) {
        const k = this.queue.indexOf(id);
        if (k >= 0 && urgent) this.queue.splice(k, 1);
        if (k < 0 || urgent) urgent ? this.queue.unshift(id) : this.queue.push(id);
      }
      this.pump();
    });
  }

  private pump(): void {
    if (this.inFlight || !this.queue.length) return;
    const id = (this.inFlight = this.queue.shift()!);
    if (this.worker) return this.worker.postMessage(id);
    if (!this.local) return;
    setTimeout(() => {
      const rec = RECIPES[id]!;
      const out: Out[] = [];
      for (let v = 0; v < rec.n; v++) out.push(rec.gen(rng(hashId(id) + v * 7919), v));
      this.finish(id, out);
    }, 16);
  }

  private buffers(id: string): AudioBuffer[] | null {
    const have = this.bufs.get(id);
    if (have) return have;
    const raw = this.raw.get(id);
    if (!raw || !this.ctx) return null;
    const list = raw.map((o) => {
      const chans = o instanceof Float32Array ? [o] : o;
      const b = this.ctx!.createBuffer(chans.length, chans[0]!.length, SR);
      chans.forEach((c, i) => b.copyToChannel(c as Float32Array<ArrayBuffer>, i));
      return b;
    });
    this.bufs.set(id, list);
    return list;
  }

  // --- Start ------------------------------------------------------------------------------

  /** Browser erlauben Ton erst nach einer Eingabe: beim ersten Klick/Tastendruck aufrufen. */
  unlock(): void {
    if (!this.ctx) this.build();
    if (this.ctx!.state === 'suspended' && !document.hidden) void this.ctx!.resume();
  }

  private build(): void {
    // gleiche Rate wie die berechneten Klänge (der Hall verlangt das sogar)
    const ctx = new AudioContext({ latencyHint: 'interactive', sampleRate: SR });
    this.ctx = ctx;
    this.master = ctx.createGain();
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;
    this.master.connect(limiter).connect(ctx.destination);

    // Effekte: Dämpfer + sanfter Kompressor („Kleber“ für dichte Schlachten)
    this.muffle = ctx.createBiquadFilter();
    this.muffle.type = 'lowpass';
    this.muffle.frequency.value = 20000;
    this.muffle.Q.value = 0.5;
    const glue = ctx.createDynamicsCompressor();
    glue.threshold.value = -20;
    glue.knee.value = 10;
    glue.ratio.value = 3;
    glue.attack.value = 0.008;
    glue.release.value = 0.25;
    const sfx = ctx.createGain();
    sfx.connect(this.muffle).connect(glue).connect(this.master);

    const ui = ctx.createGain();
    ui.connect(this.master);
    const amb = ctx.createGain();
    this.ambLevel = ctx.createGain();
    amb.connect(this.ambLevel).connect(this.master);
    this.buses = { sfx, ui, amb };

    // Hall: selbst berechnete Impulsantwort (Halle/Tal, ca. 2,4 s)
    this.reverb = ctx.createConvolver();
    const [L, R] = impulse(2.6, 2.4, rng(99));
    const ir = ctx.createBuffer(2, L.length, SR);
    ir.copyToChannel(L as Float32Array<ArrayBuffer>, 0);
    ir.copyToChannel(R as Float32Array<ArrayBuffer>, 1);
    this.reverb.buffer = ir;
    this.reverbIn = ctx.createGain();
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    this.reverbIn.connect(this.reverb).connect(wet).connect(this.muffle);

    this.apply();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) void ctx.suspend();
      else void ctx.resume();
    });
    if (this.ambWanted) this.ambience(this.ambWanted);
  }

  // --- Abspielen --------------------------------------------------------------------------

  play(id: string, o: PlayOpts = {}): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || this.settings.muted) return;
    const rec = RECIPES[id];
    if (!rec) return;
    const list = this.buffers(id);
    if (!list) return;
    const now = ctx.currentTime;
    const at = now + (o.delay ?? 0);

    // Mindestabstand und Stimmenzahl je Klang
    const last = this.lastStart.get(id) ?? -1;
    if (rec.gap && at - last < rec.gap / 1000) return;
    this.voices = this.voices.filter((v) => v.end > now);
    const same = this.voices.filter((v) => v.id === id);
    if (same.length >= (rec.max ?? 8)) {
      // die älteste Stimme dieses Klangs weicht (kurz ausblenden wäre schöner, stoppen reicht)
      const old = same[0]!;
      old.src.stop();
      this.voices.splice(this.voices.indexOf(old), 1);
    }
    if (this.voices.length >= MAX_VOICES && rec.bus !== 'ui') return;
    this.lastStart.set(id, at);

    // nie zweimal dieselbe Variante hintereinander
    let v = o.variant ?? Math.floor(Math.random() * list.length);
    if (o.variant === undefined && list.length > 1 && v === this.lastVariant.get(id)) v = (v + 1) % list.length;
    this.lastVariant.set(id, v);
    const b = list[v]!;

    const src = ctx.createBufferSource();
    src.buffer = b;
    const j = o.jitter ?? 0.04;
    src.playbackRate.value = (o.rate ?? 1) * (1 + (Math.random() * 2 - 1) * j);
    const g = ctx.createGain();
    // leichte Lautstärke-Streuung (±1,5 dB)
    g.gain.value = rec.vol * (o.vol ?? 1) * Math.pow(10, ((Math.random() * 2 - 1) * 1.5) / 20);
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.max(-1, Math.min(1, o.pan ?? 0));
    src.connect(g).connect(pan).connect(this.buses[rec.bus]);
    if (rec.send) {
      const s = ctx.createGain();
      s.gain.value = rec.send;
      pan.connect(s).connect(this.reverbIn);
    }
    src.start(at);
    this.voices.push({ src, id, end: at + b.duration / src.playbackRate.value });
  }

  /** Endlosschleife starten (Atmosphäre, Schlachtenlärm); Lautstärke über set(). */
  loop(id: string, level = 0, rate = 1): LoopHandle {
    let g: GainNode | null = null;
    let src: AudioBufferSourceNode | null = null;
    let target = level;
    let stopped = false;
    const start = () => {
      const ctx = this.ctx;
      if (!ctx || stopped || g) return;
      const list = this.buffers(id);
      if (!list) return;
      const rec = RECIPES[id]!;
      src = ctx.createBufferSource();
      src.buffer = list[0]!;
      src.loop = true;
      src.playbackRate.value = rate;
      g = ctx.createGain();
      g.gain.value = 0;
      src.connect(g).connect(this.buses[rec.bus]);
      // zufälliger Einstieg, damit Schleifen nicht immer gleich beginnen
      src.start(ctx.currentTime, Math.random() * src.buffer.duration);
      g.gain.setTargetAtTime(target * rec.vol, ctx.currentTime, 0.4);
    };
    void this.ensure(id, true).then(start);
    const handle: LoopHandle = {
      set: (lv, time = 0.25) => {
        target = lv;
        if (!g) return start();
        g.gain.setTargetAtTime(lv * RECIPES[id]!.vol, this.ctx!.currentTime, time / 3);
      },
      stop: (time = 1) => {
        stopped = true;
        if (!g || !src || !this.ctx) return;
        const t = this.ctx.currentTime;
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(g.gain.value, t);
        g.gain.linearRampToValueAtTime(0, t + time);
        src.stop(t + time + 0.05);
      },
    };
    return handle;
  }

  /** Atmosphäre wechseln (weiche Überblendung). */
  ambience(key: string | null): void {
    this.ambWanted = key;
    if (!this.ctx) return;
    if (this.amb?.key === key) return;
    this.amb?.handle.stop(2.5);
    this.amb = null;
    if (!key) return;
    const id = `amb_${key}`;
    if (!RECIPES[id]) return;
    this.amb = { key, handle: this.loop(id, 1) };
  }

  /** Atmosphäre leiser (z. B. im Kampf). */
  ambienceLevel(level: number, time = 1): void {
    if (!this.ctx) return;
    this.ambLevel.gain.setTargetAtTime(level, this.ctx.currentTime, time / 3);
  }

  /** Dämpfen: 0 = klar, 1 = stark gedämpft (Zeitlupe, Pause). */
  setMuffle(k: number): void {
    if (!this.ctx) return;
    const f = 20000 * Math.pow(500 / 20000, Math.max(0, Math.min(1, k)));
    this.muffle.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.06);
  }

  // --- Einstellungen ----------------------------------------------------------------------

  set(s: Partial<Settings>): void {
    this.settings = { ...this.settings, ...s };
    localStorage.setItem(KEY, JSON.stringify(this.settings));
    this.apply();
  }

  private apply(): void {
    if (!this.ctx) return;
    const s = this.settings;
    const t = this.ctx.currentTime;
    // wahrgenommene Lautstärke: quadratische Kurve
    this.master.gain.setTargetAtTime(s.muted ? 0 : s.master * s.master, t, 0.03);
    this.buses.sfx.gain.setTargetAtTime(s.sfx * s.sfx, t, 0.03);
    this.buses.ui.gain.setTargetAtTime(s.ui * s.ui, t, 0.03);
    this.buses.amb.gain.setTargetAtTime(s.amb * s.amb, t, 0.03);
  }
}

/** Gleicher Startwert wie im Worker, damit beide Wege dieselben Klänge liefern. */
function hashId(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export const audio = new AudioEngine();

/** Panorama aus einer Feld-X-Koordinate (0…640). */
export const panX = (x: number) => Math.max(-0.85, Math.min(0.85, (x - 320) / 320));

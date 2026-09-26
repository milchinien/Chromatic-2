// =====================================================================
// Ton der Massenschlacht. Tausende Einheiten können nicht jede einen
// eigenen Klang bekommen: die Dichte des Kampfes steuert drei Lärm-
// Schleifen (Nahkampf, Marsch, Pfeilhagel), darüber liegen einzelne,
// im Panorama platzierte Klänge für das, was man gerade sieht.
// =====================================================================

import type { Arena, SimEvent } from '../sim/arena';
import { audio, panX, type LoopHandle } from './audio';

/** Weiche Annäherung an einen Zielwert (unabhängig von der Bildrate). */
const approach = (v: number, target: number, dt: number, tau: number) => v + (target - v) * (1 - Math.exp(-dt / tau));

export class BattleAudio {
  private readonly melee: LoopHandle;
  private readonly march: LoopHandle;
  private readonly arrows: LoopHandle;
  private meleeRate = 0;
  private arrowRate = 0;
  private moving = 0;
  private lastState = '';

  constructor(private readonly arena: Arena) {
    this.melee = audio.loop('bed_melee');
    this.march = audio.loop('bed_march');
    this.arrows = audio.loop('bed_arrows');
    audio.ambienceLevel(0.45, 2);
  }

  /**
   * Einmal pro Bild aufrufen, bevor die Darstellung die Ereignisse leert.
   * `realDt` = echte Sekunden, `slow` = Zeitlupen-Faktor, `speed` = 1×/2×/4×.
   */
  update(realDt: number, slow: number, speed: number, paused: boolean): void {
    const a = this.arena;
    const live = !paused && (a.state === 'fight' || a.state === 'march');

    // Einzelklänge
    for (const e of a.events) this.onEvent(e);

    // Dichte messen: Schwerthiebe und Pfeile pro (Spiel-)Sekunde
    const t = a.sfxTally;
    const dt = Math.max(1e-3, realDt);
    this.meleeRate = approach(this.meleeRate, t.melee / dt / Math.max(1, speed), dt, 0.35);
    this.arrowRate = approach(this.arrowRate, t.arrows / dt / Math.max(1, speed), dt, 0.35);
    if (t.arrows > 0) audio.play('bow', { pan: panX(t.arrowX / t.arrows), vol: Math.min(1, 0.4 + t.arrows * 0.1) });
    t.melee = t.arrows = t.arrowX = 0;
    const mobile = a.mobileNow[0]! + a.mobileNow[1]!;
    this.moving = approach(this.moving, live ? mobile : 0, dt, 0.6);

    // Lärm-Schleifen: logarithmisch, damit 50 und 3000 Einheiten beide passen
    const lvl = (x: number, full: number) => Math.min(1, Math.log2(1 + x) / Math.log2(1 + full));
    this.melee.set(live ? lvl(this.meleeRate, 250) : 0, 0.3);
    this.arrows.set(live ? lvl(this.arrowRate, 120) * 0.9 : 0, 0.3);
    this.march.set(live ? lvl(this.moving, 1500) * (a.state === 'march' ? 1 : 0.6) : 0, 0.6);

    // Zeitlupe und Pause klingen gedämpft
    audio.setMuffle(paused ? 0.55 : slow < 0.99 ? Math.min(0.8, (1 - slow) * 1.1) : 0);

    // Wechsel des Kampfzustands
    if (this.lastState === 'fight' && a.state === 'march') {
      const mine = a.mobileNow[0]! > 0;
      audio.play(mine ? 'horn_good' : 'horn_bad', { jitter: 0 });
    }
    this.lastState = a.state;
  }

  private onEvent(e: SimEvent): void {
    switch (e.t) {
      case 'hit':
        if (e.big) return audio.play('impact', { pan: panX(e.x) });
        // Nahkampf-Treffer sind weiß, Geschosse tragen die Farbe ihres Volkes
        if (e.color === '#ffffff') return audio.play(Math.random() < 0.6 ? 'clash' : 'thud', { pan: panX(e.x), vol: 0.7 + Math.random() * 0.3 });
        return audio.play(Math.random() < 0.5 ? 'arrow_hit' : 'spark', { pan: panX(e.x), vol: 0.6 });
      case 'death':
        if (e.boss) return audio.play('death_boss', { jitter: 0 });
        if (e.big) return audio.play('death_big', { pan: panX(e.x) });
        if (e.flying) return audio.play('death_fly', { pan: panX(e.x) });
        return audio.play('death', { pan: panX(e.x), vol: 0.5 + Math.random() * 0.5 });
      case 'boom': {
        const pan = panX(e.x);
        switch (e.fx) {
          case 'fire':
            return audio.play('fire', { pan });
          case 'meteor':
            return audio.play('meteor', { pan });
          case 'colossus':
            return audio.play('colossus', { pan, jitter: 0.02 });
          case 'boulder':
            return audio.play('boulder', { pan });
          case 'rock':
            return audio.play('rock', { pan });
          case 'frost':
            return audio.play('frost', { pan });
          case 'whirl':
            return audio.play('whirl', { pan });
          case 'root':
            return audio.play('roots', { pan });
          case 'bloat':
            return audio.play('bloat', { pan });
          case 'spore':
            return audio.play('spore', { pan });
          default:
            return audio.play('rock', { pan, vol: 0.7 });
        }
      }
      case 'aura':
        return audio.play(e.fx === 'moon' ? 'aura_moon' : e.fx === 'bless' ? 'aura_bless' : 'aura_mend', { pan: panX(e.x), jitter: 0.01 });
      case 'cast':
        return audio.play(e.siege ? 'launch' : 'cast', { pan: panX(e.x) });
      case 'beam':
        return audio.play(e.fx === 'cannon' ? 'cannon' : 'sunbeam', { pan: panX(e.x0) });
      case 'chain':
        return audio.play('chain', { pan: panX(e.pts[0] ?? 320) });
      case 'spawn':
        return audio.play(e.undead ? 'spawn_undead' : 'spawn', { pan: panX(e.x), vol: e.big ? 1 : 0.7 });
      case 'base':
        // eigene Burg getroffen: etwas tiefer und lauter
        return audio.play('base_hit', { pan: e.team === 0 ? -0.8 : 0.8, rate: e.team === 0 ? 0.85 : 1, vol: e.team === 0 ? 1 : 0.8 });
      case 'wave':
        return audio.play('wave', { jitter: 0.02 });
      case 'text':
        if (e.text === 'LAST STAND!') return audio.play(e.x < 320 ? 'horn_last' : 'horn_foe', { jitter: 0 });
        if (e.text === 'OVERGROWTH') return audio.play('roots', { vol: 1.2, rate: 0.8, jitter: 0 });
        if (e.text === 'FLED!') return audio.play('horn_bad', { jitter: 0, pan: 0.6 });
        return;
    }
  }

  /** Kampf verlassen: Lärm ausblenden, Atmosphäre wieder lauter. */
  stop(): void {
    this.melee.stop(1.2);
    this.march.stop(1.2);
    this.arrows.stop(1.2);
    audio.setMuffle(0);
    audio.ambienceLevel(1, 2);
  }

  /** Alle Lärm-Schleifen sofort leise (Kampfende). */
  hush(): void {
    this.melee.set(0, 0.8);
    this.march.set(0, 0.8);
    this.arrows.set(0, 0.8);
  }
}

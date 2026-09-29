// Bühne der Handy-Version: 320 Spielpixel breit, Höhe passend zum Handy
// (544…704), damit moderne 19,5:9-Handys ohne Rand gefüllt werden. Dazu das
// Kampf-Layout im Hochformat: Gegner oben, Spieler unten.

export const MW = 320;
/** Höhe der Bühne – wird beim Start einmal festgelegt (initStage). */
export let MH = 640;

export function initStage(): void {
  // Wo Vollbild möglich ist (Android), zählt der ganze Bildschirm, sonst das Browserfenster (iOS)
  const full = !!document.fullscreenEnabled && localStorage.getItem('c2-windowed') !== '1';
  const w = full ? screen.width : innerWidth;
  const h = full ? screen.height : innerHeight;
  const aspect = Math.max(w, h) / Math.max(1, Math.min(w, h));
  MH = Math.round((MW * Math.min(2.2, Math.max(1.7, aspect))) / 2) * 2;
}

/**
 * Kampf-Layout. Die Simulation läuft waagrecht (x = Richtung Gegner-Burg);
 * auf dem Bildschirm zeigt x nach oben und y nach rechts:
 *   Bildschirm-x = y,   Bildschirm-y = top + (fx1 − x)
 */
export interface BattleLayout {
  /** Simulations-Feld */
  fx0: number;
  fx1: number;
  fy0: number;
  fy1: number;
  /** Feldlänge (Pixel) */
  len: number;
  /** Bildschirm-y der gegnerischen Mauer-Vorderkante (= fx1) */
  top: number;
  /** Bildschirm-y der eigenen Mauer-Vorderkante (= fx0) */
  bottom: number;
  /** Gegnerische Mauer: Krone [wallTop0, wallTop1), Vorderseite bis top − 2 */
  wallTop0: number;
  wallTop1: number;
  /** Eigene Mauer: Vorderseite ab bottom + 2, Krone [wallBot0, wallBot1) */
  wallBot0: number;
  wallBot1: number;
  /** Kartenplätze unten */
  slotY: number;
  slotW: number;
  slotH: number;
  /** Untere Leiste (eigene Burg + Pause/Tempo) */
  barY: number;
}

export function battleLayout(): BattleLayout {
  const slotH = 62;
  const barY = MH - 6 - 22;
  const slotY = barY - 5 - slotH;
  const top = 54;
  const len = MH - 190;
  const bottom = top + len;
  return {
    fx0: 32,
    fx1: 32 + len,
    fy0: 16,
    fy1: 304,
    len,
    top,
    bottom,
    wallTop0: 28,
    wallTop1: 48,
    wallBot0: bottom + 6,
    wallBot1: bottom + 26,
    slotY,
    slotW: 68,
    slotH,
    barY,
  };
}

/** Simulation → Bildschirm. `h` = Höhe über dem Boden (in der Simulation als y-Versatz abgelegt). */
export function toScreenX(L: BattleLayout, y: number, h = 0): number {
  return y + h;
}

export function toScreenY(L: BattleLayout, x: number, h = 0): number {
  return L.top + (L.fx1 - x) - h;
}

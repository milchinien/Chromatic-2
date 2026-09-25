# Chromatic 2

Nachfolger von *Chromatic*: Roguelite-Deckbuilder mit Echtzeit-Massenschlachten
in **2D Top-Down** mit kleinen Pixel-Art-Figuren.

| Seite | Inhalt |
|---|---|
| `index.html` | **Das Spiel** (`src/c2/`): Hauptmenü → 3 Farben wählen → 4 Welten mit Kämpfen, Shop, Schatz, Enchanter, Pyre und Bossen |
| `ui-lab.html` | UI-Lab: Design-Varianten, Welt-Designs, Kartendesign (`src/lab/`) |
| `sandbox.html` | Erster Prototyp: zwei Karten frei gegeneinander kämpfen lassen (`src/main.ts`) |

### Das Spiel in Kürze

- **Run:** 3 Farben wählen → Startdeck aus 10 Karten. Welt 1 ist die Drifters-Welt von Rusk,
  danach vor jeder Welt Wahl zwischen 2 Farb-Bossen. 5 Räume pro Welt, dann der Boss. 3 Leben.
- **Kampf:** 3 Karten ziehen, 2 wählen (Front/Back), FIGHT → Einheiten erscheinen, Kartenschau
  mit Boni (Linksklick überspringt) → Massenschlacht → Überlebende laufen zur Burg (1 Schaden je
  Einheit) → nächste Runde, bis eine Burg fällt.
- **Räume:** Kampf, Schatz (Gold oder Upgrade), Shop (Upgrade/Kaufen), Enchanter (1 von 2
  Enchantments, 6 Seltenheiten inkl. *Greed*), Pyre (1 von 3 Karten entfernen), Boss.
- Der Run wird an jeder Weggabelung gespeichert („Continue“ im Hauptmenü).

## Starten

```bash
pnpm install
pnpm dev        # http://localhost:3100 (oder nächster freier Port)
pnpm build      # Produktions-Build nach dist/
```

Steuerung: Karte anklicken → Kartenauswahl · **Leertaste** = Kampf starten / Pause ·
Tempo 1×/2×/4× · „Neu aufstellen“ setzt das Feld zurück.

## Technik

- **Vite + TypeScript + PixiJS v8**, reine Browser-App, keine Engine.
- **Simulation** (`src/sim/`): flache Typed-Arrays, feste Schrittweite 1/60 s,
  Spatial-Hash-Raster für Zielsuche und Kollision. ~2–3 ms pro Schritt bei 6000 Einheiten.
- **Grafik** (`src/art/`): Alle Figuren, Gebäude, der Boden und die Burgmauern
  werden prozedural aus Pixeln erzeugt (automatische Kontur + Schatten) und in
  einen Textur-Atlas gepackt. Einheiten laufen über einen `ParticleContainer`.
- **Darstellung** (`src/render/`): ganzzahlige Skalierung (Pixel bleiben scharf),
  y-Sortierung per Bucket-Sort, Leichen/Blut/Krater werden dauerhaft in eine
  Boden-Textur „eingebrannt“.
- **Oberfläche** (`src/ui/`, `src/style.css`): HTML/CSS im Pixel-Stil mit den
  Schriften *Silkscreen* (Titel/Knöpfe) und *VT323* (Fließtext).

## Karten

Alle 25 Karten aus Chromatic 1 (5 Farben × 5 Klassen) inklusive Fähigkeiten wie
Wut, Panik-Galopp, Brand, Verlangsamung, Durchschlag, Felsbrocken, Wurzelstrahl,
Skelett-/Ghul-Beschwörung, Wiederauferstehung, Heilung, Schilde und Auren.
Die Werte sind noch nicht auf Massenschlachten ausbalanciert.

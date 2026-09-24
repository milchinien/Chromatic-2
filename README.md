# Chromatic 2 – Prototyp

Nachfolger von *Chromatic*: Roguelite-Deckbuilder mit Echtzeit-Massenschlachten,
jetzt in **2D Top-Down** mit kleinen Pixel-Art-Figuren (8–14 px, Stil à la WorldBox).

Dieser erste Prototyp zeigt **ein Schlachtfeld**: Du wählst eine Karte für deine
Armee und eine für den Gegner, stellst Truppenzahl (bis 3000 pro Seite) und
Kartenstufe ein und lässt beide gegeneinander kämpfen.

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

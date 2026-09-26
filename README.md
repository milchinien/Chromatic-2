# Chromatic 2

Nachfolger von *Chromatic*: Roguelite-Deckbuilder mit Echtzeit-Massenschlachten
in **2D Top-Down** mit kleinen Pixel-Art-Figuren.

| Seite | Inhalt |
|---|---|
| `index.html` | **Das Spiel** (`src/c2/`): Hauptmenü → 3 Farben wählen → 4 Welten mit Kämpfen, Shop, Schatz, Enchanter, Pyre und Bossen |
| `ui-lab.html` | UI-Lab: Design-Varianten, Welt-Designs, Kartendesign (`src/lab/`) |
| `sandbox.html` | Erster Prototyp: zwei Karten frei gegeneinander kämpfen lassen (`src/main.ts`) |
| `balance.html` | **Balance-Editor** (`src/editor/`): zwei Heere mit Karten, Sternen, Truppen, Boni, Enchantments und Boss zusammenstellen, ansehen oder hundertfach durchrechnen |

### Das Spiel in Kürze

- **Run:** 3 Farben wählen → die 10 gezogenen Startkarten werden aufgedeckt → Continue.
  Welt 1 ist die Drifters-Welt von Rusk,
  danach vor jeder Welt Wahl zwischen 2 Farb-Bossen. 5 Räume pro Welt, dann der Boss. 3 Leben.
- **Kampf:** 3 Karten ziehen, 2 wählen (Front/Back), FIGHT → Einheiten erscheinen, Kartenschau
  mit Boni (Linksklick überspringt) → Massenschlacht → Überlebende laufen zur Burg → nächste
  Runde, bis eine Burg fällt. Burgschaden: ein ganzes Heer = 100, jede Einheit nach ihrem
  HP-Anteil (12 Magier zählen so viel wie 240 Zombies). Ab Runde 4 steigt der Burgschaden
  (Belagerung, +50 % je Runde).
- **Räume:** Kampf, Schatz (Gold oder Upgrade), Shop (Upgrade/Kaufen), Enchanter (1 von 2
  Enchantments, 6 Seltenheiten inkl. *Greed*), Pyre (1 von 3 Karten entfernen), Boss.
- Der Run wird an jeder Weggabelung gespeichert („Continue“ im Hauptmenü).

## Starten

```bash
pnpm install
pnpm dev        # http://localhost:3100 (oder nächster freier Port)
pnpm build      # Produktions-Build nach dist/
pnpm package    # Version zum Weitergeben: release/Chromatic-2.zip
```

### Version zum Weitergeben

`pnpm package` baut eine Offline-Version, die per Doppelklick direkt von der Festplatte
läuft (kein Server, kein Internet): klassisches Skript statt Modulen, Schriften und
Sound-Worker eingebettet, Bilder verkleinert (Python + Pillow). Ergebnis:
`release/Chromatic-2.zip` mit `Chromatic 2 spielen.html` und einer `LIESMICH.txt`.

### Balance-Werkzeuge

- **Editor:** `pnpm dev` → `/balance.html`
- **Massen-Simulation** (Node, alle CPU-Kerne): `pnpm balance <experiment> [anzahl]`
  - `cards` – Stärke jeder Karte (logistische Bewertung aus Zufallspaaren)
  - `bonus` – Wert jedes Rassen- und Klassenbonus
  - `champs` – Champions gegen normale Paare
  - `curve` – Schwierigkeit eines Runs Welt für Welt (Siegquote, Runden, Dauer)
  - `bosses` – jeder Boss einzeln je Welt
  - `calibrate` – gleicht Kartenwerte automatisch an
- **Spieltest im Browser:** `pnpm playtest <url> [räume] [bilderordner]` spielt mit echten
  Klicks durch (Chrome/Edge ohne Fenster, stumm) und meldet Konsolenfehler.

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

36 Karten in 7 Farben (`src/lab/races.ts`), Fähigkeiten in `src/c2/sim/arena.ts`.
Die Werte sind per Simulation ausbalanciert: jede normale Karte gewinnt gegen
Zufallsgegner etwa 45–60 % der Runden (Belagerung bewusst leicht darüber),
Champions deutlich mehr. Überschüssiger Schaden springt auf Nachbarn über und
Champions spalten, damit wenige starke Einheiten gegen Massen bestehen.

# Chromatic 2 – Mobile-Version (Plan & Umsetzung)

Ziel: Das Spiel auf Handys im **Hochformat** voll spielbar machen – gleiche Grafik,
gleiche Karten, gleiche Räume, gleiche Effekte. Die PC-Version bleibt unverändert.

## Grundsätze

1. **PC unberührt.** Die Mobile-Version liegt komplett in `src/c2/mobile/` und wird
   nur per `import()` nachgeladen, wenn ein Handy erkannt wird (Touch als einziges
   Zeigegerät + kurze Bildschirmseite < 600 px). PC-Spieler laden weder Code noch CSS
   davon. Tablets bekommen weiterhin das Querformat.
   Test am PC: `?layout=mobile` an die URL hängen (`?layout=desktop` erzwingt PC).
2. Geteilter Code wird nur **verhaltensneutral** erweitert (`private` → `protected`,
   Konstanten → Parameter mit den alten Werten als Standard). Eine Prüfsumme über
   40 simulierte PC-Kämpfe muss vorher und nachher identisch sein.
3. **Gleicher Stil:** alle Pixel-Grafiken (Boden, Burgen, Wald, Karten, Räume,
   Kerze) kommen aus denselben Generatoren und Bildern.

## Bühne

- PC: 640×360. Mobile: **320 × H**, H = 544…704 je nach Seitenverhältnis des Handys
  (kein Rand auf modernen 19,5:9-Handys). 320 statt 360 Spielpixel Breite, damit
  Schrift und Einheiten auf dem Handy groß genug sind.
- Vollbild beim ersten Tippen (Android), Hochformat-Sperre wo möglich; im
  Querformat erscheint ein Hinweis „Gerät drehen“.
- Kein Zoomen/Scrollen/Markieren/Kontextmenü; Tippen = Klicken.

## Kampf (größte Änderung)

- **Spieler unten, Gegner oben.** Die Simulation läuft unverändert „waagrecht“;
  nur die Darstellung dreht das Feld (x → nach oben, y → nach rechts). Einheiten,
  Geschosse und alle Effekte stehen aufrecht; Strahlen (Sonne/Kanone), Flutwelle,
  Last-Stand-Leuchten und das Zerbröckeln der Burg sind für die Senkrechte angepasst.
- Feldgröße auf dem Handy: Länge 357…517 (PC 576), Breite 288 (PC 182). Die
  Aufstellungszonen werden so gestaucht, dass die Truppendichte gleich bleibt;
  Beschwörungen/Mauern skalieren mit der Feldlänge. Auf dem PC ergeben alle
  Formeln exakt die alten Zahlen.
- Burgmauern oben/unten mit Türmen, Wald an den Seiten – aus denselben
  Pixel-Bausteinen wie am PC.
- Oben: Gegner-Leiste + Timer. Unten: 4 kompakte Kartenplätze (Front/Back je
  Seite), Stapel, eigene Burg-Leiste, Pause und Tempo 1×/2×/4×.
- Karten ziehen: 3 große Karten im Dreieck über dem Feld; Tippen wählt
  (erste = FRONT), ⇄ tauscht, FIGHT-Knopf in der unteren Leiste.
  **Gedrückt halten** vergrößert jede Karte (auch im Kampf auf den Plätzen).
- Kartenschau vor dem Kampf: Gegnerkarten oben, eigene unten, VS + Boni dazwischen.
  Sie bleibt stehen, bis man antippt (wie am PC der Klick).
- Bonus-Details: Bonus-Leiste unten oder einen Bonus der Kartenschau antippen → Kasten
  klappt nach oben auf (zwei Boni übereinander; am PC per Hover nebeneinander).

## Andere Bildschirme

- Hauptmenü: Titel oben, Kerze in der Mitte, Knöpfe darunter.
- Farbwahl: 4 + 3 Rassen-Kacheln, alles ohne Scrollen.
- Weltkarte/Einführung, Weggabelung, Weltwahl, Ende: untereinander statt nebeneinander.
- Räume (Schatz, Shop, Enchanter, Pyre): die Raum-Szene oben (Mitte des Bildes,
  gleiche Pixel), Auswahl-Details in einem Panel darunter.
- Deck-Übersicht & alle Karten: 3 Spalten, mit dem Finger scrollbar, Karte antippen = groß.

## Dateien

| Datei | Inhalt |
|---|---|
| `src/c2/mobile/detect.ts` | Handy-Erkennung (einziger Mobile-Code im PC-Bundle, ~10 Zeilen) |
| `src/c2/mobile/main.ts` | Start der Mobile-Version |
| `src/c2/mobile/stage.ts` | Bühnengröße und Kampf-Layout |
| `src/c2/mobile/game.ts` | `MobileGame` (erbt von `Game`) |
| `src/c2/mobile/field.ts` | Hochformat-Schlachtfeld (Boden, Burgen, Wald) |
| `src/c2/mobile/arenaView.ts` | `MobileArenaView` (erbt von `ArenaView`, dreht die Darstellung) |
| `src/c2/mobile/screens/*.ts` | Kampf, Räume, Weltwahl im Hochformat |
| `src/c2/mobile/mobile.css` | Alle Mobile-Stile, nur unter `#game.m` gültig |

Geteilte Dateien mit neutralen Erweiterungen: `sim/arena.ts` (Feldgröße einstellbar),
`render/arenaView.ts` (`protected` + kleine Einstiegspunkte), `game.ts` (`protected`),
`ui/anim.ts` (Kreis-Übergang-Radius), `lab/palettes.ts` (Szene mit wählbarer Größe),
`main.ts` (Weiche PC/Mobile).

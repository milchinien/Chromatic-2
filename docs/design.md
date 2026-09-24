# Chromatic 2 – Game Design

Stand: 2026-09-24. Spieltexte (Kartennamen, Fähigkeiten) sind Englisch, Erklärungen Deutsch.
Punkte mit *(Vorschlag)* sind noch nicht bestätigt.

---

## 1. Run-Ablauf

- **Start:** Der Spieler wählt **3 Farben** (Drifters/Farblos ist wählbar). Daraus wird ein
  **Startdeck aus 10 zufälligen Karten** erzeugt.
- **Welten:** Ein Run hat **4 Welten**.
  - **Welt 1 = Tutorial-Welt:** fester Tutorial-Boss, **feste Route**, **5 Räume**, nur 1-Stern-Räume.
  - **Welten 2–4:** Vor jeder Welt wählt der Spieler aus **2–3 der 6 Farb-Bosse**. Ein besiegter
    Boss taucht im selben Run nicht erneut auf. Morvath (Plague Court) erst ab Welt 3 *(Vorschlag)*.
- **Räume:** Nach jedem Raum stehen **2–3 Türen** zur Wahl, deren Raumtyp und Sterne sichtbar sind.
  Eine Welt hat **8 Räume + Boss** (ca. 5 Battle, 1 Shop, 1 Treasure, 1 Pyre).
- **Sterne (1–5):** Jeder Raum hat eine Sternstufe für **Schwierigkeit und Belohnung**. Mehr Sterne =
  mehr und stärkere gegnerische Truppen und bessere Belohnung. Kleiner Zufallsanteil, damit nicht
  alle Räume gleicher Stufe gleich schwer sind.

  | Welt | Sterne |
  |---|---|
  | 1 (Tutorial) | 1 |
  | 2 | 1–3 |
  | 3 | 2–4 |
  | 4 | 3–5 |
- **Leben:** **3 Leben** pro Run. Jede verlorene Schlacht kostet ein Leben. Eine Niederlage
  gegen den **Boss beendet den Run sofort**.
- **Gold:** Fester Betrag pro Sieg **plus Bonus** nach Anteil überlebender eigener Einheiten.

### Raumtypen

| Raum | Inhalt |
|---|---|
| **Battle** | Kampf gegen ein Deck der aktuellen Boss-Welt (Boss-Farbe + Drifters), wird innerhalb der Welt stärker |
| **Shop** | Zufälliges Angebot: Karten kaufen **oder** Karten upgraden |
| **Treasure** | Gold und/oder ein kostenloses Karten-Upgrade |
| **Pyre** | 3 Karten aus dem Deck werden vorgeschlagen, **1 davon kann verbrannt** (entfernt) werden |
| **Boss** | Fester Boss der Welt. Nach dem Sieg: **1 Karte aus dem Boss-Deck** wählen |

## 2. Schlacht

- Zu Beginn zieht der Spieler **3 Karten** aus seinem Deck.
- Er schickt **2 davon** in den Kampf und bestimmt, welche **vorne** und welche **hinten** steht.
- Die dritte Karte geht **zurück ins Deck**.
- Der Gegner kämpft mit **2 zufälligen Karten** aus seinem Deck.
- **Ziehchance:** Grundsätzlich zufällig. Karten, die mit einer bereits gezogenen Karte ein
  Bonus-Paar bilden, haben **leicht erhöhte Chancen**, damit der Spieler öfter Boni hat.
- **Moral:** Einheiten können fliehen (z. B. wenn der Lord Commander fällt). Untote ignorieren Moral.

### Boni
Jede Karte hat **genau eine Farbe und eine Klasse**.
- Beide Karten haben **dieselbe Farbe** → beide bekommen den **Rassenbonus**.
- Beide Karten haben **dieselbe Klasse** → beide bekommen den **Klassenbonus**.
- Beides gleich (z. B. Duplikate) → beide Boni.

## 3. Deck

- Jederzeit im **Deck-Fenster** einsehbar.
- **Duplikate** sind erlaubt.
- **Upgrades** (Shop oder Treasure): **★1 → ★2 → ★3**, jede Stufe **+30 % Truppenzahl** und
  **+15 % DMG/HP**. Bei ★3 zusätzlich eine verstärkte Fähigkeit.

## 4. Rassen / Farben

| Farbe | Rasse | Rassenbonus |
|---|---|---|
| 🔴 Rot | **Ashclan** (Orks) | **Rage:** unter 50 % HP Schaden ×1,5 |
| 🟢 Grün | **Wildwood** (Elfen, Waldwesen) | **Regeneration:** 1 % HP pro Sekunde |
| 🔵 Blau | **Tidebound** (Meervolk) | **Tidal Wave:** zu Kampfbeginn werden alle Gegner zurückgedrängt |
| 🟡 Gold | **Sun Legion** (Menschen) | **Discipline:** +0,1 Rüstung pro lebender eigener Einheit (max. +5 *(Vorschlag)*) |
| 🟣 Violett | **Plague Court** (Untote) | **Undeath:** 20 % aller Gefallenen stehen als Zombies auf; Untote ignorieren Moral und Verlangsamung |
| ⚫ Grau | **Deepforge** (Zwerge) | **Iron Blood:** HP ×2 |
| ⚪ Farblos | **Drifters** (Söldner) | +5 % Werte für jede andere Farbe im Heer |

## 5. Klassen

| Klasse | Klassenbonus | Farben |
|---|---|---|
| **Infantry** | Truppenzahl ×1,5, HP ×1,5 | Rot, Blau, Gold, Grau, Violett, Farblos |
| **Archers** | Erste Salve wird doppelt geschossen | Grün, Violett, Farblos |
| **Cavalry** | Geschwindigkeit ×2, Ansturm | Rot, Grün, Grau |
| **Mage** | Beschwört zufällige Truppen vor dem Heer | Grün, Blau, Gold, Violett, Farblos |
| **Priest** | Beschwört 2 Riesen mit viel HP | Grün, Gold, Farblos |
| **Siege** | Baut eine starke Mauer | Rot, Gold, Violett, Grau |
| **Beast** | Geschwindigkeit, DMG und HP je ×1,5 | Grün, Blau, Violett |
| **Swarm** | Truppenzahl ×3 | Violett, Grün |
| **Champion** | DMG ×1,5 pro getötetem Champion | alle Farben |

## 6. Kartenaufbau

```
┌─────────────────────────────────┐
│ [Class icon]   CARD NAME    ×60 │  Klassensymbol, Name, Truppenzahl
│ ┌─────────────────────────────┐ │
│ │        Pixel-Art-Bild        │ │
│ └─────────────────────────────┘ │
│  Race · Class                   │
│  Ability text                   │
│ (⚔ DMG)                (❤ HP) │  DMG unten links, HP unten rechts
└─────────────────────────────────┘
```

- Rahmen in Rassenfarbe mit eigenem Muster.
- DMG auf rotem Schwert-Wappen (unten links), HP auf grünem Herz-Wappen (unten rechts).
- DMG und HP sind **Grundwerte pro Einheit, ohne Boni**.

### Rahmen

| Rasse | Rahmen |
|---|---|
| Ashclan | Rußschwarzes Eisen, glühende Nieten, Glutrisse an den Kanten |
| Wildwood | Lebendiges Holz mit Ranken, Blättern und einer Blüte oben mittig |
| Tidebound | Perlmutt mit Korallenästen und Muscheln in den Ecken, nasser Glanz |
| Sun Legion | Weißer Marmor, goldene Beschläge, Sonnenscheibe über dem Namen |
| Plague Court | Schwarzer Knochen, violetter Giftschleim tropft herab, Totenköpfe in den Ecken |
| Deepforge | Dunkler Stahl mit Nieten, Zahnräder in den Ecken, leuchtende Runen |
| Drifters | Helles, abgenutztes Pergament mit Lederecken und Nähten |

## 7. Karten (36)

### 🔴 Ashclan (4)

| Card | Class | Troops | DMG | HP | Ability |
|---|---|---|---|---|---|
| Ash Brute | Infantry | 150 | 14 | 20 | Burning Blade: Hits set the target on fire for 2 s. |
| Boar Riders | Cavalry | 60 | 18 | 26 | Charge: First hit deals triple damage and knocks the target back. |
| Fire Catapult | Siege | 4 | 40 | 60 | Hurls firepots that leave burning ground for 5 s. |
| Skullcrusher | Champion | 1 | 60 | 420 | Whirlwind: Every 4 s, spins and hurls all nearby enemies away. |

- **Ash Brute:** Breitschultriger grüngrauer Ork mit Hauern, gezacktem Hackbeil mit glühender Schneide, Fell-Lendenschurz. Brennende Zelte und Funken im Hintergrund.
- **Boar Riders:** Ork mit Knochenhelm auf riesigem Wildschwein mit eisenbeschlagenen Hauern, voller Galopp, Staub und Asche wirbeln auf.
- **Fire Catapult:** Grob genageltes Holzkatapult mit Schädel-Deko, brennender Tontopf in der Schaufel, zwei Goblins ziehen am Seil.
- **Skullcrusher:** Riesiger Orkhäuptling mit Schädeltrophäen und menschengroßer Zweihandaxt, Gegner fliegen durch die Luft.

### 🟢 Wildwood (7)

| Card | Class | Troops | DMG | HP | Ability |
|---|---|---|---|---|---|
| Thorn Archers | Archers | 120 | 9 | 12 | Thorned arrows slow the target by 25 % for 2 s. |
| Stag Knights | Cavalry | 40 | 16 | 28 | Leap: Jumps over the enemy front line and attacks the backline first. |
| Storm Caller | Mage | 12 | 22 | 14 | Chain Lightning: jumps between up to 5 enemies. |
| Moon Singer | Priest | 15 | 4 | 16 | Every 4 s, a wave of moonlight heals all allies in a large area. |
| Wolf Pack | Beast | 60 | 12 | 18 | Pack Hunter: +10 % damage for each wolf nearby (max +50 %). |
| Sporelings | Swarm | 400 | 4 | 5 | On death, releases a spore cloud that slows enemies. |
| Elder Treant | Champion | 1 | 35 | 600 | Root Grip: Every 6 s, roots all enemies in a large circle for 3 s. |

- **Thorn Archers:** Schlanke Elfe im Moosumhang, Bogen aus gebogenem Ast, Dorn als Pfeilspitze, kniet in hohem Farn.
- **Stag Knights:** Elfenritter mit Speer auf weißem Hirsch mit rankenumwickeltem Geweih, mitten im Sprung über ein Gebüsch.
- **Storm Caller:** Alter Druide mit Geweihkrone, Arme gen Himmel, dunkle Wolken, grüner Blitz aus der Hand.
- **Moon Singer:** Elfenpriesterin mit Silberhaar singt mit geschlossenen Augen vor großem Vollmond, blasse Lichtwellen.
- **Wolf Pack:** Drei graue Wölfe mit Moos im Fell heulen auf einem Felsen, grün leuchtende Augen.
- **Sporelings:** Dutzende Pilzwesen mit rot-weiß getupften Hüten auf dem Waldboden, einer platzt in gelber Sporenwolke.
- **Elder Treant:** Uralter Baumriese mit moosbedecktem Rindengesicht und Vögeln in der Krone, Wurzeln umschlingen Soldaten.

### 🔵 Tidebound (4)

| Card | Class | Troops | DMG | HP | Ability |
|---|---|---|---|---|---|
| Coral Guard | Infantry | 120 | 11 | 24 | Riposte: Every 3rd melee hit taken is countered for double damage. |
| Frost Sister | Mage | 15 | 16 | 12 | Frost Nova: freezes all enemies in a small area for 2 s. |
| Snapjaw Crabs | Beast | 40 | 14 | 30 | Grip: Holds its target in place until one of them dies. |
| Abyssal Kraken | Champion | 1 | 30 | 500 | Four tentacles attack four different targets at once. |

- **Coral Guard:** Schuppiger Krieger mit Flossenohren, Korallenrüstung, Schild aus Riesenmuschel, knietief in der Brandung.
- **Frost Sister:** Blasse Meerhexe mit Eiszapfen im Haar und Stab aus gefrorenem Wasser, das Meer friert in Ringen zu.
- **Snapjaw Crabs:** Hundegroße blaue Krabbe mit übergroßer Schere, die einen Speer zerbricht, Seepocken auf dem Panzer.
- **Abyssal Kraken:** Violett-blauer Riesenkrake mit großem gelbem Auge steigt aus einer Pfütze, Tentakel peitschen in alle Richtungen.

### 🟡 Sun Legion (5)

| Card | Class | Troops | DMG | HP | Ability |
|---|---|---|---|---|---|
| Legionnaires | Infantry | 200 | 10 | 18 | Shield Wall: Ranged damage from the front is halved. |
| Dawn Invoker | Mage | 12 | 20 | 12 | Sunbeam: A beam of light hits an entire line and blinds (30 % miss chance for 3 s). |
| Sun Priestess | Priest | 12 | 4 | 15 | Blessing: Places light shields on the front line (absorb 10 damage). |
| Trebuchet | Siege | 2 | 60 | 80 | Huge range and blast radius, but very slow to reload. |
| Lord Commander | Champion | 1 | 40 | 380 | Banner of the Sun: All allies +15 % damage. If he falls, allies lose morale. |

- **Legionnaires:** Reihe Soldaten in goldener Rüstung und rotem Umhang hinter Rechteckschilden mit Sonnensymbol, Speere über der Schildkante.
- **Dawn Invoker:** Magier in weiß-goldener Robe hält eine Sonnenscheibe hoch, gleißender Lichtstrahl quer durchs Bild.
- **Sun Priestess:** Priesterin mit goldener Strahlenkrone segnet kniende Soldaten, goldene Schildkuppeln entstehen.
- **Trebuchet:** Riesiges Holz-Trebuchet mit goldenen Wimpeln und Sonnenbanner, der Wurfarm schnellt hoch.
- **Lord Commander:** Feldherr in goldener Prunkrüstung auf weißem Schlachtross mit riesigem Sonnenbanner, Armee im Morgenlicht.

### 🟣 Plague Court (7)

| Card | Class | Troops | DMG | HP | Ability |
|---|---|---|---|---|---|
| Bloaters | Infantry | 60 | 6 | 22 | On death, explodes into a poison cloud. |
| Bone Archers | Archers | 100 | 7 | 10 | Poisoned arrows: 2 damage per second for 4 s, stacks. |
| Blight Witch | Mage | 12 | 14 | 12 | Throws a plague cloud that lingers and poisons everything inside. |
| Corpse Cart | Siege | 2 | 30 | 50 | Flings corpses that rise as zombies where they land. |
| Carrion Crows | Beast | 80 | 6 | 6 | Flying. Prefers wounded targets. |
| Zombie Horde | Swarm | 500 | 5 | 8 | Enemies killed by zombies rise as new zombies. |
| The Lich | Champion | 1 | 25 | 350 | Soul Harvest: +2 damage for every unit that dies on the battlefield. |

- **Bloaters:** Aufgedunsene Leichen mit grüngrauer Haut und genähten Bäuchen, violettes Gas quillt heraus, schlurfen mit ausgestreckten Armen.
- **Bone Archers:** Skelette in zerfetzten Kapuzen mit Bögen aus Rippenknochen, violett tropfende Pfeile, schiefe Grabsteine.
- **Blight Witch:** Buckelige Hexe mit Vogel-Pestmaske rührt im Kessel, violette Totenkopf-Wolke steigt auf.
- **Corpse Cart:** Leichenkarren mit Schleuderarm, gezogen von skelettiertem Pferd, ein Körper fliegt durch die Luft.
- **Carrion Crows:** Schwarm schwarzer Krähen mit violett glühenden Augen, Knochen unter fehlenden Federn.
- **Zombie Horde:** Endlose Zombiemasse in Bauernkleidung drängt über einen Hügel, vorne greift eine Hand aus der Erde.
- **The Lich:** Schwebendes Skelett in zerfetzter violetter Robe mit schwarzer Eisenkrone, grüne Seelenfäden fließen in seine Hand.

### ⚫ Deepforge (4)
Grund-HP sind bewusst niedriger, weil der Rassenbonus sie verdoppelt.

| Card | Class | Troops | DMG | HP | Ability |
|---|---|---|---|---|---|
| Ironbeards | Infantry | 100 | 12 | 11 | Armor 3: Every hit taken deals 3 less damage. |
| Bear Riders | Cavalry | 25 | 20 | 20 | Crushing Charge: stuns enemies hit by the charge for 1.5 s. |
| Mountain Cannon | Siege | 2 | 50 | 35 | Fires a straight shot that pierces through an entire line. |
| Steam Colossus | Champion | 1 | 45 | 250 | Trample: Rolls over enemies. Explodes on death, dealing massive area damage. |

- **Ironbeards:** Gedrungener Zwerg in schwerer Plattenrüstung, Bart in Eisenringen, Streithammer und Turmschild, glühende Schmiede dahinter.
- **Bear Riders:** Zwerg mit Axt auf gepanzertem Höhlenbären mit Runen-Rüstung, beide brüllen.
- **Mountain Cannon:** Schwere Bronzekanone mit Drachenkopf-Mündung auf Eisengestell, Zwerg mit Rußgesicht hält die Lunte an.
- **Steam Colossus:** Dampfende Kriegsmaschine auf Walzen mit Kessel im Rücken, Zwerg im Cockpit, Rammbock in Bärenkopf-Form.

### ⚪ Drifters (5)

| Card | Class | Troops | DMG | HP | Ability |
|---|---|---|---|---|---|
| Mercenary Company | Infantry | 150 | 12 | 18 | Paid in Advance: Earn gold after each battle for surviving troops. |
| Militia Bowmen | Archers | 150 | 6 | 8 | Volley: Fire all at once every 3 s. |
| Wandering Magus | Mage | 10 | 18 | 12 | Adapts: Uses the magic of your other card's color. |
| Field Chaplain | Priest | 10 | 4 | 14 | Heals nearby allies and gives your other card's troops +10 % damage. |
| Hired Giant | Champion | 1 | 45 | 450 | Taunt: All nearby enemies must attack the giant. |

- **Mercenary Company:** Bunt zusammengewürfelte Söldner mit gemischten Rüstungsteilen, einer zählt grinsend Münzen, Zelte dahinter.
- **Militia Bowmen:** Bauern mit einfachen Bögen und Strohhüten in einer Reihe auf dem Feld, Pfeilwolke verdunkelt den Himmel.
- **Wandering Magus:** Reisender mit geflicktem Spitzhut und Wanderstab voller bunter Kristalle in allen Rassenfarben.
- **Field Chaplain:** Wanderpriester mit Rucksack, Kräuterbündeln und Laterne verbindet einen Verwundeten, warmes Licht.
- **Hired Giant:** Gutmütiger Hügelriese in Flickenkleidung mit Baumstamm-Keule, Geldbeutel am Gürtel, Vertrag hinter dem Ohr.

## 8. Bosse

- Jeder Boss hat ein festes Deck aus **seiner Farbe + Drifters**. Normale Kämpfe einer Welt nutzen
  ebenfalls dieses Deck.
- **Bosskampf:** Der Boss steht selbst als **riesige Einheit** auf dem Feld und spielt zusätzlich
  **2 Karten** aus seinem Deck. Fällt der Boss, ist der Kampf gewonnen.
- Jeder Boss hat eine **passive Regel**.
- Nach dem Sieg: **1 Karte aus dem Boss-Deck** wählen.

### Tutorial-Boss

**Rusk, the Bandit King** · Drifters
- *Einheit:* ⚔ 30 | ❤ 1200. Ein hagerer Banditenanführer mit Augenklappe und Federhut, der auf
  einem Haufen gestohlener Kisten steht und einen rostigen Säbel schwingt.
- *Passiv – Cowardly:* Unter 25 % HP versucht er zu fliehen. Erreicht er den Feldrand, ist der
  Kampf trotzdem gewonnen, aber es gibt keine Boss-Karte als Belohnung.
- *Deck:* 3× Mercenary Company, 3× Militia Bowmen, Field Chaplain, Wandering Magus.
- *Tutorial-Route (5 Räume):* Battle (Grundlagen) → Battle (Bonus-Paare) → Shop → Battle → Treasure → Boss.

### Farb-Bosse (6)

**🔴 Gorrak Ashmaw, the Burning Warchief**
- *Einheit:* ⚔ 80 | ❤ 3000. Turmhoher Ork in glühender Rüstung mit brennender Kettenaxt, Flammenbanner.
- *Passiv – Scorched Earth:* Alle 8 s fängt eine zufällige Stelle des Feldes Feuer. Ashclan nimmt keinen Brandschaden.
- *Deck:* 2× Ash Brute, 2× Boar Riders, Fire Catapult, Skullcrusher, Mercenary Company, Militia Bowmen.

**🟢 Sylvara, Heart of the Forest**
- *Einheit:* ⚔ 50 | ❤ 2800. Riesige Dryade, halb Frau, halb Baum, Blütenkrone, Glühwürmchen.
- *Passiv – Overgrowth:* Mit der Zeit wachsen Dornenhecken, die alle Nicht-Wildwood-Einheiten verlangsamen und verletzen.
- *Deck:* 2× Thorn Archers, Wolf Pack, Sporelings, Moon Singer, Storm Caller, Elder Treant, Field Chaplain.

**🔵 Queen Nerissa of the Deep**
- *Einheit:* ⚔ 60 | ❤ 2600. Meereskönigin auf einem Korallenthron, getragen von einer Welle, Dreizack aus Eis.
- *Passiv – Rising Tide:* Alle 20 s drängt eine Flutwelle das Heer des Spielers zurück.
- *Deck:* 3× Coral Guard, 2× Snapjaw Crabs, Frost Sister, Abyssal Kraken, Wandering Magus.

**🟡 Emperor Aurelian**
- *Einheit:* ⚔ 60 | ❤ 3200. Kaiser in goldener Rüstung auf einem Streitwagen mit zwei weißen Löwen, Sonnenscheibe darüber.
- *Passiv – Endless Legion:* Alle 15 s marschieren 30 frische Legionnaires ins Feld.
- *Deck:* 2× Legionnaires, Sun Priestess, Dawn Invoker, Trebuchet, Lord Commander, Mercenary Company, Field Chaplain.

**🟣 Morvath the Undying**
- *Einheit:* ⚔ 40 | ❤ 2500. Knochendrache mit verrottenden Flügeln, auf dem Rücken ein Nekromant mit Seelenlaterne.
- *Passiv – Endless Dead:* **Alle** Gefallenen stehen als Zombies auf.
- *Deck:* 2× Zombie Horde, Bloaters, Bone Archers, Blight Witch, Carrion Crows, Corpse Cart, The Lich.

**⚫ Thane Borin Deephammer**
- *Einheit:* ⚔ 70 | ❤ 1800 (×2 = 3600). Zwergenkönig in mechanischer Dampfkolben-Rüstung mit ambossgroßem Hammer.
- *Passiv – Iron Bastion:* Sein Heer beginnt hinter einer Steinmauer mit zwei Kanonentürmen.
- *Deck:* 3× Ironbeards, 2× Bear Riders, Mountain Cannon, Steam Colossus, Hired Giant.

## 9. Offene Punkte

- Gold-Beträge pro Sternstufe, Shop-Preise, Upgrade-Kosten.
- Wie stark die erhöhte Ziehchance für Bonus-Paare ist.
- Obergrenze für Discipline (Sun Legion).
- Balancing aller Werte.

# Changelog

## 0.1.5

- Behoben: Der Wechsel von Paper/Purpur zu Fabric, Forge, NeoForge oder Vanilla scheiterte („Failed to load datapacks“). Blockhaus übernimmt jetzt Seed, Spielregeln und Wetter in das Format der neuen Software und entfernt das Paper-Datapack – die Welt bleibt dieselbe
- Neu: Mitteilung des Systems (macOS-Mitteilungszentrale, Windows, Linux), wenn Spieler joinen oder gehen – auch wenn das Fenster geschlossen ist. Ein-/ausschaltbar unter Einstellungen → Blockhaus, mit „Test-Mitteilung“
- Fixed: switching from Paper/Purpur to Fabric, Forge, NeoForge or Vanilla failed; the world (including its seed) is now carried over
- Behoben: Die Meldungen oben rechts im Blockhaus-Fenster (Spieler joint/geht, Erfolge) erschienen je nach Server-Software nicht – die Erkennung ist jetzt unabhängig von Log-Format, Farbcodes und Namensänderungen; das gilt auch für Chat und Verlauf
- New: system notifications when players join or leave
- Fixed: in-app player messages (top right) did not appear with some server software

## 0.1.4

- Behoben: Symbole in Knöpfen innerhalb von Hinweisen (z. B. „Jetzt installieren“) waren kaum zu erkennen
- Fixed: icons on buttons inside notices (e.g. “Install now”) were barely visible

## 0.1.3

- Neu: Beim Öffnen von Blockhaus erscheint ein Hinweis, wenn eine neue Version verfügbar ist – mit „Jetzt installieren“
- Behoben: Unter macOS hing das Stoppen des Servers bis zu 90 Sekunden in „Stoppt …“ (auch Neustarts dauerten dadurch so lange)
- Behoben: Nach einem Update zeigte das Fenster unter macOS teils noch die alte Oberfläche, bis man es neu öffnete
- Updates funktionieren jetzt auch, wenn das Abfrage-Limit von GitHub erreicht ist
- New: update notice when opening Blockhaus; fixed slow server stop on macOS and stale UI after updates

## 0.1.2

- Neue Status-Animation: Der Blockhaus-Block setzt sich beim Start zusammen und macht das Licht an, schwebt online und fällt beim Stoppen auseinander – ohne Minecraft-Texturen, sieht also sofort nach der Installation richtig aus
- Behoben: In den Einstellungen lief der Text der Karte „Blockhaus“ bei schmalen Fenstern über den Rand
- Behoben: Unter Linux startete Blockhaus nach einem Update oder „Panel neu starten“ teils nicht wieder
- New status animation; settings cards no longer overflow on narrow windows; Linux restart after updates fixed

## 0.1.1

- Behoben: Das Dashboard sprang bei laufendem Server ständig zwischen „Startet …“ und „Online“ (vor allem unter macOS)
- Updates: Neustart nach dem Update ist zuverlässiger, die Oberfläche lädt sich danach automatisch neu
- Fixed: the dashboard kept flipping between “Starting …” and “Online” while the server was running (mainly on macOS)

## 0.1.0

Erste Version von Blockhaus.

- Minecraft-Server erstellen (Vanilla, Fabric, Forge, NeoForge, Paper, Purpur) oder einen vorhandenen übernehmen
- Software und Version wechseln, Mods/Plugins von Modrinth, Backups, Zeitpläne, 3D-Karte, Diagnose
- Java wird automatisch geladen; RAM- und Speicherlimit; Autostart; Deutsch/Englisch; Einführung
- Installer für Windows, macOS und Linux; Updates mit einem Klick; vollständige Deinstallation

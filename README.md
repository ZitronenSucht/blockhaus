# Blockhaus

**Create and run your own Minecraft server – on Linux, macOS or Windows.**
*Deinen eigenen Minecraft-Server erstellen und verwalten – unter Linux, macOS oder Windows.*

> Work in progress. Blockhaus is not an official Minecraft product and is not approved by or associated with Mojang or Microsoft.

## What it does

- **Server software:** Vanilla, Fabric, Forge, NeoForge, Paper and Purpur – switch between them with automatic backups; mods/plugins are parked, migrated or updated to match.
- **Mods & plugins** from Modrinth: search, install with dependencies, one-click updates.
- **Java is handled for you:** the matching Eclipse Temurin runtime is downloaded automatically.
- Live console, players (inventory, stats, moderation), chat, history, 3D map (BlueMap), crash and lag diagnosis (spark), schedules, backups with restore (whole world or a single area), datapacks, resource packs, server list icon and MOTD.

## Run from source (development)

Requires Python 3.12+ (standard library only).

```bash
python3 -m blockhaus adduser NAME PASSWORD   # create an admin
python3 -m blockhaus                         # start; open http://127.0.0.1:8080
```

Data (config, users, server, backups, Java) lives in the system's app data folder
(`~/.local/share/blockhaus`, `~/Library/Application Support/Blockhaus`, `%APPDATA%\Blockhaus`)
or wherever `BLOCKHAUS_DATA` points.

## Roadmap

1. OS-independent core (process control, backups, metrics, Java download) – *done*
2. First-run setup wizard: create a server, choose RAM and storage limits – *done*
3. German / English – *done*
4. Guided introduction
5. Installers for Linux, macOS and Windows (terminal or desktop app), one-click updates, autostart, full uninstall

## Translations

German is the source language in the code. English lives in `blockhaus/static/i18n/en.json` (UI) and
`blockhaus/i18n_en.json` (server messages); keys are the German texts, `{0}`/`%s` are placeholders.
`python3 tools/extract_strings.py` lists texts that still need a translation (CI fails if any are missing).

## License

MIT – see [LICENSE](LICENSE).

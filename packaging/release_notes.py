#!/usr/bin/env python3
"""Text für ein GitHub-Release: Abschnitt aus CHANGELOG.md plus Installationshinweise."""
import os
import re
import sys

tag = sys.argv[1] if len(sys.argv) > 1 else "v0.0.0"
ver = tag.lstrip("v")
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
log = ""
try:
    text = open(os.path.join(root, "CHANGELOG.md"), encoding="utf-8").read()
    m = re.search(r"^## %s\b.*?\n(.*?)(?=^## |\Z)" % re.escape(ver), text, re.S | re.M)
    log = m.group(1).strip() if m else ""
except OSError:
    pass
print((log + "\n\n" if log else "") + """## Installieren / Install

- **Windows:** `Blockhaus-Setup-windows-x86_64.exe`
- **macOS:** `Blockhaus-macos-aarch64.dmg` (Apple Silicon) bzw. `Blockhaus-macos-x86_64.dmg` (Intel) – beim ersten Start Rechtsklick → Öffnen (die App ist noch nicht signiert)
- **Linux / Server:** `curl -fsSL https://github.com/ZitronenSucht/blockhaus/releases/latest/download/install.sh | sh`

Bereits installiert? Blockhaus meldet das Update selbst unter *Einstellungen → Blockhaus* – ein Klick genügt.
Installed already? Blockhaus offers the update under *Settings → Blockhaus* – one click is enough.""")

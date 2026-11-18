#!/bin/sh
# Blockhaus – Installation für Linux und macOS (Terminal).
#
#   curl -fsSL https://github.com/ZitronenSucht/blockhaus/releases/latest/download/install.sh | sh
#
# Optionen (auch ohne Rückfragen nutzbar):
#   --desktop | --server     Desktop-App (Fenster/Startmenü) oder Hintergrunddienst mit Bedienung im Browser
#   --autostart | --no-autostart
#   --lan | --local          Panel auch im Heimnetz erreichbar (für Server ohne Bildschirm) oder nur lokal
#   --dir PFAD               Installationsordner (Standard: ~/.local/share/blockhaus-app)
#   --version X.Y.Z          bestimmte Version statt der neuesten
#   --from DATEI             lokales Paket (blockhaus-<os>-<arch>.tar.gz) statt Download – z. B. für Tests
set -eu

REPO="ZitronenSucht/blockhaus"
MODE=""; AUTOSTART=""; LAN=""; VERSION="latest"; FROM=""; NOSTART=""
DEST="${BLOCKHAUS_HOME:-$HOME/.local/share/blockhaus-app}"

while [ $# -gt 0 ]; do
  case "$1" in
    --desktop) MODE=desktop ;; --server) MODE=server ;;
    --autostart) AUTOSTART=yes ;; --no-autostart) AUTOSTART=no ;;
    --lan) LAN=yes ;; --local) LAN=no ;;
    --dir) DEST="$2"; shift ;; --version) VERSION="$2"; shift ;; --from) FROM="$2"; shift ;;
    --no-start) NOSTART=yes ;;
    -h|--help) sed -n '2,14p' "$0"; exit 0 ;;
    *) echo "Unbekannte Option: $1" >&2; exit 2 ;;
  esac
  shift
done

say() { printf '%s\n' "$*"; }
ask() {  # ask "Frage" Standard(y/n) – liest vom Terminal, auch wenn das Skript per Pipe kommt
  q="$1"; def="$2"
  if [ -r /dev/tty ]; then
    printf '%s [%s] ' "$q" "$([ "$def" = y ] && echo 'J/n' || echo 'j/N')" > /dev/tty
    read -r a < /dev/tty || a=""
  else a=""; fi
  case "$a" in [jJyY]*) echo y ;; [nN]*) echo n ;; *) echo "$def" ;; esac
}

OS="$(uname -s)"; ARCH="$(uname -m)"
case "$OS" in Linux) os=linux ;; Darwin) os=macos ;; *) say "Nicht unterstützt: $OS (für Windows bitte den Installer nehmen)"; exit 1 ;; esac
case "$ARCH" in x86_64|amd64) arch=x86_64 ;; aarch64|arm64) arch=aarch64 ;; *) say "Nicht unterstützte CPU: $ARCH"; exit 1 ;; esac
PKG="blockhaus-$os-$arch.tar.gz"
if [ "$VERSION" = latest ]; then BASE="https://github.com/$REPO/releases/latest/download"
else BASE="https://github.com/$REPO/releases/download/v$VERSION"; fi

say ""
say "  ▣ Blockhaus – Minecraft-Server erstellen und verwalten"
say ""
if [ -z "$MODE" ]; then
  if [ "$os" = linux ] && [ -z "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]; then MODE=server
  elif [ "$(ask 'Als Desktop-App mit Eintrag im Startmenü installieren? (Nein = Server/Hintergrund)' y)" = y ]; then MODE=desktop
  else MODE=server; fi
fi
[ -n "$AUTOSTART" ] || AUTOSTART="$(ask 'Blockhaus beim Start des Rechners automatisch im Hintergrund starten?' "$([ "$MODE" = server ] && echo y || echo n)")"
[ -n "$LAN" ] || LAN="$(ask 'Panel auch von anderen Geräten im Heimnetz erreichbar machen?' "$([ "$MODE" = server ] && echo y || echo n)")"

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
if [ -n "$FROM" ]; then
  cp "$FROM" "$TMP/$PKG"
else
  say "→ Lade $PKG …"
  curl -fL --progress-bar -o "$TMP/$PKG" "$BASE/$PKG"
  curl -fsSL -o "$TMP/SHA256SUMS" "$BASE/SHA256SUMS"
  want="$(grep " \*\{0,1\}$PKG\$" "$TMP/SHA256SUMS" | awk '{print $1}')"
  if command -v sha256sum >/dev/null 2>&1; then have="$(sha256sum "$TMP/$PKG" | awk '{print $1}')"
  else have="$(shasum -a 256 "$TMP/$PKG" | awk '{print $1}')"; fi
  [ -n "$want" ] && [ "$want" = "$have" ] || { say "Prüfsumme stimmt nicht – Abbruch."; exit 1; }
fi

say "→ Installiere nach $DEST …"
mkdir -p "$DEST"
tar -xzf "$TMP/$PKG" -C "$TMP"
# Programm ersetzen, Daten (liegen woanders) bleiben unberührt
rm -rf "$DEST/runtime" "$DEST/app"
cp -R "$TMP/blockhaus/." "$DEST/"
printf '{"mode": "%s", "platform": "%s-%s"}\n' "$([ "$MODE" = desktop ] && echo gui || echo terminal)" "$os" "$arch" > "$DEST/install.json"

BIN="$HOME/.local/bin"; mkdir -p "$BIN"
cat > "$BIN/blockhaus" <<EOF
#!/bin/sh
exec "$DEST/runtime/bin/python3" "$DEST/launch.py" "\$@"
EOF
chmod +x "$BIN/blockhaus"
if [ "$os" = macos ] && [ -x /usr/bin/xattr ]; then xattr -dr com.apple.quarantine "$DEST" 2>/dev/null || true; fi

if [ "$LAN" = y ]; then
  DATA_DIR="$("$DEST/runtime/bin/python3" -c 'import sys; sys.path.insert(0, sys.argv[1]); from blockhaus import osutil; print(osutil.app_data_dir())' "$DEST/app/$(cat "$DEST/app/current")")"
  mkdir -p "$DATA_DIR"
  "$DEST/runtime/bin/python3" -c '
import json, os, sys
p = os.path.join(sys.argv[1], "config.json")
c = json.load(open(p)) if os.path.isfile(p) else {}
c["listen_host"] = "0.0.0.0"
json.dump(c, open(p, "w"), indent=2)' "$DATA_DIR"
fi

if [ "$MODE" = desktop ] && [ "$os" = linux ]; then
  APPS="$HOME/.local/share/applications"; mkdir -p "$APPS"
  cat > "$APPS/blockhaus.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Blockhaus
Comment=Minecraft-Server erstellen und verwalten
Exec=$BIN/blockhaus --gui
Icon=$DEST/icons/blockhaus.png
Categories=Game;Utility;
Terminal=false
StartupWMClass=Blockhaus
EOF
fi

if [ "$AUTOSTART" = y ]; then "$BIN/blockhaus" autostart on >/dev/null && say "→ Autostart eingerichtet"; fi

# Jetzt starten
if [ -n "$NOSTART" ]; then :
elif [ "$AUTOSTART" = y ] && [ "$os" = linux ] && command -v systemctl >/dev/null 2>&1; then
  systemctl --user restart blockhaus 2>/dev/null || ("$BIN/blockhaus" --background >/dev/null 2>&1 &)
else
  nohup "$BIN/blockhaus" --background >/dev/null 2>&1 &
fi
sleep 3

IP="$("$DEST/runtime/bin/python3" -c 'import socket; s=socket.socket(2,2); s.connect(("192.0.2.1",9)); print(s.getsockname()[0])' 2>/dev/null || echo localhost)"
say ""
say "✔ Blockhaus ist installiert."
if [ "$MODE" = desktop ]; then
  say "  Starte es über das Startmenü/Launchpad oder mit:  blockhaus --gui"
else
  say "  Öffne im Browser:  http://localhost:8080"
  [ "$LAN" = y ] && say "  Von anderen Geräten:  http://$IP:8080   (Einrichtungs-Code:  blockhaus setup-code)"
fi
case ":$PATH:" in *":$BIN:"*) ;; *) say "  Hinweis: $BIN ist nicht im PATH – ggf. neu anmelden oder  export PATH=\"\$PATH:$BIN\"" ;; esac
say "  Deinstallieren:  blockhaus uninstall"
say ""

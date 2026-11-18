"""Installation, Autostart, Updates und Deinstallation von Blockhaus.

Aufbau einer Installation (BLOCKHAUS_HOME, vom Starter gesetzt):
    runtime/            portables Python (python-build-standalone)
    app/<version>/      der Blockhaus-Code (dieses Paket); app/current enthält die aktive Version
    launch.py           Starter: liest app/current und startet „python -m blockhaus …“
    install.json        Art der Installation (gui | terminal), Plattform

Updates tauschen nur app/<version> aus – das portable Python bleibt. Ohne BLOCKHAUS_HOME (aus dem
Quellcode gestartet) sind Updates und Deinstallation des Programms nicht verfügbar.
"""
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
import zipfile

from . import osutil

REPO = "ZitronenSucht/blockhaus"
RELEASES = "https://api.github.com/repos/%s/releases" % REPO
APP_ASSET = "blockhaus-app-%s.zip"
SUMS_ASSET = "SHA256SUMS"
UA = "blockhaus-updater"


# ───────────────────────── Installation ─────────────────────────

def home():
    h = os.environ.get("BLOCKHAUS_HOME")
    return os.path.abspath(h) if h and os.path.isdir(h) else None


def install_info():
    h = home()
    info = {"installed": bool(h), "home": h, "mode": None, "platform": sys.platform}
    if h:
        try:
            with open(os.path.join(h, "install.json"), encoding="utf-8") as f:
                info.update(json.load(f))
        except (OSError, ValueError):
            pass
    return info


def python_exe(gui=False):
    """Python des portablen Laufzeitsystems (unter Windows pythonw für Starts ohne Konsolenfenster)."""
    h = home()
    if not h:
        return sys.executable
    if osutil.IS_WIN:
        exe = os.path.join(h, "runtime", "pythonw.exe" if gui else "python.exe")
    else:
        exe = os.path.join(h, "runtime", "bin", "python3")
    return exe if os.path.isfile(exe) else sys.executable


def launch_cmd(*args, gui=False):
    """Befehl, mit dem Blockhaus neu gestartet werden kann (installiert oder aus dem Quellcode)."""
    h = home()
    if h and os.path.isfile(os.path.join(h, "launch.py")):
        return [python_exe(gui), os.path.join(h, "launch.py")] + list(args)
    return [sys.executable, "-m", "blockhaus"] + list(args)


# ───────────────────────── Autostart beim Systemstart ─────────────────────────
# Gestartet wird immer der Hintergrunddienst (ohne Fenster); das Fenster verbindet sich später damit.

LINUX_UNIT = os.path.expanduser("~/.config/systemd/user/blockhaus.service")
MAC_PLIST = os.path.expanduser("~/Library/LaunchAgents/de.blockhaus.server.plist")
WIN_RUN_KEY = r"Software\Microsoft\Windows\CurrentVersion\Run"
WIN_RUN_NAME = "Blockhaus"


def autostart_status():
    try:
        if osutil.IS_WIN:
            import winreg
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, WIN_RUN_KEY) as k:
                winreg.QueryValueEx(k, WIN_RUN_NAME)
            return True
        if osutil.IS_MAC:
            return os.path.isfile(MAC_PLIST)
        if not os.path.isfile(LINUX_UNIT):
            return False
        r = subprocess.run(["systemctl", "--user", "is-enabled", "blockhaus"], capture_output=True, text=True, timeout=10)
        return r.stdout.strip() == "enabled"
    except (OSError, subprocess.TimeoutExpired):
        return False


def _quote_win(a):
    return '"%s"' % a if " " in a and not a.startswith('"') else a


def set_autostart(on):
    """Blockhaus beim Anmelden bzw. Hochfahren im Hintergrund starten (ohne Admin-Rechte)."""
    cmd = launch_cmd("--background", gui=True)
    if osutil.IS_WIN:
        import winreg
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, WIN_RUN_KEY) as k:
            if on:
                winreg.SetValueEx(k, WIN_RUN_NAME, 0, winreg.REG_SZ, " ".join(_quote_win(a) for a in cmd))
            else:
                try:
                    winreg.DeleteValue(k, WIN_RUN_NAME)
                except FileNotFoundError:
                    pass
        return autostart_status()
    if osutil.IS_MAC:
        if on:
            os.makedirs(os.path.dirname(MAC_PLIST), exist_ok=True)
            args = "".join("<string>%s</string>" % _xml(a) for a in cmd)
            env = "".join("<key>%s</key><string>%s</string>" % (k, _xml(os.environ[k]))
                          for k in ("BLOCKHAUS_HOME", "BLOCKHAUS_DATA") if os.environ.get(k))
            with open(MAC_PLIST, "w", encoding="utf-8") as f:
                f.write('<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" '
                        '"http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>'
                        "<key>Label</key><string>de.blockhaus.server</string>"
                        "<key>ProgramArguments</key><array>%s</array>"
                        "<key>EnvironmentVariables</key><dict>%s</dict>"
                        "<key>RunAtLoad</key><true/><key>ProcessType</key><string>Background</string>"
                        "</dict></plist>\n" % (args, env))
        else:
            subprocess.run(["launchctl", "unload", MAC_PLIST], capture_output=True, timeout=10)
            _rm(MAC_PLIST)
        return autostart_status()
    # Linux: systemd-User-Dienst; „linger“ startet ihn schon beim Hochfahren (ohne Anmeldung)
    if on:
        os.makedirs(os.path.dirname(LINUX_UNIT), exist_ok=True)
        env = "".join('Environment="%s=%s"\n' % (k, os.environ[k])
                      for k in ("BLOCKHAUS_HOME", "BLOCKHAUS_DATA") if os.environ.get(k))
        env += 'Environment="BLOCKHAUS_SERVICE=systemd"\n'  # damit Blockhaus weiß: systemd startet es neu
        with open(LINUX_UNIT, "w", encoding="utf-8") as f:
            f.write("[Unit]\nDescription=Blockhaus – Minecraft-Server-Tool\nAfter=network-online.target\n\n"
                    "[Service]\n%sExecStart=%s\nRestart=on-failure\nRestartSec=5\n"
                    "# Der Minecraft-Server läuft weiter, wenn Blockhaus (z. B. für ein Update) neu startet\n"
                    "KillMode=process\n\n[Install]\nWantedBy=default.target\n"
                    % (env, " ".join(_quote_sh(a) for a in cmd)))
        subprocess.run(["systemctl", "--user", "daemon-reload"], capture_output=True, timeout=20)
        subprocess.run(["systemctl", "--user", "enable", "blockhaus"], capture_output=True, timeout=20)
        subprocess.run(["loginctl", "enable-linger"], capture_output=True, timeout=20)
    else:
        subprocess.run(["systemctl", "--user", "disable", "blockhaus"], capture_output=True, timeout=20)
        _rm(LINUX_UNIT)
        subprocess.run(["systemctl", "--user", "daemon-reload"], capture_output=True, timeout=20)
    return autostart_status()


def _xml(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _quote_sh(a):
    return "'%s'" % a.replace("'", "'\\''") if any(c in a for c in " '\"$\\") else a


def _rm(p):
    try:
        os.remove(p)
    except OSError:
        pass


# ───────────────────────── Updates (GitHub Releases) ─────────────────────────

def _get(url, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/vnd.github+json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def ver_tuple(v):
    out = []
    for p in str(v).lstrip("v").split("."):
        num = "".join(c for c in p if c.isdigit())
        out.append(int(num) if num else 0)
    return tuple(out + [0] * (3 - len(out)))


def latest_release(include_pre=False):
    rels = json.loads(_get(RELEASES + "?per_page=10"))
    for r in rels:
        if r.get("draft") or (r.get("prerelease") and not include_pre):
            continue
        ver = r["tag_name"].lstrip("v")
        assets = {a["name"]: a["browser_download_url"] for a in r.get("assets", [])}
        return {"version": ver, "notes": r.get("body") or "", "url": r.get("html_url"),
                "published": r.get("published_at"), "app": assets.get(APP_ASSET % ver), "sums": assets.get(SUMS_ASSET)}
    return None


def check_update(current):
    rel = latest_release()
    if not rel:
        return {"current": current, "available": False}
    return dict(rel, current=current, available=ver_tuple(rel["version"]) > ver_tuple(current) and bool(rel["app"]))


def apply_update(rel, progress=lambda m: None):
    """Lädt den neuen App-Ordner, prüft die Prüfsumme, entpackt nach app/<version> und stellt app/current um.
    Der Neustart passiert danach durch den Aufrufer."""
    h = home()
    if not h:
        raise RuntimeError("Updates gibt es nur für installierte Versionen (nicht beim Start aus dem Quellcode)")
    if not rel.get("app") or not rel.get("sums"):
        raise RuntimeError("Das Release enthält keine App-Datei")
    name = APP_ASSET % rel["version"]
    sums = {}
    for line in _get(rel["sums"]).decode().splitlines():
        parts = line.split()
        if len(parts) == 2:
            sums[parts[1].lstrip("*")] = parts[0].lower()
    if name not in sums:
        raise RuntimeError("Prüfsumme für %s fehlt" % name)
    progress("lade Blockhaus %s …" % rel["version"])
    data = _get(rel["app"], timeout=120)
    if hashlib.sha256(data).hexdigest() != sums[name]:
        raise RuntimeError("Prüfsumme stimmt nicht – Update verworfen")
    progress("installiere Blockhaus %s …" % rel["version"])
    apps = os.path.join(h, "app")
    dest = os.path.join(apps, rel["version"])
    work = dest + ".part"
    shutil.rmtree(work, ignore_errors=True)
    os.makedirs(work)
    tmp = os.path.join(work, "app.zip")
    with open(tmp, "wb") as f:
        f.write(data)
    with zipfile.ZipFile(tmp) as z:
        base = os.path.realpath(work)
        for n in z.namelist():
            t = os.path.realpath(os.path.join(work, n))
            if not (t == base or t.startswith(base + os.sep)):
                raise RuntimeError("Unsicherer Pfad im Update: %s" % n)
        z.extractall(work)
    os.remove(tmp)
    if not os.path.isfile(os.path.join(work, "blockhaus", "app.py")):
        raise RuntimeError("Update-Paket ist unvollständig")
    shutil.rmtree(dest, ignore_errors=True)
    os.replace(work, dest)
    previous = current_app_version()
    _write(os.path.join(apps, "current"), rel["version"])
    if previous and previous != rel["version"]:
        _write(os.path.join(apps, "previous"), previous)
    # alte Versionen aufräumen (aktuelle und vorherige bleiben für ein Zurückrollen)
    keep = {rel["version"], previous}
    for n in os.listdir(apps):
        p = os.path.join(apps, n)
        if os.path.isdir(p) and n not in keep:
            shutil.rmtree(p, ignore_errors=True)
    return rel["version"]


def current_app_version():
    h = home()
    try:
        with open(os.path.join(h, "app", "current"), encoding="utf-8") as f:
            return f.read().strip()
    except (OSError, TypeError):
        return None


def _write(p, text):
    with open(p + ".tmp", "w", encoding="utf-8") as f:
        f.write(text)
    os.replace(p + ".tmp", p)


def restart_detached(*args, gui=False):
    """Startet Blockhaus neu als eigenen Prozess (für Updates); der aufrufende Prozess beendet sich danach."""
    kw = {"creationflags": 0x00000008 | 0x00000200} if osutil.IS_WIN else {"start_new_session": True}
    subprocess.Popen(launch_cmd(*args, gui=gui), stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                     stderr=subprocess.DEVNULL, close_fds=True, **kw)


# ───────────────────────── Deinstallation ─────────────────────────

def uninstall(data_dir, keep_worlds=True, server_dir=None, backup_dir=None, log=print, remove_program=True):
    """Entfernt Autostart, Daten und (bei installierten Versionen) das Programm.
    keep_worlds: Server-Ordner (mit Welt) und Backups werden nach ~/Blockhaus-Sicherung verschoben."""
    report = []
    try:
        if autostart_status():
            set_autostart(False)
            report.append("Autostart entfernt")
    except Exception as e:  # weitermachen – Rest trotzdem entfernen
        report.append("Autostart: %s" % e)
    if keep_worlds:
        target = os.path.join(os.path.expanduser("~"), "Blockhaus-Sicherung-%s" % time.strftime("%Y-%m-%d"))
        os.makedirs(target, exist_ok=True)
        for src, name in ((server_dir, "server"), (backup_dir, "backups")):
            if src and os.path.isdir(src):
                dst = os.path.join(target, name)
                if os.path.exists(dst):
                    dst += "-" + time.strftime("%H%M%S")
                shutil.move(src, dst)
                report.append("%s gesichert nach %s" % (name, dst))
    for d in {data_dir, server_dir, backup_dir} - {None}:
        if os.path.isdir(d):
            shutil.rmtree(d, ignore_errors=True)
            report.append("gelöscht: %s" % d)
    h = home()
    if h and remove_program:
        _remove_program(h)
        report.append("Programm entfernt: %s" % h)
    for line in report:
        log(line)
    return report


def _remove_program(h):
    """Programmordner löschen. Unter Windows sind laufende Dateien gesperrt – dort erledigt das ein kleines
    Skript, nachdem sich Blockhaus beendet hat."""
    shortcuts = []
    if osutil.IS_WIN:
        appdata = os.environ.get("APPDATA", "")
        shortcuts = [os.path.join(appdata, r"Microsoft\Windows\Start Menu\Programs\Blockhaus.lnk"),
                     os.path.join(os.path.expanduser("~"), "Desktop", "Blockhaus.lnk")]
        script = os.path.join(tempfile.gettempdir(), "blockhaus-uninstall.cmd")
        with open(script, "w", encoding="utf-8") as f:
            f.write('@echo off\r\nping -n 4 127.0.0.1 > nul\r\nrmdir /s /q "%s"\r\n' % h +
                    "".join('del /q "%s"\r\n' % s for s in shortcuts) + 'del "%~f0"\r\n')
        subprocess.Popen(["cmd", "/c", script], creationflags=0x08000000 | 0x00000008, close_fds=True)
        return
    wrapper = os.path.expanduser("~/.local/bin/blockhaus")  # von install.sh (Linux und macOS)
    try:
        with open(wrapper, encoding="utf-8") as f:
            if h in f.read():
                _rm(wrapper)
    except OSError:
        pass
    if osutil.IS_LINUX:
        _rm(os.path.expanduser("~/.local/share/applications/blockhaus.desktop"))
    if osutil.IS_MAC:  # von install.sh angelegte App
        app = os.path.expanduser("~/Applications/Blockhaus.app")
        try:
            with open(os.path.join(app, "Contents", "MacOS", "Blockhaus"), encoding="utf-8") as f:
                if h in f.read():
                    shutil.rmtree(app, ignore_errors=True)
        except OSError:
            pass
    # macOS: h liegt in Blockhaus.app/Contents/Resources – das ganze App-Paket entfernen
    root = h
    if osutil.IS_MAC and h.endswith(os.path.join("Contents", "Resources")):
        root = os.path.dirname(os.path.dirname(h))
    shutil.rmtree(root, ignore_errors=True)

#!/usr/bin/env python3
"""Baut die Blockhaus-Pakete für die aktuelle Plattform (läuft in GitHub Actions, geht aber auch lokal).

  python3 packaging/build.py app            # dist/blockhaus-app-<version>.zip  (plattformunabhängig)
  python3 packaging/build.py portable       # dist/blockhaus-<os>-<arch>.tar.gz/.zip: Python + App + Starter
  python3 packaging/build.py macapp         # zusätzlich dist/Blockhaus-<arch>.dmg (nur auf macOS)

Aufbau eines portablen Pakets (= Installationsordner):
  runtime/  launch.py  app/current  app/<version>/blockhaus/…  icons/  install.json
"""
import hashlib
import json
import os
import platform
import re
import shutil
import subprocess
import sys
import tarfile
import urllib.request
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist")
BUILD = os.path.join(ROOT, "build")
PY_SERIES = "3.12"
PBS = "https://api.github.com/repos/astral-sh/python-build-standalone/releases"


def version():
    src = open(os.path.join(ROOT, "blockhaus", "app.py"), encoding="utf-8").read()
    return re.search(r'^VERSION = "([^"]+)"', src, re.M).group(1)


def plat():
    os_name = {"win32": "windows", "darwin": "macos"}.get(sys.platform, "linux")
    m = platform.machine().lower()
    arch = {"amd64": "x86_64", "x64": "x86_64", "arm64": "aarch64"}.get(m, m)
    return os_name, arch


def get(url, dest=None):
    headers = {"User-Agent": "blockhaus-build"}
    if os.environ.get("GITHUB_TOKEN") and "api.github.com" in url:
        headers["Authorization"] = "Bearer " + os.environ["GITHUB_TOKEN"]
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=300) as r:
        if dest is None:
            return r.read()
        with open(dest, "wb") as f:
            shutil.copyfileobj(r, f)
    return dest


def build_app():
    """Nur der Blockhaus-Code – das, was ein Update austauscht."""
    ver = version()
    os.makedirs(DIST, exist_ok=True)
    out = os.path.join(DIST, "blockhaus-app-%s.zip" % ver)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for d, dirs, files in os.walk(os.path.join(ROOT, "blockhaus")):
            dirs[:] = [x for x in dirs if x != "__pycache__"]
            for fn in files:
                if fn.endswith(".pyc"):
                    continue
                p = os.path.join(d, fn)
                z.write(p, os.path.relpath(p, ROOT))
    print("App-Paket:", out)
    return out


def fetch_python(dest):
    """Portables CPython von python-build-standalone (install_only-Variante)."""
    os_name, arch = plat()
    triple = {("linux", "x86_64"): "x86_64-unknown-linux-gnu", ("linux", "aarch64"): "aarch64-unknown-linux-gnu",
              ("macos", "x86_64"): "x86_64-apple-darwin", ("macos", "aarch64"): "aarch64-apple-darwin",
              ("windows", "x86_64"): "x86_64-pc-windows-msvc"}[(os_name, arch)]
    pat = re.compile(r"^cpython-%s\.\d+\+\d+-%s-install_only\.tar\.gz$" % (re.escape(PY_SERIES), re.escape(triple)))
    for rel in json.loads(get(PBS + "?per_page=5")):
        assets = {a["name"]: a["browser_download_url"] for a in rel["assets"]}
        name = next((n for n in assets if pat.match(n)), None)
        if name:
            break
    else:
        raise SystemExit("Kein passendes Python für %s gefunden" % triple)
    sums = get(assets["SHA256SUMS"]).decode() if "SHA256SUMS" in assets else ""
    want = next((l.split()[0] for l in sums.splitlines() if l.strip().endswith(name)), None)
    os.makedirs(BUILD, exist_ok=True)
    arc = get(assets[name], os.path.join(BUILD, name))
    if want and hashlib.sha256(open(arc, "rb").read()).hexdigest() != want:
        raise SystemExit("Prüfsumme des Python-Pakets stimmt nicht")
    print("Python:", name)
    tmp = os.path.join(BUILD, "py-extract")
    shutil.rmtree(tmp, ignore_errors=True)
    with tarfile.open(arc) as t:
        t.extractall(tmp, filter="data")
    shutil.rmtree(dest, ignore_errors=True)
    os.replace(os.path.join(tmp, "python"), dest)
    return dest


def runtime_python(rt):
    return os.path.join(rt, "python.exe") if sys.platform == "win32" else os.path.join(rt, "bin", "python3")


def build_portable(home=None):
    ver = version()
    os_name, arch = plat()
    home = home or os.path.join(BUILD, "blockhaus")
    shutil.rmtree(home, ignore_errors=True)
    os.makedirs(os.path.join(home, "app", ver))
    rt = fetch_python(os.path.join(home, "runtime"))
    py = runtime_python(rt)
    if os_name in ("windows", "macos"):  # eigenes Fenster über pywebview
        subprocess.check_call([py, "-m", "pip", "install", "--no-warn-script-location", "--disable-pip-version-check",
                               "pywebview>=5,<7"])
    # Testdateien, Header u. Ä. aus dem Laufzeitsystem entfernen (spart Platz)
    lib = os.path.join(rt, "Lib" if os_name == "windows" else "lib")
    for d, dirs, files in os.walk(lib):
        for x in list(dirs):
            if x in ("test", "tests", "idle_test", "__pycache__") or x.startswith(("tkinter", "idlelib", "turtledemo")):
                shutil.rmtree(os.path.join(d, x), ignore_errors=True)
                dirs.remove(x)
    shutil.rmtree(os.path.join(rt, "include"), ignore_errors=True)
    shutil.copytree(os.path.join(ROOT, "blockhaus"), os.path.join(home, "app", ver, "blockhaus"),
                    ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
    with open(os.path.join(home, "app", "current"), "w") as f:
        f.write(ver)
    shutil.copy(os.path.join(ROOT, "packaging", "launch.py"), home)
    subprocess.check_call([sys.executable, os.path.join(ROOT, "packaging", "icons.py"), os.path.join(home, "icons")])
    with open(os.path.join(home, "install.json"), "w") as f:
        json.dump({"version": ver, "platform": "%s-%s" % (os_name, arch), "mode": "gui"}, f)
    # Rauchtest: das gepackte Python startet Blockhaus
    out = subprocess.run([py, os.path.join(home, "launch.py"), "version"], capture_output=True, text=True,
                         env=dict(os.environ, BLOCKHAUS_DATA=os.path.join(BUILD, "smoke-data")))
    print(out.stdout.strip(), out.stderr.strip())
    if "Blockhaus %s" % ver not in out.stdout:
        raise SystemExit("Rauchtest fehlgeschlagen")
    os.makedirs(DIST, exist_ok=True)
    base = os.path.join(DIST, "blockhaus-%s-%s" % (os_name, arch))
    if os_name == "windows":
        shutil.make_archive(base, "zip", os.path.dirname(home), os.path.basename(home))
        out = base + ".zip"
    else:
        with tarfile.open(base + ".tar.gz", "w:gz") as t:
            t.add(home, arcname="blockhaus")
        out = base + ".tar.gz"
    print("Portables Paket:", out)
    return home


def build_macapp():
    """Blockhaus.app (Fenster im Dock) als .dmg."""
    ver = version()
    _, arch = plat()
    app = os.path.join(BUILD, "Blockhaus.app")
    shutil.rmtree(app, ignore_errors=True)
    res = os.path.join(app, "Contents", "Resources")
    os.makedirs(os.path.join(app, "Contents", "MacOS"))
    build_portable(res)
    shutil.copy(os.path.join(res, "icons", "blockhaus.icns"), os.path.join(res, "blockhaus.icns"))
    exe = os.path.join(app, "Contents", "MacOS", "Blockhaus")
    with open(exe, "w") as f:
        f.write('#!/bin/sh\nRES="$(cd "$(dirname "$0")/../Resources" && pwd)"\n'
                'exec "$RES/runtime/bin/python3" "$RES/launch.py" --gui "$@"\n')
    os.chmod(exe, 0o755)
    with open(os.path.join(app, "Contents", "Info.plist"), "w") as f:
        f.write("""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleName</key><string>Blockhaus</string>
<key>CFBundleDisplayName</key><string>Blockhaus</string>
<key>CFBundleIdentifier</key><string>de.blockhaus.app</string>
<key>CFBundleVersion</key><string>%s</string>
<key>CFBundleShortVersionString</key><string>%s</string>
<key>CFBundleExecutable</key><string>Blockhaus</string>
<key>CFBundleIconFile</key><string>blockhaus.icns</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>LSMinimumSystemVersion</key><string>11.0</string>
<key>NSHighResolutionCapable</key><true/>
</dict></plist>
""" % (ver, ver))
    # Ad-hoc-Signatur: ohne sie meldet macOS auf Apple-Chips „App ist beschädigt“. (Für eine Prüfung durch
    # Apple bräuchte es ein Developer-ID-Zertifikat und Notarisierung.)
    subprocess.check_call(["codesign", "--force", "--deep", "--sign", "-", app])
    stage = os.path.join(BUILD, "dmg")
    shutil.rmtree(stage, ignore_errors=True)
    os.makedirs(stage)
    subprocess.check_call(["cp", "-R", app, stage])
    os.symlink("/Applications", os.path.join(stage, "Programme (Applications)"))
    os.makedirs(DIST, exist_ok=True)
    dmg = os.path.join(DIST, "Blockhaus-macos-%s.dmg" % arch)
    if os.path.exists(dmg):
        os.remove(dmg)
    subprocess.check_call(["hdiutil", "create", "-volname", "Blockhaus", "-srcfolder", stage, "-ov",
                           "-format", "UDZO", dmg])
    print("macOS-App:", dmg)


if __name__ == "__main__":
    what = sys.argv[1] if len(sys.argv) > 1 else "portable"
    {"app": build_app, "portable": build_portable, "macapp": build_macapp}[what]()

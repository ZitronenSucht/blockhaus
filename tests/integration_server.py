#!/usr/bin/env python3
"""Integrationstest mit einem echten Minecraft-Server (läuft in GitHub Actions, lädt Java + Server).

  python tests/integration_server.py [paper|vanilla|fabric|…] [Sekunden]

Startet Blockhaus in einem Testordner, richtet einen Admin ein, erstellt über den Assistenten-Endpunkt einen
Server, startet ihn und beobachtet die Live-Statusdaten (wie das Dashboard sie bekommt). Schlägt fehl,
wenn der Server nicht online kommt oder der Status danach zwischen „startet“ und „online“ springt.
"""
import http.cookiejar
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOADER = sys.argv[1] if len(sys.argv) > 1 else "paper"
WATCH = int(sys.argv[2]) if len(sys.argv) > 2 else 120


def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


data = tempfile.mkdtemp(prefix="bh-int-")
port = free_port()
base = "http://127.0.0.1:%d" % port
env = dict(os.environ, BLOCKHAUS_DATA=data, BLOCKHAUS_PORT=str(port))
proc = subprocess.Popen([sys.executable, "-m", "blockhaus"], cwd=ROOT, env=env,
                        stdout=open(os.path.join(data, "panel.out"), "w"), stderr=subprocess.STDOUT)
jar = http.cookiejar.CookieJar()
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
csrf = ""


def call(path, body=None, timeout=60):
    req = urllib.request.Request(base + path, data=None if body is None else json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json", "X-CSRF": csrf})
    with op.open(req, timeout=timeout) as r:
        return json.loads(r.read() or b"{}")


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


ok = False
try:
    for _ in range(60):
        try:
            call("/api/setup/status")
            break
        except OSError:
            time.sleep(0.5)
    call("/api/setup/admin", {"user": "admin", "password": "geheim12345"})
    csrf = call("/api/me")["csrf"]
    games = call("/api/update/versions?loader=%s" % LOADER)["games"]
    mc = games[0]
    b = call("/api/update/builds?loader=%s&mc=%s" % (LOADER, mc))
    lv = b.get("recommended") or (b.get("builds") or [""])[0]
    log("Erstelle", LOADER, mc, lv)
    info = call("/api/server/create/info")
    call("/api/server/create", {"mode": "new", "loader": LOADER, "mc": mc, "loaderVersion": lv, "eula": True,
                                "start": True, "port": info["port"], "settings": {"ram_max_mb": 2048}})
    # Live-Status wie im Dashboard über Server-Sent Events mitlesen
    req = urllib.request.Request(base + "/api/events", headers={"Accept": "text/event-stream"})
    stream = op.open(req, timeout=600)
    seq, online_since, event = [], None, None
    end = time.time() + 600
    while time.time() < end:
        line = stream.readline().decode("utf-8", "replace").strip()
        if line.startswith("event:"):
            event = line[6:].strip()
        elif line.startswith("data:") and event in ("stats", "init"):
            d = json.loads(line[5:])
            st = d.get("stats", d) if event == "init" else d
            if not st:
                continue
            state = "%s/%s" % (st.get("state"), "ready" if st.get("ready") else "notready")
            if not seq or seq[-1][1] != state:
                seq.append((time.time(), state))
                log("Status:", state, ("RCON-Fehler: %s" % st.get("rconError")) if st.get("rconError") else "")
            if state == "active/ready" and online_since is None:
                online_since = time.time()
                log("online – beobachte %d s weiter …" % WATCH)
            if online_since and time.time() - online_since > WATCH:
                break
    flips = [s for t, s in seq if online_since and t > online_since]
    log("Statuswechsel nach dem ersten Online:", flips or "keine")
    ok = online_since is not None and not flips
    # Stoppen über die API: muss zügig gehen (unter macOS hing es früher 90 s an einem Zombie-Prozess)
    t0 = time.time()
    call("/api/server", {"action": "stop"})
    stopped = None
    while time.time() - t0 < 120:
        line = stream.readline().decode("utf-8", "replace").strip()
        if line.startswith("event:"):
            event = line[6:].strip()
        elif line.startswith("data:") and event == "stats":
            if json.loads(line[5:]).get("state") == "inactive":
                stopped = time.time() - t0
                break
    log("Server gestoppt nach:", "%.1f s" % stopped if stopped else "– (nicht gestoppt)")
    ok = ok and stopped is not None and stopped < 45
finally:
    proc.terminate()
    try:
        proc.wait(15)
    except subprocess.TimeoutExpired:
        proc.kill()
    for f in ("panel.out", "server-console.log"):
        p = os.path.join(data, f)
        if os.path.isfile(p):
            print("──── %s (Ende) ────" % f)
            print(open(p, errors="replace").read()[-4000:])
    lat = os.path.join(data, "server", "logs", "latest.log")
    if os.path.isfile(lat):
        print("──── latest.log (Ende) ────")
        print(open(lat, errors="replace").read()[-3000:])
    # Minecraft-Server sicher beenden
    subprocess.run([sys.executable, "-m", "blockhaus", "uninstall", "--yes", "--delete-worlds"], cwd=ROOT, env=env,
                   capture_output=True, timeout=120)
print("ERGEBNIS:", "OK" if ok else "FEHLER")
sys.exit(0 if ok else 1)

#!/usr/bin/env python3
"""Integrationstest: Server-Software wechseln mit einer echten Welt.

  python tests/switch_server.py FROM TO        z. B.  paper fabric

Erstellt über Blockhaus einen FROM-Server, lässt die Welt erzeugen, stoppt ihn, gibt Ordnerstruktur und
level.dat aus, wechselt über die Update-Funktion zu TO und prüft, ob der Server danach online kommt –
mit derselben Welt (Seed bleibt gleich).
"""
import gzip
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
sys.path.insert(0, ROOT)
SRC, DST = (sys.argv[1:3] + ["paper", "fabric"][len(sys.argv[1:3]):])[:2]


def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


data = tempfile.mkdtemp(prefix="bh-switch-")
os.environ["BLOCKHAUS_DATA"] = data
port = free_port()
base = "http://127.0.0.1:%d" % port
proc = subprocess.Popen([sys.executable, "-m", "blockhaus"], cwd=ROOT,
                        env=dict(os.environ, BLOCKHAUS_PORT=str(port)),
                        stdout=open(os.path.join(data, "panel.out"), "w"), stderr=subprocess.STDOUT)
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
csrf = ""
server = os.path.join(data, "server")


def call(path, body=None, timeout=120):
    req = urllib.request.Request(base + path, data=None if body is None else json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json", "X-CSRF": csrf})
    with op.open(req, timeout=timeout) as r:
        return json.loads(r.read() or b"{}")


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


def wait_state(want_ready, timeout=420):
    """Liest die Live-Statusdaten bis active+ready (want_ready) bzw. inactive/failed."""
    req = urllib.request.Request(base + "/api/events", headers={"Accept": "text/event-stream"})
    stream = op.open(req, timeout=timeout)
    end, event, last = time.time() + timeout, None, None
    while time.time() < end:
        line = stream.readline().decode("utf-8", "replace").strip()
        if line.startswith("event:"):
            event = line[6:].strip()
        elif line.startswith("data:") and event in ("stats", "init"):
            d = json.loads(line[5:])
            st = (d.get("stats") if event == "init" else d) or {}
            cur = (st.get("state"), bool(st.get("ready")))
            if cur != last:
                log("Status:", cur)
                last = cur
            if want_ready and cur == ("active", True):
                return True
            if not want_ready and cur[0] in ("inactive",):
                return True
            if cur[0] == "failed":
                return False
    return False


def tree(root, depth=4):
    out = []
    for d, dirs, files in os.walk(root):
        rel = os.path.relpath(d, root)
        lvl = 0 if rel == "." else rel.count(os.sep) + 1
        dirs.sort()
        if lvl >= depth or "region" in rel or "entities" in rel or "poi" in rel:
            dirs[:] = []
        out.append("  " * lvl + (os.path.basename(d) if rel != "." else root) + "/  " +
                   " ".join(sorted(f for f in files if not f.endswith(".mca"))[:12]))
    return "\n".join(out)


def nbt_keys(path):
    from blockhaus.app import nbt_parse
    try:
        root = nbt_parse(gzip.open(path).read())
    except Exception as e:
        return "nicht lesbar: %s" % e

    def show(v, ind=0, maxd=3):
        lines = []
        if isinstance(v, dict):
            for k, (t, x) in sorted(v.items()):
                if isinstance(x, dict) and ind < maxd:
                    lines.append("  " * ind + "%s {" % k)
                    lines += show(x, ind + 1, maxd)
                    lines.append("  " * ind + "}")
                else:
                    s = repr(x)
                    lines.append("  " * ind + "%s: %s" % (k, s if len(s) < 140 else s[:140] + "…"))
        return lines
    return "\n".join(show(root))


def dump(title):
    print("\n════ %s ════" % title)
    print(tree(server, 3))
    for rel in ("world/level.dat",):
        p = os.path.join(server, rel)
        if os.path.isfile(p):
            print("── %s ──" % rel)
            print(nbt_keys(p))
    ddir = os.path.join(server, "world", "data")
    for d, _, files in os.walk(ddir):
        for f in files:
            if f.endswith(".dat"):
                print("── %s ──" % os.path.relpath(os.path.join(d, f), server))
                print(nbt_keys(os.path.join(d, f))[:3000])


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
    g_src = call("/api/update/versions?loader=%s" % SRC)["games"]
    g_dst = set(call("/api/update/versions?loader=%s" % DST)["games"])
    mc = next(g for g in g_src if g in g_dst)
    lv = call("/api/update/builds?loader=%s&mc=%s" % (SRC, mc)).get("recommended") or ""
    log("Erstelle", SRC, mc, lv)
    info = call("/api/server/create/info")
    call("/api/server/create", {"mode": "new", "loader": SRC, "mc": mc, "loaderVersion": lv, "eula": True,
                                "seed": "blockhaus-test-seed", "start": True, "port": info["port"],
                                "settings": {"ram_max_mb": 2048}})
    if not wait_state(True):
        raise SystemExit("%s kam nicht online" % SRC)
    time.sleep(5)
    call("/api/server", {"action": "stop"})
    wait_state(False)
    dump("Welt nach %s" % SRC)
    lv2 = call("/api/update/builds?loader=%s&mc=%s" % (DST, mc)).get("recommended") or ""
    chk = call("/api/update/check", {"loader": DST, "mc": mc, "loaderVersion": lv2}, timeout=300)
    log("Prüfung:", chk["mode"], [(m["name"], m["status"]) for m in chk["mods"]], chk["warnings"][:2])
    log("Wechsel zu", DST, mc, lv2)
    call("/api/update/run", {"loader": DST, "mc": mc, "loaderVersion": lv2})
    ok = wait_state(True, 900)
    log("%s online nach dem Wechsel:" % DST, ok)
    dump("Welt nach dem Wechsel zu %s" % DST)
finally:
    proc.terminate()
    try:
        proc.wait(15)
    except subprocess.TimeoutExpired:
        proc.kill()
    lat = os.path.join(server, "logs", "latest.log")
    if os.path.isfile(lat):
        print("\n──── latest.log (Ende) ────")
        print(open(lat, errors="replace").read()[-6000:])
    print("\n──── panel.out (Ende) ────")
    print(open(os.path.join(data, "panel.out"), errors="replace").read()[-4000:])
    subprocess.run([sys.executable, "-m", "blockhaus", "uninstall", "--yes", "--delete-worlds"], cwd=ROOT,
                   capture_output=True, timeout=180)
print("ERGEBNIS:", "OK" if ok else "FEHLER")
sys.exit(0 if ok else 1)

#!/usr/bin/env python3
"""Prüft ein Update über die App: läuft eine ältere Version auf PORT, wird über die API auf das neueste
GitHub-Release aktualisiert und gewartet, bis die neue Version wieder antwortet.

  python tests/update_flow.py PORT ERWARTETE_VERSION
"""
import http.cookiejar
import json
import sys
import time
import urllib.request

port, want = int(sys.argv[1]), sys.argv[2]
base = "http://127.0.0.1:%d" % port
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
csrf = ""


def call(path, body=None):
    req = urllib.request.Request(base + path, data=None if body is None else json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json", "X-CSRF": csrf})
    with op.open(req, timeout=60) as r:
        return json.loads(r.read() or b"{}")


def status(timeout=2):
    try:
        with urllib.request.urlopen(base + "/api/setup/status", timeout=timeout) as r:
            return json.load(r)
    except OSError:
        return None


for _ in range(60):
    if status():
        break
    time.sleep(1)
old = status()["version"]
print("läuft:", old)
call("/api/setup/admin", {"user": "admin", "password": "geheim12345"})
csrf = call("/api/me")["csrf"]
upd = call("/api/system/update?force=1")
print("Update-Prüfung:", {k: upd.get(k) for k in ("current", "version", "available")})
assert upd.get("available"), "kein Update angeboten"
print("Update starten:", call("/api/system/update", {}))
t0 = time.time()
seen_down = False
while time.time() - t0 < 180:
    st = status(1)
    if st is None:
        seen_down = True
    elif st["version"] == want:
        print("neue Version läuft: %s (nach %.0f s, Neustart beobachtet: %s)" % (st["version"], time.time() - t0, seen_down))
        break
    time.sleep(1)
else:
    sys.exit("FEHLER: Version %s kam nicht hoch" % want)

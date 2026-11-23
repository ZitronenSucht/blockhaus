#!/usr/bin/env python3
"""Blockhaus – Minecraft-Server erstellen und verwalten.

Nur Python-Standardbibliothek. Läuft unter Linux, macOS und Windows.
Start:                  python3 -m blockhaus
Admin anlegen:          python3 -m blockhaus adduser NAME [PASSWORT]
Passwort zurücksetzen:  python3 -m blockhaus passwd NAME [PASSWORT]
Datenordner:            BLOCKHAUS_DATA=/pfad (sonst der übliche Ordner des Systems)
"""
import glob
import gzip
import hashlib
import hmac
import http.client
import ssl
import json
import mimetypes
import os
import re
import secrets
import shutil
import socket
import socketserver
import sqlite3
import struct
import subprocess
import sys
import threading
import time
import tomllib
import datetime as dt
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from collections import deque
from zoneinfo import ZoneInfo
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

try:
    from . import nbt, osutil, system
except ImportError:  # direkt als Skript gestartet
    import nbt
    import osutil
    import system

VERSION = "0.1.5"
BASE = osutil.resource_dir(__file__)
STATIC = os.path.join(BASE, "static")
DATA = osutil.app_data_dir()
os.makedirs(DATA, exist_ok=True)
CONF_PATH = os.path.join(DATA, "config.json")
USERS_PATH = os.path.join(DATA, "users.json")
AUDIT_PATH = os.path.join(DATA, "audit.log")

DEFAULT_CONF = {
    "listen_host": "127.0.0.1",      # nur dieser Rechner; „0.0.0.0“ = auch aus dem Heimnetz erreichbar
    "listen_port": 8080,
    "server_dir": os.path.join(DATA, "server"),
    "backup_dir": os.path.join(DATA, "backups"),
    "control": "process",            # process = Blockhaus startet den Server selbst; systemd = über „service“
    "service": None,                 # Name der systemd-Unit (nur bei control = systemd)
    "public_address": "",            # Adresse, unter der Spieler den Server erreichen (für die Anzeige)
    "auto_backup_hours": 24,
    "auto_backup_keep": 7,
    "session_hours": 12,
    "timezone": osutil.local_timezone() or "UTC",
    "java": "auto",                  # auto = passendes Java automatisch laden; sonst Pfad zur java-Datei
    "ram_max_mb": None,              # None = automatisch (die Hälfte des RAM, max. 8 GB)
    "ram_min_mb": None,
    "autostart": False,              # Minecraft-Server beim Start von Blockhaus mitstarten
    "auto_restart": True,            # nach einem Absturz automatisch neu starten
    "https": False,
    "storage_max_gb": None,          # Speicherlimit für Welt + Backups (None = keins)
    "language": "de",
}

SYSTEMCTL = "/usr/bin/systemctl"
NAME_RE = re.compile(r"^[A-Za-z0-9_]{1,16}$")
IP_RE = re.compile(r"^[0-9a-fA-F:.]{2,45}$")
COLOR_RE = re.compile(r"\u00a7.")
MAX_UPLOAD = 1024 * 1024 * 1024
MAX_JSON = 4 * 1024 * 1024
MAX_EDIT = 2 * 1024 * 1024
LOCKED_PROPS = {"enable-rcon", "rcon.password", "rcon.port", "broadcast-rcon-to-ops",
                "management-server-secret"}


# ───────────────────────── Hilfsfunktionen ─────────────────────────

def load_json(path, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def save_json(path, obj, mode=0o600):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)
    os.chmod(tmp, mode)
    os.replace(tmp, path)


CONF = dict(DEFAULT_CONF)
_user_conf = load_json(CONF_PATH, {})
if "control" not in _user_conf and _user_conf.get("service"):
    _user_conf["control"] = "systemd"  # ältere Installation (Werkbank) mit systemd-Dienst
if "https" not in _user_conf and os.path.isfile(os.path.join(DATA, "tls", "cert.pem")):
    _user_conf["https"] = True
CONF.update(_user_conf)


def srv(*parts):
    return os.path.join(CONF["server_dir"], *parts)


def now():
    return time.time()


# ───────────────────────── Benutzer / Passwörter ─────────────────────────

users_lock = threading.Lock()


def hash_pw(pw, salt=None):
    salt = salt or secrets.token_bytes(16)
    h = hashlib.scrypt(pw.encode(), salt=salt, n=2 ** 14, r=8, p=1, dklen=32)
    return salt.hex(), h.hex()


def check_pw(pw, rec):
    try:
        _, h = hash_pw(pw, bytes.fromhex(rec["salt"]))
        return hmac.compare_digest(h, rec["hash"])
    except Exception:
        return False


def get_users():
    return load_json(USERS_PATH, {})


def set_user_pw(name, pw):
    with users_lock:
        users = get_users()
        salt, h = hash_pw(pw)
        rec = users.get(name, {"created": now()})
        rec.update(salt=salt, hash=h, changed=now())
        users[name] = rec
        save_json(USERS_PATH, users)


def set_user_lang(name, lang):
    with users_lock:
        users = get_users()
        if name in users and lang in ("de", "en"):
            users[name]["lang"] = lang
            save_json(USERS_PATH, users)


# ───────────────────────── Übersetzung (Meldungen des Servers) ─────────────────────────
# Deutsch ist die Quellsprache. i18n_en.json bildet deutsche Formatstrings (mit %s, %d …) auf Englisch ab.

I18N_PY = load_json(os.path.join(BASE, "i18n_en.json"), {})
_FMT = re.compile(r"%(?:\.\d+)?[sdfr]")
_tr_pats = []
for _de, _en in I18N_PY.items():
    if _FMT.search(_de):
        _rx = re.escape(_FMT.sub("TRSLOTX", _de).replace("%%", "%")).replace("TRSLOTX", "(.+?)")
        _tr_pats.append((len(_FMT.sub("", _de)), re.compile("^" + _rx + "$", re.S), _en))
_tr_pats.sort(key=lambda x: -x[0])  # spezifischere Muster zuerst
TR_PREFIXES = (("Update: ", "Update: "), ("Einrichtung: ", "Setup: "))
_tl = threading.local()


def lang_now():
    return getattr(_tl, "lang", None) or CONF.get("language") or "de"


def _tr_one(msg):
    if msg in I18N_PY:
        return I18N_PY[msg]
    for _, rx, en in _tr_pats:
        m = rx.match(msg)
        if m:
            vals = iter([I18N_PY.get(v, v) for v in m.groups()])
            parts = _FMT.split(en.replace("%%", "TRPCTX"))
            return "".join(p + (str(next(vals, "")) if i < len(parts) - 1 else "")
                           for i, p in enumerate(parts)).replace("TRPCTX", "%")
    return None


def tr_msg(msg, lang=None):
    """Meldung in die Sprache lang (Standard: die der aktuellen Anfrage bzw. die eingestellte) übersetzen."""
    lang = lang or lang_now()
    if lang == "de" or not isinstance(msg, str) or not msg:
        return msg
    hit = _tr_one(msg)
    if hit is None and msg[:1].isupper():
        h2 = _tr_one(msg[0].lower() + msg[1:])
        hit = h2[0].upper() + h2[1:] if h2 else None
    if hit is None:
        for de_p, en_p in TR_PREFIXES:
            if msg.startswith(de_p):
                return en_p + tr_msg(msg[len(de_p):], lang)
    return msg if hit is None else hit


def audit(user, ip, action, detail=""):
    line = json.dumps({"t": now(), "user": user, "ip": ip, "action": action, "detail": detail},
                      ensure_ascii=False)
    try:
        with open(AUDIT_PATH, "a", encoding="utf-8") as f:
            f.write(line + "\n")
        if os.path.getsize(AUDIT_PATH) > 2 * 1024 * 1024:
            with open(AUDIT_PATH, encoding="utf-8") as f:
                keep = f.readlines()[-2000:]
            with open(AUDIT_PATH, "w", encoding="utf-8") as f:
                f.writelines(keep)
    except OSError:
        pass


# ───────────────────────── server.properties ─────────────────────────

def _unescape(v):
    out, i = [], 0
    while i < len(v):
        c = v[i]
        if c == "\\" and i + 1 < len(v):
            n = v[i + 1]
            if n == "u" and i + 5 < len(v):
                try:
                    out.append(chr(int(v[i + 2:i + 6], 16)))
                    i += 6
                    continue
                except ValueError:
                    pass
            out.append({"n": "\n", "t": "\t", "r": "\r"}.get(n, n))
            i += 2
            continue
        out.append(c)
        i += 1
    return "".join(out)


def _escape(v):
    v = v.replace("\\", "\\\\").replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t")
    for ch in ":=#!":
        v = v.replace(ch, "\\" + ch)
    return "".join(c if ord(c) < 127 else "\\u%04x" % ord(c) for c in v)


def read_props():
    props = {}
    try:
        with open(srv("server.properties"), encoding="utf-8") as f:
            for line in f:
                s = line.strip()
                if not s or s[0] in "#!" or "=" not in s:
                    continue
                k, v = s.split("=", 1)
                props[k.strip()] = _unescape(v)
    except OSError:
        pass
    return props


def write_props(changes):
    path = srv("server.properties")
    with open(path, encoding="utf-8") as f:
        lines = f.readlines()
    done = set()
    for i, line in enumerate(lines):
        s = line.strip()
        if not s or s[0] in "#!" or "=" not in s:
            continue
        k = s.split("=", 1)[0].strip()
        if k in changes:
            lines[i] = "%s=%s\n" % (k, _escape(str(changes[k])))
            done.add(k)
    for k, v in changes.items():
        if k not in done:
            lines.append("%s=%s\n" % (k, _escape(str(v))))
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.writelines(lines)
    shutil.copymode(path, tmp)
    os.replace(tmp, path)


# ───────────────────────── RCON ─────────────────────────

class RconError(Exception):
    pass


class Rcon:
    def __init__(self):
        self.lock = threading.Lock()
        self.sock = None
        self.rid = 0
        self.last_error = None  # letzter Verbindungsfehler (für Diagnose und Log)

    def close(self):
        if self.sock:
            try:
                self.sock.close()
            except OSError:
                pass
        self.sock = None

    def _send(self, typ, body):
        self.rid = self.rid % 2_000_000_000 + 1
        data = struct.pack("<ii", self.rid, typ) + body.encode("utf-8") + b"\x00\x00"
        self.sock.sendall(struct.pack("<i", len(data)) + data)
        return self.rid

    def _recvn(self, n):
        buf = b""
        while len(buf) < n:
            chunk = self.sock.recv(n - len(buf))
            if not chunk:
                raise OSError("RCON-Verbindung geschlossen")
            buf += chunk
        return buf

    def _recv(self):
        (ln,) = struct.unpack("<i", self._recvn(4))
        if ln < 10 or ln > 1 << 20:
            raise OSError("RCON-Paket ungültig")
        d = self._recvn(ln)
        rid, typ = struct.unpack("<ii", d[:8])
        return rid, typ, d[8:-2].decode("utf-8", "replace")

    def _connect(self):
        p = read_props()
        if p.get("enable-rcon") != "true" or not p.get("rcon.password"):
            raise RconError("RCON ist nicht aktiviert")
        self.sock = socket.create_connection(("127.0.0.1", int(p.get("rcon.port", 25575))), timeout=4)
        self.sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        sent = self._send(3, p["rcon.password"])
        rid, _, _ = self._recv()
        if rid == -1 or rid != sent:
            self.close()
            raise RconError("RCON-Passwort abgelehnt")

    def cmd(self, command):
        command = command.replace("\r", " ").replace("\n", " ").strip()
        with self.lock:
            for attempt in (0, 1):
                try:
                    if not self.sock:
                        self._connect()
                    cid = self._send(2, command)
                    # Erst die erste Antwort abwarten, dann die Ende-Markierung schicken: Minecraft liest pro
                    # Lesevorgang nur ein Paket – kommen Befehl und Markierung zusammen an (unter macOS häufig),
                    # schließt der Server die Verbindung.
                    parts, marker = [], None
                    while True:
                        rid, _, body = self._recv()
                        if rid == cid:
                            parts.append(body)
                            if marker is None:
                                marker = self._send(200, "")  # mehrteilige Antworten: alles bis zur Markierung
                        elif marker is not None and rid == marker:
                            break
                    return COLOR_RE.sub("", "".join(parts))
                except RconError as e:
                    self._note(e)
                    raise
                except (OSError, struct.error) as e:
                    self.close()
                    if attempt:
                        self._note(e)
                        raise RconError("Server nicht erreichbar")

    def _note(self, e):
        msg = "%s: %s" % (type(e).__name__, e)
        if msg != self.last_error:
            print("RCON:", msg, file=sys.stderr)
        self.last_error = msg


RCON = Rcon()


def rcon_try(command):
    try:
        return RCON.cmd(command)
    except RconError:
        return None


# ───────────────────────── Service-Steuerung ─────────────────────────

SERVER = None  # osutil.ServerProcess, wenn Blockhaus den Server selbst startet
_server_lock = threading.Lock()


def use_systemd():
    return CONF.get("control") == "systemd" and bool(CONF.get("service"))


def server_proc():
    global SERVER
    with _server_lock:
        if SERVER is None:
            os.makedirs(DATA, exist_ok=True)
            SERVER = osutil.ServerProcess(
                CONF["server_dir"], DATA, build_server_cmd,
                send_stop=lambda: rcon_try("stop") is not None,
                on_event=lambda kind, msg: HUB.push_log(msg, kind),
                auto_restart=lambda: bool(CONF.get("auto_restart", True)))
        return SERVER


def svc_info():
    if not use_systemd():
        info = server_proc().info()
        info["UnitFileState"] = "enabled" if CONF.get("autostart") else "disabled"
        return info
    try:
        out = subprocess.run([SYSTEMCTL, "show", CONF["service"], "-p", "ActiveState", "-p", "SubState",
                              "-p", "MainPID", "-p", "ActiveEnterTimestampMonotonic", "-p", "UnitFileState"],
                             capture_output=True, text=True, timeout=5).stdout
    except (OSError, subprocess.TimeoutExpired):
        return {"ActiveState": "unknown"}
    info = {}
    for line in out.splitlines():
        if "=" in line:
            k, v = line.split("=", 1)
            info[k] = v
    return info


def svc_action(action):
    if not use_systemd():
        p = server_proc()
        {"start": p.start, "stop": p.stop, "restart": p.restart, "kill": p.kill}[action]()
        return
    args = {
        "start": [SYSTEMCTL, "start", CONF["service"]],
        "stop": [SYSTEMCTL, "stop", CONF["service"]],
        "restart": [SYSTEMCTL, "restart", CONF["service"]],
        "kill": [SYSTEMCTL, "kill", "--signal=SIGKILL", CONF["service"]],
    }[action]
    r = subprocess.run(["sudo", "-n"] + args, capture_output=True, text=True, timeout=120)
    if r.returncode != 0:
        raise RuntimeError((r.stderr or r.stdout or "Fehler").strip()[:300])


# ───────────────────────── Live-Daten (Log, Statistiken) ─────────────────────────

class Hub:
    """Sammelt Log-Zeilen und Messwerte; SSE-Clients lesen per Sequenznummer."""

    def __init__(self):
        self.cond = threading.Condition()
        self.seq = 0
        self.logs = deque(maxlen=1500)
        self.stats = {}
        self.history = deque(maxlen=240)  # 240 × 5 s = 20 min
        self.clients = 0
        self.task = None  # laufende Hintergrundaufgabe (Backup/Restore/Neustart)

    def push_log(self, line, kind="log"):
        if kind in ("sys", "err"):
            line = tr_msg(line, CONF.get("language") or "de")
        if "spark.lucko.me/" in line:
            spark_record(line)
        if kind == "log" and " joined the game" in line:
            maintenance_on_join(line)
        with self.cond:
            self.seq += 1
            self.logs.append((self.seq, kind, line))
            self.cond.notify_all()

    def set_stats(self, st):
        with self.cond:
            self.seq += 1
            self.stats = st
            self.history.append({k: st.get(k) for k in ("t", "cpu", "jcpu", "jmem", "heapUsed", "mspt", "players")})
            self.cond.notify_all()

    def set_task(self, task):
        if task and task.get("msg"):
            task = dict(task, msg=tr_msg(task["msg"], CONF.get("language") or "de"))
        with self.cond:
            self.seq += 1
            self.task = task
            self.cond.notify_all()


HUB = Hub()


LOG_VANILLA = re.compile(r"^\[(\d\d:\d\d:\d\d)\] \[([^\]]+?)/([A-Z]+)\]: ?(.*)$")
LOG_FORGE = re.compile(r"^\[(?:\d{1,2}[A-Za-z]{3}\d{4} )?(\d\d:\d\d:\d\d)(?:\.\d+)?\] \[([^\]]+?)/([A-Z]+)\] "
                       r"\[([^\]]*)\]: ?(.*)$")
LOG_PAPER = re.compile(r"^\[(\d\d:\d\d:\d\d) ([A-Z]+)\]: ?(.*)$")


def norm_log(line):
    """Bringt Log-Zeilen von Paper/Purpur und Forge/NeoForge in das Vanilla-/Fabric-Format
    „[hh:mm:ss] [Thread/LEVEL]: Text“, auf das sich Konsole, Chat, Verlauf und Toasts verlassen."""
    m = LOG_VANILLA.match(line)
    if m:
        if m.group(2).startswith("Async Chat Thread"):  # Paper loggt Chat aus einem eigenen Thread
            return "[%s] [Server thread/%s]: %s" % (m.group(1), m.group(3), m.group(4))
        return line
    m = LOG_FORGE.match(line)
    if m:
        t, th, lvl, logger, msg = m.groups()
        if th.startswith("Async Chat Thread"):
            th = "Server thread"
        src = logger.split("/")[0]
        if src and "minecraft" not in src.lower():
            msg = "[%s] %s" % (src.rsplit(".", 1)[-1], msg)
        return "[%s] [%s/%s]: %s" % (t, th, lvl, msg)
    m = LOG_PAPER.match(line)
    if m:
        return "[%s] [Server thread/%s]: %s" % m.groups()
    return line


def log_tailer():
    path = srv("logs", "latest.log")
    f, ino, buf = None, None, b""
    first = True
    while True:
        try:
            st = os.stat(path)
            if f is None or st.st_ino != ino or st.st_size < f.tell():
                if f:
                    f.close()
                f = open(path, "rb")
                ino = st.st_ino
                buf = b""
                if first:
                    f.seek(max(0, st.st_size - 120_000))
                    if f.tell():
                        f.readline()
                elif HUB.logs:
                    HUB.push_log("──────── neue Log-Datei ────────", "sys")
                first = False
            chunk = f.read(65536)
            if chunk:
                buf += chunk
                *lines, buf = buf.split(b"\n")
                for ln in lines:
                    HUB.push_log(norm_log(ln.decode("utf-8", "replace").rstrip("\r")))
                continue
        except OSError:
            f = None
        time.sleep(0.7)


def _read(path):
    with open(path) as f:
        return f.read()


# ───────────────────────── Langzeit-Statistiken (SQLite, 1 Zeile pro Minute, 30 Tage) ─────────────────────────

METRICS_DB = os.path.join(DATA, "metrics.sqlite")
METRIC_FIELDS = (("cpu", "cpu"), ("jcpu", "jcpu"), ("heap", "heapUsed"), ("rss", "jmem"), ("mspt", "mspt"),
                 ("players", "players"))
METRIC_RANGES = {"1h": (3600, 60), "24h": (86400, 300), "7d": (7 * 86400, 1800), "30d": (30 * 86400, 7200)}
METRIC_KEEP = 30 * 86400


def metrics_conn():
    c = sqlite3.connect(METRICS_DB, timeout=10)
    c.execute("PRAGMA journal_mode=WAL")
    return c


class Metrics:
    """Sammelt die Messwerte einer Minute im Speicher und schreibt dann eine Zeile (Durchschnitt + Spitzen)."""

    def __init__(self):
        self.minute = None
        self.acc = None
        try:
            with metrics_conn() as c:
                c.execute("CREATE TABLE IF NOT EXISTS m (t INTEGER PRIMARY KEY, up REAL, cpu REAL, jcpu REAL, heap REAL, "
                          "rss REAL, mspt REAL, mspt_max REAL, players REAL, players_max INTEGER, n INTEGER)")
            os.chmod(METRICS_DB, 0o600)
        except (sqlite3.Error, OSError) as e:
            print("metrics:", e, file=sys.stderr)

    def add(self, st):
        minute = int(st.get("t", now()) // 60) * 60
        if self.minute is not None and minute != self.minute:
            self.flush()
        if self.minute != minute:
            self.minute, self.acc = minute, {"n": 0, "up": 0, "mspt_max": None, "players_max": None}
        a = self.acc
        a["n"] += 1
        a["up"] += 1 if st.get("state") == "active" and st.get("ready") else 0
        for key, src in METRIC_FIELDS:
            v = st.get(src)
            if v is not None:
                a[key + "_s"] = a.get(key + "_s", 0) + v
                a[key + "_n"] = a.get(key + "_n", 0) + 1
        if st.get("mspt") is not None:
            a["mspt_max"] = max(a["mspt_max"] or 0, st["mspt"])
        if st.get("players") is not None:
            a["players_max"] = max(a["players_max"] or 0, st["players"])

    def flush(self):
        a, t = self.acc, self.minute
        if not a or not a["n"]:
            return
        avg = lambda k: a[k + "_s"] / a[k + "_n"] if a.get(k + "_n") else None
        try:
            with metrics_conn() as c:
                c.execute("INSERT OR REPLACE INTO m VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                          (t, a["up"] / a["n"], avg("cpu"), avg("jcpu"), avg("heap"), avg("rss"), avg("mspt"),
                           a["mspt_max"], avg("players"), a["players_max"], a["n"]))
                if t % 3600 == 0:
                    c.execute("DELETE FROM m WHERE t < ?", (t - METRIC_KEEP,))
        except sqlite3.Error as e:
            print("metrics:", e, file=sys.stderr)


METRICS = Metrics()


def r_metrics(h, s, q):  # als Route registriert weiter unten (nach der Definition von api())
    rng = q.get("range", "24h")
    if rng not in METRIC_RANGES:
        raise ApiError("Unbekannter Zeitraum")
    span, bucket = METRIC_RANGES[rng]
    since = int(now() - span)
    with metrics_conn() as c:
        rows = c.execute("SELECT (t/?)*? AS b, AVG(up), AVG(cpu), AVG(jcpu), AVG(heap), AVG(mspt), MAX(mspt_max), "
                         "AVG(players), MAX(players_max) FROM m WHERE t >= ? GROUP BY b ORDER BY b",
                         (bucket, bucket, since)).fetchall()
        summ = c.execute("SELECT SUM(up*n)/SUM(n), AVG(mspt), MAX(players_max), MAX(heap), MIN(t), COUNT(*) "
                         "FROM m WHERE t >= ?", (since,)).fetchone()
    keys = ("t", "up", "cpu", "jcpu", "heap", "mspt", "mspt_max", "players", "players_max")
    pts = [dict(zip(keys, r)) for r in rows]
    up, mspt, pmax, hmax, first, n = summ
    h.json({"range": rng, "bucket": bucket, "since": since, "now": now(), "points": pts,
            "summary": {"uptime": up, "tps": min(20.0, 1000.0 / mspt) if mspt else None, "mspt": mspt,
                        "playersMax": pmax, "heapMax": hmax, "first": first, "minutes": n},
            "heapLimit": HUB.stats.get("heapMax")})


HSPERF_USED = re.compile(r"^sun\.gc\.generation\.\d+\.space\.\d+\.used$")
HSPERF_CAP = re.compile(r"^sun\.gc\.generation\.\d+\.capacity$")
HSPERF_MAX = re.compile(r"^sun\.gc\.generation\.\d+\.maxCapacity$")


def jvm_heap(pid):
    """Liest die JVM-Leistungszähler (dieselben wie jstat) aus hsperfdata_<user>/<pid> im Temp-Ordner.
    Liefert belegten, zugesicherten und maximalen Heap in Bytes – oder None."""
    try:
        with open(osutil.hsperf_path(pid), "rb") as f:
            data = f.read()
    except (OSError, KeyError):
        return None
    if len(data) < 32 or data[:4] != b"\xca\xfe\xc0\xc0":
        return None
    bo = "<" if data[4] == 1 else ">"
    entry_off, n = struct.unpack_from(bo + "ii", data, 24)
    used = cap = mx = 0
    meta = None
    pos = entry_off
    for _ in range(n):
        if pos + 20 > len(data):
            break
        length, name_off, vec_len, typ, _flags, _units, _var, data_off = struct.unpack_from(bo + "iiibbbbi", data, pos)
        if length <= 0:
            break
        name_end = data.index(b"\x00", pos + name_off)
        name = data[pos + name_off:name_end].decode("ascii", "replace")
        if typ == ord("J") and vec_len == 0:
            (val,) = struct.unpack_from(bo + "q", data, pos + data_off)
            if HSPERF_USED.match(name):
                used += val
            elif HSPERF_CAP.match(name):
                cap += val
            elif HSPERF_MAX.match(name):
                mx = max(mx, val)  # bei G1 meldet jede Generation das volle Heap-Maximum
            elif name == "sun.gc.metaspace.used":
                meta = val
        pos += length
    if not used:
        return None
    return {"heapUsed": used, "heapCommitted": cap or None, "heapMax": mx or None, "metaspace": meta}


_weather_cache = {"t": 0, "val": {}}


def world_weather():
    """Regen/Gewitter aus weather.dat (wird beim Autosave aktualisiert) – höchstens alle 30 s gelesen."""
    if now() - _weather_cache["t"] < 30:
        return _weather_cache["val"]
    val = {}
    try:
        level = read_props().get("level-name", "world")
        raw = open(srv(level, "data", "minecraft", "weather.dat"), "rb").read()
        try:
            raw = gzip.decompress(raw)
        except OSError:
            pass
        w = nbt_plain(nbt_parse(raw)).get("data", {})
        val = {"raining": bool(w.get("raining")), "thundering": bool(w.get("thundering"))}
    except (OSError, ValueError, struct.error, NameError):
        pass
    _weather_cache.update(t=now(), val=val)
    return val


class Sampler:
    def __init__(self):
        self.m = osutil.Metrics()
        self.ncpu = self.m.ncpu
        self.last_rcon = 0
        self.rcon_data = {}

    def sample(self):
        info = svc_info()
        state = info.get("ActiveState", "unknown")
        pid = int(info.get("MainPID", "0") or 0)
        mem_total, mem_avail = self.m.memory()
        jcpu, jmem = self.m.proc(pid if state in ("active", "deactivating") else 0)
        d = CONF["server_dir"]
        while not os.path.exists(d) and os.path.dirname(d) != d:  # Server noch nicht angelegt
            d = os.path.dirname(d)
        du = shutil.disk_usage(d)
        uptime = None
        mono = int(info.get("ActiveEnterTimestampMonotonic", "0") or 0)
        if state == "active" and mono:
            uptime = time.monotonic() - mono / 1e6
        st = {
            "t": now(), "state": state, "sub": info.get("SubState"), "enabled": info.get("UnitFileState"),
            "pid": pid, "uptime": uptime, "cpu": self.m.sys_cpu(), "jcpu": jcpu, "jmem": jmem,
            "memTotal": mem_total, "memAvail": mem_avail,
            "diskTotal": du.total, "diskFree": du.free, "load": self.m.load(), "ncpu": self.ncpu,
        }
        st["lastCrash"] = last_crash_time()
        lim = storage_limit()
        if lim:  # Ordnergrößen werden höchstens alle 10 Minuten neu gezählt
            used = storage_used()
            st["storage"] = {"used": used, "max": lim}
            if used >= lim * 0.9 and now() - getattr(self, "storage_warned", 0) > 3600:
                self.storage_warned = now()
                HUB.push_log("Speicher fast voll: %.1f von %s GB belegt (Welt + Backups)"
                             % (used / 1024 ** 3, CONF.get("storage_max_gb")), "err")
        st["modsPending"] = restart_needed() if state == "active" else False
        heap = jvm_heap(pid) if pid and state in ("active", "deactivating") else None
        if heap:
            st.update(heap)
        if state == "active":
            if HUB.clients or now() - self.last_rcon > 30:
                self.last_rcon = now()
                self.rcon_data = self.poll_rcon()
            st.update(self.rcon_data)
        else:
            self.rcon_data = {}
            st.update(ready=False, players=None, online=[], mspt=None, tps=None)
        HUB.set_stats(st)
        METRICS.add(st)

    def poll_rcon(self):
        d = {"ready": False, "players": None, "online": [], "mspt": None, "tps": None, "maxPlayers": None}
        out = rcon_try("list")
        if out is None:
            d["rconError"] = RCON.last_error
            return d
        d["ready"] = True
        m = re.search(r"There are (\d+) of a max of (\d+) players online:?(.*)", out, re.S)
        if m:
            d["players"], d["maxPlayers"] = int(m.group(1)), int(m.group(2))
            d["online"] = [n.strip() for n in m.group(3).split(",") if n.strip()]
        tq = rcon_try("tick query") or ""
        m = re.search(r"Average time per tick:\s*([\d.,]+)\s*ms", tq)
        if m:
            d["mspt"] = float(m.group(1).replace(",", "."))
            d["tps"] = min(20.0, 1000.0 / d["mspt"]) if d["mspt"] > 0 else 20.0
        d["paused"] = "frozen" in tq.lower() or "paused" in tq.lower()
        # Ingame-Zeit (26.x: „time query day“ = Position im Tag, „time query time“ = Gesamtuhr)
        m1 = re.search(r"(\d+) tick", rcon_try("time query day") or "")
        m2 = re.search(r"(\d+) tick", rcon_try("time query time") or "")
        if m1:
            d["daytime"] = int(m1.group(1)) % 24000
        if m2:
            d["day"] = int(m2.group(1)) // 24000 + 1
        # Wetter live abfragen (Prädikat-Test, ändert nichts); weather.dat nur als Rückfall
        rain = rcon_try('execute if predicate {condition:"minecraft:weather_check",raining:true}')
        thunder = rcon_try('execute if predicate {condition:"minecraft:weather_check",thundering:true}')
        if rain and thunder and "Test" in rain and "Test" in thunder:
            d["raining"], d["thundering"] = "passed" in rain, "passed" in thunder
        else:
            d.update(world_weather())
        return d

    def run(self):
        while True:
            try:
                self.sample()
            except Exception as e:  # nie den Sampler sterben lassen
                print("sampler:", e, file=sys.stderr)
            time.sleep(3 if HUB.clients else 10)


# ───────────────────────── Gamerules (NBT) ─────────────────────────

def nbt_parse(data):
    pos = 0

    def rd(fmt):
        nonlocal pos
        v = struct.unpack_from(">" + fmt, data, pos)
        pos += struct.calcsize(">" + fmt)
        return v[0]

    def string():
        nonlocal pos
        n = rd("H")
        s = data[pos:pos + n].decode("utf-8", "replace")
        pos += n
        return s

    def payload(t):
        nonlocal pos
        if t == 1: return rd("b")
        if t == 2: return rd("h")
        if t == 3: return rd("i")
        if t == 4: return rd("q")
        if t == 5: return rd("f")
        if t == 6: return rd("d")
        if t == 7:
            n = rd("i"); v = list(data[pos:pos + n]); pos += n; return v
        if t == 8: return string()
        if t == 9:
            et, n = rd("b"), rd("i")
            return [payload(et) for _ in range(n)]
        if t == 10:
            out = {}
            while True:
                tt = rd("b")
                if tt == 0:
                    return out
                name = string()
                out[name] = (tt, payload(tt))
        if t == 11:
            n = rd("i"); v = list(struct.unpack_from(">%di" % n, data, pos)); pos += 4 * n; return v
        if t == 12:
            n = rd("i"); v = list(struct.unpack_from(">%dq" % n, data, pos)); pos += 8 * n; return v
        raise ValueError("NBT-Tag %d" % t)

    t = rd("b")
    string()
    return payload(t)


def read_gamerules_file():
    level = read_props().get("level-name", "world")
    path = srv(level, "data", "minecraft", "game_rules.dat")
    try:
        raw = open(path, "rb").read()
        try:
            raw = gzip.decompress(raw)
        except OSError:
            pass
        root = nbt_parse(raw)
        data = root.get("data", (10, {}))[1]
        rules = []
        for name, (t, v) in data.items():
            if t == 1:
                rules.append({"id": name, "type": "bool", "value": bool(v)})
            elif t in (2, 3, 4):
                rules.append({"id": name, "type": "int", "value": int(v)})
            elif t == 8:
                rules.append({"id": name, "type": "str", "value": v})
        return sorted(rules, key=lambda r: r["id"])
    except (OSError, ValueError, struct.error):
        return []


def live_gamerules():
    rules = read_gamerules_file()
    if not rules:
        return rules, False
    live = False
    for r in rules:
        out = rcon_try("gamerule " + r["id"])
        if out is None:
            break
        live = True
        m = re.search(r"(?:set to|is)[:\s]+(\S+?)\.?\s*$", out.strip())
        if m:
            v = m.group(1)
            if r["type"] == "bool" and v in ("true", "false"):
                r["value"] = v == "true"
            elif r["type"] == "int" and re.fullmatch(r"-?\d+", v):
                r["value"] = int(v)
    return rules, live


# ───────────────────────── Backups ─────────────────────────

backup_lock = threading.Lock()


def list_backups():
    d = CONF["backup_dir"]
    out = []
    try:
        for n in os.listdir(d):
            p = os.path.join(d, n)
            if n.endswith(".tar.gz") and os.path.isfile(p):
                st = os.stat(p)
                if n.startswith("serverdateien-"):
                    kind = "serverdateien"
                elif "-vor-update" in n:
                    kind = "vor-update"
                elif "-auto" in n:
                    kind = "auto"
                elif "-vor-restore" in n:
                    kind = "pre-restore"
                else:
                    kind = "manuell"
                out.append({"name": n, "size": st.st_size, "mtime": st.st_mtime, "kind": kind})
    except OSError:
        pass
    return sorted(out, key=lambda b: -b["mtime"])


def make_backup(label="manual", user="system"):
    if not backup_lock.acquire(blocking=False):
        raise RuntimeError("Es läuft bereits eine Backup-Aufgabe")
    try:
        HUB.set_task({"kind": "backup", "msg": "Backup wird erstellt …", "t": now()})
        os.makedirs(CONF["backup_dir"], exist_ok=True)
        storage_check(label)
        level = read_props().get("level-name", "world")
        running = svc_info().get("ActiveState") == "active"
        if running and rcon_try("save-off") is not None:
            rcon_try("save-all flush")
        else:
            running = False
        name = "%s-%s-%s.tar.gz" % (level, time.strftime("%Y-%m-%d_%H-%M-%S"), label)
        dest = os.path.join(CONF["backup_dir"], name)
        try:
            skipped = osutil.tar_create(dest + ".part", CONF["server_dir"], [level])
        except Exception as e:
            _unlink(dest + ".part")
            raise RuntimeError("Backup fehlgeschlagen: %s" % e)
        finally:
            if running:
                rcon_try("save-on")
        if skipped:
            HUB.push_log("Backup: %d Datei(en) konnten nicht gesichert werden (in Benutzung oder Verknüpfung nach außen)" % skipped, "sys")
        os.replace(dest + ".part", dest)
        if label == "auto":
            keep = max(1, int(CONF.get("auto_backup_keep", 7)))
            autos = [b for b in list_backups() if b["kind"] == "auto"]
            for b in autos[keep:]:
                os.remove(os.path.join(CONF["backup_dir"], b["name"]))
        HUB.push_log("Backup erstellt: %s (%s)" % (name, user), "sys")
        return name
    finally:
        HUB.set_task(None)
        backup_lock.release()


def wait_state(target, timeout=120):
    end = now() + timeout
    while now() < end:
        if svc_info().get("ActiveState") in target:
            return True
        time.sleep(1)
    return False


def restore_backup(name, user):
    if not backup_lock.acquire(blocking=False):
        raise RuntimeError("Es läuft bereits eine Backup-Aufgabe")
    try:
        src = os.path.join(CONF["backup_dir"], name)
        if name.startswith("serverdateien-"):
            return restore_serverfiles(src, name, user)
        level = read_props().get("level-name", "world")
        HUB.set_task({"kind": "restore", "msg": "Server wird gestoppt …", "t": now()})
        was_running = svc_info().get("ActiveState") == "active"
        if was_running:
            svc_action("stop")
            wait_state(("inactive", "failed"))
        HUB.set_task({"kind": "restore", "msg": "Sicherung der aktuellen Welt …", "t": now()})
        ts = time.strftime("%Y-%m-%d_%H-%M-%S")
        world = srv(level)
        if os.path.isdir(world):
            pre = os.path.join(CONF["backup_dir"], "%s-%s-vor-restore.tar.gz" % (level, ts))
            try:
                osutil.tar_create(pre + ".part", CONF["server_dir"], [level])
                os.replace(pre + ".part", pre)
            except Exception as e:
                _unlink(pre + ".part")
                raise RuntimeError("Sicherung vor Restore fehlgeschlagen: %s" % e)
            trash = srv(".restore-old-" + ts)
            os.rename(world, trash)
        else:
            trash = None
        HUB.set_task({"kind": "restore", "msg": "Backup wird entpackt …", "t": now()})
        err = ""
        try:
            osutil.tar_extract(src, CONF["server_dir"])
        except Exception as e:
            err = str(e)
        if err or not os.path.isdir(world):
            if os.path.isdir(world):
                shutil.rmtree(world, ignore_errors=True)
            if trash:
                os.rename(trash, world)
            raise RuntimeError("Entpacken fehlgeschlagen: " + (err or "Welt-Ordner fehlt im Backup")[:200])
        if trash:
            shutil.rmtree(trash, ignore_errors=True)
        if was_running:
            HUB.set_task({"kind": "restore", "msg": "Server startet …", "t": now()})
            svc_action("start")
        HUB.push_log("Backup wiederhergestellt: %s (%s)" % (name, user), "sys")
    finally:
        HUB.set_task(None)
        backup_lock.release()


def cleanup_partial_backups():
    """Beim Start läuft noch kein Backup – übrig gebliebene .part-Dateien stammen von abgebrochenen Läufen."""
    try:
        for n in os.listdir(CONF["backup_dir"]):
            if n.endswith(".tar.gz.part"):
                _unlink(os.path.join(CONF["backup_dir"], n))
                print("Abgebrochenes Backup entfernt:", n, file=sys.stderr)
    except OSError:
        pass


def auto_backup_loop():
    cleanup_partial_backups()
    time.sleep(60)
    while True:
        try:
            hours = float(CONF.get("auto_backup_hours", 0) or 0)
            if hours > 0:
                autos = [b for b in list_backups() if b["kind"] == "auto"]
                last = autos[0]["mtime"] if autos else 0
                if now() - last >= hours * 3600:
                    make_backup("auto", "Automatik")
        except Exception as e:
            HUB.push_log("Automatisches Backup fehlgeschlagen: %s" % e, "err")
        time.sleep(300)


# ───────────────────────── geplanter Neustart ─────────────────────────

restart_plan = {"id": 0}


def planned_restart(delay, user, action="restart"):
    restart_plan["id"] += 1
    my = restart_plan["id"]
    end = now() + delay
    word = "Neustart" if action == "restart" else "Stopp"
    marks = [600, 300, 120, 60, 30, 15, 10, 5, 4, 3, 2, 1]

    def run():
        said = set()
        while True:
            if restart_plan["id"] != my:
                HUB.set_task(None)
                rcon_try('tellraw @a {"text":"Server-%s abgebrochen.","color":"green"}' % word)
                return
            left = int(round(end - now()))
            if left <= 0:
                break
            HUB.set_task({"kind": "countdown", "msg": "%s in %d s" % (word, left), "end": end, "t": now(),
                          "action": action})
            for m in marks:
                if left <= m and m not in said and m <= delay:
                    said.add(m)
                    txt = "%d Minuten" % (m // 60) if m >= 120 else ("1 Minute" if m == 60 else "%d Sekunden" % m)
                    rcon_try('tellraw @a [{"text":"[Server] ","color":"gold"},'
                             '{"text":"%s in %s","color":"yellow"}]' % (word, txt))
            time.sleep(1)
        HUB.set_task({"kind": "countdown", "msg": "%s läuft …" % word, "t": now()})
        try:
            svc_action(action)
        except Exception as e:
            HUB.push_log("%s fehlgeschlagen: %s" % (word, e), "err")
        HUB.set_task(None)

    threading.Thread(target=run, daemon=True).start()


# ───────────────────────── Server-Software (Loader) ─────────────────────────
# Welche Software läuft, steht in werkbank-launch.conf im Server-Ordner (wird von start.sh gelesen
# und liegt mit im Backup „Serverdateien“). Fehlt die Datei, wird anhand der Dateien erkannt.

LOADERS = {
    "vanilla": {"name": "Vanilla", "kind": None, "dir": None, "mr": [], "family": "vanilla", "verLabel": None,
                "desc": "Der originale Server von Mojang – ohne Mods und Plugins, nur Datapacks."},
    "fabric": {"name": "Fabric", "kind": "mod", "dir": "mods", "mr": ["fabric"], "family": "fabric",
               "verLabel": "Fabric-Loader", "meta": ("fabric",),
               "desc": "Schlanker Mod-Loader, schnell auf neuen Versionen, viele Performance-Mods."},
    "forge": {"name": "Forge", "kind": "mod", "dir": "mods", "mr": ["forge"], "family": "forge",
              "verLabel": "Forge-Version", "meta": ("forge",),
              "desc": "Der klassische Mod-Loader – vor allem für große Modpacks und ältere Versionen."},
    "neoforge": {"name": "NeoForge", "kind": "mod", "dir": "mods", "mr": ["neoforge"], "family": "neoforge",
                 "verLabel": "NeoForge-Version", "meta": ("neoforge",),
                 "desc": "Moderner Nachfolger von Forge, auf neuen Versionen die erste Wahl für Forge-Mods."},
    "paper": {"name": "Paper", "kind": "plugin", "dir": "plugins", "mr": ["paper", "spigot", "bukkit"], "family": "bukkit",
              "verLabel": "Paper-Build", "meta": ("plugin",),
              "desc": "Schneller Server für Plugins (Bukkit/Spigot/Paper). Spieler brauchen nichts zu installieren."},
    "purpur": {"name": "Purpur", "kind": "plugin", "dir": "plugins", "mr": ["purpur", "paper", "spigot", "bukkit"],
               "family": "bukkit", "verLabel": "Purpur-Build", "meta": ("plugin",),
               "desc": "Paper mit vielen zusätzlichen Einstellungen. Läuft mit allen Paper-Plugins."},
}
LAUNCH_CONF = "blockhaus-launch.conf"
LEGACY_LAUNCH_CONF = "werkbank-launch.conf"  # ältere Werkbank-Installationen
PARKED = ".blockhaus-parked"
VER_RE = re.compile(r"^[0-9A-Za-z.\-+_]{1,40}$")
LAUNCH_TOKEN = re.compile(r"^[0-9A-Za-z.\-+_/@=:]{1,200}$")


def launch_conf_path():
    p = srv(LAUNCH_CONF)
    return p if os.path.isfile(p) or not os.path.isfile(srv(LEGACY_LAUNCH_CONF)) else srv(LEGACY_LAUNCH_CONF)


def launch_conf():
    """Schlüssel/Werte aus blockhaus-launch.conf; LAUNCH als Liste unter „_launch“."""
    out = {}
    try:
        with open(launch_conf_path(), encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                m = re.match(r"^([A-Z_]+)=([^\s(\"']\S*)\s*$", line)
                if m:
                    out[m.group(1)] = m.group(2)
                m = re.match(r"^LAUNCH=\((.*)\)$", line)
                if m:
                    toks = m.group(1).split()
                    if toks and all(LAUNCH_TOKEN.fullmatch(t) for t in toks):
                        out["_launch"] = toks
    except OSError:
        pass
    return out


def detect_loader():
    ld = launch_conf().get("LOADER")
    if ld in LOADERS:
        return ld
    if os.path.isfile(srv("fabric-server-launch.jar")):
        return "fabric"
    if os.path.isdir(srv("libraries", "net", "neoforged", "neoforge")):
        return "neoforge"
    if os.path.isdir(srv("libraries", "net", "minecraftforge", "forge")):
        return "forge"
    if os.path.isfile(srv("purpur.jar")):
        return "purpur"
    if os.path.isfile(srv("paper.jar")):
        return "paper"
    return "vanilla"


def content_rel(ld=None):
    return LOADERS[ld or detect_loader()]["dir"]


def content_dir(*parts, ld=None):
    """Mod- bzw. Plugin-Ordner der (aktuellen) Server-Software – None bei Vanilla."""
    rel = content_rel(ld)
    return srv(rel, *parts) if rel else None


def need_content_dir():
    d = content_dir()
    if not d:
        raise ApiError("Vanilla unterstützt keine Mods oder Plugins – unter „Updates“ die Server-Software wechseln")
    return d


def write_launch_conf(ld, mc, lv, launch):
    for x in [mc] + ([lv] if lv else []) + list(launch):
        if not LAUNCH_TOKEN.fullmatch(str(x)):
            raise RuntimeError("Ungültiger Startparameter: %s" % x)
    body = ("# Von Blockhaus erzeugt – legt fest, welche Server-Software gestartet wird.\n"
            "# Bitte nicht von Hand bearbeiten, sondern im Panel unter „Updates“ wechseln.\n"
            "LOADER=%s\nMC_VERSION=%s\nLOADER_VERSION=%s\nLAUNCH=(%s)\n") % (ld, mc, lv or "", " ".join(launch))
    names = [LAUNCH_CONF] + ([LEGACY_LAUNCH_CONF] if os.path.isfile(srv(LEGACY_LAUNCH_CONF)) else [])
    for name in names:  # eine alte start.sh liest evtl. noch den Werkbank-Namen
        tmp = srv(name + ".tmp")
        with open(tmp, "w", encoding="utf-8") as f:
            f.write(body)
        os.replace(tmp, srv(name))


START_MARK = "-launch.conf"


def start_script_patched():
    """start.sh so anpassen, dass es LAUNCH aus werkbank-launch.conf nutzt. Gibt den neuen Text zurück
    (None = schon passend). Wirft RuntimeError, wenn die Startzeile nicht erkannt wird.
    Nur bei control = systemd nötig – sonst baut Blockhaus den Startbefehl selbst."""
    if not use_systemd():
        return None
    try:
        with open(srv("start.sh"), encoding="utf-8") as f:
            text = f.read()
    except OSError:
        raise RuntimeError("start.sh fehlt im Server-Ordner")
    if START_MARK in text:
        return None
    lines = text.splitlines()
    idx = next((i for i, l in enumerate(lines) if l.lstrip().startswith("exec ") and re.search(r"-jar \S+\.jar", l)), None)
    if idx is None:
        raise RuntimeError("start.sh: Startzeile (exec … -jar …) nicht gefunden – bitte von Hand anpassen")
    lines[idx] = re.sub(r"-jar \S+\.jar", '"${LAUNCH[@]}"', lines[idx], count=1)
    block = ["# Welche Server-Software startet, legt Blockhaus in blockhaus-launch.conf fest (LOADER, LAUNCH).",
             "# Fehlt die Datei, startet Fabric wie bisher.",
             "LAUNCH=(-jar fabric-server-launch.jar)",
             "if [[ -f blockhaus-launch.conf ]]; then",
             "  source ./blockhaus-launch.conf",
             "fi",
             ""]
    lines[idx:idx] = block
    return "\n".join(lines) + "\n"


def ensure_start_script():
    new = start_script_patched()
    if new is None:
        return False
    p = srv("start.sh")
    mode = os.stat(p).st_mode & 0o777
    with open(p + ".tmp", "w", encoding="utf-8") as f:
        f.write(new)
    os.chmod(p + ".tmp", mode)
    os.replace(p + ".tmp", p)
    return True


def ensure_launch_conf():
    """Beim ersten Start: aktuelle (Fabric-)Installation in blockhaus-launch.conf festhalten."""
    if os.path.isfile(srv(LAUNCH_CONF)) or not os.path.isdir(CONF["server_dir"]) or detect_loader() != "fabric" \
            or not os.path.isfile(srv("fabric-server-launch.jar")):
        return
    v = server_version()
    if v.get("mc") and v.get("loaderVersion"):
        try:
            write_launch_conf("fabric", v["mc"], v["loaderVersion"], ["-jar", "fabric-server-launch.jar"])
        except (OSError, RuntimeError) as e:
            print("blockhaus-launch.conf:", e, file=sys.stderr)


# ───────────────────────── Mods & Plugins ─────────────────────────

def _yaml_top(text):
    """Sehr kleiner YAML-Leser für plugin.yml (nur oberste Ebene: Werte und einfache Listen)."""
    out, lst = {}, None
    for line in text.splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        m = re.match(r"^([A-Za-z_\-]+):\s*(.*?)\s*$", line)
        if m:
            k, v = m.group(1), m.group(2)
            lst = None
            if v == "":
                out[k], lst = [], k
            elif v in ("|", ">", "|-", ">-"):
                out[k] = None
            elif v.startswith("[") and v.endswith("]"):
                out[k] = [x.strip().strip("'\"") for x in v[1:-1].split(",") if x.strip()]
            else:
                out[k] = v.strip("'\"")
        elif lst and re.match(r"^\s*-\s+", line):
            out[lst].append(re.sub(r"^\s*-\s+", "", line).strip().strip("'\""))
    return out


def _manifest(z):
    try:
        text = z.read("META-INF/MANIFEST.MF").decode("utf-8", "replace").replace("\r\n ", "").replace("\n ", "")
    except KeyError:
        return {}
    return {k.strip(): v.strip() for k, v in (l.split(":", 1) for l in text.splitlines() if ":" in l)}


def _meta_fabric(z, fname):
    j = json.loads(z.read(fname).decode("utf-8", "replace"), strict=False)
    if fname == "quilt.mod.json":
        ql = j.get("quilt_loader") or {}
        md = ql.get("metadata") or {}
        return {"id": ql.get("id"), "name": md.get("name"), "version": ql.get("version"),
                "description": md.get("description"), "authors": list((md.get("contributors") or {}).keys())[:4],
                "icon": md.get("icon") if isinstance(md.get("icon"), str) else None,
                "mixins": [m for m in (j.get("mixin") or []) if isinstance(m, str)] if isinstance(j.get("mixin"), list) else []}
    authors = j.get("authors") or []
    mixins = []
    for mx in j.get("mixins") or []:
        cfg = mx if isinstance(mx, str) else (mx.get("config") if isinstance(mx, dict) else None)
        if cfg:
            mixins.append(cfg)
    return {"id": j.get("id"), "name": j.get("name"), "version": j.get("version"), "description": j.get("description"),
            "authors": [a if isinstance(a, str) else a.get("name", "") for a in authors][:4],
            "icon": j.get("icon") if isinstance(j.get("icon"), str) else None, "mixins": mixins}


def _meta_forge(z, fname):
    t = tomllib.loads(z.read(fname).decode("utf-8", "replace"))
    mods = t.get("mods") or [{}]
    m = mods[0] if isinstance(mods, list) and mods else {}
    man = _manifest(z)
    ver = str(m.get("version") or "")
    if not ver or "${" in ver:
        ver = man.get("Implementation-Version") or ""
    authors = m.get("authors") or t.get("authors") or ""
    mixins = [x.get("config") for x in (t.get("mixins") or []) if isinstance(x, dict) and x.get("config")]
    mixins += [x.strip() for x in (man.get("MixinConfigs") or "").split(",") if x.strip()]
    logo = m.get("logoFile") or t.get("logoFile")
    return {"id": m.get("modId"), "name": m.get("displayName") or m.get("modId"), "version": ver or None,
            "description": (str(m.get("description") or "").strip() or None),
            "authors": [a.strip() for a in str(authors).split(",") if a.strip()][:4],
            "icon": logo if isinstance(logo, str) else None, "mixins": mixins}


def _meta_plugin(z, fname):
    y = _yaml_top(z.read(fname).decode("utf-8", "replace"))
    authors = y.get("authors") if isinstance(y.get("authors"), list) else []
    if isinstance(y.get("author"), str):
        authors = [y["author"]] + authors
    return {"id": y.get("name"), "name": y.get("name"), "version": y.get("version"),
            "description": y.get("description") if isinstance(y.get("description"), str) else None,
            "authors": authors[:4], "icon": None, "mixins": [], "main": y.get("main")}


META_FILES = (("fabric", "fabric.mod.json", _meta_fabric), ("quilt", "quilt.mod.json", _meta_fabric),
              ("neoforge", "META-INF/neoforge.mods.toml", _meta_forge), ("forge", "META-INF/mods.toml", _meta_forge),
              ("plugin", "paper-plugin.yml", _meta_plugin), ("plugin", "plugin.yml", _meta_plugin))


def mod_meta(path, ld=None):
    """Metadaten einer .jar – egal ob Fabric-, Forge-, NeoForge-Mod oder Bukkit/Paper-Plugin.
    „types“ = alle erkannten Formate; bevorzugt wird das zur Server-Software passende."""
    ld = ld or detect_loader()
    want = LOADERS[ld].get("meta") or ()
    meta = {}
    try:
        with zipfile.ZipFile(path) as z:
            names = set(z.namelist())
            found = [(t, f, fn) for t, f, fn in META_FILES if f in names]
            types = sorted({t for t, _, _ in found})
            found.sort(key=lambda x: 0 if x[0] in want else 1)
            for t, f, fn in found:
                try:
                    meta = fn(z, f)
                except (ValueError, KeyError, tomllib.TOMLDecodeError, AttributeError, TypeError):
                    continue
                meta["type"] = t
                break
            meta["types"] = types
            meta["hasIcon"] = bool(meta.get("icon")) and meta["icon"].lstrip("/") in names
    except (OSError, zipfile.BadZipFile, ValueError):
        pass
    for k in ("name", "version", "description", "id"):
        if meta.get(k) is not None and not isinstance(meta.get(k), str):
            meta[k] = str(meta[k])
    return meta


def jar_compatible(meta, ld=None):
    """True/False, ob die Datei mit der Server-Software läuft; None = unbekanntes Format."""
    types = set(meta.get("types") or [])
    if not types:
        return None
    return bool(types & set(LOADERS[ld or detect_loader()].get("meta") or ()))


def list_mods(ld=None, d=None):
    ld = ld or detect_loader()
    d = d or content_dir(ld=ld)
    out = []
    if not d:
        return out
    try:
        for n in sorted(os.listdir(d), key=str.lower):
            p = os.path.join(d, n)
            if os.path.isfile(p) and (n.endswith(".jar") or n.endswith(".jar.disabled")):
                m = mod_meta(p, ld)
                m.pop("icon", None)
                m.pop("mixins", None)
                st = os.stat(p)
                m.update(file=n, size=st.st_size, mtime=st.st_mtime, enabled=n.endswith(".jar"),
                         compatible=jar_compatible(m, ld))
                out.append(m)
    except OSError:
        pass
    return out


# ───────────────────────── Dateien ─────────────────────────

def safe_path(rel, root=None):
    root = os.path.realpath(root or CONF["server_dir"])
    p = os.path.realpath(os.path.join(root, (rel or "").lstrip("/")))
    if p != root and not p.startswith(root + os.sep):
        raise PermissionError("Pfad außerhalb des Server-Ordners")
    return p


def is_text(path):
    try:
        with open(path, "rb") as f:
            head = f.read(8192)
        if b"\x00" in head:
            return False
        head.decode("utf-8")
        return True
    except (OSError, UnicodeDecodeError):
        return False


# ───────────────────────── HTTP ─────────────────────────

SESSIONS = {}
FAILS = {}
sess_lock = threading.Lock()


class ApiError(Exception):
    def __init__(self, msg, code=400):
        super().__init__(msg)
        self.code = code


class Handler(BaseHTTPRequestHandler):
    server_version = "Blockhaus"
    sys_version = ""
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        pass

    # ── Antworten ──
    def send_body(self, code, body, ctype, extra=None):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.sec_headers()
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def sec_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        frame = " frame-src 'self';"
        self.send_header("Content-Security-Policy",
                         "default-src 'self'; img-src 'self' data: https://mc-heads.net https://cdn.modrinth.com; "
                         "style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none';" + frame)

    def json(self, obj, code=200, extra=None):
        self.send_body(code, json.dumps(obj, ensure_ascii=False).encode(), "application/json; charset=utf-8",
                       dict({"Cache-Control": "no-store"}, **(extra or {})))

    def ip(self):
        return self.client_address[0]

    # ── Session ──
    def cookie(self, name):
        for part in (self.headers.get("Cookie") or "").split(";"):
            k, _, v = part.strip().partition("=")
            if k == name:
                return v
        return None

    def session(self):
        tok = self.cookie("wb_session")
        if not tok:
            return None
        with sess_lock:
            s = SESSIONS.get(tok)
            if not s:
                return None
            if now() - s["last"] > CONF["session_hours"] * 3600:
                SESSIONS.pop(tok, None)
                return None
            if s["user"] not in get_users():
                SESSIONS.pop(tok, None)
                return None
            s["last"] = now()
            s["token"] = tok
            return s

    def read_body(self, limit=MAX_JSON):
        n = int(self.headers.get("Content-Length") or 0)
        if n > limit:
            raise ApiError("Anfrage zu groß", 413)
        return self.rfile.read(n) if n else b""

    def body_json(self):
        raw = self.read_body()
        try:
            return json.loads(raw or b"{}")
        except ValueError:
            raise ApiError("Ungültiges JSON")

    # ── Routing ──
    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        self.route("GET")

    def do_POST(self):
        self.route("POST")

    def do_PUT(self):
        self.route("PUT")

    def route(self, method):
        lang = self.headers.get("X-Lang")
        _tl.lang = lang if lang in ("de", "en") else None
        url = urllib.parse.urlsplit(self.path)
        path = url.path
        q = {k: v[0] for k, v in urllib.parse.parse_qs(url.query).items()}
        try:
            if path in ("/blockhaus-ca.crt", "/werkbank-ca.crt"):  # öffentliches CA-Zertifikat zum Installieren (kein Geheimnis)
                with open(os.path.join(DATA, "tls", "ca.pem"), "rb") as f:
                    return self.send_body(200, f.read(), "application/x-x509-ca-cert", {
                        "Content-Disposition": 'attachment; filename="Blockhaus-Heimnetz-CA.crt"'})
            if path == "/bluemap" or path.startswith("/bluemap/"):
                if not self.session():
                    raise ApiError("Nicht angemeldet", 401)
                if path == "/bluemap":
                    return self.send_body(302, b"", "text/plain", {"Location": "/bluemap/"})
                return self.proxy_bluemap(path[len("/bluemap"):], url.query)
            if not path.startswith("/api/"):
                if method not in ("GET", "HEAD"):
                    raise ApiError("Methode nicht erlaubt", 405)
                return self.static(path)
            if path == "/api/login" and method == "POST":
                return self.login()
            if path in ("/api/setup/status", "/api/setup/admin"):  # öffentlich: erster Start
                fn = ROUTES.get((method, path))
                if not fn:
                    raise ApiError("Methode nicht erlaubt", 405)
                return fn(self, None, q)
            s = self.session()
            if not s:
                raise ApiError("Nicht angemeldet", 401)
            if method != "GET":
                if not hmac.compare_digest(self.headers.get("X-CSRF", ""), s["csrf"]):
                    raise ApiError("CSRF-Token ungültig", 403)
            fn = ROUTES.get((method, path))
            if not fn:
                raise ApiError("Unbekannter Endpunkt", 404)
            return fn(self, s, q)
        except ApiError as e:
            self.json({"error": tr_msg(str(e))}, e.code)
        except RconError as e:
            self.json({"error": tr_msg(str(e))}, 503)
        except PermissionError as e:
            self.json({"error": tr_msg(str(e) or "Keine Berechtigung")}, 403)
        except FileNotFoundError:
            self.json({"error": tr_msg("Nicht gefunden")}, 404)
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as e:
            print("Fehler:", repr(e), file=sys.stderr)
            try:
                self.json({"error": tr_msg(str(e) or "Interner Fehler")}, 500)
            except OSError:
                pass

    def proxy_bluemap(self, sub, query):
        """Leitet die BlueMap-Weboberfläche durch das Panel (hinter Login, gleiche Herkunft, HTTPS-fähig)."""
        port = int(bm_conf("webserver.conf", "port") or 8100)
        headers = {k: self.headers[k] for k in ("Accept", "Accept-Encoding", "If-None-Match", "If-Modified-Since",
                                                "Range", "Accept-Language") if self.headers.get(k)}
        conn = http.client.HTTPConnection("127.0.0.1", port, timeout=30)
        try:
            conn.request("GET", (sub or "/") + ("?" + query if query else ""), headers=headers)
            r = conn.getresponse()
        except OSError:
            conn.close()
            raise ApiError("BlueMap ist nicht erreichbar (Server offline?)", 502)
        try:
            self.send_response(r.status)
            length = None
            for k, v in r.getheaders():
                kl = k.lower()
                if kl in ("content-type", "content-encoding", "cache-control", "etag", "last-modified",
                          "content-range", "accept-ranges"):
                    self.send_header(k, v)
                elif kl == "content-length":
                    length = v
            if length is not None:
                self.send_header("Content-Length", length)
            else:
                self.close_connection = True
            self.send_header("X-Frame-Options", "SAMEORIGIN")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            if self.command == "HEAD":
                return
            if "event-stream" in (r.getheader("Content-Type") or "") and conn.sock:
                conn.sock.settimeout(None)
            while True:
                chunk = r.read1(65536) if hasattr(r, "read1") else r.read(65536)
                if not chunk:
                    break
                self.wfile.write(chunk)
                self.wfile.flush()
        finally:
            conn.close()

    def static(self, path):
        if path in ("/", "/index.html"):
            path = "/index.html"
        p = os.path.realpath(os.path.join(STATIC, path.lstrip("/")))
        if not p.startswith(STATIC + os.sep) or not os.path.isfile(p):
            raise ApiError("Nicht gefunden", 404)
        with open(p, "rb") as f:
            body = f.read()
        ctype = mimetypes.guess_type(p)[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype in ("application/javascript", "image/svg+xml"):
            ctype += "; charset=utf-8"
        if path == "/index.html":
            # Dateien mit Version in der Adresse: nach einem Update lädt der Browser (auch das macOS-Fenster)
            # garantiert die neuen statt der zwischengespeicherten. Die Startseite selbst nie zwischenspeichern.
            body = re.sub(rb'(href|src)="/(style\.css|app\.js|i18n\.js|favicon\.svg)"',
                          lambda m: b'%s="/%s?v=%s"' % (m.group(1), m.group(2), VERSION.encode()), body)
            body = body.replace(b"<head>", b'<head>\n<meta name="bh-version" content="%s">' % VERSION.encode(), 1)
            return self.send_body(200, body, ctype, {"Cache-Control": "no-store"})
        self.send_body(200, body, ctype, {"Cache-Control": "no-cache"})

    # ── Login ──
    def login(self):
        ip = self.ip()
        with sess_lock:
            fails = [t for t in FAILS.get(ip, []) if now() - t < 300]
            FAILS[ip] = fails
        if len(fails) >= 5:
            raise ApiError("Zu viele Fehlversuche – bitte %d s warten" % int(300 - (now() - fails[0])), 429)
        d = self.body_json()
        user, pw = str(d.get("user", "")).strip(), str(d.get("password", ""))
        rec = get_users().get(user)
        if not rec or not check_pw(pw, rec):
            with sess_lock:
                FAILS.setdefault(ip, []).append(now())
            audit(user or "?", ip, "login-fehlgeschlagen")
            time.sleep(0.6)
            raise ApiError("Benutzername oder Passwort falsch", 401)
        with sess_lock:
            FAILS.pop(ip, None)
        audit(user, ip, "login")
        self.start_session(user)

    def start_session(self, user):
        tok = secrets.token_urlsafe(32)
        with sess_lock:
            SESSIONS[tok] = {"user": user, "csrf": secrets.token_urlsafe(24), "last": now(), "created": now(),
                             "ip": self.ip()}
        self.json({"ok": True}, extra={
            "Set-Cookie": "wb_session=%s; HttpOnly; SameSite=Strict; Path=/; Max-Age=%d%s"
                          % (tok, CONF["session_hours"] * 3600, "; Secure" if self.server.tls else "")})


# ───────────────────────── API-Endpunkte ─────────────────────────

ROUTES = {}


def api(method, path):
    def deco(fn):
        ROUTES[(method, path)] = fn
        return fn
    return deco


def act(h, s, action, detail=""):
    audit(s["user"], h.ip(), action, detail)


@api("POST", "/api/logout")
def r_logout(h, s, q):
    with sess_lock:
        SESSIONS.pop(s["token"], None)
    act(h, s, "logout")
    h.json({"ok": True}, extra={"Set-Cookie": "wb_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0"})


@api("GET", "/api/me")
def r_me(h, s, q):
    p = read_props()
    h.json({"user": s["user"], "csrf": s["csrf"], "address": CONF.get("public_address") or osutil.lan_ip(),
            "port": p.get("server-port"), "motd": p.get("motd"), "version": server_version(),
            "hasServer": has_server(), "appVersion": VERSION,
            "language": get_users().get(s["user"], {}).get("lang") or CONF.get("language", "de")})


@api("POST", "/api/me/language")
def r_me_language(h, s, q):
    lang = h.body_json().get("lang")
    if lang not in ("de", "en"):
        raise ApiError("Ungültiger Wert")
    set_user_lang(s["user"], lang)
    CONF["language"] = lang  # Log- und Fortschrittsmeldungen
    save_json(CONF_PATH, CONF)
    h.json({"ok": True})


def server_version():
    ld = detect_loader()
    c = launch_conf()
    if c.get("LOADER") == ld and c.get("MC_VERSION"):
        mc, lv = c.get("MC_VERSION"), c.get("LOADER_VERSION")
    else:  # ältere Installation ohne werkbank-launch.conf
        j = load_json(srv(".hu-framework.json"), {})
        mc = CONF.get("mc_version") or j.get("minecraft")
        lv = (CONF.get("loader_version") or j.get("loader_version")) if ld == "fabric" else None
    L = LOADERS[ld]
    return {"mc": mc, "loader": ld, "loaderName": L["name"], "loaderVersion": lv, "kind": L["kind"], "dir": L["dir"]}


@api("GET", "/api/events")
def r_events(h, s, q):
    h.send_response(200)
    h.send_header("Content-Type", "text/event-stream")
    h.send_header("Cache-Control", "no-store")
    h.send_header("X-Accel-Buffering", "no")
    h.sec_headers()
    h.end_headers()
    h.close_connection = True

    def send(ev, data):
        h.wfile.write(("event: %s\ndata: %s\n\n" % (ev, json.dumps(data, ensure_ascii=False))).encode())
        h.wfile.flush()

    with HUB.cond:
        HUB.clients += 1
        logs = list(HUB.logs)[-500:]
        seq = HUB.seq
        stats, hist, task = HUB.stats, list(HUB.history), HUB.task
    try:
        send("init", {"logs": [[k, l] for _, k, l in logs], "stats": stats, "history": hist, "task": task,
                      "version": VERSION})
        last_stats, last_task = stats, task
        last_ping = now()
        while True:
            with HUB.cond:
                HUB.cond.wait(timeout=15)
                new = [(k, l) for sq, k, l in HUB.logs if sq > seq]
                seq = HUB.seq
                stats, task = HUB.stats, HUB.task
            if new:
                send("log", [[k, l] for k, l in new])
            if stats is not last_stats:
                send("stats", stats)
                last_stats = stats
            if task is not last_task:
                send("task", task)
                last_task = task
            if now() - last_ping > 14:
                h.wfile.write(b": ping\n\n")
                h.wfile.flush()
                last_ping = now()
            if s["token"] not in SESSIONS:
                break
    except OSError:
        pass
    finally:
        with HUB.cond:
            HUB.clients -= 1


@api("POST", "/api/server")
def r_server(h, s, q):
    d = h.body_json()
    action = d.get("action")
    delay = int(d.get("delay") or 0)
    if action == "cancel":
        restart_plan["id"] += 1
        act(h, s, "geplante Aktion abgebrochen")
        return h.json({"ok": True})
    if action not in ("start", "stop", "restart", "kill"):
        raise ApiError("Unbekannte Aktion")
    if action in ("restart", "stop") and delay > 0:
        if svc_info().get("ActiveState") != "active":
            raise ApiError("Server läuft nicht")
        planned_restart(min(delay, 3600), s["user"], action)
        act(h, s, "geplant: " + action, "%d s" % delay)
        return h.json({"ok": True, "planned": True})
    act(h, s, "server-" + action)
    HUB.push_log("» %s: Server %s" % (s["user"], {"start": "starten", "stop": "stoppen",
                                                  "restart": "neu starten", "kill": "hart beenden"}[action]),
                 "sys")
    threading.Thread(target=lambda: _svc_bg(action), daemon=True).start()
    h.json({"ok": True})


def _svc_bg(action):
    try:
        svc_action(action)
    except Exception as e:
        HUB.push_log("Aktion fehlgeschlagen: %s" % e, "err")


@api("POST", "/api/command")
def r_command(h, s, q):
    cmd = str(h.body_json().get("command", "")).strip().lstrip("/")
    if not cmd:
        raise ApiError("Kein Befehl")
    if len(cmd) > 1400:
        raise ApiError("Befehl zu lang")
    try:
        out = RCON.cmd(cmd)
    except RconError:
        # RCON noch nicht bereit (Server startet gerade)? Dann direkt in die Server-Konsole schreiben.
        if use_systemd() or not server_proc().command(cmd):
            raise
        out = ""
    act(h, s, "befehl", cmd)
    HUB.push_log("%s › /%s" % (s["user"], cmd), "cmd")
    for line in (out or "").splitlines() or ([""] if out else []):
        if line.strip():
            HUB.push_log(line, "out")
    h.json({"ok": True, "output": out})


# ── Spieler ──

def uuid_names():
    names = {}
    for e in load_json(srv("usercache.json"), []):
        if isinstance(e, dict) and e.get("uuid"):
            names[e["uuid"]] = {"name": e.get("name"), "expires": e.get("expiresOn")}
    return names


def player_stats(uuid):
    level = read_props().get("level-name", "world")
    for p in (srv(level, "players", "stats", uuid + ".json"), srv(level, "stats", uuid + ".json")):
        j = load_json(p, None)
        if j:
            c = j.get("stats", {}).get("minecraft:custom", {})
            return {"playTime": c.get("minecraft:play_time", c.get("minecraft:play_one_minute", 0)) / 20,
                    "deaths": c.get("minecraft:deaths", 0), "mobKills": c.get("minecraft:mob_kills", 0),
                    "walked": c.get("minecraft:walk_one_cm", 0) / 100,
                    "lastSeen": os.path.getmtime(p)}
    return None


@api("GET", "/api/players")
def r_players(h, s, q):
    known = uuid_names()
    players = {}
    for uuid, info in known.items():
        players[uuid] = {"uuid": uuid, "name": info["name"], "stats": player_stats(uuid)}
    wl = load_json(srv("whitelist.json"), [])
    ops = load_json(srv("ops.json"), [])
    bans = load_json(srv("banned-players.json"), [])
    for lst in (wl, ops, bans):
        for e in lst:
            if e.get("uuid") and e["uuid"] not in players:
                players[e["uuid"]] = {"uuid": e["uuid"], "name": e.get("name"), "stats": player_stats(e["uuid"])}
    online = HUB.stats.get("online") or []
    p = read_props()
    h.json({
        "players": sorted(players.values(), key=lambda x: (x["name"] or "").lower()),
        "whitelist": [e.get("name") for e in wl], "ops": {e.get("name"): e.get("level", 4) for e in ops},
        "bans": bans, "ipBans": load_json(srv("banned-ips.json"), []), "online": online,
        "whitelistOn": p.get("white-list") == "true", "maxPlayers": p.get("max-players"),
    })


@api("POST", "/api/players/action")
def r_player_action(h, s, q):
    d = h.body_json()
    a, name = d.get("action"), str(d.get("name", "")).strip()
    reason = re.sub(r"[\r\n]", " ", str(d.get("reason", "")))[:200]
    if a in ("ban-ip", "pardon-ip"):
        if not (IP_RE.match(name) or NAME_RE.match(name)):
            raise ApiError("Ungültige IP")
    elif a not in ("whitelist-on", "whitelist-off", "reload-whitelist"):
        if not NAME_RE.match(name):
            raise ApiError("Ungültiger Spielername")
    cmds = {
        "whitelist-add": "whitelist add %s" % name, "whitelist-remove": "whitelist remove %s" % name,
        "op": "op %s" % name, "deop": "deop %s" % name,
        "kick": ("kick %s %s" % (name, reason)).strip(), "ban": ("ban %s %s" % (name, reason)).strip(),
        "pardon": "pardon %s" % name, "ban-ip": ("ban-ip %s %s" % (name, reason)).strip(),
        "pardon-ip": "pardon-ip %s" % name,
        "survival": "gamemode survival %s" % name, "creative": "gamemode creative %s" % name,
        "adventure": "gamemode adventure %s" % name, "spectator": "gamemode spectator %s" % name,
        "heal": "effect give %s minecraft:instant_health 1 10 true" % name,
        "feed": "effect give %s minecraft:saturation 1 20 true" % name,
        "whitelist-on": "whitelist on", "whitelist-off": "whitelist off", "reload-whitelist": "whitelist reload",
    }
    if a not in cmds:
        raise ApiError("Unbekannte Aktion")
    duration = int(d.get("duration") or 0)
    if a == "ban" and duration > 0:
        until = now() + duration
        cmds["ban"] = ("ban %s %s" % (name, ("%s (bis %s)" % (reason, time.strftime("%d.%m. %H:%M", time.localtime(until))))
                                              .strip())).strip()
    out = RCON.cmd(cmds[a])
    if a == "ban" and duration > 0:
        tempban_add(name, duration, reason, s["user"])
    elif a == "pardon":
        tempban_remove(name)
    act(h, s, "spieler-" + a, name + (" (%d Std)" % (duration // 3600) if a == "ban" and duration else ""))
    HUB.push_log("%s › /%s" % (s["user"], cmds[a]), "cmd")
    if out:
        HUB.push_log(out, "out")
    h.json({"ok": True, "output": out})


# ── Welt ──

@api("GET", "/api/gamerules")
def r_gamerules(h, s, q):
    rules, live = live_gamerules()
    h.json({"rules": rules, "live": live})


@api("POST", "/api/gamerules")
def r_gamerule_set(h, s, q):
    d = h.body_json()
    rid, val = str(d.get("id", "")), d.get("value")
    if not re.fullmatch(r"[a-z0-9_.\-]+:[a-z0-9_./\-]+|[A-Za-z0-9_]+", rid):
        raise ApiError("Ungültige Regel")
    if isinstance(val, bool):
        val = "true" if val else "false"
    elif isinstance(val, int):
        val = str(val)
    else:
        raise ApiError("Ungültiger Wert")
    out = RCON.cmd("gamerule %s %s" % (rid, val))
    act(h, s, "gamerule", "%s=%s" % (rid, val))
    h.json({"ok": True, "output": out})


@api("POST", "/api/world")
def r_world(h, s, q):
    d = h.body_json()
    a = d.get("action")
    cmds = {
        "day": "time set day", "noon": "time set noon", "night": "time set night", "midnight": "time set midnight",
        "clear": "weather clear", "rain": "weather rain", "thunder": "weather thunder",
        "peaceful": "difficulty peaceful", "easy": "difficulty easy", "normal": "difficulty normal",
        "hard": "difficulty hard", "save": "save-all", "kill-items": "kill @e[type=minecraft:item]",
    }
    if a == "say":
        msg = re.sub(r"[\r\n]", " ", str(d.get("message", ""))).strip()[:250]
        if not msg:
            raise ApiError("Leere Nachricht")
        payload = json.dumps([{"text": "[Server] ", "color": "gold", "bold": True},
                              {"text": msg, "color": "white", "bold": False}], ensure_ascii=False)
        cmd = "tellraw @a " + payload
    elif a in cmds:
        cmd = cmds[a]
    else:
        raise ApiError("Unbekannte Aktion")
    out = RCON.cmd(cmd)
    if a in ("peaceful", "easy", "normal", "hard"):
        write_props({"difficulty": a})  # sonst setzt der nächste Start den alten Wert zurück
    act(h, s, "welt-" + a, d.get("message", ""))
    HUB.push_log("%s › /%s" % (s["user"], cmd), "cmd")
    if out:
        HUB.push_log(out, "out")
    h.json({"ok": True, "output": out})


# ── server.properties ──

@api("GET", "/api/properties")
def r_props(h, s, q):
    p = read_props()
    for k in LOCKED_PROPS:
        if k in p and ("password" in k or "secret" in k):
            p[k] = "••••••"
    h.json({"props": p, "locked": sorted(LOCKED_PROPS)})


@api("POST", "/api/properties")
def r_props_set(h, s, q):
    changes = h.body_json().get("changes") or {}
    clean = {}
    for k, v in changes.items():
        if k in LOCKED_PROPS:
            continue
        if not re.fullmatch(r"[a-zA-Z0-9.\-_]+", k):
            raise ApiError("Ungültiger Schlüssel: %s" % k)
        clean[k] = "true" if v is True else "false" if v is False else str(v)
    if clean:
        write_props(clean)
        act(h, s, "properties", ", ".join("%s=%s" % kv for kv in clean.items())[:500])
    h.json({"ok": True, "changed": list(clean)})


# ── Mods ──

_loaded_cache = {"key": None, "val": None}
_pending_cache = {"key": None, "val": None}
BUILTIN_MODS = {"java", "minecraft", "fabricloader"}
LOADED_RE = re.compile(r"^\t- (\S+) (\S+)\s*$")


def loaded_mods():
    """Mods, die der laufende Server tatsächlich geladen hat – aus der Fabric-Liste am Anfang von latest.log."""
    path = srv("logs", "latest.log")
    try:
        ino = os.stat(path).st_ino
    except OSError:
        return None
    if _loaded_cache["key"] == ino:
        return _loaded_cache["val"]
    found, mods = False, {}
    try:
        with open(path, encoding="utf-8", errors="replace") as f:
            for i, line in enumerate(f):
                if i > 5000:
                    break
                if not found:
                    found = bool(re.search(r"Loading \d+ mods:", line))
                    continue
                if not line.startswith("\t"):
                    break
                m = LOADED_RE.match(line.rstrip("\n"))
                if m:
                    mods[m.group(1)] = m.group(2)
    except OSError:
        return None
    if not found:
        return None  # Server startet gerade – später erneut versuchen
    _loaded_cache.update(key=ino, val=mods)
    return mods


SNAP_PATH = os.path.join(DATA, "content-snapshot.json")
_snap = {"key": None, "files": None}


def content_snapshot(info):
    """Stand des Mod-/Plugin-Ordners beim letzten Serverstart (für Loader ohne auswertbare Mod-Liste im Log).
    Dateien, die nach dem Start geändert wurden, zählen nicht dazu – sie gelten als „noch nicht geladen“."""
    mono = int(info.get("ActiveEnterTimestampMonotonic", "0") or 0)
    ld = detect_loader()
    key = "%s:%s" % (ld, mono)
    if _snap["key"] == key:
        return _snap["files"]
    saved = load_json(SNAP_PATH, {})
    if saved.get("key") == key and isinstance(saved.get("files"), dict):
        _snap.update(key=key, files=saved["files"])
        return saved["files"]
    started = now() - (time.monotonic() - mono / 1e6)
    files = {}
    for m in list_mods(ld):
        if m["mtime"] <= started + 1:
            files[m["file"]] = [m["size"], m["mtime"], m.get("id") or m["file"], m.get("name") or m["file"]]
    try:
        save_json(SNAP_PATH, {"key": key, "files": files})
    except OSError:
        pass
    _snap.update(key=key, files=files)
    return files


def snapshot_pending(info, mods):
    snap = content_snapshot(info)
    on = {f: v for f, v in snap.items() if f.endswith(".jar")}
    snap_ids = {v[2] for v in on.values()}
    files = {}
    for m in mods:
        f = m["file"]
        if m["enabled"]:
            v = on.get(f)
            if v and v[0] == m["size"] and abs(v[1] - m["mtime"]) < 1:
                continue
            files[f] = "update" if (m.get("id") or f) in snap_ids else "new"
        elif f[:-len(".disabled")] in on:
            files[f] = "disabled"
    cur_ids = {m.get("id") or m["file"] for m in mods if m["enabled"]}
    present = {m["file"] for m in mods} | {m["file"][:-len(".disabled")] for m in mods if not m["enabled"]}
    removed = sorted({v[3] for f, v in on.items() if f not in present and v[2] not in cur_ids})
    return {"active": True, "files": files, "removed": removed}


def mods_pending(mods=None):
    """Vergleicht den Mod-/Plugin-Ordner mit dem, was der laufende Server geladen hat.
    Ergebnis: {"active": bool, "files": {datei: status}, "removed": [ids]} – status ∈ new|update|disabled."""
    info = svc_info()
    if info.get("ActiveState") != "active" or not content_dir():
        return {"active": info.get("ActiveState") == "active", "files": {}, "removed": []}
    if detect_loader() != "fabric":
        return snapshot_pending(info, mods if mods is not None else list_mods())
    loaded = loaded_mods()
    if loaded is None:
        return {"active": True, "files": {}, "removed": [], "unknown": True}
    mods = mods if mods is not None else list_mods()
    files, provided = {}, set()
    enabled_ids = {m.get("id") for m in mods if m["enabled"] and m.get("id")}
    for m in mods:
        mid, ver = m.get("id"), m.get("version")
        if mid:
            provided.add(mid)
        if m["enabled"]:
            if not mid:
                continue
            if mid not in loaded:
                files[m["file"]] = "new"
            elif ver and loaded[mid] != ver:
                files[m["file"]] = "update"
        elif mid and mid in loaded and mid not in enabled_ids:
            files[m["file"]] = "disabled"
    removed = sorted(i for i in loaded if i not in BUILTIN_MODS and i not in provided)
    return {"active": True, "files": files, "removed": removed}


def restart_needed():
    """Günstige, gecachte Variante für den Sampler (nur bei Änderungen an mods/ oder neuem Log neu berechnet)."""
    try:
        key = (detect_loader(), tuple((f, os.path.getmtime(content_dir(f))) for f in mod_files()),
               os.stat(srv("logs", "latest.log")).st_ino, svc_info().get("ActiveEnterTimestampMonotonic"))
    except OSError:
        return False
    if _pending_cache["key"] == key:
        return _pending_cache["val"]
    p = mods_pending()
    if p.get("unknown"):
        return False
    val = bool(p["files"] or p["removed"])
    _pending_cache.update(key=key, val=val)
    return val


@api("GET", "/api/mods")
def r_mods(h, s, q):
    v = server_version()
    d = content_dir()
    if d and not os.path.isdir(d):
        os.makedirs(d, exist_ok=True)
    mods = list_mods()
    h.json({"mods": mods, "pending": mods_pending(mods), "loader": v["loader"], "loaderName": v["loaderName"],
            "kind": v["kind"], "dir": v["dir"], "mc": v["mc"]})


@api("GET", "/api/mods/icon")
def r_mod_icon(h, s, q):
    p = safe_path(q.get("file", ""), need_content_dir())
    meta = mod_meta(p)
    if not meta.get("icon"):
        raise ApiError("Kein Icon", 404)
    with zipfile.ZipFile(p) as z:
        try:
            data = z.read(meta["icon"].lstrip("/"))
        except KeyError:
            raise ApiError("Kein Icon", 404)
    h.send_body(200, data, "image/png", {"Cache-Control": "private, max-age=86400"})


@api("POST", "/api/mods/action")
def r_mod_action(h, s, q):
    d = h.body_json()
    f = os.path.basename(str(d.get("file", "")))
    p = safe_path(f, need_content_dir())
    if not os.path.isfile(p):
        raise ApiError("Mod nicht gefunden", 404)
    a = d.get("action")
    if a == "toggle":
        newp = p[:-len(".disabled")] if p.endswith(".disabled") else p + ".disabled"
        os.rename(p, newp)
    elif a == "delete":
        os.remove(p)
    else:
        raise ApiError("Unbekannte Aktion")
    act(h, s, "mod-" + a, f)
    h.json({"ok": True})


# ── Dateien ──

@api("GET", "/api/files")
def r_files(h, s, q):
    rel = q.get("path", "")
    p = safe_path(rel)
    if not os.path.isdir(p):
        raise ApiError("Kein Ordner")
    entries = []
    with os.scandir(p) as it:
        for e in it:
            try:
                st = e.stat()
                entries.append({"name": e.name, "dir": e.is_dir(), "size": st.st_size, "mtime": st.st_mtime})
            except OSError:
                pass
    entries.sort(key=lambda e: (not e["dir"], e["name"].lower()))
    rel = os.path.relpath(p, os.path.realpath(CONF["server_dir"]))
    h.json({"path": "" if rel == "." else rel, "entries": entries})


@api("GET", "/api/file")
def r_file(h, s, q):
    p = safe_path(q.get("path", ""))
    if not os.path.isfile(p):
        raise ApiError("Keine Datei", 404)
    if os.path.getsize(p) > MAX_EDIT or not is_text(p):
        raise ApiError("Datei ist zu groß oder kein Text – bitte herunterladen")
    with open(p, encoding="utf-8") as f:
        h.json({"content": f.read()})


@api("PUT", "/api/file")
def r_file_save(h, s, q):
    p = safe_path(q.get("path", ""))
    if os.path.isdir(p):
        raise ApiError("Ist ein Ordner")
    body = h.read_body(MAX_EDIT)
    body.decode("utf-8")
    tmp = p + ".wbtmp"
    with open(tmp, "wb") as f:
        f.write(body)
    if os.path.exists(p):
        shutil.copymode(p, tmp)
    os.replace(tmp, p)
    act(h, s, "datei-gespeichert", q.get("path", ""))
    h.json({"ok": True})


@api("GET", "/api/download")
def r_download(h, s, q):
    if q.get("backup"):
        p = safe_path(os.path.basename(q["backup"]), CONF["backup_dir"])
    else:
        p = safe_path(q.get("path", ""))
    if not os.path.isfile(p):
        raise ApiError("Keine Datei", 404)
    size = os.path.getsize(p)
    name = os.path.basename(p)
    h.send_response(200)
    h.send_header("Content-Type", "application/octet-stream")
    h.send_header("Content-Length", str(size))
    h.send_header("Content-Disposition", "attachment; filename*=UTF-8''" + urllib.parse.quote(name))
    h.sec_headers()
    h.end_headers()
    with open(p, "rb") as f:
        shutil.copyfileobj(f, h.wfile, 256 * 1024)


@api("PUT", "/api/upload")
def r_upload(h, s, q):
    d = safe_path(q.get("dir", ""))
    name = os.path.basename(q.get("name", ""))
    if not name or name in (".", ".."):
        raise ApiError("Ungültiger Dateiname")
    if not os.path.isdir(d):
        raise ApiError("Zielordner existiert nicht")
    n = int(h.headers.get("Content-Length") or 0)
    if n > MAX_UPLOAD:
        raise ApiError("Datei zu groß (max. 1 GB)", 413)
    p = safe_path(os.path.join(os.path.relpath(d, CONF["server_dir"]), name))
    tmp = p + ".wbupload"
    left = n
    with open(tmp, "wb") as f:
        while left > 0:
            chunk = h.rfile.read(min(left, 256 * 1024))
            if not chunk:
                break
            f.write(chunk)
            left -= len(chunk)
    if left:
        os.remove(tmp)
        raise ApiError("Upload unvollständig")
    os.replace(tmp, p)
    act(h, s, "upload", os.path.relpath(p, CONF["server_dir"]))
    h.json({"ok": True})


@api("POST", "/api/files/action")
def r_file_action(h, s, q):
    d = h.body_json()
    a = d.get("action")
    p = safe_path(d.get("path", ""))
    root = os.path.realpath(CONF["server_dir"])
    if p == root and a != "mkdir":
        raise ApiError("Der Server-Ordner selbst kann nicht verändert werden")
    if a == "delete":
        if os.path.isdir(p) and not os.path.islink(p):
            shutil.rmtree(p)
        else:
            os.remove(p)
    elif a == "rename":
        new = os.path.basename(str(d.get("name", "")))
        if not new or new in (".", ".."):
            raise ApiError("Ungültiger Name")
        target = safe_path(os.path.join(os.path.dirname(os.path.relpath(p, root)), new))
        if os.path.exists(target):
            raise ApiError("Name existiert bereits")
        os.rename(p, target)
    elif a == "mkdir":
        new = os.path.basename(str(d.get("name", "")))
        if not new or new in (".", ".."):
            raise ApiError("Ungültiger Name")
        os.mkdir(safe_path(os.path.join(os.path.relpath(p, root), new)))
    else:
        raise ApiError("Unbekannte Aktion")
    act(h, s, "datei-" + a, d.get("path", "") + (" → " + str(d.get("name")) if d.get("name") else ""))
    h.json({"ok": True})


# ── Backups ──

@api("GET", "/api/backups")
def r_backups(h, s, q):
    level = read_props().get("level-name", "world")
    h.json({"backups": list_backups(), "autoHours": CONF.get("auto_backup_hours"),
            "autoKeep": CONF.get("auto_backup_keep"), "dir": CONF["backup_dir"],
            "worldSize": dir_size(srv(level))})


_size_cache = {}


def dir_size(p):
    c = _size_cache.get(p)
    if c and now() - c[0] < 120:
        return c[1]
    total = 0
    for root, _, files in os.walk(p):
        for f in files:
            try:
                total += os.path.getsize(os.path.join(root, f))
            except OSError:
                pass
    _size_cache[p] = (now(), total)
    return total


@api("POST", "/api/backups")
def r_backup_action(h, s, q):
    d = h.body_json()
    a = d.get("action")
    if a == "create":
        if backup_lock.locked():
            raise ApiError("Es läuft bereits eine Backup-Aufgabe")
        act(h, s, "backup-erstellen")
        threading.Thread(target=lambda: _bg(make_backup, "manuell", s["user"]), daemon=True).start()
        return h.json({"ok": True})
    name = os.path.basename(str(d.get("name", "")))
    p = safe_path(name, CONF["backup_dir"])
    if not os.path.isfile(p) or not name.endswith(".tar.gz"):
        raise ApiError("Backup nicht gefunden", 404)
    if a == "delete":
        os.remove(p)
        act(h, s, "backup-löschen", name)
    elif a == "restore":
        if backup_lock.locked():
            raise ApiError("Es läuft bereits eine Backup-Aufgabe")
        act(h, s, "backup-wiederherstellen", name)
        threading.Thread(target=lambda: _bg(restore_backup, name, s["user"]), daemon=True).start()
    else:
        raise ApiError("Unbekannte Aktion")
    h.json({"ok": True})


def _bg(fn, *args):
    try:
        fn(*args)
    except Exception as e:
        HUB.push_log("Fehler: %s" % e, "err")


# ── Panel / Admins ──

@api("GET", "/api/admins")
def r_admins(h, s, q):
    users = get_users()
    try:
        with open(AUDIT_PATH, encoding="utf-8") as f:
            lines = f.readlines()[-300:]
        log = [json.loads(l) for l in reversed(lines) if l.strip()]
    except OSError:
        log = []
    with sess_lock:
        active = {}
        for v in SESSIONS.values():
            if now() - v["last"] < 900:
                active[v["user"]] = max(active.get(v["user"], 0), v["last"])
    h.json({"admins": [{"name": n, "created": u.get("created"), "active": active.get(n)} for n, u in
                       sorted(users.items())],
            "audit": log, "settings": {k: CONF.get(k) for k in ("auto_backup_hours", "auto_backup_keep",
                                                                 "public_address", "session_hours")}})


@api("POST", "/api/admins")
def r_admin_action(h, s, q):
    d = h.body_json()
    a = d.get("action")
    if a == "password":
        rec = get_users().get(s["user"])
        if not rec or not check_pw(str(d.get("old", "")), rec):
            raise ApiError("Aktuelles Passwort ist falsch")
        new = str(d.get("new", ""))
        if len(new) < 10:
            raise ApiError("Neues Passwort muss mindestens 10 Zeichen haben")
        set_user_pw(s["user"], new)
        act(h, s, "passwort-geändert")
    elif a == "add":
        name = str(d.get("name", "")).strip()
        if not re.fullmatch(r"[A-Za-z0-9_.\-]{2,32}", name):
            raise ApiError("Name: 2–32 Zeichen, nur Buchstaben, Zahlen, _ . -")
        if name in get_users():
            raise ApiError("Admin existiert bereits")
        pw = str(d.get("password", ""))
        if len(pw) < 10:
            raise ApiError("Passwort muss mindestens 10 Zeichen haben")
        set_user_pw(name, pw)
        act(h, s, "admin-hinzugefügt", name)
    elif a == "remove":
        name = str(d.get("name", ""))
        if name == s["user"]:
            raise ApiError("Du kannst dich nicht selbst entfernen")
        with users_lock:
            users = get_users()
            users.pop(name, None)
            save_json(USERS_PATH, users)
        with sess_lock:
            for k in [k for k, v in SESSIONS.items() if v["user"] == name]:
                SESSIONS.pop(k)
        act(h, s, "admin-entfernt", name)
    elif a == "settings":
        st = d.get("settings") or {}
        if "auto_backup_hours" in st:
            CONF["auto_backup_hours"] = max(0.0, min(168.0, float(st["auto_backup_hours"])))
        if "auto_backup_keep" in st:
            CONF["auto_backup_keep"] = max(1, min(100, int(st["auto_backup_keep"])))
        if "public_address" in st:
            CONF["public_address"] = str(st["public_address"]).strip()[:120]
        save_json(CONF_PATH, CONF)
        act(h, s, "panel-einstellungen", json.dumps(st, ensure_ascii=False)[:300])
    else:
        raise ApiError("Unbekannte Aktion")
    h.json({"ok": True})


# ── Weltkarte (BlueMap) ──

def bm_path(*parts):
    if LOADERS[detect_loader()]["family"] == "bukkit":
        return srv("plugins", "BlueMap", *parts)
    return srv("config", "bluemap", *parts)


def bm_conf(fname, key):
    try:
        with open(bm_path(fname), encoding="utf-8") as f:
            for line in f:
                m = re.match(r"\s*%s\s*:\s*(.+?)\s*$" % re.escape(key), line)
                if m:
                    return m.group(1).strip('"')
    except OSError:
        pass
    return None


def bm_info():
    mods = mod_files()
    port = bm_conf("webserver.conf", "port")
    return {
        "installed": any(n.lower().startswith("bluemap") and n.endswith(".jar") for n in mods),
        "disabled": any(n.lower().startswith("bluemap") and n.endswith(".jar.disabled") for n in mods),
        "configured": os.path.isfile(bm_path("core.conf")),
        "accepted": bm_conf("core.conf", "accept-download") == "true",
        "port": int(port) if port and port.isdigit() else 8100,
        "web": bm_conf("webserver.conf", "enabled") != "false",
        "threads": bm_conf("core.conf", "render-thread-count"),
    }


def bluemap_render_status():
    """Wertet „/bluemap“ und „/bluemap maps“ strukturiert aus."""
    out = rcon_try("bluemap")
    if out is None:
        return None
    maps_out = rcon_try("bluemap maps") or ""
    st = {"threads": 0, "paused": False, "current": None, "maps": [], "raw": out.strip()}
    m = re.search(r"(\d+) render-threads? (?:is|are) running", out)
    if m:
        st["threads"] = int(m.group(1))
    if re.search(r"render-threads? (?:is|are) (?:stopped|not running|paused)", out, re.I) or "stopped" in out.lower():
        st["paused"] = True
    cur = re.search(r"map (\S+) is currently being updated", out)
    if cur:
        st["current"] = {"map": cur.group(1),
                         "progress": float((re.search(r"progress: ([\d.]+)%", out) or [0, 0])[1] or 0),
                         "remaining": (re.search(r"remaining time: (.+)", out) or [None, None])[1],
                         "detail": (re.search(r"└ (updating .+)", out) or [None, None])[1]}
    block = None
    for line in maps_out.splitlines():
        hm = re.match(r"^\s*(\S)\s+(\S+)\s*$", line)
        if hm and not line.strip().startswith(("├", "└")):
            block = {"id": hm.group(2), "state": {"⛏": "rendering", "⌛": "pending"}.get(hm.group(1), "done"),
                     "progress": None, "pending": 0}
            st["maps"].append(block)
            continue
        if block is None:
            continue
        pm = re.search(r"being updated: ([\d.]+)%", line)
        if pm:
            block["progress"] = float(pm.group(1))
        tm = re.search(r"has (\d+) pending task", line)
        if tm:
            block["pending"] = int(tm.group(1))
    if st["current"]:
        for mp in st["maps"]:
            if mp["id"] == st["current"]["map"]:
                mp["remaining"] = st["current"]["remaining"]
    return st


@api("GET", "/api/map")
def r_map(h, s, q):
    info = bm_info()
    info["render"] = bluemap_render_status() if info["installed"] and info["accepted"] else None
    h.json(info)


@api("POST", "/api/map")
def r_map_action(h, s, q):
    a = h.body_json().get("action")
    if a == "accept":
        path = bm_path("core.conf")
        if not os.path.isfile(path):
            raise ApiError("BlueMap-Konfiguration fehlt – Server einmal mit BlueMap starten")
        with open(path, encoding="utf-8") as f:
            txt = f.read()
        txt, n = re.subn(r"(?m)^(\s*accept-download\s*:\s*)false\s*$", r"\1true", txt)
        if n:
            with open(path, "w", encoding="utf-8") as f:
                f.write(txt)
        act(h, s, "bluemap-download-akzeptiert", "Mojang-EULA zugestimmt")
        out = rcon_try("bluemap reload")
        return h.json({"ok": True, "output": out})
    cmds = {"pause": "bluemap stop", "resume": "bluemap start", "reload": "bluemap reload",
            "update": "bluemap update"}
    if a not in cmds:
        raise ApiError("Unbekannte Aktion")
    out = RCON.cmd(cmds[a])
    act(h, s, "bluemap-" + a)
    h.json({"ok": True, "output": out})


# ═════════════════════════ Externe Dienste (Modrinth, Fabric, Mojang) ═════════════════════════

UA = "blockhaus/%s (selbst gehostetes Minecraft-Server-Tool)" % VERSION
MODRINTH = "https://api.modrinth.com/v2"
DL_HOSTS = {"github.com", "api.adoptium.net", "cdn.modrinth.com", "maven.fabricmc.net", "meta.fabricmc.net", "piston-meta.mojang.com",
            "piston-data.mojang.com", "launchermeta.mojang.com", "fill-data.papermc.io", "api.purpurmc.org",
            "maven.minecraftforge.net", "maven.neoforged.net"}
TMP = os.path.join(DATA, "tmp")


def http_json(url, data=None, timeout=25):
    headers = {"User-Agent": UA, "Accept": "application/json"}
    body = None
    if data is not None:
        body = json.dumps(data).encode()
        headers["Content-Type"] = "application/json"
    try:
        with urllib.request.urlopen(urllib.request.Request(url, data=body, headers=headers), timeout=timeout) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise ApiError("Externer Dienst meldet Fehler %d" % e.code, 502)
    except (urllib.error.URLError, OSError, ValueError) as e:
        raise ApiError("Externer Dienst nicht erreichbar: %s" % getattr(e, "reason", e), 502)


def http_download(url, dest, sha512=None, sha1=None, limit=512 * 1024 * 1024, sha256=None, md5=None):
    parts = urllib.parse.urlsplit(url)
    if parts.scheme != "https" or parts.hostname not in DL_HOSTS:
        raise ApiError("Download-Quelle nicht erlaubt: %s" % parts.hostname)
    h512, h1, h256, h5 = hashlib.sha512(), hashlib.sha1(), hashlib.sha256(), hashlib.md5()
    tmp = dest + ".download"
    total = 0
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=90) as r, \
                open(tmp, "wb") as f:
            while True:
                chunk = r.read(256 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > limit:
                    raise ApiError("Download zu groß")
                h512.update(chunk)
                h1.update(chunk)
                h256.update(chunk)
                h5.update(chunk)
                f.write(chunk)
        for want, got in ((sha512, h512), (sha1, h1), (sha256, h256), (md5, h5)):
            if want and got.hexdigest() != want.lower():
                raise ApiError("Prüfsumme stimmt nicht – Download verworfen")
        os.replace(tmp, dest)
    except (urllib.error.URLError, OSError) as e:
        _unlink(tmp)
        raise ApiError("Download fehlgeschlagen: %s" % getattr(e, "reason", e), 502)
    except BaseException:
        _unlink(tmp)
        raise


def _unlink(p):
    try:
        os.remove(p)
    except OSError:
        pass


_hash_cache = {}


def file_sha512(p):
    st = os.stat(p)
    key = (p, st.st_size, st.st_mtime)
    if key not in _hash_cache:
        h = hashlib.sha512()
        with open(p, "rb") as f:
            for chunk in iter(lambda: f.read(1 << 20), b""):
                h.update(chunk)
        _hash_cache[key] = h.hexdigest()
    return _hash_cache[key]


def mc_version():
    return server_version().get("mc") or "26.2"


# ── 1. Mods per Klick (Modrinth) ──

mods_lock = threading.Lock()
_ident = {"key": None, "val": {}}


def mod_files(d=None):
    d = d or content_dir()
    if not d:
        return []
    try:
        return [n for n in sorted(os.listdir(d))
                if (n.endswith(".jar") or n.endswith(".jar.disabled")) and os.path.isfile(os.path.join(d, n))]
    except OSError:
        return []


def primary_file(v):
    return next((f for f in v["files"] if f.get("primary")), v["files"][0])


def installed_versions(d=None):
    """Datei → Modrinth-Version (per SHA-512 erkannt). Gecacht, solange sich der Ordner nicht ändert."""
    d = d or content_dir()
    files = mod_files(d)
    key = (d, tuple((f, os.path.getsize(os.path.join(d, f)), os.path.getmtime(os.path.join(d, f))) for f in files))
    if _ident["key"] == key:
        return _ident["val"]
    hashes = {file_sha512(os.path.join(d, f)): f for f in files}
    known = http_json(MODRINTH + "/version_files", {"hashes": list(hashes), "algorithm": "sha512"}) or {} \
        if hashes else {}
    val = {hashes[h]: v for h, v in known.items() if h in hashes}
    _ident.update(key=key, val=val)
    return val


def mod_updates(target_mc=None, target_ld=None, d=None):
    """Pro Datei im Mod-/Plugin-Ordner: gibt es eine Version für target_mc + target_ld (Standard: aktuelle)?
    status ∈ ok | update | missing | unknown (nicht auf Modrinth)."""
    mc = target_mc or mc_version()
    d = d or content_dir()
    if not d:
        return {}
    loaders = LOADERS[target_ld or detect_loader()]["mr"]
    inst = installed_versions(d)
    by_hash = {file_sha512(os.path.join(d, f)): f for f in inst}
    latest = {}
    if by_hash and loaders:
        latest = http_json(MODRINTH + "/version_files/update",
                           {"hashes": list(by_hash), "algorithm": "sha512", "loaders": loaders,
                            "game_versions": [mc]}) or {}
    out = {}
    for f in mod_files(d):
        cur = inst.get(f)
        if not cur:
            out[f] = {"status": "unknown"}
            continue
        e = {"project": cur["project_id"], "current": cur["version_number"]}
        new = latest.get(file_sha512(os.path.join(d, f)))
        if not new:
            e["status"] = "missing"
        elif new["id"] == cur["id"]:
            e["status"] = "ok"
        else:
            pf = primary_file(new)
            e.update(status="update", latest=new["version_number"], url=pf["url"],
                     filename=os.path.basename(pf["filename"]), sha512=pf["hashes"].get("sha512"))
        out[f] = e
    return out


def replace_mod(old, e, d=None):
    d = d or need_content_dir()
    new = e["filename"]
    if not new.endswith(".jar"):
        raise ApiError("Unerwarteter Dateiname: %s" % new)
    disabled = old.endswith(".disabled")
    dest = os.path.join(d, new + (".disabled" if disabled else ""))
    http_download(e["url"], dest, sha512=e.get("sha512"))
    if os.path.abspath(dest) != os.path.abspath(os.path.join(d, old)):
        _unlink(os.path.join(d, old))
    return os.path.basename(dest)


def pick_version(vs, loaders):
    """Neueste Release-Version, bevorzugt mit dem „eigenen“ Loader (z. B. paper vor bukkit)."""
    pool = [x for x in vs if x.get("version_type") == "release"] or vs
    for ld in loaders:
        for x in pool:
            if ld in (x.get("loaders") or []):
                return x
    return pool[0]


def install_project(pid, mc, have, done, depth=0, ld=None):
    ld = ld or detect_loader()
    L = LOADERS[ld]
    if not L["dir"]:
        raise ApiError("Vanilla unterstützt keine Mods oder Plugins")
    q = urllib.parse.urlencode({"loaders": json.dumps(L["mr"]), "game_versions": json.dumps([mc])})
    vs = http_json("%s/project/%s/version?%s" % (MODRINTH, urllib.parse.quote(pid, safe=""), q))
    if not vs:
        raise ApiError("Keine Version für %s %s gefunden" % (L["name"], mc))
    v = pick_version(vs, L["mr"])
    f = primary_file(v)
    name = os.path.basename(f["filename"])
    if not name.endswith(".jar"):
        raise ApiError("Unerwarteter Dateiname: %s" % name)
    d = srv(L["dir"])
    os.makedirs(d, exist_ok=True)
    http_download(f["url"], os.path.join(d, name), sha512=f["hashes"].get("sha512"))
    have.add(v["project_id"])
    done.append(name)
    for dep in v.get("dependencies") or []:
        if dep.get("dependency_type") == "required" and dep.get("project_id") \
                and dep["project_id"] not in have and depth < 3:
            install_project(dep["project_id"], mc, have, done, depth + 1, ld)


def search_facets(ld, mc):
    L = LOADERS[ld]
    if L["kind"] == "plugin":
        return [["categories:%s" % x for x in L["mr"]], ["versions:%s" % mc], ["project_type:plugin"]]
    return [["categories:%s" % L["mr"][0]], ["versions:%s" % mc], ["project_type:mod"],
            ["server_side:required", "server_side:optional"]]


@api("GET", "/api/modrinth/search")
def r_mr_search(h, s, q):
    mc = mc_version()
    ld = detect_loader()
    need_content_dir()
    facets = json.dumps(search_facets(ld, mc))
    params = urllib.parse.urlencode({"query": q.get("q", "")[:100], "facets": facets, "limit": 24,
                                     "offset": max(0, int(q.get("offset", 0) or 0)),
                                     "index": "relevance" if q.get("q") else "downloads"})
    r = http_json(MODRINTH + "/search?" + params) or {}
    keys = ("project_id", "slug", "title", "description", "icon_url", "downloads", "author", "server_side",
            "client_side", "categories", "date_modified")
    try:
        have = sorted({v["project_id"] for v in installed_versions().values()})
    except ApiError:
        have = []
    hits = [{k: x.get(k) for k in keys} for x in r.get("hits", [])]
    for x in hits:  # Loader-Namen nicht als Kategorie anzeigen
        x["categories"] = [c for c in (x.get("categories") or []) if c not in LOADER_CATS]
    h.json({"hits": hits, "total": r.get("total_hits", 0), "installed": have, "mc": mc, "loader": ld,
            "loaderName": LOADERS[ld]["name"], "kind": LOADERS[ld]["kind"]})


LOADER_CATS = {"fabric", "quilt", "forge", "neoforge", "paper", "spigot", "bukkit", "purpur", "folia", "sponge",
               "bungeecord", "velocity", "waterfall", "datapack", "liteloader", "modloader", "rift", "cursed"}


@api("POST", "/api/modrinth/install")
def r_mr_install(h, s, q):
    pid = str(h.body_json().get("project", ""))
    if not re.fullmatch(r"[A-Za-z0-9_\-]{2,64}", pid):
        raise ApiError("Ungültiges Projekt")
    need_content_dir()
    proj = http_json("%s/project/%s" % (MODRINTH, pid))
    if not proj:
        raise ApiError("Projekt nicht gefunden", 404)
    if proj.get("server_side") == "unsupported":
        raise ApiError("%s ist ein reiner Client-Mod und läuft nicht auf dem Server" % proj.get("title"))
    with mods_lock:
        have = {v["project_id"] for v in installed_versions().values()}
        if proj["id"] in have:
            raise ApiError("%s ist bereits installiert" % proj.get("title"))
        done = []
        install_project(proj["id"], mc_version(), have, done)
    act(h, s, "plugin-installiert" if LOADERS[detect_loader()]["kind"] == "plugin" else "mod-installiert", ", ".join(done))
    h.json({"ok": True, "installed": done})


@api("GET", "/api/modrinth/updates")
def r_mr_updates(h, s, q):
    h.json({"updates": mod_updates()})


@api("POST", "/api/modrinth/update")
def r_mr_update(h, s, q):
    d = h.body_json()
    with mods_lock:
        ups = mod_updates()
        todo = [f for f, e in ups.items() if e["status"] == "update" and (d.get("all") or f == d.get("file"))]
        if not todo:
            raise ApiError("Keine Updates verfügbar")
        done = [replace_mod(f, ups[f]) for f in todo]
    act(h, s, "mod-aktualisiert", ", ".join(done))
    h.json({"ok": True, "updated": done})


# ── 3. Zeitpläne ──

SCHED_PATH = os.path.join(DATA, "schedules.json")
sched_lock = threading.Lock()
SCHED_TYPES = ("restart", "stop", "start", "backup", "command", "broadcast")


def tz():
    try:
        return ZoneInfo(CONF.get("timezone") or "UTC")
    except Exception:
        return dt.timezone.utc


def _hm(t):
    try:
        hh, mm = (int(x) for x in str(t.get("time") or "05:00").split(":"))
        return hh, mm
    except ValueError:
        return 5, 0


def sched_next(t):
    if not t.get("enabled"):
        return None
    if t.get("mode") == "interval":
        iv = max(1, int(t.get("interval") or 60)) * 60
        return max(now(), (t.get("last_run") or t.get("created") or now()) + iv)
    hh, mm = _hm(t)
    days = t.get("days") or list(range(7))
    n = dt.datetime.now(tz())
    for d in range(8):
        c = (n + dt.timedelta(days=d)).replace(hour=hh, minute=mm, second=0, microsecond=0)
        if c > n and c.weekday() in days:
            return c.timestamp()
    return None


def sched_update(tid, **kw):
    with sched_lock:
        tasks = load_json(SCHED_PATH, [])
        for t in tasks:
            if t.get("id") == tid:
                t.update(kw)
        save_json(SCHED_PATH, tasks)


def exec_sched(t):
    typ = t["type"]
    active = svc_info().get("ActiveState") == "active"
    if t.get("only_players") and typ in ("restart", "command", "broadcast") and not HUB.stats.get("players"):
        if typ != "restart":
            return "übersprungen – niemand online"
    if typ in ("restart", "stop"):
        if not active:
            return "übersprungen – Server läuft nicht"
        warn = int(t.get("warn") or 0)
        if warn > 0 and HUB.stats.get("players"):
            planned_restart(warn, "Zeitplan", typ)
            return "%s mit %d s Countdown ausgelöst" % ("Neustart" if typ == "restart" else "Stopp", warn)
        svc_action(typ)
        return "Neustart ausgeführt" if typ == "restart" else "Server gestoppt"
    if typ == "start":
        if active:
            return "läuft bereits"
        svc_action("start")
        return "Server gestartet"
    if typ == "backup":
        return "Backup erstellt: " + make_backup("auto", "Zeitplan")
    if not active:
        return "übersprungen – Server läuft nicht"
    if typ == "broadcast":
        payload = json.dumps([{"text": "[Server] ", "color": "gold", "bold": True},
                              {"text": t.get("message", ""), "color": "white", "bold": False}], ensure_ascii=False)
        RCON.cmd("tellraw @a " + payload)
        return "Durchsage gesendet"
    outs = []
    for c in str(t.get("command", "")).splitlines():
        c = c.strip().lstrip("/")
        if c:
            outs.append(RCON.cmd(c) or "ok")
    return "ausgeführt: " + " | ".join(o.strip()[:80] for o in outs)[:300]


def run_sched(tid, key=None, user="Zeitplan"):
    with sched_lock:
        t = next((x for x in load_json(SCHED_PATH, []) if x.get("id") == tid), None)
    if not t:
        return
    sched_update(tid, last_run=now(), last_key=key, last_result="läuft …", last_ok=None)
    try:
        res, ok = exec_sched(t), True
    except Exception as e:
        res, ok = "Fehler: %s" % e, False
    sched_update(tid, last_result=res, last_ok=ok)
    HUB.push_log("Zeitplan „%s“: %s" % (t.get("name"), res), "sys" if ok else "err")
    audit(user, "-", "zeitplan", "%s: %s" % (t.get("name"), res))


def sched_loop():
    while True:
        try:
            n = dt.datetime.now(tz())
            key = n.strftime("%Y-%m-%d %H:%M")
            with sched_lock:
                tasks = load_json(SCHED_PATH, [])
            for t in tasks:
                if not t.get("enabled"):
                    continue
                if t.get("mode") == "interval":
                    iv = max(1, int(t.get("interval") or 60)) * 60
                    due = now() - (t.get("last_run") or t.get("created") or now()) >= iv
                else:
                    hh, mm = _hm(t)
                    due = (n.hour, n.minute) == (hh, mm) and n.weekday() in (t.get("days") or range(7)) \
                        and t.get("last_key") != key
                if due:
                    sched_update(t["id"], last_key=key, last_run=now())
                    threading.Thread(target=run_sched, args=(t["id"], key), daemon=True).start()
        except Exception as e:
            print("zeitplan:", e, file=sys.stderr)
        try:
            tempban_tick()
            maintenance_tick()
        except Exception as e:
            print("tempban/wartung:", e, file=sys.stderr)
        time.sleep(15)


@api("GET", "/api/schedules")
def r_sched(h, s, q):
    with sched_lock:
        tasks = load_json(SCHED_PATH, [])
    for t in tasks:
        t["next"] = sched_next(t)
    h.json({"tasks": tasks, "timezone": str(tz()), "now": now()})


@api("POST", "/api/schedules")
def r_sched_action(h, s, q):
    d = h.body_json()
    a = d.get("action")
    if a == "save":
        t = d.get("task") or {}
        typ = t.get("type")
        if typ not in SCHED_TYPES:
            raise ApiError("Ungültiger Typ")
        clean = {
            "id": t.get("id") if re.fullmatch(r"[0-9a-f]{8}", str(t.get("id", ""))) else secrets.token_hex(4),
            "name": str(t.get("name") or "").strip()[:60] or "Aufgabe", "type": typ,
            "mode": "interval" if t.get("mode") == "interval" else "daily",
            "time": str(t.get("time") or "05:00")[:5],
            "days": sorted({int(x) for x in (t.get("days") or range(7)) if 0 <= int(x) <= 6}),
            "interval": max(1, min(10080, int(t.get("interval") or 60))),
            "warn": max(0, min(3600, int(t.get("warn") or 0))),
            "command": "\n".join(str(t.get("command") or "").splitlines()[:20])[:1400],
            "message": re.sub(r"[\r\n]", " ", str(t.get("message") or ""))[:250],
            "enabled": bool(t.get("enabled", True)), "only_players": bool(t.get("only_players")),
        }
        if not re.fullmatch(r"([01]\d|2[0-3]):[0-5]\d", clean["time"]):
            raise ApiError("Uhrzeit bitte als HH:MM")
        if typ == "command" and not clean["command"].strip():
            raise ApiError("Bitte mindestens einen Befehl angeben")
        if typ == "broadcast" and not clean["message"].strip():
            raise ApiError("Bitte eine Nachricht angeben")
        with sched_lock:
            tasks = load_json(SCHED_PATH, [])
            old = next((x for x in tasks if x.get("id") == clean["id"]), None)
            if old:
                keep = {k: old[k] for k in ("created", "last_run", "last_result", "last_ok", "last_key") if k in old}
                old.clear()
                old.update(clean, **keep)
            else:
                clean["created"] = now()
                tasks.append(clean)
            save_json(SCHED_PATH, tasks)
        act(h, s, "zeitplan-gespeichert", clean["name"])
        return h.json({"ok": True, "id": clean["id"]})
    tid = str(d.get("id", ""))
    if a == "delete":
        with sched_lock:
            tasks = [x for x in load_json(SCHED_PATH, []) if x.get("id") != tid]
            save_json(SCHED_PATH, tasks)
        act(h, s, "zeitplan-gelöscht", tid)
    elif a == "toggle":
        with sched_lock:
            tasks = load_json(SCHED_PATH, [])
            for x in tasks:
                if x.get("id") == tid:
                    x["enabled"] = bool(d.get("enabled"))
            save_json(SCHED_PATH, tasks)
    elif a == "run":
        threading.Thread(target=run_sched, args=(tid, None, s["user"]), daemon=True).start()
        act(h, s, "zeitplan-manuell", tid)
    else:
        raise ApiError("Unbekannte Aktion")
    h.json({"ok": True})


# ── 4. Spieler-Historie (aus den Server-Logs) ──

HIST_LINE = re.compile(r"^\[(\d\d):(\d\d):(\d\d)\] \[Server thread/INFO\]: (.*)$")
DEATH_RE = re.compile(r"^(was |were |fell |drowned|died|blew up|burned|went |hit the ground|tried to swim|walked into|"
                      r"froze|starved|suffocated|withered|experienced kinetic|discovered the floor|didn't want to live|"
                      r"left the confines|is no more|got finished)")
_hist_cache = {}


def _classify(msg):
    m = re.match(r"^([A-Za-z0-9_]{1,16}) (joined|left) the game$", msg)
    if m:
        return ("join" if m[2] == "joined" else "leave", m[1], "")
    m = re.match(r"^(?:\[Not Secure\] )?<([A-Za-z0-9_]{1,16})> (.*)$", msg)
    if m:
        return ("chat", m[1], m[2])
    m = re.match(r"^([A-Za-z0-9_]{1,16}) has (?:made the advancement|completed the challenge|reached the goal) "
                 r"\[(.+)\]$", msg)
    if m:
        return ("adv", m[1], m[2])
    if msg.startswith("Starting minecraft server version"):
        return ("start", "", "")
    if msg.startswith("Stopping server"):
        return ("stop", "", "")
    m = re.match(r"^([A-Za-z0-9_]{1,16}) (.+)$", msg)
    if m and DEATH_RE.match(m[2]):
        return ("death", m[1], msg)
    return None


def parse_logfile(path, end_date):
    opener = gzip.open if path.endswith(".gz") else open
    rows = []
    with opener(path, "rt", encoding="utf-8", errors="replace") as f:
        for line in f:
            m = HIST_LINE.match(norm_log(line.rstrip("\n")))
            if m:
                ev = _classify(m[4])
                rows.append((int(m[1]) * 3600 + int(m[2]) * 60 + int(m[3]), ev))
    out, day, prev = [], end_date, None
    for sec, ev in reversed(rows):  # Datum rückwärts bestimmen (Logzeilen haben kein Datum)
        if prev is not None and sec > prev + 60:
            day -= dt.timedelta(days=1)
        prev = sec
        if ev:
            out.append((time.mktime(day.timetuple()) + sec,) + ev)
    out.reverse()
    return out


def log_events():
    d = srv("logs")
    events = []
    try:
        names = sorted(n for n in os.listdir(d) if re.fullmatch(r"\d{4}-\d\d-\d\d-\d+\.log\.gz", n))
    except OSError:
        names = []
    for n in names[-120:]:
        p = os.path.join(d, n)
        key = (p, os.path.getmtime(p))
        if key not in _hist_cache:
            y, mo, da = (int(x) for x in n[:10].split("-"))
            try:
                _hist_cache[key] = parse_logfile(p, dt.date(y, mo, da))
            except (OSError, EOFError, ValueError):
                _hist_cache[key] = []
        events += _hist_cache[key]
    p = os.path.join(d, "latest.log")
    if os.path.isfile(p):
        try:
            events += parse_logfile(p, dt.date.fromtimestamp(os.path.getmtime(p)))
        except OSError:
            pass
    events.sort(key=lambda e: e[0])
    return events


def known_player_names():
    names = {e.get("name") for e in load_json(srv("usercache.json"), []) if isinstance(e, dict)}
    for f in ("whitelist.json", "ops.json", "banned-players.json"):
        names |= {e.get("name") for e in load_json(srv(f), []) if isinstance(e, dict)}
    names.discard(None)
    return names


@api("GET", "/api/history")
def r_history(h, s, q):
    days = max(1, min(90, int(q.get("days", 30) or 30)))
    cutoff = now() - days * 86400
    names = known_player_names()
    online = set(HUB.stats.get("online") or [])
    sessions, open_, last_ts = [], {}, None
    chat, deaths, advs = [], [], []
    for ts, typ, name, text in log_events():
        if typ == "start":
            for n, st in open_.items():
                sessions.append([n, st, last_ts or ts])
            open_.clear()
        elif typ == "stop":
            for n, st in open_.items():
                sessions.append([n, st, ts])
            open_.clear()
        elif typ == "join":
            if name in open_:
                sessions.append([name, open_[name], ts])
            open_[name] = ts
        elif typ == "leave":
            if name in open_:
                sessions.append([name, open_.pop(name), ts])
        elif ts >= cutoff:
            if typ == "chat":
                chat.append([ts, name, text])
            elif typ == "death" and name in names:
                deaths.append([ts, name, text])
            elif typ == "adv":
                advs.append([ts, name, text])
        last_ts = ts
    for n, st in open_.items():
        sessions.append([n, st, None if n in online else last_ts])
    sessions = [x for x in sessions if x[2] is None or x[2] >= cutoff]
    board = []
    for uuid, info in uuid_names().items():
        stt = player_stats(uuid)
        if stt and info.get("name"):
            board.append(dict(stt, name=info["name"], uuid=uuid))
    h.json({"sessions": sessions[-3000:], "chat": chat[-500:], "deaths": deaths[-300:], "advancements": advs[-300:],
            "leaderboard": sorted(board, key=lambda b: -b["playTime"]), "online": sorted(online), "now": now()})


# ── 5. Inventar ──

_client = {"path": None, "zip": None, "lang": {}}
_icon_cache = {}
client_lock = threading.Lock()


def client_jar():
    with client_lock:
        path = srv("bluemap", "minecraft-client-%s.jar" % mc_version())
        if not os.path.isfile(path):
            try:
                cands = sorted(n for n in os.listdir(srv("bluemap")) if n.startswith("minecraft-client-"))
                path = srv("bluemap", cands[-1]) if cands else None
            except OSError:
                path = None
        if path != _client["path"]:
            _client.update(path=path, zip=None, lang={})
            if path:
                try:
                    z = zipfile.ZipFile(path)
                    _client["zip"] = z
                    _client["lang"] = json.loads(z.read("assets/minecraft/lang/en_us.json"))
                except (OSError, KeyError, ValueError, zipfile.BadZipFile):
                    pass
        return _client["zip"], _client["lang"]


def _pretty(k):
    return k.replace("_", " ").title()


def _text(v):
    if isinstance(v, str):
        try:
            v = json.loads(v)
        except ValueError:
            return v
    if isinstance(v, dict):
        return (v.get("text") or "") + "".join(_text(x) for x in v.get("extra", []) or [])
    if isinstance(v, list):
        return "".join(_text(x) for x in v)
    return str(v) if v is not None else ""


def nbt_plain(v):
    if isinstance(v, dict):
        return {k: nbt_plain(x[1]) if isinstance(x, tuple) else nbt_plain(x) for k, x in v.items()}
    if isinstance(v, list):
        return [nbt_plain(x) for x in v]
    return v


def item_view(it, lang, depth=0):
    if not isinstance(it, dict) or not it.get("id"):
        return None
    iid = it["id"]
    ns, k = (iid.split(":", 1) + [""])[:2] if ":" in iid else ("minecraft", iid)
    comps = it.get("components") or {}

    def enchs(key):
        e = comps.get(key) or {}
        if isinstance(e, dict) and isinstance(e.get("levels"), dict):
            e = e["levels"]
        out = []
        for eid, lvl in (e.items() if isinstance(e, dict) else []):
            en, ek = eid.split(":", 1) if ":" in eid else ("minecraft", eid)
            out.append([lang.get("enchantment.%s.%s" % (en, ek)) or _pretty(ek), lvl])
        return out

    v = {"id": iid, "count": it.get("count", it.get("Count", 1)),
         "name": lang.get("item.%s.%s" % (ns, k)) or lang.get("block.%s.%s" % (ns, k)) or _pretty(k),
         "ench": enchs("minecraft:enchantments") + enchs("minecraft:stored_enchantments")}
    if comps.get("minecraft:custom_name") is not None:
        v["custom"] = _text(comps["minecraft:custom_name"])[:80]
    if comps.get("minecraft:damage"):
        v["damage"] = comps["minecraft:damage"]
    cont = comps.get("minecraft:container")
    if isinstance(cont, list) and depth < 1:
        v["contents"] = [x for x in (item_view(c.get("item"), lang, depth + 1) for c in cont if isinstance(c, dict))
                         if x]
    return v


# ── SNBT (Text-NBT, wie es „/data get“ ausgibt) ──
_SNBT_NUM = re.compile(r"[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?([bslfd]?)$", re.I)
_SNBT_BARE = re.compile(r"[A-Za-z0-9._+\-]+")


def snbt_parse(text):
    s, n = text, len(text)
    i = 0

    def ws():
        nonlocal i
        while i < n and s[i] in " \t\r\n":
            i += 1

    def qstr():
        nonlocal i
        q = s[i]
        i += 1
        out = []
        while i < n and s[i] != q:
            if s[i] == "\\" and i + 1 < n:
                i += 1
                out.append({"n": "\n", "t": "\t"}.get(s[i], s[i]))
            else:
                out.append(s[i])
            i += 1
        if i >= n:
            raise ValueError("SNBT: Zeichenkette offen")
        i += 1
        return "".join(out)

    def scalar(tok):
        m = _SNBT_NUM.match(tok)
        if m:
            suf = m.group(1).lower()
            body = tok[:-1] if suf else tok
            if suf in ("f", "d") or (not suf and any(c in body for c in ".eE")):
                return float(body)
            return int(body)
        if tok == "true":
            return 1
        if tok == "false":
            return 0
        return tok

    def value():
        nonlocal i
        ws()
        if i >= n:
            raise ValueError("SNBT: unerwartetes Ende")
        c = s[i]
        if c == "{":
            i += 1
            d = {}
            ws()
            if i < n and s[i] == "}":
                i += 1
                return d
            while True:
                ws()
                if s[i] in "\"'":
                    k = qstr()
                else:
                    m = _SNBT_BARE.match(s, i)
                    if not m:
                        raise ValueError("SNBT: Schlüssel erwartet bei %d" % i)
                    k = m.group(0)
                    i = m.end()
                ws()
                if s[i] != ":":
                    raise ValueError("SNBT: ':' erwartet bei %d" % i)
                i += 1
                d[k] = value()
                ws()
                if s[i] == ",":
                    i += 1
                    continue
                if s[i] == "}":
                    i += 1
                    return d
                raise ValueError("SNBT: ',' oder '}' erwartet bei %d" % i)
        if c == "[":
            i += 1
            ws()
            if i + 1 < n and s[i] in "BIL" and s[i + 1] == ";":  # [I; 1, 2] usw.
                i += 2
            out = []
            ws()
            if s[i] == "]":
                i += 1
                return out
            while True:
                out.append(value())
                ws()
                if s[i] == ",":
                    i += 1
                    continue
                if s[i] == "]":
                    i += 1
                    return out
                raise ValueError("SNBT: ',' oder ']' erwartet bei %d" % i)
        if c in "\"'":
            return qstr()
        m = _SNBT_BARE.match(s, i)
        if not m:
            raise ValueError("SNBT: Wert erwartet bei %d" % i)
        i = m.end()
        return scalar(m.group(0))

    v = value()
    return v


_LIVE_PATHS = ("Inventory", "equipment", "EnderItems", "Health", "foodLevel", "foodSaturationLevel", "XpLevel",
               "XpP", "Pos", "Dimension", "playerGameType", "SelectedItemSlot", "LastDeathLocation")


def _uuid_from_ints(a):
    if not isinstance(a, list) or len(a) != 4:
        return None
    return "%032x" % int.from_bytes(b"".join(int(x).to_bytes(4, "big", signed=True) for x in a), "big")


def player_live_data(name, uuid):
    """Liest die Spielerdaten direkt aus dem laufenden Server (statt aus der zuletzt gespeicherten Datei)."""
    def get(path):
        out = rcon_try("data get entity %s %s" % (name, path))
        if not out or "has the following entity data: " not in out:
            return None
        try:
            return snbt_parse(out.split("has the following entity data: ", 1)[1])
        except (ValueError, IndexError):
            return None
    if _uuid_from_ints(get("UUID")) != uuid.replace("-", ""):
        return None  # Name gehört nicht zu dieser UUID oder Spieler ist gerade weg
    return {k: v for k in _LIVE_PATHS if (v := get(k)) is not None}


@api("GET", "/api/players/inventory")
def r_inventory(h, s, q):
    uuid = q.get("uuid", "")
    if not re.fullmatch(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", uuid):
        raise ApiError("Ungültige UUID")
    name = q.get("name", "")
    d, mtime, live = None, None, False
    if re.fullmatch(r"[A-Za-z0-9_]{1,16}", name) and name in (HUB.stats.get("online") or []):
        d = player_live_data(name, uuid)
        if d is not None and "Inventory" in d:
            mtime, live = now(), True
        else:
            d = None
    if d is None:
        if q.get("refresh") and svc_info().get("ActiveState") == "active":
            rcon_try("save-all")
            time.sleep(1.5)
        level = read_props().get("level-name", "world")
        path = next((p for p in (srv(level, "players", "data", uuid + ".dat"), srv(level, "playerdata", uuid + ".dat"))
                     if os.path.isfile(p)), None)
        if not path:
            raise ApiError("Keine Spielerdaten vorhanden (war noch nie auf dem Server?)", 404)
        raw = open(path, "rb").read()
        try:
            raw = gzip.decompress(raw)
        except OSError:
            pass
        d = nbt_plain(nbt_parse(raw))
        mtime = os.path.getmtime(path)
    _, lang = client_jar()
    inv = []
    for it in d.get("Inventory") or []:
        v = item_view(it, lang)
        if v:
            v["slot"] = it.get("Slot", 0)
            inv.append(v)
    eq = d.get("equipment") or {}
    equipment = {k: item_view(eq.get(k), lang) for k in ("head", "chest", "legs", "feet", "offhand", "body")}
    for slot, k in ((103, "head"), (102, "chest"), (101, "legs"), (100, "feet"), (-106, "offhand")):  # altes Format
        if not equipment.get(k):
            old = next((x for x in inv if x["slot"] == slot), None)
            if old:
                equipment[k] = old
    ender = []
    for it in d.get("EnderItems") or []:
        v = item_view(it, lang)
        if v:
            v["slot"] = it.get("Slot", 0)
            ender.append(v)
    death = d.get("LastDeathLocation") or {}
    h.json({
        "mtime": mtime, "live": live, "health": d.get("Health"), "food": d.get("foodLevel"),
        "saturation": d.get("foodSaturationLevel"), "xpLevel": d.get("XpLevel"), "xpP": d.get("XpP"),
        "pos": d.get("Pos"), "dim": d.get("Dimension"), "gamemode": d.get("playerGameType"),
        "selected": d.get("SelectedItemSlot"), "inventory": [x for x in inv if 0 <= x["slot"] <= 35],
        "equipment": equipment, "ender": ender,
        "lastDeath": {"pos": death.get("pos"), "dim": death.get("dimension")} if death else None,
        "icons": bool(_client["zip"]),
    })


_tex_cache = {}
TEX_RE = re.compile(r"^(block|item|entity/equipment/humanoid|entity/equipment/humanoid_leggings)/[a-z0-9_]{1,64}$")


@api("GET", "/api/texture")
def r_texture(h, s, q):
    """Einzelne Minecraft-Textur aus der Client-Datei (für Design-Akzente und die 3D-Rüstung)."""
    p = q.get("p", "")
    if not TEX_RE.match(p):
        raise ApiError("Ungültige Textur")
    if p not in _tex_cache:
        z, _ = client_jar()
        try:
            _tex_cache[p] = z.read("assets/minecraft/textures/%s.png" % p) if z else None
        except KeyError:
            _tex_cache[p] = None
    if not _tex_cache[p]:
        raise ApiError("Keine Textur", 404)
    h.send_body(200, _tex_cache[p], "image/png", {"Cache-Control": "private, max-age=604800"})


ICON_SUFFIX = ("_stairs", "_slab", "_wall", "_fence_gate", "_fence", "_pressure_plate", "_button", "_door",
               "_trapdoor", "_carpet", "_pane", "_sign", "_hanging_sign")


@api("GET", "/api/itemicon")
def r_itemicon(h, s, q):
    iid = q.get("id", "")
    if not re.fullmatch(r"[a-z0-9_.\-]+:[a-z0-9_./\-]+", iid):
        raise ApiError("Ungültige ID")
    if iid not in _icon_cache:
        z, _ = client_jar()
        data = None
        if z:
            ns, n = iid.split(":", 1)
            names = [n]
            for suf in ICON_SUFFIX:
                if n.endswith(suf):
                    base = n[:-len(suf)]
                    names += [base, base + "s", base + "_planks", base + "_block"]
            cands = []
            for nm in names:
                cands += ["item/%s.png" % nm, "block/%s.png" % nm, "block/%s_front.png" % nm,
                          "block/%s_side.png" % nm, "block/%s_top.png" % nm, "item/%s_00.png" % nm]
            for c in cands:
                try:
                    data = z.read("assets/%s/textures/%s" % (ns, c))
                    break
                except KeyError:
                    continue
        if len(_icon_cache) > 4000:
            _icon_cache.clear()
        _icon_cache[iid] = data
    data = _icon_cache[iid]
    if not data:
        raise ApiError("Kein Icon", 404)
    h.send_body(200, data, "image/png", {"Cache-Control": "private, max-age=604800"})


# ── 7. Absturz-Analyse ──

_crash_cache = {}
_mod_index = {"key": None, "val": None}
GENERIC_PKG = ("net.minecraft", "com.mojang", "java.", "jdk.", "sun.", "javax.", "org.spongepowered",
               "net.fabricmc.loader", "com.google", "io.netty", "it.unimi", "org.apache", "org.slf4j",
               "com.llamalad7", "org.objectweb", "META-INF", "assets.", "data.", "net.minecraftforge.fml",
               "net.neoforged.fml", "org.bukkit", "io.papermc", "org.spigotmc", "net.kyori", "kotlin.")
CRASH_HINTS = [
    ("OutOfMemoryError", "Dem Server ist der Arbeitsspeicher ausgegangen. -Xmx in start.sh erhöhen oder Sichtweite senken."),
    ("Incompatible mods found", "Mods passen nicht zusammen oder zur Minecraft-Version. Unter „Mods“ prüfen und Updates einspielen."),
    ("Mixin apply", "Ein Mod ist nicht mit dieser Minecraft-Version kompatibel (Mixin-Fehler). Den verdächtigen Mod aktualisieren oder deaktivieren."),
    ("MixinApplyError", "Ein Mod ist nicht mit dieser Minecraft-Version kompatibel (Mixin-Fehler). Den verdächtigen Mod aktualisieren oder deaktivieren."),
    ("Watching Server", "Der Server hing zu lange in einem Tick (Watchdog). Oft durch riesige Farmen, Redstone oder einen Mod. Die Lag-Analyse hilft weiter."),
    ("A single server tick took", "Der Server hing zu lange in einem Tick (Watchdog). Oft durch riesige Farmen, Redstone oder einen Mod. Die Lag-Analyse hilft weiter."),
    ("UnsupportedClassVersionError", "Die Java-Version ist zu alt für den Server oder einen Mod."),
    ("FAILED TO BIND", "Der Port ist schon belegt – läuft der Server doppelt oder nutzt ein anderes Programm den Port?"),
    ("Address already in use", "Der Port ist schon belegt – läuft der Server doppelt oder nutzt ein anderes Programm den Port?"),
    ("ConcurrentModificationException", "Ein Mod greift gleichzeitig von mehreren Threads auf Daten zu. Meist ein Mod-Fehler – verdächtigen Mod aktualisieren."),
    ("StackOverflowError", "Eine Endlosschleife (Stack Overflow). Häufig Redstone-Schaltungen oder ein Mod-Fehler."),
    ("NoSuchMethodError", "Ein Mod erwartet eine andere Version von Minecraft oder einem anderen Mod."),
    ("NoClassDefFoundError", "Eine benötigte Bibliothek oder ein Abhängigkeits-Mod fehlt."),
    ("Exception ticking entity", "Ein einzelnes Entity hat den Absturz ausgelöst. Die Position steht unten im Report."),
    ("Exception ticking world", "Beim Verarbeiten der Welt ist ein Fehler aufgetreten – oft ein Block oder Entity eines Mods."),
    ("SIGSEGV", "Die Java-VM selbst ist abgestürzt (z. B. Speicherfehler). Java aktualisieren; tritt es öfter auf, RAM der VM prüfen."),
]


def crash_files():
    out = []
    try:
        for n in os.listdir(srv("crash-reports")):
            if n.endswith(".txt"):
                out.append("crash-reports/" + n)
    except OSError:
        pass
    try:
        out += [n for n in os.listdir(CONF["server_dir"]) if n.startswith("hs_err_pid") and n.endswith(".log")]
    except OSError:
        pass
    return out


def last_crash_time():
    t = 0
    for rel in crash_files():
        try:
            t = max(t, os.path.getmtime(srv(rel)))
        except OSError:
            pass
    return t or None


def mod_index():
    files = [f for f in mod_files() if f.endswith(".jar")]
    key = (content_dir(), tuple((f, os.path.getmtime(content_dir(f))) for f in files))
    if _mod_index["key"] == key:
        return _mod_index["val"]
    prefix, ids, mixins = {}, {}, {}
    for f in files:
        meta = mod_meta(content_dir(f))
        try:
            with zipfile.ZipFile(content_dir(f)) as z:
                names = z.namelist()
        except (OSError, zipfile.BadZipFile, ValueError):
            continue
        name = meta.get("name") or f
        if meta.get("id"):
            ids[meta["id"]] = name
        for cfg in meta.get("mixins") or []:
            mixins[cfg] = name
        if meta.get("main") and meta["main"].count(".") >= 2:  # Plugin: Paket der Hauptklasse
            prefix[".".join(meta["main"].split(".")[:3])] = name
        counts = {}
        for n in names:
            if n.endswith(".class") and n.count("/") >= 3:
                p = ".".join(n.split("/")[:3])
                counts[p] = counts.get(p, 0) + 1
        for p, c in sorted(counts.items(), key=lambda x: -x[1])[:12]:
            if c >= 2 and not p.startswith(GENERIC_PKG):
                prefix[p] = name
        if meta.get("id") == "fabric-api":
            prefix["net.fabricmc.fabric"] = name
    val = {"prefix": prefix, "ids": ids, "mixins": mixins}
    _mod_index.update(key=key, val=val)
    return val


def analyze_crash(text, rel):
    lines = text.splitlines()
    a = {"description": None, "exception": None, "causes": [], "suspects": [], "hint": None,
         "kind": "jvm" if rel.startswith("hs_err") else "minecraft"}
    if a["kind"] == "jvm":
        a["description"] = "Absturz der Java-VM"
        summ = [l[2:].strip() for l in lines[:40] if l.startswith("# ") and l[2:].strip()]
        a["exception"] = " · ".join(summ[:3])[:400]
    else:
        for i, l in enumerate(lines):
            if l.startswith("Description:"):
                a["description"] = l.split(":", 1)[1].strip()
                for nxt in lines[i + 1:i + 6]:
                    if nxt.strip():
                        a["exception"] = nxt.strip()[:400]
                        break
                break
        a["causes"] = [l.strip()[:300] for l in lines if l.strip().startswith("Caused by:")][:5]
    idx = mod_index()
    score = {}
    for l in lines[:6000]:
        st = l.strip()
        if st.startswith("at "):
            frame = st[3:]
            for p, mod in idx["prefix"].items():
                if frame.startswith(p + "."):
                    score[mod] = score.get(mod, 0) + 3
            for mid in set(re.findall(r"(?<=\$)([a-z0-9_\-]{2,64})(?=\$)", frame)):
                if mid in idx["ids"] and mid not in ("minecraft", "java", "fabricloader", "forge", "neoforge"):
                    score[idx["ids"][mid]] = score.get(idx["ids"][mid], 0) + 2
        for cfg, mod in idx["mixins"].items():
            if cfg in st:
                score[mod] = score.get(mod, 0) + 2
    a["suspects"] = [[m, sc] for m, sc in sorted(score.items(), key=lambda x: -x[1])[:3]]
    for needle, hint in CRASH_HINTS:
        if needle in text:
            a["hint"] = hint
            break
    return a


def crash_entry(rel):
    p = safe_path(rel)
    st = os.stat(p)
    key = (rel, st.st_mtime)
    if key not in _crash_cache:
        with open(p, encoding="utf-8", errors="replace") as f:
            text = f.read(3 * 1024 * 1024)
        _crash_cache[key] = analyze_crash(text, rel)
    return dict(_crash_cache[key], path=rel, mtime=st.st_mtime, size=st.st_size)


@api("GET", "/api/crashes")
def r_crashes(h, s, q):
    items = []
    for rel in crash_files():
        try:
            items.append(crash_entry(rel))
        except OSError:
            pass
    items.sort(key=lambda x: -x["mtime"])
    info = svc_info()
    h.json({"crashes": items[:100], "serviceState": info.get("ActiveState")})


@api("GET", "/api/crashes/view")
def r_crash_view(h, s, q):
    rel = q.get("path", "")
    if rel not in crash_files():
        raise ApiError("Unbekannter Report", 404)
    with open(safe_path(rel), encoding="utf-8", errors="replace") as f:
        text = f.read(3 * 1024 * 1024)
    h.json({"text": text, "analysis": crash_entry(rel)})


@api("POST", "/api/crashes")
def r_crash_action(h, s, q):
    d = h.body_json()
    rel = str(d.get("path", ""))
    if d.get("action") != "delete" or rel not in crash_files():
        raise ApiError("Ungültig")
    _unlink(safe_path(rel))
    act(h, s, "crash-report-gelöscht", rel)
    h.json({"ok": True})


# ── 9. Lag-Analyse (spark) ──

SPARK_PATH = os.path.join(DATA, "spark.json")
SPARK_URL = re.compile(r"https://spark\.lucko\.me/[A-Za-z0-9]+")
spark_lock = threading.Lock()
spark_pending = {"kind": None, "t": 0}


def spark_record(line):
    m = SPARK_URL.search(line)
    if not m:
        return
    with spark_lock:
        reps = load_json(SPARK_PATH, [])
        if any(r["url"] == m.group(0) for r in reps):
            return
        kind = spark_pending["kind"] if now() - spark_pending["t"] < 900 else None
        reps.insert(0, {"url": m.group(0), "t": now(), "kind": kind or "bericht"})
        save_json(SPARK_PATH, reps[:100])


def spark_installed():
    if LOADERS[detect_loader()]["family"] == "bukkit":
        return True  # Paper und Purpur bringen spark bereits mit
    return any(n.lower().startswith("spark") and n.endswith(".jar") for n in mod_files())


@api("GET", "/api/spark")
def r_spark(h, s, q):
    h.json({"installed": spark_installed(), "reports": load_json(SPARK_PATH, []),
            "running": svc_info().get("ActiveState") == "active"})


@api("POST", "/api/spark")
def r_spark_action(h, s, q):
    d = h.body_json()
    a = d.get("action")
    if a == "install":
        if spark_installed():
            raise ApiError("spark ist bereits installiert")
        need_content_dir()
        with mods_lock:
            done = []
            install_project("spark", mc_version(), set(), done)
        act(h, s, "mod-installiert", ", ".join(done))
        return h.json({"ok": True, "installed": done})
    if a == "profile":
        sec = max(10, min(600, int(d.get("seconds") or 60)))
        cmd = "spark profiler start --timeout %d" % sec
        spark_pending.update(kind="profiler", t=now())
    elif a == "stop":
        cmd = "spark profiler stop"
    elif a == "health":
        cmd = "spark health --upload"
        spark_pending.update(kind="health", t=now())
    elif a == "heap":
        cmd = "spark heapsummary"
        spark_pending.update(kind="heap", t=now())
    elif a == "tps":
        cmd = "spark tps"
    else:
        raise ApiError("Unbekannte Aktion")
    out = RCON.cmd(cmd)
    act(h, s, "spark-" + a)
    HUB.push_log("%s › /%s" % (s["user"], cmd), "cmd")
    if out and out.strip():
        for line in out.splitlines():
            if line.strip():
                HUB.push_log(line, "out")
    h.json({"ok": True, "output": out})


# ── 12. Server-Software: Updates und Wechsel (Vanilla, Fabric, Forge, NeoForge, Paper, Purpur) ──

update_lock = threading.Lock()


def java_info():
    """Fest eingestelltes oder System-Java: (Pfad, Hauptversion)."""
    j = CONF.get("java") if CONF.get("java") not in (None, "", "auto") else shutil.which("java")
    if not j:
        return None, None
    return j, osutil.java_version(j)


MOJANG_MANIFEST = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json"
FABRIC_META = "https://meta.fabricmc.net/v2"
PAPER_API = "https://fill.papermc.io/v3/projects/paper"
PURPUR_API = "https://api.purpurmc.org/v2/purpur"
FORGE_PROMOS = "https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json"
FORGE_MAVEN = "https://maven.minecraftforge.net/net/minecraftforge/forge"
NEO_VERSIONS = "https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge"
NEO_MAVEN = "https://maven.neoforged.net/releases/net/neoforged/neoforge"
REL_RE = re.compile(r"^\d+(?:\.\d+)+$")
_meta_cache = {}


def cached_json(url, ttl=600):
    e = _meta_cache.get(url)
    if e and now() - e[0] < ttl:
        return e[1]
    v = http_json(url)
    if v is not None:
        _meta_cache[url] = (now(), v)
    return v


def http_text(url, limit=4096):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=30) as r:
            return r.read(limit).decode("utf-8", "replace")
    except (urllib.error.URLError, OSError):
        return None


def remote_sha1(url):
    t = http_text(url + ".sha1")
    m = re.match(r"^\s*([0-9a-fA-F]{40})\b", t or "")
    return m.group(1) if m else None


def java_required(mc):
    man = cached_json(MOJANG_MANIFEST) or {}
    v = next((x for x in man.get("versions", []) if x.get("id") == mc), None)
    if not v:
        return None
    det = cached_json(v["url"], ttl=86400) or {}
    return (det.get("javaVersion") or {}).get("majorVersion")


# ── Java automatisch bereitstellen (Eclipse Temurin über die Adoptium-API) ──

ADOPTIUM = "https://api.adoptium.net/v3"
JAVA_DIR = os.path.join(DATA, "java")
java_lock = threading.Lock()


def managed_javas():
    """Von Blockhaus geladene Java-Versionen: {Hauptversion: Pfad zur java-Datei}."""
    out = {}
    try:
        for n in os.listdir(JAVA_DIR):
            m = re.fullmatch(r"temurin-(\d+)", n)
            exe = osutil.java_exe(os.path.join(JAVA_DIR, n)) if m else None
            if exe:
                out[int(m.group(1))] = exe
    except OSError:
        pass
    return out


def java_auto():
    return not use_systemd() and CONF.get("java") in (None, "", "auto")


def java_for(mc, install=True, step=None):
    """Pfad zu einem Java, das Minecraft mc starten kann. Lädt es bei Bedarf herunter (install=True)."""
    if not java_auto():
        return java_info()[0]
    try:
        req = java_required(mc) if mc else None
    except ApiError:  # offline – dann nimmt man, was da ist
        req = None
    target = java_target(req)
    ok = (lambda v: req <= v <= target) if req else (lambda v: True)  # wie der Minecraft-Launcher: passend, nicht „neuer“
    have = managed_javas()
    fits = sorted((m for m in have if ok(m)), reverse=True)
    if fits:
        return have[fits[0]]
    sj = shutil.which("java")
    sv = osutil.java_version(sj) if sj else None
    if sv and ok(sv):
        return sj
    if not install:
        return None
    return install_java(req or 21, step)


def java_target(req):
    """Die LTS-Version, die Blockhaus für „mindestens Java req“ lädt (z. B. 16 → 17)."""
    if not req:
        return None
    try:
        lts = (cached_json(ADOPTIUM + "/info/available_releases", ttl=86400) or {}).get("available_lts_releases") or []
    except ApiError:
        lts = []
    return min([m for m in lts if m >= req] or [req])


def install_java(req, step=None):
    with java_lock:
        major = java_target(req)
        have = managed_javas()
        if major in have:
            return have[major]
        os_name, arch = osutil.java_platform()
        pkg = None
        for a in dict.fromkeys((arch, "x64")):  # z. B. Windows auf ARM: x64-Java läuft per Emulation
            for image in ("jre", "jdk"):
                r = http_json("%s/assets/latest/%d/hotspot?architecture=%s&image_type=%s&os=%s&vendor=eclipse"
                              % (ADOPTIUM, major, a, image, os_name))
                if r:
                    pkg = r[0]["binary"]["package"]
                    break
            if pkg:
                break
        if not pkg:
            raise RuntimeError("Für dieses System gibt es kein Java %d zum Herunterladen – bitte selbst installieren"
                               % major)
        msg = "lade Java %d (Eclipse Temurin, %d MB) …" % (major, (pkg.get("size") or 0) // 1048576)
        if step:
            step(msg)
        else:
            HUB.set_task({"kind": "java", "msg": msg[0].upper() + msg[1:], "t": now()})
        os.makedirs(TMP, exist_ok=True)
        os.makedirs(JAVA_DIR, exist_ok=True)
        arc = os.path.join(TMP, os.path.basename(pkg["name"]))
        dest = os.path.join(JAVA_DIR, "temurin-%d" % major)
        work = dest + ".part"
        try:
            http_download(pkg["link"], arc, sha256=pkg.get("checksum"), limit=600 * 1024 * 1024)
            shutil.rmtree(work, ignore_errors=True)
            home = osutil.extract_archive(arc, work)
            shutil.rmtree(dest, ignore_errors=True)
            os.replace(home, dest)
        finally:
            shutil.rmtree(work, ignore_errors=True)
            _unlink(arc)
            if not step:
                HUB.set_task(None)
        exe = osutil.java_exe(dest)
        if not exe or not osutil.java_version(exe):
            raise RuntimeError("Java %d wurde geladen, startet aber nicht" % major)
        HUB.push_log("Java %d bereitgestellt: %s" % (major, exe), "sys")
        return exe


def java_status(mc):
    """(Pfad, Hauptversion, wird beim Start automatisch geladen)."""
    if not java_auto():
        j, v = java_info()
        return j, v, False
    j = java_for(mc, install=False)
    return (j, osutil.java_version(j), False) if j else (None, None, True)


# ── Startbefehl (wenn Blockhaus den Server selbst startet) ──

GC_FLAGS = [  # bewährte „Aikar-Flags“: kurze, gleichmäßige GC-Pausen statt Ruckler
    "-XX:+UseG1GC", "-XX:+ParallelRefProcEnabled", "-XX:MaxGCPauseMillis=200", "-XX:+UnlockExperimentalVMOptions",
    "-XX:+DisableExplicitGC", "-XX:G1NewSizePercent=30", "-XX:G1MaxNewSizePercent=40", "-XX:G1HeapRegionSize=8M",
    "-XX:G1ReservePercent=20", "-XX:G1HeapWastePercent=5", "-XX:G1MixedGCCountTarget=4",
    "-XX:InitiatingHeapOccupancyPercent=15", "-XX:G1MixedGCLiveThresholdPercent=90",
    "-XX:G1RSetUpdatingPauseTimePercent=5", "-XX:SurvivorRatio=32", "-XX:MaxTenuringThreshold=1",
    "-XX:G1PeriodicGCInterval=300000",  # ungenutzten Speicher nach 5 Min. Leerlauf zurückgeben
    "-Dusing.aikars.flags=https://mcflags.emc.gs", "-Daikars.new.flags=true"]


def ram_limits():
    """(min, max) Arbeitsspeicher für Java in MB."""
    total = (osutil.Metrics().memory()[0] or 4 * 1024 ** 3) // (1024 * 1024)
    mx = int(CONF.get("ram_max_mb") or max(1024, min(8192, total // 2)))
    mn = int(CONF.get("ram_min_mb") or min(mx, max(512, mx // 4)))
    return min(mn, mx), mx


def launch_args():
    c = launch_conf()
    if c.get("_launch"):
        return c["_launch"]
    ld = detect_loader()
    if ld in ("forge", "neoforge"):
        v = server_version()
        return forge_launch(ld, v.get("mc"), v.get("loaderVersion"))
    return ["-jar", {"fabric": "fabric-server-launch.jar", "paper": "paper.jar", "purpur": "purpur.jar"}.get(ld, "server.jar")]


def eula_accepted():
    try:
        with open(srv("eula.txt"), encoding="utf-8") as f:
            return any(l.strip().lower() == "eula=true" for l in f)
    except OSError:
        return False


def build_server_cmd():
    if not os.path.isdir(CONF["server_dir"]):
        raise RuntimeError("Server-Ordner fehlt: %s" % CONF["server_dir"])
    if not eula_accepted():
        raise RuntimeError("Die Minecraft-EULA wurde noch nicht akzeptiert (eula.txt)")
    launch = launch_args()
    if launch[0] == "-jar" and not os.path.isfile(srv(launch[1])):
        raise RuntimeError("Startdatei %s fehlt im Server-Ordner" % launch[1])
    java = java_for(server_version().get("mc"), install=True)
    if not java:
        raise RuntimeError("Kein passendes Java gefunden")
    mn, mx = ram_limits()
    return [java, "-Xms%dM" % mn, "-Xmx%dM" % mx] + GC_FLAGS + launch + ["nogui"], dict(os.environ)


def ver_key(v):
    return [int(x) if x.isdigit() else -1 for x in re.split(r"[.\-+]", str(v))]


def neo_mc(v):
    """NeoForge-Version → Minecraft-Version: 21.1.267 → 1.21.1, 21.0.5 → 1.21, 26.2.0.95 → 26.2, 26.1.2.7 → 26.1.2."""
    p = v.split("-")[0].split(".")
    if not all(x.isdigit() for x in p):
        return None
    if int(p[0]) >= 25 and len(p) >= 4:
        mc = p[:3] if p[2] != "0" else p[:2]
        return ".".join(mc)
    if len(p) == 3:
        return "1.%s" % p[0] if p[1] == "0" else "1.%s.%s" % (p[0], p[1])
    return None


def loader_games(ld):
    """Minecraft-Versionen, für die es die Server-Software gibt – neueste zuerst."""
    if ld == "vanilla":
        man = cached_json(MOJANG_MANIFEST) or {}
        return [v["id"] for v in man.get("versions", []) if v.get("type") == "release"]
    if ld == "fabric":
        return [g["version"] for g in cached_json(FABRIC_META + "/versions/game") or [] if g.get("stable")]
    if ld == "paper":
        d = cached_json(PAPER_API) or {}
        vs = [v for grp in (d.get("versions") or {}).values() for v in grp]
    elif ld == "purpur":
        vs = (cached_json(PURPUR_API) or {}).get("versions") or []
    elif ld == "forge":
        vs = [k.rsplit("-", 1)[0] for k in ((cached_json(FORGE_PROMOS) or {}).get("promos") or {})]
    elif ld == "neoforge":
        vs = [neo_mc(v) for v in (cached_json(NEO_VERSIONS) or {}).get("versions") or []]
    else:
        vs = []
    return sorted({v for v in vs if v and REL_RE.match(v)}, key=ver_key, reverse=True)


def paper_builds(mc):
    b = cached_json("%s/versions/%s/builds" % (PAPER_API, urllib.parse.quote(mc)), ttl=300)
    return sorted(b, key=lambda x: -int(x.get("id") or 0)) if isinstance(b, list) else []


def loader_builds(ld, mc):
    """(Loader-Versionen/Builds für mc – neueste zuerst, empfohlene Version)."""
    if ld == "vanilla":
        return [], None
    if ld == "fabric":
        ls = cached_json(FABRIC_META + "/versions/loader") or []
        st = [l["version"] for l in ls if l.get("stable")]
        return st[:5] + [l["version"] for l in ls if not l.get("stable")][:3], (st[0] if st else None)
    if ld == "forge":
        promos = (cached_json(FORGE_PROMOS) or {}).get("promos") or {}
        rec, lat = promos.get(mc + "-recommended"), promos.get(mc + "-latest")
        out = []
        for x in (lat, rec):
            if x and x not in out:
                out.append(x)
        return out, rec or lat
    if ld == "neoforge":
        vs = [v for v in (cached_json(NEO_VERSIONS) or {}).get("versions") or [] if neo_mc(v) == mc]
        vs.reverse()
        stable = [v for v in vs if "beta" not in v and "alpha" not in v]
        return stable[:8] + [v for v in vs if v not in stable][:4], (stable[0] if stable else (vs[0] if vs else None))
    if ld == "paper":
        b = paper_builds(mc)
        st = [str(x["id"]) for x in b if x.get("channel") == "STABLE"]
        other = [str(x["id"]) for x in b if x.get("channel") != "STABLE"]
        return st[:8] + other[:3], (st[0] if st else (other[0] if other else None))
    if ld == "purpur":
        d = cached_json("%s/%s" % (PURPUR_API, urllib.parse.quote(mc)), ttl=300) or {}
        builds = d.get("builds") or {}
        return list(reversed(builds.get("all") or []))[:10], builds.get("latest")
    return [], None


def resolve_install(ld, mc, lv):
    """Prüft, ob es die Kombination gibt, und liefert, was installiert werden muss (noch ohne Download)."""
    name = LOADERS[ld]["name"]
    if ld == "vanilla":
        man = cached_json(MOJANG_MANIFEST) or {}
        v = next((x for x in man.get("versions", []) if x.get("id") == mc), None)
        det = (cached_json(v["url"], ttl=86400) or {}) if v else {}
        dl = (det.get("downloads") or {}).get("server")
        if not dl:
            raise ApiError("Für Minecraft %s gibt es keinen offiziellen Server" % mc)
        return {"type": "jar", "url": dl["url"], "sha1": dl.get("sha1"), "file": "server.jar"}
    if not lv:
        raise ApiError("Bitte eine %s auswählen" % (LOADERS[ld]["verLabel"] or "Version"))
    if ld == "fabric":
        if not http_json("%s/versions/loader/%s/%s" % (FABRIC_META, urllib.parse.quote(mc), urllib.parse.quote(lv))):
            raise ApiError("Fabric %s gibt es für Minecraft %s nicht" % (lv, mc))
        inst = next((i for i in (cached_json(FABRIC_META + "/versions/installer") or []) if i.get("stable")), None)
        if not inst:
            raise ApiError("Fabric-Installer nicht gefunden", 502)
        return {"type": "fabric", "url": inst["url"], "version": inst["version"]}
    if ld == "paper":
        b = next((x for x in paper_builds(mc) if str(x.get("id")) == lv), None)
        dl = ((b or {}).get("downloads") or {}).get("server:default")
        if not dl:
            raise ApiError("Paper-Build %s für Minecraft %s nicht gefunden" % (lv, mc))
        return {"type": "jar", "url": dl["url"], "sha256": (dl.get("checksums") or {}).get("sha256"), "file": "paper.jar"}
    if ld == "purpur":
        d = http_json("%s/%s/%s" % (PURPUR_API, urllib.parse.quote(mc), urllib.parse.quote(lv)))
        if not d or d.get("result") != "SUCCESS":
            raise ApiError("Purpur-Build %s für Minecraft %s nicht gefunden" % (lv, mc))
        return {"type": "jar", "url": "%s/%s/%s/download" % (PURPUR_API, mc, lv), "md5": d.get("md5"), "file": "purpur.jar"}
    if ld in ("forge", "neoforge"):
        builds, _ = loader_builds(ld, mc)
        if ld == "neoforge":
            known = (cached_json(NEO_VERSIONS) or {}).get("versions") or []
            if lv not in known or neo_mc(lv) != mc:
                raise ApiError("NeoForge %s passt nicht zu Minecraft %s" % (lv, mc))
            url = "%s/%s/neoforge-%s-installer.jar" % (NEO_MAVEN, lv, lv)
        else:
            if lv not in builds:
                raise ApiError("Forge %s für Minecraft %s nicht gefunden" % (lv, mc))
            url = "%s/%s-%s/forge-%s-%s-installer.jar" % (FORGE_MAVEN, mc, lv, mc, lv)
        return {"type": "installer", "url": url}
    raise ApiError("Unbekannte Server-Software: %s" % name)


def forge_launch(ld, mc, lv):
    """Startparameter nach dem (Neo)Forge-Installer – bevorzugt aus der erzeugten run.sh."""
    toks = []
    try:
        with open(srv("run.sh"), encoding="utf-8") as f:
            for line in f:
                l = line.strip()
                if l.startswith("exec "):
                    l = l[5:].lstrip()
                if l.startswith("java ") and "--onlyCheckJava" not in l:
                    toks = l.split()[1:]
    except OSError:
        pass
    toks = [t for t in toks if t not in ('"$@"', "$@", "nogui", "@user_jvm_args.txt")]
    if toks and all(LAUNCH_TOKEN.fullmatch(t) for t in toks):
        return toks
    base = ("libraries/net/minecraftforge/forge/%s-%s" % (mc, lv)) if ld == "forge" \
        else ("libraries/net/neoforged/neoforge/%s" % lv)
    if os.path.isfile(srv(base, "unix_args.txt")):
        return ["@%s/unix_args.txt" % base]
    for n in ("forge-%s-%s-shim.jar" % (mc, lv), "forge-%s-%s.jar" % (mc, lv), "forge-%s-%s-universal.jar" % (mc, lv)):
        if os.path.isfile(srv(n)):
            return ["-jar", n]
    raise RuntimeError("Startdatei von %s %s nicht gefunden" % (LOADERS[ld]["name"], lv))


def install_loader(ld, mc, lv, spec, jpath, step):
    """Spielt die Server-Software ein (Server gestoppt). Gibt die Startparameter für start.sh zurück."""
    os.makedirs(TMP, exist_ok=True)
    name = LOADERS[ld]["name"]
    if spec["type"] == "jar":
        step("lade %s %s …" % (name, mc if ld == "vanilla" else "%s (Build %s)" % (mc, lv)))
        http_download(spec["url"], srv(spec["file"]), sha1=spec.get("sha1"), sha256=spec.get("sha256"),
                      md5=spec.get("md5"))
        return ["-jar", spec["file"]]
    if spec["type"] == "fabric":
        step("lade den Fabric-Installer %s …" % spec["version"])
        ijar = os.path.join(TMP, "fabric-installer.jar")
        http_download(spec["url"], ijar, sha1=remote_sha1(spec["url"]))
        step("installiere Minecraft %s mit Fabric %s …" % (mc, lv))
        r = subprocess.run([jpath, "-jar", ijar, "server", "-mcversion", mc, "-loader", lv, "-downloadMinecraft",
                            "-dir", CONF["server_dir"]], capture_output=True, text=True, timeout=1200, cwd=TMP)
        if r.returncode != 0:
            raise RuntimeError("Fabric-Installer fehlgeschlagen: " + (r.stderr or r.stdout)[-400:])
        return ["-jar", "fabric-server-launch.jar"]
    if spec["type"] == "installer":
        step("lade den %s-Installer %s …" % (name, lv))
        ijar = os.path.join(TMP, "%s-installer.jar" % ld)
        http_download(spec["url"], ijar, sha1=remote_sha1(spec["url"]))
        step("installiere Minecraft %s mit %s %s (dauert ein paar Minuten) …" % (mc, name, lv))
        _unlink(srv("run.sh"))  # wird vom Installer neu geschrieben – daraus lesen wir die Startzeile
        r = subprocess.run([jpath, "-jar", ijar, "--installServer", CONF["server_dir"]], capture_output=True,
                           text=True, timeout=1800, cwd=TMP)
        if r.returncode != 0:
            raise RuntimeError("%s-Installer fehlgeschlagen: %s" % (name, (r.stderr or r.stdout)[-400:]))
        return forge_launch(ld, mc, lv)
    raise RuntimeError("Unbekannte Installationsart")


def same_family(a, b):
    return a == b or (LOADERS[a]["family"] == "bukkit" and LOADERS[b]["family"] == "bukkit")


def content_plan(ld, mc):
    """Was passiert mit Mods/Plugins? mode=update: gleicher Loader → aktualisieren, inkompatible deaktivieren.
    mode=switch: anderer Loader → alter Ordner wird geparkt, passende Projekte werden für den neuen Loader
    installiert, früher geparkte Mods/Plugins des neuen Loaders kommen zurück."""
    cur = detect_loader()
    plan = {"mode": "update" if same_family(cur, ld) else "switch", "from": cur, "items": [], "restore": []}
    cd = content_dir(ld=cur)
    if cd and os.path.isdir(cd) and mod_files(cd):
        names = {m["file"]: m.get("name") or m["file"] for m in list_mods(cur, cd)}
        ups = mod_updates(mc, ld, cd) if LOADERS[ld]["dir"] else \
            {f: dict(e, status="missing" if e["status"] != "unknown" else "unknown")
             for f, e in mod_updates(mc, cur, cd).items()}
        for f, e in ups.items():
            st = e["status"]
            if plan["mode"] == "switch":
                st = "migrate" if st in ("ok", "update") and f.endswith(".jar") else "parked"
            plan["items"].append(dict(e, file=f, name=names.get(f, f), status=st))
    if plan["mode"] == "switch" and LOADERS[ld]["dir"]:
        new_rel = LOADERS[ld]["dir"]
        pd = srv(PARKED, ld, new_rel)
        # Nach dem Parken des alten Ordners ist der Zielordner frei, wenn beide gleich heißen (mods → mods)
        if os.path.isdir(pd) and mod_files(pd) and (LOADERS[cur]["dir"] == new_rel or not os.path.exists(srv(new_rel))):
            pnames = {m["file"]: m.get("name") or m["file"] for m in list_mods(ld, pd)}
            plan["restore"] = [dict(e, file=f, name=pnames.get(f, f)) for f, e in mod_updates(mc, ld, pd).items()]
    return plan


def _apply_updates(d, items, report):
    for it in items:
        f = it["file"]
        if it["status"] == "update":
            try:
                report.append("%s → %s" % (f, replace_mod(f, it, d)))
            except Exception as ex:
                report.append("%s: Update fehlgeschlagen (%s)" % (f, ex))
        elif it["status"] == "missing" and f.endswith(".jar"):
            os.rename(os.path.join(d, f), os.path.join(d, f + ".disabled"))
            report.append("%s deaktiviert (keine passende Version)" % f)


def migrate_content(cur_ld, ld, mc, plan):
    report = []
    if plan["mode"] == "update":
        d = content_dir(ld=cur_ld)
        if d and os.path.isdir(d):
            _apply_updates(d, plan["items"], report)
        return report
    old_rel, new_rel = LOADERS[cur_ld]["dir"], LOADERS[ld]["dir"]
    if old_rel and os.path.isdir(srv(old_rel)):
        dest = srv(PARKED, cur_ld, old_rel)
        if os.path.exists(dest):
            os.rename(dest, dest + "-" + time.strftime("%Y-%m-%d_%H-%M-%S"))
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        os.rename(srv(old_rel), dest)
        report.append("%s/ von %s geparkt unter %s/%s/%s/" % (old_rel, LOADERS[cur_ld]["name"], PARKED, cur_ld, old_rel))
    if not new_rel:
        return report
    nd, pd = srv(new_rel), srv(PARKED, ld, new_rel)
    if os.path.isdir(pd) and not os.path.exists(nd):
        os.rename(pd, nd)
        report.append("%s/ aus der früheren %s-Installation zurückgeholt" % (new_rel, LOADERS[ld]["name"]))
        _apply_updates(nd, plan["restore"], report)
    os.makedirs(nd, exist_ok=True)
    try:
        have = {v["project_id"] for v in installed_versions(nd).values()}
    except ApiError:
        have = set()
    for it in plan["items"]:
        if it["status"] != "migrate" or it.get("project") in have:
            continue
        done = []
        try:
            install_project(it["project"], mc, have, done, ld=ld)
            report.append("%s übernommen → %s" % (it["name"], ", ".join(done)))
        except Exception as ex:
            report.append("%s nicht übernommen (%s)" % (it["name"], ex))
    return report


# Welt-Dateien, die Vanilla/Fabric/Forge einmal pro Welt (world/data/minecraft) erwarten,
# Paper/Purpur aber pro Dimension (world/dimensions/minecraft/<dim>/data/minecraft) ablegen.
WORLD_LEVEL_DATA = ("world_gen_settings.dat", "game_rules.dat", "weather.dat", "scheduled_events.dat")
BUKKIT_DATAPACKS = ("paper", "bukkit", "purpur")


def convert_world(cur_ld, ld):
    """Welt beim Wechsel zwischen Paper/Purpur und den übrigen Server-Arten anpassen (Seed bleibt erhalten)."""
    level = read_props().get("level-name", "world")
    wdir = srv(level)
    if not os.path.isdir(wdir):
        return []
    out = []
    data = os.path.join(wdir, "data", "minecraft")
    dims = os.path.join(wdir, "dimensions", "minecraft")
    to_bukkit = LOADERS[ld]["family"] == "bukkit"
    if LOADERS[cur_ld]["family"] == "bukkit" and not to_bukkit:
        over = os.path.join(dims, "overworld", "data", "minecraft")
        for f in WORLD_LEVEL_DATA:
            src, dst = os.path.join(over, f), os.path.join(data, f)
            if os.path.isfile(src) and not os.path.isfile(dst):
                os.makedirs(data, exist_ok=True)
                shutil.copy2(src, dst)
                out.append("Welt: %s für %s übernommen" % (f, LOADERS[ld]["name"]))
        lp = os.path.join(wdir, "level.dat")
        try:
            name, root = nbt.load(lp)
            dp = nbt.get(root, "Data", "DataPacks", "Enabled")
            if dp:
                keep = [x for x in dp[1][1] if x not in BUKKIT_DATAPACKS]
                if len(keep) != len(dp[1][1]):
                    root[1]["Data"][1]["DataPacks"][1]["Enabled"] = (nbt.LIST, (nbt.STRING, keep))
                    shutil.copy2(lp, lp + ".vor-wechsel")
                    nbt.save(lp, root, name)
                    out.append("Welt: Paper-Datapack aus level.dat entfernt")
        except (OSError, ValueError, KeyError, IndexError) as e:
            out.append("Welt: level.dat nicht angepasst (%s)" % e)
    elif to_bukkit and LOADERS[cur_ld]["family"] != "bukkit" and os.path.isdir(dims):
        # Alte Paper-Kopien pro Dimension beiseitelegen, damit Paper die aktuellen Welt-Daten neu übernimmt
        for dim in os.listdir(dims):
            for f in WORLD_LEVEL_DATA:
                p = os.path.join(dims, dim, "data", "minecraft", f)
                if os.path.isfile(p) and os.path.isfile(os.path.join(data, f)):
                    os.replace(p, p + ".blockhaus-alt")
                    out.append("Welt: veraltete Paper-Kopie %s/%s beiseitegelegt" % (dim, f))
    return out


def unsplit_dimensions():
    """Paper/Purpur können Nether und Ende in eigene Ordner (world_nether, world_the_end) auslagern. Beim Wechsel
    zu Vanilla/Fabric/Forge zurück in die Hauptwelt verschieben – nur, wenn dort an der Stelle noch nichts liegt."""
    level = read_props().get("level-name", "world")
    out = []
    for suffix, rels in (("_nether", ("DIM-1", "dimensions/minecraft/the_nether")),
                         ("_the_end", ("DIM1", "dimensions/minecraft/the_end"))):
        side = srv(level + suffix)
        if not os.path.isdir(side):
            continue
        for rel in rels:
            src, dst = os.path.join(side, rel), srv(level, rel)
            if os.path.isdir(src) and not os.path.exists(dst):
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                os.rename(src, dst)
                out.append("%s%s/%s → %s/%s zurückverschoben" % (level, suffix, rel, level, rel))
    return out


def upgrade_check(ld, mc, lv):
    """Gemeinsame Prüfung für „Kompatibilität prüfen“ und den eigentlichen Lauf."""
    if ld not in LOADERS:
        raise ApiError("Unbekannte Server-Software")
    if not VER_RE.fullmatch(mc) or (lv and not VER_RE.fullmatch(lv)):
        raise ApiError("Ungültige Version")
    if ld == "vanilla":
        lv = ""
    spec = resolve_install(ld, mc, lv)
    plan = content_plan(ld, mc)
    req = java_required(mc)
    _, have, _auto = java_status(mc)
    return spec, plan, req, have, lv


@api("GET", "/api/update/versions")
def r_upd_versions(h, s, q):
    cur = server_version()
    ld = q.get("loader") or cur["loader"]
    if ld not in LOADERS:
        raise ApiError("Unbekannte Server-Software")
    games = loader_games(ld)
    cm = cur.get("mc") or "0"
    newer = [g for g in games if REL_RE.match(cm) and ver_key(g) > ver_key(cm)]
    h.json({"current": cur, "loader": ld, "games": games[:30], "newer": newer,
            "loaders": [{"id": k, "name": L["name"], "kind": L["kind"], "desc": L["desc"], "verLabel": L["verLabel"]}
                        for k, L in LOADERS.items()]})


@api("GET", "/api/update/builds")
def r_upd_builds(h, s, q):
    ld, mc = q.get("loader", ""), q.get("mc", "")
    if ld not in LOADERS or not VER_RE.fullmatch(mc):
        raise ApiError("Ungültige Auswahl")
    builds, rec = loader_builds(ld, mc)
    h.json({"loader": ld, "mc": mc, "builds": builds, "recommended": rec, "label": LOADERS[ld]["verLabel"]})


@api("POST", "/api/update/check")
def r_upd_check(h, s, q):
    d = h.body_json()
    ld, mc, lv = str(d.get("loader") or detect_loader()), str(d.get("mc", "")), str(d.get("loaderVersion") or "")
    spec, plan, req, have, lv = upgrade_check(ld, mc, lv)
    cur = server_version()
    L, C = LOADERS[ld], LOADERS[cur["loader"]]
    warnings = []
    if java_auto() and req and (not have or have < req):
        warnings.append("Java %d wird beim Wechsel automatisch heruntergeladen (Eclipse Temurin)." % req)
    if plan["mode"] == "switch":
        if C["dir"] and plan["items"]:
            warnings.append("Der Ordner <b>%s/</b> von %s wird <b>geparkt, nicht gelöscht</b>. Wechselst du später zurück "
                            "zu %s, kommt er automatisch wieder." % (C["dir"], C["name"], C["name"]))
        if not L["dir"]:
            warnings.append("Vanilla lädt keine Mods und keine Plugins – nur Datapacks funktionieren weiter.")
        elif L["kind"] == "plugin" and C["kind"] == "mod":
            warnings.append("%s lädt <b>Plugins statt Mods</b>. Wo es auf Modrinth ein Plugin desselben Projekts gibt "
                            "(z. B. BlueMap, Chunky), wird es automatisch installiert." % L["name"])
        elif L["kind"] == "mod" and C["kind"] == "plugin":
            warnings.append("%s lädt <b>Mods statt Plugins</b>. Wo es auf Modrinth einen Mod desselben Projekts gibt, "
                            "wird er automatisch installiert." % L["name"])
        if L["kind"] == "mod":
            warnings.append("Mods, die auch auf dem Client nötig sind, müssen Spieler dann mit <b>%s</b> installieren. "
                            "Reine Server-Mods brauchen sie nicht." % L["name"])
        if L["family"] == "bukkit" and C["family"] != "bukkit":
            warnings.append("Paper/Purpur können Nether und Ende in eigene Ordner (world_nether, world_the_end) "
                            "auslagern. Beim Zurückwechseln verschiebt das Panel sie zurück – der sichere Rückweg "
                            "bleibt das Welt-Backup „vor Update“.")
        if C["family"] == "bukkit" and L["family"] != "bukkit":
            warnings.append("Paper-Einstellungen (bukkit.yml, spigot.yml, config/paper-*.yml) bleiben liegen, werden "
                            "von %s aber nicht genutzt." % L["name"])
    try:
        if cur.get("mc") and REL_RE.match(cur["mc"]) and ver_key(mc) < ver_key(cur["mc"]):
            warnings.append("<b>Ältere Minecraft-Version:</b> Eine Welt, die schon mit %s lief, lässt sich mit %s "
                            "meist nicht mehr öffnen. Nur zusammen mit einem passenden alten Welt-Backup sinnvoll."
                            % (cur["mc"], mc))
    except TypeError:
        pass
    if req and have and have > req + 4 and ld in ("forge", "neoforge"):
        warnings.append("Installiert ist Java %d, Minecraft %s ist für Java %d gebaut. Neuere Java-Versionen laufen "
                        "meist, ältere Forge-Versionen können damit aber abstürzen." % (have, mc, req))
    same = ld == cur["loader"] and mc == cur.get("mc") and (lv or None) == (cur.get("loaderVersion") or None)
    h.json({"loader": ld, "loaderName": L["name"], "kind": L["kind"], "mc": mc, "loaderVersion": lv,
            "from": cur["loader"], "fromName": C["name"], "fromKind": C["kind"], "mode": plan["mode"],
            "mods": plan["items"], "restore": plan["restore"], "java": {"required": req, "installed": have},
            "javaOk": java_auto() or not req or not have or have >= req, "same": same, "warnings": warnings,
            "missing": [m["name"] for m in plan["items"] if m["status"] == "missing"],
            "parked": [m["name"] for m in plan["items"] if m["status"] == "parked"],
            "unknown": [m["name"] for m in plan["items"] if m["status"] == "unknown"]})


@api("POST", "/api/update/run")
def r_upd_run(h, s, q):
    d = h.body_json()
    ld, mc, lv = str(d.get("loader") or detect_loader()), str(d.get("mc", "")), str(d.get("loaderVersion") or "")
    if ld not in LOADERS:
        raise ApiError("Unbekannte Server-Software")
    if not VER_RE.fullmatch(mc) or (lv and not VER_RE.fullmatch(lv)):
        raise ApiError("Ungültige Version")
    if update_lock.locked() or backup_lock.locked():
        raise ApiError("Es läuft bereits eine Aufgabe")
    try:
        start_script_patched()  # früh scheitern, falls start.sh nicht angepasst werden kann
    except RuntimeError as e:
        raise ApiError(str(e))
    act(h, s, "update-gestartet", "%s, Minecraft %s %s" % (LOADERS[ld]["name"], mc, lv))
    threading.Thread(target=lambda: _bg(run_upgrade, ld, mc, lv, s["user"]), daemon=True).start()
    h.json({"ok": True})


SERVERFILES = ("mods", "plugins", "config", "libraries", ".fabric", PARKED, LAUNCH_CONF, LEGACY_LAUNCH_CONF,
               "fabric-server-launch.jar",
               "fabric-server-launcher.properties", "server.jar", "paper.jar", "purpur.jar", "run.sh",
               "user_jvm_args.txt", "bukkit.yml", "spigot.yml", "purpur.yml", "commands.yml", "help.yml",
               "permissions.yml", "server.properties", "start.sh", "whitelist.json", "ops.json",
               "banned-players.json", "banned-ips.json", "versions")
SERVERFILE_GLOBS = ("forge-*.jar",)


def backup_serverfiles(label):
    os.makedirs(CONF["backup_dir"], exist_ok=True)
    items = [x for x in SERVERFILES if os.path.exists(srv(x))]
    for g in SERVERFILE_GLOBS:
        items += sorted(os.path.basename(p) for p in glob.glob(srv(g)))
    name = "serverdateien-%s-%s.tar.gz" % (time.strftime("%Y-%m-%d_%H-%M-%S"), label)
    dest = os.path.join(CONF["backup_dir"], name)
    try:
        osutil.tar_create(dest + ".part", CONF["server_dir"], items)
    except Exception as e:
        _unlink(dest + ".part")
        raise RuntimeError("Sicherung der Serverdateien fehlgeschlagen: %s" % e)
    os.replace(dest + ".part", dest)
    return name


def restore_serverfiles(src, name, user):
    """Wird innerhalb von restore_backup (mit backup_lock) aufgerufen."""
    HUB.set_task({"kind": "restore", "msg": "Server wird gestoppt …", "t": now()})
    was_running = svc_info().get("ActiveState") == "active"
    if was_running:
        svc_action("stop")
        wait_state(("inactive", "failed"))
    HUB.set_task({"kind": "restore", "msg": "Serverdateien werden zurückgespielt …", "t": now()})
    ts = time.strftime("%Y-%m-%d_%H-%M-%S")
    # Mod-/Plugin-Ordner beiseitelegen, damit nach dem Entpacken genau der Stand aus dem Backup gilt
    aside = {}
    for d in ("mods", "plugins"):
        if os.path.isdir(srv(d)):
            aside[d] = srv(".restore-old-%s-%s" % (d, ts))
            os.rename(srv(d), aside[d])
    old_conf = srv(".restore-old-launch-" + ts)
    if os.path.isfile(srv(LAUNCH_CONF)):  # ältere Backups haben keine – dann wird die Software neu erkannt
        os.rename(srv(LAUNCH_CONF), old_conf)
    err = None
    try:
        osutil.tar_extract(src, CONF["server_dir"])
    except Exception as e:
        err = str(e)
    if err is not None:
        for d, p in aside.items():
            if not os.path.isdir(srv(d)) and os.path.isdir(p):
                os.rename(p, srv(d))
        if not os.path.isfile(srv(LAUNCH_CONF)) and os.path.isfile(old_conf):
            os.rename(old_conf, srv(LAUNCH_CONF))
        raise RuntimeError("Entpacken fehlgeschlagen: " + err[:200])
    for d, p in aside.items():
        if os.path.isdir(srv(d)):
            shutil.rmtree(p, ignore_errors=True)
        else:  # Backup enthielt den Ordner nicht (z. B. plugins/ vor dem Wechsel zu Paper) – nichts verlieren
            os.rename(p, srv(d))
    _unlink(old_conf)
    m = re.search(r"serverdateien-.*?-vor-update", name)
    if m:  # Versionsanzeige zurücksetzen – die alte Version steht wieder in werkbank-launch.conf bzw. wird neu erkannt
        CONF.pop("mc_version", None)
        CONF.pop("loader_version", None)
        prev = load_json(os.path.join(DATA, "version-history.json"), [])
        for e in prev:
            if e.get("backup") == name:
                CONF["mc_version"], CONF["loader_version"] = e.get("from_mc"), e.get("from_loader")
        save_json(CONF_PATH, CONF)
    if was_running:
        HUB.set_task({"kind": "restore", "msg": "Server startet …", "t": now()})
        svc_action("start")
    HUB.push_log("Serverdateien wiederhergestellt: %s (%s)" % (name, user), "sys")


def run_upgrade(ld, mc, lv, user):
    if not update_lock.acquire(blocking=False):
        raise RuntimeError("Es läuft bereits ein Update")

    def step(msg):
        HUB.set_task({"kind": "update", "msg": msg, "t": now()})
        HUB.push_log("Update: " + msg, "sys")

    started = False
    L = LOADERS.get(ld)
    try:
        cur = server_version()
        cur_ld = cur["loader"]
        target = "%s %s" % (L["name"], mc) + (" (%s)" % lv if lv else "")
        step("prüfe %s …" % target)
        spec, plan, req, _, lv = upgrade_check(ld, mc, lv)
        if java_auto():
            jpath = java_for(mc, install=True, step=step)
        else:
            jpath, jmaj = java_info()
            if not jpath:
                raise RuntimeError("Kein Java gefunden – bitte Java %s installieren" % (req or ""))
            if req and jmaj and jmaj < req:
                raise RuntimeError("Minecraft %s braucht Java %d, installiert ist Java %d. Bitte zuerst Java %d "
                                   "installieren." % (mc, req, jmaj, req))
        start_script_patched()
        step("sichere die Welt …")
        make_backup("vor-update", user)
        step("sichere Serverdateien, Mods und Plugins …")
        sf = backup_serverfiles("vor-update")
        hist = load_json(os.path.join(DATA, "version-history.json"), [])
        hist.append({"t": now(), "from_mc": cur.get("mc"), "from_loader": cur.get("loaderVersion"), "from_type": cur_ld,
                     "to_mc": mc, "to_loader": lv, "to_type": ld, "backup": sf, "user": user})
        save_json(os.path.join(DATA, "version-history.json"), hist[-50:])
        step("stoppe den Server …")
        if svc_info().get("ActiveState") == "active":
            svc_action("stop")
            wait_state(("inactive", "failed"))
        started = True
        if ensure_start_script():
            HUB.push_log("Update: start.sh für wechselbare Server-Software angepasst", "sys")
        launch = install_loader(ld, mc, lv, spec, jpath, step)
        step("passe %s an …" % ("Plugins" if L["kind"] == "plugin" else "Mods" if L["kind"] else "Mods/Plugins"))
        report = migrate_content(cur_ld, ld, mc, plan)
        if LOADERS[cur_ld]["family"] == "bukkit" and L["family"] != "bukkit":
            report += unsplit_dimensions()
        report += convert_world(cur_ld, ld)
        write_launch_conf(ld, mc, lv, launch)
        CONF["mc_version"], CONF["loader_version"] = mc, lv
        save_json(CONF_PATH, CONF)
        for line in report:
            HUB.push_log("Update: " + line, "sys")
        step("starte den Server …")
        svc_action("start")
        HUB.push_log("Update auf %s abgeschlossen (%s)" % (target, user), "sys")
        audit(user, "-", "update-fertig", target)
    except Exception as e:
        HUB.push_log("Update fehlgeschlagen: %s" % e, "err")
        if started:
            HUB.push_log("Rückweg: Unter „Backups“ zuerst „Serverdateien (vor Update)“ und danach die Welt "
                         "„vor Update“ wiederherstellen.", "err")
        audit(user, "-", "update-fehlgeschlagen", str(e)[:300])
        raise
    finally:
        HUB.set_task(None)
        update_lock.release()


@api("GET", "/api/update/history")
def r_upd_history(h, s, q):
    h.json({"history": list(reversed(load_json(os.path.join(DATA, "version-history.json"), [])))})


# ═════════════════════════ Runde 3: Moderation, Welt-Werkzeuge, Inhalte ═════════════════════════

def ops_names():
    return {e.get("name") for e in load_json(srv("ops.json"), []) if isinstance(e, dict)}


def tellraw(target, parts):
    return RCON.cmd("tellraw %s %s" % (target, json.dumps(parts, ensure_ascii=False)))


# ── 15. Zeitlich begrenzte Banns ──

TEMPBAN_PATH = os.path.join(DATA, "tempbans.json")
tempban_lock = threading.Lock()


def tempban_tick():
    with tempban_lock:
        bans = load_json(TEMPBAN_PATH, [])
        due = [b for b in bans if b.get("until", 0) <= now()]
        if not due:
            return
        if svc_info().get("ActiveState") != "active":
            return  # später erneut versuchen
        keep = [b for b in bans if b not in due]
        for b in due:
            if rcon_try("pardon %s" % b["name"]) is None:
                keep.append(b)
                continue
            HUB.push_log("Temporärer Bann abgelaufen: %s" % b["name"], "sys")
            audit("Automatik", "-", "tempban-abgelaufen", b["name"])
        save_json(TEMPBAN_PATH, keep)


def tempban_add(name, seconds, reason, user):
    until = now() + seconds
    with tempban_lock:
        bans = [b for b in load_json(TEMPBAN_PATH, []) if b.get("name") != name]
        bans.append({"name": name, "until": until, "reason": reason, "by": user, "t": now()})
        save_json(TEMPBAN_PATH, bans)
    return until


def tempban_remove(name):
    with tempban_lock:
        bans = load_json(TEMPBAN_PATH, [])
        save_json(TEMPBAN_PATH, [b for b in bans if b.get("name") != name])


@api("GET", "/api/tempbans")
def r_tempbans(h, s, q):
    h.json({"tempbans": load_json(TEMPBAN_PATH, [])})


# ── 17. Wartungsmodus ──

MAINT_PATH = os.path.join(DATA, "maintenance.json")


def maintenance():
    m = load_json(MAINT_PATH, {})
    return m if m.get("on") else None


def _kick_unless_op(name, reason):
    if name in ops_names():
        return
    rcon_try("kick %s %s" % (name, reason))


def maintenance_on_join(line):
    m = maintenance()
    if not m:
        return
    mt = re.search(r"\]: ([A-Za-z0-9_]{1,16}) joined the game$", line)
    if mt:
        reason = "Wartungsarbeiten" + (": " + m["reason"] if m.get("reason") else "") + \
                 (" – bis %s" % time.strftime("%H:%M", time.localtime(m["until"])) if m.get("until") else "")
        threading.Thread(target=lambda: (time.sleep(0.5), _kick_unless_op(mt.group(1), reason)), daemon=True).start()


def maintenance_tick():
    m = maintenance()
    if m and m.get("until") and m["until"] <= now():
        save_json(MAINT_PATH, {"on": False})
        HUB.push_log("Wartungsmodus automatisch beendet", "sys")
        rcon_try('tellraw @a {"text":"Die Wartung ist beendet – viel Spaß!","color":"green"}')
        audit("Automatik", "-", "wartung-ende")


@api("GET", "/api/maintenance")
def r_maint(h, s, q):
    h.json({"maintenance": maintenance()})


@api("POST", "/api/maintenance")
def r_maint_set(h, s, q):
    d = h.body_json()
    if d.get("on"):
        minutes = max(0, min(10080, int(d.get("minutes") or 0)))
        reason = re.sub(r"[\r\n]", " ", str(d.get("reason") or ""))[:120]
        m = {"on": True, "since": now(), "until": now() + minutes * 60 if minutes else None, "reason": reason,
             "by": s["user"]}
        save_json(MAINT_PATH, m)
        kicked = []
        ops = ops_names()
        for n in HUB.stats.get("online") or []:
            if n not in ops:
                rcon_try("kick %s Wartungsarbeiten%s" % (n, ": " + reason if reason else ""))
                kicked.append(n)
        act(h, s, "wartung-an", reason)
        HUB.push_log("Wartungsmodus aktiviert von %s%s" % (s["user"], " – %d Spieler getrennt" % len(kicked) if kicked else ""), "sys")
        return h.json({"ok": True, "kicked": kicked})
    save_json(MAINT_PATH, {"on": False})
    act(h, s, "wartung-aus")
    HUB.push_log("Wartungsmodus beendet von %s" % s["user"], "sys")
    h.json({"ok": True})


# ── 16. Chat ──

@api("POST", "/api/chat")
def r_chat(h, s, q):
    d = h.body_json()
    msg = re.sub(r"[\r\n]", " ", str(d.get("message", ""))).strip()[:256]
    to = str(d.get("to") or "").strip()
    if not msg:
        raise ApiError("Leere Nachricht")
    if to and not NAME_RE.match(to):
        raise ApiError("Ungültiger Spielername")
    parts = [{"text": "[Admin] ", "color": "red", "bold": True}, {"text": s["user"], "color": "gold", "bold": False},
             {"text": (" → dir" if to else "") + ": ", "color": "gray"}, {"text": msg, "color": "white"}]
    tellraw(to or "@a", parts)
    HUB.push_log("%s|%s|%s" % (s["user"], to, msg), "adminchat")
    act(h, s, "chat", ("an %s: " % to if to else "") + msg[:120])
    h.json({"ok": True})


# ── 14. Spieler-Detailseite ──

NOTES_PATH = os.path.join(DATA, "notes.json")
notes_lock = threading.Lock()


def player_full_stats(uuid):
    level = read_props().get("level-name", "world")
    j = None
    for p in (srv(level, "players", "stats", uuid + ".json"), srv(level, "stats", uuid + ".json")):
        j = load_json(p, None)
        if j:
            break
    if not j:
        return None
    st = j.get("stats", {})
    c = st.get("minecraft:custom", {})

    def top(cat, n=6):
        d = st.get(cat, {}) or {}
        return sorted(([k, v] for k, v in d.items()), key=lambda x: -x[1])[:n], sum(d.values())

    mined, mined_total = top("minecraft:mined")
    killed, killed_total = top("minecraft:killed")
    killed_by, _ = top("minecraft:killed_by", 4)
    crafted, crafted_total = top("minecraft:crafted", 4)
    cm = lambda k: c.get("minecraft:" + k, 0) / 100000  # cm → km
    return {
        "playTime": c.get("minecraft:play_time", c.get("minecraft:play_one_minute", 0)) / 20,
        "deaths": c.get("minecraft:deaths", 0), "mobKills": c.get("minecraft:mob_kills", 0),
        "playerKills": c.get("minecraft:player_kills", 0), "jumps": c.get("minecraft:jump", 0),
        "damageDealt": c.get("minecraft:damage_dealt", 0) / 10, "damageTaken": c.get("minecraft:damage_taken", 0) / 10,
        "sleep": c.get("minecraft:sleep_in_bed", 0), "fish": c.get("minecraft:fish_caught", 0),
        "traded": c.get("minecraft:traded_with_villager", 0),
        "distance": {"Laufen": cm("walk_one_cm"), "Sprinten": cm("sprint_one_cm"), "Schwimmen": cm("swim_one_cm"),
                     "Fliegen (Elytra)": cm("aviate_one_cm"), "Boot": cm("boat_one_cm"), "Pferd": cm("horse_one_cm"),
                     "Kreativ-Flug": cm("fly_one_cm"), "Lore": cm("minecart_one_cm")},
        "mined": mined, "minedTotal": mined_total, "killed": killed, "killedTotal": killed_total,
        "killedBy": killed_by, "crafted": crafted, "craftedTotal": crafted_total,
    }


def player_advancements(uuid, lang):
    level = read_props().get("level-name", "world")
    j = None
    for p in (srv(level, "players", "advancements", uuid + ".json"), srv(level, "advancements", uuid + ".json")):
        j = load_json(p, None)
        if j:
            break
    done = []
    for k, v in (j or {}).items():
        if k == "DataVersion" or "recipes/" in k or not isinstance(v, dict) or not v.get("done"):
            continue
        ts = max((t for t in (v.get("criteria") or {}).values() if isinstance(t, str)), default="")
        ns, path = k.split(":", 1) if ":" in k else ("minecraft", k)
        key = "advancements.%s.title" % path.replace("/", ".")
        title = lang.get(key) or _pretty(path.split("/")[-1])
        done.append({"id": k, "title": title, "date": ts[:19]})
    done.sort(key=lambda x: x["date"], reverse=True)
    return done


def name_for_uuid(uuid):
    for e in load_json(srv("usercache.json"), []):
        if isinstance(e, dict) and e.get("uuid") == uuid:
            return e.get("name")
    for f in ("whitelist.json", "ops.json", "banned-players.json"):
        for e in load_json(srv(f), []):
            if isinstance(e, dict) and e.get("uuid") == uuid:
                return e.get("name")
    return None


UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")


@api("GET", "/api/player")
def r_player(h, s, q):
    uuid = q.get("uuid", "")
    if not UUID_RE.match(uuid):
        raise ApiError("Ungültige UUID")
    name = name_for_uuid(uuid)
    _, lang = client_jar()
    bans = load_json(srv("banned-players.json"), [])
    ban = next((b for b in bans if b.get("uuid") == uuid), None)
    temp = next((b for b in load_json(TEMPBAN_PATH, []) if b.get("name") == name), None) if name else None
    h.json({
        "uuid": uuid, "name": name, "online": name in (HUB.stats.get("online") or []),
        "op": name in ops_names(), "whitelisted": any(e.get("uuid") == uuid for e in load_json(srv("whitelist.json"), [])),
        "ban": ban, "tempban": temp, "stats": player_full_stats(uuid), "advancements": player_advancements(uuid, lang),
        "notes": load_json(NOTES_PATH, {}).get(uuid, []),
    })


@api("POST", "/api/player/notes")
def r_player_notes(h, s, q):
    d = h.body_json()
    uuid = str(d.get("uuid", ""))
    if not UUID_RE.match(uuid):
        raise ApiError("Ungültige UUID")
    a = d.get("action")
    with notes_lock:
        notes = load_json(NOTES_PATH, {})
        lst = notes.setdefault(uuid, [])
        if a == "add":
            text = str(d.get("text", "")).strip()[:1000]
            kind = "warn" if d.get("kind") == "warn" else "note"
            if not text:
                raise ApiError("Leerer Text")
            lst.append({"id": secrets.token_hex(4), "t": now(), "by": s["user"], "kind": kind, "text": text})
            if kind == "warn" and d.get("ingame"):
                name = name_for_uuid(uuid)
                if name and name in (HUB.stats.get("online") or []):
                    tellraw(name, [{"text": "⚠ Verwarnung: ", "color": "red", "bold": True},
                                   {"text": text[:200], "color": "yellow", "bold": False}])
        elif a == "delete":
            nid = str(d.get("id", ""))
            notes[uuid] = [n for n in lst if n.get("id") != nid]
        else:
            raise ApiError("Unbekannte Aktion")
        save_json(NOTES_PATH, notes)
    act(h, s, "notiz-" + ("verwarnung" if d.get("kind") == "warn" else a), uuid)
    h.json({"ok": True})


# ── 10. Gebiet aus Backup zurücksetzen (chunkgenau) ──

DIMS = {"overworld": "minecraft/overworld", "the_nether": "minecraft/the_nether", "the_end": "minecraft/the_end"}


def mca_read(path):
    chunks = {}
    try:
        with open(path, "rb") as f:
            data = f.read()
    except OSError:
        return chunks
    if len(data) < 8192:
        return chunks
    for i in range(1024):
        off = int.from_bytes(data[i * 4:i * 4 + 3], "big")
        cnt = data[i * 4 + 3]
        if not off or not cnt:
            continue
        start = off * 4096
        if start + 5 > len(data):
            continue
        ln = int.from_bytes(data[start:start + 4], "big")
        if ln < 1:
            continue
        ts = int.from_bytes(data[4096 + i * 4:4100 + i * 4], "big")
        chunks[i] = (data[start + 4], data[start + 5:start + 4 + ln], ts)
    return chunks


def mca_write(path, chunks):
    if not chunks:
        _unlink(path)
        return
    header, body, sector = bytearray(8192), bytearray(), 2
    for i in sorted(chunks):
        comp, payload, ts = chunks[i]
        blob = (len(payload) + 1).to_bytes(4, "big") + bytes([comp]) + payload
        blob += b"\0" * ((-len(blob)) % 4096)
        n = len(blob) // 4096
        if n > 255:
            raise RuntimeError("Chunk zu groß für die Region-Datei")
        header[i * 4:i * 4 + 3] = sector.to_bytes(3, "big")
        header[i * 4 + 3] = n
        header[4096 + i * 4:4100 + i * 4] = ts.to_bytes(4, "big")
        body += blob
        sector += n
    tmp = path + ".wbtmp"
    with open(tmp, "wb") as f:
        f.write(header)
        f.write(body)
    os.replace(tmp, path)


region_lock = threading.Lock()


def region_restore(backup, dim, x1, z1, x2, z2, user):
    if not region_lock.acquire(blocking=False):
        raise RuntimeError("Es läuft bereits eine Gebiets-Wiederherstellung")
    try:
        level = read_props().get("level-name", "world")
        dpath = "%s/dimensions/%s" % (level, DIMS[dim])
        cx1, cx2 = sorted((x1 // 16, x2 // 16))
        cz1, cz2 = sorted((z1 // 16, z2 // 16))
        sel = {}  # (rx, rz) -> set(index)
        for cx in range(cx1, cx2 + 1):
            for cz in range(cz1, cz2 + 1):
                sel.setdefault((cx >> 5, cz >> 5), set()).add((cx & 31) + (cz & 31) * 32)
        nchunks = sum(len(v) for v in sel.values())
        HUB.set_task({"kind": "region", "msg": "Gebiet: lese Backup (%d Chunks) …" % nchunks, "t": now()})
        ts = time.strftime("%Y-%m-%d_%H-%M-%S")
        work = os.path.join(TMP, "gebiet-" + ts)
        os.makedirs(work, exist_ok=True)
        members = ["%s/%s/r.%d.%d.mca" % (dpath, kind, rx, rz) for (rx, rz) in sel for kind in ("region", "entities", "poi")]
        src = os.path.join(CONF["backup_dir"], backup)
        osutil.tar_extract(src, work, members)  # fehlende Dateien (= Gebiet existierte damals nicht) sind ok
        if not any(os.path.isfile(os.path.join(work, m)) for m in members) and \
                not os.path.isdir(os.path.join(work, level)):
            HUB.push_log("Hinweis: Im Backup existierte dieses Gebiet noch nicht – es wird neu generiert.", "sys")
        was_running = svc_info().get("ActiveState") == "active"
        if was_running:
            HUB.set_task({"kind": "region", "msg": "Gebiet: Server wird gestoppt …", "t": now()})
            rcon_try('tellraw @a {"text":"Der Server startet für eine Gebiets-Wiederherstellung kurz neu.","color":"gold"}')
            time.sleep(3)
            svc_action("stop")
            wait_state(("inactive", "failed"))
        HUB.set_task({"kind": "region", "msg": "Gebiet: setze Chunks zurück …", "t": now()})
        safety = os.path.join(CONF["backup_dir"], "gebiet-vorher-%s" % ts)
        changed = 0
        try:
            for m in members:
                cur = srv(m)
                old = mca_read(os.path.join(work, m))
                curc = mca_read(cur)
                rx, rz = (int(x) for x in os.path.basename(m)[2:-4].split("."))
                idxs = sel[(rx, rz)]
                if not curc and not old:
                    continue
                if os.path.isfile(cur):
                    os.makedirs(os.path.dirname(os.path.join(safety, m)), exist_ok=True)
                    shutil.copy2(cur, os.path.join(safety, m))
                for i in idxs:
                    if (i in old and old[i][0] & 0x80) or (i in curc and curc[i][0] & 0x80):
                        continue  # ausgelagerte Riesen-Chunks (.mcc) nicht anfassen
                    if i in old:
                        curc[i] = old[i]
                    else:
                        curc.pop(i, None)
                    changed += 1
                os.makedirs(os.path.dirname(cur), exist_ok=True)
                mca_write(cur, curc)
        finally:
            shutil.rmtree(work, ignore_errors=True)
            if was_running:
                HUB.set_task({"kind": "region", "msg": "Gebiet: Server startet …", "t": now()})
                svc_action("start")
        HUB.push_log("Gebiet zurückgesetzt (%s, %d–%d / %d–%d, %d Chunks) aus %s – vorheriger Zustand liegt in %s (%s)"
                     % (dim, min(x1, x2), max(x1, x2), min(z1, z2), max(z1, z2), nchunks, backup,
                        os.path.basename(safety), user), "sys")
    finally:
        HUB.set_task(None)
        region_lock.release()


@api("POST", "/api/region/restore")
def r_region(h, s, q):
    d = h.body_json()
    backup = os.path.basename(str(d.get("backup", "")))
    dim = d.get("dim", "overworld")
    if dim not in DIMS:
        raise ApiError("Unbekannte Dimension")
    p = safe_path(backup, CONF["backup_dir"])
    if not os.path.isfile(p) or not backup.endswith(".tar.gz") or backup.startswith("serverdateien-"):
        raise ApiError("Backup nicht gefunden")
    try:
        x1, z1, x2, z2 = (int(d[k]) for k in ("x1", "z1", "x2", "z2"))
    except (KeyError, TypeError, ValueError):
        raise ApiError("Koordinaten fehlen")
    if abs(x2 - x1) > 4096 or abs(z2 - z1) > 4096:
        raise ApiError("Gebiet zu groß (max. 4096 × 4096 Blöcke)")
    if region_lock.locked() or backup_lock.locked() or update_lock.locked():
        raise ApiError("Es läuft bereits eine Aufgabe")
    act(h, s, "gebiet-zurückgesetzt", "%s %s %d,%d → %d,%d" % (backup, dim, x1, z1, x2, z2))
    threading.Thread(target=lambda: _bg(region_restore, backup, dim, x1, z1, x2, z2, s["user"]), daemon=True).start()
    h.json({"ok": True})


# ── 19. Marker auf der Karte ──

MARKERS_PATH = os.path.join(DATA, "markers.json")
MARK_BEGIN = "# >>> Blockhaus-Marker (automatisch erzeugt – nicht von Hand bearbeiten) >>>"
MARK_END = "# <<< Blockhaus-Marker <<<"
MARK_RE = re.compile(r"\n?# >>> (?:Werkbank|Blockhaus)-Marker .*?# <<< (?:Werkbank|Blockhaus)-Marker <<<\n?", re.S)
MAP_FOR_DIM = {"overworld": "world.conf", "the_nether": "world_the_nether.conf", "the_end": "world_the_end.conf"}


def _hocon_str(s):
    return json.dumps(str(s), ensure_ascii=False)


def markers_apply():
    markers = load_json(MARKERS_PATH, [])
    for dim, fname in MAP_FOR_DIM.items():
        path = bm_path("maps", fname)
        if not os.path.isfile(path):
            continue
        with open(path, encoding="utf-8") as f:
            txt = f.read()
        txt = MARK_RE.sub("\n", txt)  # auch Blöcke aus der Werkbank-Zeit ersetzen
        mine = [m for m in markers if m.get("dim") == dim]
        if mine:
            lines = [MARK_BEGIN, "marker-sets: {", "  werkbank: {", '    label: "Orte"', "    toggleable: true",
                     "    default-hidden: false", "    sorting: 0", "    markers: {"]
            for m in mine:
                lines += ["      %s: {" % m["id"], '        type: "poi"',
                          "        position: { x: %d, y: %d, z: %d }" % (m["x"], m["y"], m["z"]),
                          "        label: %s" % _hocon_str(m["label"]),
                          "        detail: %s" % _hocon_str("<b>%s</b>%s" % (_html(m["label"]),
                                                                           "<br>" + _html(m["detail"]) if m.get("detail") else "")),
                          "        max-distance: 100000", "      }"]
            lines += ["    }", "  }", "}", MARK_END]
            txt = txt.rstrip("\n") + "\n\n" + "\n".join(lines) + "\n"
        tmp = path + ".wbtmp"
        with open(tmp, "w", encoding="utf-8") as f:
            f.write(txt)
        os.replace(tmp, path)
    rcon_try("bluemap reload light")


def _html(s):
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


@api("GET", "/api/markers")
def r_markers(h, s, q):
    h.json({"markers": load_json(MARKERS_PATH, [])})


@api("POST", "/api/markers")
def r_markers_set(h, s, q):
    d = h.body_json()
    a = d.get("action")
    markers = load_json(MARKERS_PATH, [])
    if a == "add":
        m = d.get("marker") or {}
        try:
            x, y, z = int(m["x"]), int(m.get("y", 64)), int(m["z"])
        except (KeyError, TypeError, ValueError):
            raise ApiError("Koordinaten fehlen")
        label = re.sub(r"[\r\n]", " ", str(m.get("label", ""))).strip()[:60]
        if not label:
            raise ApiError("Bitte einen Namen angeben")
        dim = m.get("dim", "overworld")
        if dim not in MAP_FOR_DIM:
            raise ApiError("Unbekannte Dimension")
        markers.append({"id": "m" + secrets.token_hex(4), "label": label, "x": x, "y": y, "z": z, "dim": dim,
                        "detail": re.sub(r"[\r\n]", " ", str(m.get("detail", "")))[:200], "by": s["user"], "t": now()})
    elif a == "delete":
        markers = [m for m in markers if m.get("id") != d.get("id")]
    else:
        raise ApiError("Unbekannte Aktion")
    save_json(MARKERS_PATH, markers)
    markers_apply()
    act(h, s, "marker-" + a, str((d.get("marker") or {}).get("label", d.get("id", ""))))
    h.json({"ok": True})


# ── 20. Server-Icon ──

@api("GET", "/api/server-icon")
def r_icon_get(h, s, q):
    p = srv("server-icon.png")
    if not os.path.isfile(p):
        raise ApiError("Kein Icon", 404)
    with open(p, "rb") as f:
        h.send_body(200, f.read(), "image/png", {"Cache-Control": "no-cache"})


@api("PUT", "/api/server-icon")
def r_icon_put(h, s, q):
    data = h.read_body(512 * 1024)
    if data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        raise ApiError("Bitte ein PNG-Bild")
    w, hh = struct.unpack(">II", data[16:24])
    if (w, hh) != (64, 64):
        raise ApiError("Das Icon muss genau 64 × 64 Pixel groß sein")
    if os.path.isfile(srv("server-icon.png")):  # für „Rückgängig“
        os.makedirs(os.path.join(DATA, "archiv"), exist_ok=True)
        shutil.copyfile(srv("server-icon.png"), ICON_PREV)
    tmp = srv("server-icon.png.wbtmp")
    with open(tmp, "wb") as f:
        f.write(data)
    os.replace(tmp, srv("server-icon.png"))
    act(h, s, "server-icon")
    h.json({"ok": True})


ICON_PREV = os.path.join(DATA, "archiv", "vorheriges-server-icon.png")


def image_tool():
    return shutil.which("magick") or shutil.which("convert")


def sniff_image(data):
    """Formate, die Browser oft nicht anzeigen können → ImageMagick-Coder (nur diese werden umgewandelt)."""
    if data[4:8] == b"ftyp":
        brand = data[8:12]
        if brand in (b"avif", b"avis"):
            return "avif"
        if brand in (b"heic", b"heix", b"hevc", b"hevx", b"heim", b"heis", b"mif1", b"msf1"):
            return "heic"
    if data[:4] in (b"II*\x00", b"MM\x00*"):
        return "tiff"
    if data[:4] == b"8BPS":
        return "psd"
    if data[:2] == b"\xff\x0a" or data[:12] == b"\x00\x00\x00\x0cJXL \r\n\x87\n":
        return "jxl"
    if data[:2] == b"BM":
        return "bmp"
    if data[:4] == b"\x00\x00\x01\x00":
        return "ico"
    return None


@api("GET", "/api/image/convert")
def r_img_conv_info(h, s, q):
    h.json({"available": bool(image_tool())})


@api("PUT", "/api/image/convert")
def r_img_convert(h, s, q):
    """Wandelt HEIC/AVIF/TIFF/PSD/JPEG-XL … in ein PNG (max. 2048 px), damit der Icon-Editor es öffnen kann."""
    data = h.read_body(40 * 1024 * 1024)
    coder = sniff_image(data)
    if not coder:
        raise ApiError("Bild konnte nicht gelesen werden – unbekanntes Format oder beschädigte Datei")
    tool = image_tool()
    if not tool:
        raise ApiError("%s-Bilder kann dein Browser nicht öffnen, und auf dem Server ist kein Bildkonverter "
                       "installiert (ImageMagick, z. B. unter Linux: sudo apt install imagemagick libheif1). Alternativ "
                       "das Bild vorher als PNG/JPG speichern." % coder.upper())
    os.makedirs(TMP, exist_ok=True)
    src = os.path.join(TMP, "icon-convert-%s.%s" % (secrets.token_hex(6), coder))
    try:
        with open(src, "wb") as f:
            f.write(data)
        r = subprocess.run([tool, "-limit", "memory", "256MiB", "-limit", "disk", "512MiB",
                            "%s:%s[0]" % (coder, src), "-auto-orient", "-resize", "2048x2048>", "png:-"],
                           capture_output=True, timeout=60)
    except subprocess.TimeoutExpired:
        raise ApiError("Umwandlung dauerte zu lange")
    finally:
        _unlink(src)
    if r.returncode != 0 or not r.stdout.startswith(b"\x89PNG"):
        msg = r.stderr.decode("utf-8", "replace").strip().splitlines()
        raise ApiError("Umwandlung fehlgeschlagen (%s)%s" % (coder.upper(), ": " + msg[-1][:160] if msg else ""))
    h.send_body(200, r.stdout, "image/png", {"Cache-Control": "no-store"})


@api("POST", "/api/server-icon")
def r_icon_action(h, s, q):
    d = h.body_json()
    old = os.path.join(DATA, "archiv", "altes-server-icon.png")
    if d.get("action") == "old":
        if not os.path.isfile(old):
            raise ApiError("Kein altes Icon vorhanden", 404)
        shutil.copyfile(old, srv("server-icon.png"))
    elif d.get("action") == "previous":
        if not os.path.isfile(ICON_PREV):
            raise ApiError("Kein vorheriges Icon vorhanden", 404)
        cur = srv("server-icon.png")
        if os.path.isfile(cur):  # tauschen, damit man auch wieder zurück kann
            shutil.copyfile(cur, ICON_PREV + ".swap")
            shutil.copyfile(ICON_PREV, cur)
            os.replace(ICON_PREV + ".swap", ICON_PREV)
        else:
            shutil.copyfile(ICON_PREV, cur)
    elif d.get("action") == "delete":
        if os.path.isfile(srv("server-icon.png")):
            os.makedirs(os.path.join(DATA, "archiv"), exist_ok=True)
            shutil.copyfile(srv("server-icon.png"), ICON_PREV)
        _unlink(srv("server-icon.png"))
    else:
        raise ApiError("Unbekannte Aktion")
    act(h, s, "server-icon", d.get("action"))
    h.json({"ok": True})


@api("GET", "/api/server-icon/info")
def r_icon_info(h, s, q):
    h.json({"current": os.path.isfile(srv("server-icon.png")), "previous": os.path.isfile(ICON_PREV),
            "old": os.path.isfile(os.path.join(DATA, "archiv", "altes-server-icon.png")),
            "convert": bool(image_tool())})


@api("GET", "/api/server-icon/old")
def r_icon_old(h, s, q):
    p = os.path.join(DATA, "archiv", "altes-server-icon.png")
    if not os.path.isfile(p):
        raise ApiError("Kein altes Icon", 404)
    with open(p, "rb") as f:
        h.send_body(200, f.read(), "image/png", {"Cache-Control": "no-cache"})


# ── 21. Datapacks & Ressourcenpaket ──

def _bracket_list(out):
    return re.findall(r"\[([^\]]+)\]", out or "")


@api("GET", "/api/datapacks")
def r_datapacks(h, s, q):
    level = read_props().get("level-name", "world")
    d = srv(level, "datapacks")
    files = []
    try:
        for n in sorted(os.listdir(d)):
            p = os.path.join(d, n)
            files.append({"name": n, "dir": os.path.isdir(p), "size": os.path.getsize(p) if os.path.isfile(p) else None,
                          "mtime": os.path.getmtime(p)})
    except OSError:
        pass
    enabled = available = None
    out = rcon_try("datapack list enabled")
    if out is not None:
        enabled = [x.split(" (")[0] for x in _bracket_list(out)]
        available = [x.split(" (")[0] for x in _bracket_list(rcon_try("datapack list available"))]
    p = read_props()
    h.json({"dir": "%s/datapacks" % level, "files": files, "enabled": enabled, "available": available,
            "resourcePack": {"url": p.get("resource-pack", ""), "sha1": p.get("resource-pack-sha1", ""),
                             "required": p.get("require-resource-pack") == "true", "prompt": p.get("resource-pack-prompt", "")},
            "publicAddress": CONF.get("public_address"), "mapPort": bm_conf("webserver.conf", "port") or "8100"})


@api("POST", "/api/datapacks")
def r_datapack_action(h, s, q):
    d = h.body_json()
    a, name = d.get("action"), str(d.get("name", ""))
    if not re.fullmatch(r"[^\r\n\"]{1,200}", name):
        raise ApiError("Ungültiger Name")
    if a in ("enable", "disable"):
        out = RCON.cmd('datapack %s "%s"' % (a, name))
    elif a == "delete":
        level = read_props().get("level-name", "world")
        fname = name[5:] if name.startswith("file/") else name
        p = safe_path(os.path.join(level, "datapacks", os.path.basename(fname)))
        rcon_try('datapack disable "file/%s"' % os.path.basename(fname))
        if os.path.isdir(p):
            shutil.rmtree(p)
        elif os.path.isfile(p):
            os.remove(p)
        out = "gelöscht"
    else:
        raise ApiError("Unbekannte Aktion")
    act(h, s, "datapack-" + a, name)
    h.json({"ok": True, "output": out})


def fetch_sha1(url, limit=250 * 1024 * 1024):
    parts = urllib.parse.urlsplit(url)
    if parts.scheme not in ("http", "https") or not parts.hostname:
        raise ApiError("Bitte eine http(s)-Adresse angeben")
    h1, total = hashlib.sha1(), 0
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60) as r:
            while True:
                chunk = r.read(256 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > limit:
                    raise ApiError("Paket zu groß (max. 250 MB)")
                h1.update(chunk)
    except (urllib.error.URLError, OSError) as e:
        raise ApiError("Download nicht möglich: %s" % getattr(e, "reason", e))
    return h1.hexdigest(), total


@api("POST", "/api/resourcepack")
def r_rp(h, s, q):
    d = h.body_json()
    if d.get("action") == "clear":
        write_props({"resource-pack": "", "resource-pack-sha1": "", "require-resource-pack": "false"})
        act(h, s, "ressourcenpaket-entfernt")
        return h.json({"ok": True})
    url = str(d.get("url", "")).strip()
    sha1, size = fetch_sha1(url)
    write_props({"resource-pack": url, "resource-pack-sha1": sha1,
                 "require-resource-pack": "true" if d.get("required") else "false",
                 "resource-pack-prompt": re.sub(r"[\r\n]", " ", str(d.get("prompt") or ""))[:200]})
    act(h, s, "ressourcenpaket", url)
    h.json({"ok": True, "sha1": sha1, "size": size})


@api("PUT", "/api/resourcepack/upload")
def r_rp_upload(h, s, q):
    name = re.sub(r"[^A-Za-z0-9._\-]", "_", os.path.basename(q.get("name", "pack.zip")))[:80]
    if not name.lower().endswith(".zip"):
        raise ApiError("Bitte eine .zip-Datei")
    web = bm_conf("webserver.conf", "webroot") or "bluemap/web"
    d = srv(web, "werkbank")
    os.makedirs(d, exist_ok=True)
    n = int(h.headers.get("Content-Length") or 0)
    if n > 250 * 1024 * 1024:
        raise ApiError("Paket zu groß (max. 250 MB)", 413)
    h1 = hashlib.sha1()
    tmp = os.path.join(d, name + ".upload")
    left = n
    with open(tmp, "wb") as f:
        while left > 0:
            chunk = h.rfile.read(min(left, 256 * 1024))
            if not chunk:
                break
            h1.update(chunk)
            f.write(chunk)
            left -= len(chunk)
    if left:
        _unlink(tmp)
        raise ApiError("Upload unvollständig")
    os.replace(tmp, os.path.join(d, name))
    host = CONF.get("public_address") or "localhost"
    url = "http://%s:%s/werkbank/%s" % (host, bm_conf("webserver.conf", "port") or "8100", name)
    write_props({"resource-pack": url, "resource-pack-sha1": h1.hexdigest()})
    act(h, s, "ressourcenpaket-hochgeladen", name)
    h.json({"ok": True, "url": url, "sha1": h1.hexdigest()})


# ── 22. Empfohlene Mods ──

RECOMMENDED = {
    "mod": [
        ("ferrite-core", "Spart deutlich Arbeitsspeicher, ohne dass sich etwas am Spiel ändert. Fast immer sinnvoll."),
        ("chunky", "Generiert die Welt im Voraus. Weniger Lag beim Erkunden, und die 3D-Karte wird vollständig."),
        ("ledger", "Protokolliert, wer welchen Block abgebaut oder welche Kiste geöffnet hat – inklusive Rückgängig."),
        ("universal-graves", "Beim Tod landen deine Items in einem Grab statt auf dem Boden – nichts geht mehr verloren."),
        ("corpse", "Beim Tod bleibt eine Leiche mit allen Items liegen – nichts geht mehr verloren. Spieler brauchen den Mod auch."),
        ("simple-voice-chat", "Sprachchat im Spiel nach Entfernung. Spieler brauchen den Mod ebenfalls; zusätzlich muss UDP-Port 24454 freigegeben werden."),
        ("styled-chat", "Hübscherer Chat mit Farben, Links und Formatierung – rein serverseitig."),
        ("luckperms", "Rechteverwaltung: genau festlegen, wer welche Befehle nutzen darf."),
    ],
    "plugin": [
        ("chunky", "Generiert die Welt im Voraus. Weniger Lag beim Erkunden, und die 3D-Karte wird vollständig."),
        ("coreprotect", "Protokolliert, wer welchen Block abgebaut oder welche Kiste geöffnet hat – inklusive Rückgängig."),
        ("gravesx", "Beim Tod landen die Items in einem Grab statt auf dem Boden – nichts geht mehr verloren."),
        ("luckperms", "Rechteverwaltung: genau festlegen, wer welche Befehle nutzen darf."),
        ("simple-voice-chat", "Sprachchat im Spiel nach Entfernung. Spieler brauchen den Mod; zusätzlich muss UDP-Port 24454 freigegeben werden."),
        ("viaversion", "Lässt Spieler mit neueren Minecraft-Versionen joinen, ohne dass der Server sofort updaten muss."),
        ("bluemap", "Die 3D-Weltkarte im Browser – im Panel unter „Weltkarte 3D“ eingebunden."),
    ],
}
CLIENT_REQUIRED = {"simple-voice-chat", "corpse"}  # Modrinth sagt teils „optional“, ohne Client-Mod geht es aber nicht
_rec_cache = {"t": 0, "key": None, "val": None}


@api("GET", "/api/modrinth/recommended")
def r_mr_recommended(h, s, q):
    mc = mc_version()
    ld = detect_loader()
    L = LOADERS[ld]
    if not L["kind"]:
        return h.json({"mods": [], "installed": [], "mc": mc, "loader": ld, "loaderName": L["name"], "kind": None})
    if _rec_cache["key"] == (mc, ld) and now() - _rec_cache["t"] < 3600:
        val = _rec_cache["val"]
    else:
        recs = RECOMMENDED[L["kind"]]
        ids = json.dumps([slug for slug, _ in recs])
        projects = http_json(MODRINTH + "/projects?ids=" + urllib.parse.quote(ids)) or []
        by_slug = {p["slug"]: p for p in projects}
        val = []
        for slug, why in recs:
            p = by_slug.get(slug)
            if not p or not set(L["mr"]) & set(p.get("loaders") or []):
                continue  # gibt es für diese Server-Software gar nicht
            avail = mc in (p.get("game_versions") or [])
            client = "required" if slug in CLIENT_REQUIRED else p.get("client_side")
            if L["kind"] == "plugin" and slug not in CLIENT_REQUIRED:
                client = "unsupported"
            val.append({"project_id": p["id"], "slug": slug, "title": p.get("title"), "icon_url": p.get("icon_url"),
                        "description": why, "downloads": p.get("downloads"), "client_side": client,
                        "server_side": p.get("server_side"), "available": avail})
        _rec_cache.update(t=now(), key=(mc, ld), val=val)
    try:
        have = sorted({v["project_id"] for v in installed_versions().values()})
    except ApiError:
        have = []
    h.json({"mods": val, "installed": have, "mc": mc, "loader": ld, "loaderName": L["name"], "kind": L["kind"]})


# ═════════════════════════ Einrichtung (erster Start) & Server erstellen ═════════════════════════

SETUP = {"code": None}
USER_RE = re.compile(r"^[A-Za-z0-9_.\-]{2,32}$")
GAMEMODES = ("survival", "creative", "adventure")
DIFFICULTIES = ("peaceful", "easy", "normal", "hard")


def setup_needed():
    return not get_users()


def setup_code():
    """Einmal-Code für die Einrichtung über das Netzwerk (steht im Terminal / Log von Blockhaus)."""
    if SETUP["code"] is None:
        SETUP["code"] = "%06d" % secrets.randbelow(10 ** 6)
        print("\n  Blockhaus-Einrichtung: Code für den Zugriff über das Netzwerk: %s\n" % SETUP["code"], file=sys.stderr)
        try:
            p = os.path.join(DATA, "setup-code")
            with open(p, "w", encoding="utf-8") as f:
                f.write(SETUP["code"])
            os.chmod(p, 0o600)
        except OSError:
            pass
    return SETUP["code"]


def is_local_request(h):
    return h.ip() in ("127.0.0.1", "::1", "::ffff:127.0.0.1")


def has_server():
    return os.path.isfile(srv("server.properties"))


def free_port(port, kind=socket.SOCK_STREAM):
    s = socket.socket(socket.AF_INET, kind)
    try:
        s.bind(("0.0.0.0", port))
        return True
    except OSError:
        return False
    finally:
        s.close()


def ram_recommend(total_mb):
    """Empfehlung: dem System mindestens 2 GB bzw. ein Viertel lassen, höchstens 8 GB für Minecraft."""
    rec = total_mb - max(2048, total_mb // 4)
    return int(max(1024, min(8192, rec)) // 512 * 512)


def storage_used(max_age=600):
    total = 0
    for p in {CONF["server_dir"], CONF["backup_dir"]}:
        c = _size_cache.get(p)
        if c and now() - c[0] < max_age:
            total += c[1]
        elif os.path.isdir(p):
            _size_cache.pop(p, None)
            total += dir_size(p)
    return total


def storage_limit():
    gb = CONF.get("storage_max_gb")
    return int(float(gb) * 1024 ** 3) if gb else None


def storage_check(label):
    """Vor einem Backup: Speicherlimit einhalten (alte automatische Backups löschen, sonst abbrechen)."""
    lim = storage_limit()
    if not lim:
        return
    _size_cache.pop(CONF["backup_dir"], None)
    used = storage_used(0)
    if used < lim:
        return
    autos = [b for b in list_backups() if b["kind"] == "auto"]
    while used >= lim and len(autos) > 1:
        b = autos.pop()
        _unlink(os.path.join(CONF["backup_dir"], b["name"]))
        used -= b["size"]
        HUB.push_log("Speicherlimit: altes Backup %s gelöscht" % b["name"], "sys")
    _size_cache.pop(CONF["backup_dir"], None)
    if used >= lim:
        raise RuntimeError("Speicherlimit von %s GB erreicht – kein Platz für ein neues Backup. Alte Backups "
                           "löschen oder das Limit erhöhen." % CONF.get("storage_max_gb"))


def system_info():
    total, avail = osutil.Metrics().memory()
    d = CONF["server_dir"]
    while not os.path.exists(d) and os.path.dirname(d) != d:
        d = os.path.dirname(d)
    du = shutil.disk_usage(d)
    tmb = (total or 4 * 1024 ** 3) // 1048576
    return {"os": {"win32": "Windows", "darwin": "macOS"}.get(sys.platform, "Linux"), "ramTotalMb": tmb,
            "ramAvailMb": (avail or 0) // 1048576, "cpus": os.cpu_count(), "diskFree": du.free, "diskTotal": du.total,
            "ramRecommendMb": ram_recommend(tmb), "lanIp": osutil.lan_ip()}


@api("GET", "/api/setup/status")
def r_setup_status(h, s, q):  # öffentlich (siehe Handler.route)
    needed = setup_needed()
    local = is_local_request(h)
    if needed and not local:
        setup_code()
    h.json({"needed": needed, "needsCode": needed and not local, "version": VERSION,
            "os": {"win32": "Windows", "darwin": "macOS"}.get(sys.platform, "Linux")})


@api("POST", "/api/setup/admin")
def r_setup_admin(h, s, q):  # öffentlich, aber nur solange es noch keinen Admin gibt
    if not setup_needed():
        raise ApiError("Blockhaus ist bereits eingerichtet", 403)
    d = h.body_json()
    if not is_local_request(h) and not hmac.compare_digest(str(d.get("code", "")).strip(), setup_code()):
        time.sleep(1)
        raise ApiError("Der Einrichtungs-Code stimmt nicht (er steht im Terminal bzw. Log von Blockhaus)", 403)
    user, pw = str(d.get("user", "")).strip(), str(d.get("password", ""))
    if not USER_RE.fullmatch(user):
        raise ApiError("Benutzername: 2–32 Zeichen, nur Buchstaben, Ziffern, . _ -")
    if len(pw) < 8:
        raise ApiError("Das Passwort muss mindestens 8 Zeichen haben")
    with users_lock:
        if get_users():
            raise ApiError("Blockhaus ist bereits eingerichtet", 403)
    set_user_pw(user, pw)
    _unlink(os.path.join(DATA, "setup-code"))
    if d.get("language") in ("de", "en"):
        CONF["language"] = d["language"]
        set_user_lang(user, d["language"])
    save_json(CONF_PATH, CONF)
    audit(user, h.ip(), "einrichtung-admin")
    h.start_session(user)


@api("GET", "/api/server/create/info")
def r_create_info(h, s, q):
    info = system_info()
    port = next((p for p in range(25565, 25600) if free_port(p)), 25565)
    h.json({"system": info, "hasServer": has_server(), "serverDir": CONF["server_dir"],
            "defaultDir": DEFAULT_CONF["server_dir"], "port": port, "running": svc_info().get("ActiveState") == "active",
            "loaders": [{"id": k, "name": L["name"], "kind": L["kind"], "desc": L["desc"], "verLabel": L["verLabel"]}
                        for k, L in LOADERS.items()],
            "settings": panel_settings()})


def _opt_int(d, k, lo, hi, default):
    try:
        v = int(d.get(k, default))
    except (TypeError, ValueError):
        raise ApiError("Ungültiger Wert: %s" % k)
    if not lo <= v <= hi:
        raise ApiError("%s muss zwischen %d und %d liegen" % (k, lo, hi))
    return v


@api("POST", "/api/server/create")
def r_create(h, s, q):
    d = h.body_json()
    mode = d.get("mode")
    if update_lock.locked() or backup_lock.locked():
        raise ApiError("Es läuft bereits eine Aufgabe")
    if svc_info().get("ActiveState") in ("active", "activating"):
        raise ApiError("Bitte zuerst den laufenden Server stoppen")
    path = os.path.abspath(os.path.expanduser(str(d.get("serverDir") or DEFAULT_CONF["server_dir"])))
    if mode == "import":
        if not os.path.isfile(os.path.join(path, "server.properties")):
            raise ApiError("In diesem Ordner liegt kein Minecraft-Server (server.properties fehlt)")
        apply_settings(d.get("settings") or {})
        CONF["server_dir"] = path
        save_json(CONF_PATH, CONF)
        ensure_rcon()
        ensure_launch_conf()
        if d.get("eula") and not eula_accepted():
            write_eula()
        act(h, s, "server-uebernommen", path)
        return h.json({"ok": True, "server": server_version()})
    if mode != "new":
        raise ApiError("Unbekannte Art")
    if not d.get("eula"):
        raise ApiError("Ohne Zustimmung zur Minecraft-EULA kann kein Server erstellt werden")
    if os.path.isdir(path) and os.listdir(path):
        raise ApiError("Der Ordner %s ist nicht leer – bitte einen leeren oder neuen Ordner wählen" % path)
    ld = str(d.get("loader") or "")
    if ld not in LOADERS:
        raise ApiError("Bitte eine Server-Software wählen")
    mc, lv = str(d.get("mc") or ""), str(d.get("loaderVersion") or "")
    if not VER_RE.fullmatch(mc) or (lv and not VER_RE.fullmatch(lv)):
        raise ApiError("Ungültige Version")
    motd = re.sub(r"[\r\n]", " ", str(d.get("motd") or "Ein Blockhaus-Server"))[:59]
    seed = re.sub(r"[\r\n]", "", str(d.get("seed") or ""))[:64]
    props = {
        "motd": motd, "level-seed": seed, "level-name": "world",
        "gamemode": d.get("gamemode") if d.get("gamemode") in GAMEMODES else "survival",
        "difficulty": d.get("difficulty") if d.get("difficulty") in DIFFICULTIES else "normal",
        "max-players": _opt_int(d, "maxPlayers", 1, 1000, 10),
        "server-port": _opt_int(d, "port", 1024, 65535, 25565),
        "online-mode": "false" if d.get("onlineMode") is False else "true",
        "pvp": "false" if d.get("pvp") is False else "true",
        "white-list": "true" if d.get("whitelist") else "false",
    }
    if not free_port(props["server-port"]):
        raise ApiError("Port %d ist schon belegt – bitte einen anderen wählen" % props["server-port"])
    resolve_install(ld if ld != "vanilla" else "vanilla", mc, lv)  # früh prüfen, ob es die Kombination gibt
    apply_settings(d.get("settings") or {})
    act(h, s, "server-erstellen", "%s %s %s" % (LOADERS[ld]["name"], mc, lv))
    threading.Thread(target=lambda: _bg(create_server, path, ld, mc, lv, props, bool(d.get("start", True)),
                                        s["user"]), daemon=True).start()
    h.json({"ok": True})


def write_eula():
    with open(srv("eula.txt"), "w", encoding="utf-8") as f:
        f.write("# Minecraft-EULA (https://aka.ms/MinecraftEULA) – zugestimmt über Blockhaus am %s\neula=true\n"
                % time.strftime("%Y-%m-%d %H:%M"))


def create_server(path, ld, mc, lv, props, start, user):
    if not update_lock.acquire(blocking=False):
        raise RuntimeError("Es läuft bereits eine Aufgabe")

    def step(msg):
        HUB.set_task({"kind": "setup", "msg": msg[0].upper() + msg[1:], "t": now()})
        HUB.push_log("Einrichtung: " + msg, "sys")

    try:
        L = LOADERS[ld]
        step("bereite den Server-Ordner vor …")
        os.makedirs(path, exist_ok=True)
        CONF["server_dir"] = path
        save_json(CONF_PATH, CONF)
        spec = resolve_install(ld, mc, lv)
        jpath = java_for(mc, install=True, step=step)
        launch = install_loader(ld, mc, lv, spec, jpath, step)
        write_eula()
        rport = next((p for p in range(25575, 25700) if free_port(p)), 25575)
        with open(srv("server.properties"), "w", encoding="utf-8") as f:
            f.write("#Minecraft server properties – erstellt von Blockhaus\n")
        write_props(dict(props, **{"enable-rcon": "true", "rcon.port": rport,
                                   "rcon.password": secrets.token_urlsafe(24), "broadcast-rcon-to-ops": "false"}))
        if L["dir"]:
            os.makedirs(srv(L["dir"]), exist_ok=True)
        write_launch_conf(ld, mc, lv, launch)
        CONF["mc_version"], CONF["loader_version"] = mc, lv
        save_json(CONF_PATH, CONF)
        HUB.push_log("Einrichtung: %s %s ist installiert" % (L["name"], mc), "sys")
        audit(user, "-", "server-erstellt", "%s %s" % (L["name"], mc))
        if start:
            step("starte den Server – beim ersten Start wird die Welt erzeugt …")
            svc_action("start")
    except Exception as e:
        HUB.push_log("Einrichtung fehlgeschlagen: %s" % e, "err")
        audit(user, "-", "server-erstellen-fehlgeschlagen", str(e)[:300])
        raise
    finally:
        HUB.set_task(None)
        update_lock.release()


# ── Einstellungen für Start & Ressourcen ──

SETTING_KEYS = ("ram_max_mb", "storage_max_gb", "autostart", "auto_restart", "java", "listen_host",
                "public_address", "language", "auto_backup_hours", "auto_backup_keep")


def panel_settings():
    info = {k: CONF.get(k) for k in SETTING_KEYS}
    info["control"] = CONF.get("control")
    info["ramEffectiveMb"] = ram_limits()[1]
    return info


def apply_settings(d):
    total = (osutil.Metrics().memory()[0] or 4 * 1024 ** 3) // 1048576
    if "ram_max_mb" in d:
        v = d["ram_max_mb"]
        if v in (None, "", 0):
            CONF["ram_max_mb"] = None
        else:
            v = int(v)
            if not 512 <= v <= total:
                raise ApiError("Arbeitsspeicher: zwischen 512 MB und %d MB" % total)
            CONF["ram_max_mb"] = v
            CONF["ram_min_mb"] = None
    if "storage_max_gb" in d:
        v = d["storage_max_gb"]
        if v in (None, "", 0):
            CONF["storage_max_gb"] = None
        else:
            v = float(v)
            if v < 1:
                raise ApiError("Speicherlimit: mindestens 1 GB")
            CONF["storage_max_gb"] = round(v, 1)
    for k in ("autostart", "auto_restart"):
        if k in d:
            CONF[k] = bool(d[k])
    if "java" in d:
        v = str(d["java"] or "auto").strip()
        if v != "auto" and not os.path.isfile(v):
            raise ApiError("Java nicht gefunden: %s" % v)
        CONF["java"] = v
    if "listen_host" in d:
        if d["listen_host"] not in ("127.0.0.1", "0.0.0.0"):
            raise ApiError("Ungültige Netzwerk-Einstellung")
        CONF["listen_host"] = d["listen_host"]
    if "public_address" in d:
        v = str(d["public_address"] or "").strip()
        if v and not re.fullmatch(r"[A-Za-z0-9.\-:\[\]]{1,253}", v):
            raise ApiError("Ungültige Adresse")
        CONF["public_address"] = v
    if "language" in d and d["language"] in ("de", "en"):
        CONF["language"] = d["language"]
    if "auto_backup_hours" in d:
        v = float(d["auto_backup_hours"] or 0)
        if not 0 <= v <= 168:
            raise ApiError("Backup-Intervall: 0 bis 168 Stunden")
        CONF["auto_backup_hours"] = v
    if "auto_backup_keep" in d:
        CONF["auto_backup_keep"] = max(1, min(100, int(d["auto_backup_keep"] or 7)))
    save_json(CONF_PATH, CONF)


@api("GET", "/api/panel/settings")
def r_panel_settings(h, s, q):
    h.json({"settings": panel_settings(), "system": system_info(),
            "storage": {"used": storage_used(), "max": storage_limit()}, "java": {
                "managed": sorted(managed_javas()), "system": java_info()[0] if not java_auto() else shutil.which("java")}})


@api("POST", "/api/panel/settings")
def r_panel_settings_set(h, s, q):
    d = h.body_json()
    old_host = CONF.get("listen_host")
    apply_settings({k: v for k, v in d.items() if k in SETTING_KEYS})
    act(h, s, "einstellungen", ", ".join(sorted(k for k in d if k in SETTING_KEYS)))
    h.json({"ok": True, "settings": panel_settings(), "restartPanel": CONF.get("listen_host") != old_host})


# ═════════════════════════ Einführung (Erste Schritte & Tour) ═════════════════════════

def user_flags(name):
    return get_users().get(name, {}).get("onboarding", {})


def set_user_flag(name, key, val=True):
    with users_lock:
        users = get_users()
        if name in users:
            users[name].setdefault("onboarding", {})[key] = val
            save_json(USERS_PATH, users)


@api("GET", "/api/onboarding")
def r_onboarding(h, s, q):
    flags = user_flags(s["user"])
    p = read_props()
    running = svc_info().get("ActiveState") == "active"
    started = running or os.path.isfile(srv("logs", "latest.log"))
    joined = bool([e for e in load_json(srv("usercache.json"), []) if isinstance(e, dict)])
    ops = [e.get("name") for e in load_json(srv("ops.json"), []) if isinstance(e, dict)]
    steps = [
        {"id": "start", "done": started},
        {"id": "join", "done": joined},
        {"id": "op", "done": bool(ops)},
        {"id": "friends", "done": bool(flags.get("friends")) or bool(CONF.get("public_address"))},
        {"id": "backup", "done": float(CONF.get("auto_backup_hours") or 0) > 0},
    ]
    h.json({"steps": steps, "dismissed": bool(flags.get("dismissed")), "tourDone": bool(flags.get("tour")),
            "running": running, "port": p.get("server-port") or "25565", "lanIp": osutil.lan_ip(),
            "address": CONF.get("public_address") or "", "whitelist": p.get("white-list") == "true",
            "autoBackupHours": CONF.get("auto_backup_hours") or 0})


@api("POST", "/api/onboarding")
def r_onboarding_set(h, s, q):
    d = h.body_json()
    key = d.get("flag")
    if key not in ("dismissed", "tour", "friends"):
        raise ApiError("Unbekannte Aktion")
    set_user_flag(s["user"], key, bool(d.get("value", True)))
    h.json({"ok": True})


api("GET", "/api/metrics")(r_metrics)


@api("POST", "/api/panel/restart")
def r_panel_restart(h, s, q):
    act(h, s, "panel-neustart")
    h.json({"ok": True})
    threading.Timer(0.5, restart_self).start()


def restart_self():
    """Blockhaus neu starten. Der Minecraft-Server läuft dabei weiter und wird danach wieder übernommen."""
    # Nur im eigenen systemd-Dienst (Autostart unter Linux) übernimmt systemd den Neustart. INVOCATION_ID allein
    # reicht nicht: die erben auch Programme, die nur irgendwo unter systemd gestartet wurden.
    if os.environ.get("BLOCKHAUS_SERVICE") == "systemd":
        os._exit(3)
    system.restart_detached("--background", gui=True)
    os._exit(0)


# ── Programm: Version, Updates, Autostart, Beenden, Deinstallieren ──

_update = {"checked": 0, "info": None}


@api("GET", "/api/system")
def r_system(h, s, q):
    info = system.install_info()
    h.json({"version": VERSION, "install": info, "autostart": system.autostart_status(),
            "dataDir": DATA, "serverDir": CONF["server_dir"], "backupDir": CONF["backup_dir"],
            "update": _update["info"], "canUpdate": bool(info["installed"]), "os": system_info()["os"]})


@api("POST", "/api/system/autostart")
def r_system_autostart(h, s, q):
    on = bool(h.body_json().get("on"))
    try:
        state = system.set_autostart(on)
    except Exception as e:
        raise ApiError("Autostart konnte nicht geändert werden: %s" % e)
    act(h, s, "autostart-system", "an" if state else "aus")
    h.json({"ok": True, "autostart": state})


@api("GET", "/api/system/update")
def r_system_update_check(h, s, q):
    if q.get("force") or now() - _update["checked"] > 3600 or not _update["info"]:
        try:
            _update["info"] = system.check_update(VERSION)
        except Exception as e:
            raise ApiError("Update-Prüfung nicht möglich: %s" % e, 502)
        _update["checked"] = now()
    h.json(dict(_update["info"], canUpdate=bool(system.home())))


def update_check_loop():
    """Kurz nach dem Start und dann alle 6 Stunden nach einer neuen Blockhaus-Version schauen."""
    time.sleep(20)
    while True:
        try:
            _update["info"] = system.check_update(VERSION)
            _update["checked"] = now()
            if _update["info"].get("available"):
                print("Neue Blockhaus-Version verfügbar: %s" % _update["info"]["version"], file=sys.stderr)
        except Exception as e:
            print("Update-Prüfung nicht möglich:", e, file=sys.stderr)
        time.sleep(6 * 3600)


@api("POST", "/api/system/update")
def r_system_update(h, s, q):
    if not system.home():
        raise ApiError("Updates gibt es nur für installierte Versionen (nicht beim Start aus dem Quellcode)")
    if update_lock.locked():
        raise ApiError("Es läuft bereits eine Aufgabe")
    info = _update["info"] if _update["info"] and now() - _update["checked"] < 600 else None
    if not info:  # nur neu fragen, wenn die letzte Prüfung älter als 10 Minuten ist
        try:
            info = system.check_update(VERSION)
        except Exception as e:
            raise ApiError("Update-Prüfung nicht möglich: %s" % e, 502)
    if not info.get("available"):
        raise ApiError("Keine Updates verfügbar")
    act(h, s, "blockhaus-update", "%s → %s" % (VERSION, info["version"]))

    def job():
        with update_lock:
            try:
                ver = system.apply_update(info, progress=lambda m: HUB.set_task({"kind": "selfupdate", "msg": m[0].upper() + m[1:], "t": now()}))
                HUB.push_log("Blockhaus %s installiert – startet neu …" % ver, "sys")
            except Exception as e:
                HUB.set_task(None)
                HUB.push_log("Update fehlgeschlagen: %s" % e, "err")
                return
        time.sleep(1)
        restart_self()
    threading.Thread(target=job, daemon=True).start()
    h.json({"ok": True, "version": info["version"]})


@api("POST", "/api/panel/quit")
def r_panel_quit(h, s, q):
    d = h.body_json()
    act(h, s, "blockhaus-beendet", "mit Server" if d.get("stopServer") else "")
    h.json({"ok": True})

    def bye():
        if d.get("stopServer") and svc_info().get("ActiveState") == "active":
            try:
                svc_action("stop")
            except Exception:
                pass
        os._exit(0)
    threading.Timer(0.5, bye).start()


@api("POST", "/api/system/uninstall")
def r_system_uninstall(h, s, q):
    d = h.body_json()
    if str(d.get("confirm", "")).strip().lower() not in ("deinstallieren", "uninstall"):
        raise ApiError("Bitte zur Bestätigung „deinstallieren“ eintippen")
    if update_lock.locked() or backup_lock.locked():
        raise ApiError("Es läuft bereits eine Aufgabe")
    keep = bool(d.get("keepWorlds", True))
    audit(s["user"], h.ip(), "blockhaus-deinstalliert", "Welten behalten" if keep else "alles gelöscht")
    h.json({"ok": True})

    def job():
        time.sleep(0.5)
        if svc_info().get("ActiveState") == "active":
            try:
                svc_action("stop")
            except Exception:
                pass
        system.uninstall(DATA, keep_worlds=keep, server_dir=CONF["server_dir"], backup_dir=CONF["backup_dir"],
                         log=lambda m: print(m, file=sys.stderr))
        os._exit(0)
    threading.Thread(target=job, daemon=True).start()


# ───────────────────────── Start ─────────────────────────

def ensure_rcon():
    """Aktiviert RCON mit Zufallspasswort, falls noch nicht eingerichtet. Gibt True zurück, wenn geändert."""
    p = read_props()
    changes = {}
    if p.get("enable-rcon") != "true":
        changes["enable-rcon"] = "true"
    if not p.get("rcon.password"):
        changes["rcon.password"] = secrets.token_urlsafe(24)
    if p.get("broadcast-rcon-to-ops") != "false":
        changes["broadcast-rcon-to-ops"] = "false"
    if changes:
        write_props(changes)
    return bool(changes)


def cli():
    args = sys.argv[1:]
    if args[:1] in (["version"], ["--version"]):
        print("Blockhaus %s" % VERSION)
        return True
    if args[:1] in (["--gui"], ["--browser"]):
        try:
            from . import gui
        except ImportError:
            import gui
        sys.exit(gui.main(CONF, browser=args[0] == "--browser"))
    if args[:1] == ["setup-code"]:
        try:
            with open(os.path.join(DATA, "setup-code"), encoding="utf-8") as f:
                print("Einrichtungs-Code:", f.read().strip())
        except OSError:
            print("Blockhaus ist bereits eingerichtet (oder noch nicht gestartet).")
        return True
    if args[:1] == ["autostart"]:
        if args[1:2] in (["on"], ["off"]):
            system.set_autostart(args[1] == "on")
        print("Autostart:", "an" if system.autostart_status() else "aus")
        return True
    if args[:1] == ["update"]:
        info = system.check_update(VERSION)
        if not info.get("available"):
            print("Blockhaus %s ist aktuell." % VERSION)
        elif "--check" in args:
            print("Neue Version verfügbar: %s (installiert: %s)" % (info["version"], VERSION))
        else:
            print("Installiert:", system.apply_update(info, progress=print), "– bitte Blockhaus neu starten")
        return True
    if args[:1] == ["uninstall"]:
        keep = "--delete-worlds" not in args
        if "--yes" not in args:
            print("Blockhaus wird entfernt (Autostart, Einstellungen, Java%s)." %
                  (", Server und Backups werden nach ~/Blockhaus-Sicherung-… verschoben" if keep
                   else " UND Server, Welten und Backups"))
            if input("Zum Bestätigen „deinstallieren“ eintippen: ").strip().lower() not in ("deinstallieren", "uninstall"):
                print("Abgebrochen.")
                return True
        try:  # laufendes Blockhaus im Hintergrund beenden, damit keine Dateien mehr gesperrt sind
            with open(os.path.join(DATA, "blockhaus.pid")) as f:
                pid = int(f.read().strip() or 0)
            if pid and pid != os.getpid() and osutil.pid_alive(pid):
                osutil.kill_pid(pid)
                time.sleep(1.5)
        except (OSError, ValueError):
            pass
        if not use_systemd() and server_proc().info()["ActiveState"] == "active":
            server_proc().stop()
        system.uninstall(DATA, keep_worlds=keep, server_dir=CONF["server_dir"], backup_dir=CONF["backup_dir"],
                         remove_program="--keep-program" not in args)
        return True
    if len(sys.argv) >= 3 and sys.argv[1] in ("adduser", "passwd"):
        name = sys.argv[2]
        pw = sys.argv[3] if len(sys.argv) > 3 else secrets.token_urlsafe(12)
        if sys.argv[1] == "passwd" and name not in get_users():
            sys.exit("Admin %s existiert nicht" % name)
        set_user_pw(name, pw)
        print("Admin: %s\nPasswort: %s" % (name, pw))
        return True
    if len(sys.argv) >= 2 and sys.argv[1] == "enable-rcon":
        print("RCON geändert – Server-Neustart nötig" if ensure_rcon() else "RCON war bereits aktiv")
        return True
    return False


def main():
    os.makedirs(DATA, exist_ok=True)
    if cli():
        return
    if "--background" in sys.argv:  # ohne Konsole: Ausgaben ins Log (wird bei 5 MB neu begonnen)
        log = os.path.join(DATA, "blockhaus.log")
        try:
            if os.path.getsize(log) > 5 * 1024 * 1024:
                os.replace(log, log + ".1")
        except OSError:
            pass
        sys.stdout = sys.stderr = open(log, "a", encoding="utf-8", buffering=1)
        print("──── %s Blockhaus %s ────" % (time.strftime("%Y-%m-%d %H:%M:%S"), VERSION), file=sys.stderr)
    port_now = int(os.environ.get("BLOCKHAUS_PORT") or os.environ.get("WERKBANK_PORT") or CONF["listen_port"])
    # Nach einem Update/Neustart gibt die alte Instanz den Port gerade erst frei – kurz warten
    for attempt in range(30 if "--background" in sys.argv else 1):
        probe = socket.socket()
        try:
            probe.settimeout(1)
            busy = probe.connect_ex(("127.0.0.1", port_now)) == 0
        finally:
            probe.close()
        if not busy:
            break
        time.sleep(0.5)
    else:
        print("Port %d ist bereits belegt – läuft Blockhaus schon? (Sonst in der Konfiguration einen anderen Port wählen.)" % port_now, file=sys.stderr)
        return
    try:
        with open(os.path.join(DATA, "blockhaus.pid"), "w") as f:
            f.write(str(os.getpid()))
    except OSError:
        pass
    if not get_users():
        print("Blockhaus ist noch nicht eingerichtet – bitte im Browser öffnen und den Assistenten durchlaufen.",
              file=sys.stderr)
        if CONF.get("listen_host") not in ("127.0.0.1", "localhost", "::1"):
            setup_code()  # Einrichtung übers Netzwerk: Code gleich bereitstellen („blockhaus setup-code“)
    if not os.path.exists(CONF_PATH):
        save_json(CONF_PATH, CONF)
    has_server = os.path.isfile(srv("server.properties"))
    if has_server and ensure_rcon():
        print("RCON in server.properties aktiviert – wirkt nach dem nächsten Server-Neustart", file=sys.stderr)
    ensure_launch_conf()
    for target in (log_tailer, Sampler().run, auto_backup_loop, sched_loop, update_check_loop):
        threading.Thread(target=target, daemon=True).start()
    if not use_systemd():
        p = server_proc()  # übernimmt einen noch laufenden Server
        if CONF.get("autostart") and has_server and p.info()["ActiveState"] != "active":
            def autostart():
                HUB.push_log("Autostart: Minecraft-Server wird gestartet", "sys")
                try:
                    p.start()
                except Exception as e:
                    HUB.push_log("Autostart fehlgeschlagen: %s" % e, "err")
            threading.Thread(target=autostart, daemon=True).start()
    ThreadingHTTPServer.daemon_threads = True
    port_env = os.environ.get("BLOCKHAUS_PORT") or os.environ.get("WERKBANK_PORT")
    port = int(port_env or CONF["listen_port"])
    cert, key = os.path.join(DATA, "tls", "cert.pem"), os.path.join(DATA, "tls", "key.pem")
    if CONF.get("https") and shutil.which("openssl"):
        try:
            ensure_tls()
        except Exception as e:
            print("TLS-Einrichtung fehlgeschlagen:", e, file=sys.stderr)
    if CONF.get("https") and os.path.isfile(cert) and os.path.isfile(key) and not port_env:
        https_port = int(CONF.get("https_port", 8443))
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.minimum_version = ssl.TLSVersion.TLSv1_2
        ctx.load_cert_chain(cert, key)
        httpsd = FastHTTPServer((CONF["listen_host"], https_port), Handler)
        httpsd.socket = ctx.wrap_socket(httpsd.socket, server_side=True)
        httpsd.tls = True
        threading.Thread(target=httpsd.serve_forever, daemon=True).start()
        print("Blockhaus (HTTPS) läuft auf https://%s:%s" % (CONF["listen_host"], https_port), file=sys.stderr)
        redirect = FastHTTPServer((CONF["listen_host"], port), make_redirect(https_port))
        redirect.tls = False
        print("http://…:%s leitet auf HTTPS um" % port, file=sys.stderr)
        redirect.serve_forever()
    httpd = FastHTTPServer((CONF["listen_host"], port), Handler)
    httpd.tls = False
    print("Blockhaus läuft auf http://%s:%s" % (CONF["listen_host"], port), file=sys.stderr)
    httpd.serve_forever()


TLS_DIR = os.path.join(DATA, "tls")


def _openssl(*args):
    r = subprocess.run(["openssl"] + list(args), capture_output=True, text=True, timeout=60)
    if r.returncode != 0:
        raise RuntimeError("openssl: " + r.stderr.strip()[-300:])
    return r.stdout


def ensure_tls():
    """Eigene, auf das Heimnetz beschränkte Zertifizierungsstelle + Server-Zertifikat (≤ 825 Tage, macOS-konform).
    Erneuert das Server-Zertifikat automatisch, wenn es in weniger als 30 Tagen abläuft."""
    os.makedirs(TLS_DIR, exist_ok=True)
    os.chmod(TLS_DIR, 0o700)
    ca_key, ca_crt = os.path.join(TLS_DIR, "ca.key"), os.path.join(TLS_DIR, "ca.pem")
    key, crt = os.path.join(TLS_DIR, "key.pem"), os.path.join(TLS_DIR, "cert.pem")
    ip = CONF.get("lan_ip") or osutil.lan_ip()
    net = CONF.get("lan_net") or (".".join(ip.split(".")[:3]) + ".0/255.255.255.0")
    if not (os.path.isfile(ca_key) and os.path.isfile(ca_crt)):
        _openssl("req", "-x509", "-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:prime256v1", "-nodes", "-days", "3650",
                 "-keyout", ca_key, "-out", ca_crt, "-subj", "/CN=Blockhaus Heimnetz-CA/O=Minecraft-Server",
                 "-addext", "basicConstraints=critical,CA:TRUE,pathlen:0",
                 "-addext", "keyUsage=critical,keyCertSign,cRLSign",
                 "-addext", "nameConstraints=critical,permitted;IP:%s,permitted;IP:127.0.0.1/255.255.255.255,"
                            "permitted;DNS:minecraft,permitted;DNS:localhost" % net)
        os.chmod(ca_key, 0o600)
        _unlink(crt)  # altes selbstsigniertes Zertifikat ersetzen
    renew = not os.path.isfile(crt)
    if not renew:
        try:
            _openssl("x509", "-in", crt, "-noout", "-checkend", str(30 * 86400))
            issuer = _openssl("x509", "-in", crt, "-noout", "-issuer")
            renew = not re.search(r"(Werkbank|Blockhaus) Heimnetz-CA", issuer)
        except RuntimeError:
            renew = True
    if renew:
        csr, ext = os.path.join(TLS_DIR, "server.csr"), os.path.join(TLS_DIR, "server.ext")
        _openssl("req", "-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:prime256v1", "-nodes", "-keyout", key,
                 "-out", csr, "-subj", "/CN=%s" % ip)
        with open(ext, "w") as f:
            f.write("basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\n"
                    "extendedKeyUsage=serverAuth\nsubjectAltName=IP:%s,IP:127.0.0.1,DNS:minecraft,DNS:localhost\n" % ip)
        _openssl("x509", "-req", "-in", csr, "-CA", ca_crt, "-CAkey", ca_key, "-CAcreateserial", "-days", "800",
                 "-sha256", "-extfile", ext, "-out", crt)
        os.chmod(key, 0o600)
        _unlink(csr)
        print("TLS-Zertifikat neu ausgestellt", file=sys.stderr)


class FastHTTPServer(ThreadingHTTPServer):
    """Wie ThreadingHTTPServer, aber ohne getfqdn() beim Start – das hängt auf manchen Macs bis zu 30 s."""
    daemon_threads = True

    def server_bind(self):
        socketserver.TCPServer.server_bind(self)
        host, port = self.server_address[:2]
        self.server_name, self.server_port = str(host), port


def make_redirect(https_port):
    class Redirect(BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def do_GET(self):
            if self.path in ("/blockhaus-ca.crt", "/werkbank-ca.crt"):  # CA auch über http abrufbar (vor dem Vertrauen)
                try:
                    with open(os.path.join(DATA, "tls", "ca.pem"), "rb") as f:
                        body = f.read()
                    self.send_response(200)
                    self.send_header("Content-Type", "application/x-x509-ca-cert")
                    self.send_header("Content-Disposition", 'attachment; filename="Blockhaus-Heimnetz-CA.crt"')
                    self.send_header("Content-Length", str(len(body)))
                    self.end_headers()
                    self.wfile.write(body)
                    return
                except OSError:
                    pass
            host = (self.headers.get("Host") or "").split(":")[0]
            if not re.fullmatch(r"[A-Za-z0-9.\-]{1,100}", host):
                host = "localhost"
            self.send_response(301)
            self.send_header("Location", "https://%s:%d%s" % (host, https_port, self.path))
            self.send_header("Content-Length", "0")
            self.end_headers()

        do_HEAD = do_POST = do_PUT = do_GET
    return Redirect


if __name__ == "__main__":
    main()

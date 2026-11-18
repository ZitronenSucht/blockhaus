"""Betriebssystem-spezifische Teile von Blockhaus: Datenordner, Messwerte, Prozesssteuerung, Archive.

Nur Python-Standardbibliothek. Linux, macOS und Windows.
"""
import ctypes
import getpass
import json
import os
import platform
import shutil
import signal
import subprocess
import sys
import tarfile
import tempfile
import threading
import time

IS_WIN = sys.platform.startswith("win")
IS_MAC = sys.platform == "darwin"
IS_LINUX = sys.platform.startswith("linux")


# ───────────────────────── Ordner ─────────────────────────

def app_data_dir():
    """Wo Blockhaus seine Daten ablegt (überschreibbar mit BLOCKHAUS_DATA)."""
    env = os.environ.get("BLOCKHAUS_DATA")
    if env:
        return os.path.abspath(os.path.expanduser(env))
    if IS_WIN:
        base = os.environ.get("APPDATA") or os.path.expanduser("~\\AppData\\Roaming")
        return os.path.join(base, "Blockhaus")
    if IS_MAC:
        return os.path.expanduser("~/Library/Application Support/Blockhaus")
    base = os.environ.get("XDG_DATA_HOME") or os.path.expanduser("~/.local/share")
    return os.path.join(base, "blockhaus")


def resource_dir(module_file):
    """Ordner mit static/ – auch im gepackten Programm (PyInstaller)."""
    return getattr(sys, "_MEIPASS", None) and os.path.join(sys._MEIPASS, "blockhaus") or \
        os.path.dirname(os.path.abspath(module_file))


def local_timezone():
    """IANA-Zeitzone des Systems (z. B. Europe/Berlin) oder None."""
    tz = os.environ.get("TZ", "").lstrip(":")
    if "/" in tz:
        return tz
    try:
        with open("/etc/timezone", encoding="utf-8") as f:
            v = f.read().strip()
            if v:
                return v
    except OSError:
        pass
    try:
        link = os.path.realpath("/etc/localtime")
        if "zoneinfo/" in link:
            return link.split("zoneinfo/", 1)[1]
    except OSError:
        pass
    if IS_WIN:
        names = {"W. Europe Standard Time": "Europe/Berlin", "Central Europe Standard Time": "Europe/Budapest",
                 "Romance Standard Time": "Europe/Paris", "GMT Standard Time": "Europe/London",
                 "Eastern Standard Time": "America/New_York", "Pacific Standard Time": "America/Los_Angeles",
                 "Central Standard Time": "America/Chicago", "Mountain Standard Time": "America/Denver"}
        try:
            r = subprocess.run(["tzutil", "/g"], capture_output=True, text=True, timeout=5, **_no_window())
            return names.get(r.stdout.strip())
        except (OSError, subprocess.TimeoutExpired):
            pass
    return None


def lan_ip():
    """IP-Adresse im lokalen Netz (ohne Pakete zu senden)."""
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("192.0.2.1", 9))  # TEST-NET, es wird nichts verschickt
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


def _no_window():
    """Unter Windows kein Konsolenfenster für Hilfsprogramme öffnen."""
    return {"creationflags": 0x08000000} if IS_WIN else {}


# ───────────────────────── Messwerte ─────────────────────────

class _FILETIME(ctypes.Structure):
    _fields_ = [("lo", ctypes.c_uint32), ("hi", ctypes.c_uint32)]


def _ft(ft):
    return (ft.hi << 32 | ft.lo) / 1e7  # 100-ns-Schritte → Sekunden


class Metrics:
    """CPU (System und Prozess, in % aller Kerne), Arbeitsspeicher, Last."""

    def __init__(self):
        self.ncpu = os.cpu_count() or 1
        self.prev_sys = None
        self.prev_proc = None
        self.clk = os.sysconf("SC_CLK_TCK") if hasattr(os, "sysconf") else 100

    # System-CPU in Prozent
    def sys_cpu(self):
        try:
            if IS_LINUX:
                with open("/proc/stat") as f:
                    vals = list(map(int, f.readline().split()[1:]))
                idle, total = vals[3] + vals[4], sum(vals)
            elif IS_WIN:
                i, k, u = _FILETIME(), _FILETIME(), _FILETIME()
                if not ctypes.windll.kernel32.GetSystemTimes(ctypes.byref(i), ctypes.byref(k), ctypes.byref(u)):
                    return None
                idle, total = _ft(i), _ft(k) + _ft(u)  # Kernel-Zeit enthält die Leerlaufzeit
            else:  # macOS: Summe aller Prozesse laut ps
                out = subprocess.run(["ps", "-A", "-o", "%cpu="], capture_output=True, text=True, timeout=10).stdout
                return min(100.0, sum(float(x.replace(",", ".")) for x in out.split()) / self.ncpu)
        except (OSError, ValueError, AttributeError, subprocess.TimeoutExpired):
            return None
        pct = None
        if self.prev_sys:
            dt = total - self.prev_sys[1]
            pct = 100.0 * (1 - (idle - self.prev_sys[0]) / dt) if dt else 0.0
        self.prev_sys = (idle, total)
        return pct

    def memory(self):
        """(gesamt, verfügbar) in Bytes."""
        try:
            if IS_LINUX:
                mem = {}
                with open("/proc/meminfo") as f:
                    for line in f:
                        k, v = line.split(":", 1)
                        mem[k] = int(v.split()[0]) * 1024
                return mem.get("MemTotal"), mem.get("MemAvailable")
            if IS_WIN:
                class MS(ctypes.Structure):
                    _fields_ = [("len", ctypes.c_uint32), ("load", ctypes.c_uint32), ("total", ctypes.c_uint64),
                                ("avail", ctypes.c_uint64), ("tpf", ctypes.c_uint64), ("apf", ctypes.c_uint64),
                                ("tv", ctypes.c_uint64), ("av", ctypes.c_uint64), ("aev", ctypes.c_uint64)]
                m = MS()
                m.len = ctypes.sizeof(MS)
                ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(m))
                return m.total, m.avail
            total = int(subprocess.run(["sysctl", "-n", "hw.memsize"], capture_output=True, text=True,
                                       timeout=5).stdout.strip())
            vm = subprocess.run(["vm_stat"], capture_output=True, text=True, timeout=5).stdout
            page = 4096
            pages = {}
            for line in vm.splitlines():
                if "page size of" in line:
                    page = int(line.split("page size of")[1].split()[0])
                elif ":" in line:
                    k, v = line.split(":", 1)
                    try:
                        pages[k.strip()] = int(v.strip().rstrip("."))
                    except ValueError:
                        pass
            avail = sum(pages.get(k, 0) for k in ("Pages free", "Pages inactive", "Pages speculative",
                                                  "Pages purgeable")) * page
            return total, avail
        except (OSError, ValueError, AttributeError, subprocess.TimeoutExpired):
            return None, None

    def proc(self, pid):
        """(CPU in % aller Kerne, RSS in Bytes) eines Prozesses."""
        if not pid:
            self.prev_proc = None
            return None, None
        try:
            if IS_LINUX:
                with open("/proc/%d/stat" % pid) as f:
                    fields = f.read().rsplit(")", 1)[1].split()
                secs = (int(fields[11]) + int(fields[12])) / self.clk
                rss = None
                with open("/proc/%d/status" % pid) as f:
                    for line in f:
                        if line.startswith("VmRSS:"):
                            rss = int(line.split()[1]) * 1024
            elif IS_WIN:
                k32 = ctypes.windll.kernel32
                h = k32.OpenProcess(0x1000 | 0x0400 | 0x0010, False, pid)  # QUERY_LIMITED | QUERY | VM_READ
                if not h:
                    raise OSError("OpenProcess")
                try:
                    c, e, k, u = _FILETIME(), _FILETIME(), _FILETIME(), _FILETIME()
                    k32.GetProcessTimes(h, ctypes.byref(c), ctypes.byref(e), ctypes.byref(k), ctypes.byref(u))
                    secs = _ft(k) + _ft(u)

                    class PMC(ctypes.Structure):
                        _fields_ = [("cb", ctypes.c_uint32), ("pfc", ctypes.c_uint32)] + \
                                   [(n, ctypes.c_size_t) for n in ("peak_ws", "ws", "qppp", "qpp", "qpnpp", "qnpp",
                                                                   "pfu", "ppfu")]
                    pmc = PMC()
                    pmc.cb = ctypes.sizeof(PMC)
                    ctypes.windll.psapi.GetProcessMemoryInfo(h, ctypes.byref(pmc), pmc.cb)
                    rss = pmc.ws
                finally:
                    k32.CloseHandle(h)
            else:
                out = subprocess.run(["ps", "-o", "time=,rss=", "-p", str(pid)], capture_output=True, text=True,
                                     timeout=5).stdout.split()
                if len(out) < 2:
                    raise OSError("ps")
                secs = _ps_time(out[0])
                rss = int(out[1]) * 1024
        except (OSError, IndexError, ValueError, AttributeError, subprocess.TimeoutExpired):
            self.prev_proc = None
            return None, None
        t = time.monotonic()
        pct = None
        if self.prev_proc and self.prev_proc[0] == pid:
            dt = t - self.prev_proc[2]
            pct = 100.0 * (secs - self.prev_proc[1]) / dt / self.ncpu if dt > 0 else 0.0
        self.prev_proc = (pid, secs, t)
        return pct, rss

    @staticmethod
    def load():
        try:
            return os.getloadavg()[0]
        except (OSError, AttributeError):
            return None


def _ps_time(s):
    """ps-Zeitangabe [[dd-]hh:]mm:ss[.cc] → Sekunden."""
    days = 0
    if "-" in s:
        d, s = s.split("-", 1)
        days = int(d)
    parts = [float(x) for x in s.replace(",", ".").split(":")]
    secs = 0.0
    for p in parts:
        secs = secs * 60 + p
    return days * 86400 + secs


def hsperf_path(pid):
    """Datei mit den JVM-Leistungszählern (wie jstat) – Pfad je nach System."""
    if IS_LINUX:
        import pwd
        try:
            user = pwd.getpwuid(os.stat("/proc/%d" % pid).st_uid).pw_name
        except (OSError, KeyError):
            user = getpass.getuser()
        return "/tmp/hsperfdata_%s/%d" % (user, pid)
    return os.path.join(tempfile.gettempdir(), "hsperfdata_%s" % getpass.getuser(), str(pid))


def boot_time():
    try:
        if IS_LINUX:
            with open("/proc/stat") as f:
                for line in f:
                    if line.startswith("btime"):
                        return int(line.split()[1])
        elif IS_WIN:
            ctypes.windll.kernel32.GetTickCount64.restype = ctypes.c_uint64
            return time.time() - ctypes.windll.kernel32.GetTickCount64() / 1000
        else:
            out = subprocess.run(["sysctl", "-n", "kern.boottime"], capture_output=True, text=True, timeout=5).stdout
            return int(out.split("sec =")[1].split(",")[0])
    except (OSError, ValueError, IndexError, AttributeError, subprocess.TimeoutExpired):
        pass
    return 0


def pid_alive(pid):
    if not pid:
        return False
    if IS_WIN:
        k32 = ctypes.windll.kernel32
        h = k32.OpenProcess(0x1000, False, pid)
        if not h:
            return False
        code = ctypes.c_uint32()
        k32.GetExitCodeProcess(h, ctypes.byref(code))
        k32.CloseHandle(h)
        return code.value == 259  # STILL_ACTIVE
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    if IS_LINUX:  # Zombies zählen nicht
        try:
            with open("/proc/%d/stat" % pid) as f:
                return f.read().rsplit(")", 1)[1].split()[0] != "Z"
        except OSError:
            return False
    return True


def kill_pid(pid, hard=False):
    if IS_WIN:
        k32 = ctypes.windll.kernel32
        h = k32.OpenProcess(0x0001, False, pid)  # PROCESS_TERMINATE
        if h:
            k32.TerminateProcess(h, 1)
            k32.CloseHandle(h)
        return
    try:
        os.kill(pid, signal.SIGKILL if hard else signal.SIGTERM)
    except ProcessLookupError:
        pass


# ───────────────────────── Minecraft-Prozess ─────────────────────────

class ServerProcess:
    """Startet und überwacht den Minecraft-Server als eigenen Prozess (statt systemd).

    info() liefert dieselben Felder wie „systemctl show“ (ActiveState, SubState, MainPID,
    ActiveEnterTimestampMonotonic), damit der Rest des Panels nichts davon merkt.
    Der Prozess läuft in einer eigenen Sitzung weiter, wenn Blockhaus neu startet (z. B. nach einem
    Update), und wird beim nächsten Start über die PID-Datei wieder übernommen."""

    def __init__(self, server_dir, state_dir, build_cmd, send_stop=None, on_event=None, auto_restart=lambda: True):
        self.server_dir = server_dir
        self.pid_file = os.path.join(state_dir, "server.pid")
        self.console_log = os.path.join(state_dir, "server-console.log")
        self.build_cmd = build_cmd        # () -> (argv, env) – darf Java herunterladen (dauert)
        self.send_stop = send_stop        # () -> bool – „stop“ über RCON, wenn kein stdin vorhanden
        self.on_event = on_event or (lambda kind, msg: None)
        self.auto_restart = auto_restart
        self.lock = threading.RLock()
        self.proc = None
        self.pid = 0
        self.state = "inactive"
        self.started_mono = 0
        self.stopping = False
        self.crashes = []
        self.exit_code = None
        self._adopt()
        threading.Thread(target=self._watch, daemon=True, name="server-watch").start()

    # ── Zustand ──
    def info(self):
        with self.lock:
            return {"ActiveState": self.state,
                    "SubState": {"active": "running", "activating": "start", "deactivating": "stop-sigterm",
                                 "failed": "failed"}.get(self.state, "dead"),
                    "MainPID": str(self.pid or 0),
                    "ActiveEnterTimestampMonotonic": str(int(self.started_mono * 1e6)) if self.pid else "0",
                    "UnitFileState": "process", "ExitCode": self.exit_code}

    def _save_pid(self):
        try:
            with open(self.pid_file, "w") as f:
                json.dump({"pid": self.pid, "t": time.time(), "dir": self.server_dir}, f)
        except OSError:
            pass

    def _adopt(self):
        try:
            with open(self.pid_file) as f:
                d = json.load(f)
        except (OSError, ValueError):
            return
        pid = int(d.get("pid") or 0)
        if pid and d.get("dir") == self.server_dir and d.get("t", 0) > boot_time() and pid_alive(pid):
            self.pid, self.state = pid, "active"
            self.started_mono = time.monotonic() - max(0, time.time() - d.get("t", time.time()))
            self.on_event("sys", "Laufenden Minecraft-Server übernommen (PID %d)" % pid)
        else:
            _rm(self.pid_file)

    # ── Aktionen ──
    def start(self):
        with self.lock:
            if self.pid and pid_alive(self.pid):
                return
            self.state, self.exit_code = "activating", None
        try:
            argv, env = self.build_cmd()
            os.makedirs(os.path.dirname(self.console_log), exist_ok=True)
            out = open(self.console_log, "ab")
            out.write(("\n──── Start %s ────\n%s\n" % (time.strftime("%Y-%m-%d %H:%M:%S"), " ".join(argv))).encode())
            out.flush()
            kw = {"creationflags": 0x00000200 | 0x08000000} if IS_WIN else {"start_new_session": True}
            proc = subprocess.Popen(argv, cwd=self.server_dir, stdin=subprocess.PIPE, stdout=out,
                                    stderr=subprocess.STDOUT, env=env, **kw)
            out.close()
        except Exception:
            with self.lock:
                self.state = "failed"
            raise
        with self.lock:
            self.proc, self.pid = proc, proc.pid
            self.state, self.started_mono, self.stopping = "active", time.monotonic(), False
            self._save_pid()

    def command(self, line):
        """Befehl direkt in die Server-Konsole schreiben (nur wenn Blockhaus den Server gestartet hat)."""
        with self.lock:
            p = self.proc
        if not p or not p.stdin or p.poll() is not None:
            return False
        try:
            p.stdin.write((line.strip() + "\n").encode())
            p.stdin.flush()
            return True
        except OSError:
            return False

    def stop(self, timeout=90):
        with self.lock:
            if not self.pid:
                self.state = "inactive" if self.state != "failed" else self.state
                return
            self.stopping = True
            self.state = "deactivating"
            pid = self.pid
        if not self.command("stop"):
            if not (self.send_stop and self.send_stop()):
                kill_pid(pid)  # SIGTERM: Minecraft speichert und beendet sich sauber
        end = time.monotonic() + timeout
        while time.monotonic() < end and pid_alive(pid):
            time.sleep(0.5)
        if pid_alive(pid):
            self.on_event("err", "Server reagiert nicht – wird hart beendet")
            kill_pid(pid, hard=True)
            time.sleep(1)
        self._exited(0)

    def restart(self):
        self.stop()
        self.start()

    def kill(self):
        with self.lock:
            pid, self.stopping = self.pid, True
        if pid:
            kill_pid(pid, hard=True)
            time.sleep(0.5)
        self._exited(-9)

    def _exited(self, code):
        with self.lock:
            if self.proc:
                try:
                    code = self.proc.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    pass
            was_stopping = self.stopping
            if self.proc and self.proc.stdin:
                try:
                    self.proc.stdin.close()
                except OSError:
                    pass
            self.proc, self.pid, self.exit_code = None, 0, code
            self.state = "inactive" if was_stopping or code in (0, 130, 143, -2, -15) else "failed"
            _rm(self.pid_file)
            return was_stopping

    # ── Überwachung (wie Restart=on-failure) ──
    def _watch(self):
        while True:
            time.sleep(1)
            with self.lock:
                pid, proc, stopping = self.pid, self.proc, self.stopping
            if not pid or stopping:
                continue
            gone = (proc.poll() is not None) if proc else not pid_alive(pid)
            if not gone:
                continue
            code = proc.returncode if proc else None
            self._exited(code if code is not None else 1)
            if self.state != "failed":
                self.on_event("sys", "Minecraft-Server wurde beendet")
                continue
            self.on_event("err", "Minecraft-Server ist abgestürzt (Exit-Code %s)" % code)
            out = tail(self.console_log, 40)
            starts = [i for i, l in enumerate(out) if l.startswith("──── Start ")]
            if starts:  # nur die Ausgabe des letzten Laufs, ohne die Startzeile
                out = out[starts[-1] + 2:]
            for line in out[-15:]:
                self.on_event("err", line)
            nowm = time.monotonic()
            self.crashes = [t for t in self.crashes if nowm - t < 600] + [nowm]
            if self.auto_restart() and len(self.crashes) <= 3:
                self.on_event("sys", "Automatischer Neustart in 10 Sekunden …")
                time.sleep(10)
                with self.lock:
                    if self.pid or self.state != "failed":
                        continue
                try:
                    self.start()
                except Exception as e:
                    self.on_event("err", "Neustart fehlgeschlagen: %s" % e)
            elif len(self.crashes) > 3:
                self.on_event("err", "Mehr als 3 Abstürze in 10 Minuten – kein automatischer Neustart mehr")


def tail(path, n):
    try:
        with open(path, "rb") as f:
            f.seek(0, 2)
            f.seek(max(0, f.tell() - 8192))
            lines = f.read().decode("utf-8", "replace").splitlines()
        return [l for l in lines if l.strip()][-n:]
    except OSError:
        return []


def _rm(p):
    try:
        os.remove(p)
    except OSError:
        pass


# ───────────────────────── Archive (statt tar-Programm) ─────────────────────────

def tar_create(dest, root, names, exclude=("session.lock",), level=6):
    """tar.gz aus root/names. Dateien, die währenddessen verschwinden oder sich ändern, werden übersprungen.
    Gibt die Anzahl übersprungener Dateien zurück."""
    skipped = 0
    base = os.path.realpath(root)

    def unsafe_link(p):  # Symlinks, die aus dem Ordner herauszeigen, nicht mitsichern
        if not os.path.islink(p):
            return False
        target = os.path.realpath(p)
        return not (target == base or target.startswith(base + os.sep))

    with tarfile.open(dest, "w:gz", compresslevel=level) as t:
        for name in names:
            top = os.path.join(root, name)
            if not os.path.lexists(top):
                continue
            if os.path.isdir(top) and not os.path.islink(top):
                for d, dirs, files in os.walk(top):
                    dirs.sort()
                    rel = os.path.relpath(d, root)
                    try:
                        t.add(d, arcname=rel, recursive=False)
                    except OSError:
                        skipped += 1
                    for fn in sorted(files):
                        if fn in exclude or unsafe_link(os.path.join(d, fn)):
                            skipped += fn not in exclude
                            continue
                        try:
                            t.add(os.path.join(d, fn), arcname=os.path.join(rel, fn), recursive=False)
                        except OSError:
                            skipped += 1
            else:
                try:
                    t.add(top, arcname=name, recursive=False)
                except OSError:
                    skipped += 1
    return skipped


def tar_extract(src, dest, members=None):
    """Entpackt sicher (keine absoluten Pfade, kein „..“, keine Geräte, keine Links nach außen).
    Unsichere Einträge werden übersprungen. members: nur diese Pfade (fehlende = ok).
    Gibt die Anzahl übersprungener Einträge zurück."""
    skipped = []

    def safe(member, path):
        try:
            return tarfile.data_filter(member, path)
        except tarfile.FilterError:
            skipped.append(member.name)
            return None

    with tarfile.open(src, "r:*") as t:
        sel = None
        if members is not None:
            want = set(members)
            sel = [m for m in t.getmembers() if m.name in want]
        if hasattr(tarfile, "data_filter"):
            t.extractall(dest, members=sel, filter=safe)
        else:  # sehr altes Python ohne Filter: selbst prüfen
            base = os.path.realpath(dest)
            ok = []
            for m in (sel if sel is not None else t.getmembers()):
                target = os.path.realpath(os.path.join(dest, m.name))
                if (m.isfile() or m.isdir()) and (target == base or target.startswith(base + os.sep)):
                    ok.append(m)
            skipped += [m.name for m in (sel if sel is not None else t.getmembers()) if m not in ok]
            t.extractall(dest, members=ok)
    return len(skipped)


def tar_names(src):
    with tarfile.open(src, "r:*") as t:
        return t.getnames()


# ───────────────────────── Java ─────────────────────────

def java_platform():
    """(os, architecture) im Format der Adoptium-API."""
    os_name = "windows" if IS_WIN else "mac" if IS_MAC else "linux"
    m = platform.machine().lower()
    arch = {"x86_64": "x64", "amd64": "x64", "aarch64": "aarch64", "arm64": "aarch64"}.get(m, m)
    return os_name, arch


def java_exe(home):
    """Pfad zur java-Datei in einem entpackten JRE-Ordner."""
    exe = "java.exe" if IS_WIN else "java"
    for cand in (os.path.join(home, "bin", exe), os.path.join(home, "Contents", "Home", "bin", exe)):
        if os.path.isfile(cand):
            return cand
    return None


def java_version(java):
    try:
        r = subprocess.run([java, "-version"], capture_output=True, text=True, timeout=30, **_no_window())
        import re
        m = re.search(r'version "(?:1\.)?(\d+)', r.stderr + r.stdout)
        return int(m.group(1)) if m else None
    except (OSError, subprocess.TimeoutExpired):
        return None


def extract_archive(path, dest):
    """JRE-Archiv (.tar.gz oder .zip) in dest entpacken; liefert den Ordner mit bin/java."""
    os.makedirs(dest, exist_ok=True)
    if path.endswith(".zip"):
        import zipfile
        with zipfile.ZipFile(path) as z:
            base = os.path.realpath(dest)
            for n in z.namelist():
                target = os.path.realpath(os.path.join(dest, n))
                if not (target == base or target.startswith(base + os.sep)):
                    raise RuntimeError("Unsicherer Pfad im Archiv: %s" % n)
            z.extractall(dest)
    else:
        tar_extract(path, dest)
    for n in os.listdir(dest):
        home = os.path.join(dest, n)
        if os.path.isdir(home) and java_exe(home):
            return home
    if java_exe(dest):
        return dest
    raise RuntimeError("Im Java-Archiv wurde kein bin/java gefunden")


def disk_usage(path):
    return shutil.disk_usage(path)

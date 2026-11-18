"""Plattform-Tests für Blockhaus (laufen in GitHub Actions unter Linux, macOS und Windows).

Nur Standardbibliothek:  python -m unittest discover -s tests -v
"""
import http.cookiejar
import json
import os
import socket
import subprocess
import sys
import tarfile
import tempfile
import textwrap
import time
import unittest
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
DATA = tempfile.mkdtemp(prefix="blockhaus-test-")
os.environ["BLOCKHAUS_DATA"] = DATA

from blockhaus import osutil  # noqa: E402

FAKE_SERVER = textwrap.dedent('''
    import sys, time, os
    os.makedirs("logs", exist_ok=True)
    log = open("logs/latest.log", "a", buffering=1)
    def L(m): log.write("[%s] [Server thread/INFO]: %s\\n" % (time.strftime("%H:%M:%S"), m))
    L("Done (0.1s)! For help, type \\"help\\"")
    for line in sys.stdin:
        c = line.strip()
        L("console: " + c)
        if c == "stop":
            L("Stopping server"); sys.exit(0)
        if c == "crash":
            print("boom", flush=True); sys.exit(1)
    time.sleep(3600)
''')


def wait(cond, timeout=20):
    end = time.time() + timeout
    while time.time() < end:
        if cond():
            return True
        time.sleep(0.2)
    return False


class TestOsutil(unittest.TestCase):
    def test_data_dir_and_platform(self):
        self.assertEqual(osutil.app_data_dir(), os.path.abspath(DATA))
        os_name, arch = osutil.java_platform()
        self.assertIn(os_name, ("linux", "mac", "windows"))
        self.assertTrue(arch)
        self.assertTrue(osutil.lan_ip())

    def test_metrics(self):
        m = osutil.Metrics()
        total, avail = m.memory()
        self.assertGreater(total, 256 * 1024 ** 2)
        self.assertGreater(avail, 0)
        self.assertLessEqual(avail, total)
        m.sys_cpu()
        time.sleep(0.5)
        cpu = m.sys_cpu()
        self.assertIsNotNone(cpu)
        self.assertGreaterEqual(cpu, 0)
        pct, rss = m.proc(os.getpid())
        self.assertGreater(rss, 1024 * 1024)
        sum(i * i for i in range(300000))
        pct, rss = m.proc(os.getpid())
        self.assertIsNotNone(pct)
        self.assertTrue(osutil.pid_alive(os.getpid()))
        self.assertFalse(osutil.pid_alive(4999999))
        self.assertGreater(osutil.boot_time(), 0)

    def test_tar_roundtrip_and_safety(self):
        src = tempfile.mkdtemp()
        os.makedirs(os.path.join(src, "world", "region"))
        with open(os.path.join(src, "world", "level.dat"), "w") as f:
            f.write("v1")
        with open(os.path.join(src, "world", "session.lock"), "w") as f:
            f.write("x")
        with open(os.path.join(src, "world", "region", "r.0.0.mca"), "w") as f:
            f.write("region")
        arc = os.path.join(tempfile.mkdtemp(), "b.tar.gz")
        osutil.tar_create(arc, src, ["world"])
        names = osutil.tar_names(arc)
        self.assertIn("world/level.dat", names)
        self.assertFalse(any(n.endswith("session.lock") for n in names))
        out = tempfile.mkdtemp()
        osutil.tar_extract(arc, out)
        with open(os.path.join(out, "world", "level.dat")) as f:
            self.assertEqual(f.read(), "v1")
        only = tempfile.mkdtemp()
        osutil.tar_extract(arc, only, ["world/region/r.0.0.mca", "world/missing.mca"])
        self.assertTrue(os.path.isfile(os.path.join(only, "world", "region", "r.0.0.mca")))
        self.assertFalse(os.path.exists(os.path.join(only, "world", "level.dat")))
        evil = os.path.join(tempfile.mkdtemp(), "evil.tar.gz")
        with tarfile.open(evil, "w:gz") as t:
            import io
            ti = tarfile.TarInfo("../escaped.txt")
            ti.size = 1
            t.addfile(ti, io.BytesIO(b"x"))
        target = tempfile.mkdtemp()
        skipped = osutil.tar_extract(evil, target)
        self.assertEqual(skipped, 1)
        self.assertFalse(os.path.exists(os.path.join(os.path.dirname(target), "escaped.txt")))

    def test_server_process(self):
        sdir = tempfile.mkdtemp()
        state = tempfile.mkdtemp()
        script = os.path.join(sdir, "fake.py")
        with open(script, "w") as f:
            f.write(FAKE_SERVER)
        events = []
        p = osutil.ServerProcess(sdir, state, lambda: ([sys.executable, script], dict(os.environ)),
                                 on_event=lambda k, m: events.append((k, m)), auto_restart=lambda: True)
        log = os.path.join(sdir, "logs", "latest.log")
        read = lambda: open(log).read() if os.path.exists(log) else ""
        p.start()
        self.assertEqual(p.info()["ActiveState"], "active")
        self.assertTrue(wait(lambda: "Done" in read()))
        self.assertTrue(p.command("say hi"))
        self.assertTrue(wait(lambda: "console: say hi" in read()))
        p.stop(timeout=20)
        self.assertEqual(p.info()["ActiveState"], "inactive")
        self.assertIn("Stopping server", read())
        # Absturz → automatischer Neustart nach ~10 s
        p.start()
        self.assertTrue(wait(lambda: read().count("Done") >= 2))
        first = p.pid
        p.command("crash")
        self.assertTrue(wait(lambda: p.info()["ActiveState"] == "failed", 10))
        self.assertTrue(wait(lambda: p.info()["ActiveState"] == "active" and p.pid and p.pid != first, 25))
        self.assertTrue(any("abgestürzt" in m for _, m in events))
        # Übernahme durch eine neue Instanz (Panel-Neustart)
        p2 = osutil.ServerProcess(sdir, state, lambda: ([sys.executable, script], dict(os.environ)))
        self.assertEqual(p2.info()["ActiveState"], "active")
        self.assertEqual(p2.info()["MainPID"], str(p.pid))
        pid = p.pid
        p.kill()
        self.assertEqual(p.info()["ActiveState"], "inactive")
        self.assertTrue(wait(lambda: not osutil.pid_alive(pid), 10))

    def test_java_download(self):
        """Lädt ein echtes Java (Eclipse Temurin) – prüft die Archiv-Struktur je Betriebssystem."""
        if os.environ.get("BLOCKHAUS_SKIP_NET"):
            self.skipTest("ohne Netz")
        from blockhaus import app
        exe = app.install_java(21, step=lambda m: None)
        self.assertTrue(os.path.isfile(exe))
        self.assertEqual(osutil.java_version(exe), 21)
        self.assertEqual(app.java_target(16), 17)
        self.assertIn(21, app.managed_javas())


class TestI18n(unittest.TestCase):
    def test_backend_messages(self):
        from blockhaus import app
        self.assertEqual(app.tr_msg("Ungültige Version", "en"), "Invalid version")
        self.assertEqual(app.tr_msg("Ungültige Version", "de"), "Ungültige Version")
        self.assertEqual(app.tr_msg("Port 25570 ist schon belegt – bitte einen anderen wählen", "en"),
                         "Port 25570 is already in use – please choose another one")
        self.assertEqual(app.tr_msg("Update: sichere die Welt …", "en"), "Update: backing up the world …")
        self.assertEqual(app.tr_msg("Einrichtung: Bereite den Server-Ordner vor …", "en"),
                         "Setup: Preparing the server folder …")
        self.assertEqual(app.tr_msg("Etwas ganz anderes", "en"), "Etwas ganz anderes")


class TestUpdater(unittest.TestCase):
    def test_apply_update_and_rollback_files(self):
        import hashlib
        import pathlib
        from blockhaus import system
        out = subprocess.run([sys.executable, os.path.join(ROOT, "packaging", "build.py"), "app"],
                             capture_output=True, text=True, cwd=ROOT)
        self.assertEqual(out.returncode, 0, out.stderr)
        ver = __import__("re").search(r"blockhaus-app-(.+)\.zip", out.stdout).group(1)
        zipf = os.path.join(ROOT, "dist", "blockhaus-app-%s.zip" % ver)
        rel_dir = tempfile.mkdtemp()
        target = "9.9.9"
        app_name = system.APP_ASSET % target
        data = open(zipf, "rb").read()
        open(os.path.join(rel_dir, app_name), "wb").write(data)
        open(os.path.join(rel_dir, "SHA256SUMS"), "w").write("%s  %s\n" % (hashlib.sha256(data).hexdigest(), app_name))
        home = tempfile.mkdtemp()
        os.makedirs(os.path.join(home, "app", "0.0.1", "blockhaus"))
        open(os.path.join(home, "app", "current"), "w").write("0.0.1")
        rel = {"version": target, "app": pathlib.Path(rel_dir, app_name).as_uri(),
               "sums": pathlib.Path(rel_dir, "SHA256SUMS").as_uri()}
        old = os.environ.get("BLOCKHAUS_HOME")
        os.environ["BLOCKHAUS_HOME"] = home
        try:
            self.assertEqual(system.apply_update(rel), target)
            self.assertEqual(system.current_app_version(), target)
            self.assertTrue(os.path.isfile(os.path.join(home, "app", target, "blockhaus", "app.py")))
            with open(os.path.join(home, "app", "previous")) as f:
                self.assertEqual(f.read(), "0.0.1")
            # manipulierte Datei wird abgelehnt
            open(os.path.join(rel_dir, app_name), "ab").write(b"x")
            with self.assertRaises(RuntimeError):
                system.apply_update(dict(rel, version=target))
        finally:
            if old is None:
                os.environ.pop("BLOCKHAUS_HOME", None)
            else:
                os.environ["BLOCKHAUS_HOME"] = old
        self.assertGreater(system.ver_tuple("0.10.0"), system.ver_tuple("0.9.3"))
        self.assertEqual(system.ver_tuple("v1.2"), (1, 2, 0))


def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


class TestHttp(unittest.TestCase):
    """Startet Blockhaus als eigenen Prozess und spielt die Einrichtung über die API durch."""

    @classmethod
    def setUpClass(cls):
        cls.data = tempfile.mkdtemp(prefix="blockhaus-http-")
        cls.port = free_port()
        env = dict(os.environ, BLOCKHAUS_DATA=cls.data, BLOCKHAUS_PORT=str(cls.port))
        cls.proc = subprocess.Popen([sys.executable, "-m", "blockhaus"], cwd=ROOT, env=env,
                                    stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        cls.base = "http://127.0.0.1:%d" % cls.port
        jar = http.cookiejar.CookieJar()
        cls.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
        cls.csrf = ""
        ok = wait(lambda: cls._ping(), 30)
        if not ok:
            cls.proc.kill()
            raise RuntimeError("Blockhaus startet nicht: " + cls.proc.stdout.read().decode(errors="replace"))

    @classmethod
    def _ping(cls):
        try:
            urllib.request.urlopen(cls.base + "/api/setup/status", timeout=2)
            return True
        except (urllib.error.URLError, OSError):
            return False

    @classmethod
    def tearDownClass(cls):
        cls.proc.terminate()
        try:
            cls.proc.wait(10)
        except subprocess.TimeoutExpired:
            cls.proc.kill()

    def call(self, path, body=None, expect=200):
        req = urllib.request.Request(self.base + path, data=None if body is None else json.dumps(body).encode(),
                                     headers={"Content-Type": "application/json", "X-CSRF": self.csrf})
        try:
            with self.opener.open(req, timeout=30) as r:
                code, data = r.status, r.read()
        except urllib.error.HTTPError as e:
            code, data = e.code, e.read()
        self.assertEqual(code, expect, data[:300])
        return json.loads(data or b"{}") if data[:1] in (b"{", b"[") else data

    def test_flow(self):
        st = self.call("/api/setup/status")
        self.assertTrue(st["needed"])
        self.assertFalse(st["needsCode"])
        self.call("/api/me", expect=401)
        self.call("/api/setup/admin", {"user": "admin", "password": "kurz"}, expect=400)
        self.call("/api/setup/admin", {"user": "admin", "password": "geheim12345", "language": "de"})
        self.call("/api/setup/admin", {"user": "x", "password": "geheim12345"}, expect=403)
        me = self.call("/api/me")
        type(self).csrf = me["csrf"]
        self.assertFalse(me["hasServer"])
        info = self.call("/api/server/create/info")
        self.assertGreater(info["system"]["ramTotalMb"], 256)
        self.assertGreaterEqual(info["system"]["ramRecommendMb"], 1024)
        self.assertEqual({l["id"] for l in info["loaders"]}, {"vanilla", "fabric", "forge", "neoforge", "paper", "purpur"})
        self.call("/api/server/create", {"mode": "new", "loader": "vanilla", "mc": "26.2"}, expect=400)  # ohne EULA
        r = self.call("/api/panel/settings", {"ram_max_mb": 1536, "storage_max_gb": 5, "autostart": True})
        self.assertEqual(r["settings"]["ram_max_mb"], 1536)
        self.assertEqual(r["settings"]["storage_max_gb"], 5.0)
        self.call("/api/panel/settings", {"ram_max_mb": 10}, expect=400)
        self.assertEqual(self.call("/api/me")["language"], "de")
        self.call("/api/me/language", {"lang": "en"})
        self.assertEqual(self.call("/api/me")["language"], "en")
        req = urllib.request.Request(self.base + "/api/server/create", data=json.dumps(
            {"mode": "new", "loader": "vanilla", "mc": "26.2"}).encode(), headers={
            "Content-Type": "application/json", "X-CSRF": self.csrf, "X-Lang": "en"})
        with self.assertRaises(urllib.error.HTTPError) as cm:
            self.opener.open(req, timeout=30)
        self.assertEqual(json.loads(cm.exception.read())["error"],
                         "A server cannot be created without accepting the Minecraft EULA")
        ob = self.call("/api/onboarding")
        self.assertEqual([x["id"] for x in ob["steps"]], ["start", "join", "op", "friends", "backup"])
        self.assertFalse(ob["tourDone"])
        self.call("/api/onboarding", {"flag": "tour"})
        self.assertTrue(self.call("/api/onboarding")["tourDone"])
        self.call("/api/onboarding", {"flag": "nope"}, expect=400)
        en = self.call("/i18n/en.json")
        self.assertEqual(en["Speichern"], "Save")
        page = self.call("/")
        self.assertIn(b"Blockhaus", page)


if __name__ == "__main__":
    unittest.main(verbosity=2)

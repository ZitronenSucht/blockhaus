"""Starter einer installierten Blockhaus-Version.

Liegt im Installationsordner (BLOCKHAUS_HOME) neben runtime/ und app/. Startet die aktive Version aus
app/current; lässt sie sich nicht laden, wird automatisch die vorherige Version (app/previous) genommen.
"""
import os
import runpy
import sys

HOME = os.path.dirname(os.path.abspath(__file__))
os.environ["BLOCKHAUS_HOME"] = HOME


def read(name):
    try:
        with open(os.path.join(HOME, "app", name), encoding="utf-8") as f:
            return f.read().strip()
    except OSError:
        return None


def try_version(ver):
    path = os.path.join(HOME, "app", ver or "")
    if not ver or not os.path.isfile(os.path.join(path, "blockhaus", "app.py")):
        return False
    sys.path.insert(0, path)
    try:
        import blockhaus.app  # noqa: F401 – Probe-Import: Syntax- und Importfehler früh erkennen
        return True
    except Exception as e:  # kaputtes Update → vorherige Version
        print("Blockhaus %s lässt sich nicht laden: %s" % (ver, e), file=sys.stderr)
        sys.path.remove(path)
        for m in [m for m in sys.modules if m == "blockhaus" or m.startswith("blockhaus.")]:
            del sys.modules[m]
        return False


if not (try_version(read("current")) or try_version(read("previous"))):
    sys.exit("Blockhaus ist beschädigt – bitte neu installieren.")
sys.argv = ["blockhaus"] + sys.argv[1:]
runpy.run_module("blockhaus", run_name="__main__", alter_sys=True)

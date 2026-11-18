"""Desktop-Fenster für Blockhaus.

Das Fenster ist nur eine Ansicht: Blockhaus selbst (und damit der Minecraft-Server) läuft als eigener
Hintergrundprozess weiter, auch wenn das Fenster geschlossen wird. Beenden geht im Panel unter
„Einstellungen → Blockhaus“.
Windows/macOS: natives Fenster über pywebview (Edge WebView2 bzw. WebKit des Systems).
Linux: App-Fenster eines Chromium-Browsers, sonst der Standardbrowser.
"""
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.request
import webbrowser

from . import system


def _url(conf):
    host = "127.0.0.1"
    return "http://%s:%d" % (host, int(os.environ.get("BLOCKHAUS_PORT") or conf.get("listen_port", 8080)))


def is_blockhaus(url, timeout=1.5):
    try:
        with urllib.request.urlopen(url + "/api/setup/status", timeout=timeout) as r:
            return "version" in json.load(r)
    except (OSError, ValueError):
        return False


def ensure_running(url):
    if is_blockhaus(url):
        return True
    system.restart_detached("--background", gui=True)
    end = time.time() + 45
    while time.time() < end:
        if is_blockhaus(url):
            return True
        time.sleep(0.4)
    return False


def open_window(url):
    try:
        import webview  # pywebview – im Installer für Windows und macOS enthalten
    except ImportError:
        webview = None
    if webview is not None:
        webview.create_window("Blockhaus", url, width=1320, height=860, min_size=(900, 600),
                              background_color="#0a0d0c", text_select=True)
        webview.start(private_mode=False, storage_path=os.path.join(os.path.expanduser("~"), ".blockhaus-webview"))
        return
    for b in ("chromium", "chromium-browser", "google-chrome", "google-chrome-stable", "microsoft-edge", "brave-browser"):
        exe = shutil.which(b)
        if exe:
            subprocess.Popen([exe, "--app=" + url, "--class=Blockhaus", "--window-size=1320,860"],
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
            return
    webbrowser.open(url)


def main(conf, browser=False):
    url = _url(conf)
    if not ensure_running(url):
        from . import osutil
        msg = "Blockhaus konnte nicht gestartet werden. Details im Log: %s" % os.path.join(
            osutil.app_data_dir(), "blockhaus.log")
        print(msg, file=sys.stderr)
        try:
            import webview
            webview.create_window("Blockhaus", html="<p style='font:16px sans-serif;padding:24px'>%s</p>" % msg)
            webview.start()
        except ImportError:
            pass
        return 1
    if browser:
        webbrowser.open(url)
    else:
        open_window(url)
    return 0

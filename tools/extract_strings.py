#!/usr/bin/env python3
"""Sammelt übersetzbare Texte aus static/app.js und den Python-Modulen.

  python3 tools/extract_strings.py            # listet fehlende Übersetzungen
  python3 tools/extract_strings.py --all      # listet alle gefundenen Texte

Frontend: Texte werden so zerlegt, wie sie später als Textknoten im Browser landen
(an HTML-Tags und an ${…}-Ausdrücken, die Markup erzeugen). Ausdrücke mitten im Text
werden zu {0}, {1} … – genau so stehen die Schlüssel im Wörterbuch.
"""
import ast
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PKG = os.path.join(ROOT, "blockhaus")

MARKUP_EXPR = re.compile(r"\bico\(|\bsvg\(|headImg\(|blkImg\(|mcube\(|motdHtml\(|gauge\(|<|\.map\(|\.join\(|LOGO|"
                         r"\bhtml\b|Html\b|\bchips?\b|\bbadge\b|\brow\(|\bst\(|\bhead\(|tabs\(|PEND\[|updBadge|cell\(")
GERMAN_HINT = re.compile(r"[äöüÄÖÜß]|\b(der|die|das|den|dem|des|ein|eine|einen|einem|und|oder|nicht|ist|sind|wird|werden|"
                         r"mit|für|von|auf|bei|nach|vor|zum|zur|im|in|an|bitte|kein|keine|alle|neu|noch|jetzt|hier|"
                         r"wurde|wurden|kann|können|muss|nur|auch|schon|wieder|Spieler|Server|Welt|Backup|fehlgeschlagen|gefunden|"
                         r"beendet|gestartet|abgestürzt|übernommen|angemeldet|Fehler|Neustart|Sekunden|lade|bereitgestellt|"
                         r"Endpunkt|Berechtigung|wiederhergestellt|Entpacken|Ungültig\w*|erstellt|gelöscht|läuft)\b")
CODEY = re.compile(r"^[\w\-.#:/\[\]=\"' >,()*+~^$|{}@!%&?;]*$")


def js_templates(src):
    """Liefert (kind, parts) für jedes String-/Template-Literal. parts: Liste aus str oder ("expr", text)."""
    out, i, n = [], 0, len(src)
    stack = []  # offene Templates: [parts, cur_text, expr_start, depth]

    def scan(i, until_brace_depth=None):
        pass
    # einfacher Zustandsautomat wie in jscheck, mit Template-Verschachtelung
    tpl = []      # Stapel offener Templates: dict(parts, buf, expr_start, brace)
    brace = 0
    last = ''
    while i < n:
        c = src[i]
        if tpl and tpl[-1]["mode"] == "text":
            t = tpl[-1]
            if c == "\\":
                t["buf"] += src[i:i + 2]
                i += 2
                continue
            if c == "`":
                t["parts"].append(t["buf"])
                out.append(("tpl", t["parts"]))
                tpl.pop()
                i += 1
                last = 'x'
                continue
            if c == "$" and src[i + 1:i + 2] == "{":
                t["parts"].append(t["buf"])
                t["buf"] = ""
                t["mode"] = "expr"
                t["expr_start"] = i + 2
                t["brace"] = brace
                brace += 1
                i += 2
                last = '('
                continue
            t["buf"] += c
            i += 1
            continue
        if src.startswith("//", i):
            j = src.find("\n", i)
            i = n if j < 0 else j
            continue
        if src.startswith("/*", i):
            i = src.find("*/", i) + 2
            continue
        if c in "\"'":
            j = i + 1
            while j < n and src[j] != c:
                if src[j] == "\\":
                    j += 1
                j += 1
            out.append(("str", [src[i + 1:j]]))
            i = j + 1
            last = 'x'
            continue
        if c == "`":
            tpl.append({"mode": "text", "parts": [], "buf": ""})
            i += 1
            continue
        if c == "{":
            brace += 1
        elif c == "}":
            brace -= 1
            if tpl and tpl[-1]["mode"] == "expr" and brace == tpl[-1]["brace"]:
                t = tpl[-1]
                t["parts"].append(("expr", src[t["expr_start"]:i]))
                t["mode"] = "text"
                i += 1
                continue
        if c == "/" and last in ('', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^', 'return', 'typeof', 'case', '=>'):
            j, cls = i + 1, False
            while j < n:
                ch = src[j]
                if ch == "\\":
                    j += 2
                    continue
                if ch == "[":
                    cls = True
                elif ch == "]":
                    cls = False
                elif ch == "/" and not cls:
                    break
                j += 1
            j += 1
            while j < n and src[j].isalpha():
                j += 1
            i = j
            last = 'x'
            continue
        if c.isalnum() or c in "_$":
            j = i
            while j < n and (src[j].isalnum() or src[j] in "_$"):
                j += 1
            w = src[i:j]
            last = w if w in ("return", "typeof", "case") else 'x'
            i = j
            continue
        if src.startswith("=>", i):
            last = '=>'
            i += 2
            continue
        if c not in " \t\r\n":
            last = c
        i += 1
    return out


def norm(s):
    return re.sub(r"\s+", " ", s).strip()


def unescape_js(s):
    return s.replace("\\'", "'").replace('\\"', '"').replace("\\`", "`").replace("\\n", "\n").replace("\\\\", "\\")


def js_fragments(src):
    frags = set()
    for kind, parts in js_templates(src):
        if kind == "str":
            pieces = [[unescape_js(parts[0])]]
        else:
            pieces, cur = [], []
            for p in parts:
                if isinstance(p, tuple):
                    if MARKUP_EXPR.search(p[1]):
                        pieces.append(cur)
                        cur = []
                    else:
                        cur.append(None)
                else:
                    cur.append(unescape_js(p))
            pieces.append(cur)
        for piece in pieces:
            # Platzhalter nummerieren, dann an HTML-Tags trennen
            k, buf = 0, ""
            for x in piece:
                if x is None:
                    buf += "\x00%d\x00" % k
                    k += 1
                else:
                    buf += x
            for frag in re.split(r"<[^>]*>|&nbsp;", buf):
                frag = html_unescape(frag)
                # Platzhalter in diesem Fragment neu ab 0 zählen
                idx = {}
                frag = re.sub(r"\x00(\d+)\x00", lambda m: "{%d}" % idx.setdefault(m.group(1), len(idx)), frag)
                f = norm(frag)
                if is_text(f):
                    frags.add(f)
                # Attribute mit Text
            for m in re.finditer(r'\b(?:placeholder|title|aria-label|data-title)="([^"]*)"', buf):
                idx = {}
                f = norm(re.sub(r"\x00(\d+)\x00", lambda mm: "{%d}" % idx.setdefault(mm.group(1), len(idx)), html_unescape(m.group(1))))
                if is_text(f):
                    frags.add(f)
    return frags


def html_unescape(s):
    return s.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"').replace("&#39;", "'")


def is_text(f):
    if not f or not re.search(r"[A-Za-zÄÖÜäöüß]{2,}", f):
        return False
    if re.fullmatch(r"\{\d+\}", f):
        return False
    if re.fullmatch(r"[a-z][\w\-]*", f):  # Bezeichner, CSS-Klassen
        return False
    if f.startswith(("#", ".", "/api", "http", "./", "image/", "application/", "data:", "M", "--")) and " " not in f:
        return False
    if "=" in f and " " not in f:
        return False
    if re.search(r"^\s*(var\(|rgba?\(|#[0-9a-f]{3})", f):
        return False
    return bool(GERMAN_HINT.search(f)) or re.fullmatch(r"[A-ZÄÖÜ][a-zäöüß]+(?:[ -][A-Za-zäöüß]+)*[.…:!?]?", f) is not None


# ── Python: Meldungen in ApiError(...), RuntimeError(...), push_log(...), step(...), set_task({"msg": ...}) ──

MSG_CALLS = {"ApiError", "RuntimeError", "push_log", "step", "on_event", "warn", "append"}


def py_strings(path):
    tree = ast.parse(open(path, encoding="utf-8").read())
    out = set()

    def fmt_of(node):
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            return node.value
        if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Mod):
            return fmt_of(node.left)
        if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
            a, b = fmt_of(node.left), fmt_of(node.right)
            return (a or "") + ("%s" if b is None else b) if (a or b) else None
        if isinstance(node, ast.JoinedStr):
            s = ""
            for v in node.values:
                s += v.value if isinstance(v, ast.Constant) else "%s"
            return s
        return None

    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            name = node.func.id if isinstance(node.func, ast.Name) else node.func.attr if isinstance(node.func, ast.Attribute) else ""
            if name in MSG_CALLS and node.args:
                arg = node.args[1] if name == "on_event" and len(node.args) > 1 else node.args[0]
                s = fmt_of(arg)
                always = name in ("ApiError", "RuntimeError", "on_event")  # immer Meldungen an Menschen
                if s and re.search(r"[A-Za-zÄÖÜäöüß]{3}", s) and (always or GERMAN_HINT.search(s)) \
                        and s not in ("err", "sys"):
                    out.add(s)
        if isinstance(node, ast.Dict):
            for k, v in zip(node.keys, node.values):
                if isinstance(k, ast.Constant) and k.value == "msg":
                    s = fmt_of(v)
                    if s and GERMAN_HINT.search(s):
                        out.add(s)
    return out


def main():
    show_all = "--all" in sys.argv
    js = js_fragments(open(os.path.join(PKG, "static", "app.js"), encoding="utf-8").read())
    js |= js_fragments(open(os.path.join(PKG, "static", "index.html"), encoding="utf-8").read().replace("`", "'")
                       .join(["`", "`"]))
    py = set()
    for f in ("app.py", "osutil.py"):
        py |= py_strings(os.path.join(PKG, f))
    try:
        en_js = json.load(open(os.path.join(PKG, "static", "i18n", "en.json"), encoding="utf-8"))
    except OSError:
        en_js = {}
    try:
        en_py = json.load(open(os.path.join(PKG, "i18n_en.json"), encoding="utf-8"))
    except OSError:
        en_py = {}
    miss_js = sorted(x for x in js if show_all or x not in en_js)
    miss_py = sorted(x for x in py if show_all or x not in en_py)
    json.dump({"js": miss_js, "py": miss_py}, sys.stdout, ensure_ascii=False, indent=0)
    print("\n# js: %d (gesamt %d), py: %d (gesamt %d)" % (len(miss_js), len(js), len(miss_py), len(py)), file=sys.stderr)
    if "--check" in sys.argv and (miss_js or miss_py):
        print("Fehlende englische Übersetzungen – bitte in static/i18n/en.json bzw. i18n_en.json ergänzen.", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

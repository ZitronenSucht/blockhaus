"""Verlustfreies Lesen und Schreiben von NBT-Dateien (Minecraft-Weltdaten, z. B. level.dat).

Darstellung: jeder Wert ist ein Tupel (typ, wert).
  Compound (10): dict name → (typ, wert)          – Reihenfolge bleibt erhalten
  List (9):      (elementtyp, [wert, …])            – Elemente ohne eigenen Typ, wie im Format
  Arrays (7/11/12): list von Zahlen; String (8): str; Zahlen: int/float
"""
import gzip
import io
import os
import struct

END, BYTE, SHORT, INT, LONG, FLOAT, DOUBLE, BYTES, STRING, LIST, COMPOUND, INTS, LONGS = range(13)
_FMT = {BYTE: ">b", SHORT: ">h", INT: ">i", LONG: ">q", FLOAT: ">f", DOUBLE: ">d"}


def _read(f, t):
    if t in _FMT:
        fmt = _FMT[t]
        return struct.unpack(fmt, f.read(struct.calcsize(fmt)))[0]
    if t == BYTES:
        n = struct.unpack(">i", f.read(4))[0]
        return list(struct.unpack(">%db" % n, f.read(n)))
    if t == STRING:
        n = struct.unpack(">H", f.read(2))[0]
        return f.read(n).decode("utf-8", "surrogateescape")
    if t == LIST:
        et = f.read(1)[0]
        n = struct.unpack(">i", f.read(4))[0]
        return (et, [_read(f, et) for _ in range(n)])
    if t == COMPOUND:
        out = {}
        while True:
            tt = f.read(1)[0]
            if tt == END:
                return out
            name = _read(f, STRING)
            out[name] = (tt, _read(f, tt))
    if t == INTS:
        n = struct.unpack(">i", f.read(4))[0]
        return list(struct.unpack(">%di" % n, f.read(4 * n)))
    if t == LONGS:
        n = struct.unpack(">i", f.read(4))[0]
        return list(struct.unpack(">%dq" % n, f.read(8 * n)))
    raise ValueError("Unbekannter NBT-Typ %d" % t)


def _write(f, t, v):
    if t in _FMT:
        f.write(struct.pack(_FMT[t], v))
    elif t == BYTES:
        f.write(struct.pack(">i", len(v)) + struct.pack(">%db" % len(v), *v))
    elif t == STRING:
        b = v.encode("utf-8", "surrogateescape")
        f.write(struct.pack(">H", len(b)) + b)
    elif t == LIST:
        et, items = v
        f.write(bytes([et if items else (et or END)]) + struct.pack(">i", len(items)))
        for x in items:
            _write(f, et, x)
    elif t == COMPOUND:
        for name, (tt, x) in v.items():
            f.write(bytes([tt]))
            _write(f, STRING, name)
            _write(f, tt, x)
        f.write(bytes([END]))
    elif t == INTS:
        f.write(struct.pack(">i", len(v)) + struct.pack(">%di" % len(v), *v))
    elif t == LONGS:
        f.write(struct.pack(">i", len(v)) + struct.pack(">%dq" % len(v), *v))
    else:
        raise ValueError("Unbekannter NBT-Typ %d" % t)


def loads(data):
    """Bytes (gzip-komprimiert oder roh) → (name, (typ, wert))."""
    if data[:2] == b"\x1f\x8b":
        data = gzip.decompress(data)
    f = io.BytesIO(data)
    t = f.read(1)[0]
    name = _read(f, STRING)
    return name, (t, _read(f, t))


def dumps(root, name="", compress=True):
    t, v = root
    f = io.BytesIO()
    f.write(bytes([t]))
    _write(f, STRING, name)
    _write(f, t, v)
    data = f.getvalue()
    return gzip.compress(data, mtime=0) if compress else data


def load(path):
    with open(path, "rb") as f:
        return loads(f.read())


def save(path, root, name="", compress=True):
    """Atomar schreiben (erst Temp-Datei, dann ersetzen)."""
    tmp = path + ".tmp"
    with open(tmp, "wb") as f:
        f.write(dumps(root, name, compress))
    os.replace(tmp, path)


def get(root, *keys):
    """Wert unter einem Pfad von Compound-Schlüsseln – oder None."""
    t, v = root
    for k in keys:
        if t != COMPOUND or k not in v:
            return None
        t, v = v[k]
    return (t, v)

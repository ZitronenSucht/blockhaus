#!/usr/bin/env python3
"""Erzeugt die App-Icons (PNG, ICO, ICNS) aus dem Blockhaus-Logo – ohne externe Programme.

  python3 packaging/icons.py OUTDIR
"""
import os
import struct
import sys
import zlib

# Logo im 100×100-Raster (wie favicon.svg): Polygone mit Farbe
SHAPES = [
    ([(50, 12), (86, 32), (50, 52), (14, 32)], (0x7f, 0xe0, 0xa8)),
    ([(14, 32), (50, 52), (50, 92), (14, 72)], (0x3b, 0xb2, 0x73)),
    ([(86, 32), (50, 52), (50, 92), (86, 72)], (0x1f, 0x7a, 0x4d)),
    ([(26, 78.7), (38, 85.3), (38, 63.3), (26, 56.7)], (0xff, 0xd2, 0x7a)),
    ([(60, 64.4), (74, 56.7), (74, 44.7), (60, 52.4)], (0xff, 0xd2, 0x7a)),
]
BG = (0x13, 0x18, 0x17)


def inside(poly, x, y):
    c = False
    for i in range(len(poly)):
        (x1, y1), (x2, y2) = poly[i], poly[i - 1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            c = not c
    return c


def render(size, background=True, ss=4):
    """RGBA-Pixel; Hintergrund als abgerundetes Quadrat (App-Icon-Stil), 4×4-Supersampling."""
    px = bytearray()
    pad = 0.12 if background else 0.0
    radius = 0.22
    for py in range(size):
        px.append(0)  # PNG-Filterbyte
        for qx in range(size):
            acc = [0, 0, 0, 0]
            for sy in range(ss):
                for sx in range(ss):
                    u = (qx + (sx + 0.5) / ss) / size
                    v = (py + (sy + 0.5) / ss) / size
                    col = None
                    if background:
                        dx = max(abs(u - 0.5) - (0.5 - radius), 0)
                        dy = max(abs(v - 0.5) - (0.5 - radius), 0)
                        if dx * dx + dy * dy <= radius * radius:
                            col = BG
                    lx = ((u - pad) / (1 - 2 * pad)) * 100
                    ly = ((v - pad) / (1 - 2 * pad)) * 100
                    for poly, c in SHAPES:
                        if inside(poly, lx, ly):
                            col = c
                    if col:
                        acc[0] += col[0]; acc[1] += col[1]; acc[2] += col[2]; acc[3] += 255
            n = ss * ss
            a = acc[3] // n
            if a:
                px += bytes((acc[0] * 255 // acc[3], acc[1] * 255 // acc[3], acc[2] * 255 // acc[3], a))
            else:
                px += b"\0\0\0\0"
    return bytes(px)


def png(size, background=True):
    raw = render(size, background)

    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)) +
            chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def ico(pngs):
    """ICO mit eingebetteten PNGs (ab Windows Vista unterstützt)."""
    head = struct.pack("<HHH", 0, 1, len(pngs))
    off = 6 + 16 * len(pngs)
    entries, data = b"", b""
    for size, blob in pngs:
        entries += struct.pack("<BBBBHHII", size % 256, size % 256, 0, 0, 1, 32, len(blob), off + len(data))
        data += blob
    return head + entries + data


def icns(pngs):
    types = {16: b"icp4", 32: b"icp5", 64: b"icp6", 128: b"ic07", 256: b"ic08", 512: b"ic09", 1024: b"ic10"}
    body = b"".join(types[s] + struct.pack(">I", len(b) + 8) + b for s, b in pngs if s in types)
    return b"icns" + struct.pack(">I", len(body) + 8) + body


def main(out):
    os.makedirs(out, exist_ok=True)
    sizes = [16, 32, 48, 64, 128, 256, 512]
    pngs = {s: png(s) for s in sizes}
    with open(os.path.join(out, "blockhaus.png"), "wb") as f:
        f.write(pngs[256])
    with open(os.path.join(out, "blockhaus-512.png"), "wb") as f:
        f.write(pngs[512])
    with open(os.path.join(out, "blockhaus.ico"), "wb") as f:
        f.write(ico([(s, pngs[s]) for s in (16, 32, 48, 64, 128, 256)]))
    with open(os.path.join(out, "blockhaus.icns"), "wb") as f:
        f.write(icns([(s, pngs[s]) for s in (16, 32, 64, 128, 256, 512)]))
    print("Icons geschrieben nach", out)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "build/icons")

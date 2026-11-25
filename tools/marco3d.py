#!/usr/bin/env python3
"""Genera los marcos 3D (glTF binario, .glb) a tamaño real para la vista 3D y la realidad aumentada.

Uso: python3 tools/marco3d.py   →  3d/marco-v.glb, marco-h.glb, marco-3.glb, marco-2.glb
Medidas reales: marco 29,8 × 37,4 cm, moldura ~1,6 cm, 2,2 cm de profundidad.
Cada obra es un material «obra1», «obra2», «obra3» al que app.js le pone la imagen del cuadro.
El frente mira a +Z y la espalda queda en Z=0 (así se apoya en la pared en realidad aumentada).
"""
import json, os, struct, zlib
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "3d")
OW, OH, D = 0.298, 0.374, 0.022      # marco por fuera (m)
MX, MY = 0.0165, 0.0165              # ancho de la moldura
GAP = 0.04                           # separación entre piezas de un tríptico/díptico


def box(x0, y0, z0, x1, y1, z1):
    """Caja con normales planas: 24 vértices, 36 índices."""
    P, N, I = [], [], []
    faces = [((0, 0, 1), [(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]),
             ((0, 0, -1), [(x1, y0, z0), (x0, y0, z0), (x0, y1, z0), (x1, y1, z0)]),
             ((1, 0, 0), [(x1, y0, z1), (x1, y0, z0), (x1, y1, z0), (x1, y1, z1)]),
             ((-1, 0, 0), [(x0, y0, z0), (x0, y0, z1), (x0, y1, z1), (x0, y1, z0)]),
             ((0, 1, 0), [(x0, y1, z1), (x1, y1, z1), (x1, y1, z0), (x0, y1, z0)]),
             ((0, -1, 0), [(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)])]
    for n, quad in faces:
        b = len(P)
        P += quad; N += [n] * 4
        I += [b, b + 1, b + 2, b, b + 2, b + 3]
    return P, N, I


def frame(cx, w, h):
    """Moldura (4 barras + bisel interior) y fondo, centrada en x=cx."""
    x0, x1, y0, y1 = cx - w / 2, cx + w / 2, 0, h
    P, N, I = [], [], []
    def add(part):
        p, n, i = part; b = len(P); P.extend(p); N.extend(n); I.extend([k + b for k in i])
    add(box(x0, y1 - MY, 0, x1, y1, D))            # arriba
    add(box(x0, y0, 0, x1, y0 + MY, D))            # abajo
    add(box(x0, y0 + MY, 0, x0 + MX, y1 - MY, D))  # izquierda
    add(box(x1 - MX, y0 + MY, 0, x1, y1 - MY, D))  # derecha
    # bisel interior (escalón fino un poco más bajo)
    b2 = .004
    add(box(x0 + MX, y1 - MY - b2, 0, x1 - MX, y1 - MY, D - .006))
    add(box(x0 + MX, y0 + MY, 0, x1 - MX, y0 + MY + b2, D - .006))
    add(box(x0 + MX, y0 + MY + b2, 0, x0 + MX + b2, y1 - MY - b2, D - .006))
    add(box(x1 - MX - b2, y0 + MY + b2, 0, x1 - MX, y1 - MY - b2, D - .006))
    add(box(x0, y0, 0, x1, y1, .003))              # fondo
    return P, N, I


def art(cx, w, h):
    """Plano de la obra con UV (0,0) arriba a la izquierda."""
    x0, x1 = cx - w / 2 + MX + .004, cx + w / 2 - MX - .004
    y0, y1 = MY + .004, h - MY - .004
    z = D - .008
    P = [(x0, y1, z), (x1, y1, z), (x1, y0, z), (x0, y0, z)]
    N = [(0, 0, 1)] * 4
    UV = [(0, 0), (1, 0), (1, 1), (0, 1)]
    I = [0, 3, 2, 0, 2, 1]
    return P, N, UV, I


def png_1x1(rgb):
    raw = b"\x00" + bytes(rgb)
    chunk = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")


def build(n, horizontal=False):
    w, h = (OH, OW) if horizontal else (OW, OH)
    total = n * w + (n - 1) * GAP
    centers = [-total / 2 + w / 2 + i * (w + GAP) for i in range(n)]
    bin_ = bytearray(); views, accessors, meshes, nodes = [], [], [], []

    def push(arr, target=None):
        while len(bin_) % 4: bin_.append(0)
        off = len(bin_); data = arr.tobytes(); bin_.extend(data)
        v = {"buffer": 0, "byteOffset": off, "byteLength": len(data)}
        if target: v["target"] = target
        views.append(v); return len(views) - 1

    def acc(arr, kind, comp, minmax=False, target=None):
        a = {"bufferView": push(arr, target), "componentType": comp, "count": len(arr), "type": kind}
        if minmax: a["min"] = arr.min(0).tolist(); a["max"] = arr.max(0).tolist()
        accessors.append(a); return len(accessors) - 1

    def prim(P, N, I, mat, UV=None):
        P = np.array(P, np.float32); N = np.array(N, np.float32); I = np.array(I, np.uint16)
        attrs = {"POSITION": acc(P, "VEC3", 5126, True, 34962), "NORMAL": acc(N, "VEC3", 5126, target=34962)}
        if UV is not None: attrs["TEXCOORD_0"] = acc(np.array(UV, np.float32), "VEC2", 5126, target=34962)
        return {"attributes": attrs, "indices": acc(I, "SCALAR", 5123, target=34963), "material": mat}

    materials = [{"name": "marco", "pbrMetallicRoughness": {"baseColorFactor": [0.012, 0.012, 0.012, 1], "metallicFactor": 0, "roughnessFactor": 0.42}}]
    img_view = push(np.frombuffer(png_1x1((200, 196, 188)), np.uint8))
    images = [{"bufferView": img_view, "mimeType": "image/png"}]
    textures, prims_frame = [], []
    for i, cx in enumerate(centers):
        textures.append({"source": 0, "sampler": 0})
        materials.append({"name": f"obra{i + 1}", "pbrMetallicRoughness": {"baseColorTexture": {"index": i}, "metallicFactor": 0, "roughnessFactor": 0.82}})
        P, N, I = frame(cx, w, h); prims_frame.append(prim(P, N, I, 0))
        P, N, UV, I = art(cx, w, h)
        meshes.append({"name": f"obra{i + 1}", "primitives": [prim(P, N, I, i + 1, UV)]})
    meshes.insert(0, {"name": "marco", "primitives": prims_frame})
    # centra en Y (el alto queda alrededor del origen para la vista 3D)
    nodes = [{"name": m["name"], "mesh": k, "translation": [0, -h / 2, 0]} for k, m in enumerate(meshes)]
    gltf = {"asset": {"version": "2.0", "generator": "Cuadros Finos marco3d.py"},
            "scene": 0, "scenes": [{"nodes": list(range(len(nodes)))}], "nodes": nodes, "meshes": meshes,
            "materials": materials, "textures": textures, "images": images,
            "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071}],
            "accessors": accessors, "bufferViews": views, "buffers": [{"byteLength": 0}]}
    while len(bin_) % 4: bin_.append(0)
    gltf["buffers"][0]["byteLength"] = len(bin_)
    js = json.dumps(gltf, separators=(",", ":")).encode()
    while len(js) % 4: js += b" "
    glb = struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bin_)) + \
          struct.pack("<II", len(js), 0x4E4F534A) + js + struct.pack("<II", len(bin_), 0x004E4942) + bytes(bin_)
    return glb


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for name, n, hz in [("marco-v", 1, False), ("marco-h", 1, True), ("marco-3", 3, False), ("marco-2", 2, False)]:
        data = build(n, hz)
        open(os.path.join(OUT, name + ".glb"), "wb").write(data)
        print(name, len(data), "bytes")

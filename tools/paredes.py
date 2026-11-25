import numpy as np, cv2
from PIL import Image
from scipy.sparse import lil_matrix, csr_matrix
from scipy.sparse.linalg import spsolve
SRC = "/home/user/Cuadrosfinos-web/img/ambiente/"
def laplace_fill(img, mask):
    """Rellena mask resolviendo Laplace (interpolación armónica) por canal."""
    h, w = mask.shape
    idx = -np.ones((h, w), int); ys, xs = np.nonzero(mask); idx[ys, xs] = np.arange(len(ys))
    n = len(ys); A = lil_matrix((n, n)); out = img.copy()
    bs = np.zeros((n, img.shape[2]))
    for k, (y, x) in enumerate(zip(ys, xs)):
        A[k, k] = 4
        for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
            yy, xx = min(max(y+dy,0),h-1), min(max(x+dx,0),w-1)
            if mask[yy, xx]: A[k, idx[yy, xx]] -= 1
            else: bs[k] += img[yy, xx]
    A = csr_matrix(A)
    for c in range(img.shape[2]):
        out[ys, xs, c] = spsolve(A, bs[:, c])
    return out
def clean(name, boxes, pad=20, shadow=40, scale=4):
    im = np.asarray(Image.open(SRC + name).convert("RGB")).astype(np.float32)
    H, W = im.shape[:2]
    m = np.zeros((H, W), np.uint8)
    for x0, y0, x1, y1 in boxes:
        m[max(0,y0-pad):min(H,y1+pad+shadow), max(0,x0-pad):min(W,x1+pad)] = 1
    m = cv2.dilate(m, np.ones((9, 9), np.uint8))
    small = cv2.resize(im, (W // scale, H // scale), interpolation=cv2.INTER_AREA)
    ms = cv2.resize(m, (W // scale, H // scale), interpolation=cv2.INTER_NEAREST).astype(bool)
    ms = cv2.dilate(ms.astype(np.uint8), np.ones((3,3),np.uint8)).astype(bool)
    filled = laplace_fill(small, ms)
    big = cv2.resize(filled, (W, H), interpolation=cv2.INTER_CUBIC)
    # grano de la pared
    ys, xs = np.nonzero(m); y0 = max(0, ys.min() - 50)
    ref = im[y0:ys.min() - 6, xs.min():xs.max()]
    sd = (ref - cv2.GaussianBlur(ref, (0, 0), 2)).std() if ref.size else 1.5
    rng = np.random.default_rng(7)
    noise = cv2.GaussianBlur(rng.normal(0, 1, (H, W)).astype(np.float32), (0, 0), .7)
    big += (noise / noise.std() * sd * .9)[..., None]
    soft = cv2.GaussianBlur(m.astype(np.float32), (0, 0), 6)[..., None]
    res = im * (1 - soft) + big * soft
    return Image.fromarray(np.clip(res, 0, 255).astype(np.uint8))
# Fotos reales del tríptico Foco (marcos de 30 × 37 cm) convertidas en paredes vacías.
# cajas = (x0, y0, x1, y1) de cada marco detectado; sombra/pad = cuánto más se borra.
SALAS = {
    "sala":       {"src": "foco-mod-3.webp", "nombre": "Sala", "cajas": [(78, 197, 289, 503), (307, 197, 517, 503), (537, 196, 748, 503)], "sombra": 22, "pad": 16},
    "dormitorio": {"src": "foco-esc-5.webp", "nombre": "Dormitorio", "cajas": [(120, 154, 347, 451), (387, 154, 616, 451), (656, 154, 887, 451)], "sombra": 40, "pad": 20},
    "oficina":    {"src": "foco-mod-4.webp", "nombre": "Oficina", "cajas": [(185, 46, 377, 299), (411, 47, 601, 299), (634, 48, 825, 300)], "sombra": 8, "pad": 16},
    "estudio":    {"src": "foco-esc-3.webp", "nombre": "Escritorio", "cajas": [(102, 136, 339, 440), (375, 137, 608, 440), (642, 137, 873, 439)], "sombra": 40, "pad": 20},
}

if __name__ == "__main__":
    import json, os
    ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = {}
    for k, s in SALAS.items():
        im = clean(s["src"], s["cajas"], pad=s["pad"], shadow=s["sombra"])
        W, H = im.size
        im.save(os.path.join(ROOT, "img", "ambiente", f"pared-{k}.webp"), "WEBP", quality=82, method=6)
        c = s["cajas"]
        pxcm = sum(b[2] - b[0] for b in c) / len(c) / 30          # px por cm
        gap = (sum(c[i + 1][0] - c[i][2] for i in range(len(c) - 1)) / (len(c) - 1)) / pxcm
        cx = (c[0][0] + c[-1][2]) / 2
        cy = sum((b[1] + b[3]) / 2 for b in c) / len(c)
        out[k] = {"nombre": s["nombre"], "img": f"pared-{k}", "ar": round(W / H, 4),
                  "cx": round(cx / W * 100, 2), "cy": round(cy / H * 100, 2),
                  "cm": round(pxcm / W * 100, 4), "gap": round(gap, 1)}
        print(k, out[k])
    cat_path = os.path.join(ROOT, "data", "catalogo.json")
    cat = json.load(open(cat_path, encoding="utf-8"))
    cat["paredes"] = out
    json.dump(cat, open(cat_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

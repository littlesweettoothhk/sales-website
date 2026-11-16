# -*- coding: utf-8 -*-
"""Cut a flavour out of its photograph, for the big shots on coloured backgrounds.

    pip install "rembg[cpu]" pillow numpy scipy
    python3 tools/cutout.py                 every flavour in products.json
    python3 tools/cutout.py matcha          just one

Reads src/<photo>, writes src/cut/<id>.webp and a half-size src/cut/<id>-s.webp. Run it once when a flavour is
added or its photo changes, then commit the result — the site itself only ever
serves the finished image.

Nothing is drawn or generated: the tool finds the brookie (or the jar), throws
the background away, and resizes. A flavour with no cut-out still works; the
pages fall back to its ordinary photo in a round frame.
"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from rembg import remove, new_session

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LONG_EDGE = 880          # roughly 2x the size it is shown at

def cut(session, src, dst):
    im = Image.open(src).convert('RGB')
    rgba = np.asarray(remove(im, session=session)).copy()
    a = rgba[..., 3].astype(np.float32) / 255
    # faint ghosts of the plate and the cooling rack sit well under half opacity
    soft = np.clip((a - .45) / .40, 0, 1)
    lab, k = ndi.label(soft > .5)
    sizes = ndi.sum(soft > .5, lab, range(1, k + 1))
    body = ndi.binary_fill_holes(lab == 1 + int(np.argmax(sizes)))
    rim = ndi.binary_dilation(body, iterations=3) & ~body      # keep its soft edge
    core = ndi.binary_erosion(body, iterations=4)              # and never a hole inside it
    alpha = np.where(core, 1.0, np.where(body | rim, soft, 0.0))
    rgba[..., 3] = (alpha * 255).astype(np.uint8)
    ys, xs = np.where(alpha > .05)
    out = Image.fromarray(rgba).crop((max(0, xs.min() - 6), max(0, ys.min() - 6),
                                      min(im.width, xs.max() + 7), min(im.height, ys.max() + 7)))
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    # a large one for the stage and product page, a small one for tiles and thumbnails
    for edge, path in ((LONG_EDGE, dst), (LONG_EDGE // 2, dst.replace('.webp', '-s.webp'))):
        s = edge / max(out.size)
        big = out.resize((round(out.width * s), round(out.height * s)), Image.LANCZOS)
        big.save(path, 'WEBP', quality=78, method=6)
        if edge == LONG_EDGE: size = big.size
    return size

def main(only):
    products = json.load(open(os.path.join(ROOT, 'tools', 'products.json'), encoding='utf-8'))
    session = new_session('isnet-general-use')
    for p in products:
        if only and p['id'] not in only: continue
        size = cut(session, os.path.join(ROOT, 'src', p['img']), os.path.join(ROOT, 'src', 'cut', p['id'] + '.webp'))
        print(f"  {p['id']:<12} src/cut/{p['id']}.webp  {size[0]}x{size[1]}")

if __name__ == '__main__':
    main(sys.argv[1:])

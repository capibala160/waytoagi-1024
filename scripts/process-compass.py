#!/usr/bin/env python3
"""
Turn the selected Draw Things raw renders into layered compass assets.

Inputs (raw, in graphics/):
  flux-plate-rose-01.png  1536x1536  text-free brass plate (final)
  needle-v2-01.png        1024x1024  red/brass needle on white
  glass-v2-02.png         1024x1024  dark glass disc with window reflection
  sheen-v1-01.png         1024x1024  window reflection on black
  sheen-v1-02.png         1024x1024  softer window reflection on black

The Z-Image plate-v2-02.png remains supported through PLATE_MODE='zimage'.

Outputs (compass-kit/assets/):
  plate.png         1400x1400 RGBA, circular alpha centred on the brass hub
  needle.png        1024x1024 RGBA, pivot at exact center
  glass.png         1024x1024 RGBA, screen-blend ready, black point lifted
  sheen-window.png  1024x1024 RGB, screen-blend ready
  sheen-soft.png    1024x1024 RGB, screen-blend ready
  dial-markings.svg exact vector labels (the only text in the kit)
  preview.png       1400x1400 flattened demo render
  geometry.json     measured ratios for the scene
"""

from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'graphics')
OUT = os.path.join(ROOT, 'compass-kit', 'assets')
os.makedirs(OUT, exist_ok=True)

# Chosen raw renders. The FLUX plate is text-free: every character the app
# shows is vector, so a model never gets a chance to invent one.
# PLATE_MODE 'flux' keeps the photographed silhouette and centres the hub;
# 'zimage' is the older circular-matte path with the pendant-loop patch.
PLATE_SOURCE = 'flux-plate-rose-01.png'
PLATE_MODE = 'flux'
ZIMAGE_SOURCE = 'plate-v2-02.png'
NEEDLE_SOURCE = 'needle-v2-01.png'
GLASS_SOURCE = 'glass-v2-02.png'


def rgb_arrays(path):
    im = Image.open(path).convert('RGB')
    a = np.asarray(im).astype(np.float32)
    return im, a


def sample_bilinear(a, xs, ys):
    """Bilinear sample of a HxWxC float array at float coordinates."""
    h, w = a.shape[:2]
    xs = np.clip(xs, 0, w - 1.001)
    ys = np.clip(ys, 0, h - 1.001)
    x0 = np.floor(xs).astype(np.int32)
    y0 = np.floor(ys).astype(np.int32)
    x1, y1 = x0 + 1, y0 + 1
    fx = (xs - x0)[..., None]
    fy = (ys - y0)[..., None]
    return (a[y0, x0] * (1 - fx) * (1 - fy) + a[y0, x1] * fx * (1 - fy) +
            a[y1, x0] * (1 - fx) * fy + a[y1, x1] * fx * fy)


def remove_pendant_loop(a, cx, cy, outer_r):
    """Replace the cast pendant loop at 6 o'clock with clean bezel.

    The dial is rotated in the app, so a rectangular alpha cut would travel
    around the bezel. Instead, clone the bezel from 18 degrees to either side
    at the same radius: concentric grooves line up, and the lighting barely
    differs across 18 degrees. The clone is feathered at both ends.
    """
    h, w = a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    dx, dy = xx - cx, yy - cy
    r = np.sqrt(dx * dx + dy * dy)
    theta = np.degrees(np.arctan2(dy, dx))          # bottom = +90
    d_theta = theta - 90

    patch = (np.abs(d_theta) < 12) & (r > outer_r * 0.90) & (r < outer_r + 3)
    if not patch.any():
        return a

    off = np.deg2rad(18)
    th = np.arctan2(dy, dx)
    left = sample_bilinear(a, cx + r * np.cos(th - off), cy + r * np.sin(th - off))
    right = sample_bilinear(a, cx + r * np.cos(th + off), cy + r * np.sin(th + off))
    mix = np.clip((dx + 6) / 12, 0, 1)[..., None]
    cloned = left * (1 - mix) + right * mix

    # Feather: angular 12° -> 9°, radial 0.90R -> 0.94R.
    wa = np.clip((12 - np.abs(d_theta)) / 3, 0, 1)
    wr = np.clip((r - outer_r * 0.90) / (outer_r * 0.04), 0, 1)
    weight = (patch * wa * wr)[..., None]
    return a * (1 - weight) + cloned * weight


def fill_small_holes(mask, max_area=3000):
    """Fill enclosed holes, but only ones small enough to be specular gaps."""
    h, w = mask.shape
    m = Image.fromarray(np.where(mask, 255, 0).astype(np.uint8)).convert('RGB')
    for seed in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        if m.getpixel(seed) == (0, 0, 0):
            ImageDraw.floodfill(m, seed, (255, 0, 0), thresh=0)
    out = np.asarray(m)
    background = (out[..., 0] == 255) & (out[..., 1] == 0) & (out[..., 2] == 0)
    holes = (~background) & (~mask)
    seen = np.zeros_like(holes)
    keep = np.zeros_like(holes)
    hys, hxs = np.where(holes)
    for y, x in zip(hys, hxs):
        if seen[y, x]:
            continue
        stack = [(y, x)]
        seen[y, x] = True
        pixels = []
        while stack:
            cy, cx = stack.pop()
            pixels.append((cy, cx))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < h and 0 <= nx < w and holes[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
        if len(pixels) <= max_area:
            for py, px in pixels:
                keep[py, px] = True
    return keep


# ---------------------------------------------------------------- plate

def process_plate():
    if PLATE_MODE == 'flux':
        return process_plate_flux()
    return process_plate_zimage()


def process_plate_flux():
    """Text-free FLUX plate: keep the real silhouette, centre the brass hub.

    The background is pure black, so the alpha is the photographed object
    rather than a guessed circle. The crop is square around the hub, which is
    also the needle pivot and the centre of the vector marking ring. The dial
    radius is measured from the cream fraction: it stays near 1.0 inside the
    dial and drops at the tick ring.
    """
    path = os.path.join(RAW, PLATE_SOURCE)
    im, a = rgb_arrays(path)
    h, w, _ = a.shape
    R, G, B = a[..., 0], a[..., 1], a[..., 2]
    mx, mn = a.max(2), a.min(2)
    S = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
    V = mx / 255
    cream = (V > 0.45) & (S < 0.42) & (R >= G) & (G >= B)

    # Brass hub = the brightest gold blob near the centre.
    yy, xx = np.mgrid[0:h, 0:w]
    central = (np.abs(xx - w / 2) < 0.10 * w) & (np.abs(yy - h / 2) < 0.10 * h)
    gold = (R > 125) & (G > 0.55 * R) & (B < 0.85 * G) & ((R - B) > 40) & central
    gy, gx = np.where(gold)
    if len(gx) < 100:
        raise RuntimeError('Hub not found; check the plate crop')
    cx, cy = float(gx.mean()), float(gy.mean())

    # The render's bezel is a little off-centre and not perfectly round. Keep
    # the photographed pixels but use a clean circular matte: a silhouette
    # matte would punch the dark engraving out as transparent holes.
    obj = V > 0.06
    ys, xs = np.where(obj)
    dist = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2)
    outer_r = float(np.percentile(dist, 99.95)) + 6
    half = int(round(outer_r))
    side = half * 2
    canvas = Image.new('RGB', (side, side), (0, 0, 0))
    left = int(round(cx)) - half
    top = int(round(cy)) - half
    box = (max(0, left), max(0, top), min(w, left + side), min(h, top + side))
    paste_at = (max(0, -left), max(0, -top))
    canvas.paste(im.crop(box), paste_at)

    out_size = 1400
    canvas = canvas.resize((out_size, out_size), Image.LANCZOS)
    # The source background is pure black. Recolour it to the demo's stage
    # colour so the ring between the off-centre bezel and the matte disappears.
    pixels = np.asarray(canvas).copy()
    black = (pixels == 0).all(2)
    pixels[black] = (11, 13, 16)
    canvas = Image.fromarray(pixels)
    mask = Image.new('L', (out_size, out_size), 0)
    ImageDraw.Draw(mask).ellipse([1, 1, out_size - 1, out_size - 1], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(0.7))
    out = canvas.convert('RGBA')
    out.putalpha(mask)
    out.save(os.path.join(OUT, 'plate.png'), optimize=True)

    # Inner dial radius = last radius on the cream plateau (the tick ring
    # is the first sustained drop).
    angle = np.linspace(0, 2 * np.pi, 180, endpoint=False)
    cos, sin = np.cos(angle), np.sin(angle)
    radii = np.arange(int(outer_r * 0.35), int(outer_r * 0.85))
    frac = []
    for r in radii:
        sx = np.clip((cx + cos * r).astype(int), 0, w - 1)
        sy = np.clip((cy + sin * r).astype(int), 0, h - 1)
        frac.append(float(cream[sy, sx].mean()))
    frac = np.convolve(frac, np.ones(7) / 7, mode='same')
    high = radii[frac > 0.92]
    if not len(high):
        raise RuntimeError('Dial radius not found; check the cream fraction')
    dial_r = float(high.max())
    scale = out_size / side
    dial_out = dial_r * scale

    return {
        'source': f'graphics/{PLATE_SOURCE}',
        'asset': 'assets/plate.png',
        'mode': PLATE_MODE,
        'size': out_size,
        'center': [out_size / 2, out_size / 2],
        'outerRadius': round(half * scale, 2),
        'dialRadius': round(dial_out, 2),
        'dialRadiusRatio': round(dial_out / (out_size / 2), 4),
        'sourceCenter': [round(cx, 2), round(cy, 2)],
        'sourceDialRadius': round(dial_r, 2),
        'sourceOuterRadius': round(outer_r, 2),
        'cropHalf': half,
    }


def process_plate_zimage():
    path = os.path.join(RAW, ZIMAGE_SOURCE)
    im, a = rgb_arrays(path)
    h, w, _ = a.shape
    R, G, B = a[..., 0], a[..., 1], a[..., 2]
    mx, mn = a.max(2), a.min(2)
    S = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
    V = mx / 255

    cream = ((V > 0.45) & (S < 0.42) & (R >= G) & (G >= B)).astype(np.uint8) * 255

    # Flood the main cream dial from a point inside it (not the bezel highlight).
    seed = (int(w * 0.30), int(h * 0.40))
    m = Image.fromarray(np.stack([cream] * 3, -1), 'RGB')
    ImageDraw.floodfill(m, seed, (128, 0, 0), thresh=0)
    dial = np.asarray(m)[..., 0] == 128
    ys, xs = np.where(dial)
    if len(xs) < 10000:
        raise RuntimeError('Dial flood fill failed; check the plate crop')
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    dial_r = ((x1 - x0) + (y1 - y0)) / 4

    # Outer bezel radius: median of radial scans, skip the bottom pendant loop.
    radii = []
    for deg in range(0, 360, 2):
        if 70 <= deg <= 110:
            continue
        rad = np.deg2rad(deg)
        last = 0
        for r in range(int(dial_r * 0.8), int(min(w, h) * 0.49)):
            xx = int(cx + np.cos(rad) * r)
            yy = int(cy + np.sin(rad) * r)
            if 0 <= xx < w and 0 <= yy < h and V[yy, xx] > 0.18:
                last = r
        if last:
            radii.append(last)
    outer_r = float(np.median(radii))

    # Crop to the outer circle, then add a transparent circular alpha.
    half = int(round(outer_r + 6))
    left = int(round(cx)) - half
    top = int(round(cy)) - half
    side = half * 2
    canvas = Image.new('RGB', (side, side), (0, 0, 0))
    src_box = (max(0, left), max(0, top), min(w, left + side), min(h, top + side))
    canvas.paste(im.crop(src_box), (max(0, -left), max(0, -top)))

    out_size = 1400
    canvas = canvas.resize((out_size, out_size), Image.LANCZOS)
    scale = out_size / side
    circle_r = (outer_r + 3) * scale
    cc = out_size / 2

    # The source has a pendant loop at 6 o'clock. The dial rotates, so patch
    # the bezel instead of cutting a notch that would orbit with it.
    pixels = np.asarray(canvas).astype(np.float32)
    pixels = remove_pendant_loop(pixels, cc, cc, circle_r)
    canvas = Image.fromarray(np.clip(pixels, 0, 255).astype(np.uint8))

    alpha = Image.new('L', (out_size, out_size), 0)
    ImageDraw.Draw(alpha).ellipse(
        [cc - circle_r + 3, cc - circle_r + 3, cc + circle_r - 3, cc + circle_r - 3], fill=255
    )
    alpha = alpha.filter(ImageFilter.GaussianBlur(1.1))
    out = canvas.convert('RGBA')
    out.putalpha(alpha)
    out.save(os.path.join(OUT, 'plate.png'), optimize=True)

    dial_ratio = dial_r / (side / 2)       # dial radius / half-crop
    return {
        'source': f'graphics/{ZIMAGE_SOURCE}',
        'asset': 'assets/plate.png',
        'size': out_size,
        'center': [out_size / 2, out_size / 2],
        'outerRadius': round(circle_r, 2),
        'dialRadius': round((dial_r * scale), 2),
        'dialRadiusRatio': round(dial_ratio, 4),
        'sourceCrop': [left, top, side],
        'sourceCenter': [round(cx, 2), round(cy, 2)],
        'sourceDialRadius': round(float(dial_r), 2),
        'sourceOuterRadius': round(outer_r, 2),
    }


# ---------------------------------------------------------------- needle

def process_needle():
    path = os.path.join(RAW, NEEDLE_SOURCE)
    im, a = rgb_arrays(path)
    R, G, B = a[..., 0], a[..., 1], a[..., 2]
    mx, mn = a.max(2), a.min(2)
    S = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
    V = mx / 255
    dist = np.sqrt(((255 - a) ** 2).sum(2))

    # The white studio background leaves a neutral cast shadow on the right.
    # Build the matte from saturated metal plus dark edges, then mirror the
    # clean left silhouette across the needle's centreline. A real needle is
    # symmetric; mirroring removes the shadow instead of keying it out.
    base = ((S > 0.20) & (dist > 35)) | ((V < 0.55) & (dist > 60))
    base_img = Image.fromarray(base.astype(np.uint8) * 255)
    base = np.asarray(base_img.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))) > 127

    h, w = base.shape
    gold = (R > 100) & (G > 0.5 * R) & (B < 0.9 * G) & (R - B > 30)
    yy, xx = np.mgrid[0:h, 0:w]
    central = (np.abs(xx - w / 2) < 130) & (np.abs(yy - h / 2) < 160)
    gy, gx = np.where(gold & central)
    centre_x = float(gx.mean()) if len(gx) else w / 2

    silhouette = np.zeros_like(base)
    for y in range(h):
        cols = np.where(base[y])[0]
        if not len(cols):
            continue
        left_extent = centre_x - cols.min()
        right_extent = cols.max() - centre_x
        extent = left_extent if left_extent > 3 else right_extent
        if extent <= 0:
            continue
        x0 = max(0, int(round(centre_x - extent)))
        x1 = min(w, int(round(centre_x + extent)) + 1)
        silhouette[y, x0:x1] = True

    sil_img = Image.fromarray(silhouette.astype(np.uint8) * 255)
    silhouette = np.asarray(sil_img.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))) > 127
    silhouette = silhouette | fill_small_holes(silhouette)

    rgba = np.dstack([a, np.where(silhouette, 255, 0)]).astype(np.uint8)
    im = Image.fromarray(rgba, 'RGBA')

    # The pivot is the widest row of the symmetric sprite (the brass dome).
    widths = silhouette.sum(1)
    pivot_y = int(np.argmax(widths))
    row = np.where(silhouette[pivot_y])[0]
    pivot_x = int(round((row.min() + row.max()) / 2))

    crop_side = 1100
    left = pivot_x - crop_side // 2
    top = pivot_y - crop_side // 2
    canvas = Image.new('RGBA', (crop_side, crop_side), (0, 0, 0, 0))
    src = im
    src_box = (max(0, left), max(0, top), min(a.shape[1], left + crop_side), min(a.shape[0], top + crop_side))
    canvas.paste(src.crop(src_box), (max(0, -left), max(0, -top)))
    canvas = canvas.resize((1024, 1024), Image.LANCZOS)
    canvas.save(os.path.join(OUT, 'needle.png'), optimize=True)

    ys, xs = np.where(silhouette)
    length = ys.max() - ys.min()
    return {
        'source': f'graphics/{NEEDLE_SOURCE}',
        'asset': 'assets/needle.png',
        'size': 1024,
        'pivot': [512, 512],
        'sourcePivot': [pivot_x, pivot_y],
        'sourceLength': int(length),
        'lengthRatio': round(length / crop_side, 4),
    }


# ---------------------------------------------------------------- glass

def process_glass():
    path = os.path.join(RAW, GLASS_SOURCE)
    im, a = rgb_arrays(path)
    V = a.max(2) / 255
    ys, xs = np.where(V > 0.05)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    r = max(x1 - x0, y1 - y0) / 2 + 2
    left = int(round(cx - r))
    top = int(round(cy - r))
    side = int(round(r * 2))
    canvas = Image.new('RGB', (side, side), (0, 0, 0))
    src_box = (max(0, left), max(0, top), min(a.shape[1], left + side), min(a.shape[0], top + side))
    canvas.paste(im.crop(src_box), (max(0, -left), max(0, -top)))
    canvas = canvas.resize((1024, 1024), Image.LANCZOS)
    # The model's glass has a milky grey base. Screen blending that base washes
    # out the cream dial, so lift the black point to keep the reflections, then
    # gamma-crush the broad window pane so it does not hide the markings. The
    # thin rim highlight is near white and survives the curve.
    rgb = np.asarray(canvas).astype(np.float32) / 255
    rgb = np.clip((rgb - 0.25) / 0.75, 0, 1) ** 1.6 * 255
    canvas = Image.fromarray(rgb.astype(np.uint8))
    alpha = Image.new('L', (1024, 1024), 0)
    ImageDraw.Draw(alpha).ellipse([4, 4, 1020, 1020], fill=255)
    alpha = alpha.filter(ImageFilter.GaussianBlur(1.0))
    out = canvas.convert('RGBA')
    out.putalpha(alpha)
    out.save(os.path.join(OUT, 'glass.png'), optimize=True)
    return {
        'source': f'graphics/{GLASS_SOURCE}',
        'asset': 'assets/glass.png',
        'size': 1024,
        'blend': 'screen',
    }


def copy_sheen(src_name, out_name):
    im = Image.open(os.path.join(RAW, src_name)).convert('RGB')
    im.resize((1024, 1024), Image.LANCZOS).save(os.path.join(OUT, out_name), optimize=True)
    return {
        'source': f'graphics/{src_name}',
        'asset': f'assets/{out_name}',
        'size': 1024,
        'blend': 'screen',
    }


def write_markings_svg(plate_geo):
    """Vector markings are the utility layer; generated numerals are unreliable.

    The plate's blank margin is wide enough that the ring needs no cream
    backing: dark ink sits directly on enamel, exactly like a printed dial.
    """
    dial_r = plate_geo['dialRadius'] / plate_geo['size'] * 1000
    label_r = dial_r * 0.80

    def pos(angle, radius):
        rad = np.deg2rad(angle)
        return 500 + radius * np.sin(rad), 500 - radius * np.cos(rad)

    cardinals = [('N', 0), ('E', 90), ('S', 180), ('W', 270)]
    numbers = [30, 60, 120, 150, 210, 240, 300, 330]

    parts = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" role="img" aria-label="Compass dial markings: N, E, S, W and 30-degree numerals">',
        '  <defs>',
        '    <filter id="ink" x="-20%" y="-20%" width="140%" height="140%">',
        '      <feDropShadow dx="0" dy="1.2" stdDeviation="0.45" flood-color="#fff4d6" flood-opacity="0.45"/>',
        '    </filter>',
        '  </defs>',
        '  <g filter="url(#ink)" fill="#2b2116" text-anchor="middle" dominant-baseline="central">',
        '    <g font-family="Georgia, \'Times New Roman\', serif" font-weight="700" font-size="74">',
    ]
    for label, angle in cardinals:
        x, y = pos(angle, label_r)
        parts.append(f'      <text x="{x:.1f}" y="{y:.1f}">{label}</text>')
    parts += [
        '    </g>',
        '    <g font-family="\'Helvetica Neue\', Arial, sans-serif" font-weight="600" font-size="48" letter-spacing="0.5">',
    ]
    for angle in numbers:
        x, y = pos(angle, label_r)
        parts.append(f'      <text x="{x:.1f}" y="{y:.1f}">{angle}°</text>')
    parts += [
        '    </g>',
        '  </g>',
        '</svg>',
    ]
    path = os.path.join(OUT, 'dial-markings.svg')
    with open(path, 'w') as f:
        f.write('\n'.join(parts) + '\n')
    return {
        'asset': 'assets/dial-markings.svg',
        'viewBox': '0 0 1000 1000',
        'dialRadius': round(float(dial_r), 2),
        'labelRadius': round(float(label_r), 2),
        'numbers': numbers,
        'cardinals': [c[0] for c in cardinals],
        'note': 'Lubber index is separate: it is fixed to the phone, not the dial.',
    }


def write_web_derivatives():
    """WebP is the shipping format: same pixels, roughly a tenth of the bytes."""
    web_dir = os.path.join(OUT, 'web')
    os.makedirs(web_dir, exist_ok=True)
    specs = [
        ('plate', 90),
        ('needle', 92),
        ('glass', 92),
        ('sheen-window', 88),
        ('sheen-soft', 88),
    ]
    out = {}
    for name, quality in specs:
        src = os.path.join(OUT, f'{name}.png')
        dst = os.path.join(web_dir, f'{name}.webp')
        Image.open(src).save(dst, 'WEBP', quality=quality, method=6)
        out[name] = {
            'asset': f'assets/web/{name}.webp',
            'bytes': os.path.getsize(dst),
        }
    return out


if __name__ == '__main__':
    geometry = {
        'plate': process_plate(),
        'needle': process_needle(),
        'glass': process_glass(),
        'sheenWindow': copy_sheen('sheen-v1-01.png', 'sheen-window.png'),
        'sheenSoft': copy_sheen('sheen-v1-02.png', 'sheen-soft.png'),
    }
    geometry['markings'] = write_markings_svg(geometry['plate'])
    geometry['web'] = write_web_derivatives()
    geometry['preview'] = {
        'asset': 'assets/preview.png',
        'web': 'assets/web/preview.webp',
        'size': 1400,
        'pose': {'heading': 25, 'target': 110},
        'source': 'demo.html?view=clean&stage=1200',
    }
    with open(os.path.join(OUT, 'geometry.json'), 'w') as f:
        json.dump(geometry, f, indent=2)
    print(json.dumps(geometry, indent=2))

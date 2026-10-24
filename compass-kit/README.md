# Compass kit · 犟针

A layered photoreal compass for the game. The plate, needle and glass are
Draw Things renders; every dial character is vector, so N/E/S/W and the 30°
numerals are exact.

## Open the demo

```bash
open -a "Google Chrome" compass-kit/demo.html
```

Or serve the repo (`python3 -m http.server 8000`) and visit
`http://localhost:8000/compass-kit/demo.html` for the phone-compass sensor.

The demo has heading/target sliders, Spin, Face target, a real-compass button,
layer toggles, a reflection switch, dark/light, and 390/430 width previews.

## What is in the folder

| Path | What |
|---|---|
| `demo.html` | interactive layered compass |
| `TECH.md` | geometry, layer stack, glass recipe, prompts, integration, limits |
| `assets/plate.png` | 1400×1400 text-free dial plate |
| `assets/needle.png` | 1024×1024 needle, pivot at centre |
| `assets/glass.png` | 1024×1024 reflection, screen-blend ready |
| `assets/sheen-*.png` | two window sheens |
| `assets/dial-markings.svg` | exact cardinal letters and numerals |
| `assets/preview.png` | flattened 1400×1400 render |
| `assets/web/` | WebP shipping files |

## The short version

- Plate + markings rotate by `-heading`.
- Needle rotates by `target - heading`.
- Glass covers the dial only; its reflection rotates by `-heading`.
- Two sheens rotate at 0.58× and 1.22× for parallax.
- Ship at **290–330 px**; at 250 px (today's in-game size) the numerals drop
  to about 12 px. See `TECH.md` for the size table.

## Rebuild

```bash
python3 scripts/process-compass.py
```

Raw renders and prompt manifests live in `../graphics/`.

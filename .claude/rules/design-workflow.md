# Design Workflow

Adapted from SpectraSort's design rules.

## Present designs as HTML, never as prose

**Always present design recommendations as HTML files** — never describe colors or
layouts in text. Build a visual mockup Mike can open in a browser.

- Dark mode is the **default** for every mockup. Each file carries a visible
  light/dark switch that flips every phone on the page.
- Open in Chrome: `open -a "Google Chrome" path/to/mockup.html`
- Mockups live in `designs/` at the project root.

## Implementing from a design file

**Never guess when given a design file.** Every visual decision must come from
actually looking at the design — not from inferring what the designer probably meant
from CSS values or written specs.

1. **Render it first.** Open the HTML in Chrome or serve it with
   `python3 -m http.server`.
2. **Screenshot and zoom** into the specific element you are implementing.
3. **Compare side-by-side** with your build before reporting any visual change as done.
4. **If the design and a CSS spec disagree, the rendered design wins.** Anti-aliasing,
   blending, and layered effects are invisible in raw CSS values.

## Density

- **Information density matters** — avoid sparse "western minimalist" layouts.
- The phone is the user's primary device; they can handle more on screen.
- Reference Chinese app design — Xiaohongshu, Douyin, WeChat — for density and feature
  exposure.

## Mobile-first checks

- Design at **390×844** first; verify at **430×932**.
- Every interactive element must be reachable with one thumb.
- Test landscape only if the game uses it deliberately.
- Safe areas: respect `env(safe-area-inset-*)` for notches and home indicators.

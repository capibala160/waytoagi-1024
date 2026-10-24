# Typography Rules — Mobile Web

Adapted from the SpectraSort iOS rules. The units change (CSS pixels instead of iOS
points) but the readability test does not.

## The 50+ Readability Test (apply BEFORE shipping any screen)

1. **Body legibility** — Can a 55-year-old read it at arm's length without squinting?
   → body text ≥ 16px
2. **Tap-target legibility** — Tap targets ≥ 44×44px **and** label ≥ 13px
3. **Hierarchy** — primary > secondary > tertiary differ by ≥ 3px (never less)

If any answer is "no", **bump the size**. Do NOT reduce contrast or lean on color to
compensate.

## The Balance Rule

Type sizes are a **system**, not a list. When one element grows, the neighbors grow
proportionally.

- Bigger primary button → bigger title above it → bigger supporting body
- Bigger title → bigger supporting subtitle, **ratio ≈ 1.3 : 1** between adjacent
  levels (never 2 : 1)
- A row's icon, title, subtitle, and chevron grow together. They are one unit.

## Baseline Sizes (floor, not ceiling)

| Role | Size |
|---|---|
| Display / hero | 32–48px |
| Screen title | 24–28px |
| Section heading | 20px |
| Body / row title | 16–17px |
| Row subtitle / supporting | 14px |
| Eyebrow / caps tracking | 11–12px |
| Footnote / fine print | 12px |
| Mono counter (score, timer) | 13px minimum |

## Tap Targets (hard floor)

- 44 × 44px minimum touch area — non-negotiable on phones
- Icon-only buttons: glyph ≥ 17px so the mark fills the target
- Space adjacent targets at least 8px apart

## Banned Patterns

- ❌ Tap labels under 13px
- ❌ Gray-on-colored secondary text under 13px (contrast + size both fail)
- ❌ Mono digit counters under 13px
- ❌ "It looks fine on my phone" — always test the smallest and largest common widths
- ❌ Bumping one element in isolation (breaks balance)
- ❌ Body text that needs pinch-to-zoom on a 390px-wide screen

## The Drill-In Sentence

> **Treat 16px as the body baseline. Don't go below 13px for anything tappable.
> Grow neighbors together.**

## Workflow Before Any Type Change

1. Re-read this file.
2. Identify every neighbor in the same visual row/group.
3. Apply changes to the **whole group**, not the single element you noticed.
4. Verify at **390×844 (small phone)** and **430×932 (large phone)**, light + dark.
5. Check with browser text zoom at 125% — nothing should clip or overlap.

## Sources

- Apple HIG — Typography and Buttons (44pt rule)
- Material 3 type scale (Body Large = 16px)
- W3C WCAG 2.2 — SC 1.4.4 (resize text), SC 2.5.5 (target size)

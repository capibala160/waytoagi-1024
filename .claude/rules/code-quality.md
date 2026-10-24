# Code Quality Rules

Adapted from SpectraSort's rules; examples are now web/JavaScript instead of Swift.

## Constants Over Hard-Coded Values

### When to Extract Constants

| Scenario | Action | Example |
|----------|--------|---------|
| Value used 2+ times | MUST extract | Strings, dimensions, durations |
| Value has business meaning | Extract with descriptive name | Score weights, timers, limits |
| Value exists in the codebase | REUSE existing (grep first!) | Don't create duplicates |
| Standard CSS value | Inline OK | `border-radius: 12px` for a standard card |
| True one-off | Inline OK with comment | `padding: 8px; /* tight per spec */` |

### Patterns

**Layout and game tuning constants — one module:**
```js
export const GAME = {
  roundSeconds: 60,
  startingLives: 3,
  comboStep: 10,
};
```

**Colors and type — CSS variables, one source of truth:**
```css
:root {
  --bg: #101014;
  --surface: #1a1a22;
  --text: #f2f2f5;
  --accent: #ff5c39;
  --radius-card: 12px;
  --space-unit: 8px;
}
```

**Timing — named constants:**
```js
const ANIM = { tapMs: 120, transitionMs: 240, shakeMs: 320 };
```

### Checklist Before Writing Code

1. Grep for an existing constant or CSS variable.
2. If it exists → reuse it.
3. If it doesn't → create it in the shared constants/variables file, with a clear name.
4. Never inline a raw color (`#ff5c39`) in a component — use the variable.

### Anti-Patterns

```js
// ❌ Repeated magic number
setTimeout(fade, 240);
setTimeout(slide, 240);            // should be ANIM.transitionMs

// ❌ Unnamed color
element.style.background = '#ff5c39';

// ❌ Hard-coded viewport width
if (window.innerWidth < 393) ...    // use a breakpoint constant

// ❌ String literal used in several places
showToast('Game over');
showBanner('Game over');            // should be Strings.gameOver
```

### Acceptable Inline Values

- `opacity: 0.5` — self-documenting
- `z-index: 1` in a tiny local stacking context
- A one-off offset for a specific shadow

## No Stub Actions

Empty or comment-only handlers on user-facing controls are commit blockers. They
render correctly, so only a real tap catches them.

```js
// ❌ button.addEventListener('click', () => {});
// ❌ button.addEventListener('click', () => { /* wire up later */ });
```

Wire it before commit, or annotate a legitimate no-op with
`// EXPECTED_STUB: <reason>` directly above it.

## Related Files

- `.claude/rules/typography.md` — type scale and tap targets
- `.claude/rules/design-workflow.md` — mockup workflow

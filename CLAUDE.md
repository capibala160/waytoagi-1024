# Hackathon Project — Mobile Web App / Game

Mike is a non-coder PM. Apply the `explaining-in-plain-words` skill to every reply:
name each technical thing and say what it is in one plain clause.

## Rules and skills in this folder

- `.claude/rules/typography.md` — type sizes and tap targets. Read before any UI change.
- `.claude/rules/design-workflow.md` — HTML mockups, dark mode default, density, mobile-first.
- `.claude/rules/writing-tone.md` — voice and microcopy.
- `.claude/rules/code-quality.md` — constants, CSS variables, no stub actions.
- `.claude/skills/commit-and-push/SKILL.md` — commit and push autonomously when green,
  then show the boxed report.

Slash command: `/spec <feature>` writes requirements, design, and tasks to `specs/`.

## Hard rules

- **File edits go through Edit/Write tools.** No `sed -i`, no `awk`/`perl -pi` rewrites.
  Read-only shell inspection (`grep`, `head`, `sed -n`) is fine.
- **No stub actions.** Every visible button does something, or carries
  `// EXPECTED_STUB: <reason>` directly above it.
- **No secrets in chat.** Redact API keys and tokens when reading config; never print
  a full key.
- **Design recommendations are HTML mockups**, dark mode by default, each with a
  light/dark switch.
- **Test mobile-first.** 390×844 and 430×932; touch targets ≥ 44×44px.
- **Commit and push autonomously** when the work is green, and show the boxed report.
- **Verify before claiming done.** Run the app/tests and report the actual result.

## Stack

- **Static HTML/CSS/JS, no build step.** Serve the repo and open `/v2/`; the root `/` redirects to v2, and the old root app is kept at `/legacy.html` for rollback.
- **v2 is the main entry**: `v2/index.html`, `v2/game.js`, `v2/theme.css`, `v2/game.css`, `v2/assets/`.
- **Compass**: v2 uses the layered kit assets in `v2/assets/compass/`; `compass-kit/demo.html` is embedded as the in-app “罗盘校准” page. The old iframe full-screen compass only exists in the legacy root app.
- **Location data**: `v2/destinations.js` / `v2/destinations-city.js`; declare `datum`, convert GCJ-02 to WGS-84 in `v2/game.js`, and keep `entrance` honest.
- **Local check**: `py -3 -m http.server 8081` → `http://127.0.0.1:8081/v2/`; test 390×844 and 430×932, light/dark, and the real-travel GPS states.

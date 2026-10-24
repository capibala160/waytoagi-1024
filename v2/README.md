# 犟针 v2 · 高分辨率版

This is the high-resolution visual pass. It is a separate folder; the root app is untouched.

Open on a phone: `https://capibala160.github.io/waytoagi-1024/v2/`

## What this version is

- Same product flow: **今天去哪 → 搜地点 → 确认 → 怎么走 → 罗盘 → 到达 → 日记／抵达证明**.
- New visual system: ink background by default, warm paper cards, one brass primary button per screen, light/dark switch in the top right.
- The compass uses the generated high-resolution plate, needle, glass, and sheen from `compass-kit/assets/web/`. The layered renderer is the existing CSS transform engine; the canvas fallback remains available with `?engine=canvas`.
- Game entry points are kept: the **游戏** tab opens the venue hunt hub, and both hunt cards still start the existing game flow.
- **Latest gameplay ported (2026-10-24):** brief, pause/resume, stamp progress, end loop, GPS retry, arrival observation, final fragment assembly. The v2 visual shell now runs the same engine features as the root app, minus the root iframe full-screen compass button.
- **Location trust (2026-10-24):** destination data is GCJ-02 (Amap/Tencent) and is converted to WGS-84 before distance/bearing. Arrival requires accuracy ≤ 50 m, sample age ≤ 15 s, three consecutive samples, and then the user taps “我到了”. Failed/stale/weak GPS states take priority over the “follow the needle” hint. Hiding the page stops the GPS watch and it restarts on return. Real mode no longer auto-switches to a draggable compass.
- **Compass lab (2026-10-24):** real mode has a “罗盘校准” entry that embeds `../compass-kit/demo.html` with the current theme/heading/target. The demo header and width controls are hidden in lab mode. The in-game compass itself already uses the same kit layers (`v2/assets/compass`).

## What changed from the reference notes

| Area | Change |
|---|---|
| 探索首页 | Brand shrunk to a 42px seal + wordmark. Search and three destination cards are above the fold. Recent trips, companion, and journey log moved below. |
| 搜索结果 | Results sit directly under the search box with name and one-line description. Empty state explains the preset-place limit and offers three recommendations. Shortcuts hide while searching. |
| 目的地确认 | Paper destination ticket with name, description, public-place tags, and a fixed bottom “去这里”. No “步行可达” promise before location. |
| 怎么走 | Simulation and real city are two distinct cards. Simulation is marked “推荐第一次” and states the permission difference. |
| 游戏首页 | Same top structure and mode switch as explore. Two cards show station count, duration, and scenario; engine notes removed. |
| 真实出行罗盘 | Destination, exit, location status, and recovery button stay above the compass. Bottom actions are “问了个人 / 我到了”. |
| 雾城模拟 | Marked “模拟”; street name, destination, target bearing, four-way pad, and a first-run line. Azhen and the bearing placeholder stay out of the way. |
| 结果页 | Destination, time, asks, story, and actions come before the share-card preview. |
| 旅伴铸造 | Three tappable example lines above the input; “带它出发” is the primary action; character cards keep a selected state. |
| 旅程记录 | Each row shows date, mode, time, score, and the run’s main extra stat. Empty state has “开始第一段旅程”. |
| 日记 | Timeline → photos → one line → preview. Photos can be replaced or deleted. Text autosaves locally. |
| 抵达证明 | Full preview first, then save and share actions. Direct share uses the system share sheet when the phone supports it. |

## Local check

```bash
python3 -m http.server 8000
# http://localhost:8000/v2/
```

Design QA shortcuts (not user-facing):

- `?preview=confirm|how|modes|play|end|forge|journeys|diary|code`
- `?theme=light`
- `?still=1` disables the screen fade for screenshots
- `?engine=canvas` falls back to the old canvas compass

## Files

- `index.html` — new structure, all existing element IDs preserved
- `theme.css` — new design layer, loaded after `base.css`
- `base.css` — the original stylesheet, kept for behaviour and game screens
- `game.js` / `companion.js` — copied engine with the v2 hooks
- `assets/compass/` — high-resolution compass layers from `compass-kit`

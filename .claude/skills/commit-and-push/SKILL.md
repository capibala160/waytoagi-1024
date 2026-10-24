---
name: commit-and-push
description: Commit and push finished work without being asked, then show what landed in a boxed block. Use at the end of any coding session, and whenever work reaches a green state (app runs, tests pass, nothing half-written). Also use when the user asks to commit or push.
---

# Commit and push

Mike's standing instruction (2026-10-21): *"always judge for urself when to commit +
push when done w coding session."* Uncommitted work is the fragile state. Save it without
being asked — but make it visible.

## When to commit on my own

All of these must hold:

- The change is **finished**: the app runs, tests pass, no half-written edit.
- The change is **coherent** — one commit should tell one story. Split unrelated work.
- **No secrets**: no `.env`, API keys, tokens, credentials, or private URLs.
- **No junk**: `node_modules/`, `dist/`, `build/`, `.DS_Store`, logs, editor droppings.
- Not mid-refactor of something that does not run.

If only *some* of the work is ready, commit that part and leave the rest — do not wait.

## If the folder is not a git repo yet

Say so and ask before running `git init`. Do not create a repo silently.

## How to commit

```bash
git status --porcelain                 # look before you stage
git add -u                             # tracked modifications
git add <explicit paths>               # new files, named one by one
git diff --cached --stat               # confirm what is actually going in
```

Message: subject line ≤ 72 chars, imperative, no emoji; body in short bullets explaining
what and why. Match the repo's existing style. End with the required attribution line:

```
Co-Authored-By: Claude Code <noreply@anthropic.com>
```

## Then push

```bash
git push origin <current-branch>
```

If there is no remote yet, stop after the commit and say so in the box.

## Show it — always, in a box

Every commit/push I initiate gets a boxed block in the reply, immediately after it happens.
Mike asked to see it *"super clear with an area of boxed text"*. Use a fenced code block
with a drawn border so the terminal renders it as one panel:

```
╭──────────────────────────────────────────────────────────────╮
│  COMMIT + PUSH                          (Claude-initiated)   │
├──────────────────────────────────────────────────────────────┤
│  branch   main                                               │
│  commit   6f15174e                                           │
│  subject  level 3: combo meter + hit feedback                │
│  changed  12 files   (+840 / −120)                           │
│  push     origin/main  ✅  657cfd71 → 6f15174e               │
╰──────────────────────────────────────────────────────────────╯
```

Rules for the box:
- One box per commit. Label it `(Claude-initiated)` or `(you asked)`.
- If the push failed or was skipped, say so **in the box** — never a green tick that isn't real.
- Keep it to the facts above; the prose around it stays short.

## What not to do

- Do not amend, rebase, force-push or revert a commit Mike made.
- Do not commit unrelated junk just to get a clean `git status`.
- Do not push a red build to hide a failure; fix or report it.

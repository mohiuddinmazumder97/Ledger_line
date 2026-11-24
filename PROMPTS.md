# Prompts to paste into Claude Code

Run `claude` from the repo root. Paste one prompt per session; review, commit, then `/clear` and paste the next one.
Tip: press Shift+Tab to enter plan mode before pasting, approve the plan, then let it build.

---

## Kickoff (once, before Phase 0)

```
Read CLAUDE.md, docs/SPEC.md, docs/DESIGN.md and skim docs/design/ledgerline-prototype.dc.html.
Don't write code yet. Tell me:
1) anything in the spec that is ambiguous or contradicts the prototype,
2) any stack choices in CLAUDE.md you would push back on and why,
3) the risks you see in the phase plan in docs/phases/.
Keep it under 40 lines.
```

## Each phase (replace NN with 00, 01 … 06, 07a, 07b, 08, 09)

```
We are working on Ledgerline. Read CLAUDE.md, docs/PROGRESS.md and docs/phases/phase-NN-*.md.
Implement that phase only.
First show me a short plan (files to create/change, key decisions). Wait for my OK.
Then build it, run `pnpm lint && pnpm typecheck && pnpm test` until green,
update docs/PROGRESS.md, and give me a commit message. Do not start the next phase.
```

## After a phase — review pass (optional, fresh session)

```
Review the changes in the last commit against CLAUDE.md rules and docs/phases/phase-NN-*.md.
Look for: money handled as floats, queries missing userId scoping, server state in Zustand,
hand-written fetch calls, UI that drifts from docs/design/ledgerline-prototype.dc.html,
missing tests. List findings by severity, then fix the important ones.
```

## When the UI drifts from the design

```
Compare <route> with the matching section of docs/design/ledgerline-prototype.dc.html
(markup + renderVals()). List every difference in spacing, font size, copy, colors and
behaviour, then fix them. Check both light and dark themes.
```

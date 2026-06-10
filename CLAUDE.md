# the gitcoin brain UI — agent notes

A reading-room surface over the Gitcoin team's shared Parachute vault
(hub: `gitcoin-parachute.unforced.dev`, vault `default`). See README.md for the map.

Conventions:

- **Keep it simple.** Lean SPA: no proposals/weave UI yet, no offline outbox.
  Add views only when the vault grows a real need.
- **surface-client + surface-render are the way** — don't hand-roll REST fetch
  or markdown/wikilink rendering. The auth resilience shims in
  `src/vault/surface.ts` (client_id seeding, single-flight refresh) work around
  surface-client 0.2.0 gaps; check whether newer versions fix them first.
- **No model layer.** Views read `note.metadata` via `lib/domain.ts` helpers;
  `summaryOf()` falls back to the note preview because meetings/decisions don't
  carry a `summary` metadata field yet (the importers could add one).
- **Style lives in one file** (`src/styles.css`), tokens at the top — warm
  paper, deep teal, weathered gold. Fraunces / Newsreader / JetBrains Mono.
- The vault is fed by scripts in `../scripts/` (build_team_vault, import_meetings,
  weave_meetings). This UI is read-only; no writes from here yet.
- Verify with `npm run build` (tsc + vite) before calling work done.

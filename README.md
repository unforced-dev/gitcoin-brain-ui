# the gitcoin brain — UI

A reading-room surface over the **Gitcoin team's shared Parachute brain**
(`gitcoin-parachute.unforced.dev`, vault `default`). Read-first: today, the
initiatives, the meetings (with verbatim transcripts), the decisions, and the
people graph.

This is the v2 UI — a lean React SPA on the published `@openparachute/surface-*`
packages, replacing the hand-rolled vanilla `brain_ui`. Same vault, real
entity-typed views, the same OAuth (DCR + PKCE) sign-in.

## Stack

- React 19 + Vite + TypeScript, React Router
- `@openparachute/surface-client` — OAuth against the Parachute hub + the one
  resilient `VaultClient` (cold-load client_id seeding + single-flight refresh,
  pattern from parachute-brain / games-coop)
- `@openparachute/surface-render` — `NoteRenderer` for markdown, wikilinks,
  auth'd media

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc + production build to dist/
```

Sign in via **Sign in to the vault** — OAuth goes through the hub
(`gitcoin-parachute.unforced.dev`) and back to `/oauth/callback`.

## Views

`Today` · `Initiatives` · `Meetings` · `Decisions` · `People` · `NoteView` —
plus `Connect` / `OAuthCallback`. The brain's spine these read:

- `initiative` — what's being built (status, contributors, summary).
- `meeting` (`held_on`, `participants`, `platform`); the verbatim is at
  `meetings/<date>_<slug>/transcript` (`transcript`).
- `decision` (`held_on`, `decided_by`, `decision_count`/`action_count`) — woven
  from the meetings, linked back to their source call + the owners' people.
- `person` — the stakeholder graph (`kevin/people/*`); meeting participants link
  here.
- `report` — Kevin's daily briefs (the source flow under `kevin/`).

The graph is the point: meetings ↔ people ↔ initiatives are linked, so a note's
wikilinks navigate the whole web.

## Deploy

GitHub Pages project site at `/gitcoin-brain-ui/` (see `vite.config.ts` base +
`public/404.html` SPA fallback). The included Action builds + publishes `dist/`
on push to `main`; set **Settings → Pages → Source: GitHub Actions**.

The primary interface is each teammate's own Claude over MCP — this UI is the
browse + steering surface, not the only way in.

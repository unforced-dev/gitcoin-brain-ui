# gitcoin-brain-ui

A reading-room interface for the Gitcoin team's working knowledge base.

This is a static single-page web app that talks to a [parachute-vault](https://parachute.computer) instance over its REST + MCP surfaces. It's the team's primary way to browse, search, and stay on top of what's in the brain.

## Live

Hosted at **https://unforced-dev.github.io/gitcoin-brain-ui/** (once Pages is up).

The vault itself lives behind a separate URL — set when you link it.

## Connecting

First visit: paste your vault URL + token. Both stay in your browser via localStorage; they never leave the page.

Once the multi-user flow lands in Parachute, the connection step becomes a real "Link your vault" OAuth flow. The token-paste mode persists as a developer fallback.

## What's inside the brain right now

- **Strategic Anchors** — Kevin's voice rules, strategic insights, telos
- **Recent Owocki** — May 2026 rebuild.how artifacts
- **Daily Reports** — derived nightly from the source mirror
- **Drafts** — content in progress
- **People** — Gitcoin-relevant stakeholders
- **Monthly Rollups**
- **Governance** — gov.gitcoin.co Discourse threads
- **Giveth + How-To** — small auxiliary collections

Plus team-derived content (tweet drafts, KPI rollups, etc.) once those derives land.

## Stack

Pure vanilla — single `index.html`, `style.css`, `main.js`. No framework. Uses `marked.js` (CDN) for note body rendering. Aesthetic: editorial/library, warm cream + weathered gold, Cormorant Garamond italic display + Spectral body.

Hash-based routing. No server-side anything; this is a static reading layer on top of the vault REST API.

## Local dev

```sh
git clone git@github.com:unforced-dev/gitcoin-brain-ui.git
cd gitcoin-brain-ui
python3 -m http.server 8000
# open http://localhost:8000
```

For talking to a local vault: parachute-vault on `http://127.0.0.1:1940` is the default URL the modal suggests.

## License

MIT

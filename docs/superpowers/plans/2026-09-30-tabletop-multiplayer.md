# Tabletop Multiplayer Implementation Plan

> **For agentic workers:** Execute task-by-task in this session. The user authorized implementation; no additional plan approval is needed.

**Goal:** Implement the approved balance proposal as a tactile, responsive board game with server-authoritative room-code multiplayer.

**Architecture:** Share a pure rules module between the server and UI previews. Node HTTP commands and SSE snapshots synchronize rooms; clients never submit dice or replacement game states. Reuse existing survivor artwork and retain old prototype source for reference.

**Tech Stack:** Existing React 18 / Vite 5, Node built-ins, CSS. No additional runtime dependencies.

**Spec:** Approved proposal in this conversation, codified in `docs/tabletop-rules.md`.

## Global Constraints
- Two actions; optional maintenance meals; fixed public clues; deterministic utopia arrival; 8-round limit.
- Room codes, separate seats, reconnection, 2–4 humans, solo practice with bots.
- Light paper board, illustrated cards, resources as tokens, phone and desktop layouts.
- Preserve existing working-tree changes in legacy modules and design source files.

## Review Focus
- Out-of-turn, forged dice, duplicate requests and stale state must not mutate games.
- Disconnect/reconnect must preserve seats without revealing credentials or deck order.
- Failed challenges must consume actions but never strand a party permanently.
- Final turns and the round cap must always produce complete score standings.
- Mobile controls, keyboard dialogs and reduced motion must remain usable.

## Tasks
- [x] Implement balanced data and pure rules; check dispatch, economy, ability limits, final scoring and bots with Node assertions.
- [x] Implement room HTTP/SSE API, scoped seat tokens, revision checks, cleanup and production static server; run two-client integration checks.
- [x] Implement lobby, paper board, card selection, recruitment, maintenance, dice results and scoring; reuse local art.
- [x] Build; inspect desktop and phone in browser; exercise two independent players, reconnect and full game completion.
- [x] Document final rules and LAN / hosted deployment commands and limitations.

## Acceptance evidence
- `npm test`: 9/9, including 100 seeded complete games and HTTP/SSE authorization checks.
- `npm run build`: passed.
- `tests/tabletop-ui.mjs`: passed on port 5173; canonical 160×290 card fronts, 9 physical piles, opponent cards, on-table dispatch, gathering, meals, recruitment, bot turns, reconnection, 390px viewport.
- Production Node server: built HTML, health endpoint and room creation verified.
- Render and Docker configuration prepared; actual public deployment and Docker image build remain external setup steps.
- User references guide physical presentation only; game layout and card rules remain project-specific.

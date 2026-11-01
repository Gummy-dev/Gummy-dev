# Original Tabletop Restoration Implementation Plan

**Goal:** Restore the existing gameStore/data/components design, preserving online rooms and physical-table interaction.

**Architecture:** Reuse the existing rules store per server room. Send validated actions and masked snapshots through the existing HTTP/SSE service. Reuse original layout and play flows with aligned exploration/search columns; retain the immediately preceding bright physical-card faces.

**Tech Stack:** Existing React, Zustand, Vite, Node. No dependencies added.

## Confirmed scope
- User confirmed full previous rules and abilities, not just layout.
- Search is one slot per tier; only tier 1 initially revealed.
- Shared reveals and individual access remain original rules.
- Click then confirm is an original feature to preserve.
- Keep multiplayer, light physical cards, pan/zoom, visible opponent cards.
- Latest visual correction: restore only the previous placement/composition; card shape and visual treatment use the immediately preceding 160×290 tabletop design.
- No support-contract/personality/other speculative review proposals.

## Tasks
- [x] Reuse original store as isolated room engine, validate commands, hide decks, roll on server.
- [x] Bridge authoritative state to original components, retaining distinct seat identity.
- [x] Use identical bright tabletop survivor fronts with original rule text and costs; external action controls.
- [x] Align exploration/search at tiers 3/2/1; move table actions to side; preserve board movement.
- [x] Verify original reveal/access, search, recruit, meal, assignment/confirm, turn advancement, multiplayer auth/reconnect, browser layout; build.
- [x] Document restored source of truth and any remaining limits.

## Verification
- `npm test`: 16 passed, including 7 restored-engine tests. The other 9 cover the earlier engine/service; their bot simulations are not evidence of restored-rule balance.
- `tests/tabletop-ui.mjs`: two actual browser seats, recruit/meal/turns/card-first selection, opponent fronts, aligned exploration/search, mobile side panel, reconnect passed.
- All 36 survivor fronts checked for copy/footer overlap; none remain. Blank-board pan and external exploration confirmation checked in browser.
- `npm run build`: passed; existing bundle-size and Browserslist-age warnings remain.
- Production Node server: built HTML/assets entry, health endpoint, and original-v2 room creation passed. Docker image and public hosting were not deployed during this restoration.
- Rules and source-of-truth notes: `docs/tabletop-rules.md`; deployment method: `docs/tabletop-deployment.md`.

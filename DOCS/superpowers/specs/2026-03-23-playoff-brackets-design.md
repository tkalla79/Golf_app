# Play-off Brackets — Design Spec

**Date:** 2026-03-23
**Status:** Approved
**Scope:** Drabinki play-off (single elimination) dla 48 graczy w 3 bracketach

---

## Context

Liga Don Papa Match Play 2026, Karolinka Golf Park. Po 4 rundach grupowych (round-robin) 48 graczy przechodzi do fazy play-off w 3 drabinkach eliminacyjnych. Aplikacja musi obsłużyć tworzenie drabinek, seedowanie graczy, wprowadzanie wyników i automatyczne generowanie meczów kolejnych rund. Frontend wyświetla klasyczną wizualizację drabinki (bracket diagram).

**Produkcja:** donpapagolf.pl
**Stack:** Next.js 16 (App Router) + Prisma 6 + MySQL 8 + Tailwind CSS
**Branding:** #134a56 primary, #d5b665 accent, Raleway + Lato fonts

---

## Format play-off (z regulaminu 2026)

### 3 drabinki single elimination

**Drabinka 1-16** (18 dołków):
- Górna połowa: 1v16, 8v9, 4v13, 5v12
- Dolna połowa: 2v15, 7v10, 3v14, 6v11

**Drabinka 17-32** (9 lub 18 dołków, do wyboru graczy):
- Górna połowa: 17v32, 24v25, 20v29, 21v28
- Dolna połowa: 18v31, 23v26, 19v30, 22v27

**Drabinka 33-48** (9 dołków):
- Górna połowa: 33v48, 40v41, 36v45, 37v44
- Dolna połowa: 34v47, 39v42, 35v46, 38v43

### Rundy play-off
- 1/8 finału: do 06.09.2026
- Ćwierćfinały: do 25.09.2026
- Półfinały: do 11.10.2026
- Finały: do 31.10.2026

### Zasady
- Remisy: nagła śmierć od dołka nr 1
- Walkover: Zarząd Ligi przyznaje na podstawie zaangażowania graczy i pozycji w fazie grupowej
- Nagrody: miejsca 1-12 (drabinka 1), 17-20 (drabinka 2), 33 (drabinka 3)
- Pozycje przegranych wynikają z etapu eliminacji (bez dodatkowych meczów o miejsca, z wyjątkiem finału rekomendowanego jako jednoczesne mecze o miejsca 1-4)

---

## Architecture Decision: Reuse existing schema

**Chosen approach:** Reuse `Round` (type: PLAYOFF) + `Group` (as bracket) + `Match` with 2 new fields.

**Why reuse:**
- Minimal schema changes (2 nullable fields on Match)
- Existing scoring/results UI works unchanged
- Admin match result entry is identical
- No new tables, no data migration

**New fields on Match model:**
```prisma
bracketRound    Int?     @map("bracket_round")    // 1=1/8, 2=QF, 3=SF, 4=F
bracketPosition Int?     @map("bracket_position") // 1-8 for 1/8, 1-4 for QF, etc.
```

These fields are null for group-stage matches, populated only for playoff matches. This cleanly separates playoff from group logic without changing existing behavior.

---

## Data Model

### How playoff maps to existing schema

```
Season (status: ACTIVE)
  └── Round (type: PLAYOFF, name: "Play-off", status: ACTIVE)
       ├── Group (name: "Drabinka 1-16", sortOrder: 0)
       │    ├── GroupPlayer (16 players, with hcpAtStart, finalPosition = seeding 1-16)
       │    └── Match[] (bracketRound: 1-4, bracketPosition: 1-N)
       ├── Group (name: "Drabinka 17-32", sortOrder: 1)
       │    ├── GroupPlayer (16 players, finalPosition = seeding 17-32)
       │    └── Match[]
       └── Group (name: "Drabinka 33-48", sortOrder: 2)
            ├── GroupPlayer (16 players, finalPosition = seeding 33-48)
            └── Match[]
```

### Seeding algorithm

Global ranking is built from final group-stage positions across all groups in the most recent completed ROUND_ROBIN round (typically Round 4):

1. Position 1 players from all groups (5 players, sorted by BP desc → SP desc → HCP desc)
2. Position 2 players from all groups (5 players, same sort)
3. ... through position 10
4. Result: ordered list of 50 players, positions 1-50

**Important:** This cross-group ranking does NOT use the head-to-head tiebreaker from `standings.ts`, because players from different groups never played each other. The sort is purely: BP desc → SP desc → HCP desc (higher HCP = higher position per regulamin). If still tied, the admin resolves manually (losowanie per regulamin).

**Data source:** `GroupPlayer.finalPosition` from the last ROUND_ROBIN round determines intra-group position. BP and SP are summed from that round's matches only.

Players 1-16 → Drabinka 1-16
Players 17-32 → Drabinka 17-32
Players 33-48 → Drabinka 33-48
Players 49-50 → not in playoff

### Match tree structure

For each bracket (16 players), 15 matches total:
- bracketRound=1: 8 matches (1/8 finału)
- bracketRound=2: 4 matches (ćwierćfinał)
- bracketRound=3: 2 matches (półfinał)
- bracketRound=4: 1 match (finał)

Match connections (which winners feed into which next match):
- bracketPosition is 1-indexed within each round
- Match at (round=R, position=P) feeds into match at (round=R+1, position=ceil(P/2))
- Top slot vs bottom slot: odd bracketPosition → player1 (top), even → player2 (bottom)

Example for Drabinka 1-16:
```
Round 1 (1/8):
  pos 1: 1 vs 16  ─┐
  pos 2: 8 vs  9  ─┤─ Round 2 pos 1 (winner1 vs winner2)
  pos 3: 4 vs 13  ─┐
  pos 4: 5 vs 12  ─┤─ Round 2 pos 2 (winner3 vs winner4)
  pos 5: 2 vs 15  ─┐
  pos 6: 7 vs 10  ─┤─ Round 2 pos 3 (winner5 vs winner6)
  pos 7: 3 vs 14  ─┐
  pos 8: 6 vs 11  ─┤─ Round 2 pos 4 (winner7 vs winner8)

Round 2 (QF):
  pos 1: W(1,1) vs W(1,2) ─┐
  pos 2: W(1,3) vs W(1,4) ─┤─ Round 3 pos 1
  pos 3: W(1,5) vs W(1,6) ─┐
  pos 4: W(1,7) vs W(1,8) ─┤─ Round 3 pos 2

Round 3 (SF):
  pos 1: W(2,1) vs W(2,2) ─┐
  pos 2: W(2,3) vs W(2,4) ─┤─ Round 4 pos 1

Round 4 (Final):
  pos 1: W(3,1) vs W(3,2) → CHAMPION
```

### Seeding pairing arrays (from regulamin)

```typescript
const BRACKET_SEEDS: Record<string, [number, number][]> = {
  '1-16': [
    [1, 16], [8, 9],   // upper half, feed into QF1
    [4, 13], [5, 12],  // upper half, feed into QF2
    [2, 15], [7, 10],  // lower half, feed into QF3
    [3, 14], [6, 11],  // lower half, feed into QF4
  ],
  '17-32': [
    [17, 32], [24, 25],
    [20, 29], [21, 28],
    [18, 31], [23, 26],
    [19, 30], [22, 27],
  ],
  '33-48': [
    [33, 48], [40, 41],
    [36, 45], [37, 44],
    [34, 47], [39, 42],
    [35, 46], [38, 43],
  ],
}
```

---

## Auto-advance: generating next-round matches

When a match result is saved and both "parent" matches of the next round are decided, the system automatically creates the next-round match:

```
On match result save:
  1. Save result (winnerId, resultCode, etc.) — same as group stage
  2. Determine the next match: nextRound = bracketRound + 1, nextPosition = ceil(bracketPosition / 2)
  3. Check if sibling match (same nextRound, same nextPosition) is also played
     - Sibling position: if bracketPosition is odd → sibling is bracketPosition + 1, else bracketPosition - 1
  4. If sibling is played:
     - Find or create match at (nextRound, nextPosition)
     - Set player1 = winner of odd-position match, player2 = winner of even-position match
  5. If sibling is not played: do nothing (wait)
```

Important: `Match.player1Id` and `player2Id` are non-nullable `Int`, so we cannot pre-create matches without players.

**Approach:** Only create Round 1 matches at playoff creation (8 matches per bracket = 24 total). Create next-round matches on-the-fly when both feeder matches have results.

**Frontend data contract:** The server computes a full 15-slot bracket array per group by merging real Match records with computed placeholder objects:

```typescript
interface BracketSlot {
  bracketRound: number       // 1-4
  bracketPosition: number    // 1-N within round
  match: Match | null        // real Match record if exists, null if TBD
  player1Name: string | null // resolved player name or null
  player2Name: string | null
  player1Slug: string | null
  player2Slug: string | null
  winnerId: number | null
  resultCode: string | null
  played: boolean
  deadline: string           // "do 06.09" etc.
}
```

The server builds this array by:
1. Fetching all matches for the bracket group where `bracketRound IS NOT NULL`
2. For each of 15 expected slots (8+4+2+1), finding the matching record or returning a placeholder with null match
3. For placeholder slots, resolving player names from feeder match winners when available

This keeps the client component simple — it just renders the array.

**Result deletion for playoff matches:**
When a playoff match result is cleared (DELETE on result route):
1. Check if any downstream match was created from this match's winner
2. If yes: also delete the downstream match (cascade up the bracket)
3. This prevents orphaned matches with stale player assignments
4. Implementation: recursive deletion up to the final

**Walkover handling:** Walkovers set `winnerId` + `played=true`, so auto-advance triggers normally. No special handling needed.

**Scoring in playoff:** Skip `computePoints()` for playoff matches — set all BigPoints/SmallPoints to 0. Playoff is elimination, not standings. Check `match.group.round.type === 'PLAYOFF'` before calling scoring.

---

## Admin Flow

### New page: `/admin/playoff`

**State 1: No playoff exists yet**
- Show button: "Utwórz drabinki play-off"
- Button enabled only when: season has ≥4 completed rounds of type ROUND_ROBIN

**State 2: Seeding preview**
After clicking "Utwórz":
1. System computes global ranking from Round 4 final positions
2. Shows 3 bracket previews with player names and seeds
3. Admin can optionally swap players (dropdown to override seeding)
4. Button: "Zatwierdź i utwórz mecze"

**State 3: Playoff active**
- Shows 3 bracket tabs with current state
- Links to individual bracket group pages (`/admin/grupa/[id]`) for result entry
- Existing result entry UI works unchanged (Match card → enter result)

### Result entry for playoff matches
Uses existing `/admin/grupa/[id]` page. No changes needed — admin clicks on a match, enters resultCode + winnerId. The only addition: after saving, auto-advance logic creates next-round match if both feeders are decided.

---

## Public Frontend

### New page: `/playoff`

**Layout:** 3 tabs (one per bracket), each showing a classic tournament bracket diagram.

**Bracket diagram:**
- 4 columns: 1/8 Finału → Ćwierćfinał → Półfinał → Finał
- Each match is a card with 2 player slots
- Played matches: winner highlighted (bold, primary color), loser dimmed/struck
- Score shown next to winner (e.g., "3&2", "1Up")
- Unplayed matches: both names shown, muted style, deadline shown below
- Future matches (no players yet): "Zwycięzca M1" placeholder
- Champion card with trophy emoji under Final
- Connector lines between match cards (CSS borders)

**Responsive:** Horizontal scroll on mobile, full layout on desktop.

**Navigation:** Add "Play-off" link to public navbar (visible when playoff round exists).

### Component structure
```
/playoff/page.tsx (server component)
  └── PlayoffBracket (client component — handles tab state)
       └── BracketView (renders one bracket's 4 rounds)
            └── MatchCard (single match with 2 players)
```

---

## Schema Changes

### Prisma migration

```prisma
model Match {
  // ... existing fields unchanged ...
  bracketRound    Int?     @map("bracket_round")
  bracketPosition Int?     @map("bracket_position")
}
```

This is a non-destructive migration — 2 nullable columns added, no data loss.

### Per-bracket hole count

The `holes` field exists on the `Round` model, but brackets have different hole counts (18, 9/18, 9). Store hole count per bracket in the `Group.config` JSON field (add `config Json?` to Group if not present, but Group doesn't have config — so use the Round's `config` JSON):

**Decision:** Store bracket hole counts in Round `config` JSON:
```json
{
  "bracketHoles": {
    "1-16": 18,
    "17-32": 9,
    "33-48": 9
  }
}
```
The `17-32` bracket defaults to 9 but admin can override to 18 for specific matches. This avoids schema changes beyond the 2 Match fields.

### 18-hole result codes

For 18-hole matches (Bracket 1-16), additional valid result codes beyond the existing 9-hole set:
```
6&5, 6&4, 7&6, 7&5, 8&7, 8&6, 9&8, 9&7, 10&8
```
Add these to `RESULT_CODES` in `scoring.ts` conditionally when displaying for 18-hole brackets, or define a separate `RESULT_CODES_18` array. The result entry UI should show the appropriate code set based on the bracket's hole count.

### Navbar "Play-off" link

The Navbar is a client component with hardcoded links. To add a conditional "Play-off" link:
- Pass `hasPlayoff: boolean` prop from the layout server component to Navbar
- Layout queries: `prisma.round.findFirst({ where: { type: 'PLAYOFF', season: { status: 'ACTIVE' } } })`
- If `hasPlayoff`, show the link in the nav

---

## Error Handling & Edge Cases

- **Fewer than 48 players:** If Round 4 has fewer players (dropouts), create brackets with available players. Missing seeds show as "BYE" and the opponent auto-advances.
- **Duplicate creation:** The "Utwórz" button is disabled when a PLAYOFF round already exists. API route checks for existing PLAYOFF round and returns 409 Conflict.
- **Unbreakable ties in seeding:** If BP, SP, and HCP are all identical, show the tie to the admin in the preview screen and let them manually resolve (swap positions).

---

## New Files

| File | Responsibility |
|------|---------------|
| `src/lib/playoff.ts` | Seeding algorithm, bracket structure constants, auto-advance logic |
| `src/app/(public)/playoff/page.tsx` | Public playoff page (server component, data fetch) |
| `src/components/PlayoffBracket.tsx` | Client component: tabs + bracket rendering |
| `src/components/BracketView.tsx` | Single bracket visualization (4 rounds grid) |
| `src/components/BracketMatchCard.tsx` | Single match card (2 player slots) |
| `src/app/admin/playoff/page.tsx` | Admin playoff creation + management page |
| `src/app/api/admin/playoff/create/route.ts` | API: create playoff round + seed + create R1 matches |
| `src/app/api/admin/playoff/ranking/route.ts` | API: compute and return global ranking preview |

### Modified Files

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `bracketRound`, `bracketPosition` to Match |
| `src/app/api/matches/[id]/result/route.ts` | Add auto-advance after saving; cascade deletion on result clear; skip scoring for PLAYOFF |
| `src/lib/scoring.ts` | Add `RESULT_CODES_18` for 18-hole matches |
| `src/app/(public)/layout.tsx` | Add "Play-off" nav link (conditional on playoff round existing) |
| `src/constants/pl.ts` | Add Polish translations for playoff UI strings |

---

## Implementation Notes (from review)

- **`Tied` result code:** Excluded from playoff — sudden death resolves ties, so Tied is not a valid playoff result.
- **Per-match holes in Bracket 17-32:** Players choose 9 or 18 per match. Store on Match level via `notes` field (e.g., "18 dołków") or add to admin result entry UI. Config stores default, actual can differ.
- **18-hole small_points_map:** Not needed since playoff skips scoring. But result codes still need validation — use a separate `VALID_RESULT_CODES_18` array for UI validation only.
- **DB index:** Add `@@index([groupId, bracketRound, bracketPosition])` on Match for clean queries.

---

## Out of Scope

- Mecze o 3. miejsce (regulamin nie wymaga dodatkowych meczów)
- Edycja/usuwanie drabinki po utworzeniu (admin creates once, results are final)
- Bracket animation/transitions (static rendering, no fancy animations)
- Drabinka 33-48 seeding was missing from original regulamin excerpt — now provided by user

---

## Success Criteria

- [ ] Admin can create playoff from final group-stage rankings
- [ ] Admin can preview seeding before committing
- [ ] 3 brackets created with correct seeding per regulamin
- [ ] Round 1 matches (24 total) created automatically
- [ ] Admin enters results using existing match UI
- [ ] Next-round matches auto-created when both feeders decided
- [ ] Public `/playoff` page shows bracket diagram
- [ ] Bracket shows played results, pending matches, and TBD slots
- [ ] Responsive bracket layout (mobile: horizontal scroll)
- [ ] "Play-off" nav link appears when playoff round exists
- [ ] No changes to existing group-stage functionality

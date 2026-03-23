# Play-off Brackets Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 3 single-elimination playoff brackets (1-16, 17-32, 33-48) with auto-seeding from group stage, auto-advance match generation, and a public bracket visualization page.

**Architecture:** Reuse existing Round (type: PLAYOFF) + Group (as bracket) + Match models. Add 2 nullable fields to Match (`bracketRound`, `bracketPosition`). New `src/lib/playoff.ts` handles seeding algorithm and bracket logic. Auto-advance creates next-round matches when both feeder matches are decided.

**Tech Stack:** Next.js 16 App Router, Prisma 6, MySQL 8, Tailwind CSS, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-23-playoff-brackets-design.md`

---

## File Map

### New files to CREATE

| File | Responsibility |
|------|---------------|
| `src/lib/playoff.ts` | Bracket seeds, ranking algorithm, auto-advance logic, BracketSlot builder |
| `src/app/(public)/playoff/page.tsx` | Public playoff page (server component) |
| `src/components/PlayoffBracket.tsx` | Client component: bracket tabs + rendering |
| `src/components/BracketMatchCard.tsx` | Single match card (2 player slots) |
| `src/app/admin/playoff/page.tsx` | Admin: create playoff + manage brackets |
| `src/app/api/admin/playoff/ranking/route.ts` | API: compute global ranking preview |
| `src/app/api/admin/playoff/create/route.ts` | API: create playoff round + seed matches |

### Files to MODIFY

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `bracketRound Int?`, `bracketPosition Int?`, index on Match |
| `src/lib/scoring.ts` | Add `RESULT_CODES_18` array |
| `src/app/api/matches/[id]/result/route.ts` | Skip scoring for PLAYOFF, auto-advance, cascade delete |
| `src/components/Navbar.tsx` | Add `hasPlayoff` prop, conditional "Play-off" link |
| `src/app/(public)/layout.tsx` | Query playoff existence, pass `hasPlayoff` to Navbar |
| `src/constants/pl.ts` | Add playoff UI strings |

---

## Chunk 1: Schema + Core Logic

### Task 1: Prisma schema migration

**Files:**
- Modify: `prisma/schema.prisma` (Match model, ~line 130-153)

- [ ] **Step 1: Add bracketRound and bracketPosition to Match model**

In `prisma/schema.prisma`, inside the `Match` model, add before the closing brace:

```prisma
  bracketRound    Int?     @map("bracket_round")
  bracketPosition Int?     @map("bracket_position")

  @@index([groupId, bracketRound, bracketPosition])
```

- [ ] **Step 2: Push schema to database**

```bash
cd /tmp/Golf_app && npx prisma db push
```
Expected: Schema synced, no data loss (nullable fields added).

- [ ] **Step 3: Regenerate Prisma client**

```bash
cd /tmp/Golf_app && npx prisma generate
```

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add bracketRound and bracketPosition fields to Match model"
```

---

### Task 2: Add 18-hole result codes to scoring.ts

**Files:**
- Modify: `src/lib/scoring.ts`

- [ ] **Step 1: Add RESULT_CODES_18 after existing RESULT_CODES**

At the end of `src/lib/scoring.ts` (after line 99), add:

```typescript
// 18-hole match play result codes (includes all 9-hole codes plus extended margins)
export const RESULT_CODES_18 = [
  ...RESULT_CODES,
  '6&5',
  '6&4',
  '7&6',
  '7&5',
  '8&7',
  '8&6',
  '9&8',
  '9&7',
  '10&8',
] as const
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/scoring.ts
git commit -m "feat: add 18-hole result codes for playoff matches"
```

---

### Task 3: Add playoff translations

**Files:**
- Modify: `src/constants/pl.ts`

- [ ] **Step 1: Add playoff section to PL object**

In `src/constants/pl.ts`, add after the `round` section (after line 71):

```typescript
  playoff: {
    title: 'Play-off',
    bracket: 'Drabinka',
    bracket116: 'Drabinka 1-16',
    bracket1732: 'Drabinka 17-32',
    bracket3348: 'Drabinka 33-48',
    holes18: '18 dołków',
    holes9: '9 dołków',
    holes918: '9/18 dołków',
    roundOf16: '1/8 Finału',
    quarterFinal: 'Ćwierćfinał',
    semiFinal: 'Półfinał',
    final: 'Finał',
    champion: 'Zwycięzca',
    tbd: 'Oczekuje na wynik',
    deadline: 'do',
    createPlayoff: 'Utwórz drabinki play-off',
    seedingPreview: 'Podgląd rozstawienia',
    confirmCreate: 'Zatwierdź i utwórz mecze',
    globalRanking: 'Ranking końcowy fazy grupowej',
    noPlayoff: 'Play-off nie został jeszcze utworzony.',
    playoffExists: 'Play-off już istnieje.',
    bye: 'BYE',
  },
```

- [ ] **Step 2: Also add playoff to nav section**

Change the `nav` section to include playoff:
```typescript
  nav: {
    groups: 'Grupy',
    players: 'Zawodnicy',
    playoff: 'Play-off',
    admin: 'Admin',
    login: 'Zaloguj się',
    logout: 'Wyloguj',
    dashboard: 'Dashboard',
    managePlayers: 'Zawodnicy',
    manageAdmins: 'Administratorzy',
    manageSeason: 'Sezon',
    generateRounds: 'Generuj rundy',
    managePlayoff: 'Play-off',
  },
```

- [ ] **Step 3: Commit**

```bash
git add src/constants/pl.ts
git commit -m "feat: add Polish translations for playoff UI"
```

---

### Task 4: Core playoff logic library

**Files:**
- Create: `src/lib/playoff.ts`

- [ ] **Step 1: Create the playoff library**

```typescript
// src/lib/playoff.ts
import { prisma } from './db'
import { computeStandings } from './standings'

// ═══ CONSTANTS ═══

/** Seeding pairs per bracket: [seed1, seed2] in bracketPosition order */
export const BRACKET_SEEDS: Record<string, [number, number][]> = {
  '1-16': [
    [1, 16], [8, 9],    // → QF1
    [4, 13], [5, 12],   // → QF2
    [2, 15], [7, 10],   // → QF3
    [3, 14], [6, 11],   // → QF4
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

export const BRACKET_NAMES = ['1-16', '17-32', '33-48'] as const

export const BRACKET_HOLES: Record<string, number> = {
  '1-16': 18,
  '17-32': 9,
  '33-48': 9,
}

export const ROUND_NAMES: Record<number, string> = {
  1: '1/8 Finału',
  2: 'Ćwierćfinał',
  3: 'Półfinał',
  4: 'Finał',
}

export const ROUND_DEADLINES: Record<number, string> = {
  1: '06.09.2026',
  2: '25.09.2026',
  3: '11.10.2026',
  4: '31.10.2026',
}

// ═══ BRACKET SLOT INTERFACE ═══

export interface BracketSlot {
  bracketRound: number
  bracketPosition: number
  matchId: number | null
  player1Id: number | null
  player2Id: number | null
  player1Name: string | null
  player2Name: string | null
  player1Slug: string | null
  player2Slug: string | null
  player1Seed: number | null
  player2Seed: number | null
  winnerId: number | null
  resultCode: string | null
  played: boolean
  isWalkover: boolean
  deadline: string
}

// ═══ GLOBAL RANKING ═══

export interface RankedPlayer {
  rank: number
  playerId: number
  firstName: string
  lastName: string
  slug: string
  bigPoints: number
  smallPoints: number
  hcpAtStart: number | null
  groupName: string
  positionInGroup: number
}

/**
 * Compute global ranking from the last completed ROUND_ROBIN round.
 * Sort: position in group → BP desc → SP desc → HCP desc (higher HCP = higher rank).
 * No head-to-head across groups.
 */
export async function computeGlobalRanking(seasonId: number): Promise<RankedPlayer[]> {
  // Find the latest completed or active ROUND_ROBIN round
  const lastRound = await prisma.round.findFirst({
    where: {
      seasonId,
      type: 'ROUND_ROBIN',
      status: { in: ['COMPLETED', 'ACTIVE'] },
    },
    orderBy: { roundNumber: 'desc' },
    include: {
      groups: {
        orderBy: { sortOrder: 'asc' },
        include: {
          players: { include: { player: true } },
          matches: { include: { player1: true, player2: true } },
        },
      },
    },
  })

  if (!lastRound) return []

  // Compute standings per group
  const allPlayers: RankedPlayer[] = []

  for (const group of lastRound.groups) {
    const standings = computeStandings(group.players, group.matches)
    for (const s of standings) {
      allPlayers.push({
        rank: 0, // will be assigned below
        playerId: s.playerId,
        firstName: s.firstName,
        lastName: s.lastName,
        slug: s.slug,
        bigPoints: s.bigPoints,
        smallPoints: s.smallPoints,
        hcpAtStart: s.hcpAtStart,
        groupName: group.name,
        positionInGroup: s.position,
      })
    }
  }

  // Sort: position in group ASC → BP DESC → SP DESC → HCP DESC
  allPlayers.sort((a, b) => {
    if (a.positionInGroup !== b.positionInGroup) return a.positionInGroup - b.positionInGroup
    if (b.bigPoints !== a.bigPoints) return b.bigPoints - a.bigPoints
    if (b.smallPoints !== a.smallPoints) return b.smallPoints - a.smallPoints
    const aHcp = a.hcpAtStart ?? 0
    const bHcp = b.hcpAtStart ?? 0
    return bHcp - aHcp
  })

  // Assign ranks
  allPlayers.forEach((p, i) => { p.rank = i + 1 })

  return allPlayers
}

// ═══ BUILD BRACKET VIEW ═══

/**
 * Build the full 15-slot bracket array for a playoff group.
 * Merges real Match records with computed placeholder slots.
 */
export async function buildBracketSlots(groupId: number): Promise<BracketSlot[]> {
  // Fetch all playoff matches for this group
  const matches = await prisma.match.findMany({
    where: {
      groupId,
      bracketRound: { not: null },
    },
    include: { player1: true, player2: true },
    orderBy: [{ bracketRound: 'asc' }, { bracketPosition: 'asc' }],
  })

  // Fetch group players for seed mapping
  const groupPlayers = await prisma.groupPlayer.findMany({
    where: { groupId },
    include: { player: true },
  })

  // Build seed map: finalPosition → player
  const seedMap = new Map<number, typeof groupPlayers[0]>()
  for (const gp of groupPlayers) {
    if (gp.finalPosition) seedMap.set(gp.finalPosition, gp)
  }

  // Build match lookup: "round-position" → match
  const matchMap = new Map<string, typeof matches[0]>()
  for (const m of matches) {
    if (m.bracketRound && m.bracketPosition) {
      matchMap.set(`${m.bracketRound}-${m.bracketPosition}`, m)
    }
  }

  const slots: BracketSlot[] = []
  const roundSizes = [8, 4, 2, 1] // matches per round

  for (let round = 1; round <= 4; round++) {
    for (let pos = 1; pos <= roundSizes[round - 1]; pos++) {
      const match = matchMap.get(`${round}-${pos}`)

      if (match) {
        slots.push({
          bracketRound: round,
          bracketPosition: pos,
          matchId: match.id,
          player1Id: match.player1Id,
          player2Id: match.player2Id,
          player1Name: `${match.player1.firstName} ${match.player1.lastName}`,
          player2Name: `${match.player2.firstName} ${match.player2.lastName}`,
          player1Slug: match.player1.slug,
          player2Slug: match.player2.slug,
          player1Seed: null, // resolved below for round 1
          player2Seed: null,
          winnerId: match.winnerId,
          resultCode: match.resultCode,
          played: match.played,
          isWalkover: match.isWalkover,
          deadline: ROUND_DEADLINES[round] ?? '',
        })
      } else {
        // Placeholder — match not yet created
        // Try to resolve player names from feeder matches
        const feeder1Pos = pos * 2 - 1
        const feeder2Pos = pos * 2
        const feeder1 = matchMap.get(`${round - 1}-${feeder1Pos}`)
        const feeder2 = matchMap.get(`${round - 1}-${feeder2Pos}`)

        slots.push({
          bracketRound: round,
          bracketPosition: pos,
          matchId: null,
          player1Id: feeder1?.winnerId ?? null,
          player2Id: feeder2?.winnerId ?? null,
          player1Name: feeder1?.winnerId
            ? feeder1.winnerId === feeder1.player1Id
              ? `${feeder1.player1.firstName} ${feeder1.player1.lastName}`
              : `${feeder1.player2.firstName} ${feeder1.player2.lastName}`
            : null,
          player2Name: feeder2?.winnerId
            ? feeder2.winnerId === feeder2.player1Id
              ? `${feeder2.player1.firstName} ${feeder2.player1.lastName}`
              : `${feeder2.player2.firstName} ${feeder2.player2.lastName}`
            : null,
          player1Slug: null,
          player2Slug: null,
          player1Seed: null,
          player2Seed: null,
          winnerId: null,
          resultCode: null,
          played: false,
          isWalkover: false,
          deadline: ROUND_DEADLINES[round] ?? '',
        })
      }
    }
  }

  // Resolve seeds for round 1
  for (const slot of slots) {
    if (slot.bracketRound === 1 && slot.player1Id) {
      const gp1 = groupPlayers.find(gp => gp.playerId === slot.player1Id)
      const gp2 = groupPlayers.find(gp => gp.playerId === slot.player2Id)
      slot.player1Seed = gp1?.finalPosition ?? null
      slot.player2Seed = gp2?.finalPosition ?? null
    }
  }

  return slots
}

// ═══ AUTO-ADVANCE ═══

/**
 * After a playoff match result is saved, check if the next-round match should be created.
 * Called by the result API route.
 */
export async function autoAdvancePlayoff(matchId: number): Promise<void> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      group: { include: { round: true } },
    },
  })

  if (!match || !match.bracketRound || !match.bracketPosition || !match.winnerId) return
  if (match.group.round.type !== 'PLAYOFF') return
  if (match.bracketRound >= 4) return // Final — no next round

  const nextRound = match.bracketRound + 1
  const nextPosition = Math.ceil(match.bracketPosition / 2)
  const isTopSlot = match.bracketPosition % 2 === 1 // odd = top (player1), even = bottom (player2)

  // Find the sibling match
  const siblingPosition = isTopSlot ? match.bracketPosition + 1 : match.bracketPosition - 1
  const siblingMatch = await prisma.match.findFirst({
    where: {
      groupId: match.groupId,
      bracketRound: match.bracketRound,
      bracketPosition: siblingPosition,
      played: true,
    },
  })

  if (!siblingMatch || !siblingMatch.winnerId) return // Sibling not played yet

  // Both feeders decided — create next-round match
  const topWinnerId = isTopSlot ? match.winnerId : siblingMatch.winnerId
  const bottomWinnerId = isTopSlot ? siblingMatch.winnerId : match.winnerId

  // Check if next match already exists
  const existing = await prisma.match.findFirst({
    where: {
      groupId: match.groupId,
      bracketRound: nextRound,
      bracketPosition: nextPosition,
    },
  })

  if (existing) return // Already created (idempotent)

  await prisma.match.create({
    data: {
      groupId: match.groupId,
      player1Id: topWinnerId,
      player2Id: bottomWinnerId,
      bracketRound: nextRound,
      bracketPosition: nextPosition,
    },
  })
}

// ═══ CASCADE DELETE ═══

/**
 * When a playoff match result is cleared, delete any downstream matches
 * that were created from this match's winner.
 */
export async function cascadeDeleteDownstream(matchId: number): Promise<void> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
  })

  if (!match || !match.bracketRound || !match.bracketPosition) return
  if (match.bracketRound >= 4) return

  const nextRound = match.bracketRound + 1
  const nextPosition = Math.ceil(match.bracketPosition / 2)

  const downstream = await prisma.match.findFirst({
    where: {
      groupId: match.groupId,
      bracketRound: nextRound,
      bracketPosition: nextPosition,
    },
  })

  if (downstream) {
    // Recursively delete further downstream first
    await cascadeDeleteDownstream(downstream.id)
    // Then delete this downstream match
    await prisma.match.delete({ where: { id: downstream.id } })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/playoff.ts
git commit -m "feat: add playoff library (seeding, bracket builder, auto-advance, cascade delete)"
```

---

### Task 5: Modify match result route for playoff support

**Files:**
- Modify: `src/app/api/matches/[id]/result/route.ts`

- [ ] **Step 1: Update POST handler to skip scoring for PLAYOFF and call auto-advance**

Replace the entire file content:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { computePoints, SeasonConfig, DEFAULT_SEASON_CONFIG } from '@/lib/scoring'
import { autoAdvancePlayoff, cascadeDeleteDownstream } from '@/lib/playoff'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const matchId = parseInt(id)
  const body = await request.json()
  const { winnerId, resultCode, isWalkover } = body

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      group: {
        include: {
          round: { include: { season: true } },
        },
      },
    },
  })

  if (!match) {
    return NextResponse.json({ error: 'Mecz nie znaleziony' }, { status: 404 })
  }

  const isPlayoff = match.group.round.type === 'PLAYOFF'

  // Block "Tied" result for playoff (sudden death resolves ties)
  if (isPlayoff && resultCode === 'Tied' && !isWalkover) {
    return NextResponse.json({ error: 'Remis nie jest dozwolony w play-off (nagła śmierć od dołka 1)' }, { status: 400 })
  }

  // Compute points only for group-stage matches
  let points = {
    player1BigPoints: 0,
    player2BigPoints: 0,
    player1SmallPoints: 0,
    player2SmallPoints: 0,
  }

  if (!isPlayoff) {
    const seasonConfig = (match.group.round.season.config as unknown as SeasonConfig) || DEFAULT_SEASON_CONFIG
    points = computePoints(
      {
        winnerId: winnerId ? parseInt(winnerId) : null,
        resultCode: resultCode || 'Tied',
        isWalkover: !!isWalkover,
      },
      match.player1Id,
      match.player2Id,
      seasonConfig
    )
  }

  const updated = await prisma.match.update({
    where: { id: matchId },
    data: {
      resultCode: isWalkover ? 'Walkover' : resultCode,
      winnerId: winnerId ? parseInt(winnerId) : null,
      isWalkover: !!isWalkover,
      played: true,
      ...points,
    },
    include: { player1: true, player2: true, winner: true },
  })

  // Auto-advance: create next-round playoff match if both feeders decided
  if (isPlayoff && updated.winnerId) {
    await autoAdvancePlayoff(matchId)
  }

  return NextResponse.json(updated)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const matchId = parseInt(id)

  // For playoff matches: cascade delete downstream matches first
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { group: { include: { round: true } } },
  })

  if (match?.group.round.type === 'PLAYOFF') {
    await cascadeDeleteDownstream(matchId)
  }

  const updated = await prisma.match.update({
    where: { id: matchId },
    data: {
      resultCode: null,
      winnerId: null,
      isWalkover: false,
      played: false,
      player1BigPoints: 0,
      player2BigPoints: 0,
      player1SmallPoints: 0,
      player2SmallPoints: 0,
    },
  })

  return NextResponse.json(updated)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/matches/[id]/result/route.ts
git commit -m "feat: add playoff support to match result route (skip scoring, auto-advance, cascade delete)"
```

---

## Chunk 2: Admin UI

### Task 6: Ranking preview API

**Files:**
- Create: `src/app/api/admin/playoff/ranking/route.ts`

- [ ] **Step 1: Create ranking API route**

```typescript
// src/app/api/admin/playoff/ranking/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { computeGlobalRanking } from '@/lib/playoff'

export async function GET() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const activeSeason = await prisma.season.findFirst({
    where: { status: 'ACTIVE' },
  })

  if (!activeSeason) {
    return NextResponse.json({ error: 'Brak aktywnego sezonu' }, { status: 404 })
  }

  // Check if playoff already exists
  const existingPlayoff = await prisma.round.findFirst({
    where: { seasonId: activeSeason.id, type: 'PLAYOFF' },
  })

  if (existingPlayoff) {
    return NextResponse.json({ error: 'Play-off już istnieje' }, { status: 409 })
  }

  const ranking = await computeGlobalRanking(activeSeason.id)

  return NextResponse.json({
    seasonId: activeSeason.id,
    seasonName: activeSeason.name,
    ranking,
    brackets: {
      '1-16': ranking.slice(0, 16),
      '17-32': ranking.slice(16, 32),
      '33-48': ranking.slice(32, 48),
    },
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/admin/playoff/ranking/route.ts
git commit -m "feat: add playoff ranking preview API"
```

---

### Task 7: Playoff creation API

**Files:**
- Create: `src/app/api/admin/playoff/create/route.ts`

- [ ] **Step 1: Create the playoff creation endpoint**

```typescript
// src/app/api/admin/playoff/create/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { computeGlobalRanking, BRACKET_SEEDS, BRACKET_NAMES, BRACKET_HOLES } from '@/lib/playoff'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { seasonId, overrides } = body as {
    seasonId: number
    overrides?: Record<number, number> // rank → playerId overrides
  }

  // Check no existing playoff
  const existing = await prisma.round.findFirst({
    where: { seasonId, type: 'PLAYOFF' },
  })
  if (existing) {
    return NextResponse.json({ error: 'Play-off już istnieje' }, { status: 409 })
  }

  // Get ranking
  const ranking = await computeGlobalRanking(seasonId)
  if (ranking.length < 16) {
    return NextResponse.json({
      error: `Za mało graczy (${ranking.length}/16). Potrzeba minimum 16 graczy z zakończoną fazą grupową.`,
    }, { status: 400 })
  }
  // Note: If fewer than 48 players, brackets with missing seeds will have BYE auto-advances

  // Apply overrides if any (admin swaps)
  if (overrides) {
    for (const [rankStr, playerId] of Object.entries(overrides)) {
      const rank = parseInt(rankStr)
      const idx = ranking.findIndex(p => p.rank === rank)
      const swapIdx = ranking.findIndex(p => p.playerId === playerId)
      if (idx >= 0 && swapIdx >= 0) {
        // Swap the two players' positions in ranking
        const tempRank = ranking[idx].rank
        ranking[idx].rank = ranking[swapIdx].rank
        ranking[swapIdx].rank = tempRank
        // Re-sort
        ranking.sort((a, b) => a.rank - b.rank)
      }
    }
  }

  // Create playoff round
  const round = await prisma.round.create({
    data: {
      seasonId,
      name: 'Play-off',
      roundNumber: 99, // high number to sort after group rounds
      type: 'PLAYOFF',
      status: 'ACTIVE',
      config: { bracketHoles: BRACKET_HOLES },
    },
  })

  const createdGroups = []

  for (let bracketIdx = 0; bracketIdx < BRACKET_NAMES.length; bracketIdx++) {
    const bracketName = BRACKET_NAMES[bracketIdx]
    const seeds = BRACKET_SEEDS[bracketName]
    const bracketPlayers = ranking.slice(bracketIdx * 16, (bracketIdx + 1) * 16)

    // Create group (bracket)
    const group = await prisma.group.create({
      data: {
        roundId: round.id,
        name: `Drabinka ${bracketName}`,
        sortOrder: bracketIdx,
        status: 'ACTIVE',
      },
    })

    // Add players to group with finalPosition = their global seed
    for (const player of bracketPlayers) {
      await prisma.groupPlayer.create({
        data: {
          groupId: group.id,
          playerId: player.playerId,
          hcpAtStart: player.hcpAtStart !== null ? player.hcpAtStart : null,
          finalPosition: player.rank,
        },
      })
    }

    // Create Round 1 matches (8 per bracket)
    for (let i = 0; i < seeds.length; i++) {
      const [seed1, seed2] = seeds[i]
      const p1 = ranking.find(p => p.rank === seed1)
      const p2 = ranking.find(p => p.rank === seed2)

      if (p1 && p2) {
        await prisma.match.create({
          data: {
            groupId: group.id,
            player1Id: p1.playerId,
            player2Id: p2.playerId,
            bracketRound: 1,
            bracketPosition: i + 1,
          },
        })
      } else if (p1 && !p2) {
        // BYE: p1 auto-advances
        await prisma.match.create({
          data: {
            groupId: group.id,
            player1Id: p1.playerId,
            player2Id: p1.playerId, // placeholder — self-match for BYE
            bracketRound: 1,
            bracketPosition: i + 1,
            played: true,
            winnerId: p1.playerId,
            resultCode: 'BYE',
          },
        })
      }
    }

    createdGroups.push(group)
  }

  return NextResponse.json({
    roundId: round.id,
    groups: createdGroups.map(g => ({ id: g.id, name: g.name })),
    message: 'Play-off utworzony pomyślnie',
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/admin/playoff/create/route.ts
git commit -m "feat: add playoff creation API with seeding and match generation"
```

---

### Task 8: Admin playoff page

**Files:**
- Create: `src/app/admin/playoff/page.tsx`

- [ ] **Step 1: Create admin playoff management page**

```tsx
// src/app/admin/playoff/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { PL } from '@/constants/pl'
import { BRACKET_SEEDS, BRACKET_NAMES } from '@/lib/playoff'
import type { RankedPlayer } from '@/lib/playoff'
import Link from 'next/link'

interface PlayoffGroup {
  id: number
  name: string
}

export default function AdminPlayoffPage() {
  const [ranking, setRanking] = useState<RankedPlayer[] | null>(null)
  const [brackets, setBrackets] = useState<Record<string, RankedPlayer[]> | null>(null)
  const [seasonId, setSeasonId] = useState<number | null>(null)
  const [existingGroups, setExistingGroups] = useState<PlayoffGroup[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    checkPlayoffStatus()
  }, [])

  async function checkPlayoffStatus() {
    // Check if playoff already exists
    const res = await fetch('/api/admin/playoff/ranking')
    if (res.status === 409) {
      // Playoff exists — fetch the groups
      const seasonRes = await fetch('/api/seasons/current')
      if (seasonRes.ok) {
        const season = await seasonRes.json()
        const roundRes = await fetch(`/api/seasons/${season.id}`)
        if (roundRes.ok) {
          const data = await roundRes.json()
          const playoffRound = data.rounds?.find((r: { type: string }) => r.type === 'PLAYOFF')
          if (playoffRound) {
            setExistingGroups(playoffRound.groups)
          }
        }
      }
      setLoading(false)
      return
    }

    if (res.ok) {
      const data = await res.json()
      setRanking(data.ranking)
      setBrackets(data.brackets)
      setSeasonId(data.seasonId)
    } else {
      const data = await res.json()
      setError(data.error)
    }
    setLoading(false)
  }

  async function handleCreate() {
    if (!seasonId) return
    setCreating(true)
    setError(null)

    const res = await fetch('/api/admin/playoff/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seasonId }),
    })

    if (res.ok) {
      const data = await res.json()
      setExistingGroups(data.groups)
      setRanking(null)
      setBrackets(null)
    } else {
      const data = await res.json()
      setError(data.error)
    }
    setCreating(false)
  }

  if (loading) return <div className="p-8">{PL.common.loading}</div>

  // State 3: Playoff exists — show links to bracket groups
  if (existingGroups) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-[var(--color-primary)] mb-6"
            style={{ fontFamily: 'Raleway, sans-serif' }}>
          {PL.playoff.title}
        </h1>
        <p className="text-[var(--color-text-body)] mb-8">{PL.playoff.playoffExists}</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {existingGroups.map((group) => (
            <Link
              key={group.id}
              href={`/admin/grupa/${group.id}`}
              className="card card-clickable p-6 text-center"
            >
              <h2 className="text-lg font-bold text-[var(--color-primary)]">{group.name}</h2>
              <p className="text-sm text-[var(--color-text-body)]/60 mt-2">Wprowadź wyniki</p>
            </Link>
          ))}
        </div>

        <div className="mt-8">
          <Link href="/playoff" className="btn-secondary text-sm">
            Zobacz drabinki publiczne &rarr;
          </Link>
        </div>
      </div>
    )
  }

  // State 2: Show seeding preview
  if (ranking && brackets) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-[var(--color-primary)] mb-6"
            style={{ fontFamily: 'Raleway, sans-serif' }}>
          {PL.playoff.seedingPreview}
        </h1>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">{error}</div>
        )}

        {BRACKET_NAMES.map((bracketName) => {
          const seeds = BRACKET_SEEDS[bracketName]
          const players = brackets[bracketName]
          if (!players) return null

          return (
            <div key={bracketName} className="card p-6 mb-6">
              <h2 className="text-xl font-bold text-[var(--color-primary)] mb-4">
                Drabinka {bracketName}
              </h2>
              <div className="space-y-2">
                {seeds.map(([s1, s2], idx) => {
                  const p1 = ranking.find(p => p.rank === s1)
                  const p2 = ranking.find(p => p.rank === s2)
                  return (
                    <div key={idx} className="flex items-center gap-4 text-sm py-2 border-b border-[var(--color-border)]">
                      <span className="w-8 text-right font-bold text-[var(--color-primary)]/40">M{idx + 1}</span>
                      <span className="flex-1">
                        <span className="font-bold">{s1}.</span> {p1?.firstName} {p1?.lastName}
                        <span className="text-[var(--color-text-body)]/40 mx-2">vs</span>
                        <span className="font-bold">{s2}.</span> {p2?.firstName} {p2?.lastName}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        <button
          onClick={handleCreate}
          disabled={creating}
          className="btn-primary text-lg px-8 py-3"
        >
          {creating ? PL.common.loading : PL.playoff.confirmCreate}
        </button>
      </div>
    )
  }

  // State 1: Error or not ready
  return (
    <div>
      <h1 className="text-3xl font-bold text-[var(--color-primary)] mb-6"
          style={{ fontFamily: 'Raleway, sans-serif' }}>
        {PL.playoff.title}
      </h1>
      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>
      ) : (
        <p className="text-[var(--color-text-body)]">{PL.playoff.noPlayoff}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/playoff/page.tsx
git commit -m "feat: add admin playoff management page"
```

---

## Chunk 3: Public Frontend + Navbar

### Task 9: BracketMatchCard component

**Files:**
- Create: `src/components/BracketMatchCard.tsx`

- [ ] **Step 1: Create the bracket match card**

```tsx
// src/components/BracketMatchCard.tsx
import Link from 'next/link'
import type { BracketSlot } from '@/lib/playoff'

interface Props {
  slot: BracketSlot
}

export default function BracketMatchCard({ slot }: Props) {
  const hasPlayers = slot.player1Name || slot.player2Name

  return (
    <div className={`border rounded-lg overflow-hidden text-sm transition-colors ${
      slot.played
        ? 'border-[var(--color-border)] bg-white'
        : 'border-[var(--color-border)]/50 bg-[var(--color-primary)]/[0.02]'
    }`}>
      {/* Player 1 (top) */}
      <PlayerSlot
        name={slot.player1Name}
        slug={slot.player1Slug}
        seed={slot.player1Seed}
        isWinner={slot.winnerId !== null && slot.winnerId === slot.player1Id}
        isLoser={slot.winnerId !== null && slot.winnerId !== slot.player1Id}
        resultCode={slot.winnerId === slot.player1Id ? slot.resultCode : null}
      />

      <div className="border-t border-[var(--color-border)]/50" />

      {/* Player 2 (bottom) */}
      <PlayerSlot
        name={slot.player2Name}
        slug={slot.player2Slug}
        seed={slot.player2Seed}
        isWinner={slot.winnerId !== null && slot.winnerId === slot.player2Id}
        isLoser={slot.winnerId !== null && slot.winnerId !== slot.player2Id}
        resultCode={slot.winnerId === slot.player2Id ? slot.resultCode : null}
      />

      {/* Status bar */}
      <div className={`text-center py-1 text-[0.6rem] font-semibold uppercase tracking-wider ${
        slot.played ? 'text-[var(--color-success)]/70' : 'text-[var(--color-text-body)]/30'
      }`}>
        {slot.played ? 'rozegrany' : hasPlayers ? `do ${slot.deadline}` : ''}
      </div>
    </div>
  )
}

function PlayerSlot({
  name,
  slug,
  seed,
  isWinner,
  isLoser,
  resultCode,
}: {
  name: string | null
  slug: string | null
  seed: number | null
  isWinner: boolean
  isLoser: boolean
  resultCode: string | null
}) {
  if (!name) {
    return (
      <div className="px-3 py-2 flex items-center gap-2">
        <span className="text-[var(--color-text-body)]/20 italic text-xs">Oczekuje na wynik</span>
      </div>
    )
  }

  const nameEl = slug ? (
    <Link
      href={`/zawodnik/${slug}`}
      className={`font-semibold transition-colors ${
        isWinner ? 'text-[var(--color-primary)] hover:text-[var(--color-accent)]' :
        isLoser ? 'text-[var(--color-text-body)]/40 line-through' :
        'text-[var(--color-text-dark)] hover:text-[var(--color-primary)]'
      }`}
    >
      {name}
    </Link>
  ) : (
    <span className={`font-semibold ${
      isWinner ? 'text-[var(--color-primary)]' :
      isLoser ? 'text-[var(--color-text-body)]/40 line-through' :
      'text-[var(--color-text-body)]/40 italic'
    }`}>
      {name}
    </span>
  )

  return (
    <div className={`px-3 py-2 flex items-center justify-between gap-2 ${
      isWinner ? 'bg-[var(--color-success)]/[0.04]' : ''
    }`}>
      <div className="flex items-center gap-2 min-w-0">
        {seed !== null && (
          <span className={`text-xs font-bold w-5 text-center flex-shrink-0 ${
            isWinner ? 'text-[var(--color-success)]' : 'text-[var(--color-primary)]/30'
          }`}>
            {seed}
          </span>
        )}
        {nameEl}
      </div>
      {resultCode && (
        <span className="text-xs font-bold text-[var(--color-accent)] flex-shrink-0 ml-2">
          {resultCode}
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/BracketMatchCard.tsx
git commit -m "feat: add BracketMatchCard component"
```

---

### Task 10: PlayoffBracket component

**Files:**
- Create: `src/components/PlayoffBracket.tsx`

- [ ] **Step 1: Create the bracket visualization with tabs**

```tsx
// src/components/PlayoffBracket.tsx
'use client'

import { useState } from 'react'
import BracketMatchCard from './BracketMatchCard'
import { PL } from '@/constants/pl'
import type { BracketSlot } from '@/lib/playoff'
import { ROUND_NAMES, BRACKET_HOLES } from '@/lib/playoff'

interface BracketData {
  groupId: number
  name: string
  bracketKey: string
  slots: BracketSlot[]
}

interface Props {
  brackets: BracketData[]
}

const HOLES_LABELS: Record<string, string> = {
  '1-16': PL.playoff.holes18,
  '17-32': PL.playoff.holes918,
  '33-48': PL.playoff.holes9,
}

export default function PlayoffBracket({ brackets }: Props) {
  const [activeTab, setActiveTab] = useState(0)
  const active = brackets[activeTab]
  if (!active) return null

  const rounds = [1, 2, 3, 4]
  const roundSizes = [8, 4, 2, 1]

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b-2 border-[var(--color-border)]">
        {brackets.map((b, i) => (
          <button
            key={b.groupId}
            onClick={() => setActiveTab(i)}
            className={`px-5 py-3 font-bold text-sm uppercase tracking-wide border-b-[3px] -mb-[2px] transition-colors ${
              i === activeTab
                ? 'text-[var(--color-primary)] border-[var(--color-accent)]'
                : 'text-[var(--color-text-body)]/50 border-transparent hover:text-[var(--color-primary)]'
            }`}
            style={{ fontFamily: 'Raleway, sans-serif' }}
          >
            {b.name.replace('Drabinka ', '')}
            <span className="block text-[0.6rem] font-normal normal-case tracking-normal text-[var(--color-text-body)]/40">
              {HOLES_LABELS[b.bracketKey] ?? ''}
            </span>
          </button>
        ))}
      </div>

      {/* Bracket grid */}
      <div className="card p-6 overflow-x-auto">
        {/* Round headers */}
        <div className="grid gap-4 mb-4 min-w-[800px]"
             style={{ gridTemplateColumns: 'repeat(4, 200px)', justifyContent: 'start', columnGap: '40px' }}>
          {rounds.map(r => (
            <div key={r} className="text-center text-[0.65rem] font-bold uppercase tracking-[0.15em] text-[var(--color-text-body)]/40">
              {ROUND_NAMES[r]}
            </div>
          ))}
        </div>

        {/* Match grid */}
        <div className="grid gap-4 min-w-[800px]"
             style={{ gridTemplateColumns: 'repeat(4, 200px)', justifyContent: 'start', columnGap: '40px' }}>
          {rounds.map(r => {
            const slotsForRound = active.slots.filter(s => s.bracketRound === r)
            const gapClass = r === 1 ? 'gap-2' : r === 2 ? 'gap-10' : r === 3 ? 'gap-24' : ''
            const paddingTop = r === 2 ? 'pt-7' : r === 3 ? 'pt-[72px]' : r === 4 ? 'pt-[168px]' : ''

            return (
              <div key={r} className={`flex flex-col justify-start ${gapClass} ${paddingTop}`}>
                {slotsForRound.map((slot) => (
                  <BracketMatchCard key={`${slot.bracketRound}-${slot.bracketPosition}`} slot={slot} />
                ))}

                {/* Champion card after final */}
                {r === 4 && slotsForRound[0]?.winnerId && (
                  <div className="mt-4 bg-[var(--color-primary)] border-2 border-[var(--color-accent)] rounded-lg p-4 text-center">
                    <div className="text-2xl mb-1">🏆</div>
                    <div className="text-[0.6rem] font-bold tracking-[0.2em] uppercase text-[var(--color-accent)]">
                      {PL.playoff.champion}
                    </div>
                    <div className="text-white font-bold text-sm mt-1" style={{ fontFamily: 'Raleway, sans-serif' }}>
                      {slotsForRound[0].winnerId === slotsForRound[0].player1Id
                        ? slotsForRound[0].player1Name
                        : slotsForRound[0].player2Name}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/PlayoffBracket.tsx
git commit -m "feat: add PlayoffBracket visualization component with tabs"
```

---

### Task 11: Public /playoff page

**Files:**
- Create: `src/app/(public)/playoff/page.tsx`

- [ ] **Step 1: Create the public playoff page**

```tsx
// src/app/(public)/playoff/page.tsx
import { prisma } from '@/lib/db'
import { PL } from '@/constants/pl'
import { buildBracketSlots, BRACKET_NAMES } from '@/lib/playoff'
import PlayoffBracket from '@/components/PlayoffBracket'

export const dynamic = 'force-dynamic'

export default async function PlayoffPage() {
  const activeSeason = await prisma.season.findFirst({
    where: { status: 'ACTIVE' },
    include: {
      rounds: {
        where: { type: 'PLAYOFF' },
        include: {
          groups: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
    },
  })

  const playoffRound = activeSeason?.rounds[0]

  if (!playoffRound || playoffRound.groups.length === 0) {
    return (
      <div className="text-center py-20">
        <h1 className="text-3xl font-bold text-[var(--color-primary)]" style={{ fontFamily: 'Raleway, sans-serif' }}>
          {PL.playoff.title}
        </h1>
        <p className="mt-4 text-[var(--color-text-body)]">{PL.playoff.noPlayoff}</p>
      </div>
    )
  }

  // Build bracket data for each group
  const brackets = await Promise.all(
    playoffRound.groups.map(async (group, idx) => {
      const slots = await buildBracketSlots(group.id)
      return {
        groupId: group.id,
        name: group.name,
        bracketKey: BRACKET_NAMES[idx] ?? '',
        slots: JSON.parse(JSON.stringify(slots)), // serialize for client component
      }
    })
  )

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-[var(--color-primary)]" style={{ fontFamily: 'Raleway, sans-serif' }}>
          {PL.playoff.title} {activeSeason!.year}
        </h1>
        <div className="flex items-center gap-3 mt-3">
          <span className="inline-block w-12 h-0.5 bg-[var(--color-accent)]"></span>
          <p className="text-[var(--color-text-body)] font-medium">
            {activeSeason!.name} &middot; Karolinka Golf Park
          </p>
        </div>
      </div>

      <PlayoffBracket brackets={brackets} />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(public\)/playoff/page.tsx
git commit -m "feat: add public /playoff page with bracket visualization"
```

---

### Task 12: Navbar + Layout — conditional Play-off link

**Files:**
- Modify: `src/components/Navbar.tsx`
- Modify: `src/app/(public)/layout.tsx`

- [ ] **Step 1: Update Navbar to accept hasPlayoff prop**

In `src/components/Navbar.tsx`, change the component signature and links:

```tsx
// Change line 9:
export default function Navbar({ hasPlayoff = false }: { hasPlayoff?: boolean }) {

// Change lines 13-16 (links array):
  const links = [
    { href: '/grupy', label: PL.nav.groups },
    ...(hasPlayoff ? [{ href: '/playoff', label: PL.nav.playoff }] : []),
    { href: '/zawodnicy', label: PL.nav.players },
  ]
```

- [ ] **Step 2: Update layout to query playoff and pass prop**

In `src/app/(public)/layout.tsx`, make these targeted changes:

**Line 1:** Add prisma import:
```tsx
import Navbar from '@/components/Navbar'
import Image from 'next/image'
import { prisma } from '@/lib/db'
```

**Line 4:** Change function from sync to async:
```tsx
export default async function PublicLayout({
```

**Between the function signature and `return`**, add the playoff query:
```tsx
  const playoffRound = await prisma.round.findFirst({
    where: {
      type: 'PLAYOFF',
      season: { status: 'ACTIVE' },
    },
    select: { id: true },
  })
  const hasPlayoff = !!playoffRound
```

**Line 11 (Navbar):** Pass the prop:
```tsx
      <Navbar hasPlayoff={hasPlayoff} />
```

All other lines (main, footer, closing tags) remain exactly unchanged.

- [ ] **Step 3: Commit**

```bash
git add src/components/Navbar.tsx src/app/\(public\)/layout.tsx
git commit -m "feat: add conditional Play-off link to public navbar"
```

---

### Task 13: Verify compilation and test

- [ ] **Step 1: TypeScript check**

```bash
cd /tmp/Golf_app && npx tsc --noEmit 2>&1 | head -20
```
Expected: No errors

- [ ] **Step 2: Start dev server and check pages load**

```bash
cd /tmp/Golf_app && npx next dev --port 3001 &
sleep 8
# Public playoff page (should show "no playoff" state)
curl -s http://localhost:3001/playoff | grep -o "Play-off" | head -1
# Admin playoff page (redirects to login)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/admin/playoff
```
Expected: "Play-off" from public page, 307 redirect for admin

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete playoff brackets implementation"
```

---

## Success Checklist

- [ ] Prisma schema has `bracketRound` and `bracketPosition` on Match
- [ ] `RESULT_CODES_18` added to scoring.ts
- [ ] `src/lib/playoff.ts` — seeding, bracket builder, auto-advance, cascade delete
- [ ] `/api/admin/playoff/ranking` — returns global ranking preview
- [ ] `/api/admin/playoff/create` — creates playoff round with 3 brackets and 24 matches
- [ ] `/admin/playoff` — admin can preview seeding and create playoff
- [ ] `/playoff` — public bracket visualization with tabs
- [ ] Match result POST — skips scoring for PLAYOFF, calls auto-advance
- [ ] Match result DELETE — cascades downstream match deletion for PLAYOFF
- [ ] Navbar shows "Play-off" link when playoff round exists
- [ ] TypeScript compiles without errors

// src/app/api/admin/playoff/create/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { computeGlobalRanking, BRACKET_SEEDS, BRACKET_NAMES, BRACKET_HOLES, BRACKET_DISPLAY_NAMES, autoAdvancePlayoff } from '@/lib/playoff'

/**
 * Polska odmiana rzeczownika „mecz": 1 mecz, 2-4 mecze, 5+ meczów.
 * Wyjątek na 12-14 (dwanaście meczów, nie „dwanaście mecze").
 */
function pluralMecz(n: number): string {
  if (n === 1) return 'mecz'
  const last = n % 10
  const lastTwo = n % 100
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return 'mecze'
  return 'meczów'
}

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
    return NextResponse.json({ error: 'Playoff już istnieje' }, { status: 409 })
  }

  // Faza grupowa musi być formalnie zamknięta, zanim powstaną drabinki.
  //
  // Mecze bez wyniku same z siebie nie są błędem — Regulamin §III.2 („Nierozegrany mecz:
  // 0 pkt dla obu graczy"), a `computeStandings` je pomija, więc tabele są policzone
  // poprawnie. Ryzyko jest inne: przy rundzie ACTIVE wynik może jeszcze dojść i przesunąć
  // seedy JUŻ PO utworzeniu par. Dlatego mecze bez wyniku dopuszczamy tylko przy COMPLETED
  // (ten status blokuje też zapis wyników — API zwraca 403).
  //
  // Ta sama reguła co w scripts/seed-playoff-2026.ts — panel nie może być słabszy od CLI.
  const lastRR = await prisma.round.findFirst({
    where: { seasonId, type: 'ROUND_ROBIN', status: { in: ['COMPLETED', 'ACTIVE'] } },
    orderBy: { roundNumber: 'desc' },
    include: {
      groups: {
        orderBy: { sortOrder: 'asc' },
        include: {
          matches: {
            where: { played: false },
            select: {
              player1: { select: { firstName: true, lastName: true } },
              player2: { select: { firstName: true, lastName: true } },
            },
          },
        },
      },
    },
  })

  if (!lastRR) {
    return NextResponse.json({ error: 'Brak rundy grupowej w sezonie — nie ma z czego rozstawić playoff.' }, { status: 400 })
  }

  const unplayed = lastRR.groups.flatMap((g) =>
    g.matches.map((m) => `${g.name}: ${m.player1.firstName} ${m.player1.lastName} vs ${m.player2.firstName} ${m.player2.lastName}`)
  )

  if (unplayed.length > 0 && lastRR.status !== 'COMPLETED') {
    // Lista meczów wchodzi do stringa `error`, bo panel renderuje tylko to pole
    // (src/app/admin/playoff/page.tsx) — osobna tablica byłaby niewidoczna dla operatora.
    return NextResponse.json({
      error:
        `Runda "${lastRR.name}" ma ${unplayed.length} ${pluralMecz(unplayed.length)} bez wyniku, ` +
        `a jej status to ${lastRR.status}. Dopóki runda jest ACTIVE, wynik może jeszcze dojść i zmienić rozstawienie. ` +
        `Jeśli Zarząd spisał te mecze jako nierozegrane (0 pkt dla obu, Regulamin §III.2), ustaw rundę na COMPLETED ` +
        `w panelu sezonu i spróbuj ponownie. Mecze bez wyniku: ${unplayed.join('; ')}.`,
      unplayedMatches: unplayed,
    }, { status: 400 })
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
      name: 'Playoff',
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
    const holes = BRACKET_HOLES[bracketName]
    const bracketPlayers = ranking.slice(bracketIdx * 16, (bracketIdx + 1) * 16)

    // Create group (bracket)
    const group = await prisma.group.create({
      data: {
        roundId: round.id,
        name: BRACKET_DISPLAY_NAMES[bracketName] || `Liga ${bracketName}`,
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
            holes,
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
            holes,
            played: true,
            winnerId: p1.playerId,
            resultCode: 'BYE',
          },
        })
      }
    }

    // Trigger auto-advance for BYE matches
    const byeMatches = await prisma.match.findMany({
      where: { groupId: group.id, resultCode: 'BYE', bracketRound: 1 },
    })
    for (const byeMatch of byeMatches) {
      await autoAdvancePlayoff(byeMatch.id)
    }

    createdGroups.push(group)
  }

  return NextResponse.json({
    roundId: round.id,
    groups: createdGroups.map(g => ({ id: g.id, name: g.name })),
    message: 'Playoff utworzony pomyślnie',
  })
}

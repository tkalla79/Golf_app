#!/usr/bin/env tsx
/**
 * Seed Playoff 2026 — tworzy rundę PLAYOFF z 3 drabinkami (1-16, 17-32, 33-48)
 * w aktywnym sezonie 2026 na podstawie wyników fazy zasadniczej (10 grup × 5 graczy).
 *
 * Ranking 1-48 używa HIERARCHII GRUP Runda 4 z interleavingiem między sąsiednimi
 * grupami (schemat Tomka — patrz DOCS/playoff-2026-seeding.md). Skrypt CELOWO
 * NIE używa `computeGlobalRanking` z src/lib/playoff.ts, bo ta funkcja sortuje
 * przez BP→SP→HCP i daje INNE pary niż uzgodnione (np. R. Warnecki na #1 zamiast #39).
 *
 * Odpalanie na produkcji:
 *   ssh -i .ssh/karolinkagolfpark root@209.38.211.80
 *   cd /root/Golf_app && git pull && docker compose --env-file .env up -d --build app
 *
 *   # 1. Preview:
 *   docker compose --env-file .env run --rm app npx tsx scripts/seed-playoff-2026.ts --dry-run
 *
 *   # 2. Realny zapis (po weryfikacji):
 *   docker compose --env-file .env run --rm app npx tsx scripts/seed-playoff-2026.ts
 *
 *   # 3. Nadpisanie istniejącej rundy playoff (kasuje ją!):
 *   docker compose --env-file .env run --rm app npx tsx scripts/seed-playoff-2026.ts --force
 */

import { PrismaClient } from '@prisma/client'
import {
  BRACKET_SEEDS,
  BRACKET_NAMES,
  BRACKET_HOLES,
  BRACKET_DISPLAY_NAMES,
} from '../src/lib/playoff'

const prisma = new PrismaClient()

/**
 * Ranking Tomka: RANK_MATRIX[groupIndex 0-9][positionInGroup 0-4] = globalSeed (1-48) lub null (poza playoff).
 *
 * Wzór interleavingu (opisany szczegółowo w DOCS/playoff-2026-seeding.md):
 *   - G1 pos 1-3 → seeds 1-3
 *   - dla każdej pary sąsiednich grup (Gn, Gn+1):
 *       G(n+1) pos 1,2 → wchodzą MIĘDZY pos 3 a pos 4,5 Gn
 *       G(n) pos 4,5 → po nich
 *       G(n+1) pos 3 → po pos 4,5 Gn
 *   - G10 pos 4,5 → poza playoff (2 miejsca z 50 → 48)
 */
const RANK_MATRIX: (number | null)[][] = [
  //  pos1  pos2  pos3  pos4  pos5
  [    1,    2,    3,    6,    7 ], // Grupa 1
  [    4,    5,    8,   11,   12 ], // Grupa 2
  [    9,   10,   13,   16,   17 ], // Grupa 3
  [   14,   15,   18,   21,   22 ], // Grupa 4
  [   19,   20,   23,   26,   27 ], // Grupa 5
  [   24,   25,   28,   31,   32 ], // Grupa 6
  [   29,   30,   33,   36,   37 ], // Grupa 7
  [   34,   35,   38,   41,   42 ], // Grupa 8
  [   39,   40,   43,   46,   47 ], // Grupa 9
  [   44,   45,   48, null, null ], // Grupa 10
]

interface RankedPlayer {
  seed: number
  playerId: number
  firstName: string
  lastName: string
  hcpAtStart: number | null
  groupName: string
  positionInGroup: number
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const force = args.includes('--force')

  console.log(`\n=== SEED PLAYOFF 2026 ${dryRun ? '(DRY-RUN)' : ''} ${force ? '(FORCE)' : ''} ===\n`)

  // 1. Znajdź aktywny sezon 2026
  const season = await prisma.season.findFirst({
    where: { status: 'ACTIVE', year: 2026 },
    orderBy: { createdAt: 'desc' },
  })
  if (!season) throw new Error('Brak aktywnego sezonu 2026 (status=ACTIVE, year=2026)')
  console.log(`Sezon: "${season.name}" (id=${season.id}, year=${season.year})`)

  // 2. Ostatnia runda ROUND_ROBIN + grupy + gracze
  //    UWAGA: filtr status wymusza rundę faktycznie rozegraną — DRAFT (np. przygotowana Runda 5)
  //    zostaje pominięta. Zgodne z computeGlobalRanking w src/lib/playoff.ts.
  const lastRR = await prisma.round.findFirst({
    where: {
      seasonId: season.id,
      type: 'ROUND_ROBIN',
      status: { in: ['COMPLETED', 'ACTIVE'] },
    },
    orderBy: { roundNumber: 'desc' },
    include: {
      groups: {
        orderBy: { sortOrder: 'asc' },
        include: {
          players: {
            orderBy: { finalPosition: 'asc' },
            include: { player: true },
          },
          matches: { select: { id: true, played: true } },
        },
      },
    },
  })
  if (!lastRR) throw new Error('Brak rund typu ROUND_ROBIN w sezonie')

  // RANK_MATRIX jest hardkodowany pod Runda 4 (koniec fazy zasadniczej 2026).
  // Bez tego checku, gdyby Runda 4 była DRAFT a Runda 3 była ostatnią COMPLETED,
  // skrypt cicho zaseedowałby playoff z danych Rundy 3 (10 grup × 5 też pasuje).
  if (lastRR.roundNumber !== 4) {
    throw new Error(
      `Ostatnia rozegrana runda RR to nr ${lastRR.roundNumber} ("${lastRR.name}"), ` +
      `a RANK_MATRIX zakłada Rundę 4 (koniec fazy zasadniczej). ` +
      `Sprawdź czy Runda 4 jest zakończona i ma status COMPLETED lub ACTIVE.`
    )
  }

  // Walidacja: wszystkie mecze fazy zasadniczej muszą być zagrane.
  // Bez tego finalPosition może być ustawione ale wyniki niepełne — złe pary R1.
  const unplayedCount = lastRR.groups.reduce(
    (sum, g) => sum + g.matches.filter((m) => !m.played).length,
    0,
  )
  const totalMatches = lastRR.groups.reduce((sum, g) => sum + g.matches.length, 0)
  if (unplayedCount > 0) {
    throw new Error(
      `Runda "${lastRR.name}" ma ${unplayedCount}/${totalMatches} niezagranych meczów. ` +
      `Zakończ wszystkie mecze przed seedingiem playoff.`
    )
  }
  console.log(`  ✓ Wszystkie ${totalMatches} meczów fazy zasadniczej zagrane`)

  console.log(`\nOstatnia runda RR: "${lastRR.name}" (roundNumber=${lastRR.roundNumber})`)
  console.log(`Znaleziono ${lastRR.groups.length} grup:`)
  for (const g of lastRR.groups) {
    console.log(`  • ${g.name.padEnd(15)} sortOrder=${g.sortOrder}  graczy=${g.players.length}`)
  }

  if (lastRR.groups.length !== 10) {
    throw new Error(`Oczekuję 10 grup w Runda 4, znaleziono ${lastRR.groups.length}. Sprawdź strukturę sezonu.`)
  }

  // Walidacja sortOrder: musi być unikalny (inaczej Prisma zwraca grupy w losowej kolejności
  // dla remisów — RANK_MATRIX zamapowałoby na złe grupy). Zwykle 0..9, ale akceptujemy
  // dowolny unikalny zestaw — liczy się KOLEJNOŚĆ, nie konkretne wartości.
  const sortOrders = lastRR.groups.map((g) => g.sortOrder)
  if (new Set(sortOrders).size !== 10) {
    throw new Error(
      `sortOrder grup nie jest unikalny: [${sortOrders.join(', ')}]. ` +
      `Zweryfikuj metadane grup w bazie — muszą mieć różne wartości, żeby wyznaczyć jednoznaczną kolejność.`
    )
  }

  // 3. Sprawdź istniejącą rundę playoff
  const existingPlayoff = await prisma.round.findFirst({
    where: { seasonId: season.id, type: 'PLAYOFF' },
  })
  if (existingPlayoff && !force) {
    throw new Error(
      `Runda playoff już istnieje (id=${existingPlayoff.id}, "${existingPlayoff.name}"). ` +
      `Użyj --force żeby ją usunąć i utworzyć od nowa (UWAGA: skasuje wszystkie mecze playoff!)`
    )
  }

  // 4. Budowa rankingu 1-48 wg RANK_MATRIX
  const seedToPlayer = new Map<number, RankedPlayer>()
  const outsidePlayoff: string[] = []

  for (let gIdx = 0; gIdx < 10; gIdx++) {
    const group = lastRR.groups[gIdx]
    if (group.players.length !== 5) {
      throw new Error(
        `Grupa "${group.name}" (gIdx=${gIdx}) ma ${group.players.length} graczy, oczekuję 5. ` +
        `Zweryfikuj obsadę rundy przed seedingiem.`
      )
    }
    // Walidacja: finalPosition musi być zbiorem {1,2,3,4,5} w każdej grupie.
    // Bez tego duplikaty (np. 1,2,3,3,4) dają nieokreśloną kolejność w sort ASC
    // i cichy zły mapping do RANK_MATRIX.
    const positions = group.players.map((gp) => gp.finalPosition)
    const expectedPositions = new Set([1, 2, 3, 4, 5])
    const actualPositions = new Set(positions)
    if (
      positions.some((p) => p === null || p === undefined) ||
      actualPositions.size !== 5 ||
      ![...expectedPositions].every((p) => actualPositions.has(p))
    ) {
      throw new Error(
        `Grupa "${group.name}": finalPosition graczy = [${positions.join(', ')}]. ` +
        `Oczekuję dokładnie {1,2,3,4,5} (unikalne, żadnych null). Sprawdź stan rundy w bazie.`
      )
    }
    for (let pos = 0; pos < 5; pos++) {
      const gp = group.players[pos]
      const seed = RANK_MATRIX[gIdx][pos]
      const label = `${gp.player.firstName} ${gp.player.lastName}`
      if (seed === null) {
        outsidePlayoff.push(`${label} (${group.name} pos${pos + 1})`)
        continue
      }
      if (seedToPlayer.has(seed)) {
        const existing = seedToPlayer.get(seed)!
        throw new Error(
          `Duplikat seed ${seed} — konflikt: "${existing.firstName} ${existing.lastName}" vs "${label}"`
        )
      }
      seedToPlayer.set(seed, {
        seed,
        playerId: gp.playerId,
        firstName: gp.player.firstName,
        lastName: gp.player.lastName,
        hcpAtStart: gp.hcpAtStart !== null ? Number(gp.hcpAtStart) : null,
        groupName: group.name,
        positionInGroup: pos + 1,
      })
    }
  }

  if (seedToPlayer.size !== 48) {
    throw new Error(`Oczekuję 48 graczy w rankingu, mam ${seedToPlayer.size}. Sprawdź RANK_MATRIX.`)
  }

  // 5. Podgląd rankingu
  console.log('\n=== Ranking 1-48 (do playoff) ===')
  for (let s = 1; s <= 48; s++) {
    const p = seedToPlayer.get(s)!
    const label = `${p.firstName} ${p.lastName}`
    const hcp = p.hcpAtStart !== null ? `HCP ${p.hcpAtStart}` : '—'
    console.log(`  #${String(s).padStart(2)} ${label.padEnd(28)} ${p.groupName.padEnd(10)} pos${p.positionInGroup}  ${hcp}`)
  }
  console.log(`\n=== Poza playoff (${outsidePlayoff.length}) ===`)
  for (const p of outsidePlayoff) console.log(`  ⊘ ${p}`)

  // 6. Podgląd par R1
  console.log('\n=== R1 pary (24 mecze) ===')
  for (const bracketName of BRACKET_NAMES) {
    console.log(`\n  📊 ${BRACKET_DISPLAY_NAMES[bracketName]} (${bracketName}) — ${BRACKET_HOLES[bracketName]} dołków:`)
    const seeds = BRACKET_SEEDS[bracketName]
    for (let i = 0; i < seeds.length; i++) {
      const [s1, s2] = seeds[i]
      const p1 = seedToPlayer.get(s1)!
      const p2 = seedToPlayer.get(s2)!
      const half = i < 4 ? 'GÓRNA' : 'DOLNA'
      console.log(
        `    ${half} R1 pos${i + 1}: (${s1}) ${p1.firstName} ${p1.lastName}  vs  ${p2.firstName} ${p2.lastName} (${s2})`
      )
    }
  }

  if (dryRun) {
    console.log('\n[DRY-RUN] Nic nie zapisałem. Odpal bez --dry-run żeby wprowadzić do bazy.\n')
    await prisma.$disconnect()
    return
  }

  // 7. Transakcja: (opcjonalnie usuń istniejącą) + utwórz PLAYOFF + 3 grupy + 48 GroupPlayer + 24 Match
  console.log('\n=== Zapis do bazy… ===')

  await prisma.$transaction(
    async (tx) => {
      // Powtórz check istniejącej rundy playoff WEWNĄTRZ transakcji — chroni przed race
      // condition, gdyby ktoś (drugi terminal, /api/admin/playoff/create) utworzył playoff
      // między outer findFirst a startem transakcji.
      const raceCheck = await tx.round.findFirst({
        where: { seasonId: season.id, type: 'PLAYOFF' },
      })
      if (raceCheck && !force) {
        throw new Error(
          `Race: runda playoff (id=${raceCheck.id}) pojawiła się między początkowym checkiem a transakcją. ` +
          `Odpal skrypt jeszcze raz, ewentualnie z --force jeśli chcesz nadpisać.`
        )
      }

      if (force) {
        // deleteMany zamiast delete — idempotentne, nie rzuca gdy nic nie znajdzie
        const deleted = await tx.round.deleteMany({
          where: { seasonId: season.id, type: 'PLAYOFF' },
        })
        if (deleted.count > 0) {
          console.log(`  [FORCE] Skasowano ${deleted.count} rund(ę) playoff (cascade: grupy, mecze, sloty)`)
        }
      }

      const playoffRound = await tx.round.create({
        data: {
          seasonId: season.id,
          name: 'Playoff',
          roundNumber: 99,
          type: 'PLAYOFF',
          status: 'ACTIVE',
          dateStart: new Date('2026-08-17'),
          dateEnd: new Date('2026-10-31'),
          config: { bracketHoles: BRACKET_HOLES },
        },
      })
      console.log(`  ✅ Runda PLAYOFF utworzona (id=${playoffRound.id})`)

      for (let bi = 0; bi < BRACKET_NAMES.length; bi++) {
        const bracketName = BRACKET_NAMES[bi]
        const seeds = BRACKET_SEEDS[bracketName]
        const seedRangeStart = bi * 16 + 1
        const seedRangeEnd = (bi + 1) * 16
        const holes = BRACKET_HOLES[bracketName]

        const group = await tx.group.create({
          data: {
            roundId: playoffRound.id,
            name: BRACKET_DISPLAY_NAMES[bracketName] || `Liga ${bracketName}`,
            sortOrder: bi,
            status: 'ACTIVE',
          },
        })
        console.log(`\n  📊 Drabinka ${bracketName} — "${group.name}" (groupId=${group.id})`)

        // 16 GroupPlayer (finalPosition = globalny seed 1-48)
        for (let s = seedRangeStart; s <= seedRangeEnd; s++) {
          const p = seedToPlayer.get(s)!
          await tx.groupPlayer.create({
            data: {
              groupId: group.id,
              playerId: p.playerId,
              hcpAtStart: p.hcpAtStart,
              finalPosition: s,
            },
          })
        }
        console.log(`     ✓ 16 graczy (seedy ${seedRangeStart}-${seedRangeEnd})`)

        // 8 meczów R1
        for (let i = 0; i < seeds.length; i++) {
          const [s1, s2] = seeds[i]
          const p1 = seedToPlayer.get(s1)!
          const p2 = seedToPlayer.get(s2)!
          await tx.match.create({
            data: {
              groupId: group.id,
              player1Id: p1.playerId,
              player2Id: p2.playerId,
              bracketRound: 1,
              bracketPosition: i + 1,
              holes,
            },
          })
        }
        console.log(`     ✓ 8 meczów R1 (${holes} dołków)`)
      }
    },
    {
      maxWait: 10000,   // czekaj do 10s na start transakcji (default 2s)
      timeout: 120000,  // do 120s na wykonanie (78 inserts, powinno się zmieścić w <5s)
    }
  )

  console.log('\n🏆 Playoff zaseedowany. Zajrzyj na:')
  console.log('   • https://donpapagolf.pl/playoff')
  console.log('   • https://donpapagolf.pl/admin/playoff\n')

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(`\n❌ Błąd: ${e.message}\n`)
  if (e.stack) console.error(e.stack)
  await prisma.$disconnect()
  process.exit(1)
})

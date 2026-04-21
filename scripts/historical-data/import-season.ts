/**
 * Historical season importer.
 *
 * Reads JSON files for all rounds of a historical season (including playoff)
 * and creates Season + Rounds + Groups + GroupPlayers + Matches in a single
 * Prisma transaction. Missing players are created with isHistorical=true + active=false.
 *
 * Usage:
 *   npx tsx scripts/historical-data/import-season.ts \
 *     scripts/historical-data/2025-kwiecien-maj.json \
 *     scripts/historical-data/2025-czerwiec.json \
 *     scripts/historical-data/2025-lipiec.json \
 *     scripts/historical-data/2025-playoff.json
 *
 * Pass --dry-run to preview without writing to DB.
 */

import { PrismaClient, Prisma } from '@prisma/client'
import { readFileSync } from 'fs'
import path from 'path'

const prisma = new PrismaClient()

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RawPlayer {
  name: string
  hcpAtStart: number
  officialPosition?: number
  officialPoints?: number
}

interface RawMatch {
  p1: number
  p2: number
  winner?: number | null
  code: string
  played?: boolean
  isWalkover?: boolean
}

interface RawGroup {
  name: string
  sortOrder: number
  sourceImages?: string[]
  players: RawPlayer[]
  matches: RawMatch[]
}

interface RoundRobinFile {
  _metadata?: unknown
  season: { year: number; name: string; scoringSystem: string }
  round: { name: string; roundNumber: number; holes: number; type: 'ROUND_ROBIN' }
  groups: RawGroup[]
}

interface PlayoffFinalsMatch {
  placementLabel: string
  bracketRound: number
  player1: string
  player2: string
  winner: string | null
  code: string
  comment?: string
}

interface PlayoffBracket {
  name: string
  participants: string[]
  finals: PlayoffFinalsMatch[]
  sourceImage?: string
  _todo?: string
}

interface PlayoffFile {
  _metadata?: unknown
  season: { year: number; name: string; scoringSystem: string }
  round: { name: string; roundNumber: number; holes: number; type: 'PLAYOFF' }
  finalStandings: { position: number; name: string }[]
  brackets: PlayoffBracket[]
}

type SeasonFile = RoundRobinFile | PlayoffFile

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toSlug(firstName: string, lastName: string): string {
  const POLISH: Record<string, string> = {
    ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z',
  }
  return `${firstName}-${lastName}`
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (c) => POLISH[c] || c)
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/)
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  }
}

/**
 * Find existing Player by exact firstName+lastName match, or create a new
 * historical one (active=false, isHistorical=true).
 */
async function upsertPlayer(
  fullName: string,
  tx: Prisma.TransactionClient,
): Promise<{ id: number; firstName: string; lastName: string; slug: string }> {
  const { firstName, lastName } = splitName(fullName)

  // Try exact match
  let player = await tx.player.findFirst({
    where: { firstName, lastName },
    select: { id: true, firstName: true, lastName: true, slug: true },
  })
  if (player) return player

  // Try reversed order (some docs have "Szot Sebastian")
  player = await tx.player.findFirst({
    where: { firstName: lastName, lastName: firstName },
    select: { id: true, firstName: true, lastName: true, slug: true },
  })
  if (player) return player

  // Not found — create new historical player
  let slug = toSlug(firstName, lastName)
  // Ensure slug uniqueness
  let suffix = 0
  while (await tx.player.findUnique({ where: { slug } })) {
    suffix++
    slug = `${toSlug(firstName, lastName)}-${suffix}`
  }

  const created = await tx.player.create({
    data: {
      firstName,
      lastName,
      slug,
      active: false,
      isHistorical: true,
      archivedAt: new Date(),
    },
    select: { id: true, firstName: true, lastName: true, slug: true },
  })
  console.log(`  + Created historical player: ${fullName} (id=${created.id}, slug=${slug})`)
  return created
}

/**
 * Map JSON match to Prisma Match data.
 * Computes big/small points using the historical 1/0.5/0 system.
 */
function computeMatchData(
  m: RawMatch,
  player1Id: number,
  player2Id: number,
): {
  played: boolean
  isWalkover: boolean
  winnerId: number | null
  resultCode: string | null
  player1BigPoints: number
  player2BigPoints: number
  player1SmallPoints: number
  player2SmallPoints: number
} {
  // NP / NZ — not played
  if (m.played === false) {
    return {
      played: false,
      isWalkover: false,
      winnerId: null,
      resultCode: null,
      player1BigPoints: 0,
      player2BigPoints: 0,
      player1SmallPoints: 0,
      player2SmallPoints: 0,
    }
  }

  const isWalkover = !!m.isWalkover

  // Draw (A/S)
  if (m.winner === null || m.winner === undefined) {
    return {
      played: true,
      isWalkover,
      winnerId: null,
      resultCode: m.code,
      player1BigPoints: 0.5,
      player2BigPoints: 0.5,
      player1SmallPoints: 0,
      player2SmallPoints: 0,
    }
  }

  // Decide winner ID by index (0 = p1 slot, 1 = p2 slot, or original index in group)
  // m.winner is the INDEX in group.players array — caller must resolve to actual player ID.
  // For convention: we pass player1Id = group.players[m.p1], player2Id = group.players[m.p2].
  // Winner index is m.winner; p1Wins if m.winner === m.p1.
  const p1Wins = m.winner === m.p1
  const winnerId = p1Wins ? player1Id : player2Id

  // Small points map (margin → small points)
  const smallPointsMap: Record<string, number> = {
    'A/S': 0,
    '1Up': 1,
    '2Up': 2,
    '3Up': 3,
    '4Up': 4,
    '5Up': 5,
    '2&1': 3,
    '3&1': 4,
    '3&2': 5,
    '4&2': 6,
    '4&3': 7,
    '5&3': 8,
    '5&4': 9,
    Ret: 0,
    WO: 0,
  }
  const margin = smallPointsMap[m.code] ?? 0

  return {
    played: true,
    isWalkover,
    winnerId,
    resultCode: m.code,
    player1BigPoints: p1Wins ? 1 : 0,
    player2BigPoints: p1Wins ? 0 : 1,
    player1SmallPoints: p1Wins ? margin : -margin,
    player2SmallPoints: p1Wins ? -margin : margin,
  }
}

// ---------------------------------------------------------------------------
// Main import logic
// ---------------------------------------------------------------------------

async function importSeason(files: string[], dryRun: boolean) {
  console.log(`\n=== Importing historical season ===`)
  console.log(`Files: ${files.length}`)
  console.log(`Dry run: ${dryRun}\n`)

  const parsed: SeasonFile[] = files.map((f) => {
    const raw = readFileSync(f, 'utf-8')
    return JSON.parse(raw) as SeasonFile
  })

  // Assert same season
  const seasonMeta = parsed[0].season
  for (const p of parsed) {
    if (p.season.year !== seasonMeta.year || p.season.name !== seasonMeta.name) {
      throw new Error(
        `Season mismatch: expected ${seasonMeta.name} ${seasonMeta.year}, got ${p.season.name} ${p.season.year}`,
      )
    }
  }

  console.log(`Season: ${seasonMeta.name} (${seasonMeta.year})\n`)

  // Historical seasons use 1/0.5/0 big points.
  const historicalConfig = {
    scoring: {
      win: 1,
      draw: 0.5,
      loss: 0,
      unplayed: 0,
      walkover_winner: 1,
      walkover_loser: 0,
    },
    small_points_map: {
      'A/S': [0, 0],
      '1Up': [1, -1],
      '2Up': [2, -2],
      '3Up': [3, -3],
      '4Up': [4, -4],
      '5Up': [5, -5],
      '2&1': [3, -3],
      '3&1': [4, -4],
      '3&2': [5, -5],
      '4&2': [6, -6],
      '4&3': [7, -7],
      '5&3': [8, -8],
      '5&4': [9, -9],
      Ret: [0, 0],
    },
  }

  await prisma.$transaction(
    async (tx) => {
      // --- Create/find Season
      let season = await tx.season.findFirst({
        where: { year: seasonMeta.year, name: seasonMeta.name },
      })
      if (season) {
        console.log(`Season already exists (id=${season.id}). Appending rounds.`)
      } else {
        season = await tx.season.create({
          data: {
            name: seasonMeta.name,
            year: seasonMeta.year,
            status: 'COMPLETED',
            config: historicalConfig,
          },
        })
        console.log(`Created Season id=${season.id}`)
      }

      // --- Process each file
      let totalPlayers = 0
      let totalGroups = 0
      let totalMatches = 0

      for (const file of parsed) {
        const isPlayoff = file.round.type === 'PLAYOFF'
        console.log(`\n-- Round: ${file.round.name} (${file.round.type})`)

        const round = await tx.round.create({
          data: {
            seasonId: season.id,
            name: file.round.name,
            roundNumber: file.round.roundNumber,
            type: file.round.type,
            holes: file.round.holes,
            status: 'COMPLETED',
          },
        })

        if (isPlayoff) {
          const playoffFile = file as PlayoffFile
          // Each bracket becomes a Group; finals become Matches with bracketRound
          for (let bi = 0; bi < playoffFile.brackets.length; bi++) {
            const bracket = playoffFile.brackets[bi]
            const group = await tx.group.create({
              data: {
                roundId: round.id,
                name: bracket.name,
                sortOrder: bi,
                status: 'COMPLETED',
              },
            })
            totalGroups++

            // Resolve all participants + write GroupPlayer with final positions from finalStandings
            for (const name of bracket.participants) {
              const player = await upsertPlayer(name, tx)
              const finalRank = playoffFile.finalStandings.find((s) => s.name === name)
              await tx.groupPlayer.create({
                data: {
                  groupId: group.id,
                  playerId: player.id,
                  hcpAtStart: null,
                  finalPosition: finalRank?.position ?? null,
                },
              })
              totalPlayers++
            }

            // Create matches from finals (semis + finals)
            for (const m of bracket.finals) {
              const p1 = await upsertPlayer(m.player1, tx)
              const p2 = await upsertPlayer(m.player2, tx)
              const winnerIsP1 = m.winner === m.player1
              const winnerId = m.winner ? (winnerIsP1 ? p1.id : p2.id) : null

              const smallPointsMap: Record<string, number> = {
                'A/S': 0, '1Up': 1, '2Up': 2, '3Up': 3, '4Up': 4, '5Up': 5,
                '2&1': 3, '3&1': 4, '3&2': 5, '4&2': 6, '4&3': 7, '5&3': 8, '5&4': 9,
                Ret: 0, WO: 0,
              }
              const margin = smallPointsMap[m.code] ?? 0

              await tx.match.create({
                data: {
                  groupId: group.id,
                  player1Id: p1.id,
                  player2Id: p2.id,
                  played: true,
                  winnerId,
                  resultCode: m.code,
                  isWalkover: m.code === 'WO',
                  player1BigPoints: winnerId === null ? 0.5 : winnerIsP1 ? 1 : 0,
                  player2BigPoints: winnerId === null ? 0.5 : winnerIsP1 ? 0 : 1,
                  player1SmallPoints: winnerId === null ? 0 : winnerIsP1 ? margin : -margin,
                  player2SmallPoints: winnerId === null ? 0 : winnerIsP1 ? -margin : margin,
                  bracketRound: m.bracketRound,
                  holes: file.round.holes,
                  notes: m.comment ?? null,
                },
              })
              totalMatches++
            }
          }
        } else {
          // ROUND_ROBIN
          const rrFile = file as RoundRobinFile
          for (const grp of rrFile.groups) {
            const group = await tx.group.create({
              data: {
                roundId: round.id,
                name: grp.name,
                sortOrder: grp.sortOrder,
                status: 'COMPLETED',
              },
            })
            totalGroups++

            // Resolve players and create GroupPlayer
            const playerIds: number[] = []
            for (const p of grp.players) {
              const player = await upsertPlayer(p.name, tx)
              playerIds.push(player.id)
              await tx.groupPlayer.create({
                data: {
                  groupId: group.id,
                  playerId: player.id,
                  hcpAtStart: p.hcpAtStart,
                  finalPosition: p.officialPosition ?? null,
                },
              })
              totalPlayers++
            }

            // Create matches
            for (const m of grp.matches) {
              const player1Id = playerIds[m.p1]
              const player2Id = playerIds[m.p2]
              const md = computeMatchData(m, player1Id, player2Id)
              await tx.match.create({
                data: {
                  groupId: group.id,
                  player1Id,
                  player2Id,
                  ...md,
                  holes: file.round.holes,
                },
              })
              totalMatches++
            }
          }
        }
      }

      console.log(`\n=== Import summary ===`)
      console.log(`Groups created:   ${totalGroups}`)
      console.log(`GroupPlayer rows: ${totalPlayers}`)
      console.log(`Matches created:  ${totalMatches}`)

      if (dryRun) {
        console.log(`\n⚠️  Dry run — rolling back transaction`)
        throw new Error('__DRY_RUN_ROLLBACK__')
      }
    },
    { timeout: 120000 },
  ).catch((err) => {
    if (err instanceof Error && err.message === '__DRY_RUN_ROLLBACK__') {
      console.log(`Dry run complete — no changes written`)
      return
    }
    throw err
  })
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const files = args.filter((a) => !a.startsWith('--'))

if (files.length === 0) {
  console.error('Usage: npx tsx scripts/historical-data/import-season.ts [--dry-run] <file1.json> [file2.json] ...')
  process.exit(1)
}

importSeason(files, dryRun)
  .then(() => {
    console.log('\nDone.')
    return prisma.$disconnect()
  })
  .catch(async (err) => {
    console.error('Import failed:', err)
    await prisma.$disconnect()
    process.exit(1)
  })

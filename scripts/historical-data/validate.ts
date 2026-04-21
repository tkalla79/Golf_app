/**
 * Validator for historical season JSON files.
 * Checks consistency between match matrix and official ranking.
 *
 * Usage: npx tsx scripts/historical-data/validate.ts <file.json>
 */

import { readFileSync } from 'fs'
import path from 'path'

interface Match {
  p1: number
  p2: number
  winner?: number | null
  code: string
  played?: boolean
  isWalkover?: boolean
}

interface PlayerEntry {
  name: string
  hcpAtStart: number
  officialPosition: number
  officialPoints: number
}

interface GroupData {
  name: string
  players: PlayerEntry[]
  matches: Match[]
}

interface SeasonJson {
  season: { year: number; name: string; scoringSystem: string }
  round: { name: string; roundNumber: number; holes: number; type: string }
  groups: GroupData[]
}

function bigPointsFor(match: Match, playerIdx: number): number {
  if (match.played === false) return 0
  if (match.winner === null || match.winner === undefined) {
    // Draw (A/S) — 0.5 each under historical system
    return 0.5
  }
  return match.winner === playerIdx ? 1 : 0
}

interface Discrepancy {
  group: string
  player: string
  computed: number
  official: number
  diff: number
}

function validateFile(filePath: string) {
  const raw = readFileSync(filePath, 'utf-8')
  const data: SeasonJson = JSON.parse(raw)

  console.log(`\n=== Validating ${path.basename(filePath)} ===`)
  console.log(`Season: ${data.season.name} (${data.season.year})`)
  console.log(`Round:  ${data.round.name}\n`)

  const allDiscrepancies: Discrepancy[] = []
  let totalMatches = 0
  let playedMatches = 0
  let notPlayedMatches = 0

  for (const group of data.groups) {
    console.log(`--- Group ${group.name} (${group.players.length} players) ---`)
    const n = group.players.length
    const expectedMatches = (n * (n - 1)) / 2
    console.log(`Matches: ${group.matches.length} / expected ${expectedMatches}`)
    if (group.matches.length !== expectedMatches) {
      console.log(`  ⚠️  WRONG MATCH COUNT`)
    }

    totalMatches += group.matches.length
    notPlayedMatches += group.matches.filter((m) => m.played === false).length
    playedMatches += group.matches.filter((m) => m.played !== false).length

    // Sum big points per player
    const computedPoints = new Array(n).fill(0)
    for (const m of group.matches) {
      if (m.played === false) continue
      computedPoints[m.p1] += bigPointsFor(m, m.p1)
      computedPoints[m.p2] += bigPointsFor(m, m.p2)
    }

    let groupDiscrepancies = 0
    for (let i = 0; i < n; i++) {
      const p = group.players[i]
      const diff = computedPoints[i] - p.officialPoints
      if (Math.abs(diff) > 0.01) {
        console.log(
          `  ⚠️  ${p.name}: matrix=${computedPoints[i]} vs official=${p.officialPoints} (diff ${diff > 0 ? '+' : ''}${diff.toFixed(1)})`,
        )
        allDiscrepancies.push({
          group: group.name,
          player: p.name,
          computed: computedPoints[i],
          official: p.officialPoints,
          diff,
        })
        groupDiscrepancies++
      }
    }
    if (groupDiscrepancies === 0) {
      console.log(`  ✅ All points match official ranking`)
    }
  }

  console.log(`\n=== Summary ===`)
  console.log(`Total matches:     ${totalMatches}`)
  console.log(`Played:            ${playedMatches}`)
  console.log(`Not played (NP):   ${notPlayedMatches}`)
  console.log(`Total discrepancies: ${allDiscrepancies.length}`)

  if (allDiscrepancies.length > 0) {
    console.log(`\n=== Discrepancies (matrix ≠ official ranking) ===`)
    for (const d of allDiscrepancies) {
      console.log(
        `Gr ${d.group} — ${d.player}: matrix ${d.computed} vs official ${d.official} (Δ ${d.diff > 0 ? '+' : ''}${d.diff.toFixed(1)})`,
      )
    }
  }
}

const file = process.argv[2]
if (!file) {
  console.error('Usage: npx tsx scripts/historical-data/validate.ts <file.json>')
  process.exit(1)
}
validateFile(file)

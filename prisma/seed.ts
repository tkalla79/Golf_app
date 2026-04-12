import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import * as fs from 'fs'
import * as path from 'path'
import { createSlug } from '../src/lib/slug'

const prisma = new PrismaClient()

interface PlayerRow {
  firstName: string
  lastName: string
  email: string
  group: number | null
}

function loadPlayersFromCSV(): PlayerRow[] {
  const csvPath = path.join(__dirname, '..', 'DOCS', 'gracze_grupy_2026.csv')
  const content = fs.readFileSync(csvPath, 'utf-8')
  const lines = content.trim().split('\n').slice(1) // skip header

  return lines
    .filter((line) => line.trim())
    .map((line) => {
      const [firstName, lastName, email, group] = line.split(',')
      return {
        firstName: firstName?.trim() || '',
        lastName: lastName?.trim() || '',
        email: email?.trim() || '',
        group: group?.trim() ? parseInt(group.trim()) : null,
      }
    })
    .filter((p) => p.firstName)
}

async function main() {
  // Create 3 admins
  const adminPassword = await bcrypt.hash('admin123', 10)

  const admins = [
    { email: 'slawomir.olszynski@codelabs.pl', firstName: 'Sławomir', lastName: 'Olszyński', password: '0lPDh8D0wVEdCFXy' },
    { email: 'm.kucia@hardbeans.com', firstName: 'Marcin', lastName: 'Kucia', password: 'GS4CYegrIQYQqUAc' },
    { email: 't.kalla@k2biznes.pl', firstName: 'Tomasz', lastName: 'Kalla', password: 'CVZBnsBFZeA14POk' },
  ]

  for (const admin of admins) {
    const hash = await bcrypt.hash(admin.password, 10)
    await prisma.admin.upsert({
      where: { email: admin.email },
      update: {},
      create: {
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
        passwordHash: hash,
      },
    })
  }
  console.log('3 admins seeded')

  // Load players from CSV
  const playerRows = loadPlayersFromCSV()
  console.log(`Loaded ${playerRows.length} players from CSV`)

  for (const p of playerRows) {
    const slug = createSlug(p.firstName, p.lastName)

    await prisma.player.upsert({
      where: { slug },
      update: {
        email: p.email || null,
      },
      create: {
        firstName: p.firstName,
        lastName: p.lastName,
        slug,
        email: p.email || null,
      },
    })
  }
  console.log(`${playerRows.length} players seeded`)

  // Create 2026 season
  const season = await prisma.season.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'Don Papa Match Play 2026',
      year: 2026,
      status: 'ACTIVE',
      config: {
        scoring: { win: 3, draw: 2, loss: 1, unplayed: 0, walkover_winner: 3, walkover_loser: 0 },
        small_points_map: {
          'A/S': [0, 0], '1Up': [1, -1], '2Up': [2, -2], '2&1': [3, -3],
          '3&1': [4, -4], '3&2': [5, -5], '4&2': [6, -6], '4&3': [7, -7],
          '5&3': [8, -8], '5&4': [9, -9],
        },
      },
    },
  })

  // Create preliminary round
  const round = await prisma.round.upsert({
    where: { id: 1 },
    update: {},
    create: {
      seasonId: season.id,
      name: 'Runda wstępna',
      roundNumber: 1,
      type: 'ROUND_ROBIN',
      holes: 9,
      dateStart: new Date('2026-03-22'),
      dateEnd: new Date('2026-05-24'),
      status: 'ACTIVE',
    },
  })

  // Create 5 groups and assign players
  const allPlayers = await prisma.player.findMany({ where: { active: true } })
  const playerBySlug = new Map(allPlayers.map((p) => [p.slug, p]))

  for (let g = 1; g <= 5; g++) {
    const group = await prisma.group.upsert({
      where: { id: g },
      update: {},
      create: {
        roundId: round.id,
        name: `Grupa ${g}`,
        sortOrder: g - 1,
        status: 'ACTIVE',
      },
    })

    const groupPlayers = playerRows.filter((p) => p.group === g)

    for (const p of groupPlayers) {
      const slug = createSlug(p.firstName, p.lastName)
      const player = playerBySlug.get(slug)
      if (!player) {
        console.warn(`Player not found: ${p.firstName} ${p.lastName} (slug: ${slug})`)
        continue
      }

      await prisma.groupPlayer.upsert({
        where: { groupId_playerId: { groupId: group.id, playerId: player.id } },
        update: {},
        create: {
          groupId: group.id,
          playerId: player.id,
          hcpAtStart: player.hcp,
        },
      })
    }

    // Generate round-robin matches
    const gps = await prisma.groupPlayer.findMany({ where: { groupId: group.id } })
    const playerIds = gps.map((gp) => gp.playerId)

    for (let i = 0; i < playerIds.length; i++) {
      for (let j = i + 1; j < playerIds.length; j++) {
        const existing = await prisma.match.findFirst({
          where: { groupId: group.id, player1Id: playerIds[i], player2Id: playerIds[j] },
        })
        if (!existing) {
          await prisma.match.create({
            data: { groupId: group.id, player1Id: playerIds[i], player2Id: playerIds[j] },
          })
        }
      }
    }

    console.log(`Group ${g}: ${groupPlayers.length} players, ${playerIds.length * (playerIds.length - 1) / 2} matches`)
  }

  console.log('Season 2026 with real players seeded!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })

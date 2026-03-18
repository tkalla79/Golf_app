import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Create 3 admins
  const adminPassword = await bcrypt.hash('admin123', 10)

  const admins = [
    { email: 'admin1@karolinkagolfpark.pl', firstName: 'Admin', lastName: 'Pierwszy' },
    { email: 'admin2@karolinkagolfpark.pl', firstName: 'Admin', lastName: 'Drugi' },
    { email: 'admin3@karolinkagolfpark.pl', firstName: 'Admin', lastName: 'Trzeci' },
  ]

  for (const admin of admins) {
    await prisma.admin.upsert({
      where: { email: admin.email },
      update: {},
      create: {
        ...admin,
        passwordHash: adminPassword,
      },
    })
  }

  console.log('Admins seeded')

  // Create test players
  const players = [
    { firstName: 'Jan', lastName: 'Kowalski', hcp: 12.5 },
    { firstName: 'Piotr', lastName: 'Nowak', hcp: 8.3 },
    { firstName: 'Marek', lastName: 'Wiśniewski', hcp: 15.0 },
    { firstName: 'Tomasz', lastName: 'Wójcik', hcp: 22.1 },
    { firstName: 'Krzysztof', lastName: 'Kamiński', hcp: 5.7 },
    { firstName: 'Adam', lastName: 'Lewandowski', hcp: 18.4 },
    { firstName: 'Michał', lastName: 'Zieliński', hcp: 10.2 },
    { firstName: 'Andrzej', lastName: 'Szymański', hcp: 14.8 },
    { firstName: 'Robert', lastName: 'Woźniak', hcp: 20.5 },
    { firstName: 'Paweł', lastName: 'Dąbrowski', hcp: 7.1 },
  ]

  for (const p of players) {
    const slug = `${p.firstName.toLowerCase()}-${p.lastName.toLowerCase()}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')

    await prisma.player.upsert({
      where: { slug },
      update: {},
      create: {
        ...p,
        slug,
        email: `${p.firstName.toLowerCase()}@example.com`,
        phone: `+48 ${Math.floor(500000000 + Math.random() * 100000000)}`,
      },
    })
  }

  console.log('Players seeded')

  // Create 2026 season with config
  const season = await prisma.season.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'Don Papa Match Play 2026',
      year: 2026,
      status: 'ACTIVE',
      config: {
        scoring: {
          win: 3,
          draw: 2,
          loss: 1,
          unplayed: 0,
          walkover_winner: 3,
          walkover_loser: 0,
        },
        small_points_map: {
          'Tied': [0, 0],
          '1Up': [1, -1],
          '2Up': [2, -2],
          '2&1': [3, -3],
          '3&1': [4, -4],
          '3&2': [5, -5],
          '4&2': [6, -6],
          '4&3': [7, -7],
          '5&3': [8, -8],
          '5&4': [9, -9],
        },
      },
    },
  })

  // Create preliminary round with 2 groups of 5 players
  const round = await prisma.round.upsert({
    where: { id: 1 },
    update: {},
    create: {
      seasonId: season.id,
      name: 'Runda eliminacyjna',
      roundNumber: 1,
      type: 'ROUND_ROBIN',
      holes: 9,
      dateStart: new Date('2026-03-22'),
      dateEnd: new Date('2026-05-24'),
      status: 'ACTIVE',
    },
  })

  const allPlayers = await prisma.player.findMany({ orderBy: { id: 'asc' } })

  // Group 1: first 5 players
  const group1 = await prisma.group.upsert({
    where: { id: 1 },
    update: {},
    create: {
      roundId: round.id,
      name: 'Grupa 1',
      sortOrder: 0,
      status: 'ACTIVE',
    },
  })

  // Group 2: next 5 players
  const group2 = await prisma.group.upsert({
    where: { id: 2 },
    update: {},
    create: {
      roundId: round.id,
      name: 'Grupa 2',
      sortOrder: 1,
      status: 'ACTIVE',
    },
  })

  // Assign players and create round-robin matches
  for (const [groupId, playerSlice] of [
    [group1.id, allPlayers.slice(0, 5)],
    [group2.id, allPlayers.slice(5, 10)],
  ] as const) {
    for (const p of playerSlice) {
      await prisma.groupPlayer.upsert({
        where: { groupId_playerId: { groupId, playerId: p.id } },
        update: {},
        create: {
          groupId,
          playerId: p.id,
          hcpAtStart: p.hcp,
        },
      })
    }

    // Create round-robin matches
    for (let i = 0; i < playerSlice.length; i++) {
      for (let j = i + 1; j < playerSlice.length; j++) {
        const existing = await prisma.match.findFirst({
          where: {
            groupId,
            player1Id: playerSlice[i].id,
            player2Id: playerSlice[j].id,
          },
        })
        if (!existing) {
          await prisma.match.create({
            data: {
              groupId,
              player1Id: playerSlice[i].id,
              player2Id: playerSlice[j].id,
            },
          })
        }
      }
    }
  }

  console.log('Season, rounds, groups, and matches seeded')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

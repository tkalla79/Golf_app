import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const PLAYER_NAMES = [
  ['Jan', 'Kowalski'], ['Piotr', 'Nowak'], ['Marek', 'Wiśniewski'], ['Tomasz', 'Wójcik'],
  ['Krzysztof', 'Kamiński'], ['Adam', 'Lewandowski'], ['Michał', 'Zieliński'], ['Andrzej', 'Szymański'],
  ['Robert', 'Woźniak'], ['Paweł', 'Dąbrowski'], ['Stanisław', 'Kozłowski'], ['Grzegorz', 'Jankowski'],
  ['Jacek', 'Mazur'], ['Zbigniew', 'Kwiatkowski'], ['Jerzy', 'Krawczyk'], ['Henryk', 'Piotrowski'],
  ['Ryszard', 'Grabowski'], ['Kazimierz', 'Nowakowski'], ['Tadeusz', 'Pawłowski'], ['Marian', 'Michalski'],
  ['Rafał', 'Adamczyk'], ['Dariusz', 'Dudek'], ['Marcin', 'Wieczorek'], ['Artur', 'Jabłoński'],
  ['Leszek', 'Król'], ['Bogdan', 'Majewski'], ['Wiesław', 'Olszewski'], ['Sławomir', 'Jaworski'],
  ['Roman', 'Stępień'], ['Mirosław', 'Urbański'], ['Wojciech', 'Walczak'], ['Władysław', 'Górski'],
  ['Czesław', 'Rutkowski'], ['Janusz', 'Michalak'], ['Zdzisław', 'Sikora'], ['Edward', 'Baran'],
  ['Eugeniusz', 'Chmielewski'], ['Ireneusz', 'Lis'], ['Mariusz', 'Mazurek'], ['Witold', 'Kalinowski'],
  ['Stefan', 'Wysocki'], ['Bogusław', 'Adamski'], ['Norbert', 'Pietrzak'], ['Konrad', 'Wróblewski'],
  ['Bartosz', 'Markowski'], ['Kamil', 'Kubiak'], ['Łukasz', 'Borkowski'], ['Damian', 'Czerwiński'],
  ['Filip', 'Sobczak'], ['Dawid', 'Zawadzki'],
]

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
      create: { ...admin, passwordHash: adminPassword },
    })
  }
  console.log('3 admins seeded')

  // Create 50 players
  for (const [firstName, lastName] of PLAYER_NAMES) {
    const slug = `${firstName}-${lastName}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-')

    const hcp = parseFloat((Math.random() * 36).toFixed(1))

    await prisma.player.upsert({
      where: { slug },
      update: {},
      create: {
        firstName,
        lastName,
        slug,
        hcp,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}@example.com`,
        phone: `+48 ${Math.floor(500000000 + Math.random() * 100000000)}`,
      },
    })
  }
  console.log('50 players seeded')

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
          'Tied': [0, 0], '1Up': [1, -1], '2Up': [2, -2], '2&1': [3, -3],
          '3&1': [4, -4], '3&2': [5, -5], '4&2': [6, -6], '4&3': [7, -7],
          '5&3': [8, -8], '5&4': [9, -9],
        },
      },
    },
  })

  // Create preliminary round with 5 groups of 10 players
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

  const allPlayers = await prisma.player.findMany({
    where: { active: true },
    orderBy: { hcp: 'asc' },
    take: 50,
  })

  // Create 5 groups
  const groupSize = Math.ceil(allPlayers.length / 5)
  for (let g = 0; g < 5; g++) {
    const groupPlayers = allPlayers.slice(g * groupSize, (g + 1) * groupSize)
    if (groupPlayers.length === 0) continue

    const group = await prisma.group.upsert({
      where: { id: g + 1 },
      update: {},
      create: {
        roundId: round.id,
        name: `Grupa ${g + 1}`,
        sortOrder: g,
        status: 'ACTIVE',
      },
    })

    // Assign players
    for (const p of groupPlayers) {
      await prisma.groupPlayer.upsert({
        where: { groupId_playerId: { groupId: group.id, playerId: p.id } },
        update: {},
        create: { groupId: group.id, playerId: p.id, hcpAtStart: p.hcp },
      })
    }

    // Create round-robin matches
    for (let i = 0; i < groupPlayers.length; i++) {
      for (let j = i + 1; j < groupPlayers.length; j++) {
        const existing = await prisma.match.findFirst({
          where: { groupId: group.id, player1Id: groupPlayers[i].id, player2Id: groupPlayers[j].id },
        })
        if (!existing) {
          await prisma.match.create({
            data: { groupId: group.id, player1Id: groupPlayers[i].id, player2Id: groupPlayers[j].id },
          })
        }
      }
    }
  }

  console.log('Season with 5 groups of 10 players seeded (50 players total)')

  // Add some sample results to group 1 for demo
  const group1Matches = await prisma.match.findMany({
    where: { groupId: 1 },
    take: 5,
  })

  const results = [
    { resultCode: '3&2', winnerId: null, isWalkover: false },
    { resultCode: '1Up', winnerId: null, isWalkover: false },
    { resultCode: 'Tied', winnerId: null, isWalkover: false },
    { resultCode: '5&4', winnerId: null, isWalkover: false },
    { resultCode: 'Walkover', winnerId: null, isWalkover: true },
  ]

  const config = {
    scoring: { win: 3, draw: 2, loss: 1, unplayed: 0, walkover_winner: 3, walkover_loser: 0 },
    small_points_map: {
      'Tied': [0, 0], '1Up': [1, -1], '2Up': [2, -2], '2&1': [3, -3],
      '3&1': [4, -4], '3&2': [5, -5], '4&2': [6, -6], '4&3': [7, -7],
      '5&3': [8, -8], '5&4': [9, -9],
    },
  }

  for (let i = 0; i < Math.min(group1Matches.length, results.length); i++) {
    const match = group1Matches[i]
    const result = results[i]
    const isTied = result.resultCode === 'Tied'
    const winnerId = isTied ? null : match.player1Id // player1 wins for demo
    const isWalkover = result.isWalkover

    let p1Big = 0, p2Big = 0, p1Small = 0, p2Small = 0

    if (isWalkover) {
      p1Big = config.scoring.walkover_winner
      p2Big = config.scoring.walkover_loser
    } else if (isTied) {
      p1Big = config.scoring.draw
      p2Big = config.scoring.draw
    } else {
      p1Big = config.scoring.win
      p2Big = config.scoring.loss
      const sp = config.small_points_map[result.resultCode] || [0, 0]
      p1Small = sp[0]
      p2Small = sp[1]
    }

    await prisma.match.update({
      where: { id: match.id },
      data: {
        played: true,
        resultCode: isWalkover ? 'Walkover' : result.resultCode,
        winnerId,
        isWalkover,
        player1BigPoints: p1Big,
        player2BigPoints: p2Big,
        player1SmallPoints: p1Small,
        player2SmallPoints: p2Small,
      },
    })
  }

  console.log('Sample results added to Group 1')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })

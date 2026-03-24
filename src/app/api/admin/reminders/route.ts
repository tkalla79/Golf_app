import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendMatchReminder } from '@/lib/mail'

export async function POST() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Find active rounds with deadlines
  const rounds = await prisma.round.findMany({
    where: {
      status: 'ACTIVE',
      dateEnd: { not: null },
    },
    include: {
      season: true,
      groups: {
        include: {
          matches: {
            where: { played: false },
            include: { player1: true, player2: true },
          },
        },
      },
    },
  })

  // Idempotency: check if reminders were already sent today
  const todayStr = today.toISOString().slice(0, 10)
  const alreadySent = await prisma.match.findFirst({
    where: {
      played: false,
      notes: { contains: `reminder:${todayStr}` },
    },
  })

  if (alreadySent) {
    return NextResponse.json({ sent: 0, errors: 0, details: ['Przypomnienia zostały już wysłane dzisiaj.'] })
  }

  let sent = 0
  const errors: string[] = []

  for (const round of rounds) {
    if (!round.dateEnd) continue

    const deadline = new Date(round.dateEnd)
    deadline.setHours(0, 0, 0, 0)
    const daysLeft = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    // Only send at 7 days and 2 days before deadline
    if (daysLeft !== 7 && daysLeft !== 2) continue

    const deadlineStr = deadline.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })
    const isPlayoff = round.type === 'PLAYOFF'

    for (const group of round.groups) {
      for (const match of group.matches) {
        // Send to player1
        if (match.player1.email) {
          try {
            await sendMatchReminder(
              match.player1.email,
              match.player1.firstName,
              `${match.player2.firstName} ${match.player2.lastName}`,
              group.name,
              round.name,
              deadlineStr,
              daysLeft,
              isPlayoff,
            )
            sent++
          } catch (e) {
            errors.push(`Failed: ${match.player1.email} - ${e}`)
          }
        }

        // Send to player2
        if (match.player2.email) {
          try {
            await sendMatchReminder(
              match.player2.email,
              match.player2.firstName,
              `${match.player1.firstName} ${match.player1.lastName}`,
              group.name,
              round.name,
              deadlineStr,
              daysLeft,
              isPlayoff,
            )
            sent++
          } catch (e) {
            errors.push(`Failed: ${match.player2.email} - ${e}`)
          }
        }
      }
    }
  }

  // Mark matches as reminded today (for idempotency)
  if (sent > 0) {
    for (const round of rounds) {
      if (!round.dateEnd) continue
      const deadline = new Date(round.dateEnd)
      deadline.setHours(0, 0, 0, 0)
      const daysLeft = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      if (daysLeft !== 7 && daysLeft !== 2) continue

      for (const group of round.groups) {
        for (const match of group.matches) {
          await prisma.match.update({
            where: { id: match.id },
            data: { notes: [match.notes, `reminder:${todayStr}`].filter(Boolean).join('; ') },
          })
        }
      }
    }
  }

  return NextResponse.json({ sent, errors: errors.length, details: errors.slice(0, 10) })
}

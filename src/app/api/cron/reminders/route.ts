import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendMatchReminder } from '@/lib/mail'

// Called by external cron (e.g., cron-job.org, or server crontab via curl)
// Protected by CRON_SECRET env var
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Same logic as /api/admin/reminders but without session auth
  const today = new Date()
  today.setHours(0, 0, 0, 0)

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

  // Idempotency: skip if already sent today
  const todayStr = today.toISOString().slice(0, 10)
  const alreadySent = await prisma.match.findFirst({
    where: { played: false, notes: { contains: `reminder:${todayStr}` } },
  })
  if (alreadySent) {
    return NextResponse.json({ sent: 0, errors: 0, skipped: true, timestamp: new Date().toISOString() })
  }

  let sent = 0
  const errors: string[] = []

  for (const round of rounds) {
    if (!round.dateEnd) continue

    const deadline = new Date(round.dateEnd)
    deadline.setHours(0, 0, 0, 0)
    const daysLeft = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    if (daysLeft !== 7 && daysLeft !== 2) continue

    const deadlineStr = deadline.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })
    const isPlayoff = round.type === 'PLAYOFF'

    for (const group of round.groups) {
      for (const match of group.matches) {
        for (const [player, opponent] of [
          [match.player1, match.player2],
          [match.player2, match.player1],
        ]) {
          if (player.email) {
            try {
              await sendMatchReminder(
                player.email,
                player.firstName,
                `${opponent.firstName} ${opponent.lastName}`,
                group.name,
                round.name,
                deadlineStr,
                daysLeft,
                isPlayoff,
              )
              sent++
            } catch (e) {
              errors.push(`Failed: ${player.email}`)
            }
          }
        }
      }
    }
  }

  // Mark as sent for idempotency
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

  return NextResponse.json({ sent, errors: errors.length, timestamp: new Date().toISOString() })
}

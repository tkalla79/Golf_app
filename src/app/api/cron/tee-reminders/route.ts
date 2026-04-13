import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendTeeTimeReminder } from '@/lib/mail'

// Called every 15 min by external cron
// Finds matches with scheduledDate in (NOW-15min) → (NOW+2h15min) window, reminderSent=false
// Atomically marks reminderSent=true BEFORE sending emails to prevent duplicates
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const receptionEmail = process.env.RECEPTION_EMAIL
  if (!receptionEmail) {
    return NextResponse.json({ error: 'RECEPTION_EMAIL not configured' }, { status: 500 })
  }

  const now = new Date()
  // Look back 15 min to catch any matches missed by a skipped cron cycle
  const windowStart = new Date(now.getTime() - 15 * 60 * 1000)
  const windowEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000 + 15 * 60 * 1000) // +2h15m

  // Step 1: Atomically claim matches — single updateMany prevents concurrent double-sends
  const claimed = await prisma.match.updateMany({
    where: {
      played: false,
      reminderSent: false,
      scheduledDate: {
        gte: windowStart,
        lte: windowEnd,
      },
    },
    data: { reminderSent: true },
  })

  if (claimed.count === 0) {
    return NextResponse.json({ sent: 0, errors: 0, matchesFound: 0, timestamp: now.toISOString() })
  }

  // Step 2: Fetch full data for freshly claimed matches only
  // Filter by updatedAt to avoid re-sending for matches claimed in previous cron runs
  const claimCutoff = new Date(now.getTime() - 60 * 1000) // 1 minute ago
  const matches = await prisma.match.findMany({
    where: {
      reminderSent: true,
      played: false,
      updatedAt: { gte: claimCutoff },
      scheduledDate: {
        gte: windowStart,
        lte: windowEnd,
      },
    },
    include: {
      player1: { select: { firstName: true, lastName: true, email: true } },
      player2: { select: { firstName: true, lastName: true, email: true } },
      group: {
        select: {
          name: true,
          round: { select: { name: true } },
        },
      },
    },
  })

  let sent = 0
  const errors: string[] = []

  for (const match of matches) {
    if (!match.scheduledDate) continue

    const teeTime = match.scheduledDate.toLocaleString('pl-PL', {
      timeZone: 'Europe/Warsaw',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    })

    const playerEmails = [match.player1.email, match.player2.email].filter(Boolean) as string[]
    const player1Name = `${match.player1.firstName} ${match.player1.lastName}`
    const player2Name = `${match.player2.firstName} ${match.player2.lastName}`

    // Skip if no player emails
    if (playerEmails.length === 0) {
      errors.push(`Match ${match.id}: brak emaili graczy`)
      continue
    }

    const emailErrors = await sendTeeTimeReminder(playerEmails, receptionEmail, {
      player1Name,
      player2Name,
      teeTime,
      groupName: match.group.name,
      roundName: match.group.round.name,
    })
    if (emailErrors.length > 0) {
      errors.push(...emailErrors.map((e) => `Match ${match.id}: ${e}`))
    }
    sent++
  }

  return NextResponse.json({
    sent,
    errors: errors.length,
    matchesFound: matches.length,
    timestamp: now.toISOString(),
  })
}

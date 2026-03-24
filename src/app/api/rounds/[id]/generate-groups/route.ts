import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { generateNextRoundGroups, generatePromotionRelegation } from '@/lib/group-generator'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const roundId = parseInt(id)

  try {
    // Determine which generator to use based on round number
    const round = await prisma.round.findUnique({ where: { id: roundId } })
    if (!round) {
      return NextResponse.json({ error: 'Runda nie znaleziona' }, { status: 404 })
    }

    // Round 1 → Round 2: full regrouping (1st from each group → A, 2nd → B, etc.)
    // Round 2+ → Round 3+: promotion/relegation (1-2 up, 3 stays, 4-5 down)
    const groups = round.roundNumber <= 1
      ? await generateNextRoundGroups(roundId)
      : await generatePromotionRelegation(roundId)

    return NextResponse.json(groups)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Błąd generowania' },
      { status: 400 }
    )
  }
}

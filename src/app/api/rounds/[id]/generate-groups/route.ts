import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { generateNextRoundGroups } from '@/lib/group-generator'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  try {
    const groups = await generateNextRoundGroups(parseInt(id))
    return NextResponse.json(groups)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Błąd generowania' },
      { status: 400 }
    )
  }
}

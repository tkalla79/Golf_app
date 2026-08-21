import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'

// Strona pyta bazę o istnienie rundy playoff, więc nie może być prerenderowana —
// przy `next build` (także w obrazie Dockera, gdzie DATABASE_URL to atrapa) nie ma
// czego odpytać i build pada na „Error occurred prerendering page /".
// Konwencja spójna z pozostałymi stronami korzystającymi z Prismy.
export const dynamic = 'force-dynamic'

/**
 * Strona startowa prowadzi do aktualnie najważniejszej fazy sezonu:
 * gdy playoff istnieje — na drabinki, w trakcie fazy grupowej — na grupy.
 * Obie zakładki są i tak w menu, więc nic nie znika.
 */
export default async function Home() {
  const activeSeason = await prisma.season.findFirst({
    where: { status: 'ACTIVE' },
    select: { id: true },
  })

  if (activeSeason) {
    const playoffRound = await prisma.round.findFirst({
      where: { seasonId: activeSeason.id, type: 'PLAYOFF' },
      select: { id: true },
    })
    if (playoffRound) redirect('/playoff')
  }

  redirect('/grupy')
}

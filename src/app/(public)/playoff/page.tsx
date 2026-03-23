// src/app/(public)/playoff/page.tsx
import { prisma } from '@/lib/db'
import { PL } from '@/constants/pl'
import { buildBracketSlots, BRACKET_NAMES } from '@/lib/playoff'
import PlayoffBracket from '@/components/PlayoffBracket'

export const dynamic = 'force-dynamic'

export default async function PlayoffPage() {
  const activeSeason = await prisma.season.findFirst({
    where: { status: 'ACTIVE' },
    include: {
      rounds: {
        where: { type: 'PLAYOFF' },
        include: {
          groups: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
    },
  })

  const playoffRound = activeSeason?.rounds[0]

  if (!playoffRound || playoffRound.groups.length === 0) {
    return (
      <div className="text-center py-20">
        <h1 className="text-3xl font-bold text-[var(--color-primary)]" style={{ fontFamily: 'Raleway, sans-serif' }}>
          {PL.playoff.title}
        </h1>
        <p className="mt-4 text-[var(--color-text-body)]">{PL.playoff.noPlayoff}</p>
      </div>
    )
  }

  // Build bracket data for each group
  const brackets = await Promise.all(
    playoffRound.groups.map(async (group, idx) => {
      const slots = await buildBracketSlots(group.id)
      return {
        groupId: group.id,
        name: group.name,
        bracketKey: BRACKET_NAMES[idx] ?? '',
        slots: JSON.parse(JSON.stringify(slots)), // serialize for client component
      }
    })
  )

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-[var(--color-primary)]" style={{ fontFamily: 'Raleway, sans-serif' }}>
          {PL.playoff.title} {activeSeason!.year}
        </h1>
        <div className="flex items-center gap-3 mt-3">
          <span className="inline-block w-12 h-0.5 bg-[var(--color-accent)]"></span>
          <p className="text-[var(--color-text-body)] font-medium">
            {activeSeason!.name} &middot; Karolinka Golf Park
          </p>
        </div>
      </div>

      <PlayoffBracket brackets={brackets} />
    </div>
  )
}

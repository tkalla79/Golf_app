import { prisma } from '@/lib/db'
import { computeStandings } from '@/lib/standings'
import { PL } from '@/constants/pl'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import MatchesView from '@/components/MatchesView'

export const dynamic = 'force-dynamic'

export default async function GrupaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const groupId = parseInt(id)

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      round: { include: { season: true } },
      players: { include: { player: true }, orderBy: { createdAt: 'asc' } },
      matches: {
        include: { player1: true, player2: true, winner: true },
        orderBy: { id: 'asc' },
      },
    },
  })

  if (!group) return notFound()

  const standings = computeStandings(group.players, group.matches)

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link href="/grupy" className="text-sm text-[var(--color-primary)] hover:text-[var(--color-accent)] transition-colors font-medium">
          &larr; Wszystkie grupy
        </Link>
      </div>

      {/* Header */}
      <div className="mb-10">
        <h1 className="text-4xl font-bold text-[var(--color-primary)]" style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}>
          {group.name}
        </h1>
        <div className="flex items-center gap-3 mt-2">
          <span className="inline-block w-10 h-0.5 bg-[var(--color-accent)]"></span>
          <p className="text-[var(--color-text-body)]">
            {group.round.name} &middot; {group.round.season.name}
          </p>
        </div>
      </div>

      {/* Standings table */}
      <div className="card p-0 mb-10 overflow-hidden">
        <div className="bg-[var(--color-primary)] px-6 py-4">
          <h2 className="text-white font-bold text-lg tracking-wide" style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}>
            {PL.group.standings}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="standings-table w-full text-sm">
            <thead>
              <tr>
                <th className="text-left !rounded-none">{PL.standings.position}</th>
                <th className="text-left !rounded-none">{PL.standings.player}</th>
                <th className="text-center !rounded-none">{PL.standings.played}</th>
                <th className="text-center !rounded-none">{PL.standings.won}</th>
                <th className="text-center !rounded-none">{PL.standings.drawn}</th>
                <th className="text-center !rounded-none">{PL.standings.lost}</th>
                <th className="text-center !rounded-none">{PL.standings.bigPoints}</th>
                <th className="text-center !rounded-none">{PL.standings.smallPoints}</th>
                <th className="text-center !rounded-none">🐦</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => (
                <tr key={s.playerId}>
                  <td className={`font-bold text-[var(--color-primary)] ${i === 0 ? 'bg-[var(--color-accent)]/10' : ''}`}>
                    {s.position}
                  </td>
                  <td className={i === 0 ? 'bg-[var(--color-accent)]/10' : ''}>
                    <Link
                      href={`/zawodnik/${s.slug}`}
                      className="font-semibold text-[var(--color-text-dark)] hover:text-[var(--color-primary)] transition-colors"
                    >
                      {s.firstName} {s.lastName}
                    </Link>
                  </td>
                  <td className={`text-center ${i === 0 ? 'bg-[var(--color-accent)]/10' : ''}`}>{s.played}</td>
                  <td className={`text-center text-[var(--color-success)] font-semibold ${i === 0 ? 'bg-[var(--color-accent)]/10' : ''}`}>{s.won}</td>
                  <td className={`text-center text-[var(--color-warning)] font-semibold ${i === 0 ? 'bg-[var(--color-accent)]/10' : ''}`}>{s.drawn}</td>
                  <td className={`text-center text-[var(--color-danger)] font-semibold ${i === 0 ? 'bg-[var(--color-accent)]/10' : ''}`}>{s.lost}</td>
                  <td className={`text-center font-bold text-lg text-[var(--color-primary)] ${i === 0 ? 'bg-[var(--color-accent)]/10' : ''}`}>{s.bigPoints}</td>
                  <td className={`text-center text-[var(--color-text-body)]/60 ${i === 0 ? 'bg-[var(--color-accent)]/10' : ''}`}>
                    {s.smallPoints > 0 ? `+${s.smallPoints}` : s.smallPoints}
                  </td>
                  <td className={`text-center text-[var(--color-text-body)]/60 ${i === 0 ? 'bg-[var(--color-accent)]/10' : ''}`}>
                    {s.birdies || 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Matches with list/matrix toggle */}
      <MatchesView
        matches={JSON.parse(JSON.stringify(group.matches))}
        standings={JSON.parse(JSON.stringify(standings))}
      />
    </div>
  )
}

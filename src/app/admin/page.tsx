import { prisma } from '@/lib/db'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
  const [playerCount, activeSeason, adminCount] = await Promise.all([
    prisma.player.count({ where: { active: true } }),
    prisma.season.findFirst({
      where: { status: 'ACTIVE' },
      include: {
        rounds: {
          orderBy: { roundNumber: 'asc' },
          include: {
            groups: {
              include: {
                _count: { select: { matches: true } },
                matches: { where: { played: true } },
              },
            },
          },
        },
      },
    }),
    prisma.admin.count(),
  ])

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-[var(--color-primary)]" style={{ fontFamily: 'Raleway, sans-serif' }}>
          Dashboard
        </h1>
        <div className="flex items-center gap-3 mt-2">
          <span className="inline-block w-10 h-0.5 bg-[var(--color-accent)]"></span>
          <span className="text-[var(--color-text-body)]/60 text-sm">Panel administracyjny</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <Link href="/admin/zawodnicy" className="card card-clickable p-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-body)]/40">
            Zawodnicy
          </div>
          <div className="text-4xl font-bold text-[var(--color-primary)] mt-2">{playerCount}</div>
          <div className="text-xs text-[var(--color-accent)] font-semibold mt-3">Zarządzaj &rarr;</div>
        </Link>

        <Link href="/admin/sezon" className="card card-clickable p-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-body)]/40">
            Sezon
          </div>
          <div className="text-lg font-bold text-[var(--color-primary)] mt-2">
            {activeSeason?.name || 'Brak aktywnego sezonu'}
          </div>
          <div className="text-xs text-[var(--color-accent)] font-semibold mt-3">Zarządzaj &rarr;</div>
        </Link>

        <Link href="/admin/uzytkownicy" className="card card-clickable p-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-body)]/40">
            Administratorzy
          </div>
          <div className="text-4xl font-bold text-[var(--color-primary)] mt-2">{adminCount}</div>
          <div className="text-xs text-[var(--color-accent)] font-semibold mt-3">Zarządzaj &rarr;</div>
        </Link>
      </div>

      {/* Rounds overview */}
      {activeSeason && (
        <div className="card p-0 overflow-hidden">
          <div className="bg-[var(--color-primary)] px-6 py-4">
            <h2 className="text-white font-bold tracking-wide" style={{ fontFamily: 'Raleway, sans-serif' }}>
              Rundy sezonu
            </h2>
          </div>
          <div className="p-6 space-y-4">
            {activeSeason.rounds.map((round) => {
              const totalMatches = round.groups.reduce(
                (acc, g) => acc + g._count.matches, 0
              )
              const playedMatches = round.groups.reduce(
                (acc, g) => acc + g.matches.length, 0
              )

              return (
                <div key={round.id} className="flex items-center justify-between py-3 border-b border-[var(--color-border)] last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-[var(--color-text-dark)]">{round.name}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      round.status === 'ACTIVE'
                        ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
                        : round.status === 'COMPLETED'
                        ? 'bg-[var(--color-text-body)]/10 text-[var(--color-text-body)]'
                        : 'bg-[var(--color-accent)]/20 text-[var(--color-accent-hover)]'
                    }`}>
                      {round.status === 'ACTIVE' ? 'Aktywna' : round.status === 'COMPLETED' ? 'Zakończona' : 'Szkic'}
                    </span>
                  </div>
                  <div className="flex items-center gap-6 text-sm text-[var(--color-text-body)]/60">
                    <span>{round.groups.length} grup</span>
                    <span>{playedMatches}/{totalMatches} meczów</span>
                    {round.groups.map((g) => (
                      <Link
                        key={g.id}
                        href={`/admin/grupa/${g.id}`}
                        className="text-[var(--color-primary)] hover:text-[var(--color-accent)] font-medium text-xs"
                      >
                        {g.name} &rarr;
                      </Link>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

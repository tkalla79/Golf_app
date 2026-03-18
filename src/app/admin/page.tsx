import { prisma } from '@/lib/db'
import Link from 'next/link'
import { PL } from '@/constants/pl'

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
      <h1 className="text-3xl font-bold text-gray-800 mb-8">{PL.nav.dashboard}</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm text-gray-500 uppercase">{PL.nav.players}</h3>
          <p className="text-3xl font-bold text-[var(--color-primary)]">{playerCount}</p>
          <Link href="/admin/zawodnicy" className="text-sm text-[var(--color-accent)] hover:underline">
            {PL.nav.managePlayers} &rarr;
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm text-gray-500 uppercase">{PL.nav.manageSeason}</h3>
          <p className="text-lg font-bold text-[var(--color-primary)]">
            {activeSeason?.name || 'Brak aktywnego sezonu'}
          </p>
          {activeSeason && (
            <Link
              href={`/admin/sezon/${activeSeason.id}`}
              className="text-sm text-[var(--color-accent)] hover:underline"
            >
              {PL.nav.manageSeason} &rarr;
            </Link>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm text-gray-500 uppercase">{PL.nav.manageAdmins}</h3>
          <p className="text-3xl font-bold text-[var(--color-primary)]">{adminCount}</p>
          <Link href="/admin/uzytkownicy" className="text-sm text-[var(--color-accent)] hover:underline">
            {PL.nav.manageAdmins} &rarr;
          </Link>
        </div>
      </div>

      {activeSeason && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-700 mb-4">Rundy</h2>
          <div className="space-y-3">
            {activeSeason.rounds.map((round) => {
              const totalMatches = round.groups.reduce(
                (acc, g) => acc + g._count.matches,
                0
              )
              const playedMatches = round.groups.reduce(
                (acc, g) => acc + g.matches.length,
                0
              )

              return (
                <div key={round.id} className="flex items-center justify-between py-2 border-b">
                  <div>
                    <span className="font-medium">{round.name}</span>
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                      round.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-700'
                        : round.status === 'COMPLETED'
                        ? 'bg-gray-100 text-gray-600'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {round.status}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {round.groups.length} grup &middot; {playedMatches}/{totalMatches} meczów
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

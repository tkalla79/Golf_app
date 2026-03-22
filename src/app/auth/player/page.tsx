import { prisma } from '@/lib/db'
import { createPlayerSession } from '@/lib/player-auth'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function PlayerAuthPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-section)]">
        <div className="card p-10 text-center max-w-md">
          <h1 className="text-xl font-bold text-[var(--color-danger)]" style={{ fontFamily: 'Raleway, sans-serif' }}>
            Brak tokenu
          </h1>
          <p className="text-[var(--color-text-body)] mt-3">Link jest nieprawidłowy.</p>
          <a href="/" className="text-[var(--color-primary)] hover:text-[var(--color-accent)] text-sm font-medium mt-4 inline-block">
            &larr; Strona główna
          </a>
        </div>
      </div>
    )
  }

  const player = await prisma.player.findUnique({
    where: { loginToken: token },
  })

  if (!player || !player.loginTokenExpiry || player.loginTokenExpiry < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-section)]">
        <div className="card p-10 text-center max-w-md">
          <h1 className="text-xl font-bold text-[var(--color-danger)]" style={{ fontFamily: 'Raleway, sans-serif' }}>
            Link wygasł
          </h1>
          <p className="text-[var(--color-text-body)] mt-3">
            Link logowania wygasł lub został już użyty. Wróć na swoją stronę i kliknij &quot;Zaloguj się&quot; ponownie.
          </p>
          <a href="/" className="text-[var(--color-primary)] hover:text-[var(--color-accent)] text-sm font-medium mt-4 inline-block">
            &larr; Strona główna
          </a>
        </div>
      </div>
    )
  }

  // Token valid - create session and clear token
  await prisma.player.update({
    where: { id: player.id },
    data: { loginToken: null, loginTokenExpiry: null },
  })

  await createPlayerSession(player.id, player.slug)
  redirect(`/zawodnik/${player.slug}`)
}

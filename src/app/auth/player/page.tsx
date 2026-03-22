export const dynamic = 'force-dynamic'

export default async function PlayerAuthPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  const messages: Record<string, string> = {
    'no-token': 'Link jest nieprawidłowy.',
    'expired': 'Link logowania wygasł lub został już użyty. Wróć na swoją stronę i kliknij "Zaloguj się" ponownie.',
  }

  const message = error ? messages[error] || 'Wystąpił błąd.' : 'Wystąpił błąd.'

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-section)]">
      <div className="card p-10 text-center max-w-md">
        <h1 className="text-xl font-bold text-[var(--color-danger)]" style={{ fontFamily: 'Raleway, sans-serif' }}>
          Nie udało się zalogować
        </h1>
        <p className="text-[var(--color-text-body)] mt-3">{message}</p>
        <a href="/" className="text-[var(--color-primary)] hover:text-[var(--color-accent)] text-sm font-medium mt-4 inline-block">
          &larr; Strona główna
        </a>
      </div>
    </div>
  )
}

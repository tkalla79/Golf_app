import Navbar from '@/components/Navbar'
import SponsorBar from '@/components/SponsorBar'
import Image from 'next/image'
import { prisma } from '@/lib/db'

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const playoffRound = await prisma.round.findFirst({
    where: {
      type: 'PLAYOFF',
      season: { status: 'ACTIVE' },
    },
    select: { id: true },
  })
  const hasPlayoff = !!playoffRound

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar hasPlayoff={hasPlayoff} />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-10">
        {children}
      </main>
      <footer className="bg-[var(--color-bg-dark)] text-white/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10">
          <SponsorBar />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <Image
                src="/logo.png"
                alt="Karolinka Golf Park"
                width={60}
                height={48}
                className="brightness-0 invert opacity-60"
              />
              <div>
                <div className="text-white font-bold text-sm" style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}>
                  Don Papa Match Play
                </div>
                <div className="text-xs text-white/40 mt-1">
                  Karolinka Golf Park &middot; Kamień Śląski
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-white/30">
                &copy; {new Date().getFullYear()} Karolinka Golf Park. Wszelkie prawa zastrzeżone.
              </div>
              <div className="text-xs text-white/40 mt-1">
                Realizacja:{' '}
                <a href="https://codelabs.rocks/" target="_blank" rel="noopener noreferrer" className="text-white/60 hover:text-white/90 transition-colors font-medium">
                  codelabs.rocks
                </a>
                {' '}&amp;{' '}
                <a href="https://k2biznes.pl/" target="_blank" rel="noopener noreferrer" className="text-white/60 hover:text-white/90 transition-colors font-medium">
                  k2biznes
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>

    </div>
  )
}

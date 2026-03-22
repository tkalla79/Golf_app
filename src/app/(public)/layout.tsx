import Navbar from '@/components/Navbar'
import Image from 'next/image'

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-10">
        {children}
      </main>
      <footer className="bg-[var(--color-bg-dark)] text-white/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
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
                <div className="text-white font-bold text-sm" style={{ fontFamily: 'Raleway, sans-serif' }}>
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

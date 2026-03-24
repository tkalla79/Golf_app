'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useSession, SessionProvider, signOut } from 'next-auth/react'
import { PL } from '@/constants/pl'

function AdminNavInner({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const pathname = usePathname()

  if (pathname === '/admin/login') {
    return <>{children}</>
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-section)]">
        <div className="text-[var(--color-text-body)]/50 animate-pulse">{PL.common.loading}</div>
      </div>
    )
  }

  if (!session) {
    if (typeof window !== 'undefined') {
      window.location.href = '/admin/login'
    }
    return null
  }

  const navLinks = [
    { href: '/admin', label: 'Dashboard', exact: true },
    { href: '/admin/zawodnicy', label: 'Zawodnicy' },
    { href: '/admin/sezon', label: 'Sezon' },
    { href: '/admin/generuj-rundy', label: 'Generuj rundy' },
    { href: '/admin/uzytkownicy', label: 'Administratorzy' },
    { href: '/admin/symulacja', label: 'Symulacja' },
  ]

  return (
    <div className="min-h-screen bg-[var(--color-bg-section)]">
      {/* Admin navbar */}
      <nav className="bg-[var(--color-bg-dark)] shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center gap-2">
                <Image
                  src="/logo.png"
                  alt="Karolinka"
                  width={32}
                  height={26}
                  className="brightness-0 invert opacity-60"
                />
                <span className="text-[var(--color-accent)] font-bold text-sm" style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}>
                  ADMIN
                </span>
              </Link>

              <div className="hidden lg:flex items-center gap-1">
                {navLinks.map((link) => {
                  const isActive = link.exact
                    ? pathname === link.href
                    : pathname.startsWith(link.href)
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wider transition-colors ${
                        isActive
                          ? 'text-[var(--color-accent)] bg-white/5'
                          : 'text-white/50 hover:text-white/80'
                      }`}
                    >
                      {link.label}
                    </Link>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-white/40 text-xs hidden sm:block">{session.user?.name}</span>
              <button
                onClick={() => signOut({ callbackUrl: '/admin/login' })}
                className="text-xs bg-white/10 hover:bg-white/20 text-white/60 hover:text-white px-3 py-1.5 rounded transition-colors font-semibold uppercase tracking-wider"
              >
                {PL.nav.logout}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10">{children}</main>
    </div>
  )
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SessionProvider>
      <AdminNavInner>{children}</AdminNavInner>
    </SessionProvider>
  )
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, SessionProvider } from 'next-auth/react'
import { PL } from '@/constants/pl'

function AdminNavInner({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const pathname = usePathname()

  if (pathname === '/admin/login') {
    return <>{children}</>
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">{PL.common.loading}</p>
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
    { href: '/admin', label: PL.nav.dashboard, exact: true },
    { href: '/admin/zawodnicy', label: PL.nav.managePlayers },
    { href: '/admin/sezon', label: PL.nav.manageSeason },
    { href: '/admin/generuj-rundy', label: PL.nav.generateRounds },
    { href: '/admin/uzytkownicy', label: PL.nav.manageAdmins },
  ]

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-gray-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center h-14">
            <div className="flex items-center space-x-6">
              <Link href="/" className="text-[var(--color-accent)] font-bold">
                {PL.appName}
              </Link>
              <div className="hidden md:flex space-x-4">
                {navLinks.map((link) => {
                  const isActive = link.exact
                    ? pathname === link.href
                    : pathname.startsWith(link.href)
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`text-sm hover:text-[var(--color-accent)] transition-colors ${
                        isActive ? 'text-[var(--color-accent)] font-semibold' : ''
                      }`}
                    >
                      {link.label}
                    </Link>
                  )
                })}
              </div>
            </div>
            <div className="flex items-center space-x-4 text-sm">
              <span className="text-gray-400">{session.user?.name}</span>
              <Link
                href="/api/auth/signout"
                className="bg-red-600 px-3 py-1 rounded hover:bg-red-700 transition-colors"
              >
                {PL.nav.logout}
              </Link>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
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

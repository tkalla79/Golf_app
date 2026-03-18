'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PL } from '@/constants/pl'
import { useState } from 'react'

export default function Navbar() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  const links = [
    { href: '/grupy', label: PL.nav.groups },
    { href: '/zawodnicy', label: PL.nav.players },
  ]

  return (
    <nav className="bg-[var(--color-primary)] text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="text-xl font-bold tracking-tight">
            {PL.appName}
          </Link>

          {/* Desktop */}
          <div className="hidden md:flex items-center space-x-6">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`hover:text-[var(--color-accent)] transition-colors ${
                  pathname.startsWith(link.href)
                    ? 'text-[var(--color-accent)] font-semibold'
                    : ''
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/admin"
              className="bg-[var(--color-primary-light)] px-4 py-2 rounded hover:bg-[var(--color-accent)] transition-colors text-sm"
            >
              {PL.nav.admin}
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2"
            aria-label="Menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden pb-4 space-y-2">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="block py-2 hover:text-[var(--color-accent)]"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/admin"
              onClick={() => setMenuOpen(false)}
              className="block py-2 hover:text-[var(--color-accent)]"
            >
              {PL.nav.admin}
            </Link>
          </div>
        )}
      </div>
    </nav>
  )
}

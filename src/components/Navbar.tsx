'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { PL } from '@/constants/pl'
import { useState } from 'react'

export default function Navbar({ hasPlayoff = false }: { hasPlayoff?: boolean }) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  const links = [
    { href: '/grupy', label: PL.nav.groups },
    ...(hasPlayoff ? [{ href: '/playoff', label: PL.nav.playoff }] : []),
    { href: '/zawodnicy', label: PL.nav.players },
  ]

  return (
    <nav className="bg-[var(--color-primary)] shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Karolinka Golf Park"
              width={50}
              height={40}
              className="brightness-0 invert"
            />
            <div className="hidden sm:block">
              <div className="text-white font-bold text-lg tracking-tight" style={{ fontFamily: 'Raleway, sans-serif' }}>
                DON PAPA
              </div>
              <div className="text-[var(--color-accent)] text-xs font-semibold tracking-widest uppercase">
                Match Play 2026
              </div>
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-5 py-2 rounded text-sm font-semibold tracking-wide uppercase transition-colors ${
                  pathname.startsWith(link.href)
                    ? 'text-[var(--color-accent)]'
                    : 'text-white/80 hover:text-white'
                }`}
                style={{ fontFamily: 'Raleway, sans-serif', letterSpacing: '0.08em' }}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/admin"
              className="ml-4 btn-primary text-sm uppercase tracking-wider"
              style={{ fontFamily: 'Raleway, sans-serif', fontSize: '0.7rem', padding: '8px 18px' }}
            >
              {PL.nav.admin}
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 text-white"
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
          <div className="md:hidden pb-6 space-y-1 border-t border-white/10 pt-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`block px-4 py-3 rounded font-semibold text-sm uppercase tracking-wide ${
                  pathname.startsWith(link.href)
                    ? 'text-[var(--color-accent)] bg-white/5'
                    : 'text-white/80'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/admin"
              onClick={() => setMenuOpen(false)}
              className="block px-4 py-3 text-white/80 font-semibold text-sm uppercase tracking-wide"
            >
              {PL.nav.admin}
            </Link>
          </div>
        )}
      </div>
    </nav>
  )
}

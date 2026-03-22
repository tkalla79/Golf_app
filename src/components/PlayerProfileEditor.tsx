'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'

interface Props {
  playerId: number
  slug: string
  firstName: string
  lastName: string
  hcp: number | null
  avatarUrl: string | null
  hasEmail: boolean
  isLoggedIn: boolean
}

export default function PlayerProfileEditor({
  playerId,
  slug,
  firstName,
  lastName,
  hcp: initialHcp,
  avatarUrl: initialAvatar,
  hasEmail,
  isLoggedIn,
}: Props) {
  const [hcp, setHcp] = useState(initialHcp !== null ? String(initialHcp) : '')
  const [avatarUrl, setAvatarUrl] = useState(initialAvatar)
  const [editingHcp, setEditingHcp] = useState(false)
  const [saving, setSaving] = useState(false)
  const [linkSent, setLinkSent] = useState(false)
  const [linkLoading, setLinkLoading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSendLink = async () => {
    setLinkLoading(true)
    setError('')
    const res = await fetch('/api/auth/player/send-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId }),
    })
    setLinkLoading(false)
    if (res.ok) {
      setLinkSent(true)
    } else {
      const data = await res.json()
      setError(data.error || 'Wystąpił błąd')
    }
  }

  const handleSaveHcp = async () => {
    setSaving(true)
    await fetch('/api/player/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hcp }),
    })
    setSaving(false)
    setEditingHcp(false)
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setSaving(true)
    const formData = new FormData()
    formData.append('avatar', file)

    const res = await fetch('/api/player/avatar', { method: 'POST', body: formData })
    setSaving(false)

    if (res.ok) {
      const data = await res.json()
      setAvatarUrl(data.avatarUrl)
    } else {
      const data = await res.json()
      setError(data.error || 'Nie udało się zapisać zdjęcia')
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/player/logout', { method: 'POST' })
    window.location.reload()
  }

  return (
    <div className="card p-8 mb-8">
      <div className="flex flex-col sm:flex-row sm:items-start gap-6">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div className="relative w-24 h-24 rounded-full overflow-hidden bg-[var(--color-bg-section)] border-2 border-[var(--color-border)]">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={`${firstName} ${lastName}`}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-[var(--color-primary)]/30">
                {firstName[0]}{lastName[0]}
              </div>
            )}
          </div>
          {isLoggedIn && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={saving}
              className="mt-2 text-xs text-[var(--color-primary)] hover:text-[var(--color-accent)] font-semibold transition-colors w-full text-center"
            >
              {saving ? 'Zapisywanie...' : 'Zmień zdjęcie'}
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
          />
        </div>

        {/* Name + HCP + actions */}
        <div className="flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-[var(--color-primary)]" style={{ fontFamily: 'Raleway, sans-serif' }}>
                {firstName} {lastName}
              </h1>
              <div className="flex items-center gap-3 mt-2">
                <span className="inline-block w-8 h-0.5 bg-[var(--color-accent)]"></span>
                <span className="text-[var(--color-text-body)]/60 text-sm">Profil zawodnika</span>
              </div>
            </div>

            {/* HCP display/edit */}
            <div>
              {isLoggedIn && editingHcp ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    value={hcp}
                    onChange={(e) => setHcp(e.target.value)}
                    className="w-20 px-3 py-2 border border-[var(--color-border)] rounded-lg text-center text-lg font-bold"
                  />
                  <button
                    onClick={handleSaveHcp}
                    disabled={saving}
                    className="btn-primary text-xs px-3 py-2"
                  >
                    {saving ? '...' : 'OK'}
                  </button>
                  <button
                    onClick={() => setEditingHcp(false)}
                    className="text-xs text-[var(--color-text-body)]/50"
                  >
                    Anuluj
                  </button>
                </div>
              ) : (
                <div
                  className={`bg-[var(--color-primary)] text-white px-6 py-3 rounded-lg text-center ${isLoggedIn ? 'cursor-pointer hover:bg-[var(--color-primary-light)] transition-colors' : ''}`}
                  onClick={isLoggedIn ? () => setEditingHcp(true) : undefined}
                  title={isLoggedIn ? 'Kliknij aby zmienić HCP' : undefined}
                >
                  <div className="text-xs uppercase tracking-wider text-white/60 font-semibold">HCP</div>
                  <div className="text-2xl font-bold">
                    {hcp ? parseFloat(hcp).toFixed(1) : '–'}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Login / Logout button */}
          <div className="mt-4">
            {isLoggedIn ? (
              <button
                onClick={handleLogout}
                className="text-xs text-[var(--color-text-body)]/40 hover:text-[var(--color-text-body)] transition-colors"
              >
                Wyloguj się
              </button>
            ) : hasEmail ? (
              linkSent ? (
                <p className="text-sm text-[var(--color-success)] font-medium">
                  Link logowania został wysłany na Twój adres e-mail. Sprawdź skrzynkę i kliknij w link.
                </p>
              ) : (
                <button
                  onClick={handleSendLink}
                  disabled={linkLoading}
                  className="btn-primary text-sm disabled:opacity-50"
                >
                  {linkLoading ? 'Wysyłanie...' : 'Zaloguj się jako zawodnik'}
                </button>
              )
            ) : null}
            {error && (
              <p className="text-sm text-[var(--color-danger)] mt-2">{error}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

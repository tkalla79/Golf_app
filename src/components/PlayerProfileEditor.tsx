'use client'

import { useState, useRef } from 'react'
import { PL } from '@/constants/pl'

interface Props {
  playerId: number
  slug: string
  firstName: string
  lastName: string
  hcp: number | null
  email: string | null
  phone: string | null
  avatarUrl: string | null
  isLoggedIn: boolean
  isAnyPlayerLoggedIn: boolean
  hasPassword?: boolean
  totalBirdies?: number
}

export default function PlayerProfileEditor({
  playerId,
  slug,
  firstName,
  lastName,
  hcp: initialHcp,
  email: initialEmail,
  phone: initialPhone,
  avatarUrl: initialAvatar,
  isLoggedIn,
  isAnyPlayerLoggedIn,
  hasPassword,
  totalBirdies,
}: Props) {
  const [hcp, setHcp] = useState(initialHcp !== null ? String(initialHcp) : '')
  const [email, setEmail] = useState(initialEmail || '')
  const [phone, setPhone] = useState(initialPhone || '')
  const [avatarUrl, setAvatarUrl] = useState(initialAvatar)
  const [avatarKey, setAvatarKey] = useState(0)
  const [editingHcp, setEditingHcp] = useState(false)
  const [editingContact, setEditingContact] = useState(false)
  const [saving, setSaving] = useState(false)
  const [linkSent, setLinkSent] = useState(false)
  const [linkLoading, setLinkLoading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Password login state
  const [loginTab, setLoginTab] = useState<'magic' | 'password'>('magic')
  const [loginEmail, setLoginEmail] = useState(initialEmail || '')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  // Set password state
  const [newPassword, setNewPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  const t = PL.playerAuth

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

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginLoading(true)
    setError('')
    const res = await fetch('/api/auth/player/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: loginEmail, password: loginPassword }),
    })
    const data = await res.json()
    setLoginLoading(false)
    if (res.ok && data.success) {
      window.location.reload()
    } else {
      setError(data.error || t.invalidCredentials)
    }
  }

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess(false)
    if (newPassword.length < 6) {
      setPasswordError(t.passwordMinLength)
      return
    }
    setPasswordSaving(true)
    const res = await fetch('/api/player/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPassword }),
    })
    setPasswordSaving(false)
    if (res.ok) {
      setPasswordSuccess(true)
      setNewPassword('')
    } else {
      const data = await res.json()
      setPasswordError(data.error || 'Wystąpił błąd')
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

  const handleSaveContact = async () => {
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Nieprawidłowy adres e-mail')
      return
    }
    if (phone && !/^\+?[\d\s\-()]{7,20}$/.test(phone)) {
      setError('Nieprawidłowy numer telefonu')
      return
    }
    setError('')
    setSaving(true)
    await fetch('/api/player/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, phone }),
    })
    setSaving(false)
    setEditingContact(false)
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
      setAvatarKey((k) => k + 1)
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
              <img
                key={avatarKey}
                src={`${avatarUrl}?v=${avatarKey}`}
                alt={`${firstName} ${lastName}`}
                className="w-full h-full object-cover"
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
              <h1 className="text-3xl font-bold text-[var(--color-primary)]" style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}>
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
                <div className="flex gap-3 items-start">
                  <div className="text-center">
                    <div className="bg-[var(--color-primary)] text-white px-6 py-3 rounded-lg">
                      <div className="text-xs uppercase tracking-wider text-white/60 font-semibold">HCP</div>
                      <div className="text-2xl font-bold">
                        {hcp ? parseFloat(hcp).toFixed(1) : '–'}
                      </div>
                    </div>
                  </div>
                  {(totalBirdies !== undefined && totalBirdies > 0) && (
                    <div className="text-center">
                      <div className="bg-[var(--color-accent)] text-[var(--color-primary-dark)] px-5 py-3 rounded-lg">
                        <div className="text-xs uppercase tracking-wider font-semibold opacity-70">🐦 Birdie</div>
                        <div className="text-2xl font-bold">{totalBirdies}</div>
                      </div>
                    </div>
                  )}
                </div>
                  {isLoggedIn && (
                    <div className="flex justify-center gap-3 mt-2">
                      <button
                        onClick={() => setEditingHcp(true)}
                        className="text-xs text-[var(--color-primary)] hover:text-[var(--color-accent)] font-semibold transition-colors"
                      >
                        Zmień HCP
                      </button>
                      <span className="text-[var(--color-border)]">|</span>
                      <button
                        onClick={handleLogout}
                        className="text-xs text-[var(--color-text-body)]/40 hover:text-[var(--color-text-body)] transition-colors"
                      >
                        Wyloguj
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Contact info */}
          {(isLoggedIn || isAnyPlayerLoggedIn) && (
            <div className="mt-4">
              <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--color-text-body)]">
                {/* Email */}
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-[var(--color-primary)]/40 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {isLoggedIn && editingContact ? (
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="twoj@email.pl"
                      className="px-2 py-1 border border-[var(--color-border)] rounded text-sm w-52"
                    />
                  ) : (
                    <span>{email || '–'}</span>
                  )}
                </span>

                {/* Phone */}
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-[var(--color-primary)]/40 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  {isLoggedIn && editingContact ? (
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+48 123 456 789"
                      className="px-2 py-1 border border-[var(--color-border)] rounded text-sm w-40"
                    />
                  ) : (
                    <span>{phone || '–'}</span>
                  )}
                </span>

                {/* Edit/Save button */}
                {isLoggedIn && (
                  editingContact ? (
                    <span className="flex gap-2">
                      <button onClick={handleSaveContact} disabled={saving} className="btn-primary text-xs px-3 py-1">
                        {saving ? '...' : 'Zapisz'}
                      </button>
                      <button onClick={() => setEditingContact(false)} className="text-xs text-[var(--color-text-body)]/50">
                        Anuluj
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setEditingContact(true)}
                      className="text-xs text-[var(--color-primary)] hover:text-[var(--color-accent)] font-semibold transition-colors"
                    >
                      Edytuj
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          {/* Login section (not logged in) */}
          <div className="mt-4">
            {isLoggedIn ? null : !!email ? (
              <div>
                {/* Login tabs */}
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => { setLoginTab('magic'); setError('') }}
                    className={`text-sm px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                      loginTab === 'magic'
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'bg-[var(--color-bg-section)] text-[var(--color-text-body)]/60 hover:text-[var(--color-text-body)]'
                    }`}
                  >
                    {t.loginWithMagicLink}
                  </button>
                  <button
                    onClick={() => { setLoginTab('password'); setError('') }}
                    className={`text-sm px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                      loginTab === 'password'
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'bg-[var(--color-bg-section)] text-[var(--color-text-body)]/60 hover:text-[var(--color-text-body)]'
                    }`}
                  >
                    {t.loginWithPassword}
                  </button>
                </div>

                {/* Magic link tab */}
                {loginTab === 'magic' && (
                  linkSent ? (
                    <p className="text-sm text-[var(--color-success)] font-medium">
                      Odnośnik do logowania został wysłany na Twój adres e-mail. Sprawdź skrzynkę i kliknij w link.
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
                )}

                {/* Password login tab */}
                {loginTab === 'password' && (
                  <form onSubmit={handlePasswordLogin} className="flex flex-col sm:flex-row items-start sm:items-end gap-2">
                    <div>
                      <label className="block text-xs text-[var(--color-text-body)]/60 mb-1">{t.email}</label>
                      <input
                        type="email"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        required
                        className="px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm w-52"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--color-text-body)]/60 mb-1">{t.password}</label>
                      <input
                        type="password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                        className="px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm w-40"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loginLoading}
                      className="btn-primary text-sm disabled:opacity-50"
                    >
                      {loginLoading ? '...' : t.login}
                    </button>
                  </form>
                )}
              </div>
            ) : null}
            {error && (
              <p className="text-sm text-[var(--color-danger)] mt-2">{error}</p>
            )}
          </div>

          {/* Set/change password (logged in) */}
          {isLoggedIn && (
            <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
              <form onSubmit={handleSetPassword} className="flex flex-col sm:flex-row items-start sm:items-end gap-2">
                <div>
                  <label className="block text-xs text-[var(--color-text-body)]/60 mb-1 font-semibold">
                    {hasPassword ? t.changePassword : t.setPassword}
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t.passwordMinLength}
                    className="px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm w-52"
                  />
                </div>
                <button
                  type="submit"
                  disabled={passwordSaving}
                  className="btn-primary text-sm disabled:opacity-50"
                >
                  {passwordSaving ? '...' : (hasPassword ? t.changePassword : t.setPassword)}
                </button>
              </form>
              {passwordSuccess && (
                <p className="text-sm text-[var(--color-success)] mt-2">{t.passwordSet}</p>
              )}
              {passwordError && (
                <p className="text-sm text-[var(--color-danger)] mt-2">{passwordError}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

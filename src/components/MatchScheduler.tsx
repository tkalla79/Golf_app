'use client'

import { useState } from 'react'
import { PL } from '@/constants/pl'

interface MatchSchedulerProps {
  matchId: number
  scheduledDate: Date | null
}

function formatForInput(date: Date | null): string {
  if (!date) return ''
  // Konwertuj UTC date do lokalnego czasu Warsaw dla datetime-local input
  const warsaw = new Date(new Date(date).toLocaleString('en-US', { timeZone: 'Europe/Warsaw' }))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${warsaw.getFullYear()}-${pad(warsaw.getMonth() + 1)}-${pad(warsaw.getDate())}T${pad(warsaw.getHours())}:${pad(warsaw.getMinutes())}`
}

function formatPolish(date: Date | null): string {
  if (!date) return ''
  return new Date(date).toLocaleString('pl-PL', {
    timeZone: 'Europe/Warsaw',
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function MatchScheduler({ matchId, scheduledDate: initialDate }: MatchSchedulerProps) {
  const [scheduledDate, setScheduledDate] = useState<Date | null>(initialDate)
  const [editing, setEditing] = useState(false)
  const [inputValue, setInputValue] = useState(formatForInput(initialDate))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/matches/${matchId}/schedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledDate: inputValue ? new Date(inputValue).toISOString() : null }),
      })
      if (!res.ok) {
        const err = await res.json()
        setMessage(err.error || 'Błąd')
      } else {
        const data = await res.json()
        setScheduledDate(data.scheduledDate ? new Date(data.scheduledDate) : null)
        setMessage(data.scheduledDate ? PL.schedule.saved : PL.schedule.cleared)
        setEditing(false)
        setTimeout(() => setMessage(null), 3000)
      }
    } catch {
      setMessage('Błąd połączenia')
    } finally {
      setSaving(false)
    }
  }

  async function clear() {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/matches/${matchId}/schedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledDate: null }),
      })
      if (res.ok) {
        setScheduledDate(null)
        setInputValue('')
        setMessage(PL.schedule.cleared)
        setEditing(false)
        setTimeout(() => setMessage(null), 3000)
      }
    } catch {
      setMessage('Błąd połączenia')
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        {scheduledDate ? (
          <span className="inline-flex items-center gap-1.5 bg-[var(--color-accent)]/15 text-[var(--color-primary-dark)] text-xs font-semibold px-3 py-1 rounded-full border border-[var(--color-accent)]/30">
            <svg className="w-3 h-3 text-[var(--color-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {formatPolish(scheduledDate)}
          </span>
        ) : null}
        <button
          onClick={() => {
            setInputValue(formatForInput(scheduledDate))
            setEditing(true)
          }}
          className="text-xs text-[var(--color-primary)] hover:text-[var(--color-accent)] transition-colors font-medium underline underline-offset-2"
        >
          {scheduledDate ? PL.schedule.changeDate : PL.schedule.selectDate}
        </button>
        {message && (
          <span className="text-xs text-[var(--color-success)] font-medium">{message}</span>
        )}
      </div>
    )
  }

  return (
    <div className="mt-2 flex items-center gap-2 flex-wrap">
      <input
        type="datetime-local"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        className="text-xs border border-[var(--color-border)] rounded px-2 py-1 text-[var(--color-text-dark)] focus:outline-none focus:border-[var(--color-accent)]"
        style={{ colorScheme: 'light' }}
      />
      <button
        onClick={save}
        disabled={saving}
        className="text-xs bg-[var(--color-accent)] text-[var(--color-primary-dark)] font-semibold px-3 py-1 rounded hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50"
      >
        {saving ? '...' : PL.common.save}
      </button>
      {scheduledDate && (
        <button
          onClick={clear}
          disabled={saving}
          className="text-xs text-[var(--color-danger)] hover:underline disabled:opacity-50"
        >
          {PL.schedule.clear}
        </button>
      )}
      <button
        onClick={() => setEditing(false)}
        className="text-xs text-[var(--color-text-body)]/50 hover:text-[var(--color-text-body)] transition-colors"
      >
        {PL.common.cancel}
      </button>
      {message && (
        <span className="text-xs text-[var(--color-danger)]">{message}</span>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { PL } from '@/constants/pl'

interface MatchInfo {
  id: number
  player1Id: number
  player2Id: number
  player1: { id: number; firstName: string; lastName: string; slug: string }
  player2: { id: number; firstName: string; lastName: string; slug: string }
}

interface SlotInfo {
  id: number
  playerId: number
  matchId: number | null
  dateStart: string
  dateEnd: string
  status: string
  player: { id: number; firstName: string; lastName: string; slug: string }
  match: MatchInfo | null
}

interface AvailabilityPanelProps {
  playerId: number
  isLoggedIn: boolean
  upcomingMatches: MatchInfo[]
  groupIds: number[]
}

function formatWarsawDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('pl-PL', {
    timeZone: 'Europe/Warsaw',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AvailabilityPanel({
  playerId,
  isLoggedIn,
  upcomingMatches,
  groupIds,
}: AvailabilityPanelProps) {
  const [slots, setSlots] = useState<SlotInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedMatchId, setSelectedMatchId] = useState<string>('')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [saving, setSaving] = useState(false)
  const [joiningId, setJoiningId] = useState<number | null>(null)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const msgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchSlots = useCallback(async () => {
    if (groupIds.length === 0) {
      setLoading(false)
      return
    }
    try {
      // Fetch slots for all groups in parallel
      const results = await Promise.all(
        groupIds.map((gid) =>
          fetch(`/api/availability?groupId=${gid}`).then((r) => (r.ok ? r.json() : [])),
        ),
      )
      // Merge and deduplicate by slot id
      const allSlots: SlotInfo[] = results.flat()
      const unique = Array.from(new Map(allSlots.map((s) => [s.id, s])).values())
      setSlots(unique)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [groupIds])

  useEffect(() => {
    fetchSlots()
  }, [fetchSlots])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (msgTimerRef.current) clearTimeout(msgTimerRef.current)
    }
  }, [])

  function showMsg(text: string, type: 'success' | 'error') {
    if (msgTimerRef.current) clearTimeout(msgTimerRef.current)
    setMessage({ text, type })
    msgTimerRef.current = setTimeout(() => setMessage(null), 4000)
  }

  async function createSlot() {
    if (!selectedMatchId || !dateStart || !dateEnd) return
    setSaving(true)
    try {
      const res = await fetch('/api/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: parseInt(selectedMatchId),
          dateStart: new Date(dateStart).toISOString(),
          dateEnd: new Date(dateEnd).toISOString(),
        }),
      })
      if (res.ok) {
        showMsg(PL.availability.slotCreated, 'success')
        setShowForm(false)
        setSelectedMatchId('')
        setDateStart('')
        setDateEnd('')
        fetchSlots()
      } else {
        const err = await res.json()
        showMsg(err.error || 'Błąd', 'error')
      }
    } catch {
      showMsg('Błąd połączenia', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function cancelSlot(slotId: number) {
    try {
      const res = await fetch(`/api/availability/${slotId}`, { method: 'DELETE' })
      if (res.ok) {
        showMsg(PL.availability.slotCancelled, 'success')
        fetchSlots()
      } else {
        const err = await res.json()
        showMsg(err.error || 'Błąd', 'error')
      }
    } catch {
      showMsg('Błąd połączenia', 'error')
    }
  }

  async function joinSlot(slotId: number) {
    setJoiningId(slotId)
    try {
      const res = await fetch(`/api/availability/${slotId}/join`, { method: 'POST' })
      if (res.ok) {
        showMsg(PL.availability.slotJoined, 'success')
        fetchSlots()
      } else {
        const err = await res.json()
        showMsg(err.error || 'Błąd', 'error')
      }
    } catch {
      showMsg('Błąd połączenia', 'error')
    } finally {
      setJoiningId(null)
    }
  }

  // Split slots: own vs others
  const mySlots = slots.filter((s) => s.playerId === playerId)
  const otherSlots = slots.filter((s) => s.playerId !== playerId)

  // Only show opponent slots where current player is a participant in that match
  const relevantOtherSlots = otherSlots.filter((s) => {
    if (!s.match) return false
    return s.match.player1Id === playerId || s.match.player2Id === playerId
  })

  if (groupIds.length === 0) return null

  return (
    <div className="card p-6 sm:p-8 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2
          className="text-xl font-bold text-[var(--color-text-dark)]"
          style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}
        >
          {PL.availability.title}
        </h2>
        {isLoggedIn && upcomingMatches.length > 0 && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-xs bg-[var(--color-accent)] text-[var(--color-primary-dark)] font-semibold px-3 py-1.5 rounded hover:bg-[var(--color-accent-hover)] transition-colors"
          >
            {showForm ? PL.common.cancel : PL.availability.declareAvailability}
          </button>
        )}
      </div>

      {message && (
        <div
          className={`text-sm font-medium mb-4 px-3 py-2 rounded ${
            message.type === 'success'
              ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
              : 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Create slot form */}
      {showForm && isLoggedIn && (
        <div className="bg-[var(--color-accent)]/[0.04] border border-[var(--color-accent)]/30 rounded-lg p-4 mb-4">
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-dark)] block mb-1">
                {PL.availability.selectMatch}
              </label>
              <select
                value={selectedMatchId}
                onChange={(e) => setSelectedMatchId(e.target.value)}
                className="w-full text-sm border border-[var(--color-border)] rounded px-3 py-1.5 text-[var(--color-text-dark)] focus:outline-none focus:border-[var(--color-accent)]"
              >
                <option value="">--</option>
                {upcomingMatches.map((m) => {
                  const opponent =
                    m.player1Id === playerId ? m.player2 : m.player1
                  return (
                    <option key={m.id} value={m.id}>
                      vs {opponent.firstName} {opponent.lastName}
                    </option>
                  )
                })}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-[var(--color-text-dark)] block mb-1">
                  {PL.availability.dateStart}
                </label>
                <input
                  type="datetime-local"
                  value={dateStart}
                  onChange={(e) => {
                    const newStart = e.target.value
                    setDateStart(newStart)
                    // Auto-set end to +3h whenever start changes
                    if (newStart) {
                      const start = new Date(newStart)
                      start.setHours(start.getHours() + 3)
                      const pad = (n: number) => String(n).padStart(2, '0')
                      setDateEnd(
                        `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}T${pad(start.getHours())}:${pad(start.getMinutes())}`,
                      )
                    }
                  }}
                  className="w-full text-sm border border-[var(--color-border)] rounded px-3 py-1.5 text-[var(--color-text-dark)] focus:outline-none focus:border-[var(--color-accent)]"
                  style={{ colorScheme: 'light' }}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--color-text-dark)] block mb-1">
                  {PL.availability.dateEnd}
                </label>
                <input
                  type="datetime-local"
                  value={dateEnd}
                  onChange={(e) => setDateEnd(e.target.value)}
                  className="w-full text-sm border border-[var(--color-border)] rounded px-3 py-1.5 text-[var(--color-text-dark)] focus:outline-none focus:border-[var(--color-accent)]"
                  style={{ colorScheme: 'light' }}
                />
              </div>
            </div>
            <p className="text-xs text-[var(--color-text-body)]/50">
              {PL.availability.minHours} &middot; {PL.availability.teeBoxNote}
            </p>
            <button
              onClick={createSlot}
              disabled={saving || !selectedMatchId || !dateStart || !dateEnd}
              className="text-sm bg-[var(--color-primary)] text-white font-semibold px-4 py-2 rounded hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50"
            >
              {saving ? '...' : PL.availability.create}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[var(--color-text-body)]/50">{PL.common.loading}</p>
      ) : (
        <>
          {/* Opponent open slots (joinable) */}
          {relevantOtherSlots.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-bold text-[var(--color-text-dark)] mb-2">
                {PL.availability.openSlots}
              </h3>
              <div className="space-y-2">
                {relevantOtherSlots.map((slot) => {
                  const canJoin = isLoggedIn && slot.status === 'OPEN'
                  return (
                    <div
                      key={slot.id}
                      className="flex items-center justify-between gap-3 border border-[var(--color-success)]/20 bg-[var(--color-success)]/[0.04] rounded-lg px-4 py-3"
                    >
                      <div className="flex-1">
                        <span className="font-semibold text-sm text-[var(--color-text-dark)]">
                          {slot.player.firstName} {slot.player.lastName}
                        </span>
                        <div className="text-xs text-[var(--color-text-body)]/60 mt-0.5">
                          {formatWarsawDate(slot.dateStart)} — {formatWarsawDate(slot.dateEnd)}
                        </div>
                      </div>
                      {canJoin && (
                        <button
                          onClick={() => joinSlot(slot.id)}
                          disabled={joiningId === slot.id}
                          className="text-xs bg-[var(--color-success)] text-white font-semibold px-3 py-1.5 rounded hover:bg-[var(--color-success)]/80 transition-colors disabled:opacity-50"
                        >
                          {joiningId === slot.id ? PL.availability.joining : PL.availability.join}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* My slots */}
          {mySlots.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-[var(--color-text-dark)] mb-2">
                {PL.availability.yourSlots}
              </h3>
              <div className="space-y-2">
                {mySlots.map((slot) => (
                  <div
                    key={slot.id}
                    className="flex items-center justify-between gap-3 border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/[0.04] rounded-lg px-4 py-3"
                  >
                    <div className="flex-1">
                      <div className="text-xs text-[var(--color-text-body)]/60">
                        {formatWarsawDate(slot.dateStart)} — {formatWarsawDate(slot.dateEnd)}
                      </div>
                      {slot.match && (
                        <div className="text-xs text-[var(--color-text-body)]/40 mt-0.5">
                          vs{' '}
                          {slot.match.player1Id === playerId
                            ? `${slot.match.player2.firstName} ${slot.match.player2.lastName}`
                            : `${slot.match.player1.firstName} ${slot.match.player1.lastName}`}
                        </div>
                      )}
                    </div>
                    {isLoggedIn && slot.status === 'OPEN' && (
                      <button
                        onClick={() => cancelSlot(slot.id)}
                        className="text-xs text-[var(--color-danger)] hover:underline font-medium"
                      >
                        {PL.availability.cancel}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {relevantOtherSlots.length === 0 && mySlots.length === 0 && (
            <p className="text-sm text-[var(--color-text-body)]/50 italic">
              {PL.availability.noOpenSlots}
            </p>
          )}
        </>
      )}
    </div>
  )
}

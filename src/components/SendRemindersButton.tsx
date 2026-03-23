'use client'

import { useState } from 'react'
import { PL } from '@/constants/pl'

export default function SendRemindersButton() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ sent: number; errors: number } | null>(null)

  async function handleSend() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/reminders', { method: 'POST' })
      const data = await res.json()
      setResult({ sent: data.sent, errors: data.errors })
    } catch {
      setResult({ sent: 0, errors: 1 })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleSend}
        disabled={loading}
        className="btn-primary text-sm px-5 py-2.5 rounded-lg font-semibold disabled:opacity-50"
        style={{ background: '#d5b665', color: '#134a56' }}
      >
        {loading ? PL.reminders.sending : PL.reminders.send}
      </button>
      {result && (
        <p className="text-sm mt-3 text-[var(--color-text-body)]/70">
          {result.sent > 0
            ? `${PL.reminders.sent} ${result.sent} ${PL.reminders.emailsSent}`
            : PL.reminders.noReminders
          }
          {result.errors > 0 && (
            <span className="text-red-500 ml-2">({result.errors} {PL.reminders.errors})</span>
          )}
        </p>
      )}
    </div>
  )
}

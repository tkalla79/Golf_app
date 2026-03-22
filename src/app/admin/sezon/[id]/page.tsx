'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { PL } from '@/constants/pl'
import Link from 'next/link'

interface Player {
  id: number
  firstName: string
  lastName: string
  hcp: number | null
  slug: string
}

interface GroupPlayer {
  id: number
  playerId: number
  player: Player
}

interface Group {
  id: number
  name: string
  sortOrder: number
  status: string
  players: GroupPlayer[]
  _count: { matches: number }
}

interface Round {
  id: number
  name: string
  roundNumber: number
  status: string
  holes: number
  dateStart: string | null
  dateEnd: string | null
  groups: Group[]
}

interface Season {
  id: number
  name: string
  year: number
  status: string
  rounds: Round[]
}

export default function AdminSeasonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [season, setSeason] = useState<Season | null>(null)
  const [allPlayers, setAllPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)

  // Round form
  const [showRoundForm, setShowRoundForm] = useState(false)
  const [roundForm, setRoundForm] = useState({
    name: '',
    holes: '9',
    dateStart: '',
    dateEnd: '',
  })

  // Group form
  const [showGroupForm, setShowGroupForm] = useState<number | null>(null)
  const [groupForm, setGroupForm] = useState({ name: '' })

  // Player assignment
  const [assigningGroup, setAssigningGroup] = useState<number | null>(null)
  const [selectedPlayers, setSelectedPlayers] = useState<number[]>([])

  const loadData = useCallback(async () => {
    const [seasonRes, playersRes] = await Promise.all([
      fetch(`/api/seasons/${id}`),
      fetch('/api/players'),
    ])
    if (seasonRes.ok) setSeason(await seasonRes.json())
    if (playersRes.ok) setAllPlayers(await playersRes.json())
    setLoading(false)
  }, [id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleDeleteRound = async (roundId: number, roundName: string) => {
    if (!confirm(`Usunąć rundę "${roundName}"? Ta operacja usunie wszystkie grupy, mecze i wyniki w tej rundzie. Tej operacji nie da się cofnąć.`)) return
    await fetch(`/api/rounds/${roundId}`, { method: 'DELETE' })
    loadData()
  }

  const handleCreateRound = async (e: React.FormEvent) => {
    e.preventDefault()
    await fetch(`/api/seasons/${id}/rounds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...roundForm,
        roundNumber: (season?.rounds.length || 0) + 1,
      }),
    })
    setShowRoundForm(false)
    setRoundForm({ name: '', holes: '9', dateStart: '', dateEnd: '' })
    loadData()
  }

  const handleCreateGroup = async (roundId: number) => {
    await fetch(`/api/rounds/${roundId}/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: groupForm.name,
        sortOrder: season?.rounds.find((r) => r.id === roundId)?.groups.length || 0,
      }),
    })
    setShowGroupForm(null)
    setGroupForm({ name: '' })
    loadData()
  }

  const handleAssignPlayers = async (groupId: number) => {
    await fetch(`/api/groups/${groupId}/players`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerIds: selectedPlayers }),
    })
    setAssigningGroup(null)
    setSelectedPlayers([])
    loadData()
  }

  const handleActivateRound = async (roundId: number) => {
    await fetch(`/api/rounds/${roundId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ACTIVE' }),
    })
    loadData()
  }

  const handleCompleteRound = async (roundId: number) => {
    if (!confirm('Zakończyć rundę? Upewnij się, że wszystkie mecze zostały rozegrane.')) return
    await fetch(`/api/rounds/${roundId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'COMPLETED' }),
    })
    loadData()
  }

  const handleGenerateMatches = async (groupId: number) => {
    await fetch(`/api/groups/${groupId}/generate-matches`, { method: 'POST' })
    loadData()
  }

  if (loading) return <div className="animate-pulse text-[var(--color-text-body)]/50 py-10">{PL.common.loading}</div>
  if (!season) return <div className="text-[var(--color-text-body)]">Sezon nie znaleziony</div>

  // Players already assigned in current season
  const assignedPlayerIds = new Set(
    season.rounds.flatMap((r) =>
      r.groups.flatMap((g) => g.players.map((gp) => gp.playerId))
    )
  )

  return (
    <div>
      {/* Header */}
      <div className="mb-10">
        <Link href="/admin/sezon" className="text-sm text-[var(--color-primary)] hover:text-[var(--color-accent)] transition-colors font-medium">
          &larr; Sezony
        </Link>
        <h1 className="text-3xl font-bold text-[var(--color-primary)] mt-4" style={{ fontFamily: 'Raleway, sans-serif' }}>
          {season.name}
        </h1>
        <div className="flex items-center gap-3 mt-2">
          <span className="inline-block w-10 h-0.5 bg-[var(--color-accent)]"></span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
            season.status === 'ACTIVE' ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]' : 'bg-[var(--color-text-body)]/10 text-[var(--color-text-body)]'
          }`}>
            {season.status === 'ACTIVE' ? 'Aktywny' : season.status}
          </span>
        </div>
      </div>

      {/* Add round button */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-[var(--color-text-dark)]" style={{ fontFamily: 'Raleway, sans-serif' }}>
          Rundy
        </h2>
        <button onClick={() => setShowRoundForm(true)} className="btn-primary text-sm">
          + Dodaj rundę
        </button>
      </div>

      {/* Round form */}
      {showRoundForm && (
        <div className="card p-6 mb-6">
          <h3 className="font-bold text-[var(--color-text-dark)] mb-4">Nowa runda</h3>
          <form onSubmit={handleCreateRound} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-body)]/60 mb-2">
                Nazwa
              </label>
              <input
                type="text"
                value={roundForm.name}
                onChange={(e) => setRoundForm({ ...roundForm, name: e.target.value })}
                required
                placeholder="np. Runda eliminacyjna"
                className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-body)]/60 mb-2">
                Dołki
              </label>
              <select
                value={roundForm.holes}
                onChange={(e) => setRoundForm({ ...roundForm, holes: e.target.value })}
                className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg"
              >
                <option value="9">9</option>
                <option value="18">18</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-body)]/60 mb-2">
                Data rozpoczęcia
              </label>
              <input
                type="date"
                value={roundForm.dateStart}
                onChange={(e) => setRoundForm({ ...roundForm, dateStart: e.target.value })}
                className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-body)]/60 mb-2">
                Data zakończenia
              </label>
              <input
                type="date"
                value={roundForm.dateEnd}
                onChange={(e) => setRoundForm({ ...roundForm, dateEnd: e.target.value })}
                className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg"
              />
            </div>
            <div className="flex gap-3 md:col-span-2">
              <button type="submit" className="btn-secondary text-sm">Utwórz</button>
              <button type="button" onClick={() => setShowRoundForm(false)} className="text-sm text-[var(--color-text-body)] hover:text-[var(--color-text-dark)]">
                Anuluj
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rounds */}
      <div className="space-y-8">
        {season.rounds.map((round) => (
          <div key={round.id} className="card p-0 overflow-hidden">
            {/* Round header */}
            <div className="bg-[var(--color-primary)] px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <h3 className="text-white font-bold" style={{ fontFamily: 'Raleway, sans-serif' }}>
                  {round.name}
                </h3>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                  round.status === 'ACTIVE' ? 'bg-white/20 text-white' :
                  round.status === 'COMPLETED' ? 'bg-white/10 text-white/60' :
                  'bg-[var(--color-accent)] text-[var(--color-primary-dark)]'
                }`}>
                  {round.status === 'ACTIVE' ? 'Aktywna' : round.status === 'COMPLETED' ? 'Zakończona' : 'Szkic'}
                </span>
              </div>
              <div className="flex gap-3">
                {round.status === 'DRAFT' && (
                  <button onClick={() => handleActivateRound(round.id)} className="text-xs text-white/70 hover:text-white font-semibold">
                    Aktywuj
                  </button>
                )}
                {round.status === 'ACTIVE' && (
                  <button onClick={() => handleCompleteRound(round.id)} className="text-xs text-white/70 hover:text-white font-semibold">
                    Zakończ
                  </button>
                )}
                <button
                  onClick={() => handleDeleteRound(round.id, round.name)}
                  className="text-xs text-red-300/70 hover:text-red-200 font-semibold"
                >
                  Usuń
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="text-sm text-[var(--color-text-body)]/50 mb-4">
                {round.holes} dołków
                {round.dateStart && ` · ${new Date(round.dateStart).toLocaleDateString('pl-PL')}`}
                {round.dateEnd && ` – ${new Date(round.dateEnd).toLocaleDateString('pl-PL')}`}
              </div>

              {/* Groups */}
              <div className="space-y-4">
                {round.groups.map((group) => (
                  <div key={group.id} className="border border-[var(--color-border)] rounded-lg p-4">
                    <div className="flex justify-between items-center mb-3">
                      <Link
                        href={`/admin/grupa/${group.id}`}
                        className="font-bold text-[var(--color-primary)] hover:text-[var(--color-accent)] transition-colors"
                      >
                        {group.name}
                      </Link>
                      <div className="flex items-center gap-3 text-xs text-[var(--color-text-body)]/50">
                        <span>{group.players.length} zawodników</span>
                        <span>{group._count.matches} meczów</span>
                        {group.players.length > 1 && group._count.matches === 0 && (
                          <button
                            onClick={() => handleGenerateMatches(group.id)}
                            className="text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] font-semibold"
                          >
                            Generuj mecze
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Players in group */}
                    {group.players.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {group.players.map((gp) => (
                          <span key={gp.id} className="text-xs bg-[var(--color-bg-section)] text-[var(--color-text-dark)] px-3 py-1 rounded-full font-medium">
                            {gp.player.firstName} {gp.player.lastName}
                            {gp.player.hcp !== null && <span className="text-[var(--color-text-body)]/40 ml-1">({Number(gp.player.hcp).toFixed(1)})</span>}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Add players button */}
                    <button
                      onClick={() => {
                        setAssigningGroup(group.id)
                        setSelectedPlayers(group.players.map((gp) => gp.playerId))
                      }}
                      className="text-xs text-[var(--color-primary)] hover:text-[var(--color-accent)] font-semibold transition-colors"
                    >
                      + Przypisz zawodników
                    </button>
                  </div>
                ))}
              </div>

              {/* Add group button */}
              <div className="mt-4">
                {showGroupForm === round.id ? (
                  <div className="flex gap-3 items-end">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={groupForm.name}
                        onChange={(e) => setGroupForm({ name: e.target.value })}
                        placeholder="Nazwa grupy (np. Grupa 1)"
                        className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm"
                      />
                    </div>
                    <button onClick={() => handleCreateGroup(round.id)} className="btn-secondary text-sm">
                      Utwórz
                    </button>
                    <button onClick={() => setShowGroupForm(null)} className="text-sm text-[var(--color-text-body)]">
                      Anuluj
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setShowGroupForm(round.id)
                      setGroupForm({ name: `Grupa ${round.groups.length + 1}` })
                    }}
                    className="text-sm text-[var(--color-primary)] hover:text-[var(--color-accent)] font-semibold transition-colors"
                  >
                    + Dodaj grupę
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Player assignment modal */}
      {assigningGroup !== null && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="card p-8 w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-[var(--color-primary)] mb-1" style={{ fontFamily: 'Raleway, sans-serif' }}>
              Przypisz zawodników
            </h3>
            <div className="flex items-center gap-3 mb-6">
              <span className="inline-block w-8 h-0.5 bg-[var(--color-accent)]"></span>
            </div>

            <div className="space-y-1 mb-6">
              {allPlayers.map((player) => {
                const isSelected = selectedPlayers.includes(player.id)
                const isAssignedElsewhere = assignedPlayerIds.has(player.id) && !isSelected

                return (
                  <label
                    key={player.id}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      isSelected ? 'bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20' :
                      isAssignedElsewhere ? 'opacity-40' :
                      'hover:bg-[var(--color-bg-section)] border border-transparent'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isAssignedElsewhere}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedPlayers([...selectedPlayers, player.id])
                        } else {
                          setSelectedPlayers(selectedPlayers.filter((id) => id !== player.id))
                        }
                      }}
                      className="w-4 h-4 rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                    />
                    <span className="font-medium text-[var(--color-text-dark)] flex-1">
                      {player.firstName} {player.lastName}
                    </span>
                    {player.hcp !== null && (
                      <span className="text-xs text-[var(--color-text-body)]/40">
                        HCP {Number(player.hcp).toFixed(1)}
                      </span>
                    )}
                    {isAssignedElsewhere && (
                      <span className="text-xs text-[var(--color-text-body)]/40">przypisany</span>
                    )}
                  </label>
                )
              })}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleAssignPlayers(assigningGroup)}
                className="flex-1 btn-primary py-3 text-center text-sm uppercase tracking-wider"
              >
                Zapisz ({selectedPlayers.length} zawodników)
              </button>
              <button
                onClick={() => { setAssigningGroup(null); setSelectedPlayers([]) }}
                className="flex-1 border border-[var(--color-border)] text-[var(--color-text-body)] py-3 rounded-md hover:bg-[var(--color-bg-section)] transition-colors text-sm font-semibold"
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

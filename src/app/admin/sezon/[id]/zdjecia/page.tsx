'use client'

import { useState, useCallback, useEffect, useRef, use } from 'react'
import Image from 'next/image'
import Link from 'next/link'

interface SeasonPhoto {
  id: number
  url: string
  caption: string | null
  sortOrder: number
}

interface SeasonDocument {
  id: number
  url: string
  title: string
  docType: string
  sortOrder: number
}

export default function AdminSeasonZdjeciaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [seasonName, setSeasonName] = useState('')
  const [photos, setPhotos] = useState<SeasonPhoto[]>([])
  const [docs, setDocs] = useState<SeasonDocument[]>([])

  // Photo upload state
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoCaption, setPhotoCaption] = useState('')
  const [photoError, setPhotoError] = useState('')
  const photoInputRef = useRef<HTMLInputElement>(null)

  // Doc upload state
  const [docUploading, setDocUploading] = useState(false)
  const [docTitle, setDocTitle] = useState('')
  const [docError, setDocError] = useState('')
  const docInputRef = useRef<HTMLInputElement>(null)

  const loadData = useCallback(async () => {
    const [seasonRes, photosRes, docsRes] = await Promise.all([
      fetch(`/api/seasons/${id}`),
      fetch(`/api/season-photos/${id}`),
      fetch(`/api/season-docs/${id}`),
    ])
    if (seasonRes.ok) {
      const s = await seasonRes.json()
      setSeasonName(s.name || `Sezon #${id}`)
    }
    if (photosRes.ok) setPhotos(await photosRes.json())
    if (docsRes.ok) setDocs(await docsRes.json())
  }, [id])

  useEffect(() => { loadData() }, [loadData])

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoUploading(true)
    setPhotoError('')
    const fd = new FormData()
    fd.append('file', file)
    const uploadRes = await fetch('/api/upload/season-photos', { method: 'POST', body: fd })
    const uploadData = await uploadRes.json()
    if (!uploadRes.ok) {
      setPhotoError(uploadData.error || 'Błąd uploadu')
      setPhotoUploading(false)
      return
    }
    const saveRes = await fetch(`/api/season-photos/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: uploadData.url, caption: photoCaption || null }),
    })
    if (saveRes.ok) {
      setPhotoCaption('')
      if (photoInputRef.current) photoInputRef.current.value = ''
      loadData()
    } else {
      setPhotoError('Błąd zapisywania zdjęcia')
    }
    setPhotoUploading(false)
  }

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!docTitle.trim()) {
      setDocError('Podaj tytuł dokumentu przed wgraniem')
      return
    }
    setDocUploading(true)
    setDocError('')
    const fd = new FormData()
    fd.append('file', file)
    const uploadRes = await fetch('/api/upload/season-docs', { method: 'POST', body: fd })
    const uploadData = await uploadRes.json()
    if (!uploadRes.ok) {
      setDocError(uploadData.error || 'Błąd uploadu')
      setDocUploading(false)
      return
    }
    const saveRes = await fetch(`/api/season-docs/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: uploadData.url, title: docTitle, docType: uploadData.docType }),
    })
    if (saveRes.ok) {
      setDocTitle('')
      if (docInputRef.current) docInputRef.current.value = ''
      loadData()
    } else {
      setDocError('Błąd zapisywania dokumentu')
    }
    setDocUploading(false)
  }

  const handleDeletePhoto = async (photoId: number) => {
    if (!confirm('Usunąć to zdjęcie?')) return
    await fetch(`/api/season-photos/${id}/${photoId}`, { method: 'DELETE' })
    loadData()
  }

  const handleDeleteDoc = async (docId: number) => {
    if (!confirm('Usunąć ten dokument?')) return
    await fetch(`/api/season-docs/${id}/${docId}`, { method: 'DELETE' })
    loadData()
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-8">
        <Link
          href={`/admin/sezon/${id}`}
          className="text-sm text-[var(--color-primary)] hover:text-[var(--color-accent)] transition-colors font-medium"
        >
          &larr; {seasonName || `Sezon #${id}`}
        </Link>
        <h1
          className="text-2xl font-bold text-[var(--color-text-dark)] mt-4"
          style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}
        >
          Zdjęcia i dokumenty
        </h1>
        <p className="text-sm text-[var(--color-text-body)]/50 mt-1">
          Galeria zdjęć i tabele wyników do archiwum sezonu
        </p>
      </div>

      {/* ---- PHOTOS SECTION ---- */}
      <div className="mb-12">
        <h2
          className="text-lg font-bold text-[var(--color-text-dark)] mb-4 pb-2 border-b border-[var(--color-border)]"
          style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}
        >
          Zdjęcia galerii
        </h2>

        {/* Upload form */}
        <div className="card p-5 mb-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-body)]/50 mb-3">
            Dodaj zdjęcie
          </p>
          {photoError && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {photoError}
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={photoCaption}
              onChange={e => setPhotoCaption(e.target.value)}
              placeholder="Podpis zdjęcia (opcjonalny)"
              className="flex-1 px-4 py-2.5 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:outline-none text-sm"
            />
            <label className={`flex items-center gap-2 px-4 py-2.5 rounded-lg cursor-pointer text-sm font-semibold transition-colors ${
              photoUploading
                ? 'bg-[var(--color-border)] text-[var(--color-text-body)]/40 cursor-not-allowed'
                : 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]/90'
            }`}>
              {photoUploading ? 'Wgrywanie...' : '+ Wybierz zdjęcie'}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
                disabled={photoUploading}
              />
            </label>
          </div>
          <p className="text-xs text-[var(--color-text-body)]/40 mt-2">
            Formaty: JPG, PNG, WEBP · Max 5MB
          </p>
        </div>

        {/* Photos grid */}
        {photos.length === 0 ? (
          <p className="text-[var(--color-text-body)]/40 italic text-sm">Brak zdjęć</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {photos.map(photo => (
              <div key={photo.id} className="relative group rounded-lg overflow-hidden border border-[var(--color-border)] bg-[var(--color-bg-section)]">
                <div className="relative aspect-square">
                  <Image src={photo.url} alt={photo.caption || ''} fill className="object-cover" />
                </div>
                {photo.caption && (
                  <p className="text-xs text-[var(--color-text-body)]/60 px-2 py-1.5 truncate">
                    {photo.caption}
                  </p>
                )}
                <button
                  onClick={() => handleDeletePhoto(photo.id)}
                  className="absolute top-1 right-1 bg-red-600 text-white text-xs rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  Usuń
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---- DOCUMENTS SECTION ---- */}
      <div>
        <h2
          className="text-lg font-bold text-[var(--color-text-dark)] mb-4 pb-2 border-b border-[var(--color-border)]"
          style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}
        >
          Tabele wyników i dokumenty
        </h2>

        {/* Upload form */}
        <div className="card p-5 mb-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-body)]/50 mb-3">
            Dodaj dokument / tabelę wyników
          </p>
          {docError && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {docError}
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3 mb-2">
            <input
              type="text"
              value={docTitle}
              onChange={e => setDocTitle(e.target.value)}
              placeholder="Tytuł dokumentu (wymagany) *"
              className="flex-1 px-4 py-2.5 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:outline-none text-sm"
            />
            <label className={`flex items-center gap-2 px-4 py-2.5 rounded-lg cursor-pointer text-sm font-semibold transition-colors ${
              docUploading
                ? 'bg-[var(--color-border)] text-[var(--color-text-body)]/40 cursor-not-allowed'
                : 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]/90'
            }`}>
              {docUploading ? 'Wgrywanie...' : '+ Wybierz plik'}
              <input
                ref={docInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleDocUpload}
                disabled={docUploading}
              />
            </label>
          </div>
          <p className="text-xs text-[var(--color-text-body)]/40">
            Formaty: JPG, PNG, WEBP, PDF · Max 20MB
          </p>
        </div>

        {/* Docs list */}
        {docs.length === 0 ? (
          <p className="text-[var(--color-text-body)]/40 italic text-sm">Brak dokumentów</p>
        ) : (
          <div className="card p-0 overflow-hidden">
            <table className="standings-table w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left">Tytuł</th>
                  <th className="text-center hidden sm:table-cell">Typ</th>
                  <th className="text-right">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {docs.map(doc => (
                  <tr key={doc.id}>
                    <td>
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--color-primary)] hover:text-[var(--color-accent)] font-medium transition-colors"
                      >
                        {doc.title}
                      </a>
                    </td>
                    <td className="text-center hidden sm:table-cell">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        doc.docType === 'pdf'
                          ? 'bg-red-50 text-red-700'
                          : 'bg-blue-50 text-blue-700'
                      }`}>
                        {doc.docType.toUpperCase()}
                      </span>
                    </td>
                    <td className="text-right">
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--color-primary)] hover:text-[var(--color-accent)] text-xs font-semibold mr-3 transition-colors"
                      >
                        Otwórz
                      </a>
                      <button
                        onClick={() => handleDeleteDoc(doc.id)}
                        className="text-red-500 hover:text-red-700 text-xs font-semibold transition-colors"
                      >
                        Usuń
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

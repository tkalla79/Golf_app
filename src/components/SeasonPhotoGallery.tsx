'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { PL } from '@/constants/pl'

interface Photo {
  id: number
  url: string
  caption: string | null
}

interface SeasonPhotoGalleryProps {
  photos: Photo[]
}

export default function SeasonPhotoGallery({ photos }: SeasonPhotoGalleryProps) {
  const [lightbox, setLightbox] = useState<Photo | null>(null)

  useEffect(() => {
    if (!lightbox) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [lightbox])

  if (photos.length === 0) return null

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {photos.map((photo) => (
          <button
            key={photo.id}
            onClick={() => setLightbox(photo)}
            className="relative aspect-[4/3] rounded-lg overflow-hidden group cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          >
            <Image
              src={photo.url}
              alt={photo.caption || ''}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
            {photo.caption && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <p className="text-white text-xs leading-snug line-clamp-2">{photo.caption}</p>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setLightbox(null)}
              className="absolute -top-10 right-0 text-white/70 hover:text-white text-sm font-medium"
            >
              ✕ {PL.common.close}
            </button>
            <div className="relative w-full" style={{ aspectRatio: '4/3' }}>
              <Image
                src={lightbox.url}
                alt={lightbox.caption || ''}
                fill
                className="object-contain rounded-lg"
              />
            </div>
            {lightbox.caption && (
              <p className="text-white/70 text-sm text-center mt-3">{lightbox.caption}</p>
            )}
          </div>
        </div>
      )}
    </>
  )
}

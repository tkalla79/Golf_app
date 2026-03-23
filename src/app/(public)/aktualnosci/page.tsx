import type { Metadata } from 'next'
import Link from 'next/link'
import { getPosts, getFeaturedImageUrl, formatDate } from '@/lib/wordpress'
import { PL } from '@/constants/pl'

export const metadata: Metadata = {
  title: 'Aktualności | Don Papa Match Play',
  description: 'Aktualności i informacje z ligi golfowej Don Papa Match Play - Karolinka Golf Park',
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').trim()
}

export default async function AktualnosciPage() {
  const { posts } = await getPosts()

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-4xl font-bold text-[var(--color-primary)]"
          style={{ fontFamily: 'Raleway, sans-serif' }}
        >
          {PL.nav.news}
        </h1>
        <span className="inline-block w-12 h-0.5 bg-[var(--color-accent)] mt-3" />
      </div>

      {posts.length === 0 ? (
        <p className="text-[var(--color-text-body)] text-center py-12">
          Brak aktualności
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post) => {
            const imageUrl = getFeaturedImageUrl(post)
            const excerpt = stripHtml(post.excerpt.rendered)

            return (
              <Link
                key={post.id}
                href={`/aktualnosci/${post.slug}`}
                className="card card-clickable overflow-hidden block"
              >
                {imageUrl && (
                  <div
                    className="w-full bg-[var(--color-border)] bg-cover bg-center"
                    style={{
                      aspectRatio: '16/9',
                      backgroundImage: `url(${imageUrl})`,
                    }}
                  />
                )}
                <div className="p-5">
                  <h2
                    className="text-lg font-bold text-[var(--color-primary)] leading-tight"
                    style={{ fontFamily: 'Raleway, sans-serif' }}
                    dangerouslySetInnerHTML={{ __html: post.title.rendered }}
                  />
                  <p className="text-xs text-[var(--color-text-body)]/60 mt-2">
                    {formatDate(post.date)}
                  </p>
                  <p
                    className="text-sm text-[var(--color-text-body)] mt-2 leading-relaxed"
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {excerpt}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

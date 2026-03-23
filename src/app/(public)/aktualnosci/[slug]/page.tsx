import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPost, getFeaturedImageUrl, formatDate } from '@/lib/wordpress'
import { PL } from '@/constants/pl'

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = await getPost(slug)

  if (!post) return notFound()

  const imageUrl = getFeaturedImageUrl(post)

  return (
    <article className="max-w-3xl mx-auto">
      {/* Breadcrumb */}
      <Link
        href="/aktualnosci"
        className="inline-flex items-center gap-1 text-sm text-[var(--color-primary)] font-semibold hover:text-[var(--color-primary-light)] mb-6"
        style={{ fontFamily: 'Raleway, sans-serif' }}
      >
        &larr; {PL.nav.news}
      </Link>

      {/* Featured image */}
      {imageUrl && (
        <div
          className="w-full rounded-xl overflow-hidden mb-6 bg-[var(--color-border)] bg-cover bg-center"
          style={{
            aspectRatio: '16/9',
            backgroundImage: `url(${imageUrl})`,
          }}
        />
      )}

      {/* Title */}
      <h1
        className="text-3xl md:text-4xl font-bold text-[var(--color-primary)] leading-tight"
        style={{ fontFamily: 'Raleway, sans-serif' }}
        dangerouslySetInnerHTML={{ __html: post.title.rendered }}
      />

      {/* Date */}
      <p className="text-sm text-[var(--color-text-body)]/60 mt-3 mb-8">
        {formatDate(post.date)}
      </p>

      {/* Content */}
      <div
        className="wp-content"
        dangerouslySetInnerHTML={{ __html: post.content.rendered }}
      />
    </article>
  )
}

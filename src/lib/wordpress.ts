const WP_API_URL = process.env.WORDPRESS_API_URL || 'https://wp.donpapagolf.pl/wp-json/wp/v2'

export interface WPPost {
  id: number
  slug: string
  title: { rendered: string }
  excerpt: { rendered: string }
  content: { rendered: string }
  date: string
  featured_media: number
  _embedded?: {
    'wp:featuredmedia'?: Array<{
      source_url: string
      alt_text: string
    }>
  }
}

export async function getPosts(page = 1, perPage = 10): Promise<{ posts: WPPost[], total: number }> {
  try {
    const res = await fetch(
      `${WP_API_URL}/posts?_embed&page=${page}&per_page=${perPage}&orderby=date&order=desc`,
      { next: { revalidate: 300 } }
    )
    if (!res.ok) return { posts: [], total: 0 }
    const total = parseInt(res.headers.get('X-WP-Total') || '0')
    const posts = await res.json()
    return { posts, total }
  } catch {
    return { posts: [], total: 0 }
  }
}

export async function getPost(slug: string): Promise<WPPost | null> {
  try {
    const res = await fetch(
      `${WP_API_URL}/posts?_embed&slug=${encodeURIComponent(slug)}`,
      { next: { revalidate: 300 } }
    )
    if (!res.ok) return null
    const posts = await res.json()
    return posts[0] || null
  } catch {
    return null
  }
}

export function getFeaturedImageUrl(post: WPPost): string | null {
  return post._embedded?.['wp:featuredmedia']?.[0]?.source_url ?? null
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

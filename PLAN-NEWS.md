# Plan: Aktualności (WordPress Headless)

## Cel

Dodanie sekcji "Aktualności" na donpapagolf.pl. Treści zarządzane przez WordPress (headless CMS), wyświetlane na stronie Next.js.

## Architektura

```
wp.donpapagolf.pl (WordPress)         donpapagolf.pl (Next.js)
┌──────────────────────────┐          ┌──────────────────────────┐
│  /wp-admin/              │          │  /aktualnosci            │
│  - dodawanie postów      │          │  - lista newsów          │
│  - upload zdjęć          │◄────────►│  /aktualnosci/[slug]     │
│  - edycja, usuwanie      │  REST    │  - pojedynczy news       │
│                          │  API     │                          │
│  API: /wp-json/wp/v2/    │          │  Cache: ISR revalidate   │
└──────────────────────────┘          └──────────────────────────┘
```

Oba na tym samym serwerze (209.38.211.80), Caddy routuje po domenie.

## Stack

| Element | Wybór |
|---------|-------|
| CMS | WordPress (oficjalny obraz Docker) |
| Baza WP | Ta sama instancja MySQL (osobna baza `wordpress`) |
| Routing | Caddy: `wp.donpapagolf.pl` → WordPress, `donpapagolf.pl` → Next.js |
| API | WordPress REST API (`/wp-json/wp/v2/posts`) |
| Cache | Next.js ISR, revalidate co 5 minut |

## Implementacja

### 1. Docker - dodanie WordPressa

Dodaj do `docker-compose.yml`:

```yaml
wordpress:
  image: wordpress:6-apache
  expose:
    - "80"
  environment:
    WORDPRESS_DB_HOST: db
    WORDPRESS_DB_USER: donpapa
    WORDPRESS_DB_PASSWORD: ${DB_PASSWORD}
    WORDPRESS_DB_NAME: wordpress
  volumes:
    - wordpress_data:/var/www/html
  depends_on:
    db:
      condition: service_healthy
  restart: unless-stopped
```

Dodaj volume:
```yaml
volumes:
  wordpress_data:
    driver: local
```

Dodaj bazę `wordpress` w MySQL - rozszerz init lub utwórz ręcznie:
```sql
CREATE DATABASE IF NOT EXISTS wordpress;
GRANT ALL ON wordpress.* TO 'donpapa'@'%';
```

### 2. Caddy - routing

Zaktualizuj `Caddyfile`:

```
donpapagolf.pl {
    reverse_proxy app:3000 {
        header_up X-Forwarded-Host donpapagolf.pl
        header_up X-Forwarded-Proto https
    }
}

wp.donpapagolf.pl {
    reverse_proxy wordpress:80
}

www.donpapagolf.pl {
    redir https://donpapagolf.pl{uri} permanent
}
```

### 3. WordPress - konfiguracja

Po uruchomieniu:
1. Wejdź na `https://wp.donpapagolf.pl` i przejdź kreator instalacji
2. Zainstaluj i aktywuj plugin **WP REST API** (wbudowany od WP 4.7)
3. W Settings → Permalinks ustaw "Post name" (żeby slug działał)
4. Opcjonalnie: zainstaluj plugin **Application Passwords** do autoryzacji API
5. Wyłącz frontend WP (opcjonalnie - redirect na donpapagolf.pl)

### 4. Next.js - lib do pobierania newsów

Nowy plik `src/lib/wordpress.ts`:

```typescript
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
  const res = await fetch(
    `${WP_API_URL}/posts?_embed&page=${page}&per_page=${perPage}&orderby=date&order=desc`,
    { next: { revalidate: 300 } } // 5 minut cache
  )
  const total = parseInt(res.headers.get('X-WP-Total') || '0')
  const posts = await res.json()
  return { posts, total }
}

export async function getPost(slug: string): Promise<WPPost | null> {
  const res = await fetch(
    `${WP_API_URL}/posts?_embed&slug=${slug}`,
    { next: { revalidate: 300 } }
  )
  const posts = await res.json()
  return posts[0] || null
}
```

### 5. Next.js - strony

#### `/aktualnosci/page.tsx` - lista newsów

- Nagłówek "Aktualności" w stylu Karolinki
- Lista kart: zdjęcie główne, tytuł, data, excerpt
- Paginacja (jeśli >10 postów)
- ISR revalidate co 5 minut

#### `/aktualnosci/[slug]/page.tsx` - pojedynczy post

- Breadcrumb ← Aktualności
- Tytuł, data, zdjęcie główne
- Pełna treść (HTML z WP - `dangerouslySetInnerHTML`)
- Uwaga na XSS: treść z WP jest zaufana (nasz admin ją pisze)

### 6. Nawigacja

Dodaj "Aktualności" do Navbar jako ostatni link:

```typescript
const links = [
  { href: '/grupy', label: 'Grupy' },
  { href: '/zawodnicy', label: 'Zawodnicy' },
  { href: '/aktualnosci', label: 'Aktualności' },
]
```

### 7. .env

Dodaj do `.env.example` i `.env` na serwerze:
```
WORDPRESS_API_URL=https://wp.donpapagolf.pl/wp-json/wp/v2
```

## Kolejność prac

1. **Docker + Caddy** - dodaj WordPress do compose, skonfiguruj routing
2. **DNS** - dodaj A record `wp.donpapagolf.pl` → 209.38.211.80
3. **WordPress setup** - instalacja, permalinks, testowy post
4. **Next.js lib** - `wordpress.ts` z fetch + cache
5. **Strona listy** - `/aktualnosci`
6. **Strona posta** - `/aktualnosci/[slug]`
7. **Navbar** - dodaj link "Aktualności"
8. **Deploy** - build + upload + restart
9. **Test** - dodaj news w WP, sprawdź czy pojawia się na stronie

## Uwagi

- WordPress media (zdjęcia) serwowane bezpośrednio z `wp.donpapagolf.pl` - Next.js linkuje do nich, nie kopiuje
- `wordpress_data` volume jest persistent - dane WP przetrwają restart
- MySQL: WordPress używa osobnej bazy `wordpress`, nie miesza się z `donpapa`
- Flat lista postów, bez kategorii, bez komentarzy
- WP REST API jest publiczne (read-only) - nie wymaga autoryzacji do odczytu

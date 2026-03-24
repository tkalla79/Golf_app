# Don Papa Match Play - Liga Golfowa

## Context

Aplikacja webowa do zarządzania rozgrywkami ligowymi "Don Papa Match Play" w Karolinka Golf Park (Kamień Śląski). Zastępuje ręczne zarządzanie przez WordPress + WhatsApp.

- **Produkcja:** https://donpapagolf.pl
- **Repo:** git@github.com:tkalla79/Golf_app.git
- **Deploy:** patrz `DEPLOY.md`
- **Regulamin 2026:** `DOCS/Regulamin Rozgrywek Ligi Don Papa Match Play 2026.docx`
- **Dane graczy:** `DOCS/gracze_grupy_2026.csv`

---

## Tech Stack

| Warstwa | Wybór |
|---------|-------|
| **Frontend** | Next.js 16 (App Router) + Tailwind CSS |
| **Backend** | Next.js API Routes + Prisma 6 ORM |
| **Auth admin** | NextAuth.js v5 (Credentials provider) |
| **Auth gracz** | Magic link via email (Brevo SMTP) + JWT cookie |
| **Baza** | MySQL 8 |
| **Deploy** | Docker (build lokalnie) + Caddy (SSL) na Scaleway VPS |
| **Branding** | Kolory Karolinki (#134a56, #d5b665), fonty Raleway + Lato |

---

## Zasady ligi 2026 (skrót)

### Format
- Match Play brutto (R&A Rules), pole KGP, 9 lub 18 dołków

### Struktura sezonu
1. **Runda wstępna** (22.03 - 24.05): 5 grup po 10, round-robin
2. **Runda 2-4**: regruping (zwycięzcy → Grupa A, drudzy → B, itd.)
3. **Play-off** (17.08 - 31.10): 3 drabinki (1-16, 17-32, 33-48)

### Punktacja
- Wygrana: 3 pkt, Remis: 2 pkt, Porażka: 1 pkt, Nierozegrany: 0
- Walkower: zwycięzca 3, przegrany 0
- "Małe punkty" od marginesu wygranej (1Up=±1, 2Up=±2, ..., 5&4=±9)
- Tiebreakery: h2h → mała tabelka → małe punkty → HCP → losowanie

### Limit: 50 zawodników, wpisowe 400 PLN

---

## Co jest zrobione (v0.0.3)

### Strony publiczne
- `/grupy` - przegląd grup aktywnej rundy z mini tabelami
- `/grupa/[id]` - pełna tabela + mecze (przełącznik Lista/Tabelka macierzowa)
- `/zawodnicy` - lista graczy z avatarami
- `/zawodnik/[slug]` - profil: avatar, HCP, nadchodzące mecze, historia

### Panel admina (`/admin`)
- Login email+hasło (3 adminy: codelabs, hardbeans, k2biznes)
- Dashboard z przeglądem sezonu
- CRUD graczy (imię, nazwisko, email, telefon, HCP)
- Zarządzanie sezonem: tworzenie rund, grup, przypisywanie graczy
- Generowanie par meczowych (round-robin)
- Wprowadzanie wyników z auto-obliczaniem punktów
- Generowanie grup kolejnej rundy z podglądem
- Usuwanie rund (z potwierdzeniem)
- Zarządzanie adminami

### Logowanie gracza
- Magic link: gracz klika "Zaloguj się" → email z linkiem → klik → zalogowany
- Po zalogowaniu: edycja HCP, upload avatara, edycja email/telefonu
- Dane kontaktowe widoczne dla zalogowanych graczy (cudze profile: readonly)
- Brevo SMTP do wysyłki maili

### Infrastruktura
- Docker: Caddy (SSL) + Next.js + MySQL z persistent volume
- Build lokalnie (serwer za mały na build), upload gotowych images
- Seed z prawdziwymi graczami z CSV

---

## Schemat bazy danych

### admins
- id, email (unique), password_hash, first_name, last_name, created_at, updated_at

### players
- id, first_name, last_name, email (nullable), phone (nullable), password_hash (nullable)
- slug (unique), hcp (decimal nullable), avatar_url (nullable)
- login_token (unique nullable), login_token_expiry (nullable)
- active (bool), created_at, updated_at

### seasons
- id, name, year, status (DRAFT/ACTIVE/COMPLETED), config (JSON - zasady punktacji), timestamps

### rounds
- id, season_id, name, round_number, type (ROUND_ROBIN/PLAYOFF), holes, date_start, date_end, status, config

### groups
- id, round_id, name, sort_order, status (DRAFT/APPROVED/ACTIVE/COMPLETED)

### group_players
- id, group_id, player_id (unique pair), hcp_at_start, final_position

### matches
- id, group_id, player1_id, player2_id, result_code, winner_id
- player1/2_big_points, player1/2_small_points
- played, is_walkover, notes

---

## Kluczowa logika biznesowa

### `src/lib/scoring.ts`
- Oblicza duże i małe punkty z wyniku meczu
- Config punktacji per sezon (z `season.config` JSON)

### `src/lib/standings.ts`
- Tabela grupy z tiebreakers: h2h, mała tabelka, małe punkty, HCP

### `src/lib/group-generator.ts`
- Auto-generowanie grup kolejnej rundy (pozycja 1 → Grupa A, itd.)

### `src/lib/slug.ts`
- Tworzenie slugów z polskich znaków (Ł→L, ś→s, etc.)

### `src/lib/player-auth.ts`
- JWT session cookie dla zalogowanych graczy (30 dni)

### `src/lib/mail.ts`
- Wysyłka maili logowania przez Brevo SMTP

---

## Do zrobienia (backlog)

### Priorytet wysoki
- [ ] Drabinki play-off (3 bracketów: 1-16, 17-32, 33-48)
- [ ] Docker volume dla avatarów (teraz kasują się przy recreate kontenera)
- [ ] Archiwum poprzednich sezonów

### Priorytet średni
- [ ] Powiadomienia email o zbliżającym się terminie meczu
- [ ] Hasło gracza (oprócz magic link)
- [ ] Admin: edycja konfiguracji sezonu (scoring) przez UI

### Priorytet niski
- [ ] Liga damska
- [ ] Integracja z WhatsApp
- [ ] PWA / mobile app

---

## UWAGA - znane pułapki

- **NIE instaluj `@tailwindcss/typography`** - plugin nie jest kompatybilny z Tailwind v4 (`@plugin` directive nie działa). Strona regulaminu i WordPress content używają custom klas CSS (`regulamin-*`, `wp-content`) zdefiniowanych w `globals.css`. Dwukrotnie mieliśmy z tym problem.

---

## Kluczowe decyzje

1. **Season config jako JSON** - zasady punktacji per sezon, zmiana reguł = nowy wpis z innym config
2. **Pre-computed points** na rekordzie meczu - obliczane raz przy zapisie wyniku
3. **Osobna tabela admins** - admin i gracz mogą mieć ten sam email bez konfliktu
4. **Build lokalnie, deploy gotowych images** - serwer ma za mało RAM na build
5. **Magic link zamiast hasła** - prostsze dla graczy, token 1h, sesja 30 dni
6. **Avatary przez API route** - standalone Next.js nie serwuje plików dodanych po buildzie
7. **NIGDY nie resetuj bazy na produkcji** - `migrate` tylko pushuje schemat, `seed` jest osobny i destrukcyjny

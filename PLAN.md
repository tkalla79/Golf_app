# Don Papa Match Play - Liga Golfowa MVP

## Context

Karolinka Golf Park (Kamień Śląski) prowadzi ligę golfową "Don Papa Match Play". Dotychczas wyniki zarządzane były ręcznie (WordPress + WhatsApp). Budujemy nową aplikację webową do zarządzania rozgrywkami ligowymi - MVP na sezon 2026, deadline: **poniedziałek 23 marca** (5 dni).

Regulamin 2026 znajduje się w `DOCS/Regulamin Rozgrywek Ligi Don Papa Match Play 2026.docx`.

Aktualna (stara) strona z wynikami: http://dpmp.opti-net.pl/
Strona klubu: https://karolinkagolfpark.pl

---

## Tech Stack

| Warstwa | Wybór | Uzasadnienie |
|---------|-------|--------------|
| **Frontend** | Next.js 14 (App Router) + Tailwind CSS | SSR dla stron publicznych, React dla admina, jeden projekt = szybsze MVP |
| **Backend** | Next.js API Routes + Prisma ORM | Brak osobnego serwera, type-safe MySQL, migracje |
| **Auth** | NextAuth.js (Credentials provider) | Proste email+hasło dla adminów, rozszerzalne o login graczy |
| **Baza** | MySQL 8 | Wymaganie klienta |
| **Deploy** | Docker Compose na Scaleway VPS | Persistent volume dla MySQL, single `docker compose up` |

---

## Zasady ligi 2026 (skrót)

### Format
- Match Play brutto (R&A Rules)
- Pole: Karolinka Golf Park, 9 lub 18 dołków zależnie od fazy

### Struktura sezonu
1. **Runda wstępna** (22.03 - 24.05): 5 grup, round-robin, 9 dołków
2. **Runda 2** (25.05 - 21.06): Regruping (A=zwycięzcy, B=drudzy, itd.)
3. **Runda 3** (22.06 - 19.07): Kolejny regruping
4. **Runda 4** (20.07 - 16.08): Kolejny regruping
5. **Play-off** (17.08 - 31.10): 3 drabinki (1-16: 18 dołków, 17-32: 9/18, 33-48: 9)

### Punktacja ("duże punkty")
- Wygrana: 3 pkt
- Remis: 2 pkt
- Porażka: 1 pkt
- Nierozegrany: 0 pkt
- Walkower: zwycięzca 3, przegrany 0

### "Małe punkty" (tiebreaker z marginesu wygranej)
- Tied: 0/0
- 1Up: +1/-1
- 2Up: +2/-2
- 2&1: +3/-3
- 3&1: +4/-4
- 3&2: +5/-5
- 4&2: +6/-6
- 4&3: +7/-7
- 5&3: +8/-8
- 5&4: +9/-9
- Walkower: brak małych punktów

### Tiebreakery (kolejność)
1. Bezpośredni mecz (2 graczy)
2. "Mała tabelka" (3+ graczy - mecze tylko między sobą)
3. Suma małych punktów
4. HCP na start rundy (wyższy HCP = wyższa pozycja)
5. Losowanie przez Zarząd Ligi

### Limit: 50 zawodników, wpisowe 400 PLN

---

## MVP Features

### Panel admina
- 3 początkowych adminów, admin może dodawać kolejnych
- CRUD graczy (imię, nazwisko, email, telefon)
- Tworzenie sezonu z konfiguracją (zasady punktacji w JSON)
- Tworzenie rund, grup, przypisywanie graczy do grup
- Auto-generowanie par meczowych (round-robin) przy tworzeniu grupy
- Wprowadzanie wyników meczów (np. "3&2", "1Up", "Tied", "Walkover")
- System auto-oblicza duże i małe punkty z wyniku
- Po zakończeniu rundy: auto-generowanie grup kolejnej rundy (admin zatwierdza)

### Strony publiczne
- Lista graczy (`/zawodnicy`)
- Przegląd grup aktywnej rundy (`/grupy`) - mini tabele
- Szczegóły grupy (`/grupa/[id]`) - pełna tabela + wyniki meczów
- Profil gracza (`/zawodnik/[slug]`, np. `/zawodnik/jan-kowalski`):
  - Nadchodzące mecze (nierozegrane w bieżącej fazie) - u góry
  - Historia wyników w bieżącym sezonie - poniżej

### Poza MVP (na później)
- Drabinki play-off (play-off zaczyna się w sierpniu)
- Login gracza (schemat DB gotowy, password_hash nullable)
- Powiadomienia (email/SMS/WhatsApp)
- Liga damska
- Archiwum poprzednich sezonów

---

## Struktura projektu

```
karolinkagolfpark/
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── .gitignore
├── .dockerignore
├── DOCS/                           # regulaminy - NIE w buildzie Docker
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # root layout, branding
│   │   ├── page.tsx                # redirect to /grupy
│   │   ├── globals.css
│   │   ├── (public)/
│   │   │   ├── zawodnicy/page.tsx  # lista graczy
│   │   │   ├── zawodnik/[slug]/page.tsx  # profil gracza
│   │   │   ├── grupy/page.tsx      # przegląd grup aktywnej rundy
│   │   │   ├── grupa/[id]/page.tsx # grupa: tabela + wyniki
│   │   │   └── layout.tsx
│   │   ├── admin/
│   │   │   ├── layout.tsx          # auth guard + admin nav
│   │   │   ├── page.tsx            # dashboard
│   │   │   ├── zawodnicy/page.tsx  # CRUD graczy
│   │   │   ├── sezon/[id]/page.tsx # zarządzanie sezonem
│   │   │   ├── grupa/[id]/page.tsx # wprowadzanie wyników
│   │   │   ├── generuj-rundy/page.tsx  # generowanie grup kolejnej rundy
│   │   │   └── uzytkownicy/page.tsx    # zarządzanie adminami
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts
│   │       ├── players/route.ts          # GET list, POST create
│   │       ├── players/[id]/route.ts     # GET, PUT, DELETE
│   │       ├── players/[id]/matches/route.ts
│   │       ├── seasons/route.ts
│   │       ├── seasons/current/route.ts
│   │       ├── rounds/[id]/groups/route.ts
│   │       ├── rounds/[id]/generate-groups/route.ts
│   │       ├── rounds/[id]/approve-groups/route.ts
│   │       ├── groups/[id]/route.ts
│   │       ├── groups/[id]/standings/route.ts
│   │       ├── groups/[id]/matches/route.ts
│   │       ├── matches/[id]/result/route.ts
│   │       └── admins/route.ts
│   ├── lib/
│   │   ├── db.ts                   # Prisma client singleton
│   │   ├── auth.ts                 # NextAuth config
│   │   ├── scoring.ts              # duże/małe punkty z wyniku meczu
│   │   ├── standings.ts            # obliczanie tabeli + tiebreakery
│   │   ├── group-generator.ts      # generowanie grup kolejnej rundy
│   │   └── match-results.ts        # parsowanie wyników
│   ├── components/
│   │   ├── ui/                     # Button, Input, Table, Modal, Badge
│   │   ├── StandingsTable.tsx
│   │   ├── MatchResultForm.tsx
│   │   ├── MatchResultBadge.tsx
│   │   ├── GroupCard.tsx
│   │   ├── PlayerCard.tsx
│   │   └── Navbar.tsx
│   └── constants/
│       └── pl.ts                   # polskie stringi UI
├── tailwind.config.ts
├── next.config.js
├── tsconfig.json
└── package.json
```

---

## Schemat bazy danych

### users
- `id` INT PK AUTO_INCREMENT
- `email` VARCHAR(255) UNIQUE NOT NULL
- `password_hash` VARCHAR(255) NULL — nullable, przyszły login gracza
- `role` ENUM('admin', 'player') DEFAULT 'player'
- `player_id` INT NULL FK -> players.id — link do gracza (przyszłość)
- `created_at`, `updated_at` TIMESTAMP

### players
- `id` INT PK AUTO_INCREMENT
- `first_name` VARCHAR(100) NOT NULL
- `last_name` VARCHAR(100) NOT NULL
- `email` VARCHAR(255) NULL
- `phone` VARCHAR(20) NULL
- `slug` VARCHAR(255) UNIQUE NOT NULL — "jan-kowalski" do URL
- `hcp` DECIMAL(4,1) NULL
- `active` BOOLEAN DEFAULT TRUE
- `created_at`, `updated_at` TIMESTAMP

### seasons
- `id` INT PK AUTO_INCREMENT
- `name` VARCHAR(100) NOT NULL — "Don Papa Match Play 2026"
- `year` INT NOT NULL
- `status` ENUM('draft', 'active', 'completed') DEFAULT 'draft'
- `config` JSON NULL — zasady punktacji per sezon (patrz niżej)
- `created_at`, `updated_at` TIMESTAMP

**Przykład config JSON (2026):**
```json
{
  "scoring": {
    "win": 3, "draw": 2, "loss": 1, "unplayed": 0,
    "walkover_winner": 3, "walkover_loser": 0
  },
  "small_points_map": {
    "Tied": [0, 0], "1Up": [1, -1], "2Up": [2, -2],
    "2&1": [3, -3], "3&1": [4, -4], "3&2": [5, -5],
    "4&2": [6, -6], "4&3": [7, -7], "5&3": [8, -8], "5&4": [9, -9]
  }
}
```

### rounds
- `id` INT PK AUTO_INCREMENT
- `season_id` INT FK -> seasons.id
- `name` VARCHAR(100) NOT NULL — "Runda eliminacyjna", "Runda 2"
- `round_number` INT NOT NULL
- `type` ENUM('round_robin', 'playoff') DEFAULT 'round_robin'
- `holes` INT DEFAULT 9
- `date_start`, `date_end` DATE NULL
- `status` ENUM('draft', 'active', 'completed') DEFAULT 'draft'
- `config` JSON NULL
- `created_at` TIMESTAMP

### groups
- `id` INT PK AUTO_INCREMENT
- `round_id` INT FK -> rounds.id
- `name` VARCHAR(50) NOT NULL — "Grupa A", "Grupa B"
- `sort_order` INT DEFAULT 0
- `status` ENUM('draft', 'approved', 'active', 'completed') DEFAULT 'draft'
- `created_at` TIMESTAMP

### group_players
- `id` INT PK AUTO_INCREMENT
- `group_id` INT FK -> groups.id
- `player_id` INT FK -> players.id
- `hcp_at_start` DECIMAL(4,1) NULL — snapshot HCP do tiebreakera
- `final_position` INT NULL — ustawiane po zakończeniu grupy
- UNIQUE(group_id, player_id)
- `created_at` TIMESTAMP

### matches
- `id` INT PK AUTO_INCREMENT
- `group_id` INT FK -> groups.id
- `player1_id` INT FK -> players.id
- `player2_id` INT FK -> players.id
- `result_code` VARCHAR(20) NULL — "3&2", "1Up", "Tied", "Walkover"
- `winner_id` INT NULL FK -> players.id
- `player1_big_points` INT DEFAULT 0
- `player2_big_points` INT DEFAULT 0
- `player1_small_points` INT DEFAULT 0
- `player2_small_points` INT DEFAULT 0
- `played` BOOLEAN DEFAULT FALSE
- `is_walkover` BOOLEAN DEFAULT FALSE
- `notes` TEXT NULL
- `created_at`, `updated_at` TIMESTAMP

### playoff_brackets (schemat na przyszłość)
- `id` INT PK, `round_id` FK, `name`, `position_range_start`, `position_range_end`, `holes`

### playoff_matches (schemat na przyszłość)
- `id` INT PK, `bracket_id` FK, `stage` ENUM('R16','QF','SF','F'), `match_order`
- `player1_id`, `player2_id`, `winner_id`, `result_code`
- `is_sudden_death` BOOLEAN, `next_match_id` FK (self-ref)

---

## Kluczowa logika biznesowa

### Scoring (`lib/scoring.ts`)
1. Admin wpisuje wynik np. "3&2" + wskazuje zwycięzcę
2. System odczytuje `season.config.small_points_map["3&2"]` -> `[5, -5]`
3. Przypisuje big points: zwycięzca 3, przegrany 1 (z `season.config.scoring`)
4. Walkower: zwycięzca 3, przegrany 0, małe punkty = 0
5. Remis: obaj 2, małe punkty = 0
6. Punkty zapisywane bezpośrednio na rekordzie meczu (pre-computed)

### Standings (`lib/standings.ts`)
1. SUM big_points i small_points z meczów gracza w grupie
2. Sortowanie: big_points DESC
3. Tiebreakery (w kolejności):
   - Bezpośredni mecz (2 graczy)
   - "Mała tabelka" (3+ graczy - mecze tylko między sobą)
   - Suma małych punktów
   - HCP na start rundy (wyższy HCP = wyższa pozycja)
   - Flaga "wymaga ręcznego rozstrzygnięcia" -> admin ustawia final_position

### Group Generator (`lib/group-generator.ts`)
1. Po zakończeniu rundy N zbierz wyniki wszystkich grup
2. Pozycja 1 z każdej grupy -> Grupa A rundy N+1
3. Pozycja 2 -> Grupa B, itd.
4. Generuj pary meczowe round-robin w każdej grupie
5. Grupy tworzone ze statusem `draft` -> admin przegląda i zatwierdza

### MatchResultForm (UI, modal)
1. Pokaż: Gracz A vs Gracz B
2. Toggle "Walkower?" -> jeśli tak, wybierz zwycięzcę, zapisz
3. Radio: Zwycięzca A / Zwycięzca B / Remis
4. Jeśli zwycięzca: dropdown z wynikami (1Up, 2Up, 2&1, 3&1, 3&2, 4&2, 4&3, 5&3, 5&4)
5. Podgląd obliczonych punktów przed zapisem
6. "Zapisz" -> API -> przeliczenie tabeli na stronie

---

## Docker

### docker-compose.yml
```yaml
services:
  app:
    build: .
    ports: ["3000:3000"]
    env_file: .env
    depends_on:
      db: { condition: service_healthy }
    restart: unless-stopped

  db:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
      MYSQL_DATABASE: donpapa
      MYSQL_USER: donpapa
      MYSQL_PASSWORD: ${DB_PASSWORD}
    volumes:
      - mysql_data:/var/lib/mysql    # PERSISTENT VOLUME - przetrwa rebuild/restart
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  mysql_data:
    driver: local
```

### Dockerfile (multi-stage)
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma
EXPOSE 3000
CMD ["node", "server.js"]
```

---

## Branding

- Główny kolor: `#0a632f` (zielony Karolinki)
- Akcent: `#dd9933` (złoty)
- Tło: jasne, białe
- Responsywny: desktop + mobile
- Język: polski

---

## Harmonogram (5 dni)

### Dzień 1 (śr 18.03) - Fundament
- [x] Init Next.js + TypeScript + Tailwind
- [ ] Prisma schema + migracje MySQL
- [ ] Docker Compose (app + MySQL z persistent volume)
- [ ] NextAuth (credentials, admin login)
- [ ] Seed: 3 adminy, testowi gracze
- [ ] Layout: Navbar, kolory Karolinki, polskie stringi
- [ ] Strona logowania admina

### Dzień 2 (czw 19.03) - Admin CRUD + logika
- [ ] Admin: CRUD graczy (tabela + formularz)
- [ ] Admin: Tworzenie sezonu z config JSON
- [ ] Admin: Tworzenie rund, grup, przypisywanie graczy
- [ ] Auto-generowanie par meczowych (round-robin)
- [ ] `scoring.ts` - obliczanie punktów z wyniku meczu
- [ ] Admin: MatchResultForm (modal do wprowadzania wyników)
- [ ] API endpoints

### Dzień 3 (pt 20.03) - Tabele + strony publiczne
- [ ] `standings.ts` - obliczanie tabeli z tiebreakers
- [ ] Admin: strona grupy z tabelą live + wprowadzanie wyników
- [ ] Publiczne: /grupy
- [ ] Publiczne: /grupa/[id]
- [ ] Publiczne: /zawodnicy
- [ ] Responsive styling

### Dzień 4 (sob 21.03) - Profile graczy + generowanie grup
- [ ] Publiczne: /zawodnik/[slug] (nadchodzące mecze + historia)
- [ ] Admin: Generowanie grup kolejnej rundy (podgląd + zatwierdzenie)
- [ ] Admin: Zarządzanie adminami
- [ ] Edge cases: walkover, nierozegrane mecze
- [ ] Mobile responsive polish

### Dzień 5 (nd 22.03) - Testy + deploy
- [ ] Testy z realistycznymi danymi (48 graczy, 5 grup)
- [ ] Bugfixy
- [ ] Deploy na Scaleway VPS (Docker)
- [ ] SSL (Caddy reverse proxy + Let's Encrypt)
- [ ] Seed adminów na produkcji
- [ ] Końcowy polish UI

**Bufor:** Poniedziałek 23.03 = deadline.

---

## Kluczowe decyzje

1. **Season config jako JSON** - zasady punktacji per sezon, zmiana reguł = nowy wpis z innym config
2. **Pre-computed points** na rekordzie meczu - nie liczymy za każdym razem
3. **Next.js API Routes jako backend** - wystarczy dla 48 graczy
4. **Brak loginu gracza w MVP** - tabela users gotowa (password_hash nullable)
5. **Brak daty meczu** - tylko status played/unplayed
6. **DOCS/ nie trafia do buildu Docker** (.dockerignore)
7. **.ssh/ nie trafia do repo** (.gitignore)

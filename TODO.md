# Don Papa Match Play — Co zostało do zrobienia

**Ostatnia aktualizacja:** 21 kwietnia 2026 (statystyki historyczne 2023-2025)

---

## 🆕 2026-04-22 — Statystyki historyczne (aktualna iteracja)

**Aktualny commit:** `5cec66e` (skrypt `import-all.sh` do importu 3 sezonów jedną komendą)

**⚠️ STATUS NA PRODUKCJI (sprawdzone 2026-04-22 przez WebFetch):**
- Kod zdeployowany ✅ — profil zawodnika (np. `/zawodnik/jerzy-gorski`) pokazuje `<CareerOverview>` i `<SeasonHistoryTable>`
- Migracja schematu ✅ — `prisma db push` wykonany (`isHistorical`, `archivedAt`, `Decimal(4,1)` na BigPoints)
- **DANE HISTORYCZNE NIE ZAIMPORTOWANE** ❌ — `/poprzednie-sezony` pokazuje "Brak zakończonych sezonów"

**Pozostało 1 krok:** uruchomić `scripts/historical-data/import-all.sh` na serwerze (szczegóły niżej w sekcji "🚀 Co zrobić TERAZ").

### ✅ Co zostało zrobione w tej iteracji

- **Schema DB**: `Player.isHistorical`, `Player.archivedAt`, `Match.player[12]BigPoints` jako `Decimal(4,1)` (wsparcie 0.5 pkt remisu w historycznym systemie 1/0.5/0)
- **Nowe kody wynikowe**: `Ret` (retired mid-round), `3Up`/`4Up`/`5Up` (decisive win w 9-hole)
- **Warstwa statystyk**: `match-play-utils.ts`, `player-stats.ts`, `season-stats.ts` — pełne metryki pro match play
- **Komponenty UI**: `CareerOverview`, `SeasonHistoryTable`, `SeasonHighlightsPanel` — auto-ukrywają się bez danych
- **Integracja**: profile zawodników + strony archiwalnych sezonów + lista sezonów + Galeria Sław
- **Dane historyczne** w `scripts/historical-data/`:
  - Sezon 2023: 4 rundy RR (236 meczów) + playoff 3 ligi (1-8, 9-16, 17-24)
  - Sezon 2024: 5 rund RR (340 meczów) + playoff 2 ligi (1-16, 17-32)
  - Sezon 2025: 3 rundy RR (360 meczów) + playoff 2 ligi + final standings 1-45
  - **Razem ~1100 meczów** — wszystkie zwalidowane (tylko 3 rozbieżności w 2025 Gr 1 — prawdopodobnie błąd w oryginalnym docx)
- **Narzędzia**: `validate.ts` (walidator matryca vs ranking), `import-season.ts` (CLI z `--dry-run`, fuzzy matching imion)
- **Audit fix'y** (commit `c935a35`):
  - `MatchOutcome` rozróżnia walkoverWin/walkoverLoss/retiredLoss
  - `longestWinStreak` poprawnie traktuje walkoverLoss
  - Importer ma `DIMINUTIVES` map (Jurek↔Jerzy, Remik↔Remigiusz, Rysiu↔Ryszard, Julka↔Julia, Zbyszek↔Zbigniew, Mirek↔Mirosław, Bartek↔Bartłomiej)
  - Walidacja playoff winner (throw jeśli nie pasuje do player1/player2)
  - Timeout transakcji 120s → 300s
- **Playoff display fix** (commit `4cfb4da`):
  - `/poprzednie-sezony/[id]` — filtr `ROUND_ROBIN` usunięty; playoff rounds są fetchowane i wyświetlane w nowej sekcji "🏆 Playoff"
  - Każda liga playoff w osobnej karcie z mistrzem w headerze + lista meczów
  - Link "Zobacz pełną drabinkę" do `/playoff?sezon={id}`
  - Licznik rund w `/poprzednie-sezony` dodaje badge 🏆 dla sezonów z playoff
  - Fix `SeasonHighlightsPanel` champion detection: `bracketPosition === 1` (wcześniej brał pierwszy mecz z max `bracketRound`, co mogło być mecz o 3-4 zamiast finału)
- **Skrypt import-all.sh** (commit `5cec66e`):
  - Jedna komenda importuje wszystkie 3 sezony zamiast 6 oddzielnych wywołań

### 🚀 CO ZROBIĆ TERAZ — import danych historycznych (1 brakujący krok)

```bash
# ─── Na serwerze produkcyjnym ──────────────────────────────────
ssh -i .ssh/karolinkagolfpark root@209.38.211.80
cd /root/Golf_app && git pull

# Rebuild obrazu aplikacji (pobiera najnowsze zmiany w kodzie + nowe pliki JSON)
docker compose --env-file .env up -d --build app

# ─── IMPORT — jedna komenda, wszystkie 3 sezony ────────────────
# Preview bez zapisu:
docker compose --env-file .env run --rm app \
  bash scripts/historical-data/import-all.sh --dry-run

# Jeśli preview OK — prawdziwy import (5s pauza na Ctrl-C):
docker compose --env-file .env run --rm app \
  bash scripts/historical-data/import-all.sh
```

Po imporcie (kolejność: 2023 → 2024 → 2025):
- ~1100 meczów dodanych do bazy
- Sezony status=`COMPLETED`
- Historyczni zawodnicy utworzeni z `isHistorical=true, active=false`
- Istniejący zawodnicy (Górski, Szot, Łukasiuk...) dostają historię dołożoną do ich ID

**⚠️ Jeśli napotkasz błąd** (skopiuj output pełny i napisz):

| Błąd | Rozwiązanie |
|------|-------------|
| `tsx: not found` w kontenerze | `docker compose run --rm app sh -c "npm i -g tsx && bash scripts/..."` |
| `Cannot find module '@/lib/db'` | `docker compose run --rm app sh -c "cd /app && bash scripts/..."` |
| `Transaction already closed` (timeout) | Zwiększ `timeout: 300000 → 600000` w `import-season.ts:356` |
| Pliki JSON nie widoczne | Sprawdź `.dockerignore` — `scripts/` nie może być wykluczone |

### Weryfikacja po imporcie
1. `https://donpapagolf.pl/poprzednie-sezony` — 3 karty sezonów (2023, 2024, 2025) z mistrzem + top birdie + badge "4 + 🏆" (licznik rund + playoff)
2. `https://donpapagolf.pl/poprzednie-sezony/[id]` — panel mistrzów + top scorers + biggest upset **+ nowa sekcja "🏆 Playoff"** z drabinkami każdej ligi (po commicie `4cfb4da`)
3. `https://donpapagolf.pl/zawodnik/[slug]` — statystyki kariery + tabela sezonów (test na **Jerzy Górski** — powinien mieć **4 sezony** i **1 mistrzostwo** z 2023)
4. `https://donpapagolf.pl/playoff?sezon={id}` — pełna drabinka sezonu archiwalnego (jeśli `<PlayoffBracket>` nie wymaga pełnych danych R1-R4, może pokazać tylko częściowe)
5. Ręczny cross-check: porównaj karierę Jerzy Górski vs oryginalne obrazy z docx

**KROK 5 (opcjonalnie) — Hall of Fame:**
Dodaj ręcznie w `/admin/galeria-slaw` wpisy dla mistrzów historycznych:

| Rok | Zawodnik | Liga | Opis |
|-----|----------|------|------|
| 2023 | Jerzy Górski | Pierwsza Liga Playoff | Mistrz sezonu 2023 (finał 3&2 vs Zieliński) |
| 2023 | Tomasz Śleziak | Druga Liga Playoff | Mistrz Drugiej Ligi 2023 |
| 2023 | Maciej Skucik | Trzecia Liga Playoff | Mistrz Trzeciej Ligi 2023 |
| 2024 | Sebastian Szot | Pierwsza Liga Playoff | Mistrz sezonu 2024 (finał 5&4 vs Zieliński) |
| 2024 | Wojciech Szwedowski | Druga Liga Playoff | Mistrz Drugiej Ligi 2024 |
| 2025 | Krzysztof Łukasiuk | Pierwsza Liga Playoff | Mistrz sezonu 2025 (finał 3&2 vs Szic) |
| 2025 | Wojciech Stelmach | Druga Liga Playoff | Mistrz Drugiej Ligi 2025 |

### 🚨 Uwagi ostrzegawcze

1. **`prisma db push`** modyfikuje typ `Int → Decimal(4,1)` — istniejące wartości (3/2/1/0) zostaną zachowane jako `3.0/2.0/1.0/0.0`.
2. **Nowi zawodnicy historyczni** są tworzeni z `isHistorical=true, active=false` — nie pokażą się w liście aktywnych graczy.
3. **Dla zawodników już w bazie** (Jerzy Górski, Sebastian Szot...) ich ID są reuseowane — dostają historię sezonów 2023-2025 dołożoną do obecnej.
4. **Importer NIE ma idempotencji** — wielokrotne uruchomienie tworzy duplikaty Season. Jeśli trzeba ponownie, najpierw usuń Season w adminie lub SQL.

### 📝 Issues wynikające z oryginalnego docx (do ręcznej weryfikacji)

- **2025 Kwiecień/maj Gr 1**: 3 rozbieżności matryca vs ranking (Kuliś +1, Warnecki +1, Glinka -2; suma=0). Prawdopodobnie błąd w oryginalnym dokumencie. Do weryfikacji w `image73.png`.
- **2023 Playoff Pierwsza Liga 3-4**: ranking mówi Łukasiuk #3, bracket mówi Klyk wygrał 2up. Zapisane zgodnie z rankingiem (oficjalne miejsce).

### 🔮 Przyszłe rozszerzenia (nice-to-have)

- [ ] **Admin UI do importu JSON** — drag-drop + preview zamiast CLI
- [ ] **Auto-generowanie Hall of Fame** przy oznaczeniu sezonu `COMPLETED`
- [ ] **Pełne drabinki playoff** — aktualnie tylko finały + semifinały; dodać ćwierćfinały i placement games
- [ ] **Sezon 2022** (4 obrazy w docx) — uproszczony zapis, opcjonalny 4. historyczny sezon
- [ ] **Normalizacja imion w JSON-ach** — zastąpić Julka→Julia itd. w plikach (importer już to robi runtime)
- [ ] **Rozszerzenie fuzzy matching** — np. "Wiśniewski" vs "Wisniewski" (bez polskich znaków)

**Dokumentacja techniczna w:** `DOCS/historia-stats-progress.md`

---

## 📋 Checklist przed deploy

### 1. Git push
```bash
cd /tmp/Golf_app
git push origin main
```

### 2. Build i upload na serwer
```bash
# Build lokalnie (serwer nie ma RAM na build)
docker build --platform linux/amd64 -t donpapa-app:latest .
docker save donpapa-app:latest | gzip > /tmp/donpapa-app.tar.gz

# Build migrate image (schemat się zmienił — bracketRound, bracketPosition)
docker build --platform linux/amd64 --target builder -t donpapa-migrate:latest .
docker save donpapa-migrate:latest | gzip > /tmp/donpapa-migrate.tar.gz

# Upload
scp -i .ssh/karolinkagolfpark /tmp/donpapa-app.tar.gz root@209.38.211.80:/tmp/
scp -i .ssh/karolinkagolfpark /tmp/donpapa-migrate.tar.gz root@209.38.211.80:/tmp/
```

### 3. Na serwerze — aktualizacja
```bash
ssh -i .ssh/karolinkagolfpark root@209.38.211.80

# Załaduj obrazy
gunzip -c /tmp/donpapa-app.tar.gz | docker load && rm /tmp/donpapa-app.tar.gz
gunzip -c /tmp/donpapa-migrate.tar.gz | docker load && rm /tmp/donpapa-migrate.tar.gz

# Pull konfiguracji (docker-compose.yml, Caddyfile, itp.)
cd /root/Golf_app && git pull

# Restart aplikacji
docker compose --env-file .env up -d app caddy

# Migracja bazy (dodaje bracketRound, bracketPosition do matches)
docker compose --env-file .env run --rm migrate
```

### 4. Dodaj zmienne do .env na serwerze
```bash
# Dopisz do /root/Golf_app/.env:
WORDPRESS_API_URL=https://wp.donpapagolf.pl/wp-json/wp/v2

# WAŻNE: Dodaj ?charset=utf8mb4 do DATABASE_URL (polskie znaki!)
# Zmień:
#   DATABASE_URL="mysql://donpapa:haslo@db:3306/donpapa"
# Na:
#   DATABASE_URL="mysql://donpapa:haslo@db:3306/donpapa?charset=utf8mb4"
```

### 5. Weryfikacja po deploy
- [ ] https://donpapagolf.pl/grupy — tabele grup + przełącznik rund
- [ ] https://donpapagolf.pl/playoff — "Play-off nie został jeszcze utworzony" (dopóki admin nie utworzy)
- [ ] https://donpapagolf.pl/zawodnicy — lista graczy
- [ ] https://donpapagolf.pl/aktualnosci — "Brak aktualności" (dopóki WordPress nie ruszy)
- [ ] https://donpapagolf.pl/admin — panel admina
- [ ] PWA: otwórz na telefonie → "Dodaj do ekranu głównego"

---

## 🌐 DNS — wp.donpapagolf.pl

### Co zrobić
Dodaj rekord DNS u dostawcy domeny donpapagolf.pl:

| Typ | Nazwa | Wartość | TTL |
|-----|-------|---------|-----|
| A | wp | 209.38.211.80 | 300 |

### Jak sprawdzić
```bash
# Po dodaniu rekordu (odczekaj 5-15 min na propagację):
dig wp.donpapagolf.pl +short
# Powinno zwrócić: 209.38.211.80
```

### Dlaczego
Subdomena `wp.donpapagolf.pl` jest potrzebna do hostowania WordPressa (aktualności). Caddy automatycznie pobierze certyfikat SSL od Let's Encrypt.

---

## 🐳 WordPress — uruchomienie na serwerze

### Krok 1: Utwórz bazę danych WordPress
```bash
ssh -i .ssh/karolinkagolfpark root@209.38.211.80

# Utwórz bazę (init script mógł nie zadziałać na istniejącej instancji MySQL)
docker compose --env-file .env exec db mysql -u root -p${DB_ROOT_PASSWORD} \
  -e "CREATE DATABASE IF NOT EXISTS wordpress; GRANT ALL ON wordpress.* TO 'donpapa'@'%'; FLUSH PRIVILEGES;"
```

### Krok 2: Uruchom kontener WordPress
```bash
docker compose --env-file .env up -d wordpress
docker compose logs -f wordpress
# Czekaj na: "Apache/2.4.xx (Debian) ... configured"
# Ctrl+C
```

### Krok 3: Restart Caddy (żeby pobrał cert dla wp.donpapagolf.pl)
```bash
docker compose --env-file .env restart caddy
```

### Krok 4: Instalacja WordPress
1. Otwórz **https://wp.donpapagolf.pl** w przeglądarce
2. Język: **Polski**
3. Formularz:
   - Tytuł witryny: **Don Papa Match Play**
   - Nazwa użytkownika: **admin** (lub własna)
   - Hasło: **silne hasło** (zapisz gdzieś bezpiecznie!)
   - Email: adres admina
4. Kliknij "Zainstaluj WordPress"

### Krok 5: Konfiguracja WordPress
Po zalogowaniu do wp-admin:

1. **Ustawienia → Bezpośrednie odnośniki** → wybierz "Nazwa wpisu" (`/%postname%/`) → Zapisz
2. **Wygląd → Menu** — nie potrzebne (headless, bez frontu WP)
3. Opcjonalnie: zainstaluj plugin **Classic Editor** jeśli nowy edytor nie odpowiada

### Krok 6: Testowy post
1. **Wpisy → Dodaj nowy**
2. Tytuł: "Witamy w sezonie 2026!"
3. Treść: dowolny tekst, możesz dodać zdjęcie
4. Kliknij "Opublikuj"
5. Sprawdź: **https://donpapagolf.pl/aktualnosci** — post powinien się pojawić w ciągu 5 minut (ISR cache)

### Krok 7: Wyłączenie frontendu WP (opcjonalnie)
Żeby `wp.donpapagolf.pl` nie pokazywał publicznego motywu WP, dodaj redirect do `functions.php`:
```php
// W wp-admin → Wygląd → Edytor motywu → functions.php:
add_action('template_redirect', function() {
    if (!is_admin() && !wp_doing_ajax() && !defined('REST_REQUEST')) {
        wp_redirect('https://donpapagolf.pl/aktualnosci');
        exit;
    }
});
```

---

## 🧹 Reset symulacji (po testach, przed sezonem)

### Kontekst
Podczas developmentu uruchomiono symulację pełnego sezonu (695 meczów, 4 rundy + play-off). Przed startem prawdziwego sezonu trzeba wyczyścić symulowane dane i wrócić do stanu: 1 runda wstępna z 50 graczami, 0 rozegranych meczów.

### Opcja A: Pełny reset (seed z CSV)
**UWAGA: Kasuje WSZYSTKIE dane — graczy, mecze, sezony, avatary!**
```bash
# Na serwerze:
docker compose --env-file .env run --rm seed
```
To uruchomi `prisma db push --force-reset && tsx prisma/seed.ts` — odtworzy schemat i załaduje graczy z CSV.

### Opcja B: Chirurgiczny reset (zachowaj graczy + avatary)
```bash
# Na serwerze — wejdź do MySQL:
docker compose --env-file .env exec db mysql -u donpapa -p${DB_PASSWORD} donpapa

-- Usuń play-off i rundy 2-4 (zachowaj rundę 1)
DELETE FROM matches WHERE group_id IN (SELECT id FROM `groups` WHERE round_id > 1);
DELETE FROM group_players WHERE group_id IN (SELECT id FROM `groups` WHERE round_id > 1);
DELETE FROM `groups` WHERE round_id > 1;
DELETE FROM rounds WHERE id > 1;

-- Reset wyników w rundzie 1 (zachowaj mecze, wyzeruj wyniki)
UPDATE matches SET
  result_code = NULL,
  winner_id = NULL,
  player1_big_points = 0,
  player2_big_points = 0,
  player1_small_points = 0,
  player2_small_points = 0,
  played = 0,
  is_walkover = 0,
  notes = NULL,
  bracket_round = NULL,
  bracket_position = NULL
WHERE 1=1;

-- Przywróć rundę 1 jako ACTIVE
UPDATE rounds SET status = 'ACTIVE' WHERE id = 1;
```

### Opcja C: Tylko reset play-off (zachowaj wyniki grupowe)
```bash
docker compose --env-file .env exec db mysql -u donpapa -p${DB_PASSWORD} donpapa

-- Usuń play-off
DELETE FROM matches WHERE bracket_round IS NOT NULL;
DELETE FROM group_players WHERE group_id IN (SELECT id FROM `groups` WHERE round_id IN (SELECT id FROM rounds WHERE type = 'PLAYOFF'));
DELETE FROM `groups` WHERE round_id IN (SELECT id FROM rounds WHERE type = 'PLAYOFF');
DELETE FROM rounds WHERE type = 'PLAYOFF';
```

---

## 🔄 Symulacja jako narzędzie admina

### Cel
Admin może uruchomić symulację żeby przetestować poprawność tworzenia rund, regroupingu i play-off przed sezonem lub na kolejne sezony.

### Jak to działa
Skrypt `/tmp/Golf_app/scripts/simulate-full-season.ts` symuluje:
1. Losowe wyniki wszystkich meczów w aktywnej rundzie
2. Generowanie grup kolejnych rund (regrouping)
3. Tworzenie play-off z auto-seedingiem
4. Symulację meczów play-off aż do finałów

### Uruchomienie (lokalnie)
```bash
cd /tmp/Golf_app
npx tsx scripts/simulate-full-season.ts
```

### Uruchomienie przez panel admina ✅
Admin panel → **Symulacja** (`/admin/symulacja`):
- "Symuluj bieżącą rundę" — wypełnia losowe wyniki aktywnej rundy
- "Symuluj do play-off" — generuje rundy + wyniki aż do play-off
- "Symuluj cały sezon" — j.w. + play-off z finałami
- "Reset symulacji" — przywraca stan sprzed symulacji (z potwierdzeniem)

### Uruchomienie przez API
```bash
# Symuluj bieżącą rundę:
curl -X POST -H "Content-Type: application/json" -d '{"action":"current-round"}' http://localhost:3000/api/admin/simulate

# Pełna symulacja:
curl -X POST -H "Content-Type: application/json" -d '{"action":"full-season"}' http://localhost:3000/api/admin/simulate

# Reset:
curl -X POST -H "Content-Type: application/json" -d '{"action":"reset-simulation"}' http://localhost:3000/api/admin/simulate
```

**Status:** ✅ Zaimplementowane — CLI skrypt + API route + UI w panelu admina.

---

## 📋 Backlog — co jeszcze nie wdrożone

### Gotowe do użycia (po deploy)
| Feature | Status | Uwagi |
|---------|--------|-------|
| Play-off brackets | ✅ Kod gotowy | Admin tworzy w `/admin/playoff` gdy faza grupowa zakończona |
| Avatar volume | ✅ Kod gotowy | Działa automatycznie po deploy |
| Archiwum sezonów | ✅ Kod gotowy | Dropdown na `/grupy` i `/playoff` |
| Email reminders | ✅ Kod gotowy | Przycisk "Wyślij przypomnienia" w admin dashboard |
| Hasło gracza | ✅ Kod gotowy | Gracz ustawia hasło w profilu, loguje się emailem+hasłem |
| Scoring config editor | ✅ Kod gotowy | Admin → Sezon → "Edytuj punktację" |
| PWA | ✅ Kod gotowy | Instalowalne na telefonie, offline cache |
| WordPress aktualności | ✅ Kod gotowy | Wymaga uruchomienia WordPress (patrz instrukcja wyżej) |

### Zrobione w tej iteracji
| Feature | Status | Uwagi |
|---------|--------|-------|
| Connector lines w drabince | ✅ Done | CSS linie łączące mecze między rundami |
| Symulacja w UI admina | ✅ Done | `/admin/symulacja` — 4 akcje + reset |
| Automatyczne wysyłanie emaili | ✅ Done | Cron endpoint `GET /api/cron/reminders` (patrz `docker/cron-setup.md`) |
| SEO metadata | ✅ Done | `generateMetadata` na /playoff, /aktualnosci, /aktualnosci/[slug] |
| 18-hole kod 6&3 | ✅ Done | Dodany do RESULT_CODES_18 |
| Per-match holes (17-32) | ✅ Done | Pole `holes` na Match, wyświetlane w BracketMatchCard |

### Do zrobienia w przyszłości
| Feature | Priorytet | Opis |
|---------|-----------|------|
| **Liga damska** | Niski | Osobna liga/sezon, ten sam system |
| **Integracja WhatsApp** | Niski | Powiadomienia/wyniki na grupie WA (WhatsApp Business API) |
| **Push notifications (PWA)** | Niski | Web push zamiast email — wymaga service worker + VAPID keys |

---

## 📊 Zmiany w schemacie bazy (od ostatniego deploy)

### Nowe pola na `Match`
```sql
ALTER TABLE matches ADD COLUMN bracket_round INT NULL;
ALTER TABLE matches ADD COLUMN bracket_position INT NULL;
ALTER TABLE matches ADD COLUMN holes INT NULL;
CREATE INDEX idx_matches_bracket ON matches(group_id, bracket_round, bracket_position);
```

Te zmiany zostaną zastosowane automatycznie przez `prisma db push` (komenda `migrate` w docker compose).

**WAŻNE:** To są nullable kolumny — istniejące dane nie zostaną naruszone. Bez ryzyka.

---

## 📁 Nowe pliki (od ostatniego deploy)

### Nowe strony
- `/playoff` — publiczna wizualizacja drabinek play-off
- `/aktualnosci` — lista aktualności z WordPress
- `/aktualnosci/[slug]` — pojedyncza aktualność
- `/admin/playoff` — zarządzanie play-off
- `/admin/sezon/[id]/config` — edycja punktacji
- `/admin/symulacja` — symulacja sezonu (testowanie)

### Nowe API routes
- `POST /api/admin/playoff/create` — tworzenie play-off
- `GET /api/admin/playoff/ranking` — podgląd rankingu
- `POST /api/admin/reminders` — wysyłanie przypomnień email (ręczne)
- `GET /api/cron/reminders` — automatyczne przypomnienia (cron, auth: Bearer token)
- `POST /api/admin/simulate` — symulacja sezonu (4 akcje)
- `POST /api/auth/player/login` — logowanie hasłem
- `POST /api/player/password` — ustawianie hasła
- `GET/PUT /api/seasons/[id]/config` — konfiguracja punktacji

### Nowe komponenty
- `PlayoffBracket.tsx` — wizualizacja drabinki z tabami + connector lines
- `BracketMatchCard.tsx` — karta meczu w drabince (z per-match holes)
- `SeasonSelector.tsx` — dropdown wyboru sezonu
- `SendRemindersButton.tsx` — przycisk wysyłania przypomnień
- `ServiceWorkerRegistration.tsx` — rejestracja SW dla PWA

### Nowe biblioteki
- `src/lib/playoff.ts` — logika play-off (seeding, bracket builder, auto-advance)
- `src/lib/wordpress.ts` — pobieranie newsów z WordPress REST API

### Nowe pliki infrastruktury
- `public/manifest.json` — PWA manifest
- `public/sw.js` — service worker
- `public/icons/icon-192.svg`, `icon-512.svg` — ikony PWA
- `docker/init-wordpress-db.sql` — init script bazy WordPress
- `docker/cron-setup.md` — instrukcja konfiguracji crona
- `scripts/simulate-full-season.ts` — skrypt symulacji sezonu (CLI)

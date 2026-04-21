# Historyczne statystyki — dziennik implementacji

**Plan:** `/Users/k2_tomek/.claude/plans/cozy-watching-rabbit.md`
**Repo:** https://github.com/tkalla79/Golf_app.git (branch `main`)
**Start:** 2026-04-21
**Źródło danych:** `/Users/k2_tomek/Downloads/historia don papa.docx` — 103 screenshoty tabel match play (sezony 2023, 2024, 2025).

---

## To-do (kolejność wg planu)

| Etap | Zadanie | Status |
|------|---------|--------|
| 2 | schema.prisma — `Player.isHistorical`, `archivedAt` | ✅ zrobione |
| 2 | scoring.ts — kod `Ret` w `RESULT_CODES` + `small_points_map` | ✅ zrobione |
| 4a | `src/lib/match-play-utils.ts` — parser margin, helpers | ✅ zrobione |
| 4b | `src/lib/player-stats.ts` — getCareerStats, getSeasonHistory | ✅ zrobione |
| 4c | `src/lib/season-stats.ts` — getSeasonHighlights | ✅ zrobione |
| 4d | `npm run build` — weryfikacja kompilacji TS | ✅ czyste |
| 5.1 | `<CareerOverview>` + `<SeasonHistoryTable>` na profilu zawodnika | ✅ zrobione |
| 5.1b | `pl.ts` — `career.*` etykiety (40+ stringów) | ✅ zrobione |
| 5.1c | `zawodnik/[slug]/page.tsx` — integracja komponentów | ✅ zrobione |
| 5.1d | `npm run build` po integracji | ✅ czyste |
| 5.2 | `<SeasonHighlightsPanel>` + integracja na `/poprzednie-sezony/[id]` | ✅ zrobione |
| 5.3 | Teaser highlights (champion + top birdie) na kartach listy sezonów | ✅ zrobione |
| 5.4 | Galeria Sław — filtr po roku, grupowanie, linki do profili | ✅ zrobione |
| 5.5 | `npm run build` po 5.2/5.3/5.4 | ✅ czyste |
| 6 | Migracja schema: `Match.player[12]BigPoints` Int → Decimal(4,1) | ✅ zrobione |
| 6b | Kody `3Up`, `4Up`, `5Up` w RESULT_CODES (dla 9-hole decisive wins) | ✅ zrobione |
| 1a | Transkrypcja 2025 Kwiecień/maj (5 grup × 9 graczy = 180 meczów) | ✅ zrobione (3 rozbieżności — ranking vs matrix) |
| 1b | Transkrypcja 2025 Czerwiec (9 grup × 5 = 90 meczów) | ✅ walidacja 0 błędów |
| 1c | Transkrypcja 2025 Lipiec (9 grup × 5 = 90 meczów) | ✅ walidacja 0 błędów |
| 1d | Transkrypcja 2025 Playoff (finale + standings 1-45) | ✅ minimum (finale + pozycje, szczegóły bracket do kolejnej sesji) |
| 3a | `scripts/historical-data/import-season.ts` (CLI importer) | ✅ zrobione |
| 3a-val | `scripts/historical-data/validate.ts` (walidator) | ✅ zrobione |
| 3b | Admin UI do importu (web form) | ⏸ kolejna sesja |
| 1e | Sezon 2024 (kwiecień-sierpień + playoff, ~64 obrazy) | ⏸ kolejna sesja |
| 1f | Sezon 2023 (kwiecień-lipiec/sierpień + playoff, ~29 obrazów) | ⏸ kolejna sesja |
| 5.2 | `<SeasonHighlightsPanel>` na stronie sezonu archiwalnego | ⏸ |
| 1 | OCR 103 obrazów → `scripts/historical-data/seasons.json` | ⏸ |
| 3 | `/api/admin/seasons/historical-import` + admin UI | ⏸ |
| 5.3 | Teaser highlights na `/poprzednie-sezony` | ⏸ |
| 5.4 | Filtry + auto-entries dla Galerii Sław | ⏸ |
| 6 | Weryfikacja end-to-end (build, cross-check, edge cases) | ⏸ |

---

## Wykonane zmiany

### 2026-04-21 — Etap 2 (model + kod wyniku)

**`prisma/schema.prisma`** (linie 33-34 — model Player):
```prisma
isHistorical    Boolean   @default(false) @map("is_historical")
archivedAt      DateTime? @map("archived_at")
```
- `isHistorical=true` + `active=false` → zawodnik pokazywany tylko w archiwum, nie w aktywnym sezonie.
- `archivedAt` dokumentuje kiedy zawodnik został zarchiwizowany.

**`src/lib/scoring.ts`:**
- Dodano kod `'Ret'` do `RESULT_CODES` (index 10, po '5&4').
- Dodano `'Ret': [0, 0]` w `small_points_map` — poddający liczony jako przegrany na big points, brak small points (margin nieznany).
- Obsługa w `computePoints`: `input.winnerId` wymagany; zwycięzca dostaje `scoring.win` jak przy normalnym meczu.

**Post-deploy:** `npx prisma db push` (doda kolumny `is_historical`, `archived_at` do tabeli `players`).

### 2026-04-21 — Etap 4 (warstwa statystyk)

**`src/lib/match-play-utils.ts`** (nowy plik, 149 linii):
- `parseMargin(code)` — zwraca liczbę dołków przewagi (0 dla A/S, null dla Ret/WO)
- `isHalved`, `isRetired`, `isCloseResult`, `isDecisiveWin` — predykaty
- `matchOutcome(match, playerId)` → `'win' | 'loss' | 'halved' | 'walkover' | 'retired' | 'notPlayed'`
- `signedMargin(match, playerId)` — signed margin z perspektywy gracza
- `longestWinStreak(outcomes[])` — najdłuższa passa zwycięstw
- `formatResultCodePl(code)` — human-readable etykieta PL

**`src/lib/player-stats.ts`** (nowy plik, 422 linie):
- `getCareerStats(playerId)` — pełen zestaw: totalSeasons, wins/losses/halved, winPercentage, bigPoints, smallPoints, birdies, avgMarginOfVictory, biggestWin, longestWinStreak, closeMatches, upsets, playoffAppearances, championships, finalsAppearances, semifinalAppearances, bestFinish, headToHead top 3
- `getSeasonHistory(playerId)` — tabela sezon-po-sezonie z pozycją RR i wynikiem playoff

**`src/lib/season-stats.ts`** (nowy plik, 284 linie):
- `getSeasonHighlights(seasonId)` — champions per bracket, top birdie scorers (top 3), top win rate (top 3), biggest upset (HCP-based), longest match, avgHcp, halvedRate, walkoverRate

**Weryfikacja:** `npm run build` — przeszedł pomyślnie, wszystkie routes skompilowane.

### 2026-04-21 — Etap 5.1/5.2/5.3/5.4 (UI)

**`src/components/CareerOverview.tsx`** (nowy, 190 linii):
- Karta headline ze kafelkami (sezony, mistrzostwa, finały, W-L-A/S, skuteczność, birdies)
- Akordeon "Więcej statystyk": avg margin, biggest win, halved rate, close matches, upsets, walkowery, retired, playoff appearances, big/small pts
- Sekcja head-to-head top 3 rywali (każdy linkuje do profilu)
- Auto-ukrywa się gdy player nie ma rozegranych meczów

**`src/components/SeasonHistoryTable.tsx`** (nowy, 92 linie):
- Tabela sezon-po-sezonie: Sezon (link) | Poz. | Meczów | W-L-A/S | Pkt | Playoff
- Wynik playoff: Mistrz / Finalista / Półfinał / Ćwierćfinał / 1/8
- Badge kolorystyczny dla mistrza (złoty) i finalisty (zielony)

**`src/components/SeasonHighlightsPanel.tsx`** (nowy, 220 linii) — na stronie archiwalnego sezonu:
- Pasek "Mistrzowie sezonu" z gradient cards per liga (L1 złoty, L2 zielony, L3 niebieski)
- Top birdie scorers (top 3) + Top win rate (top 3, min 3 mecze)
- Biggest upset callout (różnica HCP, wynik, runda/grupa)
- Core season metrics: liczba zawodników, rozegranych, avg HCP, % A/S
- Footer: najbardziej zdecydowana wygrana

**`src/app/(public)/poprzednie-sezony/page.tsx`** — teaser highlights:
- `getSeasonHighlights()` dla każdego sezonu w Promise.all
- Karta sezonu zawiera mini-sekcję: mistrz L1 🏆 + top birdie 🎯

**`src/app/(public)/galeria-slaw/page.tsx`** — przepisana:
- Filtr po roku (query param `?year=2024`)
- Grupowanie wpisów per rok z separatorem
- Nazwisko zawodnika linkuje do `/zawodnik/[slug]` gdy `playerId` jest ustawione

**`src/constants/pl.ts`** — 50+ nowych etykiet w `career.*`, `seasonHighlights.*`, `previousSeasons.*`, `hallOfFame.*`.

**Weryfikacja:** 3 builds przeszły czysto (po każdej większej integracji).

### 2026-04-21 — Etap 6 + 1abcd (migracja schema + transkrypcja sezonu 2025)

**Migracja schema:**
- `Match.player1BigPoints` i `player2BigPoints`: `Int` → `Decimal(4,1)` — historyczne sezony używają 1/0.5/0 (remis = 0.5 pkt).
- Adaptacja 3 plików: `standings.ts` (2 miejsca), `player-stats.ts` (2 miejsca), `zawodnik/[slug]/page.tsx` — wszystkie użycia `big_points` zostały opakowane w `Number()`.

**Nowe kody wynikowe w `scoring.ts`:**
- `3Up`, `4Up`, `5Up` — decisive win w 9-hole match play gdzie gracze zagrali całe 9 dołków z przewagą 3-5.

**Transkrypcja sezonu 2025** (4 pliki JSON w `scripts/historical-data/`):
- `2025-kwiecien-maj.json` — 5 grup × 9 graczy, 180 meczów, 3 rozbieżności ranking vs matrix (Gr 1: Kuliś +1, Warnecki +1, Glinka -2; suma zero — prawdopodobnie błąd w oryginale).
- `2025-czerwiec.json` — 9 grup × 5 graczy, 90 meczów, **0 rozbieżności**.
- `2025-lipiec.json` — 9 grup × 5 graczy, 90 meczów, **0 rozbieżności**.
- `2025-playoff.json` — finale każdej ligi + final ranking 1-45. Szczegóły bracket (1/8, ćwierć, pół, placement) odłożone do kolejnej sesji.

**Skrypty pomocnicze:**
- `scripts/historical-data/validate.ts` — walidator: porównuje sumę big pts z matrycy z `officialPoints` z rankingu. Wypisuje rozbieżności.
- `scripts/historical-data/import-season.ts` — CLI importer: tworzy Season/Rounds/Groups/GroupPlayers/Matches w pojedynczej transakcji Prisma. Wspiera `--dry-run`. Automatycznie tworzy brakujących zawodników z `isHistorical=true, active=false`.

**Kody w systemie historycznym obsłużone:**
- `A/S` — remis (draw, 0.5 pts każdy)
- `1Up-5Up`, `X&Y` — normalne wyniki match play
- `Ret` — opponent retired during round (wygrany dostaje 1 pt)
- `WO` — walkower (isWalkover=true, wygrany dostaje 1 pt)
- `NP` / `NZ` — nie rozegrany mecz (played=false, 0 pts obu stronom)

**Uruchomienie importu (po `prisma db push`):**
```bash
npx tsx scripts/historical-data/import-season.ts --dry-run \
  scripts/historical-data/2025-kwiecien-maj.json \
  scripts/historical-data/2025-czerwiec.json \
  scripts/historical-data/2025-lipiec.json \
  scripts/historical-data/2025-playoff.json
```
Po sprawdzeniu dry-run — uruchom bez `--dry-run` by zaimportować.

---

## Decyzje techniczne

- **Claude Vision OCR** zostanie użyte do wyekstrahowania danych z obrazów. Pipeline: obraz → prompt → JSON per grupa.
- **Weryfikacja danych**: dwustopniowa — OCR + admin preview z porównaniem do oryginalnego obrazu.
- **`Ret` jako pełny kod wynikowy** (nie walkover) — semantyka "poddał się w trakcie gry" ≠ "nie pojawił się".
- **`NA` w matrycach** (np. grupa G 2024) — mapowane na `played: false`, wykluczone ze stats.
- **Caching statystyk**: `unstable_cache` z tagami `player-stats-{id}` i `season-stats-{id}`.

---

## Otwarte pytania

1. **Sezon 2022 vs 2023** — image1.png ma nagłówek "Zespół B 2022". Wymaga weryfikacji: dodatkowy sezon 2022 czy pomyłka w dokumencie?
2. **Playoff 2024** — ~35 graczy, drabinki 1-16 + 17-32 pokrywają 32. Co z 3 pozostałymi? Wymaga sprawdzenia w obrazach playoff 2024.
3. **Nazwiska podwójne** — w obecnej bazie niektórzy gracze mogą mieć inne warianty (Krzysztof Łukasiuk vs K. Łukasiuk). Mapping po slug + fallback na firstName+lastName.

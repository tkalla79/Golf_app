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

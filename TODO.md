# Don Papa Match Play — Co zostało do zrobienia

**Ostatnia aktualizacja:** 19 sierpnia 2026 (poprawki po code review seedingu playoff)

---

## 🆕 2026-08-18 — Seeding playoff 2026 + naprawa `computeGlobalRanking`

**Kontekst:** Faza zasadnicza to Runda 4 (10 grup × 5 = 50 zawodników). Do 3 drabinek playoff wchodzi 48. Deadline R1: **06.09.2026** (Regulamin §IV.2).

### ✅ Naprawiony `computeGlobalRanking` — panel admina działa poprawnie

Funkcja sortowała przez duże punkty → małe punkty → HCP, co dawało ranking niezgodny z zatwierdzonym przez Zarząd (Warnecki wychodził #1 zamiast #39, bo wygrał Grupę 9 z najlepszym bilansem w lidze). Przycisk „Utwórz playoff" tworzył złe pary.

Prawidłowa reguła to **projekcja systemu awansów i spadków o rundę w przód**: awansujący z grupy niżej → spadkowicze z grupy wyżej → ten kto został. Zaimplementowana jako czysta funkcja `buildPlayoffSeedOrder` — generalizuje się na dowolną liczbę grup, nie ma hardkodowanej tabeli.

- `buildPlayoffSeedOrder` + przepisane `computeGlobalRanking` → [src/lib/playoff.ts](src/lib/playoff.ts)
- Kontrakt: [src/__tests__/playoff-seeding.test.ts](src/__tests__/playoff-seeding.test.ts) — 13 testów asertujących wszystkie 48 seedów i 24 pary R1
- **Testy: 52/52 zielone** (12 standings + 27 player-stats + 13 playoff-seeding), `tsc --noEmit` czysty
- Pełny opis reguły z tabelą: [DOCS/playoff-2026-seeding.md](DOCS/playoff-2026-seeding.md)

Panel `/admin/playoff` i skrypt CLI używają teraz **tej samej funkcji** — identyczne pary. Skrypt dodatkowo cross-checkuje ranking względem zatwierdzonej macierzy i przerywa przy jakiejkolwiek rozbieżności.

### ✅ 3 zaległe mecze — rozstrzygnięte jako nierozegrane

Trzy mecze Rundy 4 nie zostały rozegrane w terminie (minął 16.08.2026):

| Grupa | Mecz |
|---|---|
| 5 | Roman Staś 🆚 Wojciech Stefanik |
| 10 | Marek Turski 🆚 Grzegorz Czudaj |
| 10 | Grzegorz Czudaj 🆚 Maciej Plewka |

**Decyzja Zarządu (18.08.2026): spisane jako nierozegrane** — Regulamin §III.2, *„0 pkt dla obu graczy"*.

Nie wymaga zmian w bazie: `computeStandings` pomija mecze bez wyniku (`if (!match.played) continue`), więc tabele są już poprawne. Rozstawienie odpowiada tabelom na `/grupy`. Skład 48 zawodników był i tak matematycznie zamknięty (Czudaj miał minimum 8 pkt, Stelmach zablokowany na 6, Plewka maksimum 6) — poza playoff zostają **Marcin Stelmach** i **Maciej Plewka**.

**Wymagany krok przed utworzeniem playoff: Runda 4 → COMPLETED** w `/admin/sezon/[id]`. Formalnie zamyka fazę grupową i blokuje wpisywanie wyników (API 403). Bez tego ktoś mógłby wpisać wynik zaległego meczu po utworzeniu drabinek i rozjechać rozstawienie.

Wymuszają to obie ścieżki: skrypt CLI odmawia zapisu, panel (`POST /api/admin/playoff/create`) zwraca HTTP 400 z listą zaległych meczów (dołożone 19.08.2026 po code review).

### 🚀 Kolejność wdrożenia

Przekazane do osoby z dostępem do produkcji — instrukcja: [DOCS/playoff-2026-wdrozenie.md](DOCS/playoff-2026-wdrozenie.md)

1. Deploy aktualnego `main` (procedura w [DEPLOY.md](DEPLOY.md), migracja NIE potrzebna). **Wgraj oba obrazy** — `donpapa-app` i `donpapa-migrate` — bo skrypt CLI chodzi w tym drugim
2. Weryfikacja na `/admin/playoff`: seed 1 = Kacper Glinka, seed 39 = Robert Warnecki (rozróżnia starą i nową logikę)
3. Runda 4 → COMPLETED w `/admin/sezon/[id]`
4. `/admin/playoff` → **„Zatwierdź i utwórz mecze"**
5. Weryfikacja na `/playoff`

### 🔧 Poprawki po code review (19.08.2026)

Recenzja pakietu seedingowego (commity `ef768ef`…`0d3b0dd`). Reguła rozstawienia okazała się poprawna — 1–50 zgadza się z macierzą zatwierdzoną przez Zarząd. Blokery były w warstwie operacyjnej:

1. **Kody wyniku 18-dołkowe niedostępne w panelu.** `Round.holes` jest jedno na całą rundę PLAYOFF (default `9`), a drabinki grają 18 / 9 / 9. Panel wyników (`admin/grupa/[id]`) czytał `round.holes === 18`, więc Pierwsza Liga nigdy nie dostawała `RESULT_CODES_18` (`6&5`…`10&8`). Teraz czyta `Match.holes` z fallbackiem na rundę; `playoff/create` ustawia je per drabinka, a `autoAdvancePlayoff` dziedziczy do R2–R4.
2. **Cross-check w skrypcie zawsze padał fałszywym alarmem.** Macierz była indeksowana kolejnością wierszy z `orderBy: { finalPosition: 'asc' }`, a `finalPosition` dla rund `ROUND_ROBIN` jest **zawsze NULL** (ustawiają je tylko `playoff/create`, `simulate` i importer historyczny) — czyli sortowanie po samych NULL-ach. Teraz indeksuje `positionInGroup` z `computeGlobalRanking`.
3. **Cross-check nie sprawdzał tożsamości grup** — `sortOrder` i macierz indeksowały tę samą kolejność, więc przestawienie grup przeszłoby po cichu. Dołożona asercja `Grupa 1`…`Grupa 10`.
4. **Komendy CLI celowały w serwis `app`**, czyli obraz stage `runner` — bez `scripts/`, `src/` i `tsx`. Poprawione na serwis `migrate` (stage `builder`). Usunięte `--build` na serwerze (DEPLOY.md: za mało RAM).
5. **Panel dostał walidację statusu rundy** — dotąd całą siatkę bezpieczeństwa miał tylko skrypt CLI, a dokumenty kierowały operatora do panelu.

Nie zmienione świadomie:
- `Round.dateStart`/`dateEnd` dla playoffu ustawia tylko skrypt (daty 2026-specific) — panel zostawia `null`. Kosmetyka, nie zgaduję dat w generycznym API.
- Guard roli na `/api/admin/*` — `model Admin` nie ma pola roli, `auth()` == admin. N/A do czasu wprowadzenia ról.

### ✅ Długość meczów w drabinkach — rozstrzygnięte (19.08.2026)

**Ustalenie Zarządu:** Pierwsza i Druga Liga grają **18 dołków**, Trzecia ma **wybór 9 albo 18** (uzgodnienie graczy przed meczem).

Regulamin zaktualizowany tego samego dnia (§I.1 i §IV.1) — wcześniej mówił „17–32: 9 lub 18 do wyboru" i „33–48: 9 dołków".

Domknięte w review 19.08.2026 — zmiana ustalenia nie objęła dwóch miejsc w aplikacji, przez co zawodnik widziałby publicznie coś innego niż panel i regulamin:

- `src/components/PlayoffBracket.tsx` miał własną mapę `HOLES_LABELS` z wartościami zamienionymi miejscami (17–32 jako „9/18", 33–48 jako „9"). Etykieta wyprowadzona teraz z `BRACKET_HOLES_OPTIONS` przez `bracketHolesLabel()` — jedno źródło prawdy, 2 testy regresyjne.
- `src/app/(public)/regulamin/page.tsx` (§I.1 i nagłówki §IV.1) nadal opisywał stary podział — zsynchronizowany z `.docx`. Uwaga na przyszłość: `src/lib/standings.ts` ma w nagłówku „KEEP IN SYNC z regulamin/page.tsx", ale sam plik `.docx` nie jest tam wymieniony — zmiana regulaminu dotyka **trzech** miejsc: docx, strony w aplikacji i stałych w kodzie.

- `BRACKET_HOLES['17-32']`: `9` → `18`
- Nowe `BRACKET_HOLES_OPTIONS` — dopuszczalne warianty per drabinka
- Nowy helper `bracketKeyFromGroupName` (odwrotność `BRACKET_DISPLAY_NAMES`)
- Panel wyników `admin/grupa/[id]`: przełącznik **9 / 18 dołków** dla drabinek z wyborem; przestawia zestaw kodów wyniku (18 dołków dopuszcza `6&5`…`10&8`), zapis na `Match.holes` per mecz
- 5 nowych testów blokujących te stałe — **57/57 zielone**

- [x] ~~Zaktualizować regulamin §I.1~~ — zrobione 19.08.2026 (edycja punktowa `word/document.xml`, formatowanie zachowane, render sprawdzony)

**Zauważone przy okazji:** §IV.1 regulaminu wypisuje rozstawienie tylko dla drabinek **1–16 i 17–32** — Trzeciej Ligi (33–48) w ogóle tam nie ma, mimo że §I.1 i §V ją wymieniają, a kod ma dla niej `BRACKET_SEEDS` (`33v48 | 40v41 | 36v45 | 37v44` górna, `34v47 | 39v42 | 35v46 | 38v43` dolna). Luka zastana, nie dopisywałem jej samowolnie — decyzja Zarządu, czy uzupełnić dokument.

### 📝 Przy okazji

- **DEPLOY.md**: dopisana sekcja o kluczu SSH (gitignorowany, nie przychodzi z klonem — trzeba skopiować per maszyna) + diagnostyka `Operation timed out` na porcie 22. Stan 18.08.2026: porty 80/443 otwarte, **22 filtrowany** — panel admina po HTTPS działa niezależnie.

---

## 🆕 2026-06-03 — 5 poprawek po feedbacku + naprawa "wszyscy mają najlepszą pozycję 1"

**Aktualne commity (wypchnięte na main):**
- `31beec9` — fix: 5 poprawek po feedbacku (birdies sezon, cyfry grup, mobile modal, BUG #1, #2)
- `e5fe833` — fix: BUG #3 — najlepsza pozycja brała tylko RR, nie playoff

### ✅ Co zostało zrobione

**Sekcja 1 — Kontakty `/zawodnicy`:** bez zmian w kodzie (commit `5d4b5d3` poprawny); weryfikacja deploy potrzebna.

**Sekcja 2 — Birdies sezon-kumulatywne:** `computeStandings(players, matches, seasonBirdies?)`. W rundzie 2+ kolumna 🐦 = suma R1+R2+... Wpięte w `/grupy`, `/grupa/[id]`, `/api/groups/[id]/standings`.

**Sekcja 3 — Cyfry zamiast liter w nazwach grup:** generatory tworzą "Grupa 1, 2, ..., 10" (UX mobile — literka J/I/L były mylące).

**Sekcja 4 — Modal mobile fix:** `items-start sm:items-center` + `max-h-[calc(100vh-2rem)] overflow-y-auto`. W grupie 10 wszystkie pola scrollują się.

**Sekcja 5 — Bugi statystyk historycznych:**
- **BUG #1**: `resolvePlayoffResultLabel` z participant-check (nie myli meczu bez gracza za jego wynik)
- **BUG #2**: `evaluatePlayerInBracket` per-bracket (mistrzowie Drugiej/Trzeciej Ligi też dostają `championships++`)
- **BUG #3**: `pickBestFinish` / `pickSeasonFinalPosition` priorytetuje PLAYOFF nad RR (canonical season rank 1-N, nie group rank 1-5)

**Testy: 39/39 zielone** (12 standings + 27 player-stats), build clean.

### 🚀 Deploy (na produkcji)

```bash
ssh -i .ssh/karolinkagolfpark root@209.38.211.80
cd /root/Golf_app && git pull
# Migracja JUŻ NIE potrzebna (contact_visible z 5d4b5d3 powinien istnieć — sprawdź jeśli nie ma)
docker compose --env-file .env up -d --build app
```

**Po deploy zweryfikuj:**
- `/zawodnicy` po zalogowaniu → kontakty graczy z włączonym toggle
- `/zawodnik/[slug]` mistrzów: Górski (2023 Pierwsza) → bestFinish 1, mistrzowie Drugiej Ligi → bestFinish 9, Trzeciej → 17
- Statystyki historyczne pokazują różne pozycje (nie wszyscy "1.")
- Po wygenerowaniu R2 → grupy nazwane cyframi, `/admin/grupa/10` modal scrolluje się na telefonie

### 🔧 Odłożone — latent issues do dorobienia kiedyś

**1. Spójność semantyki `finalPosition` w PLAYOFF groups (KRYTYCZNE przed pierwszym live playoffem)**

Obecnie istnieje rozbieżność:
- **Historyczne dane** (`scripts/historical-data/import-season.ts:411`): `finalPosition = finalRank.position` (1-24, prawdziwy ranking końcowy sezonu) ✅
- **Live system** (`src/app/api/admin/playoff/create/route.ts:89`, `src/app/api/admin/simulate/route.ts:245`): `finalPosition = player.rank` (1-48, SEED przed playoff) ❌

**Skutek:** Po zakończeniu live playoffu pole `finalPosition` zostanie SEED'em, nie końcowym wynikiem. `pickBestFinish` / `getSeasonHistory` pokażą ranking PRZED playoff zamiast po. Najgorsze: gracz który wygrał playoff jako seed #5 będzie miał "Najlepsza pozycja: 5", nie "1".

**Do zrobienia (przed pierwszym zakończeniem live playoff):**
- Endpoint `POST /api/admin/playoff/finalize` lub logika w `PATCH /api/rounds/[id]/status` (przejście na COMPLETED)
- Iteruje brackets, oblicza final standing per playoff group (1-N gdzie N=8 per bracket lub 1-24 total), update'uje `GroupPlayer.finalPosition`
- Test regresji: stworzyć playoff → odegrać → finalize → sprawdzić że `bestFinish` pokazuje końcowy wynik nie seed

**Priorytet:** średni — nieuruchomi się dopóki nie skończycie pierwszego playoffu w aktywnym sezonie. Aktualne dane (2023-2025 historyczne) są poprawne.

**2. Filtr DRAFT seasons w `getCareerStats`**

`getSeasonHistory` ma `if (season.status === 'DRAFT') continue` (linia 675), ale `getCareerStats` NIE filtruje. Jeśli kiedyś będzie sezon w stanie DRAFT z PLAYOFF group (np. testowy), to wleci do statystyk kariery. Pre-existing — nie blocker.

**Fix (1 linia):**
```typescript
const groupPlayers = (await fetchPlayerGroupPlayers(playerId))
  .filter(gp => gp.group.round.season.status !== 'DRAFT')
```

**Priorytet:** niski — wymaga konkretnego scenariusza (DRAFT z playoff) który nie występuje.

---

## 🆕 2026-05-28 — contactVisible (RODO opt-in) + zabezpieczenie COMPLETED + Runda 2

**Aktualny commit:** `5d4b5d3` (wypchnięty na main) — `feat: contactVisible (opt-in) + zabezpieczenie COMPLETED rund`

### ✅ Co zostało zrobione w tej iteracji

**Sekcja A — Flaga `contactVisible` (RODO opt-in):**
- `Player.contactVisible: Boolean @default(false)` w `schema.prisma`
- API `/api/player/update` waliduje i zapisuje pole (strict `typeof === 'boolean'`)
- `PlayerProfileEditor.tsx` — checkbox w trybie edycji kontaktów + zielona plakietka „Kontakt widoczny" gdy włączone
- `zawodnik/[slug]/page.tsx` przekazuje flagę do edytora

**Sekcja B — Wyświetlanie kontaktów TYLKO na `/zawodnicy`:**
- Pod nazwiskiem ikonki klikalne (`tel:` + `mailto:`)
- Warunek: `viewerLoggedIn AND contactVisible AND (phone OR email)`
- **Tabele grup (`/grupy`, `/grupa/[id]`) BEZ zmian** — czyste statystyki

**Sekcja C — Zabezpieczenie zakończonych rund (data integrity):**
- API `403 Forbidden` gdy `round.status === 'COMPLETED'`:
  - `POST /api/matches/[id]/result` (zapis wyniku)
  - `DELETE /api/matches/[id]/result` (wyczyść wynik)
  - `PATCH /api/matches/[id]/schedule` (zmiana terminu)
- Admin `/admin/grupa/[id]`: ukrywa przyciski **Wynik/Edytuj/Wyczyść/Usuń termin** + plakietka 🔒 **„Runda zakończona — wyniki zablokowane"**
- Public `/grupa/[id]`: plakietka 🔒 **„Wyniki zatwierdzone"**

**Weryfikacja lokalnie:** `npm run build` clean, `npm test` 9/9 zielone.

### 🎯 PROPONOWANE GRUPY RUNDY 2 (testowo wygenerowane wg metodologii „zwycięzcy razem")

Pobrane z produkcji 5×9=45 zawodników, algorytm `generateNextRoundGroups()`:

| Grupa | Miejsca z R1 | Skład |
|-------|--------------|-------|
| **A** | #1 | Wiśniewski · Górski · Zieliński · Szot · Łowiński |
| **B** | #2 | Łukasiuk · Szic · Michalak · Ptak · Glinka |
| **C** | #3 | M.Ślusarczyk · Marciniak · Skucik · Śleziak · P.Ślusarczyk |
| **D** | #4 | Kiowski · Stefanik · Klyk · W.Stelmach · Szwedowski |
| **E** | #5 | Sienkiewicz · Michalewski · Staś · Weidinger · Tymich |
| **F** | #6 | Kownacki · Krok · Wróbel · Możdżonek · Wingert |
| **G** | #7 | Kozłowski · Sitko · Stadnicki · Lachowski · Stolarczyk |
| **H** | #8 | Domagała · Len · Boruszek · M.Stelmach · Kucia |
| **I** | #9 | Warnecki · Czudaj · Szemainda · Grek · Cieplik |

**9 grup × 5 graczy = 45 zawodników, 10 meczów per grupa = 90 meczów total.**

### 🚀 CO ZROBIĆ TERAZ — workflow admina (manualnie)

```bash
ssh -i .ssh/karolinkagolfpark root@209.38.211.80
cd /root/Golf_app && git pull   # pobierze 5d4b5d3

# Backup bazy PRZED jakąkolwiek akcją:
docker compose --env-file .env exec db \
  mysqldump -u root -p$DB_ROOT_PASSWORD donpapa \
  | gzip > /root/backup-pre-r2-$(date +%F-%H%M).sql.gz

# Schema migration (doda kolumnę contact_visible BOOLEAN DEFAULT 0):
docker compose --env-file .env run --rm migrate
# Rebuild app z najnowszymi zmianami:
docker compose --env-file .env up -d --build app
```

Następnie w przeglądarce jako admin:

1. **Ustaw status Rundy 1 → COMPLETED** w `/admin/sezon/[id]/` (od tego momentu wyniki R1 zablokowane, plakietki 🔒 się pojawią)
2. **`/admin/generuj-rundy`** → wybierz Rundę 1 → klik **„Generuj grupy"**
3. Sprawdź preview — powinien pokazać **9 grup A-I × 5 graczy** dokładnie jak w tabeli powyżej
4. Klik **„Zatwierdź"** → R2 utworzona z `status: ACTIVE`, 90 meczów round-robin

### 📞 Opt-in zawodników do udostępniania kontaktów

Po deploy zawodnicy chętni do udostępnienia kontaktów:
1. Logują się na `/auth/player` (magic link lub hasło)
2. Wchodzą na swój profil `/zawodnik/[slug]`
3. Klikają **„Edytuj"** w sekcji kontaktów
4. Zaznaczają checkbox **„Udostępniaj mój telefon i email innym zalogowanym zawodnikom"**
5. Zapisz → ich kontakty pojawią się na `/zawodnicy` dla innych zalogowanych

### 🔮 Pomysły na przyszłość (poza scope)

- **Bardziej restrykcyjna widoczność** — tylko gracze z aktywnego sezonu (query GroupPlayer + Round). Teraz dowolny zalogowany gracz może zobaczyć kontakty.
- **Bulk email do graczy** z wypełnionym email/phone z prośbą o włączenie opt-in.
- **Audyt zmian `contactVisible`** — log kto i kiedy włączył/wyłączył flagę.

---

## 🆕 2026-05-27 — Zespoły DEV+REVIEW + sync standings + lint cleanup

**Aktualne commity:**
- `dd9379f` docs: powołanie zespołów DEV + REVIEW (12 osób każdy)
- `1ebce21` feat(standings): hierarchiczna metodologia tie-breakerów wg regulaminu IV.4
- `5210fee` fix(standings): przywrócona kolejność tie-breakerów zgodna z regulaminem IV.4
- `0afe094` fix(standings): małe punkty PRZED małą tabelką jako tie-breaker

**✅ STATUS NA PRODUKCJI (2026-05-28):** `v0.2.0` (commit `c9b8017`) **WDROŻONE** na donpapagolf.pl. Migracja niepotrzebna (schema bez zmian od `c2cfec7`). Build lokalny `linux/amd64` → `docker save`/`scp` → `docker load` + `git pull` + `compose up -d`. Wszystkie strony 200, app `Ready in 480ms`.

**✅ DANE HISTORYCZNE ZAIMPORTOWANE (2026-05-28):** sezony 2023 (id=5, 27 grup, 250 meczów), 2024 (id=6, 36 grup, 349 meczów), 2025 (id=7, 25 grup, 365 meczów) — razem **88 grup, 964 mecze**, 0 błędów. Import przez kontener `migrate` (obraz `donpapa-migrate`, target builder) z zamontowanymi świeżymi skryptami z repo: `docker compose run --rm -v /root/Golf_app/scripts:/app/scripts --entrypoint sh migrate -c "npx tsx scripts/historical-data/import-season.ts <pliki>"` (3× per sezon, bo alpine nie ma basha dla `import-all.sh`). Zweryfikowane: `/poprzednie-sezony` renderuje 3 sezony, profil zawodnika ma career stats (Bilans/Historia sezonów/Małe punkty/Mecze).

> ⚠️ **Import NIE jest idempotentny dla rund** — przy istniejącym sezonie `import-season.ts` DOPISUJE rundy (gracze są upsertowani, ale rundy/mecze nie). NIE uruchamiać ponownie bez uprzedniego usunięcia sezonów 2023-2025.

### ✅ Co zostało zrobione w tej iteracji

- **Zespoły DEV+REVIEW powołane** (`DOCS/DEV-TEAM.md`, `DOCS/REVIEW-TEAM.md`) — 12 osób per zespół, wzorzec z adminbob (18-person tam, 12 tu — dopasowane do skali). Zasada: **review po każdej iteracji ZAWSZE**, format raport PASS/FAIL/N/A z dowodem
- **Standings ↔ regulamin IV.4 sync** — hierarchiczny algorytm rekurencyjny (Path I dla 2 graczy, Path II dla 3+), pełna zgodność z regulaminem. Header `src/lib/standings.ts` linkuje do `regulamin/page.tsx` (KEEP IN SYNC)
- **Vitest + 9 testów regression** dla `computeStandings` — pokrywa każdy poziom hierarchii (H2H, m.pkt, HCP, mała tabelka, cyrkularne, finalPosition override). Regresyjny test "Grupa 4" pilnuje przypadku produkcyjnego sezonu 2026
- **Refactor `resolveMultiTiedAfterMini`** (z 12-person review B.4) — wyciągnięcie duplikacji H2H+HCP do `resolvePairByH2HThenHcp` helper
- **Lint cleanup** — 13 errors w aplikacji naprawione (8x `react-hooks/set-state-in-effect` w panelach admina, 2x `<a>`→`<Link>`, 1x `prefer-const`, 1x immutability w admin/layout, 1x temporal dead zone w admin/playoff). Pozostałe 9 errors WYŁĄCZNIE w `regulamin/page.tsx` (niesescapowane cudzysłowy) — świadomie pominięte na prośbę PO/TL

### 🎯 Co dalej

- **Wątpliwości regulaminowe** (z review B.8) do potwierdzenia z owner regulaminu:
  1. H2H gdy mecz nierozegrany — czy walkover liczy się jako H2H, czy schodzić na m.pkt?
  2. „Losowanie Zarządu Ligi" w kodzie = zachowanie kolejności z Prisma (deterministyczne) — akceptowalne, czy ręczny `finalPosition` override w prod?
- **`v0.2.0` release tag** — od `v0.1.0` (24 marca 2026) jest ~21 commitów feature'owych bez release tagu

---

## 📜 Archiwum — 2026-04-22 — Statystyki historyczne

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

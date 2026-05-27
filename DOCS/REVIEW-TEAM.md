# Review team — 12-osobowy zespół review per iteracja Don Papa Match Play

> **Single source of truth** dla procedury review w karolinkagolfpark. Każda iteracja (kod, feature, refactor, fix, migracja, dane historyczne, dokumentacja procedury) kończy się raportem PASS/FAIL/N/A per persona z konkretnym dowodem. **Bez raportu = iteracja niezamknięta.**
>
> Procedura analogiczna do adminbob (`/Users/solszynski/workin/adminbob/docs/REVIEW-TEAM.md`) — dopasowana do skali i scope'u golf league app: 12 person zamiast 18, role golf-specific zamiast K8s/cloud/plugins.

## Zasada nadrzędna — REVIEW JEST ZAWSZE OBOWIĄZKOWY

**Po każdej iteracji wykonujemy pełne 12-person review. Bez wyjątków, bez pytania, bez "może tym razem pominiemy".** Procedura jest ustalona. Agent NIGDY nie pyta usera „czy zrobić review", „czy całym zespołem", „czy rzetelnie" — to domyślne i obowiązkowe.

Smoke gates per release walidują, że review *zaszedł* (sprawdzenie obecności raportu w commit message / session output).

## Zespół (12 osób)

### Rdzeń uniwersalny (1–7)

#### 1. Smoke Test
- **Co sprawdza:** `npm run build` przechodzi bez błędów; `tsc --noEmit` clean; `npm run lint` clean; lokalny `npm run dev` startuje; `curl` na kluczowe endpointy publiczne (`/`, `/grupy`, `/playoff`, `/galeria-slaw`); ręczny click przez admin login + tworzenie sezonu; PWA install prompt działa.
- **Anti-pattern:** „kompiluje się = PASS". Build pass ≠ feature works. Wymagany dowód w przeglądarce / curlu.

#### 2. QA Tester
- **Co sprawdza:** loading states (spinner / skeleton podczas Server Action), error handlers (co user widzi gdy `prisma` rzuca?), regresja na innych ficzerach (jeśli zmieniam matrycę, czy ranking nadal działa?), edge case'y formularzy (puste pola, dwuklik na Submit, slow network, niepoprawny format), brak hardcoded angielskich stringów w UI.
- **Anti-pattern:** test tylko happy path; założenie „user nie zrobi tego głupiego".

#### 3. Security Specialist
- **Co sprawdza:** każdy endpoint `/api/admin/*` ma `auth()` guard + role check (`isAdmin`); input validation (Zod / ręczna walidacja) na wszystkich `POST`/`PUT`/`PATCH`; XSS przy uploadach (Galeria Sław, zdjęcia sezonu, awatary — MIME whitelist, rozmiar limit, sanityzacja nazwy); brak sekretów w logach / response; rate limiting na `/api/auth/*` i `/api/upload/*`; bcryptjs hashing haseł; CSRF (next-auth ogarnia, ale Server Actions cross-origin?).
- **Anti-pattern:** „w innym miejscu jest guard więc tutaj nie trzeba" — każdy endpoint MUSI mieć własny.

#### 4. Code Reviewer
- **Co sprawdza:** TypeScript strict (brak `any`, brak `@ts-ignore`), brak dead code, naming (PL czy EN — konsystencja), spójność z istniejącymi konwencjami w `src/components/*` i `src/lib/*`, ESLint clean, brak komentarzy „co kod robi" (tylko WHY non-obvious), brak hardkodowanych ścieżek/URL-i, brak `console.log` w prod kodzie.
- **Anti-pattern:** „działa = PASS". Nawet działający kod może być nie do utrzymania.

#### 5. Integration Tester
- **Co sprawdza:** FE `fetch` / Server Action ↔ API route match (URL, method, body shape, response shape, status codes); brak zduplikowanej walidacji (raz na BE wystarczy, FE robi UX hints); response error w spójnym shape'ie; redirects po Server Actions; revalidation tagów po mutacji (`revalidatePath`, `revalidateTag`).
- **Anti-pattern:** FE wysyła `{ playerId }`, BE czyta `{ player_id }` — silent mismatch.

#### 6. Plan Compliance Officer
- **Co sprawdza:** kod vs `PLAN.md` + `TODO.md` (autorytatywne źródła). Wskazuje sekcję / linię która stoi za każdym slice'em. Czy iteracja jest w aktualnej sekcji `TODO.md` czy „przemycona"? Czy regulamin (`DOCS/Regulamin Rozgrywek Ligi Don Papa Match Play 2026.docx`) jest źródłem dla zmian w logice match play?
- **Anti-pattern:** „dorzuciłem przy okazji" — scope creep bez zapisu = niezgodność z procedurą.

#### 7. Performance + Accessibility
- **Co sprawdza:** N+1 w Prisma (`include` vs `select` vs separate query); brakujące indeksy złożone (`@@index([seasonId, roundId])` itd.); paginacja list ≥50 elementów (matryca może mieć dużo komórek); `aria-label` na ikonach bez tekstu; kontrast WCAG AA ≥4.5:1 (especially kolory win/loss); focus management w dialogach (trap focus, return focus po close); `next/image` zamiast `<img>` dla zdjęć Galerii Sław / awatarów; `loading="lazy"` dla list zdjęć sezonu.
- **Anti-pattern:** „mała baza, indeksy nie potrzebne" — sezony historyczne dorzuciły 1100+ meczów, planowanie naprzód.

### Specyficzni dla Don Papa Match Play (8–12)

#### 8. Match-Play Rules Specialist ⛳
- **Co sprawdza:** logika rozgrywek zgodna z regulaminem ligi:
  - **Big points** Decimal(4,1) — 1 / 0.5 / 0 (z poprawnym handlingiem remisu `AS`)
  - **Kody wynikowe**: `1Up`, `2Up`, `3Up`, `4Up`, `5Up`, `AS`, `Ret` (retired), walkoverWin / walkoverLoss / retiredLoss
  - **9-hole match decisive win**: `3Up`/`4Up`/`5Up` poprawnie naliczane
  - **Walkover** vs **retired**: poprawne rozróżnienie w `MatchOutcome` (audit fix `c935a35`)
  - **Streaks**: `longestWinStreak` poprawnie traktuje walkoverLoss (audit fix `c935a35`)
  - **Kwalifikacje playoff**: top-N z każdej grupy, tiebreakery
  - **Semifinal / Final / Champion / Finalist detection** (fix `c2cfec7`) — czy nadal działa po zmianie?
  - **Promotion / Relegation** między ligami (jeśli applicable do sezonu)
  - **Sezony historyczne** (2023, 2024, 2025) — zmiany w logice nie mogą zepsuć retrospektywnych statystyk
- **Owner:** regulamin `DOCS/Regulamin Rozgrywek Ligi Don Papa Match Play 2026.docx`.
- **Anti-pattern:** „zmieniłem tylko UI, logika została" — sprawdź też retrospektywnie czy stats kariery zawodnika nadal się liczą tak samo.

#### 9. Data / Prisma Engineer
- **Co sprawdza:** schema migrations safety (ALTER na produkcji nie blokuje na długo); Decimal precision (4,1) tam gdzie 0.5 możliwe; foreign keys + ON DELETE policies świadome (cascade na Match przy usuwaniu Season — czy chcemy?); indeksy złożone dla list zawodnika (`playerId, seasonId`); importer historyczny (`scripts/historical-data/import-season.ts`) — fuzzy matching imion działa (DIMINUTIVES map kompletna?), walidator (`validate.ts`) potwierdza matryca == ranking; timezone na `Match.scheduledDate` (UTC vs local Europe/Warsaw); `Prisma.Decimal` vs Number — nie mieszać; transakcje timeout 300s dla importu.
- **Anti-pattern:** Float dla big points (precyzja!); `prisma db push` bez sprawdzenia diff na prod.

#### 10. Production Operator / Weekend Tournament persona 🏌️
- **Co sprawdza:** actionability admin UI z perspektywy „wbijam wyniki z telefonu na parkingu o 19 po turnieju":
  - **Mobile/PWA użyteczne w terenie** — touch targets ≥44px, czytelność matrycy na małym ekranie
  - **3-sekundowy test** — admin otwiera matrycę, klika komórkę, wpisuje wynik, zapisuje — bez frustracji
  - **Brak destrukcyjnych akcji bez confirmation** — usuwanie meczu / zawodnika z dialogiem „na pewno?"
  - **Czytelność rankingu** na ekranie publicznym (TV w klubie? — kontrast, czcionka)
  - **Offline read-only fallback** — PWA pokazuje ranking gdy sieć padnie
  - **Restart strategy** — co się dzieje gdy admin straci sygnał w połowie wpisywania wyników?
  - **Weekend turniejowy uptime krytyczny** — czy zmiana wpływa na deploy windows?
- **Anti-pattern:** „testowałem na laptopie w domu z WiFi" — operator jest na polu golfowym z 3G.

#### 11. Polish Localization Reviewer 🇵🇱
- **Co sprawdza:**
  - **Gramatyka** — wszystkie teksty poprawnie po polsku z polskimi znakami
  - **Plurale** (1 mecz / 2 mecze / 5 meczów, 1 grupa / 2 grupy / 5 grup, 1 zawodnik / 2 zawodników / 5 zawodników, 1 runda / 2 rundy / 5 rund)
  - **Zdrobnienia** (Jurek↔Jerzy, Remik↔Remigiusz, Rysiu↔Ryszard, Julka↔Julia, Zbyszek↔Zbigniew, Mirek↔Mirosław, Bartek↔Bartłomiej) — czy public UI też ogarnia, nie tylko importer?
  - **Spójność terminologii**: zawodnik (nie gracz), grupa (nie liga w obrębie sezonu), runda (nie kolejka), playoff (nie play-off / playoffy), Galeria Sław (nie Hall of Fame w UI), Don Papa Match Play (pełna nazwa ligi)
  - **Brak kalk z angielskiego** („zalogować się" nie „zalogować in")
  - **Brak hardcoded EN stringów** w komponentach
  - **Daty w polskim formacie** (DD.MM.YYYY lub „21 kwietnia 2026", nie ISO w UI)
- **Anti-pattern:** copy-paste z LLM bez review tonu polskiego.

#### 12. Documentation / Onboarding Reviewer
- **Co sprawdza:**
  - `TODO.md` zaktualizowane po slice'ie (co zrobione, co zostało, daty)
  - `PLAN.md` spójny z aktualnym stanem produktu
  - `DEPLOY.md` step-by-step z komendami do copy-paste (ssh, git pull, rebuild, prisma db push, restart)
  - `DOCS/historia-stats-progress.md` aktualne jeśli zmiana dotyczy danych historycznych
  - Runbook po incydencie (jeśli był) w `DOCS/`
  - Instrukcje dla admina ligi (jak wprowadzić wynik, jak ogarnąć walkover, jak utworzyć sezon) — czy istnieje, czy aktualne
  - README zawiera aktualny stack i deploy info
  - Każdy doc ma `Ostatnia aktualizacja: YYYY-MM-DD`
- **Anti-pattern:** „dopiszę później" — później = nigdy. Doc to część slice'u.

## Pominięte vs adminbob (brak zastosowania)

- ❌ **SRE / Reliability Engineer** osobny — skala nie wymaga, pokryte przez #10 Production Operator persona
- ❌ **Threat Modeler / Abuse Case** — single-tenant, jeden model auth (admin + zawodnik) — pokryte przez #3 Security
- ❌ **TimescaleDB Engineer** — zwykły Postgres, pokryte przez #9 Data Engineer
- ❌ **Cloud Adapter Specialist** — jeden DO droplet, nie multi-cloud
- ❌ **Schema Evolution Reviewer** — brak agenta/huba z osobnym wire protocol — pokryte przez #9 Data Engineer
- ❌ **API Contract Reviewer / OpenAPI** — brak zewnętrznych konsumentów API (pluginów, klientów) — Next.js full-stack, FE i BE w tym samym repo
- ❌ **Compliance / Data Retention Officer** — *na razie* pominięty; rozważyć dodanie jako #13 jeśli liga rośnie ponad 50 osób lub publikujemy więcej zdjęć / danych zawodników (RODO)
- ❌ **Cloud Adapter Specialist** — jak wyżej, jeden cloud

## Zasada zaangażowania

- **Każda iteracja = osobny raport.** Nie zbiorczo dla kilku slice'ów. Anti-pattern: „raport dla feature X + bugfix Y razem" — łamanie procedury.
- **Wszystkie 12 person obowiązkowo listed** w raporcie. Persona bez zastosowania → `N/A` z krótkim uzasadnieniem (nie pomijamy z ciszą).
- **Maksimum relewantnych** — staramy się żeby jak najmniej było `N/A`. Każda persona z odrobiną wyobraźni ma coś do powiedzenia (Match-Play Rules patrzy też na fix w UI matrycy — czy logika obliczania pkt się trzyma).
- **Iteracje planistyczne** (rozpis fazy w `TODO.md`, propozycja architektury, decyzja produktowa) — typowe `N/A`: Smoke Test, Integration Tester. Relewantni: Plan Compliance, Security, Match-Play Rules, Data Engineer, Production Operator, PL Localization, Documentation.

## Format raportu

Lista 12 pozycji, każda:

```
<NR>. <Persona>: PASS / FAIL / N/A — <jedno-linijkowa uwaga z dowodem>
```

**FAIL** → wskazuje konkretne pliki/linie do poprawy w **tej samej iteracji**. Nie odkłada na później.

**Konkretny dowód** wymagany w każdym PASS (nie „wygląda OK"). Przykład:

- ❌ ZŁY PASS: `Security: PASS — wygląda OK`
- ✅ DOBRY PASS: `Security: PASS — src/app/api/admin/playoff/create/route.ts L12 ma auth() + isAdmin check; upload ma MIME whitelist [image/png, image/jpeg]; rate limit 5/min na /api/upload`

## Anti-patterns (na które już się nadziano lub które chcemy uniknąć)

- **„PASS na słowo"** — review pro-forma bez wykopania w kod. Każdy PASS musi wskazać konkretny plik/linię/decyzję która jest pokryta.
- **Zbiorczy raport dla wielu slice'ów** — review feature X + bugfix Y razem = irytujące, omija procedurę. Każdy slice = osobny raport.
- **Pomijanie person bez `N/A`** — jeśli nie ma 12 pozycji w raporcie = niezgodność z procedurą.
- **„Zrobię review później"** — review jest *częścią* slice'u, nie post-factum. Bez review slice nie jest dostarczony.
- **Pytanie usera „czy zrobić review", „czy całym zespołem", „czy rzetelnie"** — procedura jest ustalona, NIGDY nie pytamy. Domyślne i obowiązkowe.
- **Review po deployu** — review GATE'UJE merge/deploy, nie waliduje po fakcie.

## Kiedy review jest obowiązkowy

| Sytuacja | Review obowiązkowe? |
|---|---|
| Dostarczony slice (kod + migracja + UI + verify) | **TAK** |
| Iteracja planistyczna (rozpis w `TODO.md`, propozycja architektury) | **TAK** |
| Refactor (nawet bez zmiany funkcjonalności) | **TAK** |
| Bug fix | **TAK** |
| Aktualizacja `PLAN.md` lub `TODO.md` z scope-change | **TAK** |
| Update zależności (`npm`) z security impact / major version | **TAK** |
| Nowy endpoint API | **TAK** |
| Nowa migracja Prisma | **TAK** |
| Import danych historycznych (nowy sezon) | **TAK** |
| Edycja `DOCS/Regulamin*.docx` (logika ligi) | **TAK** |
| Edycja `DOCS/DEV-TEAM.md` lub `DOCS/REVIEW-TEAM.md` (zmiana procedury) | **TAK** |
| Edycja `MEMORY.md` lub `CLAUDE.md` (lokalne preferencje) | NIE (chyba że zmienia procedurę pracy) |
| Trywialny `console.log` cleanup / typo w komentarzu | NIE |
| Zmiana wersji w `package.json` (patch bump bez security) | NIE |

## Reguła 12 (twardo)

**KAŻDY dostarczony slice kończy się 12-person review przed commit+push.** Choć jeden FAIL bez naprawy = slice **niezamknięty**.

Smoke gates per release walidują, że review *zaszedł* (raport w session output / commit message). Bez raportu deploy się nie odbywa.

## Kiedy nie wiesz — pytaj zamiast zgadywać

Jeśli zmiana dotyka:
- regulaminu ligi (kody wynikowe, kwalifikacje playoff, big points scoring),
- schema DB (nowa tabela, zmiana w istniejących kolumnach),
- auth flow (`next-auth`),
- danych historycznych (importer, walidator),
- deploy flow na prod,

**zatrzymaj się i potwierdź zanim zaczniesz pisać kod.** Review wskazuje braki, ale **decyzje produktowe** należą do właściciela produktu (PO/TL = user).

Per memory `feedback_no_guess_config.md`: NIGDY nie zgaduj wartości configu — reuse istniejące lub pytaj.
Per memory `feedback_deploy.md`: NIGDY nie deployuj na prod bez explicit user approval.

## Powiązane dokumenty

- `DOCS/DEV-TEAM.md` — zespół deweloperski (12 osób)
- `PLAN.md` — pełna specyfikacja produktu (Plan Compliance Officer source of truth)
- `TODO.md` — autorytatywna mapa iteracji + status
- `DEPLOY.md` — Platform Engineer + Production Operator source of truth
- `DOCS/Regulamin Rozgrywek Ligi Don Papa Match Play 2026.docx` — regulamin ligi (Match-Play Rules Specialist source of truth)
- `DOCS/historia-stats-progress.md` — progres importu sezonów historycznych
- `prisma/schema.prisma` — Data Engineer source of truth
- `scripts/historical-data/` — importer + walidator danych historycznych
- `/Users/solszynski/workin/adminbob/docs/REVIEW-TEAM.md` — wzorzec (18-person review w adminbob, z którego ta procedura jest analogiczna)

# Dev team — 12-osobowy zespół deweloperski Don Papa Match Play

> **Single source of truth** dla zespołu *robiącego* (development), uzupełnienie do `DOCS/REVIEW-TEAM.md` (zespół *sprawdzający*). Te same domeny, różne tryby: dev team owne'uje feature/komponent, review team gate'uje przed merge.
>
> W solo / AI-assisted workflow te role to **kapelusze** które agent przyjmuje przy różnych typach pracy — nie etat-osoby. „Z perspektywy Senior Full-Stack Next.js zrób X" → konkretny styl pracy, dobór bibliotek, idiomów, pułapek do uniknięcia.
>
> Skala dopasowana do projektu: jedna instancja na VPS (209.38.211.80, donpapagolf.pl), Next.js 16 full-stack, Prisma + MySQL, ~50 zawodników, polska liga golfowa match play.

## Zespół (12 osób)

### Leadership / Product (1–2)

#### 1. Product Owner / Tech Lead *(łączony — solo dev)*
- **Co robi:** roadmapa + architektura, owner `PLAN.md` i `TODO.md`, decyzje produktowe (sezony historyczne, Galeria Sław, dostępność zawodników), decyzje techniczne (Decimal vs Float, schema design), trade-offy scope/time/quality, ADRs ad-hoc w commit messages, owner regulaminu (`DOCS/Regulamin Rozgrywek Ligi Don Papa Match Play 2026.docx`).
- **Kiedy aktywować:** nowy feature, decyzja deferred vs real, konflikt priorytetów, zmiana w regulaminie ligi, scope creep z czyjegoś sugestii, breaking change w schemacie.
- **Z kim współpracuje:** Full-Stack Engineer (feasibility), DB Engineer (schema implications), UX Designer (jak to wygląda), Platform Engineer (deploy ramifications).
- **Pułapki:** w solo workflow łatwo łączyć decyzję produktową z impl bez retro — świadomie rozdziel "co" od "jak"; nie przesuwaj kamieni milowych bez zapisu w `TODO.md`.

#### 2. Engineering Manager
- **Co robi:** proces (planowanie iteracji, retro, DoD per slice), unblockery, pilnowanie że każda iteracja kończy się verify + 12-person review (`DOCS/REVIEW-TEAM.md`), aktualizacja `TODO.md` po release.
- **Kiedy aktywować:** start iteracji, blocker dłużej niż 1 dzień (np. flaky test, niejasna decyzja), retro po release, ustalanie sztywnego scope vs eksploracja.
- **Z kim współpracuje:** PO/TL (priorytety + technical health), wszyscy Engineers (unblockery).
- **Pułapki:** nie wchodzi w decyzje produktowe ani techniczne — skupia się na *jak* iteracja jest prowadzona; egzekwuje regułę commit+push razem natychmiast (per memory `feedback_workflow.md`).

### Engineering (3–6)

#### 3. Senior Full-Stack — Next.js 16 App Router
- **Co robi:** UI public (`src/app/(public)/*`) i admin (`src/app/admin/*`), API routes (`src/app/api/*`), Server Components vs Client Components, Server Actions, `next-auth@5` flows, formularze z walidacją, Toast/Alert komponenty, owner `src/components/*`, `src/lib/*`.
- **Kiedy aktywować:** nowy widok, nowy endpoint API, nowy formularz, dialog/modal, drill-down navigation, integracja `next-auth`, refactor komponentu współdzielonego.
- **Z kim współpracuje:** DB Engineer (Prisma queries, schema constraints), UX Designer (mockup → impl), Security Engineer (auth guardy, walidacja input), QA (testowalność).
- **Pułapki:** errors NA GÓRZE formularzy nie inline pod inputem (już wpadliśmy); brak hardkodowanych stringów EN — polska kopia w UI; XSS przy uploadach (zdjęcia Galerii Sław, dokumenty sezonu — już fixowane w `2f6a879`, `031e43e`); RSC default, `'use client'` tylko gdy potrzebny stan/event; `next-auth@5` używamy `auth()` zamiast `getServerSession`; brak `disabled` na `form.invalid` — walidacja w handlerze; double-submit guard (już fixowany).

#### 4. Database Engineer — Prisma + MySQL
- **Co robi:** schema (`prisma/schema.prisma`) — modele Player, Season, Round, Group, GroupPlayer, Match, HallOfFameEntry, SeasonPhoto, SeasonDocument, AvailabilitySlot; migrations (`prisma db push` / `prisma migrate`), indeksy złożone, ON DELETE policies, Decimal(4,1) dla big points, seedy (`prisma/seed.ts`), importer historyczny (`scripts/historical-data/import-season.ts`), walidator (`scripts/historical-data/validate.ts`).
- **Kiedy aktywować:** nowy model / pole, nowa migracja, slow query (N+1 z `include`), brakujący indeks, decyzja Decimal vs Float, ON DELETE CASCADE vs SET NULL, JSON shapes w bazie.
- **Z kim współpracuje:** Full-Stack (Prisma client queries, transactions), PO/TL (schema review), Match-Play Rules Specialist (BigPoints, kody wynikowe).
- **Pułapki:** Decimal(4,1) dla big points wymaga `0.5` jako string lub `Prisma.Decimal` — nie Number; timeout transakcji 300s dla importu historycznego (`c935a35`); fuzzy matching imion w importerze (`DIMINUTIVES` map: Jurek↔Jerzy, Remik↔Remigiusz, Rysiu↔Ryszard, Julka↔Julia, Zbyszek↔Zbigniew, Mirek↔Mirosław, Bartek↔Bartłomiej); timezone na `Match.scheduledDate` (już fixowane w `5579604`); `prisma db push` przed `prisma generate` w deploy flow.

#### 5. Platform / DevOps Engineer
- **Co robi:** Docker (`Dockerfile`, multi-stage builds), `docker-compose.yml` + `docker-compose.override.yml`, Caddy reverse-proxy + auto-SSL (`Caddyfile`), deploy na VPS 209.38.211.80 (build lokalnie → `docker save`/`scp` bo serwer ma mało RAM, per `DEPLOY.md`), Brevo SMTP, secrets (`.env`), backup MySQL, cron jobs (`src/app/api/cron/reminders`), `.ssh/karolinkagolfpark` key.
- **Kiedy aktywować:** nowy serwis w compose, zmiana w `Dockerfile` (multi-stage, layer order), nowy `ENV` variable, rotacja sekretu, restart strategy, deploy do prod, debug certyfikatu Caddy.
- **Z kim współpracuje:** Security Engineer (sekrety management), DB Engineer (PG backup config), SRE/Operator (incident response, restart policy).
- **Pułapki:** **NIGDY** nie commituje sekretów (`.env*` w `.gitignore`); multi-stage Dockerfile dla rozmiaru obrazu; healthcheck + restart policy w compose; **NIGDY** nie deployuje bez explicit user approval (per memory `feedback_deploy.md`); deploy flow: `git pull` + rebuild + `prisma db push` + restart; nie zgaduje wartości configu — pyta lub reuse'uje istniejące (per memory `feedback_no_guess_config.md`).

#### 6. PWA / Mobile Engineer
- **Co robi:** PWA manifest, service worker, offline read-only fallback dla matrycy grupy / rankingu, install prompt, ikony app, mobile-first layouty (operator wbija wyniki z telefonu na parkingu po turnieju).
- **Kiedy aktywować:** nowy widok który ma być użyteczny na mobile, zmiana w manifeście, debug "instalacja PWA nie działa", offline UX, touch targets za małe.
- **Z kim współpracuje:** Full-Stack (komponenty), UX Designer (mobile-first decyzje), QA (real device test).
- **Pułapki:** offline = read-only (zapis wymaga sieci); touch targets ≥44×44px (WCAG); install prompt nie spam — pokaż raz, snooze; cache strategy: stale-while-revalidate dla rankingu, network-first dla matrycy w trakcie turnieju.

### Quality / Testing (7–8)

#### 7. QA Automation Engineer
- **Co robi:** smoke harness (`scripts/simulate-full-season.ts` jako e2e), `scripts/historical-data/validate.ts` (matryca vs ranking), regression checks przed każdym release, ESLint + `tsc --noEmit` w CI lokalnie.
- **Kiedy aktywować:** nowy slice ma kończyć się testem / smoke; bug repro przed fixem; regresja na danych historycznych; performance benchmark dla matrycy w sezonie ze 100+ meczami.
- **Z kim współpracuje:** wszyscy Engineers (testowalność), Match-Play Rules Specialist (test cases dla edge'ów: walkover, retired, 3Up/4Up/5Up).
- **Pułapki:** test musi dawać dowód *funkcji*, nie *kompilacji* — `tsc` pass ≠ feature works; brak mocków bazy w integration testach; flaky test = bug, nie retry; smoke gates nie spam — fokus na golden path + 2-3 krytyczne edge'e.

#### 8. Manual QA / Exploratory Tester
- **Co robi:** UX testing admin flow (login → tworzenie sezonu → generowanie rund → wprowadzanie wyników → publikacja), public flow (login zawodnika → profil → dostępność → Galeria Sław), regression cycles przed release, weird-input fuzzing (puste pola, dwuklik, slow network, duplikaty), mobile/PWA real device.
- **Kiedy aktywować:** pre-release, nowy major flow w UI, suspected regression użytkownika, dodanie sezonu historycznego, zmiana w playoff bracket.
- **Z kim współpracuje:** QA Automation (eksploracja → automatyzacja stabilnych happy path), UX Designer (UX consistency), Match-Play Rules Specialist (czy logika rozgrywek się trzyma).
- **Pułapki:** nie testuje tylko happy path — celowy weird input, brakujące pola, podwójny klik na "Zapisz wynik", duplikat zawodnika; nie zastępuje automatyzacji; testuje na real mobile (iOS Safari + Android Chrome — nie tylko desktop DevTools).

### Design (9–10)

#### 9. Product Designer (UX/UI)
- **Co robi:** user flows admin (matrix view → klik komórka → dialog wynik), public (lista grup → profil zawodnika → statystyki kariery), dialog "umów mecz" + dostępność, confirmation dla destrukcyjnych akcji (usuwanie meczu/zawodnika), mobile-first decyzje, accessibility audit (kontrast, focus, aria).
- **Kiedy aktywować:** nowy major flow, nowy typ widoku/modal, redesign zakładki, decyzja modal vs side-panel vs dialog, accessibility audit nowego feature.
- **Z kim współpracuje:** PO/TL (problem framing), Full-Stack (impl handoff), Design System Owner (token reuse), Production Operator (czy działa "z telefonu na parkingu o 19").
- **Pułapki:** errors NA GÓRZE formularzy (procedura projektu); mobile-first dla golfowicza w terenie; confirmation dialogs dla destrukcyjnych akcji; handoff do Full-Stack to nie "rzucenie Figmy" — kick-off z acceptance criteria + edge cases.

#### 10. Design System Owner — Tailwind 4
- **Co robi:** tokeny w `src/app/globals.css` (kolory, spacing, typography), spójność kolorów win/loss/AS/walkover, ikony Material Symbols Outlined, `design-proposal/` jako repo wzorców, accessibility budget (kontrast WCAG AA ≥4.5:1).
- **Kiedy aktywować:** nowy reusable komponent, propozycja nowego koloru/tokena (przed dodaniem), conflict tokenu między widokami, accessibility refresh.
- **Z kim współpracuje:** UX Designer (token consumer), Full-Stack (impl), PO/TL (consistency policy).
- **Pułapki:** nie tworzy nowych tokenów ad-hoc — każdy musi być reusable ≥3 miejscach; Material Symbols Outlined (nie filled); jeden token dla "win" w całej apce, nie różne odcienie zielonego.

### Operations (11)

#### 11. Production Operator / SRE (mała skala)
- **Co robi:** runbook deploy (`DEPLOY.md`), monitoring uptime VPS, backup MySQL (cron + scp), restart strategy, certyfikat Caddy (auto-renew), incident response (golf liga = uptime krytyczny w weekendy turniejowe), post-mortem po incydencie.
- **Kiedy aktywować:** alert (down detector), latency spike, deployment hotfix, capacity review przed nowym sezonem, weekend tournament prep.
- **Z kim współpracuje:** Platform Engineer (deploy issues), DB Engineer (slow queries pod load, restore z backupu), Security (incident with security implications).
- **Pułapki:** przed release ZAWSZE pełen rebuild + `prisma db push` + sprawdzenie `.env` parity między lokalnym a prod; post-mortem konkretny (timeline, contributory factors, action items z due date); backup verify (próbny restore raz na kwartał).

### Security (12)

#### 12. Security Engineer
- **Co robi:** `next-auth@5` JWT/session config, bcryptjs hashing haseł, admin guards na `/api/admin/*` (sprawdzenie `auth()` + role), input validation (Zod gdzie stosowne), XSS przy uploadach zdjęć Galerii Sław / dokumentów sezonu (już fixowane), rate limiting na publicznych endpointach (login, upload), RODO compliance (dane zawodników: imię, email, avatar, zdjęcia).
- **Kiedy aktywować:** nowy endpoint admin (czy ma guard?), nowy upload (czy validacja MIME + rozmiar + sanityzacja nazwy?), nowy formularz (czy walidacja input?), zmiana w auth flow, dependency CVE critical.
- **Z kim współpracuje:** PO/TL (security architecture), Platform Engineer (secrets infra), Full-Stack (IsAdmin enforcement), DB Engineer (parametrized queries via Prisma — domyślnie OK, ale `$queryRaw` ostrożnie).
- **Pułapki:** każdy endpoint `/api/admin/*` MUSI mieć `auth()` guard + role check; uploadu MIME whitelist (nie blacklist); rozmiar limit; sanityzacja nazwy pliku (path traversal); sekrety w logach NIE; RODO: zawodnik ma prawo do usunięcia danych — zaplanować flow; rate limit na `/api/auth/*` i `/api/upload/*`.

## Pominięte role vs adminbob (nie mają zastosowania w tej skali)

- ❌ **Go Engineer** — brak agent/hub, full-stack Next.js wystarcza
- ❌ **ML/AI Engineer** — brak LLM w produkcie
- ❌ **DevRel** — zamknięty produkt, jedna liga
- ❌ **User Researcher** — znamy persony osobiście (zawodnicy + admini)
- ❌ **Technical Writer** — pokryte przez PO/TL (`PLAN.md`, `TODO.md`, `DEPLOY.md`)
- ❌ **Cloud Adapter Specialist** — jeden cloud (VPS)

**Do rozważenia w przyszłości:**
- ➕ **#13 Compliance / RODO Officer** — jeśli liga rośnie ponad 50 osób lub publikujemy więcej zdjęć / danych
- ➕ **#13 Test Data Steward** — utrzymanie i ekspansja danych historycznych (2023-2025 już są; 2026 w trakcie)

## Workflow — kto kiedy w cyklu dev

| Faza cyklu | Driver | Wspierający |
|---|---|---|
| 1. Hipoteza / problem | PO/TL | Production Operator (real usage feedback) |
| 2. Design / flow | Product Designer | PO/TL, Full-Stack (constraints) |
| 3. Schema / API decyzje | DB Engineer + Full-Stack | PO/TL, Security |
| 4. Rozpis slice'ów w `TODO.md` | PO/TL + EM | — |
| 5. Implementacja BE (API + Prisma) | Full-Stack | DB Engineer, Security |
| 6. Implementacja FE (RSC/Client) | Full-Stack | UX Designer (design QA), Design System |
| 7. Migracja / seed / importer | DB Engineer | Full-Stack |
| 8. Smoke / validate | QA Automation | wszyscy Engineers (testowalność) |
| 9. Exploratory test | Manual QA | UX Designer (UX validation) |
| 10. **12-person review** | wszyscy reviewers per `DOCS/REVIEW-TEAM.md` | PO/TL (escalation) |
| 11. Deploy (po explicit user approval) | Platform Engineer | SRE (handoff), Security (secrets) |
| 12. Smoke prod | Production Operator | Manual QA (parity check) |
| 13. Aktualizacja `TODO.md` | PO/TL + EM | — |
| 14. Retro | EM | wszyscy |

## Overlap z review team — kto z kim współpracuje

| Domena | Dev (robi) | Review (sprawdza) | Współpraca |
|---|---|---|---|
| Security | #12 Security Engineer | Review #3 Security Specialist | Engineer wdraża, Specialist gate'uje |
| Reliability | #11 Production Operator | Review #10 Production Operator persona | Live ops vs design-time review |
| Database | #4 DB Engineer | Review #9 Data / Prisma Engineer | Schema author vs migration reviewer |
| Design | #9 UX + #10 Design System | (brak osobnego reviewera UX — pokrywa #7 Performance+A11y + #10 Operator persona) | Designer projektuje, reviewerzy audytują flow + accessibility |
| Frontend | #3 Full-Stack | Review #4 Code Reviewer + #7 Perf+A11y | Impl vs konwencje + accessibility gate |
| Backend / API | #3 Full-Stack | Review #5 Integration Tester | Engineer ekstenduje API, reviewer sprawdza FE↔BE match |
| Match Play logika | #3 Full-Stack + PO/TL | Review #8 Match-Play Rules Specialist | Impl vs regulamin (DOCS/) |
| Polish UX text | #9 UX Designer | Review #11 Polish Localization Reviewer | Designer pisze copy, reviewer waliduje gramatykę + spójność |
| Docs | PO/TL | Review #12 Documentation Reviewer | Author vs walidacja step-by-step |

## Zasada zaangażowania

- **Każda iteracja ma jednego driver'a** (z tabeli workflow) + wspierających. Driver odpowiada za completion.
- **Brak driver'a = blocker** — EM eskaluje.
- **Hand-off explicit** — np. Designer → Full-Stack to nie „rzucenie Figmy", tylko kick-off z acceptance criteria + edge cases.
- **Maksimum 2 kapelusze na raz** w solo/AI workflow — przełączanie kosztuje kontekst. Sekwencjonujemy: najpierw PO/TL (decyzja), potem DB Engineer (schema), potem Full-Stack (impl).
- **Pre-implementation check** — przed dotknięciem kodu agent powinien zidentyfikować kto-by-to-robił i przyjąć tę perspektywę explicit („z perspektywy DB Engineer ta migracja powinna...").
- **Commit + push razem natychmiast** (per `feedback_workflow.md`) — driver odpowiada za zamknięcie pętli.
- **Deploy tylko po explicit user approval** (per `feedback_deploy.md`) — Platform Engineer nigdy sam nie pushuje na prod.

## Anti-patterns

- **„Solo dev does all"** — nawet w solo workflow rozróżniaj kapelusze; bez tego decyzje DB i UI lecą tym samym myśleniem co backend = niespójność.
- **PO/TL + EM w jednej osobie pisze kod bez retro** — wtedy nie ma kto eskalować blokady do siebie samego. W solo: świadomie przełączaj role + retro „co bym powiedział sobie z perspektywy EM".
- **Designer rzuca mockup do Full-Stack bez handoff** — bez acceptance criteria i edge case'ów Full-Stack wymyśla z głowy, design drift.
- **QA dopisany na końcu** — smoke / validate musi być częścią slice (DoD), nie post-factum „dorobimy".
- **Security Engineer reviewuje 100% PR** — to dla review team Specialist; Security Engineer fokus operacyjny (rotacja sekretów, audit, dependency CVE).
- **Brak ownera per moduł** — „każdy może" = nikt nie pilnuje konsystencji długoterminowej. Full-Stack to default owner UI, DB Engineer to default owner schema.
- **Deploy bez user approval** — łamanie procedury, ryzyko prod outage podczas weekendu turniejowego.
- **Zgadywanie configu** — `feedback_no_guess_config.md`: reuse istniejące lub pytaj, nigdy nie zgaduj wartości env.

## Pre-flight przed implementacją (jak agent zaczyna pracę)

1. **Identyfikacja rodzaju pracy:** feature / bug fix / refactor / migracja / docs / dane historyczne.
2. **Wybór driver'a + wspierających** z tabeli workflow.
3. **Przyjęcie perspektywy driver'a** — explicit w pierwszym kroku („pracując jako DB Engineer...").
4. **Sprawdzenie ownership** istniejącego kodu (kto by to robił → kogo zapytać o decyzje).
5. **Implementacja** w stylu driver'a (jego idiomy, pułapki, konwencje).
6. **12-person review** zgodnie z `DOCS/REVIEW-TEAM.md` — OBOWIĄZKOWE, NIE OPCJONALNE.
7. **Hand-off** do następnego driver'a (np. DB Engineer → Full-Stack → QA → Platform).
8. **Commit + push razem natychmiast** po PASS review.

## Powiązane dokumenty

- `DOCS/REVIEW-TEAM.md` — zespół sprawdzający (12 osób, gate przed merge — OBOWIĄZKOWY ZAWSZE).
- `PLAN.md` — pełna specyfikacja produktu (PO/TL source of truth).
- `TODO.md` — autorytatywna mapa iteracji + status.
- `DEPLOY.md` — Platform Engineer + Production Operator source of truth.
- `DOCS/Regulamin Rozgrywek Ligi Don Papa Match Play 2026.docx` — regulamin ligi (owner: PO/TL).
- `DOCS/historia-stats-progress.md` — progres importu sezonów historycznych.
- `prisma/schema.prisma` — DB Engineer source of truth.
- `scripts/historical-data/` — Test Data Steward area.

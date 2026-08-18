# Playoff 2026 — przekazanie do wdrożenia

**Dla:** osoby z dostępem do produkcji
**Commit do wdrożenia:** `21a4239` (na `main`)
**Deadline Rundy 1 playoff:** 06.09.2026 (Regulamin §IV.2)

## O co chodzi w dwóch zdaniach

Funkcja wyznaczająca rozstawienie playoff liczyła je źle — sortowała po punktach zamiast po hierarchii grup. Poprawka jest na `main`, ale produkcja chodzi na starym obrazie, więc przycisk „Zatwierdź i utwórz mecze" w `/admin/playoff` nadal utworzyłby **złe pary**.

## ⛔ NAJPIERW: zamknij fazę grupową

Trzy mecze Rundy 4 nie zostały rozegrane w terminie (termin minął 16.08.2026):

| Grupa | Mecz |
|---|---|
| 5 | Roman Staś 🆚 Wojciech Stefanik |
| 10 | Marek Turski 🆚 Grzegorz Czudaj |
| 10 | Grzegorz Czudaj 🆚 Maciej Plewka |

**Decyzja Zarządu Ligi (18.08.2026): spisane jako nierozegrane.** Zgodnie z Regulaminem §III.2 — *„Nierozegrany mecz: 0 pkt dla obu graczy"*. Nie trzeba nic zmieniać w bazie: `computeStandings` pomija mecze bez wyniku (`if (!match.played) continue`), więc tabele są już policzone prawidłowo. Rozstawienie odpowiada tabelom widocznym dziś na `/grupy`.

### Wymagany krok: Runda 4 → COMPLETED

Zanim utworzysz playoff, ustaw Rundę 4 na **COMPLETED** w `/admin/sezon/[id]`.

Po co: to formalnie zamyka fazę grupową i blokuje wprowadzanie wyników (API zwraca 403 na próbę zapisu). Dopóki runda ma status `ACTIVE`, ktoś mógłby jeszcze wpisać wynik zaległego meczu i przesunąć rozstawienie już po utworzeniu drabinek.

Skrypt CLI wymusza to wprost — przy statusie `ACTIVE` i meczach bez wyniku odmawia zapisu i wypisuje instrukcję. Panel admina takiej walidacji nie ma, więc **ustaw COMPLETED ręcznie przed kliknięciem przycisku**.

Sam deploy kodu można zrobić w dowolnym momencie — jest bezpieczny i niezależny od tego kroku.

## Co zmienia commit `21a4239`

Reguła rozstawienia to **projekcja systemu awansów i spadków o jedną rundę w przód**: pozycje 1–2 w grupie awansują wyżej, 3 zostaje, 4–5 spadają niżej. Kolejność seedów odpowiada składowi hipotetycznych grup kolejnej rundy, a w obrębie każdej: spadkowicze z góry → ten kto został → awansujący z dołu.

Stara implementacja sortowała `pozycja w grupie → duże punkty → małe punkty → HCP`. Skutek: Robert Warnecki, który wygrał Grupę 9 z najlepszym bilansem w całej lidze (12 pkt, +25 małych), wychodził jako **seed 1**, a powinien być **39** — Grupa 9 leży w strefie trzeciej drabinki.

Pliki:

| Plik | Co się zmieniło |
|---|---|
| `src/lib/playoff.ts` | Nowa czysta funkcja `buildPlayoffSeedOrder` + przepisane `computeGlobalRanking` |
| `src/__tests__/playoff-seeding.test.ts` | 13 nowych testów — blokują wszystkie 48 seedów i 24 pary R1 |
| `scripts/seed-playoff-2026.ts` | Korzysta ze wspólnej funkcji; ma cross-check i 9 walidacji wstępnych |
| `DOCS/playoff-2026-seeding.md` | Opis reguły z tabelą, mapa kodu, warunki wstępne |
| `DEPLOY.md` | Notka o kluczu SSH + diagnostyka portu 22 |
| `TODO.md` | Status i blocker |

Migracja bazy **nie jest potrzebna** — schema bez zmian.

Stan przed wypchnięciem: `npm test` 52/52 zielone, `npx tsc --noEmit` czysty, `npx eslint` czysty, `npx next build` przechodzi.

## Deploy

Standardowa procedura z [DEPLOY.md](../DEPLOY.md) — obraz budujemy lokalnie, bo serwer ma za mało RAM. Nic niestandardowego, żadnych migracji ani zmian w `.env`.

```bash
git checkout main && git pull    # powinno dać 21a4239 lub nowszy
npm ci
npm test                          # kontrola: 52/52
```

Dalej wg DEPLOY.md (build obrazu → `docker save` → `scp` → `docker load` → `docker compose up -d`).

### ⚠️ Uwaga o dostępie SSH

Klucz `.ssh/karolinkagolfpark` jest w `.gitignore`, więc **nie przychodzi ze świeżym klonem** — musisz mieć własną kopię.

Stan sprawdzony 18.08.2026 z sieci Orange Polska: porty **80 i 443 otwarte, port 22 filtrowany** (timeout, nie „connection refused" — czyli firewall dropuje pakiety). Jeśli u Ciebie SSH działa, po prostu wdrażaj. Jeśli też dostajesz timeout — diagnostyka jest w [DEPLOY.md](../DEPLOY.md), sekcja o porcie 22.

## Weryfikacja po deployu — konkretny test

Wejdź na `/admin/playoff`. Zobaczysz nagłówek **„Podgląd rozstawienia"** i trzy karty drabinek. Sprawdź dwie pozycje:

| Seed | Powinien być | Jeśli widzisz co innego |
|---|---|---|
| **1** | Kacper Glinka | ⛔ stary kod — deploy nie wszedł |
| **39** | Robert Warnecki | ⛔ jeśli Warnecki jest na 1, stary kod nadal działa |

To jednoznaczny test — te dwie pozycje różnią się między starą i nową logiką.

Pierwsza drabinka (miejsca 1–16), górna połowa, powinna wyglądać tak:

```
M1   1. Kacper Glinka        vs  16. Artur Kiowski
M2   8. Jakub Michalak       vs   9. Fabio Szic
M3   4. Michał Łowiński      vs  13. Maciej Ślusarczyk
M4   5. Tomek Śleziak        vs  12. Grzegorz Ptak
```

Pełna lista wszystkich 24 par jest w testach (`src/__tests__/playoff-seeding.test.ts`) oraz w [DOCS/playoff-2026-seeding.md](playoff-2026-seeding.md).

## Utworzenie playoff

Kolejność ma znaczenie:

1. **Runda 4 → COMPLETED** w `/admin/sezon/[id]` (patrz sekcja na początku — zamyka fazę grupową)
2. Deploy i weryfikacja jak wyżej (seed 1 = Glinka, seed 39 = Warnecki)
3. `/admin/playoff` → sprawdź pary → **„Zatwierdź i utwórz mecze"**
4. Zweryfikuj wynik na `/playoff`

Powstanie jedna runda `PLAYOFF` (roundNumber 99), 3 grupy-drabinki, 48 przypisań zawodników i 24 mecze pierwszej rundy. Kolejne rundy tworzą się automatycznie (`autoAdvancePlayoff`) po wprowadzaniu wyników — dla zwycięzców i przegranych, bo nikt nie odpada.

Alternatywnie skrypt CLI (`scripts/seed-playoff-2026.ts --dry-run`, potem bez flagi) — daje pełny podgląd i cross-check z zatwierdzoną macierzą, ale wymaga SSH. Panel wystarcza.

## Rzecz do zrobienia przed 31.10.2026 (finały)

Osobny, wcześniej znany problem — nie blokuje wdrożenia, ale ma termin.

`GroupPlayer.finalPosition` w grupach playoff przechowuje **seed** (1–48), nie końcową lokatę. Po rozegraniu drabinek statystyki kariery i Galeria Sław pokażą seedy zamiast wyników: zawodnik, który wygra playoff jako seed 5, dostanie „Najlepsza pozycja: 5" zamiast „1".

Potrzebny endpoint typu `finalize`, który po zamknięciu drabinek przepisze `finalPosition` na faktyczne miejsca. Pułapka przy implementacji: `buildBracketSlots` czyta to samo pole jako seed do wyświetlenia drabinki, więc nadpisanie bez zmiany widoku zepsuje wyświetlanie. Opis w [TODO.md](../TODO.md), sekcja „Odłożone — latent issues", punkt 1.

## Kontekst uzupełniający

- Reguła rozstawienia w szczegółach: [DOCS/playoff-2026-seeding.md](playoff-2026-seeding.md)
- Regulamin ligi (§IV — playoff): `DOCS/Regulamin Rozgrywek Ligi Don Papa Match Play 2026.docx`
- Repo leży na OneDrive, który ustawia bit `+x` na plikach. Jeśli `git status` pokazuje setki zmienionych plików, sprawdź `git -c core.fileMode=false diff --stat` — prawdopodobnie zero zmian treści. Fix: `git config core.fileMode false`

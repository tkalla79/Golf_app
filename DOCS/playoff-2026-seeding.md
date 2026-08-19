# Playoff 2026 — seeding i rozstawienie

**Zatwierdzone:** 18 sierpnia 2026 przez Zarząd Ligi  •  **Deadline Rundy 1:** 06.09.2026 (Regulamin §IV.2)  •  **Ostatnia aktualizacja:** 2026-08-19

## Kontekst

Po fazie zasadniczej (Runda 4, **10 grup × 5 zawodników = 50**) rozstawiamy 48 zawodników do 3 drabinek playoff. Dwóch ostatnich z najsłabszej grupy nie awansuje.

| Drabinka | Dołki | Nazwa w systemie |
|---|---|---|
| 1–16 | 18 | Pierwsza Liga Playoff |
| 17–32 | 18 | Druga Liga Playoff |
| 33–48 | 9 lub 18 — uzgodnienie graczy przed meczem | Trzecia Liga Playoff |

> **Ustalenie Zarządu Ligi z 19.08.2026.** Regulamin (`DOCS/Regulamin … 2026.docx`, §I.1 i §IV.1) został zaktualizowany pod to ustalenie tego samego dnia — wcześniej mówił „17–32: 9 lub 18 do wyboru graczy" i „33–48: 9 dołków". Dokument i kod są zgodne.

Domyślne długości są w `BRACKET_HOLES`, dopuszczalne warianty w `BRACKET_HOLES_OPTIONS` ([src/lib/playoff.ts](../src/lib/playoff.ts)) — zablokowane testami. Dla Trzeciej Ligi panel wyników pokazuje przełącznik **9 / 18 dołków**; zmiana przestawia zestaw kodów wyniku, bo 18 dołków dopuszcza dodatkowo `6&5`…`10&8`. Wybór zapisuje się na `Match.holes`, więc jest per mecz, nie per drabinka.

Pairing Rundy 1 w każdej drabince (Regulamin §IV.1): `1v16 | 8v9 | 4v13 | 5v12` (górna połowa) oraz `2v15 | 7v10 | 3v14 | 6v11` (dolna). Dla drabinek 2 i 3 te same wzory przesunięte o 16 i 32.

Każda drabinka to 4 rundy × 8 meczów = 32 mecze. Każdy zawodnik gra dokładnie 4 mecze i kończy z definitywnym miejscem — przegrani spadają do drabinek o niższe lokaty, nikt nie odpada. Mapa przepływu jest w `MATCH_FEEDS` ([src/lib/playoff.ts](../src/lib/playoff.ts)), a `autoAdvancePlayoff` tworzy mecze kolejnej rundy automatycznie po zapisaniu wyniku.

## Reguła rozstawienia

Kolejność seedów to **projekcja systemu awansów i spadków o jedną rundę w przód**.

Reguła awansów/spadków z fazy grupowej (`generatePromotionRelegation` w [src/lib/group-generator.ts](../src/lib/group-generator.ts)): pozycje 1–2 awansują o grupę wyżej, pozycja 3 zostaje, pozycje 4–5 spadają o grupę niżej. Gdyby po Rundzie 4 rozegrać jeszcze jedną rundę, grupy wyglądałyby tak — i to wyznacza seedy:

| Wirtualna grupa | Skład (w kolejności) | Seedy |
|---|---|---|
| 1 | G1p1, G1p2, G1p3, **G2p1, G2p2** | 1–5 |
| 2 | **G1p4, G1p5**, G2p3, **G3p1, G3p2** | 6–10 |
| 3 | **G2p4, G2p5**, G3p3, **G4p1, G4p2** | 11–15 |
| 4 | **G3p4, G3p5**, G4p3, **G5p1, G5p2** | 16–20 |
| … | … | … |
| 10 | **G9p4, G9p5**, G10p3, *(G10p4, G10p5)* | 46–48, *49–50* |

Kolejność wewnątrz wirtualnej grupy: **spadkowicze z góry → ten kto został → awansujący z dołu**.

Konsekwencje, które mogą zaskoczyć:

- **Zwycięzca słabszej grupy nie przeskakuje hierarchii.** Robert Warnecki wygrał Grupę 9 z najlepszym bilansem w całej lidze (12 pkt, +25 małych) i ma seed **39**, bo Grupa 9 leży w strefie trzeciej drabinki.
- **4. i 5. miejsce Grupy 1 (seedy 6, 7) są wyżej niż 3. miejsce Grupy 2 (seed 8)** — ale niżej niż 1–2 miejsce Grupy 2 (seedy 4, 5).

Ta sama macierz zapisana per grupa i pozycja:

|          | pos1 | pos2 | pos3 | pos4 | pos5 |
|----------|------|------|------|------|------|
| Grupa 1  |   1  |   2  |   3  |   6  |   7  |
| Grupa 2  |   4  |   5  |   8  |  11  |  12  |
| Grupa 3  |   9  |  10  |  13  |  16  |  17  |
| Grupa 4  |  14  |  15  |  18  |  21  |  22  |
| Grupa 5  |  19  |  20  |  23  |  26  |  27  |
| Grupa 6  |  24  |  25  |  28  |  31  |  32  |
| Grupa 7  |  29  |  30  |  33  |  36  |  37  |
| Grupa 8  |  34  |  35  |  38  |  41  |  42  |
| Grupa 9  |  39  |  40  |  43  |  46  |  47  |
| Grupa 10 |  44  |  45  |  48  |  ×   |  ×   |

## Gdzie to jest w kodzie

| Element | Miejsce |
|---|---|
| Algorytm kolejności | `buildPlayoffSeedOrder` w [src/lib/playoff.ts](../src/lib/playoff.ts) — funkcja czysta, bez bazy |
| Ranking z bazy | `computeGlobalRanking` w tym samym pliku — liczy tabele grup i podaje je do `buildPlayoffSeedOrder` |
| Kontrakt (testy) | [src/__tests__/playoff-seeding.test.ts](../src/__tests__/playoff-seeding.test.ts) — asertuje wszystkie 48 seedów i 24 pary R1 |
| Panel admina | `/admin/playoff` → przycisk „Utwórz playoff" (API [create/route.ts](../src/app/api/admin/playoff/create/route.ts)) |
| Skrypt CLI | [scripts/seed-playoff-2026.ts](../scripts/seed-playoff-2026.ts) |

**Panel i skrypt używają tej samej funkcji**, więc dają identyczne pary. Testy blokują kolejność — jeśli ktoś zmieni logikę seedowania, `npm test` padnie.

> **Historyczne:** do 18.08.2026 `computeGlobalRanking` sortowało przez duże punkty → małe punkty → HCP, co dawało inny ranking (Warnecki wychodził #1 zamiast #39). Panel admina tworzył wtedy złe pary. Naprawione — panelu można używać normalnie.

## Warunki, które muszą być spełnione przed seedingiem

Skrypt sprawdza je wszystkie i odmawia zapisu, jeśli którykolwiek nie jest spełniony:

1. Sezon 2026 ze statusem `ACTIVE`
2. Ostatnia runda `ROUND_ROBIN` ma `roundNumber === 4` i status `COMPLETED` lub `ACTIVE`
3. **Wyniki kompletne albo faza grupowa formalnie zamknięta.** Mecze bez wyniku same z siebie nie są błędem — Regulamin §III.2 mówi *„Nierozegrany mecz: 0 pkt dla obu graczy"*, a `computeStandings` je pomija, więc tabele są policzone poprawnie. Ryzyko jest inne: przy rundzie `ACTIVE` wynik może jeszcze dojść i przesunąć seedy **po** utworzeniu drabinek. Dlatego mecze bez wyniku są dopuszczalne tylko przy statusie rundy `COMPLETED` (co blokuje też zapis wyników — API 403). Sezon 2026: trzy zaległe mecze spisane jako nierozegrane decyzją Zarządu z 18.08.2026, więc Rundę 4 należy ustawić na `COMPLETED` przed seedingiem
4. Dokładnie 10 grup, `sortOrder` unikalny (wyznacza hierarchię: sortOrder 0 = Grupa 1 = najsilniejsza)
5. Każda grupa ma 5 zawodników
6. `computeGlobalRanking` zwraca 50 zawodników, z tego 48 z seedami 1–48
7. **Cross-check:** ranking z funkcji zgadza się z zatwierdzoną macierzą `RANK_MATRIX` w skrypcie (50/50 pozycji)
8. Nie istnieje jeszcze runda `PLAYOFF` w sezonie (chyba że `--force`)
9. Powtórzony test punktu 8 wewnątrz transakcji — chroni przed race condition z panelem admina

## Metoda A — panel admina (najprostsza, bez SSH)

1. Ustaw ostatnią rundę fazy grupowej na **COMPLETED** w `/admin/sezon/[id]` (punkt 3 warunków wyżej)
2. Zaloguj się na https://donpapagolf.pl/admin
3. Wejdź na `/admin/playoff` — nagłówek **„Podgląd rozstawienia"**
4. Sprawdź wyświetlony podział na drabinki — powinien odpowiadać macierzy powyżej
5. Na dole strony (pod trzema kartami, 24 wiersze meczów): **„Zatwierdź i utwórz mecze"**
6. Zweryfikuj pary na `/playoff`

Panel po naprawie z 18.08.2026 używa poprawnej reguły, więc nie trzeba niczego nadpisywać. Od 19.08.2026 panel **waliduje też status rundy** — przy meczach bez wyniku i rundzie `ACTIVE` odmawia utworzenia drabinek (HTTP 400) i wypisuje listę zaległych meczów. Nadal nie robi cross-checku z macierzą — to ma tylko skrypt CLI.

## Metoda B — skrypt CLI (wymaga SSH)

Daje pełny podgląd rankingu i par przed zapisem oraz cross-check z zatwierdzoną macierzą.

> **Uwaga na obraz.** Serwis `app` to stage `runner` z `Dockerfile` (Next standalone) — nie ma w nim `scripts/`, `src/` ani `tsx`. Skrypt odpalamy w serwisie `migrate` (stage `builder`, pełne źródła + devDependencies). Obrazy budujemy **lokalnie** i wgrywamy przez `docker save`/`scp` — serwer ma za mało RAM, więc żadnego `--build` na produkcji ([DEPLOY.md](../DEPLOY.md)).

```bash
# Najpierw lokalnie: build + save + scp + load wg DEPLOY.md (dotyczy obu obrazów,
# także donpapa-migrate:latest — bez niego serwis `migrate` chodzi na starym kodzie)

ssh donpapa                     # patrz DEPLOY.md — konfiguracja klucza i diagnostyka portu 22
cd /root/Golf_app && git pull --ff-only

# Podgląd — wypisuje ranking 1-48 i 24 pary, nic nie zapisuje:
docker compose --env-file .env run --rm migrate \
  npx tsx scripts/seed-playoff-2026.ts --dry-run

# Zapis po weryfikacji outputu:
docker compose --env-file .env run --rm migrate \
  npx tsx scripts/seed-playoff-2026.ts
```

Flaga `--force` usuwa istniejącą rundę playoff i tworzy ją od nowa. Kasuje **wszystkie mecze playoff** (cascade delete) — nie używać, gdy są już rozegrane wyniki.

## ⚠️ Do zrobienia przed końcem playoff (31.10.2026)

`finalPosition` na `GroupPlayer` w grupach playoff przechowuje **seed** (1–48), nie końcowe miejsce. Po zakończeniu drabinek statystyki kariery i Galeria Sław pokażą seedy zamiast wyników — gracz, który wygra playoff jako seed #5, będzie miał „Najlepsza pozycja: 5".

Szczegóły i plan naprawy: TODO.md, sekcja *„Odłożone — latent issues"*, punkt 1. Potrzebny endpoint `finalize`, który po zamknięciu drabinek przepisze `finalPosition` na faktyczne lokaty. Uwaga przy implementacji: `buildBracketSlots` czyta to samo pole jako seed do wyświetlenia drabinki ([playoff.ts](../src/lib/playoff.ts)), więc nie można go po prostu nadpisać bez zmiany widoku.

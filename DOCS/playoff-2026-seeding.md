# Playoff 2026 — seeding, skrypt, instrukcja manualna

**Data:** 2026-08-18  •  **Status:** przygotowane, gotowe do deployu na produkcji

## Kontekst

Faza zasadnicza sezonu 2026 się zakończyła. Wynik: 10 grup po 5 zawodników (Runda 4).
Trzeba rozstawić 48 z 50 zawodników do 3 drabinek playoff (`1-16`, `17-32`, `33-48`).

Regulamin §IV mówi:
- Drabinka 1-16: 18 dołków, "Pierwsza Liga Playoff"
- Drabinka 17-32: 9 lub 18 dołków (uzgodnienie graczy), "Druga Liga Playoff"
- Drabinka 33-48: 9 dołków, "Trzecia Liga Playoff"
- Pairing R1 w każdej drabince: `1v16 | 8v9 | 4v13 | 5v12 | 2v15 | 7v10 | 3v14 | 6v11` (te same seedy przesunięte o 16 dla drabinek 2 i 3)
- Deadline R1: **06.09.2026**

## ⚠️ Ranking Tomka vs `computeGlobalRanking`

**Uwaga krytyczna:** funkcja `computeGlobalRanking` w [src/lib/playoff.ts](src/lib/playoff.ts:190) sortuje ranking przez `positionInGroup → BP desc → SP desc → HCP desc`. To daje INNY ranking niż uzgodniony z Tomkiem.

Przykład: Robert Warnecki miał 12 BP i +25 SP w Grupie 9. Wg `computeGlobalRanking` byłby **#1**. Wg rankingu Tomka jest **#39** (bo wygrał Grupę 9, a Grupa 9 to strefa 3. drabinki).

**Ranking Tomka** opiera się na **hierarchii grup Runda 4** (G1 = najsilniejsza, G10 = najsłabsza) z interleavingiem między sąsiednimi grupami:

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

Wzór interleavingu:
- G1 pos 1-3 → seeds 1-3 (start)
- dla każdej pary (Gn, Gn+1):
  - G(n+1) pos 1,2 wchodzą MIĘDZY pos 3 a pos 4,5 Gn
  - Potem G(n) pos 4,5
  - Potem G(n+1) pos 3
- G10 pos 4,5 → poza playoff (2 z 50)

**Konsekwencja:** ⚠️ **NIE naciskaj przycisku "Utwórz playoff"** w panelu `/admin/playoff` — użyje `computeGlobalRanking` i utworzy ZŁE pary. Użyj skryptu poniżej.

## Metoda A — Skrypt na produkcji (rekomendowana)

Skrypt: [scripts/seed-playoff-2026.ts](../scripts/seed-playoff-2026.ts). Hardcoded ma `RANK_MATRIX` (macierz powyżej), więc nie polega na `computeGlobalRanking`. Czyta ostatnią rundę ROUND_ROBIN z bazy i mapuje `(groupIndex, positionInGroup) → seed 1-48`.

### Kroki

```bash
# 1) SSH na serwer
ssh -i .ssh/karolinkagolfpark root@209.38.211.80
cd /root/Golf_app

# 2) Pull kodu (skrypt + docs + TODO w tym commicie)
git pull

# 3) Rebuild obrazu (żeby kontener miał nowy plik seed-playoff-2026.ts)
docker compose --env-file .env up -d --build app

# 4) DRY-RUN — wypisze ranking 1-48 i 24 pary, nic nie zapisze
docker compose --env-file .env run --rm app \
  npx tsx scripts/seed-playoff-2026.ts --dry-run

# 5) Zweryfikuj wypisany ranking z zawodnikami (imiona muszą się zgadzać)
#    Sprawdź czy 24 pary są takie jak w tym docsie

# 6) REALNY zapis (utworzy 1 rundę PLAYOFF + 3 grupy + 48 GroupPlayer + 24 Match)
docker compose --env-file .env run --rm app \
  npx tsx scripts/seed-playoff-2026.ts
```

Po realnym zapisie sprawdź w przeglądarce:
- https://donpapagolf.pl/playoff — widok publiczny
- https://donpapagolf.pl/admin/playoff — widok admina (wymaga logowania)

### Awaryjnie: nadpisanie istniejącej rundy playoff

Jeśli utworzyłeś playoff wcześniej (np. przypadkowo w panelu przez `computeGlobalRanking`), skasuj i uruchom seed od nowa:

```bash
docker compose --env-file .env run --rm app \
  npx tsx scripts/seed-playoff-2026.ts --force
```

⚠️ `--force` **kasuje istniejącą rundę PLAYOFF** wraz ze wszystkimi grupami i meczami (cascade delete). Nie używaj jeśli są już rozegrane mecze!

## Metoda B — Manualne wprowadzenie przez API (backup)

Jeśli skrypt nie działa (np. z powodów sieciowych albo problemów z tsx), można wywołać istniejące API `/api/admin/playoff/create` z `overrides` (mapa `rank → playerId`). Każdy override "przesuwa" gracza na docelową pozycję poprzez swap w rankingu.

⚠️ Wymaga zalogowania jako admin i znalezienia `playerId` każdego z 48 zawodników w bazie (`SELECT id, first_name, last_name FROM players WHERE active=1 AND is_historical=0`).

Kroki:

1. Zaloguj się do `/admin` (codelabs / hardbeans / k2biznes)
2. Otwórz DevTools → Console w przeglądarce, mając otwarte `/admin/playoff`
3. Skopiuj `playerId` dla każdego z 48 zawodników z tabeli `players`
4. Odpal w Console:

```javascript
const overrides = {
  1: /* Kacper Glinka playerId */,
  2: /* Sebastian Szot playerId */,
  3: /* Remigiusz Wiśniewski playerId */,
  4: /* Michał Łowiński playerId */,
  5: /* Tomek Śleziak playerId */,
  6: /* Janusz Zieliński playerId */,
  7: /* Jerzy Górski playerId */,
  8: /* Jakub Michalak playerId */,
  9: /* Fabio Szic playerId */,
  10: /* Dominik Weidinger playerId */,
  11: /* Krzysztof Łukasiuk playerId */,
  12: /* Grzegorz Ptak playerId */,
  13: /* Maciej Ślusarczyk playerId */,
  14: /* Maciej Skucik playerId */,
  15: /* Krzysztof Wingert playerId */,
  16: /* Artur Kiowski playerId */,
  17: /* Marek Klyk playerId */,
  18: /* Wojciech Szwedowski playerId */,
  19: /* Jakub Krok playerId */,
  20: /* Zbigniew Marciniak playerId */,
  21: /* Jacek Wróbel playerId */,
  22: /* Paweł Ślusarczyk playerId */,
  23: /* Jacek Stadnicki playerId */,
  24: /* Wojciech Stelmach playerId */,
  25: /* Sylwester Sienkiewicz playerId */,
  26: /* Wojciech Stefanik playerId */,
  27: /* Roman Staś playerId */,
  28: /* Grzegorz Możdżonek playerId */,
  29: /* Radosław Grek playerId */,
  30: /* Rafał Stolarczyk playerId */,
  31: /* Marcin Kucia playerId */,
  32: /* Ryszard Michalewski playerId */,
  33: /* Krzysztof Kozłowski playerId */,
  34: /* Tomasz Len playerId */,
  35: /* Łukasz Cieplik playerId */,
  36: /* Mirosław Domagała playerId */,
  37: /* Mateusz Tymich playerId */,
  38: /* Ludwik Kownacki playerId */,
  39: /* Robert Warnecki playerId */,
  40: /* Aleksander Sitko playerId */,
  41: /* Mariusz Boruszek playerId */,
  42: /* Łukasz Lachowski playerId */,
  43: /* Tomasz Tarkowski playerId */,
  44: /* Marcin Szemainda playerId */,
  45: /* Marek Turski playerId */,
  46: /* Bartłomiej Czarnotta playerId */,
  47: /* Piotr Glinka playerId */,
  48: /* Grzegorz Czudaj playerId */,
}

const seasonRes = await fetch('/api/seasons/current')
const season = await seasonRes.json()

const res = await fetch('/api/admin/playoff/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ seasonId: season.id, overrides }),
})
console.log(await res.json())
```

To wywoła istniejące API, które (a) pobiera ranking z `computeGlobalRanking`, (b) wykonuje 48 swapów aby ustawić Twoich zawodników na docelowych pozycjach, (c) tworzy rundę + 3 grupy + 24 mecze R1.

## Referencje

- Regulamin ligi 2026 (§IV): [DOCS/Regulamin Rozgrywek Ligi Don Papa Match Play 2026.docx](Regulamin%20Rozgrywek%20Ligi%20Don%20Papa%20Match%20Play%202026.docx)
- Kod playoff: [src/lib/playoff.ts](../src/lib/playoff.ts) — `BRACKET_SEEDS`, `MATCH_FEEDS`, `autoAdvancePlayoff`, `computeGlobalRanking`
- Admin panel: [src/app/admin/playoff/page.tsx](../src/app/admin/playoff/page.tsx)
- API create: [src/app/api/admin/playoff/create/route.ts](../src/app/api/admin/playoff/create/route.ts)

## Do rozważenia po sezonie 2026

`computeGlobalRanking` produkuje INNY ranking niż Tomek faktycznie stosuje. To potencjalna **luka techniczna** w kodzie — jeśli w Ligi 2027+ format seedingu zostanie ten sam (hierarchia grup + interleaving), warto przepisać `computeGlobalRanking` na tę logikę, żeby panel `/admin/playoff` "z automatu" produkował poprawne pary. Wtedy ten skrypt seedowy stanie się zbędny.

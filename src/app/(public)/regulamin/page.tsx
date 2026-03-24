import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Regulamin — Don Papa Match Play 2026',
  description: 'Regulamin Rozgrywek Ligi Don Papa Match Play 2026 — zasady gry, punktacja, play-off, terminy.',
}

export const dynamic = 'force-dynamic'

export default function RegulaminPage() {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-4xl font-bold text-[var(--color-primary)]" style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}>
          Regulamin
        </h1>
        <div className="flex items-center gap-3 mt-3">
          <span className="inline-block w-12 h-0.5 bg-[var(--color-accent)]"></span>
          <p className="text-[var(--color-text-body)]">
            Rozgrywki Ligi Don Papa Match Play 2026
          </p>
        </div>
      </div>

      <div className="card p-6 sm:p-10 space-y-10 text-[var(--color-text-body)] leading-relaxed">

        {/* I. Postanowienia ogólne */}
        <section>
          <h2 className="regulamin-h2">I. Postanowienia ogólne</h2>

          <h3 className="regulamin-h3">1. Miejsce i forma rozgrywek</h3>
          <ul className="regulamin-list">
            <li>Mecze ligowe rozgrywane są na polu <strong>KGP</strong> (Karolinka Golf Park).</li>
            <li><strong>Runda grupowa:</strong> 9 dołków.</li>
            <li><strong>Faza PLAY-OFF:</strong>
              <ul className="regulamin-sublist">
                <li>Drabinka 1–16: <strong>18 dołków</strong></li>
                <li>Drabinka 17–32: <strong>9 lub 18 dołków</strong> (do wyboru graczy po wzajemnym uzgodnieniu)</li>
                <li>Drabinka 33–48: <strong>9 dołków</strong></li>
              </ul>
            </li>
            <li>Format: <strong>Match play brutto</strong> zgodnie z regułami R&amp;A Rules Limited oraz regulaminem lokalnym pola KGP.</li>
            <li>Wybór 9-dołkowej sekcji pola należy do graczy. W przypadku braku porozumienia obowiązuje losowanie.</li>
          </ul>

          <h3 className="regulamin-h3">2. Obowiązki finansowe</h3>
          <ul className="regulamin-list">
            <li>Gracze bez wykupionego prawa do gry na polu KGP pokrywają koszt green fee we własnym zakresie przed rozpoczęciem meczu.</li>
            <li>Wpisowe za udział w lidze: <strong>400 PLN</strong> (termin płatności: 15 kwietnia 2026).</li>
          </ul>
        </section>

        {/* II. Struktura turnieju */}
        <section>
          <h2 className="regulamin-h2">II. Struktura turnieju</h2>

          <h3 className="regulamin-h3">1. Etapy rozgrywek</h3>
          <div className="overflow-x-auto">
            <table className="regulamin-table">
              <thead>
                <tr>
                  <th>Etap</th>
                  <th>Termin</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Runda wstępna (formująca)</td><td>22 marca – 24 maja 2026</td></tr>
                <tr><td>Runda 2</td><td>25 maja – 21 czerwca 2026</td></tr>
                <tr><td>Runda 3</td><td>22 czerwca – 19 lipca 2026</td></tr>
                <tr><td>Runda 4</td><td>20 lipca – 16 sierpnia 2026</td></tr>
                <tr><td>Faza PLAY-OFF</td><td>17 sierpnia – 31 października 2026</td></tr>
                <tr><td className="font-semibold">Finał</td><td>Sobota/niedziela, druga połowa października 2026</td></tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm text-[var(--color-text-body)]/60 mt-3 italic">
            Zalecane jednoczesne rozegranie meczów o miejsca 1–4.
          </p>

          <h3 className="regulamin-h3">2. Podział grup</h3>
          <ul className="regulamin-list">
            <li><strong>Runda wstępna:</strong> Gracze podzieleni na 5 grup na podstawie wyników Ligi 2025. Podziału dokonuje Zarząd Ligi. Nowi uczestnicy dolosowywani na końcu, z pierwszeństwem dla niższego aktywnego HCP (stan na 15 marca 2026). Gracze bez HCP w systemie Eagle otrzymują HCP&nbsp;=&nbsp;0.</li>
            <li><strong>Limit zawodników:</strong> 50.</li>
            <li><strong>Po rundzie wstępnej</strong> tworzone są grupy:
              <ul className="regulamin-sublist">
                <li>Grupa A: zwycięzcy grup</li>
                <li>Grupa B: gracze z miejsc 2.</li>
                <li>Grupa C: gracze z miejsc 3.</li>
                <li>Grupa D: gracze z miejsc 4.</li>
                <li>I kolejne, aż do ostatniej grupy.</li>
              </ul>
            </li>
            <li>Liczebność ostatnich grup zależna od liczby uczestników Ligi.</li>
            <li>W kolejnych rundach grupowych obowiązują zasady awansów i spadków według reguł stosowanych w poprzednim sezonie.</li>
            <li>Rozstawienie w drabinkach PLAY-OFF ustala Organizator na podstawie wyników fazy grupowej.</li>
          </ul>
        </section>

        {/* III. Zasady gry */}
        <section>
          <h2 className="regulamin-h2">III. Zasady gry i zgłaszania wyników</h2>

          <h3 className="regulamin-h3">1. System rozgrywek</h3>
          <p className="mb-4">W grupach obowiązuje system <strong>„każdy z każdym"</strong>.</p>

          <h3 className="regulamin-h3">2. Punktacja</h3>
          <div className="overflow-x-auto">
            <table className="regulamin-table">
              <thead>
                <tr>
                  <th>Wynik meczu</th>
                  <th className="text-center">Punkty</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Wygrana</td><td className="text-center font-bold text-[var(--color-success)]">3 pkt</td></tr>
                <tr><td>Remis</td><td className="text-center font-bold text-[var(--color-warning)]">2 pkt (każdy gracz)</td></tr>
                <tr><td>Porażka</td><td className="text-center font-bold">1 pkt</td></tr>
                <tr><td>Nierozegrany mecz</td><td className="text-center text-[var(--color-text-body)]/50">0 pkt (obaj gracze)</td></tr>
                <tr><td>Walkower</td><td className="text-center">zwycięzca: <strong>3 pkt</strong>, przegrany: <strong>0 pkt</strong></td></tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4">W fazie grupowej dodatkowo przyznawane są <strong>„małe punkty"</strong> (patrz niżej).</p>

          <h3 className="regulamin-h3">3. Zgłaszanie wyników</h3>
          <ul className="regulamin-list">
            <li>Wynik zgłasza zwycięzca na grupie WhatsApp „Don Papa MP 2026" w ciągu <strong>24 godzin</strong> od zakończenia meczu.</li>
            <li>W przypadku remisu gracze wspólnie zgłaszają wynik lub wskazują osobę odpowiedzialną za zgłoszenie.</li>
          </ul>

          <h3 className="regulamin-h3">4. Rozstrzyganie remisów w grupach</h3>
          <p className="mb-3">Kolejność w grupie ustalana jest według:</p>
          <ol className="regulamin-ordered">
            <li><strong>Wynik bezpośredniego meczu</strong> (dla 2 graczy).</li>
            <li><strong>„Mała tabelka"</strong> — przy większej liczbie remisujących, uwzględniająca tylko mecze pomiędzy nimi.</li>
            <li><strong>„Małe punkty"</strong> — sumujące wyniki rozegranych meczów gracza wg poniższej tabeli.</li>
            <li><strong>Aktywny HCP</strong> z dnia rozpoczęcia rundy — gracz z wyższym HCP zajmuje wyższe miejsce.</li>
            <li><strong>Losowanie</strong> przeprowadzone przez Zarząd Ligi (jeśli powyższe nie rozstrzyga).</li>
          </ol>

          <h4 className="regulamin-h4">Tabela małych punktów</h4>
          <div className="overflow-x-auto">
            <table className="regulamin-table">
              <thead>
                <tr>
                  <th>Wynik meczu</th>
                  <th className="text-center">Wygrany</th>
                  <th className="text-center">Przegrany</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Tied (remis)</td><td className="text-center">0</td><td className="text-center">0</td></tr>
                <tr><td>1Up</td><td className="text-center text-[var(--color-success)] font-semibold">+1</td><td className="text-center text-[var(--color-danger)] font-semibold">−1</td></tr>
                <tr><td>2Up</td><td className="text-center text-[var(--color-success)] font-semibold">+2</td><td className="text-center text-[var(--color-danger)] font-semibold">−2</td></tr>
                <tr><td>2&amp;1</td><td className="text-center text-[var(--color-success)] font-semibold">+3</td><td className="text-center text-[var(--color-danger)] font-semibold">−3</td></tr>
                <tr><td>3&amp;1</td><td className="text-center text-[var(--color-success)] font-semibold">+4</td><td className="text-center text-[var(--color-danger)] font-semibold">−4</td></tr>
                <tr><td>3&amp;2</td><td className="text-center text-[var(--color-success)] font-semibold">+5</td><td className="text-center text-[var(--color-danger)] font-semibold">−5</td></tr>
                <tr><td>4&amp;2</td><td className="text-center text-[var(--color-success)] font-semibold">+6</td><td className="text-center text-[var(--color-danger)] font-semibold">−6</td></tr>
                <tr><td>4&amp;3</td><td className="text-center text-[var(--color-success)] font-semibold">+7</td><td className="text-center text-[var(--color-danger)] font-semibold">−7</td></tr>
                <tr><td>5&amp;3</td><td className="text-center text-[var(--color-success)] font-semibold">+8</td><td className="text-center text-[var(--color-danger)] font-semibold">−8</td></tr>
                <tr><td>5&amp;4</td><td className="text-center text-[var(--color-success)] font-semibold">+9</td><td className="text-center text-[var(--color-danger)] font-semibold">−9</td></tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm text-[var(--color-text-body)]/60 mt-3 italic">
            Przy walkowerze: bez „małych punktów".
          </p>
        </section>

        {/* IV. Faza PLAY-OFF */}
        <section>
          <h2 className="regulamin-h2">IV. Faza PLAY-OFF</h2>

          <h3 className="regulamin-h3">1. Drabinki</h3>

          <h4 className="regulamin-h4">Drabinka 1–16 (18 dołków)</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="bg-[var(--color-primary)]/[0.03] rounded-lg p-4 border border-[var(--color-border)]">
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-primary)]/50 mb-2">Górna połowa</div>
              <div className="space-y-1 font-mono text-sm">
                <div>1 vs 16 &nbsp;|&nbsp; 8 vs 9</div>
                <div>4 vs 13 &nbsp;|&nbsp; 5 vs 12</div>
              </div>
            </div>
            <div className="bg-[var(--color-primary)]/[0.03] rounded-lg p-4 border border-[var(--color-border)]">
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-primary)]/50 mb-2">Dolna połowa</div>
              <div className="space-y-1 font-mono text-sm">
                <div>2 vs 15 &nbsp;|&nbsp; 7 vs 10</div>
                <div>3 vs 14 &nbsp;|&nbsp; 6 vs 11</div>
              </div>
            </div>
          </div>

          <h4 className="regulamin-h4">Drabinka 17–32 (9/18 dołków)</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="bg-[var(--color-primary)]/[0.03] rounded-lg p-4 border border-[var(--color-border)]">
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-primary)]/50 mb-2">Górna połowa</div>
              <div className="space-y-1 font-mono text-sm">
                <div>17 vs 32 &nbsp;|&nbsp; 24 vs 25</div>
                <div>20 vs 29 &nbsp;|&nbsp; 21 vs 28</div>
              </div>
            </div>
            <div className="bg-[var(--color-primary)]/[0.03] rounded-lg p-4 border border-[var(--color-border)]">
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-primary)]/50 mb-2">Dolna połowa</div>
              <div className="space-y-1 font-mono text-sm">
                <div>18 vs 31 &nbsp;|&nbsp; 23 vs 26</div>
                <div>19 vs 30 &nbsp;|&nbsp; 22 vs 27</div>
              </div>
            </div>
          </div>

          <h4 className="regulamin-h4">Drabinka 33–48 (9 dołków)</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="bg-[var(--color-primary)]/[0.03] rounded-lg p-4 border border-[var(--color-border)]">
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-primary)]/50 mb-2">Górna połowa</div>
              <div className="space-y-1 font-mono text-sm">
                <div>33 vs 48 &nbsp;|&nbsp; 40 vs 41</div>
                <div>36 vs 45 &nbsp;|&nbsp; 37 vs 44</div>
              </div>
            </div>
            <div className="bg-[var(--color-primary)]/[0.03] rounded-lg p-4 border border-[var(--color-border)]">
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-primary)]/50 mb-2">Dolna połowa</div>
              <div className="space-y-1 font-mono text-sm">
                <div>34 vs 47 &nbsp;|&nbsp; 39 vs 42</div>
                <div>35 vs 46 &nbsp;|&nbsp; 38 vs 43</div>
              </div>
            </div>
          </div>

          <h3 className="regulamin-h3">2. Terminy meczów play-off</h3>
          <div className="overflow-x-auto">
            <table className="regulamin-table">
              <thead>
                <tr>
                  <th>Runda</th>
                  <th>Termin</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>1/8 finału</td><td>do 6 września 2026</td></tr>
                <tr><td>Ćwierćfinały</td><td>do 25 września 2026</td></tr>
                <tr><td>Półfinały</td><td>do 11 października 2026</td></tr>
                <tr><td className="font-semibold">Finały</td><td className="font-semibold">do 31 października 2026</td></tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm text-[var(--color-text-body)]/60 mt-3 italic">
            Dopuszcza się możliwość dokonania przez Organizatora zmiany powyższych terminów.
          </p>

          <h3 className="regulamin-h3">3. Dogrywka</h3>
          <p className="mb-4">Remisy w PLAY-OFF rozstrzygane są w formacie <strong>„nagłej śmierci"</strong> od dołka nr 1.</p>

          <h3 className="regulamin-h3">4. Nierozegrane mecze fazy play-off</h3>
          <p className="mb-3">W przypadku nierozegrania meczu w terminie, Zarząd Ligi może przyznać walkower. Decyzja uwzględnia:</p>
          <ol className="regulamin-ordered">
            <li>Obiektywne zaangażowanie graczy w organizację meczu.</li>
            <li>Wyższe miejsce zajęte w fazie grupowej (w sytuacjach niejednoznacznych).</li>
          </ol>
        </section>

        {/* V. Nagrody */}
        <section>
          <h2 className="regulamin-h2">V. Nagrody i klasyfikacja</h2>

          <h3 className="regulamin-h3">1. Nagrody pieniężne</h3>
          <p className="mb-3">Nagrody przyznawane są za:</p>
          <ul className="regulamin-list">
            <li>Miejsca <strong>1–12</strong> z drabinki 1–16</li>
            <li>Miejsca <strong>17–20</strong> z drabinki 17–32</li>
            <li>Miejsce <strong>33</strong> z drabinki 33–48</li>
          </ul>

          <h3 className="regulamin-h3">2. Wpływ na kolejne sezony</h3>
          <p>Rozstawienie w Lidze 2027 ustalane będzie na podstawie końcowej klasyfikacji 2026.</p>
        </section>

        {/* VI. Postanowienia końcowe */}
        <section>
          <h2 className="regulamin-h2">VI. Postanowienia końcowe</h2>

          <h3 className="regulamin-h3">1. Interpretacja regulaminu</h3>
          <p className="mb-4">Wszelkie spory oraz kwestie nieujęte w regulaminie rozstrzyga Zarząd Ligi.</p>

          <h3 className="regulamin-h3">2. Komunikacja</h3>
          <p>Oficjalnym kanałem komunikacji jest grupa WhatsApp „Don Papa MP 2026" oraz strona internetowa <a href="https://donpapagolf.pl" className="text-[var(--color-primary)] font-semibold hover:text-[var(--color-accent)] transition-colors">donpapagolf.pl</a>.</p>
        </section>

      </div>
    </div>
  )
}

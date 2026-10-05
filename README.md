# Tester API GUS · TypeScript

Polski interfejs do testowania **Banku Danych Lokalnych (BDL), API v1**. Frontend i backend są napisane w TypeScript z włączonym trybem `strict`. Brak frameworka i zależności runtime: przeglądarka + Node.js.

To nie jest klient REGON/BIR, TERYT ani wszystkich usług GUS. REGON/BIR wymaga osobnej integracji i danych dostępowych. Ta aplikacja nie przyjmuje kluczy, haseł ani danych poufnych.

## Uruchomienie

Wymagany Node.js 22 lub nowszy oraz npm.

```sh
npm ci
npm run check
npm run dev
```

Otwórz http://127.0.0.1:8080. `npm run dev` kompiluje aplikację raz i uruchamia ją (bez hot reload). Po edycji zatrzymaj proces i uruchom ponownie. Osobno: `npm run build`, następnie `npm start`. Zmienne `HOST` i `PORT` zmieniają nasłuch; domyślnie tylko interfejs lokalny. Nie wystawiaj proxy publicznie bez własnego TLS, kontroli dostępu i limitów ruchu.

## Korzystanie

1. Wybierz metodę lub gotowy przykład: jednostki „Warszawa”, dane dla zmiennej albo dostępne lata.
2. Uzupełnij wymagane pola. Identyfikatory jednostek pozostają tekstem, więc zachowują zera wiodące. Listy wartości wpisuj po przecinku; wysyłamy je jako powtarzane parametry.
3. Sprawdź adres zapytania i kliknij „Wyślij zapytanie”. Odpowiedź pokazuje kod HTTP GUS, czas oraz pełny JSON / tekst w zagnieżdżonych prostokątnych kontenerach. Każdy kontener pokazuje typ i wartość. Pola obiektu mają pełny kontener klucza połączony dolną krawędzią z kontenerem wartości. Cyfry indeksów tablic są ułożone pionowo na lewym marginesie o stałej szerokości, przy górnym lewym rogu kontenera wartości; puste obiekty, tablice i tekst pozostają widoczne. Kopiowanie i pobieranie zachowują pełną odpowiedź JSON. Możesz anulować żądanie.
4. `page` jest numerowane od 0, `page-size` od 1 do 100. Zmieniaj stronę ręcznie; aplikacja nie pobiera całych zbiorów automatycznie.
5. Po błędzie 429 odczekaj czas wskazany przez GUS. Aplikacja nie ponawia zapytań automatycznie i nie omija limitów API.

Zapytania idą przez lokalny backend do stałego hosta GUS; nie wymagają CORS po stronie GUS. Wyniki nie są zapisywane na serwerze. Wybrane w interfejsie pobranie pliku zapisuje wynik lokalnie w przeglądarce.

## Zakres i kontrakt

36 publicznych metod GET: tematy, zmienne, jednostki, miejscowości statystyczne, dane oraz słowniki i metadane. Katalog oparto na oficjalnym OpenAPI pobranym 2026-10-02:

- [OpenAPI BDL](https://bdl.stat.gov.pl/api/v1/swagger/doc/swagger.json)
- [Interaktywna dokumentacja](https://bdl.stat.gov.pl/api/v1/swagger/index.html)
- [Informacje GUS i limity BDL](https://api.stat.gov.pl/home/bdlapi)
- [Odrębne API REGON](https://api.stat.gov.pl/Home/RegonApi?lang=pl)

Snapshot: `docs/bdl-openapi.json`; typowany katalog: `src/catalog.ts`. Po świadomej aktualizacji snapshotu uruchom `node scripts/generate-catalog.mjs`, przejrzyj różnice i wykonaj testy. Aktualizacja nie odbywa się automatycznie. `lang=pl` i `format=json` są stałe. Nagłówki warunkowe i XML nie należą do zakresu pierwszej wersji.

## Ochrona i ograniczenia

- Stały host, zamknięty katalog ścieżek/parametrów i blokada przekierowań: brak dowolnego proxy URL / SSRF.
- Walidacja współdzielona przez formularz i serwer; int32, listy do 20 pozycji, pola do 500 znaków, wielkość strony 1–100.
- Jedno aktywne zapytanie na proces, przerwa 250 ms między zapytaniami; nie jest to pełny ani rozproszony limiter GUS. GUS ma dodatkowe limity czasowe dla anonimowego dostępu.
- Timeout 20 sekund, odpowiedź do 5 MiB, treść zapytania do 16 KiB. Anulowanie w UI przerywa również połączenie backendu.
- Brak sekretów, bazy, historii zapytań, analityki, CDN i zewnętrznych fontów. Odpowiedź API trafia do DOM jako tekst, nie HTML. CSP ogranicza zasoby do własnego źródła.
- `/healthz` sprawdza proces, nie zewnętrzną dostępność GUS.

## Testy

```sh
npm run typecheck
npm test
npm run check
```

Testy jednostkowe i integracyjne HTTP używają atrap odpowiedzi GUS, więc nie zużywają limitu i nie zależą od dostępności usługi. Typy są sprawdzane również dla frontendu. Kontrola w prawdziwej przeglądarce i smoke test żywego API są osobno opisane w PR; testy automatyczne nie zastępują kontroli wizualnej.

Repozytorium zawiera workflow wdrożeniowy, ale nie ma workflow testowego dla zwykłych gałęzi ani PR. `npm run check` jest lokalną bramką jakości; brak checków GitHub nie oznacza zielonego CI.

## Kontener i przyszłe wdrożenie

`Dockerfile` buduje TypeScript, uruchamia proces jako użytkownik `node` i zawiera rzeczywisty healthcheck. `compose.yaml` używa stałego portu kontenera 8080 oraz wymaganego `HOST_PORT`; bez `BIND_ADDRESS` publikuje port tylko lokalnie.

Workflow dla `deploy/*` domyślnie przekazuje `BIND_ADDRESS=0.0.0.0`, więc kolejne wdrożenia publikują port na wszystkich interfejsach hosta. Zmienna repozytorium/środowiska `DEPLOY_BIND_ADDRESS` pozwala wskazać konkretny adres hosta albo `127.0.0.1`. Działający kontener zmieni nasłuch dopiero przy ponownym wdrożeniu. Dostęp z LAN zależy też od routingu i zapory; wszystkie interfejsy mogą obejmować VPN lub adres publiczny. Aplikacja nie ma logowania ani TLS: nie udostępniaj jej publicznie bez dodatkowych zabezpieczeń.

```sh
HOST_PORT=30000 docker compose up --build
```

To polecenie uruchamia usługę na maszynie operatora. Wdrożenie na host repozytorium wymaga osobnego polecenia użytkownika i procedury w `AGENTS.md`; utworzenie tej aplikacji nie wykonuje wdrożenia, merge ani zmian gałęzi `deploy/*`.

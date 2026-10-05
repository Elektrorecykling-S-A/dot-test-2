# Weryfikacja implementacji

Data: 2026-10-02. Środowisko wykonawcze: Node.js 24.19.0, Linux.

## Wykonane

- `npm ci`: odtwarzalna instalacja z lockfile.
- `npm run check`: kompilacja TypeScript w trybie strict, kontrola typów i 56 testów.
- 48 testów kontraktu OpenAPI, walidacji, transportu i prawdziwego serwera HTTP z atrapą zewnętrznego GUS.
- 8 testów interakcji UI na DOM LinkeDOM: komplet katalogu, walidacja, duplikaty submit, bezpieczny JSON, anulowanie, ignorowanie spóźnionych odpowiedzi, zmiana formularza/presetu, 429 oraz błędy serwera.
- `npm audit`: 0 zgłoszonych podatności w zależnościach, w tym developerskich, w chwili sprawdzenia.
- `git diff --check`: bez błędów białych znaków.

## Rzeczywisty GUS, bez automatycznych powtórzeń

- `/years`: HTTP 200, 32 rekordy. Sprawdzono przez lokalny serwer HTTP aplikacji i transport Node.
- `/data/by-variable/3643?year=2024&unit-level=2`: HTTP 200, 16 rekordów. Parametry stałe i domyślne aplikacji były również wysłane.
- `/units/search?name=Warszawa`: GUS zwrócił HTTP 429. Wynik zachował status zewnętrznego API. Nie ponawiano żądania, aby nie obciążać usługi.
- Pobrano oficjalny snapshot OpenAPI; test porównuje z nim wszystkie 36 metod i parametry.

To punktowe testy dostępności; nie oznaczają sprawdzenia wszystkich kombinacji filtrów ani gwarancji dostępności GUS. Nie zatwierdzamy semantycznego znaczenia zmiennej 3643 jako ludności; przykład jest ogólnym zapytaniem o dane.

## Niewykonane / ograniczenia

- Kontrola wizualna i interakcje w prawdziwej przeglądarce: niezweryfikowane. Dostępna przeglądarka chmurowa odrzuca lokalne adresy (`ERR_BLOCKED_BY_CLIENT` w bieżącym środowisku pracy); nie obchodzono tej blokady. Test DOM nie sprawdza renderowania CSS, układu na urządzeniach ani natywnego schowka/pobierania.
- Docker build i uruchomienie Compose: nie wykonano, Docker nie jest zainstalowany. Pliki przygotowano zgodnie z istniejącym kontraktem; nie są dowodem wdrożenia.
- GitHub CI: zastany workflow uruchamia tylko wdrożenia z `deploy/*`/ręcznego dispatch. Nie dodano ani nie uruchomiono wdrożenia. Brak checków dla feature/PR nie jest sukcesem CI.
- Brak merge, wdrożenia i zmian na `deploy/*`.

# System Zapisów na Siatkówkę

Prosta aplikacja webowa do zarządzania listą obecności na mecze siatkówki, zawierająca shoutbox oraz historię spotkań. Aplikacja oparta jest na Node.js i Express, wykorzystująca plik JSON jako bazę danych.

## Funkcjonalności

*   **Lista obecności**: Użytkownicy mogą zapisywać się na listę obecnych lub nieobecnych.
*   **Shoutbox**: Prosty czat do komunikacji między graczami.
*   **Historia**: Przeglądanie archiwalnych list obecności z poprzednich gier.
*   **Automatyczna archiwizacja**: System automatycznie archiwizuje listę obecności i czyści ją co tydzień (w piątki o 2:00 w nocy) przy użyciu `node-cron`.
*   **Panel Administratora**: Dostępny pod ukrytym adresem endpoint do ręcznego zarządzania (np. wymuszenie archiwizacji).

## Technologie

*   **Backend**: Node.js, Express.js
*   **Baza danych**: Plik płaski `data.json`
*   **Frontend**: HTML, CSS, Vanilla JavaScript
*   **Inne**: `node-cron` (harmonogram zadań), `dotenv` (zmienne środowiskowe)

## Wymagania

*   Node.js (wersja LTS zalecana)
*   npm

## Instalacja i Uruchomienie

1.  **Sklonuj repozytorium:**
    ```bash
    git clone <adres_repozytorium>
    cd siatkowka
    ```

2.  **Zainstaluj zależności:**
    ```bash
    npm install
    ```

3.  **Konfiguracja:**
    Aplikacja korzysta z pliku `.env` (opcjonalnie).
    *   W trybie deweloperskim serwer uruchamia się domyślnie na porcie `3000`.
    *   W trybie produkcyjnym (`NODE_ENV=production`) serwer nasłuchuje na Unix Socket (skonfigurowane pod hosting AttHost).

4.  **Uruchomienie w trybie deweloperskim:**
    ```bash
    npm run dev
    ```
    Aplikacja będzie dostępna pod adresem: `http://localhost:3000`

5.  **Uruchomienie w trybie produkcyjnym:**
    ```bash
    npm start
    ```

## Struktura Projektu

*   `app.js` - Główny plik serwera (logika backendu, API, cron).
*   `data.json` - Plik przechowujący stan aplikacji (listy graczy, wiadomości, historia).
*   `public/` - Pliki frontendowe (HTML, CSS, JS klienta).
    *   `index.html` - Strona główna z zapisami.
    *   `historia.html` - Strona z historią gier.
    *   `script.js` - Logika strony głównej.
*   `ecosystem.config.js` - Konfiguracja dla PM2 (jeśli używany).

## API Endpoints

*   `GET /api/data` - Pobiera aktualny stan danych.
*   `POST /api/data` - Aktualizuje listy graczy.
*   `POST /api/shoutbox` - Dodaje wiadomość do czatu.
*   `POST /api/archive` - Ręczne wymuszenie archiwizacji listy.

## Licencja

ISC

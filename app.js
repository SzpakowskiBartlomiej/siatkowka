// Ta linia musi być na samym początku!
require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
const simpleGit = require('simple-git');

const app = express();
const git = simpleGit({
    baseDir: __dirname,
    binary: 'git',
    maxConcurrentProcesses: 6,
});
const dataPath = path.join(__dirname, 'data.json');

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- NOWA, BARDZIEJ ROZBUDOWANA FUNKCJA GIT ---
async function commitAndPushDataJson(message) {
    const commitMessage = message || 'Automatyczny zapis zmian w data.json';
    try {
        // KROK 1: Sprawdzamy, czy plik data.json faktycznie się zmienił
        const status = await git.status();
        if (!status.modified.includes('data.json')) {
            console.log('Brak zmian w data.json do zacommitowania.');
            return; // Zakończ funkcję, jeśli nie ma zmian
        }

        console.log('Wykryto zmiany w data.json. Próba commitu i pusha...');

        // KROK 2: Konfiguracja tożsamości bota (kluczowe dla hostingów współdzielonych)
        // Używamy zmiennych środowiskowych lub domyślnych wartości
        const gitUser = process.env.GIT_USER || 'SiatkaBot';
        const gitEmail = process.env.GIT_EMAIL || 'bot@siatka.local';
        await git.addConfig('user.name', gitUser, false, 'local');
        await git.addConfig('user.email', gitEmail, false, 'local');
        console.log(`Ustawiono tożsamość gita na: ${gitUser} <${gitEmail}>`);

        // KROK 3: Commit
        await git.add('data.json');
        const commitSummary = await git.commit(commitMessage);
        console.log(`Pomyślnie zacommitowano zmiany:`, commitSummary);

        // KROK 4: Push
        // Ta operacja najprawdopodobniej się nie uda bez uwierzytelnienia!
        // Spodziewamy się błędu, który zobaczymy w przeglądarce.
        console.log('Próba wypchnięcia zmian na serwer zdalny (push)...');
        await git.push('origin', 'main'); // Zakładam, że gałąź to "main"
        console.log('Pomyślnie wypchnięto zmiany na serwer zdalny!');

    } catch (error) {
        console.error('### KRYTYCZNY BŁĄD PODCZAS OPERACJI GIT (commit/push) ###');
        console.error(error); // To zobaczymy w logach serwera (jeśli działają)
        // Rzucamy błąd dalej, aby endpoint API mógł go złapać i wysłać do przeglądarki
        throw error;
    }
}


// Funkcje do odczytu i zapisu danych
function readData() {
    try {
        const data = fs.readFileSync(dataPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Błąd podczas odczytu pliku data.json:', error);
        return { presentPlayers: [], absentPlayers: [], shoutboxMessages: [], attendanceHistory: [] };
    }
}

// Zmieniamy funkcję na asynchroniczną, aby poczekać na zakończenie commita i pusha
async function writeData(data, commitMessage) {
    // Usunęliśmy try-catch, aby błędy z git-a "leciały" wyżej do endpointu
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    await commitAndPushDataJson(commitMessage);
}

// Funkcja z logiką archiwizacji, również asynchroniczna
async function archiveAndResetLists() {
    console.log('Uruchamiam proces archiwizacji listy obecności...');
    const data = readData();
    let message = 'Nie było zapisanych graczy. Listy zostały wyczyszczone.';
    let commitMessage = 'Archiwizacja: Brak graczy, listy wyczyszczone.';

    if (data.presentPlayers && data.presentPlayers.length > 0) {
        const gameDate = new Date();
        const dayOfWeek = gameDate.getDay();
        const daysToSubtract = (dayOfWeek + 3) % 7;
        gameDate.setDate(gameDate.getDate() - daysToSubtract);
        const dateString = gameDate.toISOString().split('T')[0];

        const newHistoryEntry = {
            date: dateString,
            players: [...data.presentPlayers]
        };

        data.attendanceHistory.unshift(newHistoryEntry);
        message = `Pomyślnie zarchiwizowano listę obecności z dnia: ${dateString}. Zapisano ${newHistoryEntry.players.length} graczy.`;
        commitMessage = `Archiwizacja: Zapisano ${newHistoryEntry.players.length} graczy z dnia ${dateString}.`;
    }

    data.presentPlayers = [];
    data.absentPlayers = [];
    await writeData(data, commitMessage); // Czekamy na zapis, commit i push

    console.log(message);
    return message;
}

// --- ENDPOINTY APLIKACJI (Z OBSŁUGĄ BŁĘDÓW WYSYŁANYCH DO PRZEGLĄDARKI) ---

app.get('/api/data', (req, res) => {
    try {
        const data = readData();
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: 'Błąd serwera podczas odczytu danych' });
    }
});

app.post('/api/data', async (req, res) => {
    try {
        const currentData = readData();
        const { presentPlayers, absentPlayers } = req.body;
        currentData.presentPlayers = presentPlayers;
        currentData.absentPlayers = absentPlayers;
        await writeData(currentData, 'Aktualizacja list graczy');
        res.status(200).json({ message: 'Dane graczy zostały pomyślnie zaktualizowane' });
    } catch (error) {
        // Złap błąd z `writeData` i odeślij go do przeglądarki!
        res.status(500).json({
            message: 'Błąd serwera podczas zapisu danych i operacji Git.',
            gitError: error.message // Dołączamy treść błędu z gita
        });
    }
});

app.post('/api/shoutbox', async (req, res) => {
    try {
        const { name, message } = req.body;
        if (!name || !message) {
            return res.status(400).json({ message: 'Imię i treść wiadomości są wymagane.' });
        }
        const data = readData();
        const timestamp = new Date().toLocaleString('pl-PL');
        const newMessage = { name, message, timestamp };
        data.shoutboxMessages.unshift(newMessage);
        if (data.shoutboxMessages.length > 50) {
            data.shoutboxMessages.pop();
        }
        await writeData(data, `Nowa wiadomość w shoutboxie od ${name}`);
        res.status(201).json({ message: 'Wiadomość została dodana.' });
    } catch (error) {
        res.status(500).json({
            message: 'Błąd serwera podczas zapisu wiadomości i operacji Git.',
            gitError: error.message
        });
    }
});

app.get('/historia', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'historia.html'));
});

app.get('/admin-panel-siatka', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.post('/api/archive', async (req, res) => {
    try {
        const resultMessage = await archiveAndResetLists();
        res.status(200).json({ message: resultMessage });
    } catch (error) {
        console.error('Błąd podczas ręcznej archiwizacji:', error);
        res.status(500).json({
            message: 'Wystąpił błąd serwera podczas archiwizacji i operacji Git.',
            gitError: error.message
        });
    }
});

app.get('/sala.php', (req, res) => {
    res.redirect(301, '/');
});

// Harmonogram również dostosowany do async
cron.schedule('0 2 * * 5', async () => {
    console.log('Uruchamiam zaplanowaną archiwizację...');
    try {
        await archiveAndResetLists();
    } catch(error) {
        console.error("Błąd podczas automatycznej, zaplanowanej archiwizacji:", error);
    }
});

// --- BLOK NASŁUCHIWANIA APLIKACJI ---

if (process.env.NODE_ENV === 'production') {
    const socketPath = `/home/szpaku/tmp/siatkaSocket`;
    if (fs.existsSync(socketPath)) {
        fs.unlinkSync(socketPath);
    }
    app.listen(socketPath, () => {
        console.log(`Serwer produkcyjny nasłuchuje na sockecie: ${socketPath}`);
    });
} else {
    const PORT = 3000;
    app.listen(PORT, () => {
        console.log(`Serwer deweloperski nasłuchuje na http://localhost:${PORT}`);
    });
}
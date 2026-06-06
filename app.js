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

// --- NOWA FUNKCJA GIT Z ROZBUDOWANYM LOGOWANIEM ---
async function commitAndPushDataJson(message) {
    const logs = [];
    const commitMessage = message || 'Automatyczny zapis zmian w data.json';

    try {
        logs.push("Krok 1: Sprawdzanie statusu repozytorium...");
        const status = await git.status();
        logs.push(`Status repozytorium: ${JSON.stringify(status)}`);

        if (!status.modified.includes('data.json')) {
            logs.push("Wniosek: Plik data.json nie został zmodyfikowany. Zakończono operację Git.");
            return { success: true, summary: 'No changes detected', logs };
        }

        logs.push("Krok 2: Wykryto zmiany. Konfiguracja tożsamości bota...");
        const gitUser = process.env.GIT_USER || 'SiatkaBot';
        const gitEmail = process.env.GIT_EMAIL || 'bot@siatka.local';
        await git.addConfig('user.name', gitUser, false, 'local');
        await git.addConfig('user.email', gitEmail, false, 'local');
        logs.push(`Tożsamość ustawiona na: ${gitUser} <${gitEmail}>`);

        logs.push("Krok 3: Dodawanie pliku data.json do przechowalni (staging)...");
        await git.add('data.json');
        logs.push("Plik dodany.");

        logs.push("Krok 4: Tworzenie commita...");
        const commitSummary = await git.commit(commitMessage);
        logs.push(`Commit utworzony pomyślnie: ${commitSummary.commit}`);

        logs.push("Krok 5: Wypychanie zmian na serwer zdalny (push)...");
        await git.push('origin', 'main');
        logs.push("Zmiany zostały pomyślnie wypchnięte!");

        return { success: true, summary: commitSummary, logs };

    } catch (error) {
        logs.push(`### KRYTYCZNY BŁĄD PODCZAS OPERACJI GIT: ${error.message} ###`);
        console.error("Błąd operacji Git:", error);
        return { success: false, error: error.message, logs };
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

async function writeData(data, commitMessage) {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    // Zwróć wynik operacji gita, aby endpoint mógł go odczytać
    return await commitAndPushDataJson(commitMessage);
}

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
    const gitResult = await writeData(data, commitMessage);

    console.log(message);
    // Zwracamy zarówno wiadomość dla użytkownika, jak i wynik operacji gita
    return { userMessage: message, gitResult };
}

// --- ENDPOINTY APLIKACJI Z ZASZYTYM ZWRACANIEM LOGÓW ---

app.get('/api/data', (req, res) => {
    res.json(readData());
});

// Funkcja pomocnicza do wysyłania odpowiedzi
function sendGitResponse(res, gitResult, successMessage) {
    if (gitResult.success) {
        res.status(200).json({ message: successMessage, details: gitResult });
    } else {
        res.status(500).json({ message: 'Operacja Git nie powiodła się.', details: gitResult });
    }
}

app.post('/api/data', async (req, res) => {
    try {
        const currentData = readData();
        const { presentPlayers, absentPlayers } = req.body;
        currentData.presentPlayers = presentPlayers;
        currentData.absentPlayers = absentPlayers;
        const gitResult = await writeData(currentData, 'Aktualizacja list graczy');
        sendGitResponse(res, gitResult, 'Dane graczy zaktualizowane.');
    } catch (error) {
        res.status(500).json({ message: 'Nieoczekiwany błąd serwera.', error: error.message });
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
        data.shoutboxMessages.unshift({ name, message, timestamp });
        if (data.shoutboxMessages.length > 50) data.shoutboxMessages.pop();

        const gitResult = await writeData(data, `Nowa wiadomość w shoutboxie od ${name}`);
        sendGitResponse(res, gitResult, 'Wiadomość została dodana.');
    } catch (error) {
        res.status(500).json({ message: 'Nieoczekiwany błąd serwera.', error: error.message });
    }
});

app.post('/api/archive', async (req, res) => {
    try {
        const { userMessage, gitResult } = await archiveAndResetLists();
        sendGitResponse(res, gitResult, userMessage);
    } catch (error) {
        res.status(500).json({ message: 'Nieoczekiwany błąd serwera podczas archiwizacji.', error: error.message });
    }
});


app.get('/historia', (req, res) => res.sendFile(path.join(__dirname, 'public', 'historia.html')));
app.get('/admin-panel-siatka', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/sala.php', (req, res) => res.redirect(301, '/'));

cron.schedule('0 2 * * 5', async () => {
    console.log('Uruchamiam zaplanowaną archiwizację...');
    try {
        const { gitResult } = await archiveAndResetLists();
        console.log('Wynik zaplanowanej archiwizacji:', gitResult);
    } catch(error) {
        console.error("Błąd podczas automatycznej, zaplanowanej archiwizacji:", error);
    }
});

// --- BLOK NASŁUCHIWANIA APLIKACJI ---
if (process.env.NODE_ENV === 'production') {
    const socketPath = `/home/szpaku/tmp/siatkaSocket`;
    if (fs.existsSync(socketPath)) fs.unlinkSync(socketPath);
    app.listen(socketPath, () => console.log(`Serwer produkcyjny nasłuchuje na sockecie: ${socketPath}`));
} else {
    const PORT = 3000;
    app.listen(PORT, () => console.log(`Serwer deweloperski nasłuchuje na http://localhost:${PORT}`));
}
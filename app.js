// Ta linia musi być na samym początku!
require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');

const app = express();
const dataPath = path.join(__dirname, 'data.json');

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- UPROSZCZONE FUNKCJE ZAPISU I ODCZYTU ---

// Funkcja do odczytu danych z pliku
function readData() {
    try {
        // Używamy flagi 'a+' do utworzenia pliku, jeśli nie istnieje
        if (!fs.existsSync(dataPath)) {
            fs.writeFileSync(dataPath, JSON.stringify({ presentPlayers: [], absentPlayers: [], shoutboxMessages: [], attendanceHistory: [] }, null, 2));
        }
        const data = fs.readFileSync(dataPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Błąd podczas odczytu pliku data.json:', error);
        // Zwróć pustą strukturę w razie błędu parsowania
        return { presentPlayers: [], absentPlayers: [], shoutboxMessages: [], attendanceHistory: [] };
    }
}

// Funkcja do zapisu danych do pliku (bez gita)
function writeData(data) {
    try {
        fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Błąd podczas zapisu do pliku data.json:', error);
    }
}

// --- LOGIKA APLIKACJI ---

// Funkcja archiwizacji (bez gita)
function archiveAndResetLists() {
    console.log('Uruchamiam proces archiwizacji listy obecności...');
    const data = readData();
    let message = 'Nie było zapisanych graczy. Listy zostały wyczyszczone.';

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
    }

    data.presentPlayers = [];
    data.absentPlayers = [];
    writeData(data); // Prosty zapis do pliku

    console.log(message);
    return message;
}

// --- ENDPOINTY APLIKACJI (UPROSZCZONE) ---

app.get('/api/data', (req, res) => {
    res.json(readData());
});

app.post('/api/data', (req, res) => {
    try {
        const currentData = readData();
        const { presentPlayers, absentPlayers } = req.body;
        currentData.presentPlayers = presentPlayers;
        currentData.absentPlayers = absentPlayers;
        writeData(currentData); // Prosty zapis
        res.status(200).json({ message: 'Dane graczy zostały pomyślnie zaktualizowane' });
    } catch (error) {
        res.status(500).json({ message: 'Błąd serwera podczas zapisu danych graczy' });
    }
});

app.post('/api/shoutbox', (req, res) => {
    try {
        const { name, message } = req.body;
        if (!name || !message) {
            return res.status(400).json({ message: 'Imię i treść wiadomości są wymagane.' });
        }
        const data = readData();
        const timestamp = new Date().toLocaleString('pl-PL');
        data.shoutboxMessages.unshift({ name, message, timestamp });
        if (data.shoutboxMessages.length > 50) {
            data.shoutboxMessages.pop();
        }
        writeData(data); // Prosty zapis
        res.status(201).json({ message: 'Wiadomość została dodana.' });
    } catch (error) {
        res.status(500).json({ message: 'Błąd serwera podczas zapisu wiadomości' });
    }
});

app.post('/api/archive', (req, res) => {
    try {
        const resultMessage = archiveAndResetLists();
        res.status(200).json({ message: resultMessage });
    } catch (error) {
        console.error('Błąd podczas ręcznej archiwizacji:', error);
        res.status(500).json({ message: 'Wystąpił błąd serwera podczas archiwizacji.' });
    }
});

// --- ŚCIEŻKI I HARMONOGRAM ---

app.get('/historia', (req, res) => res.sendFile(path.join(__dirname, 'public', 'historia.html')));
app.get('/admin-panel-siatka', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/sala.php', (req, res) => res.redirect(301, '/'));

cron.schedule('0 2 * * 5', () => {
    console.log('Uruchamiam zaplanowaną archiwizację...');
    archiveAndResetLists();
});

// --- BLOK NASŁUCHIWANIA APLIKACJI ---
if (process.env.NODE_ENV === 'production') {
    const socketPath = `/home/szpaku/tmp/siatkaSocket`;
    if (fs.existsSync(socketPath)) {
        fs.unlinkSync(socketPath);
    }
    app.listen(socketPath, () => console.log(`Serwer produkcyjny nasłuchuje na sockecie: ${socketPath}`));
} else {
    const PORT = 3000;
    app.listen(PORT, () => console.log(`Serwer deweloperski nasłuchuje na http://localhost:${PORT}`));
}
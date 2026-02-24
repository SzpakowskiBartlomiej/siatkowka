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

function writeData(data) {
    try {
        fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Błąd podczas zapisu do pliku data.json:', error);
    }
}

// Funkcja z logiką archiwizacji, wydzielona do osobnego miejsca
function archiveAndResetLists() {
    console.log('Uruchamiam proces archiwizacji listy obecności...');
    const data = readData();
    let message = 'Nie było zapisanych graczy. Listy zostały wyczyszczone.';

    if (data.presentPlayers && data.presentPlayers.length > 0) {
        const gameDate = new Date();
        // Cofamy się do ostatniego czwartku, aby poprawnie oznaczyć datę meczu
        const dayOfWeek = gameDate.getDay(); // 0=Niedziela, 4=Czwartek
        const daysToSubtract = (dayOfWeek + 3) % 7; // (dzien + (7-czwartek)) % 7
        gameDate.setDate(gameDate.getDate() - daysToSubtract);
        const dateString = gameDate.toISOString().split('T')[0]; // Format YYYY-MM-DD

        const newHistoryEntry = {
            date: dateString,
            players: [...data.presentPlayers] // Kopiujemy tablicę graczy
        };

        data.attendanceHistory.unshift(newHistoryEntry);
        message = `Pomyślnie zarchiwizowano listę obecności z dnia: ${dateString}. Zapisano ${newHistoryEntry.players.length} graczy.`;
    }

    // Niezależnie od wszystkiego, czyścimy listy na następny tydzień
    data.presentPlayers = [];
    data.absentPlayers = [];
    writeData(data);

    console.log(message);
    return message; // Zwracamy komunikat o wyniku
}

// --- ENDPOINTY APLIKACJI ---

// Endpoint API do pobierania wszystkich danych
app.get('/api/data', (req, res) => {
    try {
        const data = readData();
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: 'Błąd serwera podczas odczytu danych' });
    }
});

// Endpoint API do aktualizowania danych graczy
app.post('/api/data', (req, res) => {
    try {
        const currentData = readData();
        const { presentPlayers, absentPlayers } = req.body;
        currentData.presentPlayers = presentPlayers;
        currentData.absentPlayers = absentPlayers;
        writeData(currentData);
        res.status(200).json({ message: 'Dane graczy zostały pomyślnie zaktualizowane' });
    } catch (error) {
        res.status(500).json({ message: 'Błąd serwera podczas zapisu danych graczy' });
    }
});

// Endpoint API do dodawania wiadomości do Shoutboxa
app.post('/api/shoutbox', (req, res) => {
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
        writeData(data);
        res.status(201).json({ message: 'Wiadomość została dodana.' });
    } catch (error) {
        res.status(500).json({ message: 'Błąd serwera podczas zapisu wiadomości' });
    }
});

// ŚCIEŻKA: Serwowanie strony z historią
app.get('/historia', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'historia.html'));
});

// ŚCIEŻKA: Serwowanie panelu admina
app.get('/admin-panel-siatka', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ENDPOINT API: Ręczne uruchomienie archiwizacji
app.post('/api/archive', (req, res) => {
    try {
        const resultMessage = archiveAndResetLists();
        res.status(200).json({ message: resultMessage });
    } catch (error) {
        console.error('Błąd podczas ręcznej archiwizacji:', error);
        res.status(500).json({ message: 'Wystąpił błąd serwera podczas archiwizacji.' });
    }
});

// Przekierowanie 301 ze starego adresu
app.get('/sala.php', (req, res) => {
    res.redirect(301, '/');
});

// Harmonogram archiwizacji (uruchamia się o 2:00 w każdy piątek)
cron.schedule('0 2 * * 5', () => {
    archiveAndResetLists();
});

// --- BLOK NASŁUCHIWANIA APLIKACJI ---

if (process.env.NODE_ENV === 'production') {
    // TRYB PRODUKCYJNY (na serwerze atthost)
    const socketPath = `/home/szpaku/tmp/siatkaSocket`;
    if (fs.existsSync(socketPath)) {
        fs.unlinkSync(socketPath);
    }
    app.listen(socketPath, () => {
        console.log(`Serwer produkcyjny nasłuchuje na sockecie: ${socketPath}`);
    });
} else {
    // TRYB DEWELOPERSKI (lokalnie na Twoim komputerze)
    const PORT = 3000;
    app.listen(PORT, () => {
        console.log(`Serwer deweloperski nasłuchuje na http://localhost:${PORT}`);
    });
}
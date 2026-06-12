// Ta linia musi być na samym początku!
require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
const nodemailer = require('nodemailer');

const app = express();
const dataPath = path.join(__dirname, 'data.json');

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- UPROSZCZONE FUNKCJE ZAPISU I ODCZYTU ---

// Funkcja do odczytu danych z pliku
function readData() {
    if (!fs.existsSync(dataPath)) {
        const defaultData = { presentPlayers: [], absentPlayers: [], shoutboxMessages: [], attendanceHistory: [] };
        fs.writeFileSync(dataPath, JSON.stringify(defaultData, null, 2));
        return defaultData;
    }
    const data = fs.readFileSync(dataPath, 'utf8');
    if (!data.trim()) {
        throw new Error('Plik data.json jest pusty');
    }
    try {
        return JSON.parse(data);
    } catch (error) {
        console.error('Błąd podczas odczytu pliku data.json:', error);
        // Zgłaszamy błąd, aby nie nadpisać uszkodzonego pliku pustą strukturą
        throw new Error('Błąd parsowania pliku data.json - plik może być uszkodzony.');
    }
}

// Funkcja do zapisu danych do pliku (bez gita)
function writeData(data) {
    try {
        const tempPath = dataPath + '.tmp';
        // Zapis do pliku tymczasowego, a następnie zmiana nazwy (operacja atomowa)
        fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
        fs.renameSync(tempPath, dataPath);
    } catch (error) {
        console.error('Błąd podczas zapisu do pliku data.json:', error);
        throw error;
    }
}

// --- LOGIKA APLIKACJI ---

// Funkcja archiwizacji (bez gita)
function archiveAndResetLists() {
    console.log('Uruchamiam proces archiwizacji listy obecności...');
    let data;
    try {
        data = readData();
    } catch (error) {
        console.error('Archiwizacja przerwana:', error.message);
        return 'Archiwizacja przerwana: ' + error.message;
    }

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

// --- FUNKCJA WYSYŁKI MAILA ---
async function sendEmailWithBackup(backupPath, dateString) {
    if (!process.env.SMTP_HOST || !process.env.SMTP_PASS) {
        throw new Error('Brak skonfigurowanego SMTP w pliku .env (brakuje SMTP_PASS lub SMTP_HOST).');
    }
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: true,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
    
    const mailOptions = {
        from: `"Siatkówka Backup" <${process.env.SMTP_USER}>`,
        to: process.env.EMAIL_TO || process.env.SMTP_USER,
        subject: `Kopia zapasowa danych Siatkówka - ${dateString}`,
        text: `W załączniku znajduje się kopia zapasowa danych z aplikacji Siatkówka (wygenerowana: ${dateString}).`,
        attachments: [
            {
                filename: `data_backup_${dateString}.json`,
                path: backupPath
            }
        ]
    };
    
    await transporter.sendMail(mailOptions);
}

// --- ENDPOINTY APLIKACJI (UPROSZCZONE) ---

app.get('/api/data', (req, res) => {
    try {
        res.json(readData());
    } catch (error) {
        res.status(500).json({ message: 'Błąd podczas odczytu danych', error: error.message });
    }
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

app.get('/api/export', (req, res) => {
    try {
        const dateString = new Date().toISOString().split('T')[0];
        res.download(dataPath, `data_backup_${dateString}.json`);
    } catch (error) {
        console.error('Błąd podczas pobierania kopii zapasowej:', error);
        res.status(500).json({ message: 'Wystąpił błąd serwera podczas pobierania pliku.' });
    }
});

app.post('/api/export/email', async (req, res) => {
    try {
        const dateString = new Date().toISOString().split('T')[0] + "_manual";
        const backupsDir = path.join(__dirname, 'backups');
        const backupPath = path.join(backupsDir, `data_backup_${dateString}.json`);
        
        if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir);
        fs.copyFileSync(dataPath, backupPath);
        
        await sendEmailWithBackup(backupPath, dateString);
        res.status(200).json({ message: 'Kopia zapasowa została wysłana na Twój adres e-mail.' });
    } catch (error) {
        console.error('Błąd podczas ręcznej wysyłki maila:', error);
        res.status(500).json({ message: 'Błąd wysyłki: ' + error.message });
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

// Automatyczna kopia zapasowa raz w miesiącu (1. dnia miesiąca o 3:00)
cron.schedule('0 3 1 * *', async () => {
    console.log('Uruchamiam comiesięczną kopię zapasową...');
    try {
        const dateString = new Date().toISOString().split('T')[0];
        const backupsDir = path.join(__dirname, 'backups');
        const backupPath = path.join(backupsDir, `data_backup_${dateString}.json`);
        
        if (!fs.existsSync(backupsDir)) {
            fs.mkdirSync(backupsDir);
        }
        
        if (fs.existsSync(dataPath)) {
            fs.copyFileSync(dataPath, backupPath);
            console.log(`Pomyślnie utworzono kopię zapasową: ${backupPath}`);
            
            try {
                await sendEmailWithBackup(backupPath, dateString);
                console.log('Kopia zapasowa została wysłana na email.');
            } catch (err) {
                console.log('Nie wysłano maila:', err.message);
            }
        }
    } catch (error) {
        console.error('Błąd podczas tworzenia/wysyłania automatycznej kopii zapasowej:', error);
    }
});

// --- BLOK NASŁUCHIWANIA APLIKACJI ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Serwer nasłuchuje na porcie: ${PORT}`);
});
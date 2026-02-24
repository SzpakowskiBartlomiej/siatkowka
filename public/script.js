// Zmienne globalne do zarządzania stanem
let allData = {};
let shoutboxCurrentPage = 1;
const itemsPerPage = 10;

// Stałe
const maxPlayers = 12;
const minPlayers = 8;
const playerTableBody = document.getElementById('player-table-body');
const absentTableBody = document.getElementById('absent-table-body');
const playerCountElement = document.getElementById('player-count');
const matchStatusElement = document.getElementById('match-status');
const addPlayerForm = document.getElementById('player-form');
const addAbsentForm = document.getElementById('add-absent-form');
const removePlayerForm = document.getElementById('remove-player-form');
const playerNameInput = document.getElementById('player-name-input');
const absentNameInput = document.getElementById('absent-name-input');
const playerNameRemoveInput = document.getElementById('player-name-remove-input');
const shoutboxForm = document.getElementById('shoutbox-form');
const shoutboxNameInput = document.getElementById('shoutbox-name-input');
const shoutboxMessageInput = document.getElementById('shoutbox-message-input');
const shoutboxMessagesContainer = document.getElementById('shoutbox-messages');

// NOWA UNIWERSALNA FUNKCJA DO RENDEROWANIA PRZYCISKÓW STRONICOWANIA
function renderPagination(containerId, currentPage, totalItems, onPageChange) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    if (totalPages <= 1) return;

    // Przycisk "Poprzednia"
    const prevButton = document.createElement('button');
    prevButton.textContent = '«';
    prevButton.classList.add('pagination-button');
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener('click', () => onPageChange(currentPage - 1));
    container.appendChild(prevButton);

    // Przyciski numeryczne
    for (let i = 1; i <= totalPages; i++) {
        const pageButton = document.createElement('button');
        pageButton.textContent = i;
        pageButton.classList.add('pagination-button');
        if (i === currentPage) {
            pageButton.classList.add('active');
        }
        pageButton.addEventListener('click', () => onPageChange(i));
        container.appendChild(pageButton);
    }

    // Przycisk "Następna"
    const nextButton = document.createElement('button');
    nextButton.textContent = '»';
    nextButton.classList.add('pagination-button');
    nextButton.disabled = currentPage === totalPages;
    nextButton.addEventListener('click', () => onPageChange(currentPage + 1));
    container.appendChild(nextButton);
}

// Funkcja do pobierania danych z serwera
async function fetchData() {
    try {
        const response = await fetch('/api/data');
        if (!response.ok) throw new Error('Nie udało się pobrać danych z serwera.');
        allData = await response.json();
        renderUI();
    } catch (error) {
        console.error('Błąd pobierania danych:', error);
        allData = { presentPlayers: [], absentPlayers: [], shoutboxMessages: [] };
        renderUI();
    }
}

// Funkcja do zapisywania DANYCH GRACZY na serwerze
async function savePlayerData(dataToSave) {
    try {
        const response = await fetch('/api/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ presentPlayers: dataToSave.presentPlayers, absentPlayers: dataToSave.absentPlayers }),
        });
        if (!response.ok) throw new Error('Nie udało się zapisać danych na serwerze.');
    } catch (error) {
        console.error('Błąd zapisu danych:', error);
    }
}

// Renderowanie wiadomości w Shoutboxie (z logiką stronicowania)
function renderShoutbox(messages) {
    shoutboxMessagesContainer.innerHTML = '';
    if (!messages || messages.length === 0) {
        shoutboxMessagesContainer.innerHTML = '<p>Brak wiadomości.</p>';
        return;
    }

    const startIndex = (shoutboxCurrentPage - 1) * itemsPerPage;
    const paginatedMessages = messages.slice(startIndex, startIndex + itemsPerPage);

    paginatedMessages.forEach(msg => {
        const messageElement = document.createElement('div');
        messageElement.classList.add('shoutbox-message');
        messageElement.innerHTML = `
            <span class="timestamp">${msg.timestamp}</span>
            <span class="name">${msg.name}:</span>
            <span class="message">${msg.message}</span>
        `;
        shoutboxMessagesContainer.appendChild(messageElement);
    });

    renderPagination('shoutbox-pagination', shoutboxCurrentPage, messages.length, (newPage) => {
        shoutboxCurrentPage = newPage;
        renderUI();
    });
}

// Renderuje cały interfejs użytkownika
function renderUI() {
    // ... reszta funkcji renderUI bez zmian ...
    playerTableBody.innerHTML = '';
    absentTableBody.innerHTML = '';
    allData.presentPlayers.forEach((player, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${index + 1}</td><td>${player}</td>`;
        if (index >= maxPlayers) row.querySelector('td:last-child').classList.add('reserve');
        playerTableBody.appendChild(row);
    });
    allData.absentPlayers.forEach((player) => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${player}</td>`;
        absentTableBody.appendChild(row);
    });
    playerCountElement.textContent = `Zapisani gracze: ${allData.presentPlayers.length}`;
    if (allData.presentPlayers.length >= minPlayers) {
        matchStatusElement.textContent = `Mecz się ODBĘDZIE! 🎉 (${minPlayers}+ graczy)`;
        matchStatusElement.style.color = 'green';
    } else {
        matchStatusElement.textContent = `Mecz jeszcze się nie odbędzie. Brakuje ${minPlayers - allData.presentPlayers.length} graczy.`;
        matchStatusElement.style.color = 'red';
    }
    renderShoutbox(allData.shoutboxMessages);
}

// ... event listenery bez zmian, ale używają `allData` i `fetchData()` ...
addPlayerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const newName = playerNameInput.value.trim();
    if (!newName) return;
    if (allData.presentPlayers.some(p => p.toLowerCase() === newName.toLowerCase())) {
        return alert('Ten gracz jest już zapisany!');
    }
    allData.absentPlayers = allData.absentPlayers.filter(p => p.toLowerCase() !== newName.toLowerCase());
    allData.presentPlayers.push(newName);
    await savePlayerData(allData);
    await fetchData();
    playerNameInput.value = '';
});

addAbsentForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const newName = absentNameInput.value.trim();
    if (!newName) return;
    if (allData.absentPlayers.some(p => p.toLowerCase() === newName.toLowerCase())) {
        return alert('Ten gracz jest już na liście nieobecnych!');
    }
    allData.presentPlayers = allData.presentPlayers.filter(p => p.toLowerCase() !== newName.toLowerCase());
    allData.absentPlayers.push(newName);
    await savePlayerData(allData);
    await fetchData();
    absentNameInput.value = '';
});

removePlayerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const nameToRemove = playerNameRemoveInput.value.trim();
    if (!nameToRemove) return;
    const originalPresentCount = allData.presentPlayers.length;
    const originalAbsentCount = allData.absentPlayers.length;
    allData.presentPlayers = allData.presentPlayers.filter(p => p.toLowerCase() !== nameToRemove.toLowerCase());
    allData.absentPlayers = allData.absentPlayers.filter(p => p.toLowerCase() !== nameToRemove.toLowerCase());
    if (allData.presentPlayers.length === originalPresentCount && allData.absentPlayers.length === originalAbsentCount) {
        alert('Nie znaleziono gracza o takim imieniu.');
    } else {
        await savePlayerData(allData);
        await fetchData();
    }
    playerNameRemoveInput.value = '';
});

shoutboxForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = shoutboxNameInput.value.trim();
    const message = shoutboxMessageInput.value.trim();
    if (!name || !message) return;
    try {
        const response = await fetch('/api/shoutbox', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, message })
        });
        if (!response.ok) throw new Error('Błąd serwera przy dodawaniu wiadomości.');
        shoutboxCurrentPage = 1; // Wróć na pierwszą stronę po dodaniu wiadomości
        await fetchData();
        shoutboxMessageInput.value = '';
    } catch (error) {
        console.error('Błąd wysyłania wiadomości:', error);
        alert('Nie udało się wysłać wiadomości.');
    }
});

// Wczytanie i renderowanie danych po załadowaniu strony
document.addEventListener('DOMContentLoaded', async () => {
    updateMatchDateTitle();
    await fetchData();
});

// Funkcja do daty (bez zmian)
function updateMatchDateTitle() {
    const title = document.querySelector('header h1');
    const today = new Date();
    const nextThursday = new Date(today);
    const dayOfWeek = today.getDay();
    let daysToAdd = (4 - dayOfWeek + 7) % 7;
    if (daysToAdd === 0 && (today.getHours() > 19 || (today.getHours() === 19 && today.getMinutes() > 30))) {
        daysToAdd = 7;
    }
    nextThursday.setDate(today.getDate() + daysToAdd);
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    const formattedDate = nextThursday.toLocaleDateString('pl-PL', options);
    title.textContent = `Zapisy na siatkówkę – ${formattedDate}`;
}
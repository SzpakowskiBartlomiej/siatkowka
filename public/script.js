// Zmienne globalne do zarządzania stanem
let allData = {};
let shoutboxCurrentPage = 1;
const itemsPerPage = 10;

// Stałe
const maxPlayers = 12;
const minPlayers = 8;
const playerTableBody = document.getElementById('player-table-body');
const absentTableBody = document.getElementById('absent-table-body');
const reserveSection = document.getElementById('reserve-section');
const reserveTableBody = document.getElementById('reserve-table-body');
const reserveCountElement = document.getElementById('reserve-count');
const playerCountElement = document.getElementById('player-count');
const matchStatusElement = document.getElementById('match-status');
const addPlayerForm = document.getElementById('player-form');
const addPlayerBtn = document.getElementById('add-player-btn');
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
        if (!Array.isArray(allData.presentPlayers)) allData.presentPlayers = [];
        if (!Array.isArray(allData.reservePlayers)) allData.reservePlayers = [];
        if (!Array.isArray(allData.absentPlayers)) allData.absentPlayers = [];
        renderUI();
    } catch (error) {
        console.error('Błąd pobierania danych:', error);
        allData = { presentPlayers: [], reservePlayers: [], absentPlayers: [], shoutboxMessages: [] };
        renderUI();
    }
}

// Funkcja do zapisywania DANYCH GRACZY na serwerze
async function savePlayerData(dataToSave) {
    try {
        const response = await fetch('/api/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                presentPlayers: dataToSave.presentPlayers,
                reservePlayers: dataToSave.reservePlayers,
                absentPlayers: dataToSave.absentPlayers
            }),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Nie udało się zapisać danych na serwerze.');
        }
    } catch (error) {
        console.error('Błąd zapisu danych:', error);
        alert(error.message);
    }
}

// Funkcja do zapisywania wiadomości w SHOUTBOXIE
async function saveShoutboxMessage(name, message) {
    try {
        const response = await fetch('/api/shoutbox', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, message })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Błąd serwera przy dodawaniu wiadomości.');
        }
    } catch (error) {
        console.error('Błąd wysyłania wiadomości:', error);
        alert(error.message);
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

// Pomocnicza funkcja: automatyczne promowanie graczy z listy rezerwowej na listę główną (maks. 12 graczy)
function promoteFromReserve() {
    if (!Array.isArray(allData.presentPlayers)) allData.presentPlayers = [];
    if (!Array.isArray(allData.reservePlayers)) allData.reservePlayers = [];
    
    let promoted = [];
    while (allData.presentPlayers.length < maxPlayers && allData.reservePlayers.length > 0) {
        const nextPlayer = allData.reservePlayers.shift();
        allData.presentPlayers.push(nextPlayer);
        promoted.push(nextPlayer);
    }
    return promoted;
}

// Renderuje cały interfejs użytkownika
function renderUI() {
    updateMatchDateTitle();
    playerTableBody.innerHTML = '';
    absentTableBody.innerHTML = '';

    // Renderowanie listy głównej (maks. 12 osób)
    allData.presentPlayers.forEach((player, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${index + 1}</td><td>${player}</td>`;
        playerTableBody.appendChild(row);
    });

    // Renderowanie listy rezerwowej (widoczna tylko gdy ktoś się na nią wpisze)
    if (allData.reservePlayers && allData.reservePlayers.length > 0) {
        if (reserveSection) reserveSection.style.display = 'block';
        if (reserveCountElement) reserveCountElement.textContent = `Lista rezerwowa (${allData.reservePlayers.length})`;
        if (reserveTableBody) {
            reserveTableBody.innerHTML = '';
            allData.reservePlayers.forEach((player, index) => {
                const row = document.createElement('tr');
                row.innerHTML = `<td>${index + 1}</td><td>${player}</td>`;
                reserveTableBody.appendChild(row);
            });
        }
    } else {
        if (reserveSection) reserveSection.style.display = 'none';
        if (reserveTableBody) reserveTableBody.innerHTML = '';
    }

    // Renderowanie listy nieobecnych
    allData.absentPlayers.forEach((player) => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${player}</td>`;
        absentTableBody.appendChild(row);
    });

    // Aktualizacja licznika i przycisku zapisu
    playerCountElement.textContent = `Zapisani gracze: ${allData.presentPlayers.length} / ${maxPlayers}`;

    if (addPlayerBtn) {
        if (allData.presentPlayers.length >= maxPlayers) {
            addPlayerBtn.textContent = 'Zapisz się na listę rezerwową';
            addPlayerBtn.classList.add('reserve-mode');
        } else {
            addPlayerBtn.textContent = 'Zapisz się';
            addPlayerBtn.classList.remove('reserve-mode');
        }
    }

    const isSummer = allData.summerBreak && allData.summerBreak.isActive;
    const banner = document.getElementById('summer-banner');
    const formsContainer = document.getElementById('registration-forms-container');
    const disabledMessage = document.getElementById('registration-disabled-message');
    const regInfoText = document.getElementById('registration-info-text');

    if (isSummer) {
        matchStatusElement.textContent = "Obecnie trwa przerwa wakacyjna. Gramy od września! ☀️🏐";
        matchStatusElement.style.color = "#d69e2e";
        
        if (banner) banner.style.display = 'flex';
        if (formsContainer) formsContainer.style.display = 'none';
        if (disabledMessage) disabledMessage.style.display = 'block';
        if (regInfoText) regInfoText.style.display = 'none';

        // Pokaż modal jeśli nie został zamknięty w tym sezonie
        const isClosed = localStorage.getItem('summerBreakPopupClosed_2026');
        const modal = document.getElementById('summer-modal');
        if (modal && !isClosed) {
            modal.style.display = 'flex';
        }
    } else {
        if (allData.presentPlayers.length >= minPlayers) {
            if (allData.presentPlayers.length >= maxPlayers) {
                const reserveNote = (allData.reservePlayers && allData.reservePlayers.length > 0)
                    ? ` (komplet ${maxPlayers} graczy, ${allData.reservePlayers.length} w rezerwie)`
                    : ` (komplet ${maxPlayers} graczy)`;
                matchStatusElement.textContent = `Mecz się ODBĘDZIE! 🎉${reserveNote}`;
            } else {
                matchStatusElement.textContent = `Mecz się ODBĘDZIE! 🎉 (${allData.presentPlayers.length} graczy, wolne miejsca: ${maxPlayers - allData.presentPlayers.length})`;
            }
            matchStatusElement.style.color = 'green';
        } else {
            matchStatusElement.textContent = `Mecz jeszcze się nie odbędzie. Brakuje ${minPlayers - allData.presentPlayers.length} graczy.`;
            matchStatusElement.style.color = 'red';
        }

        if (banner) banner.style.display = 'none';
        if (formsContainer) formsContainer.style.display = 'block';
        if (disabledMessage) disabledMessage.style.display = 'none';
        if (regInfoText) regInfoText.style.display = 'block';
    }

    renderShoutbox(allData.shoutboxMessages);
}

// --- EVENT LISTENERY ---
addPlayerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const newName = playerNameInput.value.trim();
    if (!newName) return;

    if (allData.presentPlayers.some(p => p.toLowerCase() === newName.toLowerCase())) {
        return alert('Ten gracz jest już zapisany na liście głównej!');
    }
    if (allData.reservePlayers && allData.reservePlayers.some(p => p.toLowerCase() === newName.toLowerCase())) {
        return alert('Ten gracz jest już zapisany na liście rezerwowej!');
    }

    // Usunięcie z listy nieobecnych jeśli tam był
    allData.absentPlayers = allData.absentPlayers.filter(p => p.toLowerCase() !== newName.toLowerCase());

    if (allData.presentPlayers.length < maxPlayers) {
        allData.presentPlayers.push(newName);
    } else {
        allData.reservePlayers.push(newName);
        alert(`Główna lista ma komplet 12 osób. "${newName}" został(a) zapisany/a na listę rezerwową (pozycja: ${allData.reservePlayers.length}).`);
    }

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

    const wasInPresent = allData.presentPlayers.some(p => p.toLowerCase() === newName.toLowerCase());
    allData.presentPlayers = allData.presentPlayers.filter(p => p.toLowerCase() !== newName.toLowerCase());
    if (allData.reservePlayers) {
        allData.reservePlayers = allData.reservePlayers.filter(p => p.toLowerCase() !== newName.toLowerCase());
    }
    allData.absentPlayers.push(newName);

    if (wasInPresent) {
        promoteFromReserve();
    }

    await savePlayerData(allData);
    await fetchData();
    absentNameInput.value = '';
});

removePlayerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const nameToRemove = playerNameRemoveInput.value.trim();
    if (!nameToRemove) return;

    const inPresent = allData.presentPlayers.some(p => p.toLowerCase() === nameToRemove.toLowerCase());
    const inReserve = allData.reservePlayers && allData.reservePlayers.some(p => p.toLowerCase() === nameToRemove.toLowerCase());
    const inAbsent = allData.absentPlayers.some(p => p.toLowerCase() === nameToRemove.toLowerCase());

    if (!inPresent && !inReserve && !inAbsent) {
        alert('Nie znaleziono gracza o takim imieniu.');
        return;
    }

    allData.presentPlayers = allData.presentPlayers.filter(p => p.toLowerCase() !== nameToRemove.toLowerCase());
    if (allData.reservePlayers) {
        allData.reservePlayers = allData.reservePlayers.filter(p => p.toLowerCase() !== nameToRemove.toLowerCase());
    }
    allData.absentPlayers = allData.absentPlayers.filter(p => p.toLowerCase() !== nameToRemove.toLowerCase());

    if (inPresent) {
        promoteFromReserve();
    }

    await savePlayerData(allData);
    await fetchData();
    playerNameRemoveInput.value = '';
});

shoutboxForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = shoutboxNameInput.value.trim();
    const message = shoutboxMessageInput.value.trim();
    if (!name || !message) return;

    await saveShoutboxMessage(name, message);
    shoutboxCurrentPage = 1;
    await fetchData();
    shoutboxMessageInput.value = '';
});

// Obsługa modala wakacyjnego
function setupModal() {
    const modal = document.getElementById('summer-modal');
    const closeSpan = document.querySelector('.close-modal');
    const closeBtn = document.getElementById('close-modal-btn');

    const closeModal = () => {
        if (modal) modal.style.display = 'none';
        localStorage.setItem('summerBreakPopupClosed_2026', 'true');
    };

    if (closeSpan) closeSpan.addEventListener('click', closeModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });
}

// Wczytanie i renderowanie danych po załadowaniu strony
document.addEventListener('DOMContentLoaded', async () => {
    setupModal();
    await fetchData();
});

// Funkcja do daty
function updateMatchDateTitle() {
    const title = document.querySelector('header h1');
    if (allData.summerBreak && allData.summerBreak.isActive) {
        title.textContent = `Zapisy na siatkówkę – Przerwa Wakacyjna ☀️`;
        return;
    }

    if (allData.matchDate) {
        const [year, month, day] = allData.matchDate.split('-').map(Number);
        const matchDate = new Date(year, month - 1, day);
        const options = { day: 'numeric', month: 'long', year: 'numeric' };
        const formattedDate = matchDate.toLocaleDateString('pl-PL', options);
        title.textContent = `Zapisy na siatkówkę – ${formattedDate}`;
        return;
    }

    const today = new Date();
    const nextThursday = new Date(today);
    const dayOfWeek = today.getDay();
    let daysToAdd = (4 - dayOfWeek + 7) % 7;
    nextThursday.setDate(today.getDate() + daysToAdd);
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    const formattedDate = nextThursday.toLocaleDateString('pl-PL', options);
    title.textContent = `Zapisy na siatkówkę – ${formattedDate}`;
}
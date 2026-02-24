// Zmienne globalne
let historyCurrentPage = 1;
const itemsPerPage = 10;

// Uniwersalna funkcja do renderowania przycisków stronicowania
function renderPagination(containerId, currentPage, totalItems, onPageChange) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    if (totalPages <= 1) return;

    const prevButton = document.createElement('button');
    prevButton.textContent = '«';
    prevButton.classList.add('pagination-button');
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener('click', () => onPageChange(currentPage - 1));
    container.appendChild(prevButton);

    for (let i = 1; i <= totalPages; i++) {
        const pageButton = document.createElement('button');
        pageButton.textContent = i;
        pageButton.classList.add('pagination-button');
        if (i === currentPage) pageButton.classList.add('active');
        pageButton.addEventListener('click', () => onPageChange(i));
        container.appendChild(pageButton);
    }

    const nextButton = document.createElement('button');
    nextButton.textContent = '»';
    nextButton.classList.add('pagination-button');
    nextButton.disabled = currentPage === totalPages;
    nextButton.addEventListener('click', () => onPageChange(currentPage + 1));
    container.appendChild(nextButton);
}

// Główna funkcja renderująca historię
function renderHistory(historyData) {
    const historyContainer = document.getElementById('history-container');
    historyContainer.innerHTML = '';

    if (!historyData || historyData.length === 0) {
        historyContainer.innerHTML = '<p>Brak danych historycznych.</p>';
        return;
    }

    const startIndex = (historyCurrentPage - 1) * itemsPerPage;
    const paginatedHistory = historyData.slice(startIndex, startIndex + itemsPerPage);

    paginatedHistory.forEach(entry => {
        const entryDiv = document.createElement('div');
        entryDiv.classList.add('history-entry');
        const date = new Date(entry.date);
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const formattedDate = date.toLocaleDateString('pl-PL', options);
        let playersList = entry.players.map(player => `<li>${player}</li>`).join('');
        entryDiv.innerHTML = `
            <h2>Obecność w dniu: ${formattedDate} (${entry.players.length} osób)</h2>
            <ul>${playersList}</ul>
        `;
        historyContainer.appendChild(entryDiv);
    });

    renderPagination('history-pagination', historyCurrentPage, historyData.length, (newPage) => {
        historyCurrentPage = newPage;
        renderHistory(historyData);
    });
}

// Inicjalizacja po załadowaniu strony
document.addEventListener('DOMContentLoaded', async () => {
    const historyContainer = document.getElementById('history-container');
    try {
        const response = await fetch('/api/data');
        if (!response.ok) throw new Error('Nie udało się pobrać danych historycznych.');
        const data = await response.json();
        renderHistory(data.attendanceHistory || []);
    } catch (error) {
        console.error(error);
        historyContainer.innerHTML = '<p>Wystąpił błąd podczas ładowania historii.</p>';
    }
});
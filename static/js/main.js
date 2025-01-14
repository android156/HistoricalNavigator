document.addEventListener('DOMContentLoaded', function() {
    const searchForm = document.getElementById('searchForm');
    const historicalInfo = document.getElementById('historicalInfo');
    const timeFromInput = document.getElementById('timeFrom');
    const timeToInput = document.getElementById('timeTo');
    const locationInput = document.getElementById('locationInput');

    // Обработка отправки формы
    searchForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const coords = getCurrentMarkerPosition();
        if (!coords) {
            alert('Пожалуйста, выберите точку на карте или введите место');
            return;
        }

        const timeFrom = timeFromInput.value.trim();
        const timeTo = timeToInput.value.trim();

        if (!timeFrom || !timeTo) {
            alert('Пожалуйста, укажите временной период');
            return;
        }

        searchForm.classList.add('loading');
        const searchButton = searchForm.querySelector('button[type="submit"]');
        searchButton.disabled = true;
        historicalInfo.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"></div></div>';

        try {
            const response = await fetch('/api/historical-data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    latitude: coords[0],
                    longitude: coords[1],
                    timePeriod: `${timeFrom}-${timeTo}`
                })
            });

            const data = await response.json();

            if (response.ok) {
                displayHistoricalData(data);
            } else {
                throw new Error(data.error || 'Не удалось получить исторические данные');
            }
        } catch (error) {
            historicalInfo.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
        } finally {
            searchForm.classList.remove('loading');
            searchButton.disabled = false;
        }
    });

    // Поиск места при вводе и нажатии Enter
    locationInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const query = this.value.trim();
            if (query) {
                searchLocation(query);
            }
        }
    });

    function displayHistoricalData(data) {
        const html = `
            <div class="historical-data">
                <h5 class="mb-4">Территория: ${data.territory}</h5>

                <div class="mb-4">
                    <h6>События:</h6>
                    <div class="ms-3">
                        ${data.events.map(event => `
                            <div class="historical-event">${event}</div>
                        `).join('')}
                    </div>
                </div>

                <div class="mb-4">
                    <h6>Культура и быт:</h6>
                    <div class="ms-3">
                        <p><strong>Архитектура:</strong> ${data.culture.architecture}</p>
                        <p><strong>Одежда:</strong> ${data.culture.clothing}</p>
                        <p><strong>Технологии:</strong> ${data.culture.technology}</p>
                    </div>
                </div>

                <div class="mb-4">
                    <h6>Правители:</h6>
                    <div class="ms-3">
                        ${data.rulers.map(ruler => `
                            <div class="mb-2">• ${ruler}</div>
                        `).join('')}
                    </div>
                </div>

                <div class="mt-4">
                    <p class="text-muted">${data.description}</p>
                </div>
            </div>
        `;

        historicalInfo.innerHTML = html;
    }
});
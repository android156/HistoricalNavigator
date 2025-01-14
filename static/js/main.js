document.addEventListener('DOMContentLoaded', function() {
    const searchButton = document.getElementById('searchButton');
    const historicalInfo = document.getElementById('historicalInfo');
    const timeFromInput = document.getElementById('timeFrom');
    const timeToInput = document.getElementById('timeTo');
    const locationInput = document.getElementById('locationInput');
    const searchLocationButton = document.getElementById('searchLocation');

    // Обработка поиска места
    searchLocationButton.addEventListener('click', function() {
        const query = locationInput.value.trim();
        if (query) {
            searchLocation(query);
        }
    });

    // Поиск при нажатии Enter в поле ввода места
    locationInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            const query = this.value.trim();
            if (query) {
                searchLocation(query);
            }
        }
    });

    searchButton.addEventListener('click', async function() {
        const coords = getCurrentMarkerPosition();
        if (!coords) {
            alert('Пожалуйста, выберите точку на карте');
            return;
        }

        const timeFrom = timeFromInput.value.trim();
        const timeTo = timeToInput.value.trim();

        if (!timeFrom || !timeTo) {
            alert('Пожалуйста, укажите временной период');
            return;
        }

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
                throw new Error(data.error || 'Failed to fetch historical data');
            }
        } catch (error) {
            historicalInfo.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
        } finally {
            searchButton.disabled = false;
        }
    });

    function displayHistoricalData(data) {
        const html = `
            <div class="historical-data">
                <h6 class="mb-3">Территория: ${data.territory}</h6>

                <div class="mb-3">
                    <h6>События:</h6>
                    <ul class="list-unstyled">
                        ${data.events.map(event => `
                            <li class="historical-event">${event}</li>
                        `).join('')}
                    </ul>
                </div>

                <div class="mb-3">
                    <h6>Культура:</h6>
                    <div class="ms-3">
                        <p><strong>Архитектура:</strong> ${data.culture.architecture}</p>
                        <p><strong>Одежда:</strong> ${data.culture.clothing}</p>
                        <p><strong>Технологии:</strong> ${data.culture.technology}</p>
                    </div>
                </div>

                <div class="mb-3">
                    <h6>Правители:</h6>
                    <ul class="list-unstyled">
                        ${data.rulers.map(ruler => `
                            <li class="ms-3">• ${ruler}</li>
                        `).join('')}
                    </ul>
                </div>

                <div class="mt-3">
                    <p class="text-muted">${data.description}</p>
                </div>
            </div>
        `;

        historicalInfo.innerHTML = html;
    }
});
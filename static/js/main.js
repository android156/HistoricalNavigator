document.addEventListener('DOMContentLoaded', function() {
    const searchForm = document.getElementById('searchForm');
    const historicalInfo = document.getElementById('historicalInfo');
    const timePeriodInput = document.getElementById('timePeriod');
    const locationInput = document.getElementById('locationInput');

    function parseTimePeriod(input) {
        input = input.trim();

        // Проверка формата DD.MM.YYYY
        const dateRegex = /^(\d{2})\.(\d{2})\.(\d{4})$/;
        if (dateRegex.test(input)) {
            const [_, day, month, year] = input.match(dateRegex);
            return `${year}`;
        }

        // Проверка формата YYYY-YYYY
        const periodRegex = /^(\d{1,4})-(\d{1,4})$/;
        if (periodRegex.test(input)) {
            return input;
        }

        // Проверка формата YYYY
        const yearRegex = /^\d{1,4}$/;
        if (yearRegex.test(input)) {
            return input;
        }

        throw new Error('Неверный формат даты. Используйте: ГГГГ, ГГГГ-ГГГГ или ДД.ММ.ГГГГ');
    }

    async function fetchHistoricalData(coords, timePeriod) {
        try {
            const response = await fetch('/api/historical-data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    latitude: coords[0],
                    longitude: coords[1],
                    timePeriod: timePeriod
                })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || data.details || 'Не удалось получить исторические данные');
            }
            return data;
        } catch (error) {
            console.error('Ошибка при получении исторических данных:', error);
            throw error;
        }
    }

    // Обработка отправки формы
    searchForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        let locationQuery = locationInput.value.trim();
        let timePeriod = timePeriodInput.value.trim();

        // Set default values
        if (!locationQuery) {
            locationQuery = 'Москва';
            locationInput.value = locationQuery;
        }
        if (!timePeriod) {
            const currentYear = new Date().getFullYear();
            timePeriod = currentYear.toString();
            timePeriodInput.value = timePeriod;
        }

        searchForm.classList.add('loading');
        const searchButton = searchForm.querySelector('button[type="submit"]');
        searchButton.disabled = true;
        historicalInfo.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"></div></div>';

        try {
            // Парсим и валидируем временной период
            const parsedTimePeriod = parseTimePeriod(timePeriod);

            let coords;
            if (locationQuery) {
                try {
                    // Если введено место - ищем его координаты
                    coords = await searchLocation(locationQuery);
                } catch (error) {
                    throw new Error(`Ошибка поиска места: ${error.message}`);
                }
            } else {
                // Иначе берем координаты текущего маркера
                coords = getCurrentMarkerPosition();
                if (!coords) {
                    throw new Error('Пожалуйста, выберите точку на карте или введите место');
                }
            }

            const data = await fetchHistoricalData(coords, parsedTimePeriod);
            displayHistoricalData(data);
        } catch (error) {
            historicalInfo.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
        } finally {
            searchForm.classList.remove('loading');
            searchButton.disabled = false;
        }
    });

    // Поиск места при нажатии Enter в поле ввода места
    locationInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchForm.dispatchEvent(new Event('submit'));
        }
    });

    function displayHistoricalData(data) {
        const html = `
            <div class="historical-data">
                <h5 class="mb-4">Территория: ${data.territory}</h5>

                ${data.image_url ? `
                    <div class="mb-4">
                        <div class="historical-image">
                            <img src="${data.image_url}" alt="Историческая визуализация" class="img-fluid rounded">
                        </div>
                    </div>
                ` : ''}

                <div class="mb-4">
                    <h6>Общие события:</h6>
                    <div class="ms-3">
                        ${data.events.map(event => `
                            <div class="historical-event">
                                <span class="event-year">${event.year}</span>
                                ${event.wiki_url ? 
                                    `<a href="${event.wiki_url}" target="_blank" class="event-link">${event.text}</a>` :
                                    `<span>${event.text}</span>`
                                }
                            </div>
                        `).join('')}
                    </div>
                </div>

                ${data.local_events && data.local_events.length > 0 ? `
                    <div class="mb-4">
                        <h6>Местные события:</h6>
                        <div class="ms-3">
                            ${data.local_events.map(event => `
                                <div class="historical-event">
                                    <span class="event-year">${event.year}</span>
                                    <strong class="event-location">${event.location}:</strong>
                                    ${event.wiki_url ? 
                                        `<a href="${event.wiki_url}" target="_blank" class="event-link">${event.text}</a>` :
                                        `<span>${event.text}</span>`
                                    }
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

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

                ${data.museum_artifacts && data.museum_artifacts.length > 0 ? `
                    <div class="mb-4">
                        <h6>Музейные артефакты:</h6>
                        <div class="row">
                            ${data.museum_artifacts.map(artifact => `
                                <div class="col-md-6 mb-3">
                                    <div class="card h-100">
                                        ${artifact.image_url ? `
                                            <img src="${artifact.image_url}" class="card-img-top" alt="${artifact.title}">
                                        ` : ''}
                                        <div class="card-body">
                                            <h6 class="card-title">${artifact.title}</h6>
                                            <p class="card-text">${artifact.description}</p>
                                            <p class="text-muted">Источник: ${artifact.source_museum}</p>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <div class="mt-4">
                    <p class="text-muted">${data.description}</p>
                </div>
            </div>
        `;

        historicalInfo.innerHTML = html;
    }
});
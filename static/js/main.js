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

    
});
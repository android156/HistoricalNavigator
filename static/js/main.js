document.addEventListener('DOMContentLoaded', function() {
    const searchForm = document.getElementById('searchForm');
    const historicalInfo = document.getElementById('historicalInfo');
    const timePeriodInput = document.getElementById('timePeriod');
    const locationInput = document.getElementById('locationInput');
    
    // Initialize gallery
    initializeGallery();
    
    // Initialize modal events
    const imageModal = new bootstrap.Modal(document.getElementById('imageModal'));
    document.querySelectorAll('.carousel-item img').forEach(img => {
        img.addEventListener('click', function() {
            document.getElementById('modalImage').src = this.src;
            document.getElementById('imageModalLabel').textContent = this.getAttribute('data-location');
            imageModal.show();
        });
    });

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

            const text = await response.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                console.error('Invalid JSON response:', text);
                throw new Error('Некорректный ответ сервера: ' + text);
            }

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

    async function initializeGallery() {
        try {
            const response = await fetch('/api/historical-points');
            const points = await response.json();
            
            // Shuffle points array
            // Filter points that have both image_url and response_data
            const validPoints = points.filter(point => {
                return point.image_url && 
                       point.response_data && 
                       point.image_url !== 'Historical Image' &&
                       !point.image_url.includes('undefined') &&
                       point.image_url.trim() !== '';
            });
            
            // Shuffle the filtered points
            const shuffledPoints = validPoints.sort(() => Math.random() - 0.5);
            
            const carouselInner = document.getElementById('carouselInner');
            carouselInner.innerHTML = '';
            
            if (shuffledPoints.length === 0) {
                carouselInner.innerHTML = '<div class="carousel-item active"><p class="text-center p-5">Нет доступных изображений</p></div>';
                return;
            }
            
            const itemsPerRow = window.innerWidth < 768 ? 1 : 
                              window.innerWidth < 992 ? 2 : 
                              window.innerWidth < 1200 ? 3 : 4;
            
            document.documentElement.style.setProperty('--items-per-row', itemsPerRow);

            for (let i = 0; i < shuffledPoints.length; i += itemsPerRow) {
                const div = document.createElement('div');
                div.className = `carousel-item ${i === 0 ? 'active' : ''}`;
                const row = document.createElement('div');
                row.className = 'd-flex gallery-row';
                div.appendChild(row);
                
                for (let j = i; j < i + itemsPerRow && j < shuffledPoints.length; j++) {
                    const point = shuffledPoints[j];
                    const locationText = `${point.response_data.territory}, ${point.time_period}`;
                    
                    div.innerHTML += `
                        <div class="gallery-column">
                            <div class="gallery-item">
                                <div class="image-location-overlay">${locationText}</div>
                                <img src="${point.image_url}" 
                                     class="img-fluid" 
                                     alt="Historical Image"
                                     data-location="${locationText}">
                            </div>
                        </div>
                    `;
                }
                
                div.innerHTML += '</div>';
                carouselInner.appendChild(div);
            }

            // Update carousel on window resize
            window.addEventListener('resize', () => {
                initializeGallery();
            });
        } catch (error) {
            console.error('Error loading gallery:', error);
        }
    }
});
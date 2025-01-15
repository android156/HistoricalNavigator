document.addEventListener('DOMContentLoaded', function() {
    const searchForm = document.getElementById('searchForm');
    const historicalInfo = document.getElementById('historicalInfo');
    const timePeriodInput = document.getElementById('timePeriod');
    const locationInput = document.getElementById('locationInput');
    
    // Initialize modal
    const imageModal = new bootstrap.Modal(document.getElementById('imageModal'));
    
    // Initialize gallery
    initializeGallery().then(() => {
        // Initialize modal events after gallery is loaded
        document.querySelectorAll('.carousel-item img').forEach(img => {
            img.addEventListener('click', function() {
                document.getElementById('modalImage').src = this.src;
                document.getElementById('imageModalLabel').textContent = this.getAttribute('data-location');
                imageModal.show();
            });
        });
    }).catch(error => {
        console.error('Error initializing gallery:', error);
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
            
            const validPoints = points.filter(point => {
                return point.image_url && 
                       point.response_data && 
                       point.image_url !== 'Historical Image' &&
                       !point.image_url.includes('undefined') &&
                       point.image_url.trim() !== '';
            });
            
            const shuffledPoints = validPoints.sort(() => Math.random() - 0.5);
            const carouselInner = document.getElementById('carouselInner');
            const galleryCarousel = document.querySelector('.gallery-carousel');
            carouselInner.innerHTML = '';
            
            if (shuffledPoints.length === 0) {
                carouselInner.innerHTML = '<div class="carousel-item active"><p class="text-center p-5">Нет доступных изображений</p></div>';
                return;
            }

            // Check if we should display dual images
            const containerWidth = galleryCarousel.offsetWidth;
            const containerHeight = 300; // Fixed height from CSS
            const isDual = containerWidth / containerHeight > 2.5;
            
            if (isDual) {
                galleryCarousel.classList.add('gallery-dual');
                
                // Create slides with two images each
                for (let i = 0; i < shuffledPoints.length; i += 2) {
                    const div = document.createElement('div');
                    div.className = `carousel-item ${i === 0 ? 'active' : ''}`;
                    
                    const points = [shuffledPoints[i]];
                    if (i + 1 < shuffledPoints.length) {
                        points.push(shuffledPoints[i + 1]);
                    }
                    
                    div.innerHTML = points.map(point => {
                        const locationText = `${point.response_data.territory}, ${point.time_period}`;
                        return `
                            <div class="gallery-image-container">
                                <div class="image-location-overlay">${locationText}</div>
                                <img src="${point.image_url}" 
                                     alt="Historical Image"
                                     data-location="${locationText}">
                            </div>
                        `;
                    }).join('');
                    
                    carouselInner.appendChild(div);
                }
            } else {
                galleryCarousel.classList.remove('gallery-dual');
                
                // Single image display
                shuffledPoints.forEach((point, index) => {
                    const div = document.createElement('div');
                    div.className = `carousel-item ${index === 0 ? 'active' : ''}`;
                    
                    const locationText = `${point.response_data.territory}, ${point.time_period}`;
                    div.innerHTML = `
                        <div class="gallery-image-container">
                            <div class="image-location-overlay">${locationText}</div>
                            <img src="${point.image_url}" 
                                 alt="Historical Image"
                                 data-location="${locationText}">
                        </div>
                    `;
                    
                    carouselInner.appendChild(div);
                });
            }
            
            // Reinitialize click handlers for the modal
            document.querySelectorAll('.carousel-item img').forEach(img => {
                img.addEventListener('click', function() {
                    document.getElementById('modalImage').src = this.src;
                    document.getElementById('imageModalLabel').textContent = this.getAttribute('data-location');
                    imageModal.show();
                });
            });
        } catch (error) {
            console.error('Error loading gallery:', error);
        }
    }
});
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
            const containerHeight = 300;
            const isDual = containerWidth / containerHeight > 2.5;

            galleryCarousel.classList.toggle('gallery-dual', isDual);

            function createSlide(points, isActive) {
                const slide = document.createElement('div');
                slide.className = `carousel-item ${isActive ? 'active' : ''}`;
                
                points.forEach(point => {
                    const container = document.createElement('div');
                    container.className = 'gallery-image-container';
                    
                    const locationOverlay = document.createElement('div');
                    locationOverlay.className = 'image-location-overlay';
                    locationOverlay.textContent = `${point.response_data.territory}, ${point.time_period}`;
                    
                    const img = document.createElement('img');
                    img.src = point.image_url;
                    img.alt = 'Historical Image';
                    img.setAttribute('data-location', `${point.response_data.territory}, ${point.time_period}`);
                    
                    container.appendChild(locationOverlay);
                    container.appendChild(img);
                    slide.appendChild(container);
                });
                
                return slide;
            }

            // Create all slides
            for (let i = 0; i < shuffledPoints.length; i++) {
                const points = isDual ? 
                    [shuffledPoints[i], i + 1 < shuffledPoints.length ? shuffledPoints[i + 1] : null].filter(Boolean) : 
                    [shuffledPoints[i]];

                if (points.length > 0) {
                    carouselInner.appendChild(createSlide(points, i === 0));
                }
            }

            // Initialize carousel with proper settings
            const carousel = new bootstrap.Carousel(document.getElementById('imageCarousel'), {
                interval: 5000,
                keyboard: true,
                pause: 'hover',
                ride: 'carousel',
                wrap: true
            });

            // Функция для обновления количества изображений в слайде
            const updateGalleryLayout = () => {
                const galleryCarousel = document.querySelector('.gallery-carousel');
                const containerWidth = galleryCarousel.offsetWidth;
                const containerHeight = 300;
                const isDual = containerWidth / containerHeight > 2.5;
                
                galleryCarousel.classList.toggle('gallery-dual', isDual);
                
                // Перестраиваем слайды
                const carouselInner = document.getElementById('carouselInner');
                carouselInner.innerHTML = '';
                
                for (let i = 0; i < shuffledPoints.length; i++) {
                    const points = isDual ? 
                        [shuffledPoints[i], i + 1 < shuffledPoints.length ? shuffledPoints[i + 1] : null].filter(Boolean) : 
                        [shuffledPoints[i]];
                    
                    if (points.length > 0) {
                        carouselInner.appendChild(createSlide(points, i === 0));
                    }
                }
            };

            // Обновляем layout при изменении размера окна
            window.addEventListener('resize', updateGalleryLayout);
            updateGalleryLayout(); // Инициализация

            // Add controls functionality
            document.querySelector('.carousel-control-prev').addEventListener('click', () => {
                carousel.prev();
            });
            
            document.querySelector('.carousel-control-next').addEventListener('click', () => {
                carousel.next();
            });


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
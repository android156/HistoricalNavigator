let map;
let marker;

let historicalPoints = [];

function initMap() {
    map = new ymaps.Map('map', {
        center: [55.76, 37.64],
        zoom: 7,
        controls: ['zoomControl']
    });

    loadHistoricalPoints();

    // Handle clicks on map
    map.events.add('click', function (e) {
        const coords = e.get('coords');
        setMarkerAndGetAddress(coords);
    });

    // Log map movements
    map.events.add('boundschange', function (e) {
        logMapAction('map_move', {
            center: map.getCenter(),
            zoom: map.getZoom(),
            type: e.get('type')
        });
    });
}

function setMarkerAndGetAddress(coords) {
    if (marker) {
        map.geoObjects.remove(marker);
    }

    marker = new ymaps.Placemark(coords, {}, {
        preset: 'islands#redDotIcon',
        draggable: true
    });

    map.geoObjects.add(marker);
    map.setCenter(coords);

    logMapAction('marker_placed', {
        coordinates: coords
    });

    // Get address for coordinates
    ymaps.geocode(coords).then(function (res) {
        const firstGeoObject = res.geoObjects.get(0);
        if (firstGeoObject) {
            const country = firstGeoObject.getCountry() || '';
            const adminAreas = firstGeoObject.getAdministrativeAreas() || [];
            const locality = firstGeoObject.getLocalities()[0] || 
                           firstGeoObject.getAdministrativeAreas()[0] || 
                           'Населенный пункт не найден';

            // Build hierarchy from country to locality
            const addressParts = [country, ...adminAreas, locality].filter(Boolean);
            const fullAddress = addressParts.join(', ');

            document.getElementById('locationInput').value = fullAddress;
        } else {
            document.getElementById('locationInput').value = 'Адрес не найден';
        }
    });

    // Handle marker drag
    marker.events.add('dragend', function () {
        const newCoords = marker.geometry.getCoordinates();
        setMarkerAndGetAddress(newCoords);
        logMapAction('marker_moved', {
            coordinates: newCoords
        });
    });
}

function searchLocation(query) {
    return new Promise((resolve, reject) => {
        if (!query) {
            reject(new Error('Введите название места'));
            return;
        }

        ymaps.geocode(query).then(function (res) {
            const firstGeoObject = res.geoObjects.get(0);
            if (firstGeoObject) {
                const coords = firstGeoObject.geometry.getCoordinates();
                setMarkerAndGetAddress(coords);
                resolve(coords);
            } else {
                reject(new Error('Место не найдено'));
            }
        }).catch(function(error) {
            console.error('Ошибка геокодирования:', error);
            reject(new Error('Ошибка при поиске места'));
        });
    });
}

function getCurrentMarkerPosition() {
    return marker ? marker.geometry.getCoordinates() : null;
}

function logMapAction(type, data) {
    fetch('/api/log', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            type: type,
            data: data
        })
    }).catch(console.error);
}

// Initialize map when API is ready
ymaps.ready(function() {
    try {
        initMap();
    } catch (error) {
        console.error('Ошибка инициализации карты:', error);
    }
});

function displayHistoricalData(data) {
    const historicalInfo = document.getElementById('historicalInfo');
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

async function loadHistoricalPoints() {
    try {
        const response = await fetch('/api/historical-points');
        const data = await response.json();

        if (!Array.isArray(data)) {
            console.error('Expected array of points, got:', data);
            return;
        }

        // Очищаем текущие точки
        map.geoObjects.removeAll();
        historicalPoints = [];

        const pointCollection = new ymaps.GeoObjectCollection();
        const MIN_DISTANCE = 0.0005; // Минимальное расстояние между точками
        const points = [...data];
        const adjustedPoints = new Map();

        // Находим усредненный центр для перекрывающихся точек
        const groupPoints = {};
        points.forEach(point => {
            const baseKey = `${Math.round(point.latitude * 1000) / 1000},${Math.round(point.longitude * 1000) / 1000}`;
            if (!groupPoints[baseKey]) {
                groupPoints[baseKey] = [];
            }
            groupPoints[baseKey].push(point);
        });

        // Обрабатываем каждую группу точек
        Object.entries(groupPoints).forEach(([baseKey, groupedPoints]) => {
            if (groupedPoints.length === 1) {
                // Если точка одна, используем её оригинальные координаты
                const point = groupedPoints[0];
                adjustedPoints.set(`${point.latitude},${point.longitude}`, point);
            } else {
                // Для группы точек вычисляем средний центр и размещаем по спирали
                const avgLat = groupedPoints.reduce((sum, p) => sum + p.latitude, 0) / groupedPoints.length;
                const avgLon = groupedPoints.reduce((sum, p) => sum + p.longitude, 0) / groupedPoints.length;

                groupedPoints.forEach((point, index) => {
                    if (index === 0) {
                        // Первая точка в центре
                        adjustedPoints.set(`${avgLat},${avgLon}`, point);
                    } else {
                        // Остальные точки по спирали
                        const angle = ((index - 1) * Math.PI / 4);
                        const spiralRadius = MIN_DISTANCE * (1 + Math.floor((index - 1) / 8));
                        const adjustedLat = avgLat + spiralRadius * Math.cos(angle);
                        const adjustedLon = avgLon + spiralRadius * Math.sin(angle);
                        adjustedPoints.set(`${adjustedLat},${adjustedLon}`, point);
                    }
                });
            }
        });

        points.forEach((point, index) => {
            let baseCoords = [point.latitude, point.longitude];
            let adjustedCoords = [...baseCoords];
            let iteration = 0;
            const maxIterations = 16; // Максимальное количество попыток размещения

            // Проверяем перекрытие и корректируем позицию
            while (iteration < maxIterations) {
                let hasOverlap = false;

                for (let [existingCoords] of adjustedPoints) {
                    const [existingLat, existingLon] = existingCoords.split(',').map(Number);
                    const dist = Math.sqrt(
                        Math.pow(adjustedCoords[0] - existingLat, 2) + 
                        Math.pow(adjustedCoords[1] - existingLon, 2)
                    );

                    if (dist < MIN_DISTANCE) {
                        hasOverlap = true;
                        break;
                    }
                }

                if (!hasOverlap) {
                    break;
                }

                // Размещаем точки по спирали с увеличивающимся радиусом
                const angle = (iteration * Math.PI / 4);
                const spiralRadius = MIN_DISTANCE * (1 + Math.floor(iteration / 8));
                adjustedCoords = [
                    baseCoords[0] + spiralRadius * Math.cos(angle),
                    baseCoords[1] + spiralRadius * Math.sin(angle)
                ];

                iteration++;
            }

            adjustedPoints.set(`${adjustedCoords[0]},${adjustedCoords[1]}`, point);

            const placemark = new ymaps.Placemark(
                adjustedCoords,
                {
                    balloonContentHeader: `${point.response_data.territory}, ${point.time_period}`,
                    balloonContentBody: point.response_data.description || '',
                    hintContent: `${point.response_data.territory}, ${point.time_period}`
                },
                {
                    preset: 'islands#nightCircleDotIcon',
                    iconColor: '#0066ff',
                    zIndex: 1000 + index,
                    zIndexHover: 1100 + index,
                    zIndexActive: 1200 + index
                }
            );

            placemark.events.add('click', () => {
                if (point.response_data) {
                    displayHistoricalData(point.response_data);
                }
            });

            pointCollection.add(placemark);
            historicalPoints.push(placemark);
        });

        map.geoObjects.add(pointCollection);
    } catch (error) {
        console.error('Error loading historical points:', error);
    }
}

// Экспортируем функции для использования в main.js
window.searchLocation = searchLocation;
window.getCurrentMarkerPosition = getCurrentMarkerPosition;
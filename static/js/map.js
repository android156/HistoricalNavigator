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

        // Функция для кластеризации точек
        function clusterPoints(points, zoom) {
            const clusters = {};
            const gridSize = 50 / Math.pow(2, zoom - 3); // Размер сетки уменьшается с увеличением зума

            points.forEach(point => {
                const key = Math.floor(point.latitude / gridSize) + ',' + 
                          Math.floor(point.longitude / gridSize);
                if (!clusters[key]) {
                    clusters[key] = [];
                }
                clusters[key].push(point);
            });
            return clusters;
        }

        // Функция для распределения точек по спирали
        function calculateSpiralPosition(center, index, totalPoints) {
            if (totalPoints <= 1) return center;
            
            const angle = index * (2 * Math.PI) / totalPoints;
            const radius = 0.002 * Math.ceil(index / 4);
            return [
                center[0] + radius * Math.cos(angle),
                center[1] + radius * Math.sin(angle)
            ];
        }

let currentClusters = clusterPoints(data, map.getZoom());

// Обработчик изменения масштаба
map.events.add('boundschange', function() {
    currentClusters = clusterPoints(data, map.getZoom());
    updateMarkers();
});

function updateMarkers() {
    // Очищаем текущие маркеры
    historicalPoints.forEach(point => {
        map.geoObjects.remove(point.placemark);
    });
    historicalPoints = [];

    Object.entries(currentClusters).forEach(([key, points]) => {
        const avgLat = points.reduce((sum, p) => sum + p.latitude, 0) / points.length;
        const avgLon = points.reduce((sum, p) => sum + p.longitude, 0) / points.length;

        if (points.length === 1) {
            const point = points[0];
            const placemark = new ymaps.Placemark(
            [point.latitude, point.longitude],
            {
                balloonContentHeader: `${point.response_data.territory}, ${point.time_period}`,
                balloonContentBody: `${point.response_data.description || ''}`,
                hintContent: `${point.response_data.territory}, ${point.time_period}`
            },
            {
                preset: 'islands#nightCircleDotIcon',
                iconImageSize: [4, 4],
                iconImageOffset: [-2, -2],
                zIndex: 1000
            }
        );

            placemark.events.add('click', () => displayHistoricalData(point.response_data));
            map.geoObjects.add(placemark);
            historicalPoints.push({ placemark, data: point });
        } else {
            // Создаем кластерный маркер
            const placemark = new ymaps.Placemark(
                [avgLat, avgLon],
                {
                    balloonContentHeader: `${points.length} точек`,
                    balloonContentBody: points.map(p => 
                        `${p.response_data.territory}, ${p.time_period}`).join('<br>'),
                    hintContent: `${points.length} исторических точек`
                },
                {
                    preset: 'islands#blueCircleDotIconWithCaption',
                    iconCaption: points.length.toString(),
                    iconCaptionMaxWidth: '50',
                    zIndex: 2000
                }
            );

            placemark.events.add('click', () => {
                if (map.getZoom() < 14) {
                    // Увеличиваем масштаб при клике на кластер
                    map.setCenter([avgLat, avgLon], Math.min(map.getZoom() + 2, 14));
                } else {
                    // Показываем балун с информацией о точках
                    placemark.balloon.open();
                }
            });
            
            map.geoObjects.add(placemark);
            historicalPoints.push({ placemark, data: points });
        }
    });
}

updateMarkers();
    } catch (error) {
        console.error('Error loading historical points:', error);
    }
}

// Экспортируем функции для использования в main.js
window.searchLocation = searchLocation;
window.getCurrentMarkerPosition = getCurrentMarkerPosition;

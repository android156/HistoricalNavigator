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


    // Обновляем точки при изменении зума
    map.events.add('boundschange', function (e) {
        if (e.get('oldZoom') !== e.get('newZoom')) {
            loadHistoricalPoints();
        }
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

        // Check and generate missing images
        for (const point of data) {
            if (!point.image_url) {
                try {
                    const imageResponse = await fetch('/api/historical-data', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            latitude: point.latitude,
                            longitude: point.longitude,
                            timePeriod: point.time_period,
                            regenerateImage: true
                        })
                    });
                    const newData = await imageResponse.json();
                    if (newData.image_url) {
                        point.image_url = newData.image_url;
                    }
                } catch (error) {
                    console.error('Error generating image for point:', error);
                }
            }
        }

        // Очищаем текущие точки
        map.geoObjects.removeAll();
        historicalPoints = [];

        const pointCollection = new ymaps.GeoObjectCollection();
        const bounds = map.getBounds();
        const arrangedPoints = arrangePointsSpirally(data, {
            contains: coords => {
                return coords[0] >= bounds[0][0] && 
                       coords[0] <= bounds[1][0] && 
                       coords[1] >= bounds[0][1] && 
                       coords[1] <= bounds[1][1];
            }
        });

        arrangedPoints.forEach(({point, coords}, index) => {
                const placemark = new ymaps.Placemark(
                    coords,
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

function arrangePointsSpirally(points, options = {}) {
    const MIN_DISTANCE = 0.001; // Увеличенное минимальное расстояние между точками
    const result = [];

    //Apply bounds filter if provided
    const filteredPoints = options.contains ? points.filter(point => options.contains([point.latitude, point.longitude])) : points;


    // Группируем точки по близости координат
    const groups = {};
    filteredPoints.forEach(point => {
        const key = `${Math.round(point.latitude * 100) / 100},${Math.round(point.longitude * 100) / 100}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(point);
    });

    // Обрабатываем каждую группу точек
    Object.values(groups).forEach(groupPoints => {
        if (groupPoints.length === 1) {
            result.push({
                point: groupPoints[0],
                coords: [groupPoints[0].latitude, groupPoints[0].longitude]
            });
        } else {
            // Вычисляем центр группы
            const centerLat = groupPoints.reduce((sum, p) => sum + p.latitude, 0) / groupPoints.length;
            const centerLon = groupPoints.reduce((sum, p) => sum + p.longitude, 0) / groupPoints.length;

            // Размещаем точки по спирали
            groupPoints.forEach((point, index) => {
                if (index === 0) {
                    result.push({
                        point: point,
                        coords: [centerLat, centerLon]
                    });
                } else {
                    const angle = (index - 1) * (Math.PI / 4);
                    const radius = MIN_DISTANCE * (1 + Math.floor((index - 1) / 8));
                    result.push({
                        point: point,
                        coords: [
                            centerLat + radius * Math.cos(angle),
                            centerLon + radius * Math.sin(angle)
                        ]
                    });
                }
            });
        }
    });

    return result;
}
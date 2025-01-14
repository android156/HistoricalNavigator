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

// Экспортируем функции для использования в main.js
window.searchLocation = searchLocation;
window.getCurrentMarkerPosition = getCurrentMarkerPosition;
async function loadHistoricalPoints() {
    try {
        const response = await fetch('/api/historical-points');
        const data = await response.json();
        
        if (!Array.isArray(data)) {
            console.error('Expected array of points, got:', data);
            return;
        }

        // Функция для распределения точек по спирали
function calculateSpiralPosition(center, index, totalPoints) {
    if (totalPoints <= 1) return center;
    
    const angle = index * (2 * Math.PI) / totalPoints;
    const radius = 0.001 * Math.ceil(index / 6); // ~100m per spiral round
    return [
        center[0] + radius * Math.cos(angle),
        center[1] + radius * Math.sin(angle)
    ];
}

// Группируем точки по координатам
const groupedPoints = {};
data.forEach(point => {
    const key = `${point.latitude},${point.longitude}`;
    if (!groupedPoints[key]) {
        groupedPoints[key] = [];
    }
    groupedPoints[key].push(point);
});

historicalPoints = Object.entries(groupedPoints).flatMap(([coords, points]) => {
    return points.map((point, index) => {
        const [baseLat, baseLon] = coords.split(',').map(Number);
        const [lat, lon] = calculateSpiralPosition(
            [baseLat, baseLon], 
            index, 
            points.length
        );

        const placemark = new ymaps.Placemark(
            [lat, lon],
            {
                balloonContentHeader: `${point.response_data.territory}, ${point.time_period}`,
                balloonContentBody: `${point.response_data.description || ''}`,
                hintContent: `${point.response_data.territory}, ${point.time_period}`
            },
            {
                preset: 'islands#blueDotIcon',
                iconImageSize: [8, 8]
            }
        );

            placemark.events.add('click', () => displayHistoricalData(point.response_data));
            map.geoObjects.add(placemark);
            return { placemark, data: point };
        });
    } catch (error) {
        console.error('Error loading historical points:', error);
    }
}

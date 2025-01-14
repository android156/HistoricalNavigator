let map;
let marker;
let searchControl;

function initMap() {
    map = new ymaps.Map('map', {
        center: [55.76, 37.64],
        zoom: 7,
        controls: ['zoomControl']
    });

    // Создаём экземпляр поискового контрола
    searchControl = new ymaps.control.SearchControl({
        options: {
            noPlacemark: true // Не добавляем метку при поиске
        }
    });
    map.controls.add(searchControl);

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

    logMapAction('marker_placed', {
        coordinates: coords
    });

    // Get address for coordinates
    ymaps.geocode(coords).then(function (res) {
        const firstGeoObject = res.geoObjects.get(0);
        const address = firstGeoObject ? firstGeoObject.getAddressLine() : 'Адрес не найден';
        document.getElementById('locationInput').value = address;
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
    searchControl.search(query).then(function () {
        const results = searchControl.getResultsArray();
        if (results && results.length > 0) {
            const coords = results[0].geometry.getCoordinates();
            map.setCenter(coords);
            setMarkerAndGetAddress(coords);
        }
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

ymaps.ready(initMap);

// Экспортируем функцию для использования в main.js
window.searchLocation = searchLocation;
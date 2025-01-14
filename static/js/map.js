let map;
let marker;

function initMap() {
    map = new ymaps.Map('map', {
        center: [55.76, 37.64],
        zoom: 7,
        controls: ['zoomControl', 'searchControl']
    });

    // Log map movements
    map.events.add('boundschange', function (e) {
        logMapAction('map_move', {
            center: map.getCenter(),
            zoom: map.getZoom(),
            type: e.get('type')
        });
    });

    // Handle clicks on map
    map.events.add('click', function (e) {
        const coords = e.get('coords');
        
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

        // Handle marker drag
        marker.events.add('dragend', function () {
            const newCoords = marker.geometry.getCoordinates();
            logMapAction('marker_moved', {
                coordinates: newCoords
            });
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

ymaps.ready(initMap);

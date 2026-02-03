// function to set well style based on well status
function wellStyle(feature) {
    if (feature.properties.WellStatus == "Active") {
        return {
            radius: 5,
            fillColor: "#66FF00", // Green
            color: "#000",
            weight: 1,
            opacity: 1,
            fillOpacity: 0.75
        };
    } else if (feature.properties.WellStatus == "Plugged") {
        return {
            radius: 5,
            fillColor: "#FBEC5D", // Yellow
            color: "#000",
            weight: 1,
            opacity: 1,
            fillOpacity: 0.75
        };
    } else if (feature.properties.WellStatus == "Canceled") {
        return {
            radius: 5,
            fillColor: "#DE301F", // Red
            color: "#000",
            weight: 1,
            opacity: 1,
            fillOpacity: 0.75
        };
    } else if (feature.properties.WellStatus == "Idle") {
        return {
            radius: 5,
            fillColor: "#a64dff", // Purple
            color: "#000",
            weight: 1,
            opacity: 1,
            fillOpacity: 0.75
        };
    } else {
        return {
            radius: 5,
            fillColor: "#0068FF", // Blue
            color: "#000",
            weight: 1,
            opacity: 1,
            fillOpacity: 0.75
        };
    }
}


// function to set county boundary style
function countyStyle() {
    return {
        fillColor: 'white',
        weight: 3,
        opacity: 1,
        color: '#cc0000', // dark red
        dashArray: '1',
        fillOpacity: 0.10
    };
}


// function to set admin boundary style
function adminStyle() {
    return {
        fillColor: '#e68a00', // orange
        weight: 2.5,
        opacity: 1,
        color: '#e68a00',
        dashArray: '4',
        fillOpacity: 0.20
    };
}


// function to set selected polygon style
function selectedStyle(feature) {
    return {
        weight: 2,
        color: '#0000FF',
        fillColor: "#00FFFB", // light blue
        fillOpacity: .4
    };
}


// function to return data for bar chart
function barchartData(activeVal, pluggedVal, canceledVal, idleVal, otherVal) {
    return [
        {
            value: activeVal,
            itemStyle: {
                color: 'rgba(102, 255, 0, 0.75)'
            }
        }, {
            value: pluggedVal,
            itemStyle: {
                color: 'rgba(251, 236, 93, 0.75)'
            }
        }, {
            value: canceledVal,
            itemStyle: {
                color: 'rgba(222, 48, 31, 0.75)'
            }
        }, {
            value: idleVal,
            itemStyle: {
                color: 'rgba(166, 77, 255, 0.75)'
            }
        }, {
            value: otherVal,
            itemStyle: {
                color: 'rgba(0, 104, 255, 0.75)'
            }
        }
    ];
}


// function to reset the style of an uploaded polygon its original symbol
function resetStyles() {
    if (selectedLayer === customLayer) customLayer.resetStyle(selection);
}


// function to handle click on uploaded polygon
function polygonOnEachFeature(feature, layer) {
    geometry = feature.geometry; // used in function to load KML file
    layer.on({
        click: function (e) {
            // change color of uploaded polygon
            e.target.setStyle(selectedStyle());
            selection = e.target;
            selectedLayer = customLayer;

            L.DomEvent.stopPropagation(e); // stop click event from being propagated further
        }
    });
}


// function to add buffer to uploaded polygon and generate CSV file
function bufferPolygon(polygon) { 
    var input = document.getElementById('bsize').value;
    if (input == '') input = 0;

    if (input < 0 || input > 50) alert("Please enter a number between 0 and 50.");
    else if (!selection) alert("Please select the uploaded polygon before pressing button.");
    else {
        // create turf buffer from uploaded polygon and user input for buffer size
        var buffered = turf.buffer(polygon, input, { units: 'miles' });

        // remove previously generated buffer and add new buffer to map
        if (map.hasLayer(bufferedLayer)) map.removeLayer(bufferedLayer);
        bufferedLayer = L.geoJSON(null, {
            style: function (feature) {
                return {
                    color: '#4d4d4d',  
                    fillColor: "#878787", // gray
                    weight: 3,
                    fillOpacity: .5
                };
            }
        });

        // add buffer to map
        bufferedLayer.addData(buffered);
        bufferedLayer.addTo(map);

        // bring uploaded polygon to front
        customLayer.bringToFront();

        // create a feature collection of turf points
        var points = turf.featureCollection(turfList); 

        // create a GeoJSON of points within buffer
        var ptsWithin = turf.pointsWithinPolygon(points, buffered);

        if (ptsWithin.features.length == 0) alert("Polygon does not intersect any wells!");
        else {
            // function to convert array into csv
            function convertToCSV(arr) {
                const array = [Object.keys(arr[0])].concat(arr)
                return array.map(it => {
                    return Object.values(it).toString()
                }).join('\n')
            }

            // loop through ptsWithin to create an array of feature properties
            var arr = []
            for (let i = 0; i < ptsWithin.features.length; i++) {
                arr.push(ptsWithin.features[i].properties)
            }

            csv = convertToCSV(arr);
            download(csv, 'wells_withn_polygon.csv', 'text/csv;charset=utf-8');

            // insert some HTML with status of buffer and CSV file
            document.getElementById('buffer_info').innerHTML = '<br> <span class="center medFont"><b>' +
                ptsWithin.features.length.toLocaleString("en-US") + " wells queried inside of the " + input +
                "-mile buffer." + '</b></span>';

            var downloadFile = document.getElementById("csv_download");
            downloadFile.classList.add("fadeIn");
            downloadFile.disabled = false;
        }
    }
}


// function to load KML file 
function loadFile() { 
    var input = document.getElementById('fileinput');

    if (!input.files[0]) alert("Please select a file before clicking 'Upload'.");
    else {
        var file = input.files[0];
        var fr = new FileReader();
        var layer;

        input.value = ''; // clear the input
        var extension = file.name.split('.')[1]
        if (extension === 'kml') {
            fr.onload = function () {
                // remove previously uploaded polygon if present
                if (map.hasLayer(customLayer)) map.removeLayer(customLayer);

                customLayer = omnivore.kml(fr.result, null, customLayer);

                customLayer.on('ready',
                    function () {
                        // remove data (i.e. to remove any line features) from GeoJSON layer
                        customLayer.clearLayers();

                        // create turf polygon if KML is a polyline
                        if (geometry.coordinates.length == 1) polygon = turf.polygon(geometry.coordinates);
                        // create turf polyogn if KML is a polygon
                        else polygon = turf.polygon([geometry.coordinates]);

                        // add turf polygon and add to map
                        customLayer.addData(polygon);
                        customLayer.addTo(map);

                        // zoom to uploaded polygon
                        map.fitBounds(customLayer.getBounds());
                    });
            }
        }
        else alert("Not a valid file type.");
        fr.readAsDataURL(file);
    }
}


// function to download CSV file
function download(csv, filename, type) {
    var a = document.getElementById("a");
    var file = new Blob([csv], { type: type });

    a.href = URL.createObjectURL(file);
    a.download = filename;
}
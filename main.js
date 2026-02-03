// initialize variables
var map;
var wellLayer;
var turfList = []; // list of turf points
var csv;
var bufferedLayer;
var geometry;
var selection = false;
var selectedLayer;
var polygon;
var html;
var chartData;
var customLayer = L.geoJson(null, { // template for uploaded polygon
    style: function () {
        return {
            color: '#b2182b', // red polygon
            fillColor: "#d6604d",
            weight: 2,
            fillOpacity: .25
        };
    },
    onEachFeature: polygonOnEachFeature
});

function init() {
    // create map and set center and zoom level
    map = new L.map('mapid');
    map.setView([36.480065924443544, -118.78571383667997], 5); // location for California

    // add customized MapBox Outdoors basemap
    L.mapbox.accessToken = 'pk.eyJ1IjoiZ2VvbGVvMTgwNCIsImEiOiJjbGxpdWh1OW0xZmVsM2xwamZyNXVsZTRmIn0.GWgjTmfmySVo0tl0MOtYAw';
    var mapboxOutdoors = L.mapbox.styleLayer('mapbox://styles/geoleo1804/clowr4eca009101r6hb5p6e81', {
        maxZoom: 20,
        minZoom: 5
    });

    // add  Thunderforest transport basemap 
    var tfTransport = L.tileLayer('https://{s}.tile.thunderforest.com/transport/{z}/{x}/{y}.png?apikey={apikey}', {
        attribution: '&copy; <a href="http://www.thunderforest.com/">Thunderforest</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        apikey: 'db5ae1f5778a448ca662554581f283c5',
        minZoom: 5,
        maxZoom: 20
    });
    tfTransport.addTo(map);

    // add Esri World Imagery 
    var esriImagery = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
        minZoom: 5,
        maxZoom: 19
    });

    // add state outline
    var stateLayer = new L.geoJSON(stateLine, {
        style: {
            weight: 2.5,
            opacity: 1,
            color: '#73004C', // dark purple
            dashArray: '3',
        }
    });
    stateLayer.addTo(map);

    // create county boundary layer
    var countyLayer = new L.geoJSON(calfire, {
        style: countyStyle(),
    });

    // create administrative boundary layer
    var adminLayer = new L.geoJSON(calgem, {
        style: adminStyle(),
        onEachFeature: function (feature, layer) {
            var popupContent = '<span style="color: black; font-size: 1.1em"><b>Admin boundary</b></span> <br>' +
                '<span style="color: #e68a00;">Name: ' + feature.properties.NAME + '</span>';
            layer.bindPopup(popupContent);
        }
    });

    // initialize markers as a cluster group
    var markers = L.markerClusterGroup({
        chunkedLoading: true,
        disableClusteringAtZoom: 16
    });

    // initialize admin boundaries feature group and add to map
    var boundaries = L.featureGroup([adminLayer]);
    boundaries.addTo(map);

    // initialize counties feature group
    var counties = L.featureGroup(null);

    const start = Date.now();

    // create a unique list of counties in California
    var countyList = [];
    for (var i = 0; i < wellstar.features.length; i++) {
        countyList.push(wellstar.features[i].properties.CountyName);
    }
    uniqueCounty = Array.from(new Set(countyList));

    // use a for loop to interate over all counties in California
    // attempting to load the layer, which has about 250k+ wells, without a for loop will stall the loading of the app
    for (var i = 0; i < uniqueCounty.length; i++) {

        wellLayer = new L.geoJSON(wellstar, {
            pointToLayer: function (feature, latlng) {
                if (feature.properties.CountyName == uniqueCounty[i]) {
                    var marker = L.circleMarker(latlng, wellStyle(feature));
                    return marker;
                }
            },
            onEachFeature: function (feature, layer) {
                if (feature.properties.CountyName == uniqueCounty[i]) {
                    var popupContent = '<span style="font-size: 1.1em;"><b>' + feature.properties.WellStatus +
                        ' well</b></span> <br>' + '<div >Well API: ' + feature.properties.API +
                        '<br>' + 'Well type: ' + feature.properties.WellTypeLabel + '</div>';
                    layer.bindPopup(popupContent);

                    // for each feature, create a turf point with properties and add it to a list
                    turfList.push(turf.point(feature.geometry.coordinates, {
                        FID: feature.properties.OBJECTID,
                        API: feature.properties.API,
                        WellNumber: feature.properties.WellNumber,
                        WellStatus: feature.properties.WellStatus,
                        WellTypeLabel: feature.properties.WellTypeLabel,
                        CountyName: feature.properties.CountyName,
                        Latitude: feature.properties.Latitude,
                        Longitude: feature.properties.Longitude
                    }));
                }
            }
        });
        markers.addLayer(wellLayer);
        map.addLayer(markers);
    }

    // zoom to the location of the wells on the map
    var bounds = markers.getBounds();
    map.fitBounds(bounds);

    // add a bar chart using Apache Echarts
    var myChart = echarts.init(document.getElementById('container'));
    chartData = barchartData(59190, 130259, 9641, 40396, 2197); // data for California

    option = {
        title: {
            text: 'California',
            subtext: 'Frequency of wells by status'
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'shadow'
            },
            formatter: function (params) {
                var tar = params[0];
                return `${tar.name} <br> ${tar.value.toLocaleString("en-US")}`;
            }
        },
        xAxis: {
            type: 'category',
            data: ['Active', 'Plugged', 'Canceled', 'Idle', 'Other'],
            axisLabel: {
                interval: 0,
                rotate: 45 // rotating the label
            }
        },
        yAxis: {
            type: 'value',
            axisLabel: {
                interval: 0,
                rotate: 45, // rotating the label
                formatter: val => `${val / 1000} k`
            }
        },
        series: [
            {
                data: chartData,
                type: 'bar',
                showBackground: true,
                backgroundStyle: {
                    color: 'rgba(180, 180, 180, 0.2)'
                }
            }
        ]
    };

    myChart.setOption(option);

    // display excution time
    const end = Date.now();
    console.log(`Initial layer load time: ${end - start} ms`);

    // display wells for a selection from the dropdown menu
    document.querySelector("#county").addEventListener('change', function () {
        const start = Date.now();
        county = this.value;

        // remove the clustered wells, counties, admin boundaries from previous selection
        if (markers) markers.clearLayers();
        if (counties) counties.clearLayers();
        if (boundaries) boundaries.clearLayers();

        // filter wells based on dropdown menu selection
        wellLayer = L.geoJSON(wellstar, {
            pointToLayer: function (feature, latlng) {
                var marker = L.circleMarker(latlng, wellStyle(feature));
                return marker;
            },
            onEachFeature: function (feature, layer) {
                var popupContent = '<span style="font-size: 1.1em;"><b>' + feature.properties.WellStatus +
                    ' well</b></span> <br>' + '<div >Well API: ' + feature.properties.API +
                    '<br>' + 'Well type: ' + feature.properties.WellTypeLabel + '</div>';
                layer.bindPopup(popupContent)
            },
            filter: function (feature, layer) {
                if (county == "All") return true;
                else if (feature.properties.CountyName == county) return true;
                else return false;
            }
        });

        // filter admin boundaries based on dropdown menu selection
        adminLayer = L.geoJSON(calgem, {
            style: adminStyle(),
            onEachFeature: function (feature, layer) {
                var popupContent = '<span style="color: black; font-size: 1.1em"><b>Admin boundary</b></span> <br>' +
                    '<span style="color: #e68a00;">Name: ' + feature.properties.NAME + '</span>';
                layer.bindPopup(popupContent);
            },
            filter: function (feature, layer) {
                if (county == "All") return true;
                else if (feature.properties.County == county) return true;
                else return false;
            }
        });

        // filter counties based on dropdown menu selection
        countyLayer = L.geoJSON(calfire, {
            style: countyStyle(),
            filter: function (feature, layer) {
                if (county == "All") return false;
                else if (feature.properties.COUNTY_NAME == county) return true;
                else return false;
            }
        });

        //add counties to group and add to map
        counties.addLayer(countyLayer);
        map.addLayer(counties);

        // add adin boundaries to group and add to map
        boundaries.addLayer(adminLayer);
        map.addLayer(boundaries);

        // add wells to group and zoom to on map
        markers.addLayer(wellLayer);
        map.addLayer(markers);
        var bounds = wellLayer.getBounds();
        map.fitBounds(bounds);

        // define bar chart data for each selection
        if (county == "All") {
            chartData = barchartData(59190, 130259, 9641, 40396, 2197);
        }
        else if (county == "Los Angeles") {
            chartData = barchartData(3294, 17383, 181, 3411, 32);
        }
        else if (county == "Ventura") {
            chartData = barchartData(1901, 4408, 100, 2108, 12);
        }
        else if (county == "Kern") {
            chartData = barchartData(46134, 72139, 8570, 27817, 1787);
        }
        else if (county == "Fresno") {
            chartData = barchartData(2285, 7735, 128, 2128, 210);
        }
        else if (county == "Santa Barbara") {
            chartData = barchartData(1006, 4156, 123, 1490, 31);
        }
        else if (county == "San Luis Obispo") {
            chartData = barchartData(263, 1467, 27, 214, 44);
        }
        else if (county == "Monterey") {
            chartData = barchartData(926, 2332, 51, 518, 44);
        }
        else if (county == "Orange") {
            chartData = barchartData(783, 7360, 56, 871, 8);
        }

        // set chart parameters
        var title;
        if (county == "All") title = 'California';
        else title = `${county} County`

        option = {
            title: {
                text: title,
                subtext: 'Frequency of wells by status'
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'shadow'
                },
                formatter: function (params) {
                    var tar = params[0];
                    return `${tar.name} <br> ${tar.value.toLocaleString("en-US")}`;
                }
            },
            xAxis: {
                type: 'category',
                data: ['Active', 'Plugged', 'Canceled', 'Idle', 'Other'],
                axisLabel: {
                    interval: 0,
                    rotate: 45 // rotating the label
                }
            },
            yAxis: {
                type: 'value',
                axisLabel: {
                    interval: 0,
                    rotate: 45, // rotating the label
                    formatter: val => `${val / 1000} k`
                }
            },
            series: [
                {
                    data: chartData,
                    type: 'bar',
                    showBackground: true,
                    backgroundStyle: {
                        color: 'rgba(180, 180, 180, 0.2)'
                    }
                }
            ]
        };

        // update chart in div for the selection 
        myChart.setOption(option);

        // display excution time
        const end = Date.now();
        console.log(`${county} selection load time: ${end - start} ms`);
    });

    // add a legend
    var legend = L.control({ position: 'bottomright' });
    legend.onAdd = function () {
        var div = L.DomUtil.create('div', 'legend'),
            colors = ["#66FF00", "#FBEC5D", "#DE301F", "#a64dff", "#0068FF"],
            labels = ["Active well", "Plugged well", "Canceled well", "Idle well", "Other well"];

        // loop through the colors to add the well status categories to the legend
        for (var i = 0; i < colors.length; i++) {
            div.innerHTML +=
                '<i style="background:' + colors[i] + '"></i> ' +
                labels[i] + '<br>';
        }
        // add administrative boundaries to the legend
        div.innerHTML += '<span style="background:' + 'rgba(230, 138, 0, 0.222)' + '"></span> ' + 'Administrative boundary' + '<br>'
        return div;
    };
    legend.addTo(map);

    // handle clicks on the map that do not land on a feature
    map.addEventListener('click', function (e) {
        if (selection) {
            resetStyles();
            selection = false;
        }
    });

    // add layer control to map
    var basemap = {
        "Thunderforest Transport": tfTransport,
        "MapBox Outdoors": mapboxOutdoors,
        "Esri World Imagery": esriImagery
    };
    var overlays = {
        "Oil and gas wells": markers,
        "Admin boundaries": boundaries,
    };
    var layerControl = L.control.layers(basemap, overlays);
    layerControl.addTo(map);

    // bring layers in front of county boundary if layer added to map
    map.on("layeradd", function (event) {
        countyLayer.bringToBack();
        stateLayer.bringToBack(); // send state outline to back
        markers.bringToFront();
        customLayer.bringToFront();
    });

    // remove admin boundaries at zoom 16 and add them back at zoom 15 when layer active in layer control
    var remove = 0;
    var add = 0;
    map.on('zoomend', function () {
        // remove layer at zoom 16
        if (map.getZoom() > 15 && map.hasLayer(boundaries)) {
            map.removeLayer(boundaries);
            remove++;
        }
        // add layer at zoom 15
        if (map.getZoom() < 16 && map.hasLayer(boundaries) == false && (remove - add) > 0) {
            map.addLayer(boundaries);
            markers.bringToFront();
            add++;
        }
    });
}
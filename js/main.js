// https://lilcortexbucket.blob.core.windows.net/public/meters.json

// Global Variables
var restEndPoint = 'https://lilcortexbucket.blob.core.windows.net/public/meters.json';
var restEndPoint = './js/data.json'; // CORS Issue
var markerList = [];
var markerCenter = {
    lat: 49.058078,
    lng: -122.449741
};
var liveData = [];
var icons = {
    Smart_Meter: {
        icon: './img/Smart_Meter.png'
    }
};

function init() {
    getData();
    initMap();
}


function getData() {
    $.getJSON(restEndPoint, function(data) {
        dataTransform(data)
    }).then(initMap());
}

// Draws google Map
function initMap() {
    var myLatLng = {
        lat: -25.363,
        lng: 131.044
    };

    var map = new google.maps.Map(document.getElementById('map'), {
        zoom: 10,
        center: markerCenter
    });

    $.each(markerList, function(index, value) {
        let marker = new google.maps.Marker({
            position: {
                "lat": value.lat,
                "lng": value.lng
            },
            map: map,
            icon: icons.Smart_Meter.icon,
            title: value.name,
            url: '/',
            animation: google.maps.Animation.DROP
        });

        // Listens for clicks, triggers chart draw
        marker.addListener('click', function() {
            marker.title;
            map.setCenter(marker.getPosition());

            drillDownChart(liveData[marker.title][0], '#' + marker.title + ' Demand');
        });
    });
}

function plotMarkers(markerList) {
    $(markerList).each(function(marker) {
        //console.log(marker);
    });
}

// Ingest JSON response and conform to highcharts and google maps
function dataTransform(data) {

    var latList = [];
    var lngList = [];

    //console.log('data');
    //console.log(data[68613970]);

    // Make Markers
    markerList = [];
    $.each(data, function(index, value) {
        var newMarker = [];
        newMarker.lat = parseFloat(value.meter_latitude);
        newMarker.lng = parseFloat(value.meter_longitude);

        // for centering
        latList.push(newMarker.lat);
        lngList.push(newMarker.lng);

        markerList.push({
            "lat": newMarker.lat,
            "lng": newMarker.lng,
            "name": index
        });
    });

    // Make Data
    liveData = [];
    $.each(data, function(index, value) {
        var dataSet = [];
        var item = [];
        var name = index;
        liveData[name] = [];
        liveData[name][0] = [];

        // shuffle around list
        $.each(value.demand_ts, function(index, value) {
            //console.log(index);
            //console.log(value);
            item = [
                moment(value.timestamp, "YYY-M-D H:mm").unix() * -1, //bug, returned negitive value
                parseFloat(value.demand_value)
            ];
            liveData[name][0].push(item)
        });

        // Sort Data:
        liveData[name][0] = _.sortBy(liveData[name][0].sort(function(a, b) {

            return b - a;
        }));

        //console.log(liveData);
    });

    markerCenter = {
        "lat": arrayAverage(latList),
        "lng": arrayAverage(lngList)
    };
    //console.log(markerList);
}

// Returns Average From An Array
function arrayAverage(arr) {
    return _.reduce(arr, function(memo, num) {
        return memo + num;
    }, 0) / (arr.length === 0 ? 1 : arr.length);
}

/////////// Drill Down Chart ///////////////

function drillDownChart(data, chartName) {
    var detailChart;

    $(document).ready(function() {

        // create the detail chart
        function createDetail(masterChart) {

            // prepare the detail chart
            var detailData = [],
                detailStart = data[0][0];

            $.each(masterChart.series[0].data, function() {
                if (this.x >= detailStart) {
                    detailData.push(this.y);
                }
            });

            // create a detail chart referenced by a global variable
            detailChart = Highcharts.chart('detail-container', {
                chart: {
                    backgroundColor: 'transparent',
                    marginBottom: 120,
                    reflow: false,
                    marginLeft: 50,
                    marginRight: 20,
                    style: {
                        position: 'absolute'
                    }
                },
                credits: {
                    enabled: false
                },
                title: {
                    text: chartName
                },
                subtitle: {
                    text: 'Select an area by dragging across the lower chart'
                },
                xAxis: {
                    type: 'datetime'
                },
                yAxis: {
                    title: {
                        text: null
                    },
                    maxZoom: 0.1,
                    labels: {
                        formatter: function() {
                            return (this.value / 10) + "%";
                        }
                    },
                    plotLines: [{
                        value: 800,
                        color: 'red',
                        dashStyle: 'shortdash',
                        width: 2,
                        label: {
                            text: 'Max Threshold'
                        }
                    }]
                },
                tooltip: {
                    formatter: function() {
                        var point = this.points[0];
                        return '<b>' + point.series.name + '</b><br/>' + Highcharts.dateFormat('%A %B %e %Y', this.x) + ':<br/>' +
                            Highcharts.numberFormat(point.y, 2) + ' ML';
                    },
                    shared: true
                },
                legend: {
                    enabled: false
                },
                plotOptions: {
                    series: {
                        marker: {
                            enabled: false,
                            states: {
                                hover: {
                                    enabled: true,
                                    radius: 3
                                }
                            }
                        }
                    }
                },
                series: [{
                    name: 'System Throughput',
                    pointStart: detailStart,
                    pointInterval: 24 * 3600 * 1000,
                    data: detailData
                }],

                exporting: {
                    enabled: false
                }

            }); // return chart
        }

        // create the master chart
        function createMaster() {
            Highcharts.chart('master-container', {
                chart: {
                    reflow: false,
                    borderWidth: 0,
                    backgroundColor: null,
                    marginLeft: 50,
                    marginRight: 20,
                    zoomType: 'x',
                    events: {

                        // listen to the selection event on the master chart to update the
                        // extremes of the detail chart
                        selection: function(event) {
                            var extremesObject = event.xAxis[0],
                                min = extremesObject.min,
                                max = extremesObject.max,
                                detailData = [],
                                xAxis = this.xAxis[0];

                            // reverse engineer the last part of the data
                            $.each(this.series[0].data, function() {
                                if (this.x > min && this.x < max) {
                                    detailData.push([this.x, this.y]);
                                }
                            });

                            // move the plot bands to reflect the new detail span
                            xAxis.removePlotBand('mask-before');
                            xAxis.addPlotBand({
                                id: 'mask-before',
                                from: data[0][0],
                                to: min,
                                color: 'rgba(0, 0, 0, 0.2)'
                            });

                            xAxis.removePlotBand('mask-after');
                            xAxis.addPlotBand({
                                id: 'mask-after',
                                from: max,
                                to: data[data.length - 1][0],
                                color: 'rgba(0, 0, 0, 0.2)'
                            });


                            detailChart.series[0].setData(detailData);

                            return false;
                        }
                    }
                },
                title: {
                    text: null
                },
                xAxis: {
                    type: 'datetime',
                    showLastTickLabel: true,
                    maxZoom: 14 * 24 * 3600000, // fourteen days
                    plotBands: [{
                        id: 'mask-before',
                        from: data[0][0],
                        to: data[data.length - 1][0],
                        color: 'rgba(0, 0, 0, 0.2)'
                    }],
                    title: {
                        text: null
                    }
                },
                yAxis: {
                    gridLineWidth: 0,
                    labels: {
                        enabled: false
                    },
                    title: {
                        text: null
                    },
                    min: 0,
                    showFirstLabel: false
                },
                tooltip: {
                    formatter: function() {
                        return false;
                    }
                },
                legend: {
                    enabled: false
                },
                credits: {
                    enabled: false
                },
                plotOptions: {
                    series: {
                        fillColor: {
                            linearGradient: [0, 0, 0, 70],
                            stops: [
                                [0, Highcharts.getOptions().colors[0]],
                                [1, 'rgba(255,255,255,0)']
                            ]
                        },
                        lineWidth: 1,
                        marker: {
                            enabled: false
                        },
                        shadow: false,
                        states: {
                            hover: {
                                lineWidth: 1
                            }
                        },
                        enableMouseTracking: true
                    }
                },

                series: [{
                    type: 'area',
                    name: 'System Throughput',
                    pointInterval: 24 * 3600 * 1000,
                    pointStart: data[0][0],
                    data: data
                }],

                exporting: {
                    enabled: false
                }

            }, function(masterChart) {
                createDetail(masterChart);
            }); // return chart instance
        }

        // make the container smaller and add a second container for the master chart
        var $container = $('#chart')
            .css('position', 'relative');

        $('<div id="detail-container">')
            .appendTo($container);

        $('<div id="master-container">')
            .css({
                position: 'absolute',
                top: 300,
                height: 100,
                width: '100%'
            })
            .appendTo($container);

        // create master and in its callback, create the detail chart
        createMaster();
    });
}


init()
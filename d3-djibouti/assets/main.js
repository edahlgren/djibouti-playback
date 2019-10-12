// Very basic method to get json from url
function http_json(url) {
    return new Promise(function(resolve, reject) {        
        var req = new XMLHttpRequest();
        req.onreadystatechange = function() {
            if (req.readyState == 4) {
                if (req.status != 200) {
                    reject({status: req.status, text: req.statusText});
                    return;
                }
                let json = JSON.parse(req.responseText);
                resolve(json);
        }
    };
    req.open("GET", url, true);
        req.send();
    });
}

var play = document.getElementById('play');

const history_server = "http://127.0.0.1:4444";
var max_lines = -1;
var last_line = -1;
var element_cache = {};
var city_locations = {};

// Add a fixed-sized SVG to the body
var width = 768,
    height = 800,
    svg = d3.select("#map").append("svg")
        .attr("width", width)
        .attr("height", height);

// Choose a 2D -> 3D projection
var projection = d3.geo.albers()
        .center([42.56, 11.67])
        .parallels([11, 13])
        .rotate([0, 0])
        .scale(20000)
        .translate([width / 2, (height / 2) + 50]);

// Create a path that uses the projection
var path = d3.geo.path()
        .projection(projection)
        .pointRadius(2);

var line_generator = d3.svg.line();
var scale_p = d3.scale.linear();
var best_tours = [];

// Load the json
d3.json("data/djibouti.json", function(error, djibouti) {
    if (error) return console.error(error);

    var countries = topojson.feature(djibouti, djibouti.objects.countries),
        cities = topojson.feature(djibouti, djibouti.objects.named_cities);
        
    add_countries(countries);
    add_trails(cities);
    add_cities(cities);

    setup_play();
});

function add_countries(countries) {
    // Add countries
    svg.selectAll(".country")
        .data(countries.features)               // add the features data
        .enter().append("path")                 // add a path
        .attr("class", function(d) {            // add subunit.ID as class name
            return "country " + d.id;
        })
        .attr("d", path);             // use the projection to format
}

function add_cities(cities) {
    // Add cities
    svg.append("path")
        .datum(cities)
        .attr("d", path)
        .attr("class", "place")
        .attr("id", function(d, i) {
            return i;
        });
    
    // Label capital cities
    svg.selectAll(".place-label")
        .data(cities.features.filter(function(feature) {
            return feature.properties.name !== "?";
        }))
        .enter().append("text")
        .attr("class", "place-label")
        .attr("transform", function(d) {
            return "translate(" + projection(d.geometry.coordinates) + ")";
        })
        .attr("dy", ".35em")
        .text(function(d) {
            return d.properties.name;
        });

    svg.selectAll(".place-label")
        .attr("x", function(d) {
            return 6;
        })
        .style("text-anchor", function(d) {
            return "start";
        });

    for (var i = 0; i < cities.features.length; i++) {
        element_cache[i] = document.getElementById(i);
        city_locations[i] = projection(cities.features[i].geometry.coordinates);
    }
}

function add_trails(cities) {
    let n = cities.features.length;
    let coords1 = {};
    let coords2 = {};
    
    for (var i = 0; i < n; i++) {
        for (var j = 0; j < i; j++) {
            coords1 = projection(cities.features[i].geometry.coordinates);
            coords2 = projection(cities.features[j].geometry.coordinates);

            let id = i + "-" + j;
            
            svg.append("line")
                .attr("id", id)
                .attr("class", "trail")
                .attr("x1", coords1[0])
                .attr("y1", coords1[1])
                .attr("x2", coords2[0])
                .attr("y2", coords2[1]);

            element_cache[id] = document.getElementById(id);
        }
    }
}

async function setup_play() {
    let lines = await http_json(history_server + "/lines");
    max_lines = lines.lines;

    let pheromones = await http_json(history_server + "/pheromones");
    scale_p = d3.scale.linear()
        .domain([pheromones.min, pheromones.max])
        .range([0.05, 0.40]);
    
    play.addEventListener('click', function(event) {
        if (!play.dataset.enabled) return;
        
        next_event_from_history();
    }, false);

    enable_play();
}

function disable_play() {
    play.style.color = "#bfbfbf";
    play.style.cursor = "unset";
    play.dataset.enabled = false;
}

function enable_play() {
    play.style.color = "#000000";
    play.style.cursor = "pointer";
    play.dataset.enabled = false;
}

async function next_event_from_history() {
    let next = last_line + 1;
    
    disable_play();

    d3.selectAll(".ant").remove();
    
    if (next >= max_lines) {
        console.log("END");
        show_last_best();
        return;
    }

    // Get the next event
    let event = await http_json(history_server + "/line/" + next);
    console.log("next", next);
    
    // Handle the event
    switch (event.type) {
    case "PHEROMONES":
        console.log("handling PHEROMONES");
        handle_pheromones(event);
        break;

    case "BEST":
        console.log("handling BEST");
        handle_best(event);
        break;

    case "ANTS":
        // Collect subsequent consecutive ant events
        let events = [event];
        let _next = next;
        while (true) {
            _next += 1;
            if (_next >= max_lines)
                break;
            
            event = await http_json(history_server + "/line/" + _next);
            if (event.type !== "ANTS")
                break;
            
            events.push(event);
            next = _next;
        }

        console.log("handling ANTS");
        await handle_ants(events);
        break;
        
    default:
        console.log("unknown event", "'" + event.type + "'", "skipping");
    }

    last_line = next;
    enable_play();
}

function handle_pheromones(event) {

    for (var key in event.trails) {
        if (event.trails.hasOwnProperty(key) &&
            element_cache.hasOwnProperty(key)) {

            let element = element_cache[key];
            let pheromone = event.trails[key];

            element.style.stroke = 
                "rgba(245, 247, 247, " + scale_p(pheromone) + ")";
        }
    }
}

function handle_best(event) {
    let points = event.tour.map(function(city) {
        return city_locations[city];
    });
    points.push(points[0]);
    let tour = line_generator(points);

    let next_best = best_tours.length;
    let id = "tour-" + next_best;
    
    svg.append("path")
        .attr("id", "tour-" + next_best)
        .attr("class", "best tour")
        .attr('d', tour);

    best_tours.push(document.getElementById(id));
}

function show_last_best() {
    if (best_tours.length == 0) {
        console.log("No best tours :(");
        return;
    }
    
    let last = best_tours.length - 1;
    let elem = best_tours[last];
    elem.style.display = "inline";
}

function handle_ants(events) {

    let points = events.map(function(e) {
        let city = e.positions[0];
        return city_locations[city];
    });
    points.push(points[0]);
    console.log("points", points);
    let line = line_generator(points);
    console.log("line", line);
    
    function tweenDash() {
        var l = this.getTotalLength(),
            i = d3.interpolateString("0," + l, l + "," + l);
        return function(t) { return i(t); };
    }
    
    return new Promise(function(resolve, reject) {        
    
        svg.append("path")
            .attr("class", "ant")
            .attr("d", line)
            .call(transition);

        function transition(path) {
            path.transition()
                .ease("linear")
                .duration(2000)
                .attrTween("stroke-dasharray", tweenDash)
                .each("end", function() {
                    resolve();
                });
        }
    });
}

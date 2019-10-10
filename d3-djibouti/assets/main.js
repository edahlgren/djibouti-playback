
// Add a fixed-sized SVG to the body
var width = 768,
    height = 928,
    svg = d3.select("#map").append("svg")
        .attr("width", width)
        .attr("height", height);

// Choose a 2D -> 3D projection
/**
var projection = d3.geo.albers()
        .scale(5000)         // scale it up A LOT
        .translate([width / 2, height / 2]); // center projection in SVG
**/

var projection = d3.geo.albers()
        .center([42.56, 11.67])
        .parallels([11, 13])
        .rotate([0, 0])
        .scale(20000)
        .translate([width / 2, height / 2]);

/**
var projection = d3.geo.mercator()
        .center([42.56, 11.67])
        .scale(20000)
        .translate([width / 2, height / 2]);
**/

// Create a path that uses the projection
var path = d3.geo.path()
        .projection(projection)
        .pointRadius(2);

// Load the json
d3.json("data/djibouti.json", function(error, djibouti) {
    if (error) return console.error(error);

    var countries = topojson.feature(djibouti, djibouti.objects.countries),
        cities = topojson.feature(djibouti, djibouti.objects.named_cities);
        
    // Add countries
    svg.selectAll(".country")
        .data(countries.features)               // add the features data
        .enter().append("path")                 // add a path
        .attr("class", function(d) {            // add subunit.ID as class name
            return "country " + d.id;
        })
        .attr("d", path);             // use the projection to format
    
    // Label countries
    svg.selectAll(".country-label")
        .data(countries.features)                     // use the features data
        .enter().append("text")             // add text elements
        .attr("class", function(d) {        // give them a class name
            return "country-label " + d.id;
        })
        .attr("transform", function(d) {    // position them in the center
            // of the feature
            return "translate(" + path.centroid(d) + ")";
        })
        .attr("dy", ".35em")                // no idea why this is necessary
        .text(function(d) {                 // set the text
            return d.properties.name;
        });
    
    // Add capital cities
    svg.append("path")
        .datum(cities)
        .attr("d", path)
        .attr("class", "place");
    
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
    
});

/**
d3.json("data/uk.json", function(error, uk) {
    if (error) return console.error(error);
    console.log(uk);
});
 **/

// Add a fixed-sized SVG to the body
var width = 768,
    height = 928,
    svg = d3.select("#map").append("svg")
        .attr("width", width)
        .attr("height", height);

// Choose a 2D -> 3D projection
var projection = d3.geo.albers()
        .center([0, 55.4])   // set center to 0 degrees W, 55.4 degrees N
        .rotate([4.4, 0])    // rotate longitude by +4.4 degrees
        .parallels([50, 60]) // parallels at 50 degrees N, 60 degrees N
        .scale(5000)         // scale it up A LOT
        .translate([width / 2, height / 2]); // center projection in SVG

// Create a path that uses the projection
var path = d3.geo.path()
        .projection(projection)
        .pointRadius(2);

// Load the json
d3.json("data/uk.json", function(error, uk) {
    if (error) return console.error(error);

    var subunits = topojson.feature(uk, uk.objects.subunits),
        places = topojson.feature(uk, uk.objects.places);

    add_regions(uk, subunits);
    label_regions(uk, subunits);

    add_cities(uk, places);
    label_cities(uk, places);
});

function add_regions(uk, subunits) {
    // Add separate SVG paths for different country regions, giving each
    // a class name (subunit.ID) to color code
    svg.selectAll(".subunit")
        .data(subunits.features)               // add the features data
        .enter().append("path")       // add a path
        .attr("class", function(d) {  // add subunit.ID as class name
            return "subunit " + d.id;
        })
        .attr("d", path);             // use the projection to format
                                      // the data along the path

    // Find the data points of the irish coastline
    var irish_coastline = topojson.mesh(uk, uk.objects.subunits, function(a, b) {
        // Filter for boundaries where the features on either side
        // of the boundary are the same (coastlines) and the ID of
        // the feature is Ireland
        return a === b && a.id === "IRL";
    });

    // Add a path that traces the irish coastline that we can style
    // separately
    svg.append("path")
        .datum(irish_coastline)
        .attr("d", path)
        .attr("class", "subunit-boundary IRL");    
}

function label_regions(uk, subunits) {
    // Add labels to the center of each feature
    svg.selectAll(".subunit-label")
        .data(subunits.features)                     // use the features data
        .enter().append("text")             // add text elements
        .attr("class", function(d) {        // give them a class name
            return "subunit-label " + d.id;
        })
        .attr("transform", function(d) {    // position them in the center
                                            // of the feature
            return "translate(" + path.centroid(d) + ")";
        })
        .attr("dy", ".35em")                // no idea why this is necessary
        .text(function(d) {                 // set the text
            return d.properties.name;
        });    
}

function add_cities(uk, places) {
    // Add dots for each place, which we will style with the point radius
    // and class name
    svg.append("path")
        .datum(places)
        .attr("d", path)
        .attr("class", "place");
}

function label_cities(uk, places) {
    // Add text to each place, translating the labels based on the
    // projection we used so they're right-side up
    svg.selectAll(".place-label")
        .data(places.features)
        .enter().append("text")
        .attr("class", "place-label")
        .attr("transform", function(d) {
            return "translate(" + projection(d.geometry.coordinates) + ")";
        })
        .attr("dy", ".35em")
        .text(function(d) {
            return d.properties.name;
        });

    // Align labels to the right
    svg.selectAll(".place-label")
        .attr("x", function(d) {
            return 6;
        })
        .style("text-anchor", function(d) {
            return "start";
        });
}

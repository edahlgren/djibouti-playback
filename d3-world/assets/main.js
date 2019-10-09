var width = 900;
var height = 600;

var projection = d3.geo.mercator();

var path = d3.geo.path()
        .projection(projection);

var svg = d3.select("body").append("svg")
        .attr("width", width)
        .attr("height", height);
var g = svg.append("g");

d3.json("/data/world-110m2.json", function(error, topology) {
    g.selectAll("path")
        .data(topojson.object(topology, topology.objects.countries)
              .geometries)
        .enter()
        .append("path")
        .attr("d", path);
});

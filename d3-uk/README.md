---
tutorial: https://bost.ocks.org/mike/map/
data: http://www.naturalearthdata.com/downloads/10m-cultural-vectors
---

# Steps

## Get data

Download country polygons and populated placenames from Natural Earth:

```
$ mkdir data && cd data
$
$ wget http://www.naturalearthdata.com/http//www.naturalearthdata.com/download/10m/cultural/ne_10m_admin_0_map_subunits.zip
$ unzip ne_10m_admin_0_map_subunits.zip
$
$ wget http://www.naturalearthdata.com/http//www.naturalearthdata.com/download/10m/cultural/ne_10m_populated_places.zip
$ unzip ne_10m_populated_places.zip
```

## Download tools

Get GDAL, for the ogr2ogr binary used for manipulating shapefiles:

```
$ sudo add-apt-repository ppa:ubuntugis/ppa && sudo apt-get update
$ sudo apt-get install gdal-bin
```

Get the D3 topojson library for creating compact geographical json:

```
$ npm install -g topojson@1
```

## Filter the data

Use the ogr2ogr tool to parse the Natural Earth shapefile containing countries into a GeoJSON file ('subunits.json') containing only Great Britian and Ireland (ADM0_A3 equals 'GRB' or 'IRL'):

```
$ ogr2ogr -f GeoJSON -where "ADM0_A3 IN ('GBR', 'IRL')" subunits.json ne_10m_admin_0_map_subunits.shp
```

Parse the places data into a GeoJSON file ('places.json') containing only places in Great Britian ("ISO_A2 = 'GB'", slightly different than above, though it contains Northern Ireland) and places that are capitol cities ("FEATURECLA IN ('Admin-0 capital', 'Admin-0 region capital')"):

```
$ ogr2ogr -f GeoJSON -where "ISO_A2 = 'GB' AND FEATURECLA IN ('Admin-0 capital', 'Admin-0 region capital')" places.json ne_10m_populated_places.shp
```

## Combine and simplify the data

Use the topojson tool to merge the country boundaries and place locations into a compact TopoJSON file ('uk.json'). Also maps 'NAME' -> 'name' and 'SU_A3' to the object id:

```
$ topojson -o uk.json --id-property SU_A3 --properties name=NAME -- subunits.json places.json
bounds: -13.69131425699993 49.90961334800005 1.77116946700005 60.84788646000004 (spherical)
pre-quantization: 1.72m (0.0000155°) 1.22m (0.0000109°)
topology: 70 arcs, 9717 points
post-quantization: 172m (0.00155°) 122m (0.00109°)
prune: retained 70 / 70 arcs (100%)
```

## Display the data

Create a div that will contain the map:

```
<body>
  <div id="map" class="map"></div>
</body>
```

Create a fixed-sized SVG in this div:

```
var width = 768,
    height = 928,
    svg = d3.select("#map").append("svg")
        .attr("width", width)
        .attr("height", height);
```

Choose a 2D -> 3D projection and map it to an SVG path:

```
var projection = d3.geo.albers()
        .center([0, 55.4])   // set center to 0 degrees W, 55.4 degrees N
        .rotate([4.4, 0])    // rotate longitude by +4.4 degrees
        .parallels([50, 60]) // parallels at 50 degrees N, 60 degrees N
        .scale(5000)         // scale it up A LOT
        .translate([width / 2, height / 2]); // center projection in SVG
        
var path = d3.geo.path()
        .projection(projection)
        .pointRadius(2);
```

Load the json data and add it to the map:

```
d3.json("data/uk.json", function(error, uk) {
    if (error) return console.error(error);

    var subunits = topojson.feature(uk, uk.objects.subunits),
        places = topojson.feature(uk, uk.objects.places);

    add_regions(uk, subunits);
    label_regions(uk, subunits);

    add_cities(uk, places);
    label_cities(uk, places);
});
```

const fs = require('fs');
const path = require('path');
const util = require('util');
const cli = require('command-line-args');

const cliSpec = [
    { name: 'tsplib' },
    { name: 'places'},
    { name: 'output' }
];

main();

function main() {
    const args = cli(cliSpec);
    if (!args.tsplib) {
        console.log("missing --tsplib: need to a tsplib file with coordinates");
        process.exit(1);
    }
    if (!args.places) {
        console.log("missing --places: there will be no place names in output");
    }
    if (!args.output) {
        args.output = 'named_cities.json';
    }

    console.log("args");
    console.log(args);
    console.log("");

    // Parse tsplib coordinates into JSON
    let coords = toJSON(fs.readFileSync(args.tsplib, 'utf8'));

    console.log("coords");
    console.log(coords);
    console.log("");
    
    // Parse places file into JSON
    let places = JSON.parse(args.places ? fs.readFileSync(args.places, 'utf8') : "");

    // Create a new geoJSON file that merges coords and places
    let geoJSON = toGeoJSON(coords, places);

    console.log("geoJSON");
    console.log(util.inspect(geoJSON, false, null, true));
    console.log("");
    
    // Write the result to the output file
    fs.writeFileSync(args.output, JSON.stringify(geoJSON), 'utf8');
}

function toJSON(content) {
    let lines = content.split('\n');

    let points = [];
    let coords = false;

    lines.forEach(function(line) {
        if (line.length == 0)
            return;
        
        if (line === "NODE_COORD_SECTION") {
            coords = true;
            return;
        }

        if (!coords)
            return;

        
        let elems = line.split(' ');
        if (elems.length < 3) {
            console.log("line", line, "has", elems.length, "elements, need 3");
            process.exit(1);
        }

        let num = parseInt(elems[0]);
        let latitude = parseFloat(elems[1]);
        let longitude = parseFloat(elems[2]);

        // Values are a bit too big, divide by 1000 to get between
        // 0-90 decimal degrees
        latitude /= 1000.0;
        longitude /= 1000.0;

        points.push({
            id: num,
            latitude: latitude,
            longitude: longitude
        });

    });

    return points;
}

function toGeoJSON(coords, places) {
    places.features.forEach(function(feature) {
        let lat = feature.properties.LATITUDE,
            lng = feature.properties.LONGITUDE,
            name = feature.properties.NAME;

        let i = closestPoint(coords, lat, lng);
        if (i < 0)
            process.exit("failed to find a point closer to", name, "than Infinity");

        let coord = coords[i];
        if (coord.name) {
            console.log("point", coord.id, "has name", coord.name, "can't use", name);
            return;
        }
        coords[i].name = name;
    });

    let geo = {
        type: "FeatureCollection",
        features: []
    };
    
    coords.forEach(function(coord) {
        geo.features.push({
            type: "Feature",
            geometry: { type: "Point", coordinates: [coord.longitude, coord.latitude] },
            properties: {
                ID: coord.id,
                NAME: (coord.name ? coord.name : "?")
            }
        });
    });

    return geo;
}

function closestPoint(coords, latitude, longitude) {
    let winner = -1;
    let best = Infinity;

    for (var i = 0; i < coords.length; i++) {
        let dist = Math.hypot(latitude - coords[i].latitude,
                              longitude - coords[i].longitude);
        if (dist < best) {
            best = dist;
            winner = i;
        }
    }

    return winner;
}

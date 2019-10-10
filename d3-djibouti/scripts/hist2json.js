const fs = require('fs');
const path = require('path');
const util = require('util');
const cli = require('command-line-args');

const cliSpec = [
    { name: 'history' },
    { name: 'output' }
];

main();

function main() {
    const args = cli(cliSpec);
    if (!args.history) {
        console.log("missing --history: need to a history file with logs");
        process.exit(1);
    }
    if (!args.output) {
        args.output = 'history.json';
    }

    console.log("args");
    console.log(args);
    console.log("");

    let history = toJSON(fs.readFileSync(args.history, 'utf8'));
    fs.writeFileSync(args.output, JSON.stringify(history), 'utf8');
}

function toJSON(content) {
    let lines = content.split('\n');

    let events = [];
    let done_ants = true;
    lines.forEach(function(line) {
        if (line.length == 0)
            return;

        let elems = line.split(',');
        if (elems.length == 0)
            return;

        switch (elems[0]) {
        case "ANTS":
            if (done_ants) {
                events.push({type: "iteration"});
                done_ants = false;
            }
            events.push({
                type: "ants",
                positions: elems.slice(1).map(parseInt)
            });
            return;
            
        case "BEST":
            done_ants = true;
            events.push({
                type: "best_tour",
                length: parseFloat(elems[1]),
                tour: elems.slice(2).map(parseInt)
            });
            return;
            
        case "PHEROMONES":
            done_ants = true;

            let scale = parseFloat(elems[1]);
            let min_p = Infinity;
            let max_p = 0;
            
            let trails = {};
            elems.slice(2).forEach(function(trail) {
                let parts = trail.split(":"),
                    path = parts[0],
                    pheromone = parseFloat(parts[1]);

                if (pheromone < min_p)
                    min_p = pheromone;
                if (pheromone > max_p)
                    max_p = pheromone;
                
                trails[path] = pheromone;
            });

            events.push({
                type: "pheromones",
                scale: scale,
                min: min_p,
                max: max_p,
                trails: trails
            });
            return;
            
        default:
            console.log("don't recognize event", "'" + elems[0] + "'", "skipping");
            return;
        }
    });

    return { events: events };
}

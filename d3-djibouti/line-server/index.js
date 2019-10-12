const fs = require('fs');
const util = require('util');

const express = require('express');
const cors = require('cors');

const cli = require('command-line-args');
const cliProgress = require('cli-progress');
const colors = require('colors');


//////////////////////////////////////////////////////////////////////


const cliSpec = [
    { name: 'history' }
];

const progressBytes = new cliProgress.SingleBar({
    format: 'Reading history |' + colors.cyan('{bar}') + '| {percentage}% || {value}/{total} Bytes',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
});

const progressLines = new cliProgress.SingleBar({
    format: 'Parsing lines |' + colors.magenta('{bar}') + '| {percentage}% || {value}/{total} Lines',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
});


//////////////////////////////////////////////////////////////////////


main();

function main() {
    const args = cli(cliSpec);
    if (!args.history) {
        console.log("missing --history: need a history file");
        process.exit(1);
    }

    let history = open_history(args.history);
    console.log("");
    console.log(util.inspect(history, false, null, true));

    var app = express();
    app.use(cors());
    
    app.get('/lines', function(req, res) {
        res.json({lines: history.lines});
    });
    
    app.get('/pheromones', function(req, res) {
        res.json({min: history.pheromones_min, max: history.pheromones_max});
    });

    app.get('/line/:lineId', function (req, res) {
        let line_number = req.params.lineId;
        if (line_number < 0 || line_number >= history.lines) {
            return res.status(500).send('Line ' + line_number +
                                        ' is out of bounds [0,' +
                                        (history.lines - 1) + ']');
        }

        let line = history.line_at(line_number);
        return res.json(line2json(line));
    });

    app.listen(4444);
    console.log("");
    console.log('Available on');
    console.log('  http://127.0.0.1:4444');
}

function open_history(file) {

    let fd = -1,
        newlines = [];

    // Open the file
    fd = fs.openSync(file, 'r');

    // Get file info for efficient reading
    let stat = fs.fstatSync(fd),
        file_size = stat.size,
        block_size = stat.blksize,
        buffer_size = block_size * 4,
        buffer = new Buffer(buffer_size),
        bytes_read = 0;

    progressBytes.start(file_size, 0);
    
    // Read the entire file, buffer by buffer, looking for newlines
    while (bytes_read < file_size) {

        // Read from the file
        let bytes = fs.readSync(fd, buffer, 0, buffer_size, bytes_read);

        // Select only the part of the buffer that was filled
        let _buffer = buffer.slice(0, bytes);

        // Search for newlines
        let last_newline = -1;
        while (true) {
            let i = _buffer.indexOf('\n', last_newline + 1);
            if (i < 0)
                break;

            newlines.push(bytes_read + i);
            last_newline = i;
        }
        
        bytes_read += bytes;
        
        progressBytes.update(bytes_read);
    }

    progressBytes.stop();

    let last_line = newlines.length - 1;
    function line_at(line) {
        let start = 0,
            end = 0;
        
        // Handle beginning
        if (line == 0) {
            end = newlines[0];
        } else {
            let prev = newlines[line - 1];
            start = prev + 1;
            end = newlines[line];
        }
        
        let length = end - start,
            buffer = new Buffer(length),
            bytes = fs.readSync(fd, buffer, 0, length, start);
        
        if (bytes < length)
            throw new Error('read ' + bytes + ' bytes, expected ' + length);
        
        return buffer.toString();
    }

    // Find the minimum and maximum pheromone values
    progressLines.start(newlines.length, 0);

    let min_p = Infinity;
    let max_p = 0;
        
    for (var i = 0; i < newlines.length; i++) {
        
        let line = line_at(i);
        let elems = line.split(',');
        if (elems.length == 0) {
            progressLines.increment();
            continue;
        }
        if (elems[0] !== "PHEROMONES") {
            progressLines.increment();
            continue;
        }

        let pheromones = elems.slice(2).map(function(elem) {
            return parseFloat(elem.split(":")[1]);
        });

        let min = Math.min(...pheromones);
        if (min < min_p)
            min_p = min;

        let max = Math.max(...pheromones);
        if (max > max_p)
            max_p = max;
        
        progressLines.increment();
    }
    progressLines.stop();

    // History object
    return {
        fd: fd,
        newlines: newlines,
        lines: newlines.length,
        pheromones_min: min_p,
        pheromones_max: max_p,
        line_at: line_at
    };
}

function parseInt10(x) {
    return parseInt(x, 10);
}

function line2json(line) {
    let elems = line.split(',');
    if (elems.length == 0)
        return {};

    switch (elems[0]) {
    case "ANTS":
        return {
            type: "ANTS",
            positions: elems.slice(1).map(parseInt10)
        };
        
    case "BEST":
        return {
            type: "BEST",
            length: parseFloat(elems[1]),
            tour: elems.slice(2).map(parseInt10)
        };
        
    case "PHEROMONES":
        let trails = {};
        elems.slice(2).forEach(function(trail) {
            let parts = trail.split(":"),
                path = parts[0],
                pheromone = parseFloat(parts[1]);
            trails[path] = pheromone;
        });
        
        return {
            type: "PHEROMONES",
            trails: trails
        };
        
    default:
        throw new Error('unknown event "' + elems[0] + '"');
    }
}

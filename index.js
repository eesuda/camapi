'use strict';

const Hapi = require('hapi');

const server = new Hapi.Server();
server.connection({ address: '127.0.0.1', port: 3000 });

var Joi = require('joi');
var gpsd = require('node-gpsd');
var gpslistener = new gpsd.Listener({
    port: 2947,
    hostname: 'localhost',
    logger:  {
        info: function() {},
        warn: console.warn,
        error: console.error
    },
    parse: true
});
var gpstpv = {};

gpslistener.on('TPV', function(tpvData) {
    gpstpv = tpvData;
});

var sensors = {};

const sizes = ["2560x1920", "1264x948", "624x468"];
var cap_size = 2;
const child_process = require('child_process');
const fs = require('fs');

setInterval(function () {
    child_process.execFile('/home/root/spidev_test', ['-D', '/dev/spidev1.0'],
            function (error, stdout, stderr) {
                sensors.acceleration = Number(stdout);
            });
    fs.readFile('/sys/devices/platform/sht10/temp1_input',
            function (err, data) {
                sensors.temperature= Number(data) / 1000;
            });
    fs.readFile('/sys/devices/platform/sht10/humidity1_input',
            function (err, data) {
                sensors.humidity= Number(data) / 1000;
            });
}, 3000);
child_process.spawn('/home/root/test/set.sh', [cap_size]);

server.route([
    {
    method: 'GET',
    path: '/a/cam/start',
    handler: function (request, reply) {
        child_process.spawn('/home/root/test/test.sh', [cap_size],
                {detached: true, stdio: 'ignore'});
        reply({"status": "success"});
    }
    },
    {
    method: 'GET',
    path: '/a/cam/stop',
    handler: function (request, reply) {
        fs.unlink('/tmp/tele/run.lock', function (err) {
        });
        reply({"status": "success"});
    }
    },
    {
    method: 'PUT',
    path: '/a/cam/set',
    handler: function (request, reply) {
        fs.unlink('/tmp/tele/run.lock', function (err) {
        });
        cap_size = request.query.size;
        child_process.spawn('/home/root/test/set.sh', [cap_size]);
        reply({"size": sizes[cap_size]});
    },
    config: {
        validate: {
            query: {
                size: Joi.number().integer().min(0).max(2).default(2)
            }
        }
    }
    },
    {
    method: 'GET',
    path: '/a/gps',
    handler: function (request, reply) {
        if (!gpslistener.isConnected()) {
            gpslistener.connect(function() {
                console.log('GPS Connected');
                gpslistener.watch();
            });
        }
        reply(gpstpv);
    }
    },
    {
    method: 'GET',
    path: '/a/sensors',
    handler: function (request, reply) {
        reply(sensors);
    }
    }
]);

server.start((err) => {

    if (err) {
        throw err;
    }
    console.log('Server running at:', server.info.uri);
});

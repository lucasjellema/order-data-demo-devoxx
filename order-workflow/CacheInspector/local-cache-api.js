var request = require('request')
;
var http = require("http");

//this module talks to a locally running Redis Cache

var localCacheAPI = module.exports;
var moduleName = "accs.localCacheAPI";
var moduleVersion = "0.8.7";
var Redis = require("redis");

var redisHost = process.env.REDIS_HOST || "192.168.99.104";
var redisPort = process.env.REDIS_PORT || 30297;

var cacheInspectorServiceHost = "192.168.99.104";
var cacheInspectorServicePort = "30297";

var callViaAPI = true;

var redisClient;

if (!callViaAPI) redisClient = Redis.createClient({ "host": redisHost, "port": redisPort });

var cacheAPIOptions = {
"method": "GET",
"hostname": cacheInspectorServiceHost,
"port": cacheInspectorServicePort,
"path": "/cacheEntry",
"headers": {
    "cache-control": "no-cache",
}
};
localCacheAPI.getFromCache = function (key, callback) {
if (callViaAPI) {
    try {

        cacheAPIOptions.path = "/cacheEntry?key=" + key;
        cacheAPIOptions.method = "GET";
        var req = http.request(cacheAPIOptions, function (res) {
            var chunks = [];

            res.on("data", function (chunk) {
                chunks.push(chunk);
            });

            res.on("end", function () {
                var body = Buffer.concat(chunks);
                console.log(body.toString());
                try {
                    var obj = JSON.parse(body);
                    callback(obj);
                }
                catch (err) {
                    console.log("failed parsing cache result under key " + key + " : " + err)
                    console.log("failed parsing cache result: " + err)
                    callback({});
                }
            });
        });

        req.end();
    } catch (err) {
        console.log("Exception : " + err)
    }
} else {
    try {
        console.log("get document from cache api with key " + key);
        redisClient.get(key, function (err, reply) {
            if (err) {
                console.error('ERROR in getting document from cache ' + err);
                callback(null);
            } else {
                try {
                    var obj = JSON.parse(reply);
                    callback(obj);
                }
                catch (err) {
                    console.log("failed parsing cache result under key " + key + " : " + err)
                    console.log("failed parsing cache result: " + err)
                    callback({});
                }

            }//else
        });//get
    } catch (e) {
        console.error('ERROR i  n accessing redis ' + e);
        callback(null);
    }
}
}//getFromCache

localCacheAPI.putInCache = function (key, value, callback) {
if (callViaAPI) {
    try {
        cacheAPIOptions.path = "/cacheEntry";
        cacheAPIOptions.method = "POST";
        var req = http.request(cacheAPIOptions, function (res) {
            var chunks = [];

            res.on("data", function (chunk) {
                chunks.push(chunk);
            });

            res.on("end", function () {
                var body = Buffer.concat(chunks);
                console.log(body.toString());
            });
        });

        req.write(JSON.stringify({
            key: key,
            document: value
        }));
        req.end();
    } catch (err) {
        console.log("Exception : " + err)
    }
}
else {
    try {
        console.log("putInCache Callback = " + callback);
        redisClient.set(key, JSON.stringify(value));
        callback("Put in cache");
    } catch (e) {
        callback("Failed to put in cache " + JSON.stringify(e));
    }
}
}//putInCache


console.log("Local Cache API (version " + moduleVersion + ") initialized running against Redis instance at " + redisHost + ":" + redisPort);

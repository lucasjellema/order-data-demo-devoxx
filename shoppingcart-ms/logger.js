var request = require('request')
    ;
var settings = require("./proxy-settings.js");

var logger = module.exports;

                        
var apiURL = "/logger-api";
//var eventhubAPI = require("./eventhub-api.js");

logger.DEBUG = "debug";
logger.INFO = "info";
logger.WARN = "warning";
logger.ERROR = "error";

logger.log =
    function (message, moduleName, loglevel) {

        /* POST:
      
  {
      "logLevel" : "info"
      ,"module" : "soaring.clouds.accs.artist-api"
      , "message" : "starting a new logger module - message from ACCS"
  	
  }
  */
        var logRecord = {
            "logLevel": loglevel
            , "module": "soaring.clouds." + moduleName
            , "message": message

        };
        var args = {
            data: JSON.stringify(logRecord),
            headers: { "Content-Type": "application/json" }
        };

        var route_options = {};


            var msg = {
                "records": [{
                    "key": "log", "value": {
                        "logLevel": loglevel
                        , "module": "soaring.clouds." + moduleName
                        , "message": message
                        , "timestamp": Date.now()
                        , "eventType": "log"

                    }
                }]
            };

        //    eventhubAPI.postMessagesToEventHub(msg
        //         , function (response) {
        //             console.log("Published log-record to Kafka- response" + JSON.stringify(response));
        //      });


    }//logger.log

logger.registerListeners =
    function (app) {
        app.post(apiURL, function (req, res) {
            // Get the key and value
            console.log('Logger-API POST - now show params');
            console.log('body in request' + JSON.stringify(req.body));
            console.log("content type " + req.headers['content-type']);
            var logRecord = req.body;
            console.log("value submitted in POST to be logged " + JSON.stringify(logRecord));
            logger.log(logRecord.message, logRecord.module, logRecord.logLevel);
            var responseBody = {};
            responseBody['status'] = 'Successful.';
            // Send the response
            res.json(responseBody).end();

        });//post
    }//registerListeners

console.log("Logger API (version " + settings.APP_VERSION + ") initialized at " + apiURL );

var http = require('http'),
  request = require('request'),
  express = require('express'),
  bodyParser = require('body-parser');
var localCacheAPI = require("./local-cache-api.js");
var localLoggerAPI = require("./local-logger-api.js");
var eventBusPublisher = require("./EventPublisher.js");
var eventBusConsumer = require("./EventConsumer.js");


var workflowEventsTopic = "workflowEvents";
var PORT = process.env.APP_PORT || 8091;
var APP_VERSION = "0.8.2"
var APP_NAME = "CheckShipping"

console.log("Running CheckShipping version " + APP_VERSION);


var app = express();
var server = http.createServer(app);
server.listen(PORT, function () {
  console.log('Server running, Express is listening... at ' + PORT + " for /ping, /about and /order  API calls");
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({ type: '*/*' }));
app.get('/about', function (req, res) {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.write("About CheckShipping API, Version " + APP_VERSION);
  res.write("Supported URLs:");
  res.write("/ping (GET)\n;");
  res.write("NodeJS runtime version " + process.version);
  res.write("incoming headers" + JSON.stringify(req.headers));
  res.end();
});

app.get('/ping', function (req, res) {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.write("Reply");
  res.write("incoming headers" + JSON.stringify(req.headers));
  res.end();
});

app.post('/order', function (req, res) {
  // Get the key and value
  console.log('CheckShipping');
  console.log('body in request' + JSON.stringify(req.body));
  console.log("content type " + req.headers['content-type']);
  var order = req.body;
  var validation = checkOrderTotal(order);
  var responseBody = { "result": validation.result, "motivation": validation.motivation };
  // Send the response
  res.setHeader('Content-Type', 'application/json');
  res.send(responseBody);

});

function checkShipping(order) {
  var outcome = {};
  outcome.result = "OK";
  outcome.motivation = "perfectly ok order according to our current set of rules";
  var valid = true;
  var reason = "Not OK because:";
  console.log("check shiping" + JSON.stringify(order));
  if (order.shippingDestination == 'Amsterdam') {
    valid = false;
    reason = "Not OK because: of complex and tax related consideration, we are not allowed to accept orders that result in shipping to Amsterdam";
  }

  if (!valid) {
    outcome.result = "NOK";
    outcome.motivation = reason;
  }
  return outcome;
}

// configure Kafka interaction
eventBusConsumer.registerEventHandler(workflowEventsTopic, handleWorkflowEvent);


function handleWorkflowEvent(eventMessage) {
  var event = JSON.parse(eventMessage.value);
  console.log("received message", eventMessage);
  console.log("received message object", JSON.stringify(eventMessage));
  console.log("actual event: " + JSON.stringify(event));

  // event we expect is of type workflowEvents
  // we should do something with this event if it contains an action (actions[].type='ValidateTweet' where status ="new" and conditions are satisfied)

  if (event.actions) {
    var acted = false;
    for (i = 0; i < event.actions.length; i++) {
      var action = event.actions[i];
      // find action of type CheckShipping
      if ("CheckShipping" == action.type) {
        // check status and conditions
        if ("new" == action.status && conditionsSatisfied(action, event.actions)) {
          var workflowDocument;
          localCacheAPI.getFromCache(event.workflowConversationIdentifier, function (document) {
            console.log("Workflow document retrieved from cache");
            var workflowDocument = document;
            // this happens  asynchronously; right now we do not actually use the retrieved document. It does work.       
          });
          // if satisfied, then validate tweet
          var outcome = checkShipping(event.payload);

          // update action in event
          action.status = 'complete';
          action.result = outcome.result;
          // add audit line
          event.audit.push(
            { "when": new Date().getTime(), "who": "CheckShipping", "what": "update", "comment": "Shipping Check Complete"+ JSON.stringify(outcome) }
          );

          acted = true;
          localLoggerAPI.log("Check Shipping (outcome:" + JSON.stringify(outcome) + ")"
            + " - (workflowConversationIdentifier:" + event.workflowConversationIdentifier + ")"
            , APP_NAME, "info");

        }
      }// if CheckShipping
      // if any action performed, then republish workflow event and store routingslip in cache
    }//for
    if (acted) {
      event.updateTimeStamp = new Date().getTime();
      event.lastUpdater = APP_NAME;

      // PUT Workflow Document back  in Cache under workflow event identifier
      localCacheAPI.putInCache(event.workflowConversationIdentifier, event,
        function (result) {
          console.log("store workflowevent plus routing slip in cache under key " + event.workflowConversationIdentifier + ": " + JSON.stringify(result));
        });

      setTimeout(() => {

        // publish event
        eventBusPublisher.publishEvent('DevoxxOrderWorkflow' + event.updateTimeStamp, event, workflowEventsTopic);
      }
        , 2200
      );


    }// acted
  }// if actions
}// handleWorkflowEvent


function conditionsSatisfied(action, actions) {
  var satisfied = true;
  // verify if conditions in action are methodName(params) {
  //   example action: {
  //   "id": "CaptureToTweetBoard"
  // , "type": "TweetBoardCapture"
  // , "status": "new"  // new, inprogress, complete, failed
  // , "result": "" // for example OK, 0, 42, true
  // , "conditions": [{ "action": "EnrichTweetWithDetails", "status": "complete", "result": "OK" }]
  for (i = 0; i < action.conditions.length; i++) {
    var condition = action.conditions[i];
    if (!actionWithIdHasStatusAndResult(actions, condition.action, condition.status, condition.result)) {
      satisfied = false;
      break;
    }
  }//for
  return satisfied;
}//conditionsSatisfied

function actionWithIdHasStatusAndResult(actions, id, status, result) {
  for (i = 0; i < actions.length; i++) {
    if (actions[i].id == id && actions[i].status == status && actions[i].result == result)
      return true;
  }//for
  return false;
}//actionWithIdHasStatusAndResult
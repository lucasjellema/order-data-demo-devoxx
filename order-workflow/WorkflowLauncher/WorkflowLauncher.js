var localCacheAPI = require("./local-cache-api.js");
var localLoggerAPI = require("./local-logger-api.js");
var eventBusPublisher = require("./EventPublisher.js");
var eventBusConsumer = require("./EventConsumer.js");

var workflowEventsTopic = "workflowEvents";

// please create Kafka Topic before using this application in the VM running Kafka
// kafka-topics --create --zookeeper localhost:2181 --replication-factor 1 --partitions 1 --topic workflowEvents

var APP_VERSION = "0.9.7"
var APP_NAME = "WorkflowLauncher"

var workflowTemplateCacheKey = "devoxx-order-workflow-template";

eventBusConsumer.registerEventHandler(workflowEventsTopic, handleWorkflowEvent);


console.log("Running " + APP_NAME + " version " + APP_VERSION);

setTimeout(() => {
  localLoggerAPI.log(`Initialized and running: ${APP_NAME} - version ${APP_VERSION}`
    , APP_NAME, "info")
}, 3500);

// consume local workflowEvents from Kafka and produce RoutingSlip events for new workflow instances triggered by these events
// Routingslip is based on the workflow template retrieved from the cache
function handleWorkflowEvent(eventMessage) {
  try {
    localLoggerAPI.log(`Handle wfevent`
      , APP_NAME, "debug")
    var event = JSON.parse(eventMessage.value);
    localLoggerAPI.log(`Parsed wfevent`
      , APP_NAME, "debug")
    console.log("received message", eventMessage);
    if ("NewOrder" == event.eventType) {
      localLoggerAPI.log(`NewOrder event was found and a new workflow will be started `
        , APP_NAME, "debug")
      try {
        //  localCacheAPI.getFromCache(workflowTemplateCacheKey, function (value) {

        //  localLoggerAPI.log(`Retrieved workflow template under key ${workflowTemplateCacheKe} from cache ${value}`
        //, APP_NAME, "debug")

        //          console.log("Workflow template retrieved from cache under key " + workflowTemplateCacheKey);
        // use either the template retrieved from the cache of the default template if the cache retrieval failed
        var message = defaultWorkflowTemplate; //  (value.workflowType) ? value : defaultMessage;
        message.payload = event.order;
        message.workflowConversationIdentifier = "DevoxxOrderProcessor" + new Date().getTime();
        message.audit.push({ "when": new Date().getTime(), "who": "WorkflowLauncher", "what": "creation", "comment": "initial creation of workflow" })
        message.creationTimeStamp = new Date().getTime()
        message.creator = "WorkflowLauncher";
        // build in a little delay for pulishing the workflow routing slip.
        setTimeout(() => {
          eventBusPublisher.publishEvent(message.workflowConversationIdentifier, message, workflowEventsTopic);

          localLoggerAPI.log("Initialized new workflow  for Order " + message.payload.id + " by " + message.payload.customerName + " - (workflowConversationIdentifier:" + message.workflowConversationIdentifier + ")"
            , APP_NAME, "info");
          localLoggerAPI.log("Initialized new workflow DevoxxOrderProcessor triggered by NewOrder Event; stored workflowevent plus routing slip in cache under key " + message.workflowConversationIdentifier + " - (workflowConversationIdentifier:"
            + message.workflowConversationIdentifier + "; slip is based on workflow template " + message.workflowType + " version " + message.workflowVersion + ")"
            , APP_NAME, "info");
        }, 2500)

        // PUT Workflow Event in Cache under workflow event identifier
        localCacheAPI.putInCache(message.workflowConversationIdentifier, message,
          function (result) {
            console.log("store workflowevent plus routing slip in cache under key " + message.workflowConversationIdentifier + ": " + JSON.stringify(result));
            localLoggerAPI.log("stored workflowevent plus routing slip in cache under key " + message.workflowConversationIdentifier + ": " + JSON.stringify(result)
              , APP_NAME, "debug");
          });

        //      }) //getFromCache
      } catch (err) {
        localLoggerAPI.log("Exception when getting workflow template from cache " + err
          , APP_NAME, "error");

      }
    }//if 
  } catch (err) {
    localLoggerAPI.log(`Exception while processing workflow event ${err}`
      , APP_NAME, "error")

  }

}// handleWorkflowEvent

var defaultWorkflowTemplate =
  {
    "workflowType": "devoxx-order-processor"
    , "workflowVersion": "0.9"
    , "creator": "WorkflowLauncher"
    , "actions":
    [{
      "id": "CheckShippingDestination"
      , "type": "CheckShipping"
      , "status": "new"  // new, inprogress, complete, failed
      , "result": "" // for example OK, 0, 42, true
      , "conditions": [] // a condition can be {"action":"<id of a step in the routingslip>", "status":"complete","result":"OK"}; note: the implicit condition for this step is that its own status = new   
    }
      , {
      "id": "CheckOrderTotal"
      , "type": "CheckOrderTotal"
      , "status": "new"  // new, inprogress, complete, failed
      , "result": "" // for example OK, 0, 42, true
      , "conditions": []
    }
      , {
      "id": "OrderApprover"
      , "type": "OrderVerdict"
      , "status": "new"  // new, inprogress, complete, failed
      , "result": "" // for example OK, 0, 42, true
      , "conditions": [{ "action": "CheckOrderTotal", "status": "complete", "result": "OK" }
                       , { "action": "CheckShippingDestination", "status": "complete", "result": "OK" }
                      ]
    }
    , {
      "id": "OrderTotalRejector"
      , "type": "OrderVerdict"
      , "status": "new"  // new, inprogress, complete, failed
      , "result": "" // for example OK, 0, 42, true
      , "conditions": [{ "action": "CheckOrderTotal", "status": "complete", "result": "NOK" }]
    }
    , {
      "id": "OrderShippingRejector"
      , "type": "OrderVerdict"
      , "status": "new"  // new, inprogress, complete, failed
      , "result": "" // for example OK, 0, 42, true
      , "conditions": [{ "action": "CheckShippingDestination", "status": "complete", "result": "NOK" }]
    }
    ]
    , "audit": [
      { "when": new Date().getTime(), "who": "WorkflowLauncher", "what": "creation", "comment": "initial creation of workflow" }
    ]
    , "payload": {
    }
  };


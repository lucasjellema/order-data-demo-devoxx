
var onPremisesEventBusConsumer = require("./OnPremisesEventConsumer.js");
var onPremisesEventBusPublisher = require("./OnPremisesEventPublisher.js");
var eventHubPublisher = require("./EventHubPublisher.js");
var eventHubListener = require("./EventHubListener.js");

var onPremisesWorkflowEventsTopic = "workflowEvents";
var eventHubTopicName = "a516817-devoxx-topic";

// please create Kafka Topic before using this application in the VM running Kafka
// kafka-topics --create --zookeeper localhost:2181 --replication-factor 1 --partitions 1 --topic workflowEvents

var APP_VERSION = "0.2"
var APP_NAME = "EventBridge"

onPremisesEventBusConsumer.registerEventHandler(onPremisesWorkflowEventsTopic, handleOnPremiseEvent);

eventHubListener.subscribeToEvents(
  (message) => {
    console.log("EventBridge: Received event from event hub");
    try {
      var event = JSON.parse(message);
        event.eventOnEventHub = "Y";
      handleEventHubEvent(event);

    } catch (error) {
      console.log("failed to parse message from event hub", error);

    }
  }
);


console.log("Running " + APP_NAME + " version " + APP_VERSION);


function handleOnPremiseEvent(eventMessage) {
  console.log("received message on  premises", eventMessage);
  try {
    var event = JSON.parse(eventMessage.value);
    event.eventOnPremises= "Y";

    console.log("handle message received on  premises", eventMessage);
    console.log("-- value: ", JSON.stringify(eventMessage.value));
    // if originated on premises, then publish to Event Hub - provided it has not already been on the Event Hub
    if (!event.eventOnEventHub || !event.eventOnEventHub=="N") {
      publishEventToEventHub(event);
    } else {
      console.log("Do not publish event originating in Event Hub onward to Event Hub");
    }

  } catch (error) {
    console.log("failed to parse  message on premises", error);

  }
}// handleOnPremiseEvent


function handleEventHubEvent(event) {
  console.log("Event payload " + JSON.stringify(event));
    // if originated on premises, then publish to Event Hub - provided it has not already been on the Event Hub
    if (!event.eventOnPremises || !event.eventOnPremises=="N") {
      publishEventToOnPremisesPublisher(event);
    } else {
      console.log("Do not publish event originating on premises onward to on prem");
    }
}

function publishEventToEventHub(event) {
  eventHubPublisher.publishEvent("EventBridge", event, eventHubTopicName);
}

function publishEventToOnPremisesPublisher(event) {
  onPremisesEventBusPublisher.publishEvent("EventBridge", event, onPremisesWorkflowEventsTopic);
}
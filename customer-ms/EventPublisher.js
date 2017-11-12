  var kafka = require('kafka-node');

  // from the Oracle Event Hub - Platform Cluster Connect Descriptor
var kafkaConnectDescriptor = "129.150.77.116";

var Producer = kafka.Producer
KeyedMessage = kafka.KeyedMessage;

var client;

var APP_VERSION = "0.8.3"
var APP_NAME = "EventBusPublisher"


console.log("Initialized module " + APP_NAME + "version " + APP_VERSION);
var producer;
var client;

function initializeKafkaProducer(attempt) {
  try {


    console.log(`Try to initialize Kafka Client at ${kafkaConnectDescriptor} and Producer, attempt ${attempt}`);
    client = new kafka.Client(kafkaConnectDescriptor);
    console.log("created client");
    producer = new Producer(client);
    console.log("submitted async producer creation request");
    producer.on('ready', function () {
      console.log("Producer is ready in " + APP_NAME);
    });
    producer.on('error', function (err) {
      console.log("failed to create the client or the producer " + JSON.stringify(err));
    })
  }
  catch (e) {
    console.log("Exception in initializeKafkaProducer" + e);
    console.log("Exception in initializeKafkaProducer" + JSON.stringify(e));
    console.log("Try again in 5 seconds");
    setTimeout(initializeKafkaProducer, 5000, ++attempt);
  }
}//initializeKafkaProducer
initializeKafkaProducer(1);


var eventPublisher = module.exports;


eventPublisher.publishEvent = function (eventKey, event, topic) {
  km = new KeyedMessage(eventKey, JSON.stringify(event));
  payloads = [
    { topic: topic, messages: [km], partition: 0 }
  ];
  producer.send(payloads, function (err, data) {
    if (err) {
      console.error("Failed to publish event with key " + eventKey + " to topic " + topic + " :" + JSON.stringify(err));
    }
    console.log("Published event with key " + eventKey + " to topic " + topic + " :" + JSON.stringify(data));
  });

}
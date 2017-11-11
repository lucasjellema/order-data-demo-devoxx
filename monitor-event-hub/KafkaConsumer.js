var kafka = require('kafka-node')
var Consumer = kafka.Consumer

var topicName = "a516817-devoxx-topic";

// from the Oracle Event Hub - Platform Cluster Connect Descriptor
var kafkaConnectDescriptor = "129.150.77.116";

var client = new kafka.Client(kafkaConnectDescriptor)

var consumer = new Consumer(
  client,
  [],
  {fromOffset: true}
);

consumer.on('message', function (message) {
  console.log("received message", message);
});

consumer.addTopics([
  { topic: topicName, partitions: 2, offset: 0}
], () => console.log("topic added"));
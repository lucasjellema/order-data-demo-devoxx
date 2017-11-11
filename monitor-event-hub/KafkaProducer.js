// before running, either globally install kafka-node  (npm install kafka-node)
// or add kafka-node to the dependencies of the local application

var kafka = require('kafka-node')
var Producer = kafka.Producer

// from the Oracle Event Hub - Platform Cluster Connect Descriptor
var topicName = "a516817-devoxx-topic";

// from the Oracle Event Hub - Platform Cluster Connect Descriptor
var kafkaConnectDescriptor = "129.150.77.116";

var client = new kafka.Client(kafkaConnectDescriptor);

KeyedMessage = kafka.KeyedMessage,
producer = new Producer(client),
km = new KeyedMessage('key', 'message'),
payloads = [
        { topic: topicName, messages: 'hi from Windows Host', partitions: 1 },
        { topic: topicName, messages: 'hi from node producer', partitions: 1 },
    ];

producer.on('ready', function () {
    console.log("client is ready");
    producer.send(payloads, function (err, data) {
        console.log("send is complete " + data);
        console.log("error " + err);
    });
});

producer.on('error', function (err) {
    console.error("Error "+err);
 })
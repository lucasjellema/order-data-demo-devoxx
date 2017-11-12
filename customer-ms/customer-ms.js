console.log("NodeJS runtime version " + process.version);
var settings = require("./proxy-settings.js");

console.log('Application version ' + settings.APP_VERSION);


// from the Oracle Event Hub - Platform Cluster Connect Descriptor
var topicName = "a516817-devoxx-topic";

var http = require('http'),
	request = require('request'),
	util = require('util'),
	express = require('express'),
	bodyParser = require('body-parser'), // npm install body-parser
	async = require('async'),
	eventBusPublisher = require("./EventPublisher.js");


;

var moduleName = "customer-ms";


//var PORT = 5100;
var PORT = process.env.PORT || settings.PORT;
var ORDER_MICROSERVICE_URL = process.env.ORDER_MICROSERVICE_URL || 'https://orderms-a516817.apaas.us2.oraclecloud.com';
var appVersion = "1.0.1";

console.log(`Read from env var ORDER_MICROSERVICE_URL : ${process.env.ORDER_MICROSERVICE_URL}`)

var app = express();
var server = http.createServer(app);


server.listen(PORT, function () {
	console.log('Server running, version ' + settings.APP_VERSION + ', Express is listening... at ' + PORT + " for Customer Microservice");
});


console.log('server running on port ', PORT);
app.use(bodyParser.urlencoded({ extended: true }));
console.log("body parser json - going to set");
app.use(bodyParser.json({ "type": '*/*', "inflate": "true" }));
console.log("body parser json - has been  set");

app.use(function (request, response, next) {
	console.log("Request with content encoding: " + request.get("Content-Encoding"));
	response.setHeader('Access-Control-Allow-Origin', '*');
	response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
	response.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
	response.setHeader('Access-Control-Allow-Credentials', true);
	next();
});
console.log("Registering Submodules ");

app.get('/customer/:customerId', function (req, res) {
	// Get the key and value
	console.log('Customer Microservice - retrieve customer');
	console.log('Cache-API POST params ' + JSON.stringify(req.params));
	var customerId = req.params['customerId'];
	console.log("customerId " + customerId);

	res.statusCode = 200;
	res.setHeader('Content-Type', 'application/json');
	res.setHeader('MyReply', 'retrieved the customer - with  id ' + customerId);
	res.send({ "customerId ": customerId });

})


app.post('/customer/:customerId', function (req, res) {
	// Get the key and value
	console.log('Customer Microservice - update customer');
	console.log('Cache-API POST params ' + JSON.stringify(req.params));
	var customerId = req.params['customerId'];
	console.log("customer Id " + customerId);
	var customer = req.body;
	customer.id = customerId;
	eventBusPublisher.publishEvent("CustomerModified", {
		"eventType": "CustomerModified"
		, "customer": customer
		, "module": "customer.microservice"
		, "timestamp": Date.now()
	}, topicName);

	res.statusCode = 200;
	res.setHeader('Content-Type', 'application/json');
	res.setHeader('MyReply', 'Updated the Customer and published event on Event Hub - with  id -  ' + customerId);
	res.send(customer);


})


app.get('/about', function (req, res) {
	logger.log("About requested ", moduleName, logger.DEBUG);
	res.writeHead(200, { 'Content-Type': 'text/html' });
	res.write("About Customer Microservice, Version " + settings.APP_VERSION);
	res.write("Supported URLs:");
	res.write("NodeJS runtime version " + process.version);
	res.write("incoming headers" + JSON.stringify(req.headers));
	res.end();
});
app.get('/', function (req, res) {
	res.writeHead(200, { 'Content-Type': 'text/html' });
	res.write("Customer Microservice(" + appVersion + ") - No Data Requested, so none is returned");
	res.write("Try /about");
	res.end();
});


function composeErrorResponse(res, err) {
	logger.log("Error in composing artist response: " + JSON.stringify(err), moduleName, logger.ERROR);
	res.statusCode = 500;
	res.send('An internal error occurred: ' + JSON.stringify(err));
}//composeErrorResponse



// produce unique identifier
function uuidv4() {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
		var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});
}					
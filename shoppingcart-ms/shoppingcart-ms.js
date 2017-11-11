console.log("NodeJS runtime version " + process.version);
var settings = require("./proxy-settings.js");

console.log('Application version ' + settings.APP_VERSION);


var http = require('http'),
	request = require('request'),
	util = require('util'),
	express = require('express'),
	bodyParser = require('body-parser'), // npm install body-parser
	async = require('async')

	;

var logger = require("./logger.js");
var cacheAPI = require("./cache-api.js");
//var eventhubAPI = require("./eventhub-api.js");
//var logProcessor = require("./log-processor.js");
var moduleName = "shoppingcart-ms";


//var PORT = 5100;
var PORT = process.env.PORT || settings.PORT;
var ORDER_MICROSERVICE_URL = process.env.ORDER_MICROSERVICE_URL || 'https://orderms-a516817.apaas.us2.oraclecloud.com';
var appVersion = "0.9.9";

console.log(`Read from env var ORDER_MICROSERVICE_URL : ${process.env.ORDER_MICROSERVICE_URL}`)

var app = express();
var server = http.createServer(app);


server.listen(PORT, function () {
	console.log('Server running, version ' + settings.APP_VERSION + ', Express is listening... at ' + PORT + " for Shopping Cart Microservice");
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
cacheAPI.registerListeners(app);

app.get('/cart/:cartId', function (req, res) {
	// Get the key and value
	console.log('Shppingcart Microservice - retrieve shoppingcart');
	console.log('Cache-API POST params ' + JSON.stringify(req.params));
	var cartId = req.params['cartId'];
	console.log("cartId " + cartId);
	getCartFromCache(cartId, req, res)
})


app.post('/cart/:cartId', function (req, res) {
	// Get the key and value
	console.log('Shppingcart Microservice - update shoppingcart');
	console.log('Cache-API POST params ' + JSON.stringify(req.params));
	var cartId = req.params['cartId'];
	console.log("cartId " + cartId);
	var cart = req.body;
	cart.id = cartId;
	var valString = JSON.stringify(cart);
	console.log("cart value submitted in POST to be stored in Cache" + valString);
	cacheAPI.putInCache(cartId, valString, function (response) {
		// Send the response
		res.json(response).end();
	}
	)
})

app.post('/cart', function (req, res) {
	// Get the key and value
	console.log('Shppingcart Microservice - create shoppingcart');
	console.log('body in request' + JSON.stringify(req.body));
	console.log("content type " + req.headers['content-type']);
	var cartId = uuidv4();
	var cart = req.body;
	cart.id = cartId;
	var valString = JSON.stringify(cart);
	console.log("cart value submitted in POST to be stored in Cache" + valString);
	cacheAPI.putInCache(cartId, valString, function (response) {
		// Send the response
		res.json(response).end();
	}
	)
})

app.post('/cart-checkout/:cartId', function (req, res) {
	// Get the key and value
	console.log('Shppingcart Microservice - checkout shoppingcart');
	console.log('Cache-API POST params ' + JSON.stringify(req.params));
	var cartId = req.params['cartId'];
	console.log("cartId " + cartId);
	// get cart from cache
	cacheAPI.getFromCache(cartId, function (response) {
		console.log("Checking Out Shopping Cart from cache");
		var order = response.value;
		order.checkOutTime = "now";
		// call to order service
		route_options = { method: 'POST',
		url:  ORDER_MICROSERVICE_URL+'/order-api/orders',
		headers: 
		 { 'content-type': 'application/json' },
		body: order
,
		json: true };

        console.log("Call Order Microservice with "+JSON.stringify(route_options));
		request(route_options, function (error, rawResponse, body) {
			console.log("In callback after After request");
			if (error) {
				console.log(JSON.stringify(error));
				res.statusCode = 500;
				res.setHeader('Content-Type', 'application/json');
				res.setHeader('MyReply', 'Going to Check Out the Shopping Cart with cart id ' + cartId);
				res.send(JSON.stringify(error));

			} else {
				console.log(rawResponse.statusCode);
				console.log("BODY:" + JSON.stringify(body));
				// Proper response is 204, no content.
				res.statusCode = 200;
				res.setHeader('Content-Type', 'application/json');
				res.setHeader('MyReply', 'Checked Out the Shopping Cart - sent to Order Microservice with cart id ' + cartId);
				res.send(JSON.stringify(body));
				console.log("And removing the cart from the cache when done");
				
			}
		})

	});//getFromCache


})



app.get('/about', function (req, res) {
	logger.log("About requested ", moduleName, logger.DEBUG);
	res.writeHead(200, { 'Content-Type': 'text/html' });
	res.write("About Shopping Cart Microservice, Version " + settings.APP_VERSION);
	res.write("Supported URLs:");
	res.write("NodeJS runtime version " + process.version);
	res.write("incoming headers" + JSON.stringify(req.headers));
	res.end();
});
app.get('/', function (req, res) {
	res.writeHead(200, { 'Content-Type': 'text/html' });
	res.write("Shopping Cart Microservice(" + appVersion + ") - No Data Requested, so none is returned");
	res.write("Try /about");
	res.end();
});


function composeErrorResponse(res, err) {
	logger.log("Error in composing artist response: " + JSON.stringify(err), moduleName, logger.ERROR);
	res.statusCode = 500;
	res.send('An internal error occurred: ' + JSON.stringify(err));
}//composeErrorResponse


function getCartFromCache(id, req, res) {
	var cartKey = id;
	cacheAPI.getFromCache(cartKey, function (response) {
		res.statusCode = 200;
		res.setHeader('Content-Type', 'application/json');
		res.send(JSON.stringify(response.value));
	});//getFromCache

}//getCartFromCache

function handleLogs(req, res) {
	var logDocumentKey = "log-tail";
	cacheAPI.getFromCache(logDocumentKey, function (response) {
		res.statusCode = 200;
		res.setHeader('Content-Type', 'application/json');
		res.send(JSON.stringify(response.value));
	});//getFromCache

}//handleLogs
var route_options = {
	"method": "GET"
	, "headers": {
		"Authorization": "Bearer 		token"
	}
};



// produce unique identifier
function uuidv4() {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
		var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});
}					
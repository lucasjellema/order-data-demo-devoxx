var http = require("https");

var options = {
  "method": "POST",
  "hostname": "orderms-a516817.apaas.us2.oraclecloud.com",
  "port": null,
  "path": "/order-api/orders",
  "headers": {
    "content-type": "application/json",
    "cache-control": "no-cache",
    "postman-token": "96e1a2ec-0ad3-8e6b-7e5f-0993a689bcfe"
  }
};

var req = http.request(options, function (res) {
  var chunks = [];

  res.on("data", function (chunk) {
    chunks.push(chunk);
  });

  res.on("end", function () {
    var body = Buffer.concat(chunks);
    console.log(body.toString());
  });
});

req.write(JSON.stringify({ customerId: '6172',
  customerName: 'John Doe',
  shippingDestination: 'Russia',
  items: 
   [ { productId: '8128',
       productName: 'football',
       quantity: 38,
       total: 5790.12 } ] }));
req.end();
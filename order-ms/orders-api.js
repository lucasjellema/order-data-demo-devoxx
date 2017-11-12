var https = require('https'),
  http = require('http'),
  fs = require('fs'),
  url = require('url'),
  //	request = require('request'),
  qs = require('querystring'),
  bodyParser = require('body-parser'),
  eventBusPublisher = require("./EventPublisher.js");
eventBusListener = require("./EventListener.js");

dateFormat = require('dateformat');
// not available locally, only on ACCS 

var oracledb = require('oracledb');

var utils = require("./proxy-utils.js");
var settings = require("./proxy-settings.js");

var APP_VERSION = settings.APP_VERSION;

// from the Oracle Event Hub - Platform Cluster Connect Descriptor
var topicName = "a516817-devoxx-topic";
var eventhubConnectstring = process.env.OEHPCS_EXTERNAL_CONNECT_STRING;
console.log(`eventhubConnectstring read from ACC = ${eventhubConnectstring}`)


var ordersAPI = module.exports;
var apiURL = "/order-api";

eventBusListener.subscribeToEvents(
  (message) => {
    console.log("Received event from event hub");
    try {
    var event = JSON.parse(message);
    if (event.eventType=="NewOrder") {
      console.log("It's a new order event ");
    }
    if (event.eventType=="OrderApproved") {
      console.log(`An order has been approved and should now be updated ${event.order.id}`);
      updateOrderStatus( event.order.id, 'APPROVED')
    }
    if (event.eventType=="OrderRejected") {
      console.log(`An order has been rejected and should now be updated ${event.order.id}`);
      updateOrderStatus( event.order.id, 'REJECTED')
    }
    if (event.eventType=="CustomerModified") {
      console.log(`Details for a customer have been modified and the bounded context for order should be updated accordingly ${event.customer.id}`);
      updateCustomerDetailsInOrders( event.customer.id, event.customer)
    }
    console.log("Event payload " + JSON.stringify(event));
    } catch (err) {
      console.log("Parsing event failed "+err);
    }
  }
);



function updateCustomerDetailsInOrders( customerId, customer) {
  console.log(`All orders for cusyomer ${customerId} will  be  updated to new customer name ${customer.name} `);
  console.log('updateCustomerDetailsInOrders');
  handleDatabaseOperation("req", "res", function (request, response, connection) {

    var bindvars = [customer.name, customerId];

    var updateStatement = `update dvx_orders set customer_name = :customerName where customer_id = :customerId`
      ;
    console.log('do updateStatement ' + updateStatement);
    console.log('bind vars' + JSON.stringify(bindvars));
    connection.execute(updateStatement, bindvars, function (err, result) {
      if (err) {
        console.error('error in updateCustomerDetailsInOrders ' + err.message);
        doRelease(connection);
        callback(request, response, order, { "summary": "Update failed", "error": err.message, "details": err });
      }
      else {
        console.log("Rows result: " + JSON.stringify(result));

        connection.commit(function (error) {
          console.log(`After commit - error = ${error}`);
          doRelease(connection);
          // there is no callback:  callback(request, response, order, { "summary": "Update Status succeeded", "details": result });
        });
      }//else
    }); //callback for handleDatabaseOperation
  });//handleDatabaseOperation 
}// updateCustomerDetailsInOrders}

function updateOrderStatus( orderId, status) {
  console.log(`An order will  be  updated ${orderId} to status ${status}`);
  console.log('insertOrderIntoDatabase');
  handleDatabaseOperation("req", "res", function (request, response, connection) {

    var bindvars = [status, orderId];

    var updateStatement = `update dvx_orders set status = :status where id = :id`
      ;
    console.log('do updateStatement ' + updateStatement);
    console.log('bind vars' + JSON.stringify(bindvars));
    connection.execute(updateStatement, bindvars, function (err, result) {
      if (err) {
        console.error('error in updateOrderStatus ' + err.message);
        doRelease(connection);
        callback(request, response, order, { "summary": "Update failed", "error": err.message, "details": err });
      }
      else {
        console.log("Rows inserted: " + JSON.stringify(result));

        connection.commit(function (error) {
          console.log(`After commit - error = ${error}`);
          doRelease(connection);
          // there is no callback:  callback(request, response, order, { "summary": "Update Status succeeded", "details": result });
        });
      }//else
    }); //callback for handleDatabaseOperation
  });//handleDatabaseOperation
}//updateOrderStatus

ordersAPI.registerListeners =
  function (app) {
    console.log("Register listeners for orders-api");
    console.log("Register listeners for orders-api: GET " + apiURL + '/about');

    app.get(apiURL + '/about', function (req, res) {
      handleAbout(req, res);
    });
    console.log("Register listeners for orders-api: GET " + apiURL + '/orders');

    app.get(apiURL + '/orders', function (req, res) {
      handleGetOrders(req, res);
    });
    app.get(apiURL + '/orders/:orderId', function (req, res) {
      handleGetOrder(req, res);
    });
    app.post(apiURL + '/*', function (req, res) {
      handlePost(req, res);
    });


    app.get(apiURL + '/*', function (req, res) {
      handleGet(req, res);
    });
  }//registerListeners


function doClose(connection, resultSet) {
  resultSet.close(
    function (err) {
      if (err) { console.error(err.message); }
      doRelease(connection);
    });
}


handlePost =
  function (req, res) {
    console.log("Handle New Order");
    if (req.url.indexOf('/rest/') > -1) {
      ordersAPI.handleGet(req, res);
    } else {
      var orderId = uuidv4();
      var order = req.body;
      order.id = orderId;
      order.status = "PENDING";
      console.log("Posting new order " + JSON.stringify(order));
      insertOrderIntoDatabase(order, req, res,
        function (request, response, order, rslt) {

          console.log("back from insert with result " + rslt);

          eventBusPublisher.publishEvent("NewOrderEvent", {
            "eventType": "NewOrder"
            ,"order": order
            , "module": "order.microservice"
            , "timestamp": Date.now()
          }, topicName);


          var result = {
            "description": `Order has been creatd with id=${order.id}`
            , "details": "Published event = not yet created in Database " + JSON.stringify(order)
          }
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify(result));

        });//insertOrderIntoDatabase

      addToLogFile("\n[" + dateFormat(new Date(), "dddd, mmmm dS, yyyy, h:MM:ss TT") + "] Handle ordersAPI POST " + req.method + " Request to " + req.url);
      addToLogFile("\nBody:\n" + req.body + "\n ");
    }
  }//ordersAPI.handlePost

ordersAPI.handleGet = function (req, res) {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.write("orders-API - Version " + APP_VERSION + ". No Data Requested, so none is returned; try /orders or /presidentialElection or something else");
  res.write("Supported URLs:");
  res.write("incoming headers" + JSON.stringify(req.headers));
  res.end();
}


handleAbout = function (req, res) {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.write("orders-API - About - Version " + APP_VERSION + ". ");
  res.write("Supported URLs:");
  res.write("/orders-api/orders");
  res.write("incoming headers" + JSON.stringify(req.headers));
  res.end();
}


handleGetOrders = function (req, res) {
  console.log("get orders - we oblige");
  getOrdersFromDBTable(req, res);
}
handleGetOrder = function (req, res) {
  console.log("get a single rich order - we oblige");
  getOrderFromDBAPI(req, res);
}

function addToLogFile(logEntry) {
  utils.addToLogFile('ordersAPI-' + logEntry);
}


capitalize = function (s) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

transformOrders = function (orders) {
  return orders.map(function (o) {
    var order = {};
    console.log("order is " + o);
    order.id = o[0];
    console.log("order is " + 0);
    order.customer_id = o[1];
    console.log("order is " + 1);
    order.customer_name = o[2];
    console.log("order is " + 2);
    order.status = o[3];
    console.log("order is " + 3);
    order.shipping_destination = o[4];
    console.log("order is " + 4);
    return order;
  })
}
getOrdersFromDBTable = function (req, res) {
  console.log('getordersFromDBTable');
  handleDatabaseOperation(req, res, function (request, response, connection) {

    var selectStatement = "select id, customer_id, customer_name, status , shipping_destination from dvx_orders order by last_updated_timestamp";

    connection.execute(selectStatement, {}
      , function (err, result) {
        if (err) {
          return cb(err, conn);
        } else {
          try {
            console.log("----- Orders from database ");
            console.log(result.rows);
            console.log(result.rows.length);
            console.log(result.rows[0]);
            console.log(JSON.stringify(result.rows))

            var orders = result.rows;
            console.log('return orders' + JSON.stringify(orders));
            orders = transformOrders(orders);
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(orders));
          } catch (e) {
            console.error("Exception in callback from execute " + e)
          }
        }
      });
  })
}//getOrdersFromDBTable

insertOrderIntoDatabase = function (order, req, res, callback) {
  console.log('insertOrderIntoDatabase');
  handleDatabaseOperation(req, res, function (request, response, connection) {

    var bindvars = [order.id, order.status, order.customerId, order.customerName, order.shippingDestination];

    var insertStatement = `INSERT INTO dvx_orders (id, status, customer_id,customer_name,shipping_destination) 
                          VALUES (:id, :status,  :customer_id,:customer_name,:shipping_destination)`
      ;
    console.log('do insertStatement ' + insertStatement);
    console.log('bind vars' + JSON.stringify(bindvars));
    connection.execute(insertStatement, bindvars, function (err, result) {
      if (err) {
        console.error('error in insertOrderIntoDatabase ' + err.message);
        doRelease(connection);
        callback(request, response, order, { "summary": "Insert failed", "error": err.message, "details": err });
      }
      else {
        console.log("Rows inserted: " + result.rowsAffected);
        console.log('return result ' + JSON.stringify(result));
        //TODO loop over items and commit each of the items

        connection.commit(function (error) {
          console.log(`After commit - error = ${error}`);
          doRelease(connection);
          callback(request, response, order, { "summary": "Insert succeeded", "details": result });


        });

      }//else
    }); //callback for handleDatabaseOperation
  });//handleDatabaseOperation
} //insertOrderIntoDatabase


function handleDatabaseOperation(request, response, callback) {
  //connectString : process.env.NODE_ORACLEDB_CONNECTIONSTRING || "140.86.4.91:1521/demos.lucasjellema.oraclecloud.internal",
  // var connectString = process.env.DBAAS_DEFAULT_CONNECT_DESCRIPTOR.replace("PDB1", "demos");
  var connectString = process.env.DBAAS_DEFAULT_CONNECT_DESCRIPTOR;

  console.log(`username ${process.env.DBAAS_USER_NAME} and password ${process.env.DBAAS_USER_PASSWORD}`);
  console.log('ConnectString :' + connectString);
  oracledb.getConnection(
    {
      user: "c##devoxx" || process.env.DBAAS_USER_NAME,
      password: process.env.DBAAS_USER_PASSWORD || "devoxx",
      connectString: connectString
    },
    function (err, connection) {
      if (err) {
        console.log('Error in acquiring connection ...');
        console.log('Error message ' + err.message);

        return;
      }
      // do with the connection whatever was supposed to be done
      console.log('Connection acquired ; go execute - call callback ');
      callback(request, response, connection);
    });
}//handleDatabaseOperation


function doRelease(connection) {
  console.log('relese db connection');
  connection.release(
    function (err) {
      if (err) {
        console.error(err.message);
      } else  console.error("DB connection was released");
    });
}


// produce unique identifier
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}	
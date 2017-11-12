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
    console.log("Event payload " + JSON.stringify(event));
    } catch (err) {
      console.log("Parsing event failed "+err);
    }
  }
);

function updateOrderStatus( orderId, status) {
  console.log(`An order will  be  updated ${orderId} to status ${status}`);
  console.log('insertOrderIntoDatabase');
  handleDatabaseOperation(req, res, function (request, response, connection) {

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
          callback(request, response, order, { "summary": "Update Status succeeded", "details": result });
        });
      }//else
    }); //callback for handleDatabaseOperation
  });//handleDatabaseOperation

  
}

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
  res.write("/orders-api/orders/id (e.g. /orders-api/orders/7634)");
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


/* API Design:
[{"id":1,"name":"The Boss","job":"Boss"},{"id":2,"name":"His Righthand","job":"Hand of the Boss"},{"id":3,"name":"First order","job":"Clerk"}]

result from Database:
[{"id":"7369","name":"SMITH","job":"CLERK"}
,{"id":"7499","name":"ALLEN","job":"SALESMAN"},{"id":"7521","name":"WARD","job":"SALESMAN"},{"id":"7566","name":"JONES","job":"MANAGER"},{"id":"7654","name":"MARTIN","job":"SALESMAN"},{"id":"7782","name":"CLARK","job":"MANAGER"},{"id":"7788","name":"SCOTT","job":"ANALYST"},{"id":"7839","name":"KING","job":"PRESIDENT"},{"id":"7844","name":"TURNER","job":"SALESMAN"},{"id":"7876","name":"ADAMS","job":"CLERK"},{"id":"7900","name":"JAMES","job":"CLERK"},{"id":"7902","name":"FORD","job":"ANALYST"},{"id":"7934","name":"MILLER","job":"CLERK"}]

id is String in Database and Number in API design
Job is initcapped in API Design

 

*/
capitalize = function (s) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

transformEmps = function (emps) {
  return emps.map(function (e) { e.id = parseInt(e.id); e.job = capitalize(e.job); e.votes = parseInt(e.votes); return e; })
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



getOrdersFromDBAPI = function (req, res) {
  console.log('getordersFromDBAPI');
  handleDatabaseOperation(req, res, function (request, response, connection) {

    var bindvars = { orders: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 4000 } };
    var plsqlStatement = "begin :orders := order_json_api.get_orders_json; end;";
    console.log('do plsqlstatement ' + plsqlStatement);
    connection.execute(plsqlStatement, bindvars, function (err, result) {
      if (err) {
        console.error('error in get_last_modified ' + err.message);
        doRelease(connection);
      }
      else {
        console.log('return result ' + JSON.stringify(result));
        var orders = result.outBinds.orders;
        doRelease(connection);
        var emps = JSON.parse(orders);
        console.log('return orders' + JSON.stringify(orders));
        console.log('return emps' + JSON.stringify(emps));
        console.log('name first emp to verify success' + emps[1].name);
        emps = transformEmps(emps);
        console.log('return transformed emps' + JSON.stringify(emps));
        // need to transform emps to proper format
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify(emps));
      }//else
    }); //callback for handleDatabaseOperation
  });//handleDatabaseOperation
} //getordersFromDBAPI




getOrderFromDBAPI = function (req, res) {
  var orderIdentifier =req.params.orderId;
  console.log('getOrderFromDBAPI');
  handleDatabaseOperation(req, res, function (request, response, connection) {

    var bindvars = {
      order: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 4000 }
      , orderId: { val: orderIdentifier, dir: oracledb.BIND_IN, type: oracledb.NUMBER }
    };
    var plsqlStatement = "begin :order := order_json_api.get_order_json(p_id => :orderId); end;";
    console.log('do plsqlstatement ' + plsqlStatement);
    connection.execute(plsqlStatement, bindvars, function (err, result) {
      if (err) {
        console.error('error in getOrderFromDBAPI ' + err.message);
        doRelease(connection);
      }
      else {
        console.log('return result ' + JSON.stringify(result));
        var order = result.outBinds.order;
        doRelease(connection);
        var emp = JSON.parse(order);
        console.log('return order' + JSON.stringify(order));
        console.log('return emp' + JSON.stringify(emp));
        console.log('name  emp to verify success' + emp.name);

        if (emp && emp.id) {
          // need to transform emps to proper format
          emp = transformEmp(emp);
          console.log('return transformed emp' + JSON.stringify(emp));
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify(emp));
        } else {
          response.status(404)        // HTTP status 404: NotFound
            .send('order Not found');
        } // no data found     
      }//else
    }); //callback for handleDatabaseOperation
  });//handleDatabaseOperation
} //getOrderFromDBAPI


// this implementation requires Promise support
//  The native Promise implementation is used in Node 0.12 and greater. Promise support is not enabled by default in Node 0.10.
getOrderFromDBAPIWithPromise = function (req, res) {
  var orderIdentifier = parseInt(req.params.orderId);
  var connectString;

  oracledb.getConnection({
    user: process.env.DBAAS_USER_NAME,
    password: process.env.DBAAS_USER_PASSWORD,
    connectString: connectString
  })
    .then(function (conn) {
      var bindvars = {
        order: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 4000 }
        , orderId: { val: orderIdentifier, dir: oracledb.BIND_IN, type: oracledb.NUMBER }
      };
      var plsqlStatement = "begin :order := order_json_api.get_order_json(p_id => :orderId); end;";
      return conn.execute(
        plsqlStatement,
        bindvars
      )
        .then(function (result) {
          var order = result.outBinds.order;
          var emp = JSON.parse(order);
          if (emp && emp.id) {
            emp = transformEmp(emp); // need to transform emps to proper format
            response.json(emp); // return transformed object as application/json
          } else {
            response.status(404)        // HTTP status 404: NotFound
              .send('order Not found');
          } // no data found     
          return conn.close();
        })
        .catch(function (err) {
          console.error(err); // todo: add better error handling!
          return conn.close();
        });
    })
    .catch(function (err) {
      console.error(err); // todo: add better error handling!
    });
} //getOrderFromDBAPI



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
      }
    });
}


// produce unique identifier
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}	
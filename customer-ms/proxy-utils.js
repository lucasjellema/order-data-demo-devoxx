
var fs = require('fs')
   ;
   
var logFile = 'mediator-proxy.txt';

var utils = module.exports;
utils.addToLogFile = function (logEntry) {
  fs.appendFile(logFile, logEntry, function(err)  {
  if (err) console.log("Error happened while write to log file "+err);
  
});
}


utils.searchKeyWithValue = function ( obj, value ){
    for( var key in obj ) {
        if( typeof obj[key] === 'object' ){
            var result = utils.searchKeyWithValue( obj[key], value );
			if (result) {return result;};
        }
        if( obj[key] == value ){
		    return key;
        }
    }//for
    return null;
}//searchKeyWithValue

utils.getValue = function (property, prefix, obj) {
console.log('extract property '+ property+' - prfefix '+' - obj '+JSON.stringify(obj) );
  var value = obj[prefix+property];
	// deal with calls from PCS
	if (value && value[0])
  	  if ( value[0]["_"]) {
	    value = value[0]["_"]
	  }
	return value;
}//getValue

var express = require('express'), 
	compression = require('compression'), 
	url = require('url'), 
	http = require('http'), 
	httpProxy = require('http-proxy');

/**** 
 * 
 * Config parameters
 * 
 * */

var webappPath = '/app',
	serverListenHost = '0.0.0.0', // can be modified
	serverListenPort = '8089', // can be modified
	app = express();

// Enable server-side gzip compression
app.use(compression());

// Serve AngularJS webapp static resources (i.e. HTML, JS, CSS, etc ...)
app.use(express.static(__dirname + webappPath));

/**** 
 * 
 * HTTP Server start
 * 
 * */
var server = http.createServer(app).listen(serverListenPort, serverListenHost, function() {
	console.log('Running on http://'+serverListenHost+':'+serverListenPort+'/');
});
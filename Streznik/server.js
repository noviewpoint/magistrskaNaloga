// NODE_MODULES
var express = require("express");
var path = require("path");
var net = require("net");
var colors = require("colors");
var io = require("socket.io");
var cors = require('cors');
var fs = require("fs");
var parser = require('xml2json');
var parseUri = require("parse-uri");

// STEVILKE PORTOV
var portHttpServer;
var portTcpSocket;
var portWebSocket;

// OSTALE GLOBALNE SPREMENLJIVKE
var app;
var httpServer;
var socketServer;
var globalnoDosegljivSocket;
var tcpServer;

fs.readFile("Konfiguracija.xml", "utf8", function(error, data) {
	if (error) {
		return console.log("Napaka pri branju konfiguracijske datoteke :%s".red, error.message);
	}
	console.log("Xml konfiguracijska datoteka uspesno prebrana".green);
	var naslovi = JSON.parse(parser.toJson(data));

	portHttpServer = parseUri(naslovi.config.address["http-websocket"]);
	portTcpSocket = parseUri(naslovi.config.address["tcp"]);
	portWebSocket = parseUri(naslovi.config.address["http-websocket"]);
	portHttpServer = parseInt(portHttpServer.port.replace(/[^0-9]/g, ""));
	portTcpSocket = parseInt(portTcpSocket.port.replace(/[^0-9]/g, ""));
	portWebSocket = parseInt(portWebSocket.port.replace(/[^0-9]/g, ""));

	initHttpWebsocketServer();
	initTcpServer();
});


/* ---------- HTTP STREZNIK ---------- */
function initHttpWebsocketServer() {
	app = express();
	app.use(cors()); // preden nastavis port!
	app.set("port", portHttpServer);
	app.use(express.static(path.join(__dirname, "public")));
	httpServer = app.listen(app.get("port"), "0.0.0.0", logHttpServer); // 0.0.0.0 poslusaj na vseh interface-ih (za hosting na public IP-ju)
	httpServer.on("connection", httpConnection);
	httpServer.on("error", httpError);
	webSocketServer = io(httpServer);
	webSocketServer.origins("*:*"); // neka cudna WebSocket nastavitev ala CORS, google & stackoverflow it
	webSocketServer.on("connection", webSocketConnection);
	webSocketServer.on("error", webSocketError);

}

function logHttpServer() {
	console.log("HTTP server poslusa na portu %s".yellow, httpServer.address().port);
	logWebSocketServer();
}
function httpConnection(request) {
	var localAddress = request.localAddress + ":" + request.localPort;
	console.log("Vzpostavljena HTTP povezava z '%s'".green, localAddress);
}
function httpError(error) {
	console.log("Napaka HTTP serverja: %s".red, error.message);
}
function logWebSocketServer() {
	console.log("WebSocket server poslusa na portu %s".yellow, httpServer.address().port);
}
function webSocketConnection(socket) {
	var localAddress = socket.request.connection.localAddress + ":" + socket.request.connection.localPort;
	console.log("Vzpostavljena WebSocket povezava z '%s'".green, localAddress);

	globalnoDosegljivSocket = socket;
	socket.on("disconnect", disconnect);

	function disconnect() {
		console.log("Prekinjena WebSocket povezava z '%s'".red, localAddress);
		globalnoDosegljivSocket = null;
	}
}
function webSocketError(error) {
	console.log("Napaka WebSocket serverja: %s".red, error.message);
	globalnoDosegljivSocket = null;
}




/* ----------  TCP STREZNIK ---------- */
function initTcpServer() {
	tcpServer = net.Server();
	tcpServer.listen(portTcpSocket, logTcpServer);
	tcpServer.on("connection", tcpConnection);
	tcpServer.on("error", tcpError);
}

function logTcpServer() {
	console.log("TCP server poslusa na portu %s".yellow, tcpServer.address().port);
}
function tcpConnection(socket) {
	var localAddress = socket.localAddress + ":" + socket.localPort;
	console.log("Vzpostavljena TCP povezava z '%s'".green, localAddress);

	socket.on("data", data);
	socket.once("close", close);
	socket.on("error", error);
	socket.on("end", end);

	var buffers = [];

	function data(d) {
		var datum = new Date();
		console.log("%s:%s:%s.%s - Prejeti raw podatki po TCP povezavi z '%s'".cyan, datum.getHours(), datum.getMinutes(), datum.getSeconds(), datum.getMilliseconds(), localAddress);

		buffers.push(new Buffer(d, "ascii"));
		console.log("Received buffer length:", buffers[buffers.length - 1].length);
		
		if (buffers.length > 10) { // neka varnostna omejitev, da server ne zapolni prevec rama
			console.log("Zgodovina bufferjev vecja od 10".red);
			clearBuffers();
			console.log("Koncujem procesiranje prejetih podatkov".red);
			return;
		}
		var buffer = Buffer.concat(buffers);

		var x = null;
		try {
			console.log("Parsanje raw podatkov v json");
			x = JSON.parse(buffer.toString());
			console.log("Parsanje uspesno opravljeno".green);
		} catch(error) {
			console.log("Napaka pri parsanju raw podatkov v json: %s".red, error.message);
			//console.log("See you next time".red);
			return;
		}

		if (globalnoDosegljivSocket) {
			sendViaWebSocket(x);
			// writeToDB(x);
			clearBuffers();
		} else {
			console.log("Web socket ni na voljo".red);
			clearBuffers();
		}

		function sendViaWebSocket(x) {
			globalnoDosegljivSocket.emit("gibanje", x);
			console.log("Json poslan prek WebSocket povezave".magenta);
		}
		function writeToDB(x) {

		}
		function clearBuffers() {
			console.log("Brisem zgodovino bufferjev".yellow);
			buffers = [];
		}
	}
	function close() {
		console.log("Zaprta TCP povezava z '%s'".red, localAddress);
	}
	function error(error) {
		console.log("Napaka TCP povezave z '%s':  %s".red, localAddress, error.message);
	}
	function end() {
		console.log("End of TCP");
	}
}
function tcpError(error) {
	console.log("Napaka TCP serverja: %s".red, error.message);
}
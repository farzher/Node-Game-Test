// imports
var port = process.env.PORT || 25565;
var io = require('socket.io').listen(port);
var _ = require('underscore');

// global variables
var settings = {
	fps:24, // frames per second
	width:860,
	height:640,
	hitbox:{x:25, y:25}
};
var clients = [];
var bullets = [];
var gameState = {};

var maze = [{start:{x:0, y:200}, end:{x:settings.width, y:200}}];

// socket logic
// io.set('log level', 1);
io.sockets.on('connection', function (socket) {
	//handle connection
	var client = {};
	client.id = socket.id;
	client.x = Math.random() * (settings.width - 100);
	client.y = Math.random() * (settings.height - 100);
	client.keyState = {};
	clients.push(client);

	//update and send settings
	settings.id = client.id;
	socket.emit('settings', settings);

	// handle disconnection
	socket.on('disconnect', function() {
		clients = _.filter(clients, function(v) {
			return v.id !== socket.id;
		});
	});

	// handle keyState
	socket.on('keydown', function(data) {
		client.keyState[data] = true;
	});
	socket.on('keyup', function(data) {
		client.keyState[data] = false;
	});

	// handle chat
	socket.on('message', function(data) {
		// io.sockets.emit('message', client.id+': '+data);
		io.sockets.emit('message', data);
	});
});

// game loop
setInterval(function() {
	gameState.clients = clients;
	gameState.bullets = bullets;
	updateClient();
	updateBullet();

	io.sockets.volatile.emit('gameState', gameState);
}, 1000/settings.fps);

function updateClient() {
	_.each(clients, function(v) {
		// shoot
		if(v.keyState[32]) {
			var bullet = {x:v.x, y:v.y, client_id:v.id};
			bullets.push(bullet);
		}

		// move
		if(v.keyState[37]) v.x -= 7;
		if(v.keyState[38]) v.y -= 7;
		if(v.keyState[39]) v.x += 7;
		if(v.keyState[40]) v.y += 7;
		if(v.x < 0) v.x = 0;
		if(v.x > settings.width) v.x = settings.width;
		if(v.y > settings.height) v.y = settings.height;
		if(v.y < 0) v.y = 0;
	});
}
function updateBullet() {
	_.each(bullets, function(v) {
		v.x += 10;
	});
	//kill bullets that go offscreen
	bullets = _.filter(bullets, function(v) {
		return (v.x > 0 && v.x < settings.width && v.y > 0 && v.y < settings.height);
	});
}

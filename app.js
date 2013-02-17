// imports
var port = process.env.PORT || 25565;
var io = require('socket.io').listen(port);
var _ = require('underscore');

//game logic
function Player(socket) {
	var player = this;
	player.socket = socket;
	player.id = socket.id;
	player.x = Game.randomX();
	player.y = Game.randomY();
	player.rotation = 0;
	player.hp = 100;
	player.keyState = {};

	//player listens for its own events
	player.socket.on('keydown', function(keyCode) {
		player.keyState[keyCode] = true;
	});
	player.socket.on('keyup', function(keyCode) {
		player.keyState[keyCode] = false;
	});

	//called by game loop every frame
	player.update = function() {
		// move
		if(player.keyState[37]) player.x -= 7;
		if(player.keyState[38]) player.y -= 7;
		if(player.keyState[39]) player.x += 7;
		if(player.keyState[40]) player.y += 7;
		if(player.x < 0) player.x = 0;
		if(player.x > Game.settings.width) player.x = Game.settings.width;
		if(player.y > Game.settings.height) player.y = Game.settings.height;
		if(player.y < 0) player.y = 0;
	}

	player.getState = function() {
		var state = _.pick(player, 'id', 'x', 'y', 'rotation', 'hp');
		return state;
	}
}

function Game(gameId) {
	var game = this;
	game.gameId = gameId;
	game.players = [];

	game.start = function() {
		//send each player game settings
		game.emit('settings', Game.settings);
		//get each player connected, and add them to the game
		var sockets = io.sockets.clients(game.gameId);
		_.each(sockets, function(socket) {
			var player = new Player(socket);
			game.addPlayer(player);
		});
		//start the game loop
		setInterval(game.gameLoop, 1000/Game.settings.fps);
	}

	game.gameLoop = function() {
		game.updatePlayers();
		game.emitState();
	}

	game.updatePlayers = function() {
		_.each(game.players, function(player) {
			player.update();
		});
	}

	game.emitState = function() {
		var state = game.getState();
		game.volatile('state', state);
	}

	game.getState = function() {
		var state = {};
		state.p = [];
		_.each(game.players, function(player) {
			state.p.push(player.getState());
		});
		return state;
	}

	game.emit = function(message, data) {
		io.sockets.in(gameId).emit(message, data);
	}
	game.volatile = function(message, data) {
		io.sockets.in(gameId).volatile.emit(message, data);
	}

	//when a player disconnects, they forfeit the game
	//let the other player know they won
	//socket is the player that left
	game.exit = function(socket) {

	}

	game.addPlayer = function(player) {
		game.players.push(player);
	}
}
//all active game rooms
Game.games = [];
//game settings
Game.settings = {
	fps: 24,
	width: 860,
	height: 640
}
//helper functions
Game.randomX = function() {
	return Math.floor(Math.random() * Game.settings.width);
}
Game.randomY = function() {
	return Math.floor(Math.random() * Game.settings.height);
}

//matchmaking
//currently only works for 1v1 matchmaking
io.sockets.on('connection', function(socket) {
	//tell the player what their id is
	socket.emit('id', socket.id);

	//when a player connects to the server, put them in the matchmaking room
	socket.join('mm');

	var sockets = io.sockets.clients('mm');
	if(sockets.length == 2) {
		//when 2 players are in the matchmaking room
		//make a new unique game
		var gameId = _.uniqueId();
		var game = new Game(gameId);
		Game.games.push(game);
		
		//add both players to the new game room
		_.each(sockets, function(socket) {
			socket.join(gameId);
			socket.leave('mm');
			socket.on('disconnect', function() {
				//when a plyer disconnects, they forfeit the game
				//let the other player know that they won and close the game room
				game.exit(socket);
				//remove the game from the games array
				_.reject(Game.games, function(game) {
					return game.gameId == gameId;
				});
			});
		});

		//after the players have been added, start the game
		game.start();
	}
});

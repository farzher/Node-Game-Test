// imports
var port = process.env.PORT || 25565;
var io = require('socket.io').listen(port, {origins: '*:*'});
var _ = require('underscore');

//game logic
//active game rooms
var games = [];

function Player(socket) {
	this.id = socket.id;
	this.socket = socket;
}
function Game(gameId) {
	this.gameId = gameId;
	players = [];

	addPlayer = function(player) {
		players.push(player);
		if(players.length == 2) {
			//let's start the game
			start();
		}
	}

	start = function() {
		//TODO: start the game
		emit('start', true);
	}

	emit = function(message, data) {
		_.each(players, function(player) {
			player.emit(message, data);
		});
	}

	exit = function(player, message) {

	}
}
Game.findById = function(gameId) {
	return _.findWhere(games, {gameId: gameId});
}

var gameio = io.of('/game');
gameio.on('connection', function(socket) {
	socket.on('game', function(gameId) {
		var game = Game.findById(gameId);
		var player = new Player(socket, gameId);
		game.addPlayer(player);
	});
	socket.on('disconnect', function(socket) {
		_.every(games, function(game) {
			var player = _.findWhere(game.players, {id: socket.id});
			if(player) {
				game.exit(player, 'The other player left the game.');
				return false;
			}
		});
	});
});

//matchmaking
//currently only works for 1v1 matchmaking
(function() {
	function mmClient(socket) {
		this.id = socket.id;
	}
	var mmio = io.of('/mm');
	var mmClients = [];
	mmio.on('connection', function(socket) {
		var client = new mmClient(socket);
		mmClients.push(client);

		if(mmClients.length == 2) {
			//we have two people, let's match them up into a game
			var gameId = _.uniqueId();
			games.push(new Game(gameId));
			_.each(mmClients, function(client) {
				client.emit('game', gameId);
			});
			mmClients = [];
		}
		socket.on('disconnect', function(socket) {
			_.reject(mmClients, function(client) {
				return client.id = socket.id;
			});
		});
		//this should never ever happen
		if(mmClients.length > 2) {
			socket.disconnect();
		}
	});
})();

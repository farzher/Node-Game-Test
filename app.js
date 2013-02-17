// imports
var port = process.env.PORT || 25565;
var io = require('socket.io').listen(port);
var _ = require('underscore');

//game logic
//active game rooms
var games = [];
function Game(gameId) {
	//init
	this.gameId = gameId;

	this.start = function() {
		//TODO: start the game
		this.emit('start', gameId);
	}

	this.emit = function(message, data) {
		io.sockets.in(gameId).emit(message, data);
	}

	//when a player disconnects, they forfeit the game
	//let the other player know they won
	//socket is the player that left
	this.exit = function(socket) {

	}
}

//matchmaking
//currently only works for 1v1 matchmaking
io.sockets.on('connection', function(socket) {
	//when a player connects to the server, put them in the matchmaking room
	socket.join('mm');

	var sockets = io.sockets.clients('mm');
	if(sockets.length == 2) {
		//when 2 players are in the matchmaking room
		//make a new unique game
		var gameId = _.uniqueId();
		var game = new Game(gameId);
		games.push(game);
		
		//add both players to the new game room
		_.each(sockets, function(socket) {
			socket.join(gameId);
			socket.leave('mm');
			socket.on('disconnect', function() {
				//when a plyer disconnects, they forfeit the game
				//let the other player know that they won and close the game room
				game.exit(socket);
				//remove the game from the games array
				_.reject(games, function(game) {
					return game.gameId == gameId;
				});
			});
		});

		//after the players have been added, start the game
		game.start();
	}
});

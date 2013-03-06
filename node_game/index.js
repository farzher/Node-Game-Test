var socketio = require('socket.io');
var _ = require('underscore');

var io = null;
var games = [];

module.exports = new function() {

	this.listen = function(port) {
		io = socketio.listen(port);
	}

	this.matchmaking = function(gameClass, playerCount) {
		if(io === null) {
			console.log('You must first listen to a port');
			return false;
		}

		io.sockets.on('connection', function(socket) {
			//tell the player what their id is
			socket.emit('id', socket.id);

			//when a player connects to the server, put them in the matchmaking room
			socket.join('mm');

			var sockets = io.sockets.clients('mm');
			if(sockets.length === playerCount) {
				//when playerCount players are in the matchmaking room
				//make a new unique game
				var gameId = _.uniqueId('gameId');
				var game = new gameClass(gameId, io);
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
							return game.gameId === gameId;
						});
					});
				});

				//after the players have been added, start the game
				game.start();
			}
		});
		return true;
	}

}();

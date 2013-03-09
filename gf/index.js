// imports
var socketio = require('socket.io');
var _ = require('underscore');

/**
 * Main entry point for the user!!!!
 * They just listen to a port
 * then pass their Gameplay class in here and they're good to go
 * 
 * <code>
 * gf.listen(port);
 * gf.matchmaking(Gameplay, playerCount);
 * </code>
 */
var GF = new function() {
	var self = this;
	self.io = undefined;
	self.games = [];

	/**
	 * User should call this first. And only once
	 * @param int port
	 */
	self.listen = function(port) {
		self.io = socketio.listen(port);
	}

	/**
	 * User passes their Gameplay class into here.
	 * the Gameplay class should accept a Game class as it's only argument.
	 * @param  class Gameplay
	 * @param  int playerCount
	 */
	self.matchmaking = function(Gameplay, playerCount) {
		// errors checking
		if(self.io === undefined) {
			console.log('You must first listen to a port');
			return false;
		}
		// set defaults
		if(playerCount === undefined) {
			playerCount = 2;
		}

		self.io.sockets.on('connection', function(socket) {
			//tell the player what their id is
			socket.emit('id', socket.id);

			//when a player connects to the server, put them in the matchmaking room
			socket.join('mm');

			var sockets = self.io.sockets.clients('mm');
			if(sockets.length === playerCount) {
				//when playerCount players are in the matchmaking room
				//make a new unique game; put everyone into that game, and kick them out of mm lobby
				var game = new Game(Gameplay);

				//add all players to the new game
				_.each(sockets, function(socket) {
					socket.leave('mm');
					socket.join(game.gameId);
					socket.on('disconnect', function() {
						game.exit(socket);
					});
					var player = new Player(socket);
					game.addPlayer(player);
				});

				//start the game when everything is good
				game.start();
			}
		});
		return true;
	}
}

/**
 * Each connected player is attached to one of these
 * it keeps track of their keystate and stuff
 */
function Player(socket) {
	var self = this;
	self.socket = socket;
	self.keyState = {};
	self.state = {};
}

/**
 * A single instance of a game room. Based on the supplied Gameplay class
 * this handles all the connected users and provides functions to the Gameplay
 * class like emit, etc.
 * This also has the current game state object
 * 
 * @param class Gameplay
 * @param io.sockets sockets All the connected players in this room only
 */
function Game(Gameplay) {
	var self = this;
	self.gameId = _.uniqueId('gameId');
	self.gameplay = undefined;
	self.sockets = undefined;
	self.players = [];
	self.state = {};

	/**
	 * emit, it's awesome
	 */
	self.emit = function(message, data) {
		GF.io.sockets.in(self.gameId).emit(message, data);
	}
	/**
	 * volatile, also awesome
	 */
	self.volatile = function(message, data) {
		GF.io.sockets.in(self.gameId).volatile(message, data);
	}

	/**
	 * [addPlayer description]
	 * @param Player player [description]
	 */
	self.addPlayer = function(player) {
		self.players.push(player);
	}

	/**
	 * when a player disconnects, they forfeit the game
	 * let the other player know they won
	 * socket is the player that left
	 */
	self.exit = function(socket) {
		//remove the game from the games array
		GF.games = _.reject(GF.games, function(game) {
			return game.gameId === self.gameId;
		});
	}

	/**
	 * [start description]
	 */
	self.start = function() {
		self.sockets = GF.io.sockets.clients(self.gameId);
		self.gameplay = new Gameplay(self);
	}
}

module.exports = GF;

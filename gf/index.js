// imports
var socketio = require('socket.io');
var _ = require('underscore');

/**
 * Main entry point for the user!!!!
 * They just listen to a port
 * then pass their GameClass class in here and they're good to go
 * 
 * <code>
 * gf.listen(port);
 * gf.matchmaking(GameClass, PlayerClass, playerCount);
 * </code>
 */
var GF = new function() {
	var self = this;
	self.io = undefined;
	self.games = [];
	self.players = [];

	/**
	 * User should call this first. And only once
	 * @param int port
	 */
	self.listen = function(port) {
		self.io = socketio.listen(port);
	}

	/**
	 * User passes their GameClass class into here.
	 * the GameClass class should accept a Game class as it's only argument.
	 * @param  class GameClass
	 * @param class PlayerClass
	 * @param  int playerCount
	 */
	self.matchmaking = function(GameClass, PlayerClass, playerCount) {
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
			var player = new Player(PlayerClass, socket);
			player.joinMm();

			var players = self.getPlayersInMm();
			if(players.length === playerCount) {
				//when playerCount players are in the matchmaking room
				//make a new unique game; put everyone into that game, and kick them out of mm lobby
				var game = new Game(GameClass);

				//add all players to the new game
				_.each(players, function(player) {
					player.joinGame(game);
				});

				//start the game when everything is good
				game.start();
			}
		});
		return true;
	}

	self.getPlayerBySocket = function(socket) {
		var player = undefined;
		_.every(self.players, function(v) {
			if(v.socket === socket) {
				player = v;
				return false;
			}
			return true;
		});
		return player;
	}
	self.getPlayersInMm = function() {
		var sockets = self.io.sockets.clients('mm');
		var players = [];
		_.each(sockets, function(socket) {
			var player = self.getPlayerBySocket(socket);
			if(player) {
				players.push(player);
			}
		});
		return players;
	}
}

/**
 * Each connected player is attached to one of these
 * it keeps track of their keystate and stuff
 * Each game has an array of these guys
 */
function Player(PlayerClass, socket) {
	var self = this;
	self.player = new PlayerClass(self);
	self.socket = socket;
	self.id = socket.id
	self.keyState = {};
	self.state = {};
	self.game = undefined;

	/**
	 * tell the player what their id is
	 */
	self.init = function() {
		GF.players.push(self);
		self.emit('id', self.id);

		//clean up stuff when the player loses connection
		self.socket.on('disconnect', function() {
			if(self.game) {
				self.game.exit(self);
			}
			GF.players = _.reject(GF.players, function(player) {
				return (player.socket === self.socket);
			});
		});

		//player listens for its key events and keeps it's internal keyState up to date
		self.socket.on('keydown', function(keyCode) {
			self.keyState[keyCode] = true;
		});
		self.socket.on('keyup', function(keyCode) {
			self.keyState[keyCode] = false;
		});
	}
	self.emit = function(message, data) {
		self.socket.emit(message, data);
	}
	self.volatile = function(message, data) {
		self.socket.volatile(message, data);
	}
	self.joinMm = function() {
		self.game = undefined;
		self.socket.join('mm');
	}
	self.joinGame = function(game) {
		self.game = game;
		self.socket.leave('mm');
		self.socket.join(game.gameId);
		self.game.addPlayer(self);
	}

	self.init();
}

/**
 * A single instance of a game room. Based on the supplied GameClass class
 * this handles all the connected users and provides functions to the GameClass
 * class like emit, etc.
 * This also has the current game state object
 * 
 * @param class GameClass
 * @param io.sockets sockets All the connected players in this room only
 */
function Game(GameClass) {
	var self = this;
	self.gameId = _.uniqueId('gameId');
	self.GameClass = undefined;
	self.players = [];
	self.state = {};

	self.emit = function(message, data) {
		GF.io.sockets.in(self.gameId).emit(message, data);
	}
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
		self.GameClass = new GameClass(self);
	}
}

module.exports = GF;

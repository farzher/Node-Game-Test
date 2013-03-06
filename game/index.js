var _ = require('underscore');

//game logic
function Player(socket, game) {
	var player = this;
	player.socket = socket;
	player.id = socket.id;
	player.x = Game.randomX();
	player.y = Game.randomY();
	player.rotation = 0;
	player.hp = 100;
	player.keyState = {};
	player.state = {};
	player.speed = 10;
	player.rotationSpeed = 15;
	player.game = game;

	//player listens for its own events
	player.socket.on('keydown', function(keyCode) {
		player.keyState[keyCode] = true;
	});
	player.socket.on('keyup', function(keyCode) {
		player.keyState[keyCode] = false;
	});

	//called by game loop every frame
	player.update = function() {
		// rotate
		if(player.keyState[37]) player.rotation -= player.rotationSpeed;
		if(player.keyState[39]) player.rotation += player.rotationSpeed;
		player.rotation = player.rotation % 360;

		var rads = player.rotation * Math.PI / 180;

		// move
		if(player.keyState[38]) {
			player.x += Math.round(Math.cos(rads) * player.speed);
			player.y += Math.round(Math.sin(rads) * player.speed);
		}
		if(player.keyState[40]) {
			player.x -= Math.round(Math.cos(rads) * player.speed);
			player.y -= Math.round(Math.sin(rads) * player.speed);
		}

		//boundries
		if(player.x < 0) player.x = 0;
		if(player.x > Game.settings.width) player.x = Game.settings.width;
		if(player.y > Game.settings.height) player.y = Game.settings.height;
		if(player.y < 0) player.y = 0;

		//shoot
		if(player.keyState[32]) {
			player.shoot();
		}
	}

	player.shoot = _.throttle(function() {
		var bullet = new Bullet(player, player.game);
		player.game.addBullet(bullet);
	}, 50);

	player.getState = function() {
		var currentState = player.state;
		var state = _.pick(player, 'id', 'x', 'y', 'rotation', 'hp');
		var differenceState = {};
		_.each(state, function(value, key) {
			var isDifferent = value != currentState[key];
			if(isDifferent) {
				differenceState[key] = value;
			}
		});
		player.state = state;
		return differenceState;
	}
}

function Bullet(player, game) {
	var bullet = this;
	bullet.playerId = player.id;
	bullet.player = player;
	bullet.game = game;
	bullet.x = player.x;
	bullet.y = player.y;
	bullet.rotation = player.rotation - 180;
	bullet.speed = 15;
	bullet.state = {};

	bullet.update = function() {
		var rads = bullet.rotation * Math.PI / 180;
		bullet.x += Math.round(Math.cos(rads) * bullet.speed);
		bullet.y += Math.round(Math.sin(rads) * bullet.speed);

		//boundries
		if(bullet.x < 0
		|| bullet.x > Game.settings.width
		|| bullet.y > Game.settings.height
		|| bullet.y < 0) {
			bullet.remove();
		}
	}

	bullet.remove = function() {
		bullet.game.removeBullet(bullet);
	}

	bullet.getState = function() {
		var state = _.pick(bullet, 'x', 'y', 'playerId');

		bullet.state = state;
		return state;
	}
}

function Game(gameId, io) {
	var game = this;
	game.gameId = gameId;
	game.io = io;
	game.players = [];
	game.bullets = [];
	game.state = {};

	game.start = function() {
		//send each player game settings
		game.emit('settings', Game.settings);
		//get each player connected, and add them to the game
		var sockets = game.io.sockets.clients(game.gameId);
		_.each(sockets, function(socket) {
			var player = new Player(socket, game);
			game.addPlayer(player);
		});
		//start the game loop
		setInterval(game.gameLoop, 1000/Game.settings.fps);
	}

	game.gameLoop = function() {
		game.updatePlayers();
		game.updateBullets();
		game.emitState();
	}

	game.updatePlayers = function() {
		_.each(game.players, function(player) {
			player.update();
		});
	}

	game.updateBullets = function() {
		_.each(game.bullets, function(bullet) {
			bullet.update();
		});
	}

	game.emitState = function() {
		var state = game.getState();
		//state is empty unless proven otherwise
		var isEmpty = true;
		//check if any players have changed
		if(_.some(state.p, function(p) {
			return !_.isEmpty(p);
		})) {
			isEmpty = false;
		}
		//check if any bullets exist
		if(!_.isEmpty(state.b)) {
			isEmpty = false;
		}
		//only emit the state if anything has changed
		if(!isEmpty) {
			game.emit('state', state);
		}
	}

	game.getState = function() {
		var state = {};
		
		state.p = [];
		_.each(game.players, function(player) {
			state.p.push(player.getState());
		});

		state.b = [];
		_.each(game.bullets, function(bullet) {
			state.b.push(bullet.getState());
		})

		game.state = state;
		return state;
	}

	game.emit = function(message, data) {
		game.io.sockets.in(gameId).emit(message, data);
	}
	game.volatile = function(message, data) {
		game.io.sockets.in(gameId).volatile.emit(message, data);
	}

	//when a player disconnects, they forfeit the game
	//let the other player know they won
	//socket is the player that left
	game.exit = function(socket) {

	}

	game.addPlayer = function(player) {
		game.players.push(player);
	}
	game.addBullet = function(bullet) {
		game.bullets.push(bullet);
	}
	game.removeBullet = function(bullet) {
		game.bullets = _.reject(game.bullets, function(value) {
			return value === bullet;
		});
	}
}
//game settings
Game.settings = {
	fps: 24,
	width: 860,
	height: 640,
	playerHitbox: {x: 25, y: 25},
	bulletHitbox: {x: 10, y: 10}
}
//helper functions
Game.randomX = function() {
	return _.random(0, Game.settings.width);
}
Game.randomY = function() {
	return _.random(0, Game.settings.height);
}

module.exports = Game;

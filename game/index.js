var _ = require('underscore');

/**
 * Player Class
 * @param int num 1 or 2
 */
function Player(num, socket, game) {
	var self = this;
	self.num = num;
	self.socket = socket;
	self.game = game;
	self.id = socket.id;

	self.init = function() {
		if(self.isPlayerOne()) {
			self.x = 50;
		} else {
			self.x = 250;
		}
		self.moveSpeed = 10;
		self.keyState = {};
		self.state = {};
		self.blockState = '';
		self.currentAttack = null;
		self.frameCounter = 0;
		self.recoveryCounter = 0;
		self.downCounter = 0;
		self.hp = 100;
	}

	// What player am I!?
	self.isPlayerOne = function() { return self.num === 1; }
	self.isPlayerTwo = function() { return self.num === 2; }

	self.updateMove = function() {
		if(!self.canAct()) return false;

		// move & block
		// if you're not moving, you automatically middle block
		if(self.keyState[37]) {
			self.x -= self.moveSpeed;
			self.blockState = '';
		} else if(self.keyState[39]) {
			self.x += self.moveSpeed;
			self.blockState = '';
		} else if(self.keyState[40]) {
			self.blockState = 'low';	
		} else {
			self.blockState = 'middle';
		}

		// don't move out of bounds
		if(self.x < 0) {
			self.x = 0;
		} else if(self.x > Game.settings.width) {
			self.x = Game.settings.width;
		}

		//push the other player if moving into him
		if(self.num === 1) {
			if(self.x + Game.settings.player.width > game.p2.x) {
				game.p2.x = self.x + Game.settings.player.width;
			}
		} else {
			if(self.x - Game.settings.player.width < game.p1.x) {
				game.p1.x = self.x - Game.settings.player.width;
			}
		}

		return true;
	}
	self.updateAttack = function() {
		if(!!self.currentAttack) {
			self.frameCounter -= 1;
			if(self.frameCounter < 0) {
				self.executeAttack(self.currentAttack);
			}
		}
	}
	self.updateRecovery = function() {
		self.recoveryCounter -= 1;
		if(self.recoveryCounter < 0) {
			self.recoveryCounter = 0;
		}
	}
	self.updateDown = function() {
		self.downCounter -= 1;
		if(self.downCounter < 0) {
			self.downCounter = 0;
		}
	}
	/**
	 * Called every update frame.
	 */
	self.update = function() {
		self.updateAttack();
		self.updateRecovery();
		self.updateDown();
		self.updateMove();
	}

	self.getBlockState = function() {
		// can't block while not able to act
		if(!self.canAct()) {
			self.blockState = '';
		}
		return self.blockState;
	}
	self.isRecovering = function() {
		return !!self.recoveryCounter;
	}
	self.isDown = function() {
		return !!self.downCounter;
	}
	self.isAttacking = function() {
		return !!self.currentAttack;
	}
	self.canAct = function() {
		return (!self.isRecovering() && !self.isDown() && !self.isAttacking());
	}

	/**
	 * Called when the user press an attack key
	 * @param object attack What attack they're trying to use
	 */
	self.beginAttack = function(attack) {
		if(!self.canAct()) return false;

		self.resetStatus();
		self.currentAttack = attack;
		self.frameCounter = attack.speed;
	}
	/**
	 * After the entire animation for an attack has successfully finished.
	 * Execute the attack. Did we miss? Did they block? Resolve all of this
	 * add apply the necessary status to everyone
	 */
	self.executeAttack = function(attack) {
		self.resetStatus();

		var player = self.getOtherPlayer();
		var isInRange = Player.isInRange(attack, self.game);
		var isDown = player.isDown();
		var isHit = isInRange && !isDown;
		if(!isHit) {
			self.recoveryCounter = attack.recoveryMiss;
			return false;
		}

		var isBlocked = attack.blockedBy.indexOf(player.getBlockState()) !== -1;
		if(isBlocked) {
			self.recoveryCounter = attack.recoveryBlocked;
			player.recoveryCounter = attack.stunBlocked;
			return false;
		}

		// it was a hit and not blocked!
		self.recoveryCounter = attack.recovery;
		player.hit(attack);
		return true;
	}
	self.hit = function(attack) {
		self.resetStatus();
		self.hp -= attack.damage;
		self.downCounter = attack.stun;
	}

	self.move = function(distance) {
		if(self.num === 1) {
			self.x += distance;
		} else {
			self.x -= distance;
		}
	}

	self.resetStatus = function() {
		self.frameCounter = 0;
		self.recoveryCounter = 0;
		self.currentAttack = null;
		self.downCounter = 0;
		self.blockState = '';
	}
	self.getOtherPlayer = function() {
		if(self.num === 1) {
			return game.p2;
		} else {
			return game.p1;
		}
	}

	self.getSprite = function() {
		// what are we currently doing? what animation should we use?
		if(!!self.currentAttack) {
			return self.currentAttack.sprite;
		} else {
			if(!self.canAct()) {
				if(self.isDown()) {
					return 'down';
				} else if(self.isRecovering()) {
					return 'recovering';
				}
			} else {
				if(self.getBlockState() == 'middle') {
					return 'block_middle';
				} else if(self.getBlockState() == 'low') {
					return 'block_low';
				} else {
					return 'idle';
				}
			}
		}
	}

	//player listens for its own events
	self.socket.on('keydown', function(keyCode) {
		self.keyState[keyCode] = true;
	});
	self.socket.on('keyup', function(keyCode) {
		self.keyState[keyCode] = false;

		if(keyCode == 90) {
			if(self.keyState[38]) {
				self.beginAttack(Player.attacks.attackHigh);
			} else if(self.keyState[40]) {
				self.beginAttack(Player.attacks.attackLow);
			} else {
				self.beginAttack(Player.attacks.attackHigh);
			}
		}
	});

	self.getState = function() {
		var currentState = self.state;
		var state = {};
		state.id = self.id;
		state.x = self.x;
		state.hp = self.hp;
		state.blockState = self.getBlockState();
		state.num = self.num;
		state.sprite = self.getSprite();

		var differenceState = {};
		_.each(state, function(value, key) {
			var isDifferent = value != currentState[key];
			if(isDifferent) {
				differenceState[key] = value;
			}
		});
		self.state = state;
		return differenceState;
	}

	self.init();
}
Player.getDistance = function(game) {
	return Math.abs(game.p1.x - game.p2.x) - Game.settings.player.width;
}
Player.isInRange = function(attack, game) {
	return (Player.getDistance(game) <= attack.range);
}
Player.attacks = {
	// attackMiddle: {
	// 	damage: 1,
	// 	speed: 5,
	// 	recovery: 25,
	// 	recoveryMiss: 25,
	// 	recoveryBlocked: 25,
	// 	stun: 30,
	// 	stunBlocked: 5,
	// 	range: 10,
	// 	blockedBy: ['middle', 'low'],
	// 	sprite: 'attack_middle'
	// },
	attackHigh: {
		damage: 2,
		speed: 5,
		recovery: 10,
		recoveryMiss: 10,
		recoveryBlocked: 10,
		stun: 30,
		stunBlocked: 5,
		range: 15,
		blockedBy: ['middle'],
		sprite: 'attack_middle'
	},
	attackLow: {
		damage: 2,
		speed: 5,
		recovery: 10,
		recoveryMiss: 10,
		recoveryBlocked: 10,
		stun: 30,
		stunBlocked: 5,
		range: 15,
		blockedBy: ['low'],
		sprite: 'attack_low'
	}
};

function Game(gameId, io) {
	var self = this;
	self.gameId = gameId;
	self.io = io;
	self.players = [];
	self.state = {};
	self.p1 = null;
	self.p2 = null;

	self.start = function() {
		//send each player game settings
		self.emit('settings', Game.settings);
		//get each player connected, and add them to the game
		var sockets = io.sockets.clients(self.gameId);
		var num = 1;
		_.each(sockets, function(socket) {
			var player = new Player(num, socket, self);
			self.addPlayer(player);
			num += 1;
		});
		//start the game loop
		setInterval(self.gameLoop, 1000/Game.settings.fps);
	}

	self.gameLoop = function() {
		self.updatePlayers();
		self.emitState();
	}

	self.updatePlayers = function() {
		_.each(self.players, function(player) {
			player.update();
		});
	}

	self.emitState = function() {
		var state = self.getState();
		//state is empty unless proven otherwise
		var isEmpty = true;

		//check if any players have changed
		if(_.some(state.p, function(p) {
			return !_.isEmpty(p);
		})) {
			isEmpty = false;
		}
		//only emit the state if anything has changed
		if(!isEmpty) {
			self.emit('state', state);
		}
	}

	self.getState = function() {
		var state = {};
		
		state.p = [];
		_.each(self.players, function(player) {
			state.p.push(player.getState());
		});

		self.state = state;
		return state;
	}

	self.emit = function(message, data) {
		self.io.sockets.in(self.gameId).emit(message, data);
	}
	self.volatile = function(message, data) {
		self.io.sockets.in(self.gameId).volatile.emit(message, data);
	}

	//when a player disconnects, they forfeit the game
	//let the other player know they won
	//socket is the player that left
	self.exit = function(socket) {

	}

	self.addPlayer = function(player) {
		self.players.push(player);
		if(player.num === 1) {
			self.p1 = player;
		} else {
			self.p2 = player;
		}
	}
}
Game.settings = {
	fps: 30,
	width: 300,
	player: {
		width: 67,
		height: 94
	}
};

module.exports = Game;

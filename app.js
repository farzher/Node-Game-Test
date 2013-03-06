// imports
var port = process.env.PORT || 25565;
var nodeGame = require('./node_game');
var Game = require('./game');

//matchmaking
nodeGame.listen(port);
nodeGame.matchmaking(Game, 2);

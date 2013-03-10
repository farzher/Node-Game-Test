// imports
var gf = require('./gf');
var Game = require('./game');

var port = process.env.PORT || 25565;

//matchmaking
gf.listen(port);
gf.matchmaking(Game.Game, Game.Player, 2);

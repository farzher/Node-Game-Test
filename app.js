// imports
var port = process.env.PORT || 25565;
var gf = require('./gf');
var Game = require('./game');

//matchmaking
gf.listen(port);
gf.matchmaking(Game, 2);

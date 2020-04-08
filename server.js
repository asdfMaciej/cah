function getRandom(arr, n) {
    var result = new Array(n),
        len = arr.length,
        taken = new Array(len);
    if (n > len)
        throw new RangeError("getRandom: more elements taken than available");
    while (n--) {
        var x = Math.floor(Math.random() * len);
        result[n] = arr[x in taken ? taken[x] : x];
        taken[x] = --len in taken ? taken[len] : len;
    }
    return result;
}


function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return copy(a);
}

function strCount(s1, s2) { 
    return (s1.length - s1.replace(new RegExp(s2,"g"), '').length) / s2.length;
}
function copy(e) {
	return JSON.parse(JSON.stringify(e));
}

var express = require('express');
var http = require('http');
var path = require('path');
var socketIO = require('socket.io');
var c = require('cardcast-api');

var api = new c.CardcastAPI();



var app = express();
var server = http.Server(app);

var io = socketIO(server, {
	pingInterval: 1000,
	pingTimeout: 3000
});

app.set('port', 5000);
app.use('/static', express.static(__dirname + '/static'));


app.get('/', function(request, response) {
  response.sendFile(path.join(__dirname, 'index.html'));
});


server.listen(5000, function() {
  console.log('Starting server on port 5000');
});


var players = {
	// nick -> data
};
var connections = {
	// socket id -> nick
};
var pings = {
	// socket id -> remaining
}

var deck = {
	white: ["_","_","_","_","_","_","_","_","_"],

	black: [
		"gra się nie rozpoczęła"
	]
}

let currentDeck = {
	white: [],
	black: []
}

const DECK_CODES = ['DADD6', 'FXA6V'];
const WIN_THRESHOLD = 2;
const DISCONNECT_AFTER_SECONDS = 10;
const SHOW_WINNER_SECONDS = 5;
const WHITE_BLANK_PERCENTAGE = 5;

const P_UNSELECTED = 0;
const P_SELECTED = 1;
const P_FINAL = 2;
const P_WINNER = 3;

includeDecks(copy(DECK_CODES));

function includeDecks(DECK_CODES) {
	let deckCodes = DECK_CODES;
	let code = deckCodes.pop();

	api.deck(code)
	.then((results) => {
		deck.black = deck.black.concat(
			results.calls.map(function(item) { 
				return item.text.join('_');
			})
		);
		deck.white = deck.white.concat(
			results.responses.map((r) => {return r.text})
		);

		chat(`Pobrano deck: https://www.cardcastgame.com/browse/deck/${code}`);

		if (deckCodes.length) {
			includeDecks(deckCodes);
		} else {
			let whiteCount = deck.white.length;
			let blackCount = deck.black.length;

			let blankCount = Math.ceil(whiteCount / 100 * WHITE_BLANK_PERCENTAGE);
			for (let a = 0; a < blankCount; a++)
				deck.white.push('_');

			currentDeck.white = shuffle(deck.white);
			currentDeck.black = shuffle(deck.black);
			
			chat(`Pobrano wszystkie decki! Restartowanie gry.`);
			chat(`${blackCount} czarnych kart, ${whiteCount} wypełnionych białych, ${blankCount} pustych białych (${WHITE_BLANK_PERCENTAGE}%).`);
			newRound();
		}
		
	});
}

function getRandomWhiteCards(n) {
	let c = [];
	for (let a = 0; a < n; a++) {
		c.push(currentDeck.white.shift());
		if (!currentDeck.white.length)
			currentDeck.white = copy(shuffle(deck.white));
	}
	return c;
}

function getRandomBlackCard() {
	if (!currentDeck.black.length)
		currentDeck.black = copy(shuffle(deck.black));
	return currentDeck.black.shift();
}

function sortedPlayers() {
	let p = [];
	for (let nick in players) {
		let player = players[nick];
		p.push(player);
	}
	p.sort((a, b) => {return a.index - b.index});
	return p;
}

function changeCzar() {
	let p = sortedPlayers();
	if (!p.length)
		return;

	let nextCzar = null;
	for (let n in p) {
		let player = p[n];
		if (player.isCzar) {
			nextCzar = parseInt(n)+1;
			players[player.nick].isCzar = false;
			break;
		}
	}

	if (nextCzar >= p.length) 
		nextCzar = 0;

	nextCzar = p[nextCzar];
	if (nextCzar == null) {
		console.log('ERROR!!! no czar (quit?) - store czar index in round state');
		players[p[0].nick].isCzar = true;
		return;
	}

	players[nextCzar.nick].isCzar = true;
}

function getCzar() {
	for (let nick in players) {
		let player = players[nick];
		if (player.isCzar)
			return player;
	}
	return null;
}

function checkIfAllPlayed() {
	for (let nick in players) {
		let player = players[nick];
		if (!player.isCzar && player.state == P_UNSELECTED)
			return false;
	}
	return true;
}

function checkIfFinal() {
	for (let nick in players) {
		let player = players[nick];
		if (player.state >= P_FINAL)
			return true;
	}
	return false;
}

function checkForWin() {
	for (let nick in players)
		if (players[nick].points >= WIN_THRESHOLD)
			return players[nick];
	return false;
}

var round = {};

function initRound() {
	round = {
		number: 0,
		whiteCards: {},
		winner: null
	}
	round.blackCard = getRandomBlackCard();
	round.blackFillPlaces = strCount(round.blackCard, '_');
}

function addNewCards() {
	for (let nick in players) {
		if (!players[nick].isCzar) {
			let cards = getRandomWhiteCards(round.blackFillPlaces);
			players[nick].cards = players[nick].cards.concat(cards);
		}
	}
}

function setPlayerState(state) {
	for (let nick in players) {
		players[nick].state = state;
	}
}

function chat(msg) {
	let _d = new Date();
	let d = _d.toLocaleTimeString();
	let formatted = `[${d}] ${msg}`;
	io.sockets.emit('CHAT', formatted);
	console.log(formatted);
}

function checkCardsMatch(a, b) {
	if (a == "_" || b == "_")
		return true;
	return a == b;
}

function showWinner(nick) {
	setPlayerState(P_WINNER);
	round.winner = nick;

	setTimeout(nextRound, SHOW_WINNER_SECONDS * 1000);
}

function nextRound() {
	let gameWinner = checkForWin();
	if (gameWinner) {
		chat(`WYGRAŁ ${gameWinner.nick}! Ilość rund: ${round.number}\n\n`);
		return newRound();
	}

	addNewCards();
	changeCzar();
	setPlayerState(P_UNSELECTED);
	round.winner = null;
	round.number += 1;
	round.blackCard = getRandomBlackCard();
	round.blackFillPlaces = strCount(round.blackCard, '_');
	round.whiteCards = {};
}
//
function newRound() {
	initRound();
	let players = shuffle(sortedPlayers());

	for (let player of players)
		setNewPlayer(player['socketID'], player['nick']);

	changeCzar();
	setPlayerState(P_UNSELECTED);
}

function getPlayer(nick) {
	return players[nick];
}

function getNick(socketID) {
	return connections[socketID];
}


let playerIndex = 0;

function setNewPlayer(socketID, nick) {
	players[nick] = {
		nick: nick,
		points: 0,
		triesLeft: -1,
		state: checkIfFinal() ? P_FINAL : P_UNSELECTED,
		index: playerIndex,
		isCzar: Object.keys(players).length == 0,
		cards: getRandomWhiteCards(8).concat(['_', '_']),
		socketID: socketID
	};

	connections[socketID] = nick;
	pings[socketID] = DISCONNECT_AFTER_SECONDS;

	playerIndex += 1;
	if (Object.keys(players).length === 1)
		nextRound();
}

function initPlayer(socketID, nick) {
	if (players[nick]) {
		chat(`${nick} połączył się ponownie.`);
		players[nick].triesLeft = -1;

		disconnectPlayerSocket(nick);

		connections[socketID] = nick;
		pings[socketID] = DISCONNECT_AFTER_SECONDS;
		players[nick].socketID = socketID;
		return true;
	}

	setNewPlayer(socketID, nick);

	chat(`${nick} dołączył do gry.`);
	return true;
}

function shufflePlayedCards() {
	let _c = shuffle(Object.entries(round.whiteCards));
	let c = {};
	for (let entry of _c)
		c[entry[0]] = entry[1];
	round.whiteCards = c;
}

function disconnectPlayerSocket(nick) {
	for (socketID in connections)
		if (connections[socketID] == nick)
			delete connections[socketID];

	if (nick in players)
		for (socketID in pings)
			if (socketID == players[nick].socketID)
				delete pings[socketID];
}

function disconnectPlayer(nick) {
	if (nick in players)
		if (players[nick].isCzar)
			nextRound();

	if (nick in round.whiteCards)
		delete round.whiteCards[nick];

	disconnectPlayerSocket(nick);

	if (nick in players)
		delete pings[players[nick].socketID];

	delete players[nick];

	chat(`Rozłączył się ${nick}`);
}


//
io.on('connection', function(socket) {
	var id = socket.id;
	socket.on('JOIN', function(data) {
		if(initPlayer(socket.id, data.nick)) {
			console.log(`[*] Connect: ${socket.id} as ${data.nick}`);
		}
	});

	socket.on('SELECT CARD', function(data) {
		var nick = getNick(id);
		var player = getPlayer(nick);

		let card = data.card;
		let cardIndex = data.index;

		if (player.isCzar || player.state != P_UNSELECTED)
			return console.log(`[!] ${player.nick} sent card without perm!`);

		if (!checkCardsMatch(player.cards[cardIndex], card))
			return console.log(`[!] ${player.nick} card mismatch!`);

		player.cards.splice(cardIndex, 1);
		
		if (!(nick in round.whiteCards))
			round.whiteCards[nick] = [];
		
		round.whiteCards[nick].push(card);

		if (round.whiteCards[nick].length == round.blackFillPlaces)
			player.state = P_SELECTED;

		if(checkIfAllPlayed()) {
			shufflePlayedCards();
			setPlayerState(P_FINAL);
		}
	});

	socket.on('WIN CARD', function(data) {
		var nick = getNick(id);
		var player = getPlayer(nick);
		let playerNick = data.nick;

		if (!player.isCzar || player.state != P_FINAL)
			return console.log(`[!] ${player.nick} win card without perm!`);

		let czar = getCzar().nick;
		let winning = round['whiteCards'][playerNick];
		
		let black = round.blackCard;
		for (let card of winning)
			black = black.replace('_', card);

		players[playerNick].points += 1;

		let msg = `${players[playerNick].nick} wygrał turę (wybierał ${czar}):\n`;
		msg += `${black}\n`;
		chat(msg);
		
		showWinner(playerNick);
	});

	socket.on('PING', function() {
		socket.emit('PONG');
	});

	socket.on('PONG', function() {
		pings[socket.id] = DISCONNECT_AFTER_SECONDS;
	});

	socket.on('disconnect', function () {});
});

setInterval(function() {
	io.sockets.emit('STATE', {
		players: players,
		round: round,
		settings: {
			decks: DECK_CODES,
			winThreshold: WIN_THRESHOLD,
			blanks: WHITE_BLANK_PERCENTAGE
		}
	});
}, 500);

setInterval(function() {
	for (let socketID in pings) {
		pings[socketID] -= 1;
		if (pings[socketID] == 0) {
			disconnectPlayer(getNick(socketID));
			delete pings[socketID];
		}
	}
	io.sockets.emit('PING', 1000);
}, 1000);

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
    return a;
}

function strCount(s1, s2) { 
    return (s1.length - s1.replace(new RegExp(s2,"g"), '').length) / s2.length;
}

var express = require('express');
var http = require('http');
var path = require('path');
var socketIO = require('socket.io');
var c = require('cardcast-api');

var api = new c.CardcastAPI();
/*
api.deck('DADD6')
	.then((results) => {
		deck.black = results.calls.map(function(item) { 
			return item.text.join('_');
		});
		deck.black = deck.black.filter(c => {return strCount(c, '_') == 1;})
		deck.white = results.responses.map((r) => {return r.text});
		console.log(deck);
		currentDeck.white = currentDeck.white.concat(shuffle(deck.white));
		currentDeck.black = currentDeck.black.concat(shuffle(deck.black));
		getRandomWhiteCards(1);
		getRandomBlackCard();
	});
*/
var app = express();
var server = http.Server(app);

var io = socketIO(server, {
	pingInterval: 1000,
	pingTimeout: 3000
});

app.set('port', 5000);
app.use('/static', express.static(__dirname + '/static'));

// Routing
app.get('/', function(request, response) {
  response.sendFile(path.join(__dirname, 'index.html'));
});

// Starts the server.
server.listen(5000, function() {
  console.log('Starting server on port 5000');
});

// Add the WebSocket handlers
io.on('connection', function(socket) {
});

var players = {};
var connections = {
	// socket id -> nick
};
var pings = {
	// socket id -> remaining
}

var deck = {
	white: [
		"Black Salami",
		"Tanie piwko",
		"Płukanie żołądka",
		"Wściekly Kamil z samolęza",
		"Czerwona A klasa",
		"Golenie jaj widelcem",
		"Tiruriru",
		"_",
		"_"
	],

	black: [
		"Slyszalem ze Twoja corka spała z  _",
		"Na moim ulubionym zdjęciu stoję z _",
		"Najwieksze rozczarowanie podczas seksu to _",
		"_ najbardziej ucieszy wszelkie organizacje"
	]
}

let currentDeck = {
	white: [],
	black: []
}

getRandomWhiteCards(1);
getRandomBlackCard();


function getRandomWhiteCards(n) {
	let c = [];
	for (let a = 0; a < n; a++) {
		c.push(currentDeck.white.shift());
		if (!currentDeck.white.length)
			currentDeck.white = JSON.parse(JSON.stringify(shuffle(deck.white)));
	}
	return c;
}

function getRandomBlackCard() {
	if (!currentDeck.black.length)
		currentDeck.black = JSON.parse(JSON.stringify(shuffle(deck.black)));
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

const WIN_THRESHOLD = 8;
const DISCONNECT_AFTER_SECONDS = 10;

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
	}
	round.blackCard = getRandomBlackCard();
	round.blackFillPlaces = strCount(round.blackCard, '_');
}

initRound();

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
	let d = _d.toLocaleString();
	io.sockets.emit('CHAT', `[${d}] ${msg}`);
}

function checkCardsMatch(a, b) {
	if (a == "_" || b == "_")
		return true;
	return a == b;
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
	round.number += 1;
	round.blackCard = getRandomBlackCard();
	round.blackFillPlaces = strCount(round.blackCard, '_');
	round.whiteCards = {};
}

function newRound() {
	initRound();
	for (let player of shuffle(sortedPlayers()))
		initPlayer(player['id'], player['nick']);
}

function getPlayer(nick) {
	return players[nick];
}

function getNick(socketID) {
	return connections[socketID];
}

let playerIndex = 0;

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

	players[nick] = {
		nick: nick,
		points: 0,
		triesLeft: -1,
		state: P_UNSELECTED,
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

	chat(`${nick} dołączył do gry.`);
	return true;
}

function shufflePlayedCards() {
	let _c = shuffle(Object.entries(round.whiteCards));
	console.log(round.whiteCards);
	let c = {};
	for (let entry of _c)
		c[entry[0]] = entry[1];
	round.whiteCards = c;
	console.log(c);
}

function disconnectPlayerSocket(nick) {
	for (socketID in connections)
		if (connections[socketID] == nick)
			delete connections[socketID];

	for (socketID in pings)
		if (socketID == players[nick].socketID)
			delete pings[socketID];
}

function disconnectPlayer(nick) {
	if (players[nick].isCzar)
		nextRound();

	if (nick in round.whiteCards)
		delete round.whiteCards[nick];

	disconnectPlayerSocket(nick);

	delete pings[players[nick].socketID];
	delete players[nick];

	

	chat(`Rozłączył się ${nick}`);
}

const P_UNSELECTED = 0;
const P_SELECTED = 1;
const P_FINAL = 2;
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
		player.state = P_SELECTED;
		round.whiteCards[nick] = card;

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
		let black = round.blackCard.replace('_', winning);
		players[playerNick].points += 1;

		let msg = `${players[playerNick].nick} wygrał turę (wybierał ${czar}):\n`;
		msg += `${black}\n`;
		chat(msg);
		
		nextRound();
	});

	socket.on('PING', function() {
		socket.emit('PONG');
		console.log('PING received');
	});

	socket.on('PONG', function() {
		pings[socket.id] = DISCONNECT_AFTER_SECONDS;
	});

	socket.on('disconnect', function () {
		/*
		var nick = getNick(id);
		var player = getPlayer(nick);
		if (!player)
			return;

		if (!nick)
			return;

		if (!players[nick])
			return;

		players[nick].triesLeft = 10;
		attemptDisconnect(nick);
		
		console.log(`[*] Disconnect: ${socket.id} as ${player.nick}`);*/
	});
});
/*
function attemptDisconnect(nick) {
	let triesLeft = players[nick].triesLeft;
	console.log(`Disconnect attempt for ${nick} - try: ${triesLeft}`);
	if (triesLeft < 0)
		return;

	if (triesLeft === 0) {
		disconnectPlayer(nick);
	} else {
		players[nick].triesLeft = triesLeft - 1;
		setTimeout(attemptDisconnect, 1000, nick);
	}
}
*/
setInterval(function() {
	io.sockets.emit('STATE', {
		players: players,
		round: round
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

/*
setInterval(function() {
	nextRound();
}, 2000)*/
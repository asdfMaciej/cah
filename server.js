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
api.deck('DADD6')
	.then((results) => {
		deck.black = results.calls.map(function(item) { 
			return item.text.join('_');
		});
		deck.black = deck.black.filter(c => {return strCount(c, '_') == 1;})
		deck.white = results.responses.map((r) => {return r.text});
		console.log(deck);
		currentDeck.white = JSON.parse(JSON.stringify(shuffle(deck.white)));
		currentDeck.black = JSON.parse(JSON.stringify(shuffle(deck.black)));
		getRandomWhiteCards(1);
		getRandomBlackCard();
	});

var app = express();
var server = http.Server(app);
var io = socketIO(server);

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
	for (let id in players) {
		let player = players[id];
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
			players[player.id].isCzar = false;
			break;
		}
	}

	if (nextCzar >= p.length) 
		nextCzar = 0;

	nextCzar = p[nextCzar];
	if (nextCzar == null) {
		console.log('ERROR!!! no czar (quit?) - store czar index in round state');
		players[p[0].id].isCzar = true;
		return;
	}

	players[nextCzar.id].isCzar = true;
}

function getCzar() {
	for (let id in players) {
		let player = players[id];
		if (player.isCzar)
			return player;
	}
	return null;
}

function checkIfAllPlayed() {
	for (let id in players) {
		let player = players[id];
		if (!player.isCzar && player.state == P_UNSELECTED)
			return false;
	}
	return true;
}

const WIN_THRESHOLD = 8;

function checkForWin() {
	for (let id in players)
		if (players[id].points >= WIN_THRESHOLD)
			return players[id];
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
	for (let id in players) {
		if (!players[id].isCzar) {
			let cards = getRandomWhiteCards(round.blackFillPlaces);
			players[id].cards = players[id].cards.concat(cards);
		}
	}
}

function setPlayerState(state) {
	for (let id in players) {
		players[id].state = state;
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
	let p = shuffle(sortedPlayers());
	console.log(p);
	for (let player of p)
		initPlayer(player['id'], player['nick']);
}

let playerIndex = 0;



function initPlayer(id, nick) {
	players[id] = {
		nick: nick,
		points: 0,
		state: P_UNSELECTED,
		index: playerIndex,
		isCzar: Object.keys(players).length == 0,
		cards: getRandomWhiteCards(8).concat(['_', '_']),
		id: id
	};
	playerIndex += 1;
	if (Object.keys(players).length === 1)
		nextRound();
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


const P_UNSELECTED = 0;
const P_SELECTED = 1;
const P_FINAL = 2;

io.on('connection', function(socket) {
	socket.on('JOIN', function(data) {
		initPlayer(socket.id, data.nick);
		console.log(`[*] Connect: ${socket.id} as ${data.nick}`);
		chat(`Dołączył ${data.nick}`);
	});

	socket.on('SELECT CARD', function(data) {
		let card = data.card;
		let cardIndex = data.index;
		let id = socket.id;
		if (players[id].isCzar || players[id].state != P_UNSELECTED)
			return console.log(`[!] ${players[id].nick} sent card without perm!`);

		if (!checkCardsMatch(players[id].cards[cardIndex], card))
			return console.log(`[!] ${players[id].nick} card mismatch!`);

		players[id].cards.splice(cardIndex, 1);
		players[id].state = P_SELECTED;
		round.whiteCards[id] = card;

		if(checkIfAllPlayed()) {
			shufflePlayedCards();
			setPlayerState(P_FINAL);
		}
	});

	socket.on('WIN CARD', function(data) {
		let playerID = data.id;
		let id = socket.id;
		if (!players[id].isCzar || players[id].state != P_FINAL)
			return console.log(`[!] ${players[id].nick} win card without perm!`);

		console.log(round);
		console.log(playerID);
		let czar = getCzar().nick;
		let winning = round['whiteCards'][playerID];
		let black = round.blackCard.replace('_', winning);
		players[playerID].points += 1;

		let msg = `${players[playerID].nick} wygrał turę (wybierał ${czar}):\n`;
		msg += `${black}\n`;
		chat(msg);
		
		nextRound();
	});

	socket.on('disconnect', function () {
		let player = players[socket.id];
		if (!player)
			return;

		if (player.isCzar)
			nextRound();

		if (socket.id in round.whiteCards)
			delete round.whiteCards[socket.id];

		console.log(`[*] Disconnect: ${socket.id} as ${player.nick}`);
		chat(`Rozłączył się ${player.nick}`);
		delete players[socket.id];
	});
});


setInterval(function() {
	io.sockets.emit('STATE', {
		players: players,
		round: round
	});
}, 500);

/*
setInterval(function() {
	nextRound();
}, 2000)*/
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

function strCount(s1, s2) { 
    return (s1.length - s1.replace(new RegExp(s2,"g"), '').length) / s2.length;
}

var express = require('express');
var http = require('http');
var path = require('path');
var socketIO = require('socket.io');

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
		"Tiruriru"
	],

	black: [
		"Slyszalem ze Twoja corka spała z  _",
		"Na moim ulubionym zdjęciu stoję z _",
		"Najwieksze rozczarowanie podczas seksu to _",
		"_ najbardziej ucieszy wszelkie organizacje"
	]
}



function getRandomWhiteCards(n) {
	return getRandom(deck.white, n);
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

var round = {
	number: 0,
	blackCard: "",
	blackFillPlaces: 1, 
	whiteCards: {},
	state: 0
}

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

function nextRound() {
	addNewCards();
	changeCzar();
	setPlayerState(P_UNSELECTED);
	round.number += 1;
	round.blackCard = getRandom(deck.black, 1)[0];
	round.blackFillPlaces = strCount(round.blackCard, '_');
	round.whiteCards = {};
}

let playerIndex = 0;

const P_UNSELECTED = 0;
const P_SELECTED = 1;
const P_FINAL = 2;

io.on('connection', function(socket) {
	socket.on('JOIN', function(data) {
		players[socket.id] = {
			nick: data.nick,
			points: 0,
			state: P_UNSELECTED,
			index: playerIndex,
			isCzar: Object.keys(players).length == 0,
			cards: getRandomWhiteCards(3),
			id: socket.id
		};
		playerIndex += 1;
		console.log(`[*] Connect: ${socket.id} as ${data.nick}`);
	});

	socket.on('NEXT ROUND', function(data) {
		let player = players[socket.id];
		if (!player.isCzar)
			return console.log(`[!] ${player.nick} tried to next round not as czar!`);
		console.log(`${player.nick} - new round`);
		nextRound();
	});

	socket.on('SELECT CARD', function(data) {
		let card = data.card;
		let cardIndex = data.index;
		let id = socket.id;
		if (players[id].isCzar || players[id].state != P_UNSELECTED)
			return console.log(`[!] ${players[id].nick} sent card without perm!`);

		if (players[id].cards[cardIndex] != card)
			return console.log(`[!] ${players[id].nick} card mismatch!`);

		players[id].cards.splice(cardIndex, 1);
		players[id].state = P_SELECTED;
		round.whiteCards[id] = card;

	})

	socket.on('disconnect', function () {
		let player = players[socket.id];
		if (!player)
			return;

		if (player.isCzar)
			nextRound();

		console.log(`[*] Disconnect: ${socket.id} as ${player.nick}`);
		delete players[socket.id];
		
	});
});


setInterval(function() {
	io.sockets.emit('state', {
		players: players,
		round: round
	});
}, 500);

/*
setInterval(function() {
	nextRound();
}, 2000)*/
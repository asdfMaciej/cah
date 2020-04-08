function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function createCookie(name,value,hours) {
	if (hours) {
		var date = new Date();
		date.setTime(date.getTime()+(hours*60*60*1000));
		var expires = "; expires="+date.toGMTString();
	}
	else var expires = "";
	document.cookie = name+"="+value+expires+"; path=/";
}

function readCookie(name) {
	var nameEQ = name + "=";
	var ca = document.cookie.split(';');
	for(var i=0;i < ca.length;i++) {
		var c = ca[i];
		while (c.charAt(0)==' ') c = c.substring(1,c.length);
		if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
	}
	return null;
}

function eraseCookie(name) {
	createCookie(name,"",-1);
}

var app = new Vue({
	el: "#app",
	data: {
		players: {},
		round: {},
		serverSettings: {},
		chat: "",
		socket: null,
		id: null,
		nick: null,
		connected: false,
		connectedTimeout: false,
	},

	mounted: function() {
		this.socket = io(window.location.href, {'sync disconnect on unload':false});
		let nick = readCookie('nick');
		if (!nick) {
			console.log('creating nick');
			nick = prompt("Podaj jaki chcesz nick:", '');
			createCookie('nick', nick, 4);
		}

		this.nick = nick;

		this.socket.emit('JOIN', {nick: nick});

		this.socket.on('connect', () => {
			this.id = this.socket.io.engine.id;
			this.connected = 3;
			this.ping();
		});
		
		this.socket.on('STATE', (state) => {
			this.players = state.players;
			this.round = state.round;
			this.serverSettings = state.settings;
		});
		this.socket.on('CHAT', (message) => {
			this.chat =  message + "\n" + this.chat;
			//let chat = document.querySelector("#chat");
			//chat.scrollTop = chat.scrollHeight;
		});
		this.socket.on('disconnect', () => {
			this.connected = 1;
		});

		this.socket.on('PONG', () => {this.connected = 3;});
		this.socket.on('PING', () => {this.socket.emit('PONG');});
	},

	methods: {
		reconnect: function() {
			console.log('connection lost - trying to reconnect');
			if (this.connected) {
				this.socket.emit('JOIN', {nick: this.nick});
				console.log("connected - stopping attempts...");
			} else {
				this.socket.connect();
				setTimeout(this.reconnect, 500);
			}
		},

		ping: function() {
			this.connected = this.connected - 1;
			if (this.connected == 0) {
				this.reconnect();
			} else {
				setTimeout(this.ping, 1000);
				this.socket.emit('PING');
			}
		},

		selectCard: function(card, index) {
			if (this.me.state != 0)
				return;

			if (card == "_")
				card = prompt("Podaj zawartość karty:");
			this.socket.emit('SELECT CARD', {card: card, index: index});
			this.players[this.nick].state = 1; // insta change
		},

		winCard: function(playerNick) {
			if (!(this.me.isCzar && this.me.state == 2))
				return;

			this.socket.emit('WIN CARD', {nick: playerNick});
		}//
	},

	computed: {
		me: function() {
			if (this.nick in this.players)
				return this.players[this.nick];
			return {};
		},

		orderedPlayers: function() {
			let p = Object.values(this.players);
			return p.sort((a, b) => {return a.index - b.index});
		},

		stateText: function() {
			let states = {
				0: this.me.isCzar ? 'Jesteś czarem - czekasz aż inni wybiorą karty.': 'Gracze wybierają karty.',
				1: this.me.isCzar ? 'Jesteś czarem - czekasz aż inni wybiorą karty.': 'Wybrałeś już karty, czekaj za innymi.',
				2: this.me.isCzar ? 'Jesteś czarem - wybierz najśmieszniejszą kartę!': 'Czar wybiera najśmieszniejszą kartę.',
				3: 'Za chwilę rozpocznie się kolejna runda.'
			};

			return states[this.me.state];
		}
	}
});
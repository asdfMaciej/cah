function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

var app = new Vue({
	el: "#app",
	data: {
		players: {},
		round: {},
		chat: "",
		socket: null,
		id: null
	},

	mounted: function() {
		this.socket = io();
		this.socket.on('connect', () => {
			this.id = this.socket.io.engine.id;
		});
		this.socket.emit('JOIN', {nick: prompt("Podaj jaki chcesz nick:", '')});
		this.socket.on('STATE', (state) => {
			this.players = state.players;
			this.round = state.round;
		});
		this.socket.on('CHAT', (message) => {
			this.chat += message + "\n";
			let chat = document.querySelector("#chat");
			chat.scrollTop = chat.scrollHeight;
		});
	},

	methods: {
		selectCard: function(card, index) {
			if (card == "_")
				card = prompt("Podaj zawartość karty:");
			this.socket.emit('SELECT CARD', {card: card, index: index});
			this.players[this.id].state = 1; // insta change
		},

		winCard: function(playerID) {
			this.socket.emit('WIN CARD', {id: playerID});
		}
	},

	computed: {
		me: function() {
			if (this.id in this.players)
				return this.players[this.id];
			return {};
		},

		orderedPlayers: function() {
			let p = Object.values(this.players);
			return p.sort((a, b) => {return a.index - b.index});
		}
	}
});
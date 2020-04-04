var app = new Vue({
	el: "#app",
	data: {
		players: {},
		round: {},
		socket: null,
		id: null
	},

	mounted: function() {
		this.socket = io();
		this.socket.on('connect', () => {
			this.id = this.socket.io.engine.id;
		});
		this.socket.emit('JOIN', {nick: 'Maciej'});
		this.socket.on('state', (state) => {
			this.players = state.players;
			this.round = state.round;
		});
	},

	methods: {
		nextRound: function() {
			this.socket.emit('NEXT ROUND');
		},

		selectCard: function(card, index) {
			this.socket.emit('SELECT CARD', {card: card, index: index});
			this.players[this.id].state = 1; // insta change
		}
	},

	computed: {
		me: function() {
			if (this.id in this.players)
				return this.players[this.id];
			return {};
		}
	}
});
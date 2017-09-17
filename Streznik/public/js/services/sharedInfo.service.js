(function() {
	"use strict";

	angular
		.module("movementVisualizer")
		.service("sharedInfoService", sharedInfoService);

	sharedInfoService.$inject = [];

	/**
	 * @ngdoc service
	 * @name movementVisualizer.service:sharedInfoService
	 * @description
	 * Service, ki hrani splošne podatke za aplikacijo. Nudi tudi način (z get/set funkcijami) izmenjevanja teh podatkov med različnimi services/controllers.
	 */
	function sharedInfoService() {
		//console.log("sharedInfoService();");
		var vm = this;

		// napolni websocket streznik
		var masterData = [],
			liveData = [],
			humanData = [],
			animationOngoing = false,
			maxMovementValues = {},
			getMinMovementValues = {};

		return {
			setMasterData: setMasterData,
			setLiveData: setLiveData,
			setHumanData: setHumanData,
			getMasterData: getMasterData,
			getLiveData: getLiveData,
			getHumanData: getHumanData,
			setAnimationOngoing: setAnimationOngoing,
			getAnimationOngoing: getAnimationOngoing,
			getMaxMovementValues: getMaxMovementValues,
			getMinMovementValues: getMinMovementValues
		};
		function mojParser(x) {
			// http://stackoverflow.com/questions/4090518/what-is-the-difference-between-parseint-and-number
			for (let e of x) {
				e.timestamp = Number(e.timestamp);
				e.markers[0] = e.markers[0].map(Number);
				e.markers[1] = e.markers[1].map(Number); // se drugace nikjer ne rabi
				e.orientation = e.orientation.map(Number);
			}
			return x;
		}

		// tisto kar se bo dejansko prikazovalo se praparsa tukaj v strukturo primernejso za predvajanje
		function mojParser2(x) {
			let seznam = x.zapis;
			let temp = [];

			for (let i = 0, length = seznam.length; i < length; i++) {
				temp.push({});
				temp[i].timestamp = Number(seznam[i]["casovni zig"]);
				temp[i]["6DOF"] = seznam[i].zapis[2].zapis.map(Number);
				temp[i]["scalar"] = seznam[i].zapis[0].zapis.map(Number);
			}
			return temp;
		}

		function mojParser3(x) {
			let seznam = x.zapis;
			let temp = {};

			let temp_1D = {};
			let temp_3D = {};
			let temp_6DOF = {};

			/* vsake meritve mora biti isto (drugace ne bo delalo), npr. ce telo izmerjeno 24x mora biti tudi vsak marker 24x,
			drugace vmesne doloci tako, da ponovis zadnjo oz naredis interpolacijo */

			for (let x of seznam) {
				for (let i = 0, length = x.zapis.length; i < length; i++) {

					var el = x.zapis[i];

					if (el.tip === "1D") {

						if (!(el.oznaka in temp_1D)) { // prvic naredi lastnost v temp_1D
							temp_1D[el.oznaka] = [];
						}
						temp_1D[el.oznaka].push({
							"timestamp": Number(x["casovni zig"]),
							"value": el.zapis.map(Number)
						});

					} else if (el.tip === "3D") {

						if (!(el.oznaka in temp_3D)) { // prvic naredi lastnost v temp_3D
							temp_3D[el.oznaka] = [];
						}
						temp_3D[el.oznaka].push({
							"timestamp": Number(x["casovni zig"]),
							"value": el.zapis.map(Number)
						});

					} else if (el.tip === "6DOF") {

						if (!(el.oznaka in temp_6DOF)) { // prvic naredi lastnost v temp_6DOF
							temp_6DOF[el.oznaka] = [];
						}
						temp_6DOF[el.oznaka].push({
							"timestamp": Number(x["casovni zig"]),
							"value": el.zapis.map(Number)
						});
					}
				}
			}
			temp["1D"] = temp_1D;
			temp["3D"] = temp_3D;
			temp["6DOF"] = temp_6DOF;
			return temp;
		}

		function setMasterData(x) {
			//masterData = mojParser(x);
			//masterData = calculateTorque(masterData);
			//masterData = mojParser2(x);
			masterData = mojParser3(x);
		}
		function setLiveData(x) {
			//liveData = mojParser(x);
			//liveData = calculateTorque(liveData);
			//liveData = mojParser2(x);
			liveData = mojParser3(x);
		}
		function setHumanData(x) {
			humanData = x;
		}

		function getMasterData() {
			return masterData;
		}
		function getLiveData() {
			return liveData;
		}
		function getHumanData() {
			return humanData;
		}

		function setAnimationOngoing(x) {
			animationOngoing = x;
		}

		function getAnimationOngoing() {
			return animationOngoing;
		}

		function getMaxMovementValues() {
			return maxMovementValues;
		}

		function getMinMovementValues() {
			return getMinMovementValues;
		}

		function calculateTorque(data) { // ni vec v uporabi, vrednost navora se ne racuna vec na clientu
			//console.log("calculateTorque()");

			let a;
			let b;
			let previous;
			let now;

			data[0].r = 1.2; // konstantna rocica, 1.2 m dolga golf palica
			data[0].m = 1.5; // kontantna masa, 1.5 kg tezka golf palice (pisem v kg, da se kasneje izide v newtone)
			data[0].ds = 0; // pot [m], drugace podatki v cm
			data[0].dt = 0; // cas [s], drugae podatki v micro s
			data[0].dV = 0; // hitrost [m / s]
			data[0].da = 0; // pospesek [m / s^2]
			data[0].dF = 0; // sila [N = kg m s^−2]
			data[0].dalfa = 0; // kot [°]
			data[0].dM = 0; // navor [N m]

			// zacenjam z drugim elementom
			for (let i = 1, length = data.length; i < length; i++) {

				previous = data[i - 1];
				now = data[i];

				a = new THREE.Vector3().fromArray(previous.markers[0]);
				b = new THREE.Vector3().fromArray(now.markers[0]);

				now.r = 1.2;
				now.m = 1.5;setLiveData
				now.ds = a.distanceTo(b) * Math.pow(10, -2); // iz cm v m
				now.dt = Math.abs(now.timestamp - previous.timestamp) * Math.pow(10, -6); // iz micro s v s
				now.dV = now.ds / now.dt;
				now.da = (now.dV - previous.dV) / now.dt;
				now.dF = Math.abs(now.da) * now.m;
				now.dalfa = a.angleTo(b);
				now.dM = now.dF * now.r * Math.sin(now.dalfa);

			}

			return data;
		}
	}
})();

(function() {
	"use strict";

	angular
		.module("movementVisualizer")
		.service("audioService", audioService);

	audioService.$inject = [];

	/**
	 * @ngdoc service
	 * @name movementVisualizer.service:audioService
	 * @description
	 * Service, ki nudi funkcije za predvajanje zvoka.
	 */

	function audioService() {
		//console.log("audioService();");

		var soundTurnedOn = true;
		var soundPlaying = false;

		var hz = 140;
		var db = -10;

		var oscillator = new Tone.Oscillator(hz, "sine").toMaster();
		oscillator.volume.value = db;
		oscillator.mute = true;
		oscillator.start();
		// s start() ali stop() metodo zvok "pokne", zato raje delam na lastnosti .mute true ali false (s tem pa ne poci)

		return {
			changeTone: changeTone,
			playTone: playTone,
			pauseTone: pauseTone,
			toogleSound: toogleSound,
			isSoundTurnedOn: isSoundTurnedOn
		};

		/**
		 * @ngdoc method
		 * @name changeTone
		 * @methodOf movementVisualizer.service:audioService
		 * @description
		 * Spremeni lastnosti tonu.
		 * @example
		 * audioService.changeTone();
		 * @param {int} frequency frekvenca
		 * @param {int} volume glasnost
		 */
		function changeTone(frequency, volume) {
			if (soundTurnedOn && soundPlaying) { // ko nastavljas frequency oz volume se mute avtomatsko postavi na true... krneki
				//console.log("Volume:", volume);
				oscillator.frequency.value = hz + 2 * frequency;
				oscillator.volume.value = db + volume / 4;
				//console.log("Volume:", oscillator.volume.value, "\n", "Frequency:", oscillator.frequency.value);
				oscillator.mute = false;
			}
		}

		/**
		 * @ngdoc method
		 * @name pauseTone
		 * @methodOf movementVisualizer.service:audioService
		 * @description
		 * Ustavi ton.
		 * @example
		 * audioService.pauseTone();
		 */
		function pauseTone() {
			soundPlaying = false;
			oscillator.mute = true;
		}

		/**
		 * @ngdoc method
		 * @name playTone
		 * @methodOf movementVisualizer.service:audioService
		 * @description
		 * Predvaja ton.
		 * @example
		 * audioService.playTone();
		 */
		function playTone() {
			soundPlaying = true;
		}

		/**
		 * @ngdoc method
		 * @name toogleSound
		 * @methodOf movementVisualizer.service:audioService
		 * @description
		 * Vklopi / izklopi zvok.
		 * @example
		 * audioService.toogleSound();
		 */
		function toogleSound() {
			//console.log("toogleSound();", !soundTurnedOn);
			soundTurnedOn = !soundTurnedOn;
			oscillator.mute = !(soundTurnedOn && soundPlaying);
		}

		/**
		 * @ngdoc method
		 * @name isSoundTurnedOn
		 * @methodOf movementVisualizer.service:audioService
		 * @description
		 * Ali je zvok vklopljen?
		 * @example
		 * audioService.isSoundTurnedOn();
		 * @returns {boolean} stanje zvoka
		 */
		function isSoundTurnedOn() {
			return soundTurnedOn;
		}

	}
})();

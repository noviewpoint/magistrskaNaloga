(function() {
	"use strict";

	angular
		.module("movementVisualizer")
		.service("asynchronousCallsService", asynchronousCallsService);

	asynchronousCallsService.$inject = ["$http"];

	/**
	 * @ngdoc service
	 * @name movementVisualizer.service:asynchronousCallsService
	 * @description
	 * Service, ki vrača promises za izvajanje asinhronih GET/POST klicev.
	 * @requires $http
	 */

	function asynchronousCallsService($http) {
		//console.log("asynchronousCallsService();");

		var masterDataUrl = "./data/master4.json",
			liveDataUrl = "./data/live4.json",
			humanDataUrl = "./data/human.json";

		// vse tu so ASYNCANI REQUESTI, ki vrnejo promise
		// privzeto angularjs naredi headers: {"Content-Type": "application/json"}
		// GET caching in browser ---> tam kjer nam je to koristno

		return {
			requestMasterData: requestMasterData,
			requestLiveData: requestLiveData,
			requestHumanData: requestHumanData
		};

		function requestMasterData() {
			return $http({method: "GET", url: masterDataUrl});
		}
		function requestLiveData() {
			return $http({method: "GET", url: liveDataUrl});
		}
		function requestHumanData() {
			return $http({method: "GET", url: humanDataUrl});
		}

	}
})();

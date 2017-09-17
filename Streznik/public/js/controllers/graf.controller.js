(function() {
	"use strict";

	angular
		.module("movementVisualizer")
		.controller("GrafController", GrafController);

	GrafController.$inject = ["sharedInfoService", "$scope"];

	/**
	 * @ngdoc controller
	 * @name movementVisualizer.controller:GrafController
	 * @description
	 * Controller, ki kontrolira graf.
	 * @requires movementVisualizer.service:sharedInfoService
	 * @requires $scope
	 */
	function GrafController(sharedInfoService, $scope) {
		//console.log("GrafController();");
		var vm = this;

		var steviloGrafov = 5;
		var tab = 0;

		vm.switchGraph = switchGraph;
		vm.isArrowTurnedDown = isArrowTurnedDown;
		vm.animateGraphSwitching = animateGraphSwitching;
		$scope.$on("graph changed", graphChanged);

		function switchGraph() {
			if (sharedInfoService.getLiveData().length === 0 || sharedInfoService.getMasterData().length === 0) {
				alert("Ni podatkov za abstraktno prikazovanje!");
				return;
			}

			if (!sharedInfoService.getAnimationOngoing()) {
				alert("Za abstraktno prikazovanje najprej začni predvajati posnetek!");
				return;
			}
			//console.log("switchGraph();");
			tab++;
			if (tab === steviloGrafov + 1) { // neobstojec graf
				tab = 0;
			}

			$scope.$emit("graph activated", tab); // $emit -- dispatches the event upwards through the scope hierarchy
		}

		function isArrowTurnedDown() {
			if (tab === 0) { // za osnovno stanje (brez grafa)
				return true;
			} else { // za grafe
				return false;
			}
		}

		function animateGraphSwitching(x) {
			var show = "ng-show-add animated flip";
			var hide = "ng-hide";
			if (x === tab) {
				return show;
			} else {
				return hide;
			}
		}

		function graphChanged(event, mass) {
			tab = mass;
			switchGraph();
		}

		//console.log("At the end of GrafController");
	}

})();

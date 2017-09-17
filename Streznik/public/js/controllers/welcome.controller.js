(function() {
	"use strict";

	angular
		.module("movementVisualizer")
		.controller("WelcomeController", WelcomeController);

	WelcomeController.$inject = ["$state", "$document", "$scope"];

	/**
	 * @ngdoc controller
	 * @name movementVisualizer.controller:WelcomeController
	 * @description
	 * Controller za navodila.
	 * @requires $state
	 * @requires $document
	 * @requires $scope
	 */
	function WelcomeController($state, $document, $scope) {
		console.log("In WelcomeController");
		var vm = this;

		var bodyStyle = document.body.style;
		bodyStyle.cssText = "background: url(img/vacation-1284012_1920.jpg) no-repeat center fixed; background-size: cover;";

		$document.unbind("keydown");
		$document.bind("keydown", keydownHappened);

		var animationOn = false;
		var showChangeLog = false;

		vm.changeLog = changeLog;
		vm.animateChangeLog = animateChangeLog;

		// LOL :P
		var show = "ng-show-add animated fadeIn";
		var hide = "ng-hide-add animated fadeOut";
		var none = "ng-hide";

		function animateChangeLog() {
			if (animationOn) {
				if (showChangeLog) {
					hide = "ng-hide-add animated fadeOut";
					return show;
				} else {
					setTimeout(function() {
						hide = none;
						$scope.$digest();
					}, 500);
					return hide;
				}
			} else {
				return none;
			}
		}
		function changeLog() {
			showChangeLog = !showChangeLog;
			if (!animationOn) {
				animationOn = true;
			}
		}

		function keydownHappened(e) {
			// chrome vs firefox
			var x = e.which || e.keyCode;
			if (x == 13) {// ENTER
				e.preventDefault();
				bodyStyle.removeProperty("background");
				$state.go("default");
			}
		}

		console.log("At the end of WelcomeController");
	}

})();

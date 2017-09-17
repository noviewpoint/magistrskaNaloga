(function() {
	"use strict";

	angular
		.module("movementVisualizer")
		.directive("graf5", graf5);

		function graf5() {
			//console.log("graf5();");
			return {
				restrict: "E",
				templateUrl: "partials/graf5.html"
			};
		}
})();

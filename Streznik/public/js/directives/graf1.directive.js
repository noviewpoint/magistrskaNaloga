(function() {
	"use strict";

	angular
		.module("movementVisualizer")
		.directive("graf1", graf1);

		function graf1() {
			//console.log("graf1();");
			return {
				restrict: "E",
				templateUrl: "partials/graf1.html"
			};
		}
})();

(function() {
	"use strict";

	angular
		.module("movementVisualizer")
		.directive("graf2", graf2);

		function graf2() {
			//console.log("graf2();");
			return {
				restrict: "E",
				templateUrl: "partials/graf2.html"
			};
		}
})();

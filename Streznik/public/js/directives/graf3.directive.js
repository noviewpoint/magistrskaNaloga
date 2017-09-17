(function() {
	"use strict";

	angular
		.module("movementVisualizer")
		.directive("graf3", graf3);

		function graf3() {
			//console.log("graf3();");
			return {
				restrict: "E",
				templateUrl: "partials/graf3.html"
			};
		}
})();

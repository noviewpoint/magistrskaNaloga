(function() {
	"use strict";

	angular
		.module("movementVisualizer")
		.directive("graf4", graf4);

		function graf4() {
			//console.log("graf4();");
			return {
				restrict: "E",
				templateUrl: "partials/graf4.html"
			};
		}
})();

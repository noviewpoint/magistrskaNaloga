(function() {
	"use strict";

	angular
		.module("movementVisualizer")
		.directive("detectResizeDirective", detectResizeDirective);

		detectResizeDirective.$inject = ["$window"];

		/**
		 * @ngdoc directive
		 * @name movementVisualizer.directive:detectResizeDirective
		 * @description
		 * Directive, ki zazna kakrsnokoli spreminjanje velikosti brskalnikovega okna.
		 * @restrict A
		 * @requires $window
		 */
		function detectResizeDirective($window) {
			// ODLIČNO!
			// http://stackoverflow.com/questions/23272169/angularjs-what-is-the-best-way-to-bind-to-a-global-event-in-a-directive
			//console.log("detectResizeDirective();");

			return {
				restrict: "A",
				link: link
			};

			// povezovalna funkcija
			function link(scope) {
				angular.element($window).on("resize", onResize);
				scope.$on("$destroy", cleanUp);

				function onResize(e) {
					//console.log("onResize();");
					// Namespacing events with name of directive + event to avoid collisions
					scope.$broadcast("detectResizeDirective::resize");
				}

				function cleanUp() {
					//console.log("cleanUp();");
					angular.element($window).off("resize", onResize);
				}

			}
		}
})();

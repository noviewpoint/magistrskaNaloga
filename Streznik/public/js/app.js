(function() {
	"use strict";

	/**
	 * @ngdoc object
	 * @name movementVisualizer
	 * @description Magistrska naloga: Spletna aplikacija za upodabljanje povratne informacije pri gibalnem ucenju
	 */
	angular
		.module("movementVisualizer", ["ui.router", "rzModule", "ui.bootstrap"])
		.config(config, "config")
		.run(run, "run");

	config.$inject = ["$urlRouterProvider", "$stateProvider", "$locationProvider", "$compileProvider"];

	function config($urlRouterProvider, $stateProvider, $locationProvider, $compileProvider) {
		//console.log("config();");

		// https://docs.angularjs.org/guide/production
		$compileProvider.debugInfoEnabled(false);
		$compileProvider.commentDirectivesEnabled(false);
		$compileProvider.cssClassDirectivesEnabled(false);

		var modalWindow;
		$locationProvider.hashPrefix("");

		// For any unmatched url, redirect
		$urlRouterProvider
			.otherwise("/");

		$stateProvider
			.state("welcome", {
				url: "/welcome",
				templateUrl: "partials/welcome.html",
				controller: "WelcomeController",
				controllerAs: "WelcomeCtrl"
			})
			.state("default", {
				url: "/",
				templateUrl: "partials/default.html",
				controller: "DefaultController",
				controllerAs: "DefaultCtrl",
				// cache: false,
				// reload: true,
				resolve: {
					humanData: function(asynchronousCallsService, sharedInfoService) {
						return asynchronousCallsService.requestHumanData()
							.then(function(response) {
								//console.log(response.data);
								sharedInfoService.setHumanData(response.data);
							}, function(errResponse) {
								console.log("Error", errResponse);
							});
					},
					graphics: function(graphicsLoaderService) {
						return graphicsLoaderService.returnAllPromises()
							.then(values => {
								console.log("Vsi graficni objekti uspesno vkljuceni v aplikacijo:", values);
							}, reason => {
								console.log(reason);
							});
					}
				},
				onEnter: function() {
					console.log("onEnter default");
				}
			})
			.state("default.modal", {
				// namerno brez url-ja
				onEnter: function($state, $uibModal) {
					console.log("onEnter default.modal");
					modalWindow = $uibModal.open({
						controller: "ModalController",
						controllerAs: "ModalCtrl",
						templateUrl: "partials/modal_default.html",
						animation: true
					});
					modalWindow.result
						.then(function(success) {
							console.log("modalWindow.result.then - success:", success);
							//$state.go("default", {}, {reload: "default"});
							//$route.reload();
							//$location.path("/");
							//location.reload();
						}, function(error) { // handlaj error
							console.log("modalWindow.result.then - error:", error);
						})
						.finally(function() { // ob pritisku neke tipke pojdi nazaj v parent state
							console.log("modalWindow.result.finally");
							$state.go('^');
						});
				},
				onExit: function() { // ob pritisku na BACK od brskalnika
					console.log("onExit default.modal");
					//$uibModalStack wont work
					modalWindow.close();
				}
			});
	}

	run.$inject = ["$location", "$rootScope"];

	function run($location, $rootScope) {
		//console.log("run();");

		// ob refreshu brskalnika (F5) se aplikacija vedno postavi na zacetek
		$location.path("/");

		$rootScope.$on('$stateChangeStart',
			function(event, toState, toParams, fromState, fromParams) {
				//console.log("Application has switched from state", fromState, "to state", toState, "from parameters", fromParams, "to parameters", toParams);
				console.log("Prehod iz stanja '" + fromState.name + "' v stanje '" + toState.name + "'");
		});
	}
})();

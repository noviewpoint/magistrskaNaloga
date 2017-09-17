(function() {
	"use strict";

	angular
		.module("movementVisualizer")
		.controller("ModalController", ModalController);

	ModalController.$inject = ["$uibModalInstance", "$scope"];

	/**
	 * @ngdoc controller
	 * @name movementVisualizer.controller:ModalController
	 * @description
	 * Controller, ki kontrolira modal pojavno okno.
	 * @requires $uibModalInstance
	 * @requires $scope
	 */
	function ModalController($uibModalInstance, $scope) {
		console.log("ModalController();");
		var vm = this;

		// dirty fix, da se modal vedno pokaze! res wtf (z nicemer drugim ne gre)
		$(window).trigger("resize");

		vm.okModal = okModal;
		vm.cancelModal = cancelModal;

		function okModal() {
			console.log("okModal();");
			$scope.$emit("changePlaybackData", null);
			$uibModalInstance.close(); // success
		}

		function cancelModal() {
			console.log("cancelModal();");
			$uibModalInstance.dismiss(); // error
		}

		console.log("At the end of ModalController");
	}

})();

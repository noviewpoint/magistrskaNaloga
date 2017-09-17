(function() {
	"use strict";

	angular
		.module("movementVisualizer")
		.controller("DefaultController", DefaultController);

	DefaultController.$inject = ["sharedInfoService", "graphicsLoaderService", "$document", "$scope", "$rootScope", "$state", "audioService"];

	/**
	 * @ngdoc controller
	 * @name movementVisualizer.controller:DefaultController
	 * @description
	 * Controller, ki skrbi za privzeto stanje (state) aplikacije.
	 * <pre>
	 * http://localhost/movementVisualizer
	 * </pre>
	 * Dostop do controllerja je mogoč prek brskalnikove naslovne vrstice.
	 * @requires movementVisualizer.service:sharedInfoService
	 * @requires movementVisualizer.service:graphicsLoaderService
	 * @requires $document
	 * @requires $scope
	 * @requires $state
	 * @requires $rootScope
	 * @requires movementVisualizer.service:audioService
	 */
	function DefaultController(sharedInfoService, graphicsLoaderService, $document, $scope, $rootScope, $state, audioService) {
		console.log("DefaultController();");
		var vm = this;
		var aktivenGraf = null;

		// preveri, ce brskalnik podpira webgl - iz Detector.js
		if (!Detector.webgl) {
			Detector.addGetWebGLMessage();
		}

		// globalna js spremenljivka, ki drzi socket do lokalnega http streznika
		var socket = io.connect(window.location.href);
		var currentSocketMessage = null;
		socket.on("gibanje", function(data) {
			console.log(data);
			currentSocketMessage = data;
			goToDefaultModalState();
		});

		$document.unbind("keydown");
		$document.bind("keydown", keydownHappened);
		$document.unbind("mousedown");
		$document.bind("mousedown", mousedownHappened);
		$scope.$on("detectResizeDirective::resize", resizedBrowser);
		$scope.$on("slideEnded", slideEnded);
		$scope.$on("graph activated", activatedChart);
		$rootScope.$on("changePlaybackData", changedPlaybackData);

		vm.playbackSpeedSlider = {
			value: 5,
			options: {
				vertical: true,
				floor: 1,
				ceil: 100,
				step: 1,
				//logScale: true,
				//showTicks: true,
				minLimit: 1,
				maxLimit: 100,
				//showSelectionBarFromValue: 2,
				showSelectionBar: true
			}
		};

		var playbackSliderDown = false;
		var playbackSliderMoving = false;
		angular.element(document.getElementById("playbackInputRange")).on("mousedown", function(e) {
			playbackSliderDown = true;
			if (vm.playbackPaused) {
				soundPlaying = false;
				audioService.pauseTone();
			}
		});
		angular.element(document.getElementById("playbackInputRange")).on("mousemove", function(e) {
			if (playbackSliderDown) {
				playbackSliderMoving = true;
				if (progress <= animationLength) {
					soundPlaying = true;
					audioService.playTone();
				}
			}
		});
		angular.element(document.getElementById("playbackInputRange")).on("mouseup", function(e) {
			playbackSliderDown = false;
			playbackSliderMoving = false;
			//if (playbackSliderMoving) {playbackSliderMoving = false; plabackSLiderDown = false;}
			if (vm.playbackPaused) {
				soundPlaying = false;
				audioService.pauseTone();
			}
		});

		// kontrole s checkboxi (po vrstnem redu iz html)
		vm.changePlaybackSpeed = changePlaybackSpeed;
		vm.showMasterTrace = true;
		vm.showHideMasterTrace = showHideMasterTrace;
		vm.showMasterRigidBody = true;
		vm.showHideMasterRigidBody = showHideMasterRigidBody;
		vm.showLiveTrace = true;
		vm.showHideLiveTrace = showHideLiveTrace;
		vm.showLiveRigidBody = true;
		vm.showHideLiveRigidBody = showHideLiveRigidBody;
		vm.showHuman = false;
		vm.showHideHuman = showHideHuman;
		vm.showHuman = false;
		vm.showHideEnvironment = showHideEnvironment;
		vm.showEnvironment = true;
		vm.changedRepeatPlayback = changedRepeatPlayback;
		vm.repeatPlayback = true;
		vm.toogleSound = audioService.toogleSound;
		vm.isSoundTurnedOn = audioService.isSoundTurnedOn;
		vm.changeViewToTop = changeViewToTop;
		vm.changeViewToFront = changeViewToFront;
		vm.changeViewToSide = changeViewToSide;

		// tabelica s timestampi
		vm.timestampMaster = null;
		vm.timestampLive = null;

		// playback slider
		vm.playbackPaused = true;
		vm.triggerPlayback = triggerPlayback;
		vm.ranger = 0;
		vm.rangerMinimumValue = 0;
		vm.rangerMaximumValue = null;
		vm.changedRanger = changedRanger;

		// podatki cloveka iz json
		var humanData = sharedInfoService.getHumanData();
		var golfMasterData = null;
		var golfLiveData = null;

		// REFERENCE NA HTML ELEMENTE
		var canvas = {};

		// THREE.JS OSNOVNE SPREMENLJIVKE SCENE
		var scene = {};
		var camera = {};
		var controls = {};
		var renderer = {};
		var stats = {};
		var gui = {};
		var helper = {};

		// THREE.JS MATERIALI
		const materialLine = new THREE.LineBasicMaterial({color: 0x999999}); // blago bela za crte ravnine
		const materialBlue = new THREE.MeshLambertMaterial({color: "rgb(0, 0, 255)", polygonOffset: true}); // bootstrap moder gumb
		//polygonOffset zato, da ni z-buffer fightinga z ravnino trate
		const materialRed = new THREE.MeshLambertMaterial({color: "rgb(255, 0, 0)", polygonOffset: true, polygonOffsetFactor: -1.0, polygonOffsetUnits: -4.0}); // bootstrap rdec gumb
		const materialGreen = new THREE.MeshLambertMaterial({color: "rgb(0, 255, 0)", polygonOffset: true, polygonOffsetFactor: -1.0, polygonOffsetUnits: -4.0}); // bootstrap zelen gumb
		const materialLive = new THREE.MeshLambertMaterial({color: 0x8e44ad}); // trenutna izvedba vijolicna
		const materialMaster = new THREE.MeshLambertMaterial({color: 0xf1c40f}); // referencna izvedba rumena
		const colorFog = 0x758baf;

		// THREE.JS DODATNE SPREMENLJIVKE PRIZORA
		const debelinaBone = 5;
		const debelinaSledi = 5;
		const geometryMarker = new THREE.SphereGeometry(15, 30, 28);
		var masterClub = {};
		var liveClub = {};
		var masterBall = {};
		var liveBall = {};

		var masterMarkers = {};
		var liveMarkers = {};
		var masterBones = {};
		var liveBones = {};
		var human = {};
		var grid = {};
		var grass = {};
		var sky = {};
		var golfBall = {};
		var footBall = {};
		//var splineCurve = {};

		// podatki animacije
		var animationLength = null;
		var handle = null;

		var progress = 0;
		var temporaryProgress = 0;

		var prikazujAnimacijo = false;
		var konecPredvajanja = false;
		var soundPlaying = false;

		var initialTimestamp = null;

		// FRAMESI
		var frameMaster = 0;
		var frameLive = 0;
		var frameHuman = 0;

		const xPadding = 20;
		const yPadding = 20;

		var flagPlot = true;
		var xyPlot = new PlotChart();
		var yzPlot = new PlotChart();
		var xzPlot = new PlotChart();

		function PlotChart() {
			this.masterMarkers = {};
			this.liveMarkers = {};
			this.masterBones = {};
			this.liveBones = {};
		}
		PlotChart.prototype.renderer = {};
		PlotChart.prototype.scene = {};
		PlotChart.prototype.camera = {};
		PlotChart.prototype.flag = false;

		var torquePlot = {};
		torquePlot.renderer = {};
		torquePlot.scene = {};
		torquePlot.camera = {};
		torquePlot.masterGauge = {};
		torquePlot.liveGauge = {};
		torquePlot.flag = false;

		var timelinePlot = {};
		timelinePlot.renderer = {};
		timelinePlot.scene = {};
		timelinePlot.camera = {};
		timelinePlot.x = new TimelinePiece("red", "salmon");
		timelinePlot.y = new TimelinePiece("green", "springgreen");
		timelinePlot.z = new TimelinePiece("blue", "slateblue");
		timelinePlot.flag = false;

		function TimelinePiece(masterColor, liveColor) {
			this.materialMaster = new THREE.MeshLambertMaterial({color: masterColor});
			this.materialLive = new THREE.MeshLambertMaterial({color: liveColor});
			this.masterMarkers = {};
			this.liveMarkers = {};
			this.masterBones = {};
			this.liveBones = {};
		}

		// ------------------------------------- INICIALIZACIJA ------------------------------------- //
		initWorld();
		handle = requestAnimationFrame(animate);
		// ------------------------------------------------------------------------------------------ //

		function animate() {
			stats.begin();
			oneAnimationTick();
			renderVirtualEnvironment();

			renderPlot(xyPlot);
			renderPlot(yzPlot);
			renderPlot(xzPlot);
			renderPlot(torquePlot);
			renderPlot(timelinePlot);

			stats.end();

			// koliko draw calls
			// console.log(renderer.info.render);
			// koliko geometrij shranjenih v spominu
			// console.log(renderer.info.memory);

			handle = requestAnimationFrame(animate);
		}
		function renderVirtualEnvironment() {
			renderer.render(scene, camera);
		}
		function renderPlot(plot) {
			if (prikazujAnimacijo === false) { // ce ni te zastavice, se sploh ne ubadaj z nicemer dol
				return;
			}

			if (plot.flag) {
				plot.renderer.render(plot.scene, plot.camera);
			}
		}
		function oneAnimationTick() {

			if (prikazujAnimacijo === false) { // ce ni te zastavice, se sploh ne ubadaj z nicemer dol
				return;
			}

			// vedno izrisi (tudi v pavzi)

			var oldFrameMaster = frameMaster;
			var cas1D = golfMasterData["1D"][Object.keys(golfMasterData["1D"])[0]];
			var cas3D = golfMasterData["3D"][Object.keys(golfMasterData["3D"])[0]];
			var cas6DOF = golfMasterData["6DOF"][Object.keys(golfMasterData["6DOF"])[0]];
			frameMaster = findFrame(frameMaster, cas6DOF, progress); // max 24
			if (frameMaster > 0) {

				let tip = golfMasterData["1D"];
				for (let x in tip) {
					if (x === "navor na palico (skalar)") {

						drawTorque(frameMaster, tip[x], torquePlot.masterGauge, progress, torquePlot.flag);

					}
				}

				tip = golfMasterData["3D"];
				for (let x in tip) {

					drawTrace(oldFrameMaster, frameMaster, tip[x], masterMarkers[x], masterBones[x], progress, vm.showMasterTrace);
					drawTrace(oldFrameMaster, frameMaster, tip[x], xyPlot.masterMarkers[x], xyPlot.masterBones[x], progress, xyPlot.flag);
					drawTrace(oldFrameMaster, frameMaster, tip[x], yzPlot.masterMarkers[x], yzPlot.masterBones[x], progress, yzPlot.flag);
					drawTrace(oldFrameMaster, frameMaster, tip[x], xzPlot.masterMarkers[x], xzPlot.masterBones[x], progress, xzPlot.flag);
					drawTrace(oldFrameMaster, frameMaster, tip[x], timelinePlot.x.masterMarkers[x], timelinePlot.x.masterBones[x], progress, timelinePlot.flag);
					drawTrace(oldFrameMaster, frameMaster, tip[x], timelinePlot.y.masterMarkers[x], timelinePlot.y.masterBones[x], progress, timelinePlot.flag);
					drawTrace(oldFrameMaster, frameMaster, tip[x], timelinePlot.z.masterMarkers[x], timelinePlot.z.masterBones[x], progress, timelinePlot.flag);

				}

				tip = golfMasterData["6DOF"];
				for (let x in tip) {
					if (x === "marker na glavi palice") {

						drawRigidBody(frameMaster, tip[x], masterClub, progress, vm.showMasterRigidBody);

					} else if (x === "marker na zogi") {

						drawRigidBody(frameMaster, tip[x], masterBall, progress, vm.showMasterRigidBody);

					}
				}

				updateTimestampMaster(frameMaster, golfMasterData["6DOF"]["marker na glavi palice"]);
			}

			var oldFrameLive = frameLive;
			cas1D = golfLiveData["1D"][Object.keys(golfLiveData["1D"])[0]];
			cas3D = golfLiveData["3D"][Object.keys(golfLiveData["3D"])[0]];
			cas6DOF = golfLiveData["6DOF"][Object.keys(golfLiveData["6DOF"])[0]];
			frameLive = findFrame(frameLive, cas6DOF, progress); // max 24
			if (frameLive > 0) {

				let tip = golfLiveData["1D"];
				for (let x in tip) {
					if (x === "navor na palico (skalar)") {

						drawTorque(frameLive, tip[x], torquePlot.liveGauge, progress, torquePlot.flag);

					}
				}

				tip = golfLiveData["3D"];
				for (let x in tip) {

					drawTrace(oldFrameLive, frameLive, tip[x], liveMarkers[x], liveBones[x], progress, vm.showLiveTrace);
					drawTrace(oldFrameLive, frameLive, tip[x], xyPlot.liveMarkers[x], xyPlot.liveBones[x], progress, xyPlot.flag);
					drawTrace(oldFrameLive, frameLive, tip[x], yzPlot.liveMarkers[x], yzPlot.liveBones[x], progress, yzPlot.flag);
					drawTrace(oldFrameLive, frameLive, tip[x], xzPlot.liveMarkers[x], xzPlot.liveBones[x], progress, xzPlot.flag);
					drawTrace(oldFrameLive, frameLive, tip[x], timelinePlot.x.liveMarkers[x], timelinePlot.x.liveBones[x], progress, timelinePlot.flag);
					drawTrace(oldFrameLive, frameLive, tip[x], timelinePlot.y.liveMarkers[x], timelinePlot.y.liveBones[x], progress, timelinePlot.flag);
					drawTrace(oldFrameLive, frameLive, tip[x], timelinePlot.z.liveMarkers[x], timelinePlot.z.liveBones[x], progress, timelinePlot.flag);

					if (x === "marker na glavi palice") {
						changeTone(frameLive, tip[x], frameMaster, golfMasterData["3D"]["marker na glavi palice"], audioService.changeTone, progress, soundPlaying);
					}
				}

				tip = golfLiveData["6DOF"];
				for (let x in tip) {
					if (x === "marker na glavi palice") {

						drawRigidBody(frameLive, tip[x], liveClub, progress, vm.showLiveRigidBody);

					} else if (x === "marker na zogi") {

						drawRigidBody(frameLive, tip[x], liveBall, progress, vm.showLiveRigidBody);

					}
				}

				updateTimestampLive(frameLive, golfLiveData["6DOF"]["marker na glavi palice"]);
			}

			frameHuman = findFrame(frameHuman, humanData, progress); // max 3
			drawHuman(frameHuman, humanData, human.skeleton.bones, progress, vm.showHuman);
			$scope.$digest(); // za update timestampov

			// ce v pavzi, ne povecuj progress
			if (vm.playbackPaused === true) {
				return;
			}

			// povecaj progress
			progress = getProgress();

			// ob nepravilnih vrednostih (npr. float number) za vm.ranger bo aplikacija nagajala

			if (progress <= animationLength) { // da se spreminja le do maximum value od input rangerja
				vm.ranger = progress;
				temporaryProgress = progress;
				initialTimestamp = Date.now();
			} else {
				console.log("Posnetek je koncan. Cez 1000ms bo ponovljen, ce imas vklopljeno opcijo 'Repeat'");
				soundPlaying = false;
				audioService.pauseTone();
				if (progress >= animationLength + 1000000 / vm.playbackSpeedSlider.value && !playbackSliderMoving) {// varnostna meja (da se zadnji frame vedno izrise!)
					konecPredvajanja = true;
					if (vm.repeatPlayback) {
						playPlayback();
					} else {
						console.log("Posnetek je koncan. Nisi imel vklopljene opcije 'Repeat', zato pavziram.");
						pausePlayback();
					}
				}
			}

			$scope.$digest();
		}

		function findFrame(frame, frames, localProgress) {
			if (frame < frames.length) {
				var timestamp = frames[frame].timestamp;
				if (timestamp <= localProgress) {
					return findFrame(frame + 1, frames, localProgress);
				}
			}
			return frame;
		}

		function drawTrace(startFrame, endFrame, frames, markers, bones, progress, flag) {
			if (flag && endFrame > 0) {
				for (; startFrame < endFrame; startFrame++) {
					markers[startFrame].visible = true;
					if (startFrame > 0) {
						bones[startFrame].visible = true;
						bones[startFrame].scale.y = 1;
					}
				}

				if (endFrame < frames.length) { // interpolacija

					var startFrame = endFrame - 1; // drugi startFrame!
					var wholeTimeDif = frames[endFrame].timestamp - frames[startFrame].timestamp;
					var actualTimeDif = progress - frames[startFrame].timestamp;
					var ratio = actualTimeDif / wholeTimeDif;

					bones[endFrame].visible = true;
					// bones[key].dynamic = true;
					// bones[key].verticesNeedUpdate = true;
					bones[endFrame].scale.y = ratio;

				}
			}
		}

		function drawRigidBody(endFrame, frames, club, progress, flag) {
			if (flag) {
				club.visible = true;

				var startFrame = endFrame - 1;
				var ratio = 1;

				var startPos = new THREE.Vector3().fromArray(frames[startFrame].value.slice(0, 3));
				var startRot = new THREE.Vector3().fromArray(frames[startFrame].value.slice(3));
				var endPos = startPos.clone();
				var endRot = startRot.clone();

				if (endFrame < frames.length) { // interpolacija
					var wholeTimeDif = frames[endFrame].timestamp - frames[startFrame].timestamp;
					var actualTimeDif = progress - frames[startFrame].timestamp;
					ratio = actualTimeDif / wholeTimeDif;

					endPos = new THREE.Vector3().fromArray(frames[endFrame].value.slice(0, 3));
					endRot = new THREE.Vector3().fromArray(frames[endFrame].value.slice(3));
				}

				var interpolatedPos = getPointInBetweenByPercentage(startPos, endPos, ratio);
				var interpolatedRot = getPointInBetweenByPercentage(startRot, endRot, ratio);

				club.position.set(interpolatedPos.x, interpolatedPos.y, interpolatedPos.z);
				club.rotation.set(interpolatedRot.x, interpolatedRot.y, interpolatedRot.z);
			}
		}

		function getPointInBetweenByPercentage(startPoint, endPoint, percentage) {
			var direction = endPoint.clone().sub(startPoint);
			var length = direction.length();
			if (length > 0) {
				direction = direction.normalize().multiplyScalar(length * percentage);
				return startPoint.clone().add(direction);
			} else {
				return startPoint.clone();
			}
		}

		function updateTimestampMaster(endFrame, frames) {
			var startFrame = endFrame - 1;
			var x = frames[startFrame].timestamp;

			if (vm.timestampMaster !== x) {
				vm.timestampMaster = x;
			}
		}

		function updateTimestampLive(endFrame, frames) {
			var startFrame = endFrame - 1;
			var x = frames[startFrame].timestamp;

			if (vm.timestampLive !== x) {
				vm.timestampLive = x;
			}
		}

		function drawTorque(endFrame, frames, gauge, progress, flag) {
			if (flag) {

				var startFrame = endFrame - 1;
				var incr = 0;

				if (endFrame < frames.length) { // interpolacija
					var wholeTimeDif = frames[endFrame].timestamp - frames[startFrame].timestamp;
					var actualTimeDif = progress - frames[startFrame].timestamp;
					var ratio = actualTimeDif / wholeTimeDif;

					incr = ratio * (frames[endFrame].value[0] - frames[startFrame].value[0]);
				}

				var navor = Math.min((frames[startFrame].value[0] + incr) * (270 / 100), 270); // 270° max vrednost, 100 N m max vrednost hardcodirana
				gauge.rotation.z = (Math.PI / 180) * (navor + 45); // 45° zacetna lega
			}
		}

		function changeTone(endFrameLive, framesLive, endFrameMaster, framesMaster, audioFunction, progress, flag) {
			if (flag) {

				if (endFrameMaster > 0) {
					var master = new THREE.Vector3(0, 0, 0);
					let frames = framesMaster;
					let endFrame = endFrameMaster;
					let startFrame = endFrame - 1;
					let startPos = new THREE.Vector3().fromArray(frames[startFrame].value.slice(0, 3));
					let endPos = startPos.clone();
					let ratio = 1;

					if (endFrame < frames.length) { // interpolacija

						let wholeTimeDif = frames[endFrame].timestamp - frames[startFrame].timestamp;
						let actualTimeDif = progress - frames[startFrame].timestamp;
						ratio = actualTimeDif / wholeTimeDif;

						endPos = new THREE.Vector3().fromArray(frames[endFrame].value.slice(0, 3));
					}

					master = getPointInBetweenByPercentage(startPos, endPos, ratio);
				}

				if (endFrameLive > 0) {
					var live = new THREE.Vector3(0, 0, 0);
					let frames = framesLive;
					let endFrame = endFrameLive;
					let startFrame = endFrame - 1;
					let startPos = new THREE.Vector3().fromArray(frames[startFrame].value.slice(0, 3));
					let endPos = startPos.clone();
					var ratio = 1;

					if (endFrame < frames.length) { // interpolacija

						let wholeTimeDif = frames[endFrame].timestamp - frames[startFrame].timestamp;
						let actualTimeDif = progress - frames[startFrame].timestamp;
						ratio = actualTimeDif / wholeTimeDif;

						endPos = new THREE.Vector3().fromArray(frames[endFrame].value.slice(0, 3));
					}

					live = getPointInBetweenByPercentage(startPos, endPos, ratio);
				}

				var frequency = frameLive - 1 + ratio;
				var volume = live.distanceTo(master);
				//console.log("Volume:", volume, "\n", "Frequency:", frequency);
				audioFunction(frequency, volume);

			}
		}

		function initPlotRenderer(canvas, chart) {
			chart.renderer = new THREE.WebGLRenderer({
				canvas: canvas,
				antialias: false,
				alpha: true
			});// anti-aliasing obvezno nastavljaj tu ob konstrukciji, drugace ne prime!
			chart.renderer.setSize(canvas.width, canvas.height);

			chart.scene = new THREE.Scene();
			chart.scene.name = "stranska scena " + canvas.id;

			// in "world" space
			var sirina = 2000;
			var visina = 2000;
			var levo = sirina / -2;
			var desno = sirina / 2;
			var gor = visina / 2;
			var dol = visina / -2;
			var pogledOd = -10000;
			var pogledDo = 10000;
			chart.camera = new THREE.OrthographicCamera(levo, desno, gor, dol, pogledOd, pogledDo);
			chart.camera.zoom = 0.5;
			chart.camera.updateProjectionMatrix(); // da zoom "zagrabi"
			switch(canvas.id) {
				case "graph_xy":
					chart.camera.position.set(0, 0, 3000);
					chart.camera.rotation.z = 90 * Math.PI / 180;
					break;
				case "graph_yz":
					chart.camera.position.set(3000, 0, 0);
					chart.camera.rotation.y = 90 * Math.PI / 180;
					chart.camera.rotation.z = 90 * Math.PI / 180;
					break;
				case "graph_xz":
					chart.camera.position.set(0, 3000, 0);
					chart.camera.rotation.x = 90 * Math.PI / 180;
					chart.camera.rotation.y = 180 * Math.PI / 180;
					break;
				default:
			}
			chart.scene.add(chart.camera);

			var ambientLight = new THREE.AmbientLight(0xffffff, 1);
			ambientLight.name = "AmbientLight " +  canvas.id;
			chart.scene.add(ambientLight);
			// directionalLight osenci in naredi 3D izgled crte - je to ok?

			let tip = golfMasterData["3D"];
			for (let x in tip) {
				var traceMaster = makeTrace(x, tip[x], geometryMarker, chart.masterMarkers, chart.masterBones, materialMaster);
				traceMaster.name = "traceMaster_" + x;
				chart.scene.add(traceMaster);
			}

			tip = golfLiveData["3D"];
			for (let x in tip) {
				var traceLive = makeTrace(x, tip[x], geometryMarker, chart.liveMarkers, chart.liveBones, materialLive);
				traceLive.name = "traceLive_" + x;
				chart.scene.add(traceLive);
			}
		}

		function initTorqueRenderer(canvas, chart) {
			chart.renderer = new THREE.WebGLRenderer({
				canvas: canvas,
				antialias: false,
				alpha: true
			});// anti-aliasing obvezno nastavljaj tu ob konstrukciji, drugace ne prime!
			chart.renderer.setSize(canvas.width, canvas.height);

			chart.scene = new THREE.Scene();
			chart.scene.name = "stranska scena " + canvas.id;
			//chart.scene.background = graphicsLoaderService.getGauge();

			// in "world" space
			var sirina = canvas.width;
			var visina = canvas.height;
			var levo = sirina / -2;
			var desno = sirina / 2;
			var gor = visina / 2;
			var dol = visina / -2;
			var pogledOd = -1000;
			var pogledDo = 1000;
			chart.camera = new THREE.OrthographicCamera(levo, desno, gor, dol, pogledOd, pogledDo);
			chart.camera.position.set(0, 0, 500);
			chart.camera.rotation.x = -180 * Math.PI / 180;
			chart.scene.add(chart.camera);

			var ambientLight = new THREE.AmbientLight(0xffffff, 1);
			ambientLight.name = "AmbientLight " +  canvas.id;
			chart.scene.add(ambientLight);

			var dolzinaKazalca = (7 / 18) * canvas.height;

			var heightMaster = 0;
			var kazalecMaster = new THREE.Geometry();
			kazalecMaster.vertices.push(new THREE.Vector3(-6, 0, heightMaster));
			kazalecMaster.vertices.push(new THREE.Vector3(-6, dolzinaKazalca, heightMaster));
			kazalecMaster.vertices.push(new THREE.Vector3(6, dolzinaKazalca, heightMaster));
			kazalecMaster.vertices.push(new THREE.Vector3(6, 0, heightMaster));
			kazalecMaster.faces.push(new THREE.Face3(0, 1, 2));
			kazalecMaster.faces.push(new THREE.Face3(2, 3, 0));
			chart.masterGauge = new THREE.Mesh(kazalecMaster, materialMaster);
			chart.masterGauge.rotation.z = 45 * Math.PI / 180; // 45° zacetna lega
			chart.scene.add(chart.masterGauge);

			var heightLive = 10;
			var kazalecLive = new THREE.Geometry();
			kazalecLive.vertices.push(new THREE.Vector3(-3, 0, -heightLive));
			kazalecLive.vertices.push(new THREE.Vector3(-3, dolzinaKazalca, -heightLive));
			kazalecLive.vertices.push(new THREE.Vector3(3, dolzinaKazalca, -heightLive));
			kazalecLive.vertices.push(new THREE.Vector3(3, 0, -heightLive));
			kazalecLive.faces.push(new THREE.Face3(0, 1, 2));
			kazalecLive.faces.push(new THREE.Face3(2, 3, 0));
			chart.liveGauge = new THREE.Mesh(kazalecLive, materialLive);
			chart.liveGauge.rotation.z = 45 * Math.PI / 180; // 45° zacetna lega
			chart.scene.add(chart.liveGauge);
		}

		function initTimelineRenderer(canvas, chart) {
			console.log("initTimelineRenderer();");

			chart.renderer = new THREE.WebGLRenderer({
				canvas: canvas,
				antialias: false,
				alpha: true
			});// anti-aliasing obvezno nastavljaj tu ob konstrukciji, drugace ne prime!
			chart.renderer.setSize(canvas.width, canvas.height);

			chart.scene = new THREE.Scene();
			chart.scene.name = "stranska scena " + canvas.id;

			// in "world" space
			var sirina = 2000;
			var visina = 2000;
			var levo = sirina / -2;
			var desno = sirina / 2;
			var gor = visina / 2;
			var dol = visina / -2;
			var pogledOd = -10000;
			var pogledDo = 10000;
			chart.camera = new THREE.OrthographicCamera(levo, desno, gor, dol, pogledOd, pogledDo);
			chart.camera.zoom = 0.5;
			chart.camera.updateProjectionMatrix(); // da zoom "zagrabi"
			chart.camera.position.set(0, 0, 1000);
			chart.camera.rotation.z = 90 * Math.PI / 180;
			chart.scene.add(chart.camera);

			var ambientLight = new THREE.AmbientLight(0xffffff, 1);
			ambientLight.name = "AmbientLight " +  canvas.id;
			chart.scene.add(ambientLight);

			var marginCanvasa = 200;

			let tip = golfMasterData["3D"];
			for (let x in tip) {

				var xTraceMaster = makeTrace(x, tip[x], geometryMarker, chart.x.masterMarkers, chart.x.masterBones, chart.x.materialMaster, [1, 0, 0], [0, 2 * sirina - 250, 0]);
				xTraceMaster.position.y = -visina + marginCanvasa;
				xTraceMaster.position.x = -1000 - marginCanvasa;
				xTraceMaster.rotation.y = Math.PI;
				xTraceMaster.name = "xTraceMaster_" + x;
				chart.scene.add(xTraceMaster);

				var yTraceMaster = makeTrace(x, tip[x], geometryMarker, chart.y.masterMarkers, chart.y.masterBones, chart.y.materialMaster, [0, 1, 0], [2 * sirina - 250, 0, 0]);
				yTraceMaster.position.y = -visina + marginCanvasa;
				yTraceMaster.position.x = 0 + marginCanvasa;
				yTraceMaster.rotation.z = 90 * Math.PI / 180;
				yTraceMaster.name = "yTraceMaster_" + x;
				chart.scene.add(yTraceMaster);

				var zTraceMaster = makeTrace(x, tip[x], geometryMarker, chart.z.masterMarkers, chart.z.masterBones, chart.z.materialMaster, [0, 0, 1], [2 * sirina - 250, 0, 0]);
				zTraceMaster.position.y = -visina + marginCanvasa;
				zTraceMaster.position.x = 1000 + 2 * marginCanvasa;
				zTraceMaster.rotation.y = -90 * Math.PI / 180;
				zTraceMaster.rotation.z = 90 * Math.PI / 180;
				zTraceMaster.name = "zTraceMaster_" + x;
				chart.scene.add(zTraceMaster);
			}

			tip = golfLiveData["3D"];
			for (let x in tip) {

				var xTraceLive = makeTrace(x, tip[x], geometryMarker, chart.x.liveMarkers, chart.x.liveBones, chart.x.materialLive, [1, 0, 0], [0, 2 * sirina - 250, 0]);
				xTraceLive.position.y = -visina + marginCanvasa;
				xTraceLive.position.x = -1000 - marginCanvasa;
				xTraceLive.rotation.y = Math.PI;
				xTraceLive.name = "xTraceLive_" + x;
				chart.scene.add(xTraceLive);

				var yTraceLive = makeTrace(x, tip[x], geometryMarker, chart.y.liveMarkers, chart.y.liveBones, chart.y.materialLive, [0, 1, 0], [2 * sirina - 250, 0, 0]);
				yTraceLive.position.y = -visina + marginCanvasa;
				yTraceLive.position.x = 0 + marginCanvasa;
				yTraceLive.rotation.z = 90 * Math.PI / 180;
				yTraceLive.name = "yTraceLive_" + x;
				chart.scene.add(yTraceLive);

				var zTraceLive = makeTrace(x, tip[x], geometryMarker, chart.z.liveMarkers, chart.z.liveBones, chart.z.materialLive, [0, 0, 1], [2 * sirina - 250, 0, 0]);
				zTraceLive.position.y = -visina + marginCanvasa;
				zTraceLive.position.x = 1000 + 2 * marginCanvasa;
				zTraceLive.rotation.y = -90 * Math.PI / 180;
				zTraceLive.rotation.z = 90 * Math.PI / 180;
				zTraceLive.name = "zTraceLive_" + x;
				chart.scene.add(zTraceLive);

			}
		}

		function getProgress() {
			var dif = Date.now() - initialTimestamp;
			var progress = (dif / vm.playbackSpeedSlider.value) * 1000 + temporaryProgress;
			return Math.round(progress); // da ni decimalk (ker drugace vm.ranger steka z decimalkami)
		}

		function changedRanger() {

			if(!golfMasterData || !golfLiveData) {
				alert("Ni podatkov!");
				return;
			}
			prikazujAnimacijo = true;
			sharedInfoService.setAnimationOngoing(true);

			frameMaster = 0;
			frameLive = 0;
			frameHuman = 0;

			for (let property in masterMarkers) {
				for (let property2 in masterBones) {

					if (property === property2) {
						//console.log("propery:", property, "property2:", property2);
						hideTrace(masterMarkers[property], masterBones[property2]);
						hideTrace(xyPlot.masterMarkers[property], xyPlot.masterBones[property2]);
						hideTrace(yzPlot.masterMarkers[property], yzPlot.masterBones[property2]);
						hideTrace(xzPlot.masterMarkers[property], xzPlot.masterBones[property2]);
						hideTrace(timelinePlot.x.masterMarkers[property], timelinePlot.x.masterBones[property2]);
						hideTrace(timelinePlot.y.masterMarkers[property], timelinePlot.y.masterBones[property2]);
						hideTrace(timelinePlot.z.masterMarkers[property], timelinePlot.z.masterBones[property2]);
					}

				}
			}

			for (let property in liveMarkers) {
				for (let property2 in liveBones) {

					if (property === property2) {
						//console.log("propery:", property, "property2:", property2);
						hideTrace(liveMarkers[property], liveBones[property2]);
						hideTrace(xyPlot.liveMarkers[property], xyPlot.liveBones[property2]);
						hideTrace(yzPlot.liveMarkers[property], yzPlot.liveBones[property2]);
						hideTrace(xzPlot.liveMarkers[property], xzPlot.liveBones[property2]);
						hideTrace(timelinePlot.x.liveMarkers[property], timelinePlot.x.liveBones[property2]);
						hideTrace(timelinePlot.y.liveMarkers[property], timelinePlot.y.liveBones[property2]);
						hideTrace(timelinePlot.z.liveMarkers[property], timelinePlot.z.liveBones[property2]);
					}

				}
			}

			if (konecPredvajanja) {
				konecPredvajanja = false;
			}
			//console.log("vm.ranger:", vm.ranger);
			progress = vm.ranger;
			temporaryProgress = progress;
			initialTimestamp = Date.now();

			// console.log("progress:", progress, "temporaryProgress:", temporaryProgress);
		}

		function reinitialize() {
			console.log("reinitialize();\nPoganjam znova...\nSkrivam obstojece predmete na sceni");

			for (let property in masterMarkers) {
				for (let property2 in masterBones) {

					if (property === property2) {
						//console.log("propery:", property, "property2:", property2);
						hideTrace(masterMarkers[property], masterBones[property2]);
						hideTrace(xyPlot.masterMarkers[property], xyPlot.masterBones[property2]);
						hideTrace(yzPlot.masterMarkers[property], yzPlot.masterBones[property2]);
						hideTrace(xzPlot.masterMarkers[property], xzPlot.masterBones[property2]);
						hideTrace(timelinePlot.x.masterMarkers[property], timelinePlot.x.masterBones[property2]);
						hideTrace(timelinePlot.y.masterMarkers[property], timelinePlot.y.masterBones[property2]);
						hideTrace(timelinePlot.z.masterMarkers[property], timelinePlot.z.masterBones[property2]);
					}

				}
			}

			for (let property in liveMarkers) {
				for (let property2 in liveBones) {

					if (property === property2) {
						//console.log("propery:", property, "property2:", property2);
						hideTrace(liveMarkers[property], liveBones[property2]);
						hideTrace(xyPlot.liveMarkers[property], xyPlot.liveBones[property2]);
						hideTrace(yzPlot.liveMarkers[property], yzPlot.liveBones[property2]);
						hideTrace(xzPlot.liveMarkers[property], xzPlot.liveBones[property2]);
						hideTrace(timelinePlot.x.liveMarkers[property], timelinePlot.x.liveBones[property2]);
						hideTrace(timelinePlot.y.liveMarkers[property], timelinePlot.y.liveBones[property2]);
						hideTrace(timelinePlot.z.liveMarkers[property], timelinePlot.z.liveBones[property2]);
					}

				}
			}
			hideRigidBody(masterClub);
			hideRigidBody(liveClub);

			hideRigidBody(masterBall);
			hideRigidBody(liveBall);

			frameMaster = 0;
			frameLive = 0;
			frameHuman = 0;

			//console.log("Postavljam progress na 0");
			progress = 0;
			temporaryProgress = 0;
			initialTimestamp = Date.now();
		}

		function pausePlayback() {
			console.log("pausePlayback();");
			soundPlaying = false;
			audioService.pauseTone();
			vm.playbackPaused = true;
			temporaryProgress = progress;
			//console.log("progress:", progress, "temporaryProgress:", temporaryProgress);
		}
		function playPlayback() {
			console.log("playPlayback();");
			soundPlaying = true;
			audioService.playTone();
			vm.playbackPaused = false;
			initialTimestamp = Date.now();
			if (konecPredvajanja) {
				reinitialize();
				konecPredvajanja = false;
			}
		}

		function keydownHappened(e) {
			// chrome vs firefox
			var x = e.which || e.keyCode;

			// prepreci keypress event za SPACE (zascrolla browser navzdol)
			// prepreci keypress event za BACKSPACE (v brskalniku nazaj)
			// prepreci keypres se na vseh preostalih (tudi stevilke!) razen F12 za konzolo

			if (x === 32) {// SPACE
				e.preventDefault();
				triggerPlayback();
			} else if (x === 123) {// F12
				console.log("Ali si odprl Chrome Developer Tools?");
			} else if (x === 84) {
				console.log("Pressed key \"t\"");
				goToDefaultModalState();
			} else {// BACKSPACE in PREOSTALE
				e.preventDefault();
			}
		}
		function mousedownHappened(e) {
			// ce das brskalnik v fullscreen mode sta tedve koordinati enaki:
			// console.log("client:", e.clientX, e.clientY);
			// console.log("screen:", e.screenX, e.screenY);
			// ce napacne koordinate, lahko da napaka zaradi priklopljenih dveh zaslonov (vsak zaslon svoj windows scaling, te koordinate bazirajo na scalingu od privzetega monitorja)

			/* med -1 in 1 */
			/*var x = -1 + 2 * (e.clientX / window.innerWidth);
			var y = -1 + 2 * (e.clientY / window.innerHeight);

			// console.log("transformed client:", x, y);
			var vector = new THREE.Vector3(x, y, -1).unproject(camera);
			console.log("vector:", vector);*/
		}
		function resizedBrowser(event, args) {
			// console.log("Resizing three.js stuff...");
			camera.aspect = window.innerWidth / window.innerHeight;
			camera.updateProjectionMatrix();
			renderer.setSize( window.innerWidth, window.innerHeight );
		}
		function slideEnded() {
			console.log("slide on the playbackSpeedSlider has ended");
		}

		function changedRepeatPlayback() {
			console.log("changedRepeatPlayback()");
			if (konecPredvajanja) {
				playPlayback();
			}
		}

		function changeViewToTop() {
			// console.log("changeViewToTop();");
			camera.position.x = 200; // doda neko globino pogleda (x pod kotom), primerjaj kako je ce imas tukaj vrednost 0
			camera.position.y = 0;
			camera.position.z = 3000;
			controls.target = new THREE.Vector3(0, 0, 0);
			controls.update();
			graphChanged(0);
		}
		function changeViewToSide() {
			// console.log("changeViewToSide();");
			camera.position.x = 3000;
			camera.position.y = 0;
			camera.position.z = 200; // doda neko globino pogleda (z pod kotom), primerjaj kako je ce imas tukaj vrednost 0
			controls.target = new THREE.Vector3(0, 0, 0);
			controls.update();
			graphChanged(1);
		}
		function changeViewToFront() {
			// console.log("changeViewToFront();");
			camera.position.x = 0;
			camera.position.y = 3000;
			camera.position.z = 200; // doda neko globino pogleda (z pod kotom), primerjaj kako je ce imas tukaj vrednost 0
			controls.target = new THREE.Vector3(0, 0, 0);
			controls.update();
			graphChanged(2);
		}

		function showHideMasterTrace() {
			if (!vm.showMasterTrace) {

				for (let property in masterMarkers) {
					for (let property2 in masterBones) {

						if (property === property2) {
							hideTrace(masterMarkers[property], masterBones[property2]);
						}

					}
				}

			} else {

				let tip = golfLiveData["3D"];
				for (let x in tip) {

					drawTrace(0, frameMaster, tip[x], masterMarkers[x], masterBones[x], progress, vm.showLiveTrace);
					// v abstraktnih prikazih ne izklapljas traceov!
					// drawTrace(0, frameMaster, tip[x], xyPlot.masterMarkers, xyPlot.masterBones, progress, xyPlot.flag);
					// drawTrace(0, frameMaster, tip[x], yzPlot.masterMarkers, yzPlot.masterBones, progress, yzPlot.flag);
					// drawTrace(0, frameMaster, tip[x], xzPlot.masterMarkers, xzPlot.masterBones, progress, xzPlot.flag);
					// drawTrace(0, frameMaster, tip[x], timelinePlot.x.masterMarkers, timelinePlot.x.masterBones, progress, timelinePlot.flag);
					// drawTrace(0, frameMaster, tip[x], timelinePlot.y.masterMarkers, timelinePlot.y.masterBones, progress, timelinePlot.flag);
					// drawTrace(0, frameMaster, tip[x], timelinePlot.z.masterMarkers, timelinePlot.z.masterBones, progress, timelinePlot.flag);

				}
			}
		}

		function showHideMasterRigidBody() {
			if (!vm.showMasterRigidBody) {
				hideRigidBody(masterClub);
				hideRigidBody(masterBall);
			}
		}

		function showHideLiveTrace() {
			if (!vm.showLiveTrace) {

				for (let property in liveMarkers) {
					for (let property2 in liveBones) {

						if (property === property2) {
							hideTrace(liveMarkers[property], liveBones[property2]);
						}

					}
				}

			} else {

				let tip = golfLiveData["3D"];
				for (let x in tip) {

					drawTrace(0, frameLive, tip[x], liveMarkers[x], liveBones[x], progress, vm.showLiveTrace);
					// v abstraktnih prikazih ne izklapljas traceov!
					// drawTrace(oldFrameLive, frameLive, tip[x], xyPlot.liveMarkers, xyPlot.liveBones, progress, xyPlot.flag);
					// drawTrace(oldFrameLive, frameLive, tip[x], yzPlot.liveMarkers, yzPlot.liveBones, progress, yzPlot.flag);
					// drawTrace(oldFrameLive, frameLive, tip[x], xzPlot.liveMarkers, xzPlot.liveBones, progress, xzPlot.flag);
					// drawTrace(oldFrameLive, frameLive, tip[x], timelinePlot.x.liveMarkers, timelinePlot.x.liveBones, progress, timelinePlot.flag);
					// drawTrace(oldFrameLive, frameLive, tip[x], timelinePlot.y.liveMarkers, timelinePlot.y.liveBones, progress, timelinePlot.flag);
					// drawTrace(oldFrameLive, frameLive, tip[x], timelinePlot.z.liveMarkers, timelinePlot.z.liveBones, progress, timelinePlot.flag);

				}
			}
		}

		function showHideLiveRigidBody() {
			if (!vm.showLiveRigidBody) {
				hideRigidBody(liveClub);
				hideRigidBody(liveBall);
			}
		}

		function showHideHuman() {
			if (!vm.showHuman) {
				human.visible = false;
			} else {
				drawHuman(frameHuman, humanData, human.skeleton.bones, progress, vm.showHuman);
			}
		}

		function showHideEnvironment() {
			if (!vm.showEnvironment) {
				grass.visible = false;
				sky.visible = false;
				golfBall.visible = false;
				footBall.visible = false;
				scene.background = 0xffffff;
				scene.fog = null;
				grid.visible = true;
			} else {
				grass.visible = true;
				sky.visible = true;
				golfBall.visible = true;
				footBall.visible = true;
				grid.visible = false;
				scene.background = new THREE.Color(colorFog);
				scene.fog = new THREE.FogExp2(colorFog, 0.0001);
			}
		}

		function initWorld() {

			canvas = document.getElementById("renderer");

			renderer = new THREE.WebGLRenderer({
				canvas: canvas,
				antialias: false
			});// anti-aliasing obvezno nastavljaj tu ob konstrukciji, drugace ne prime!
			renderer.setSize(window.innerWidth, window.innerHeight);
			renderer.setPixelRatio(window.devicePixelRatio);
			renderer.shadowMap.enabled = true;
			// to antialias the shadow PCFSoftShadowMap
			renderer.shadowMap.type = THREE.PCFShadowMap;

			scene = new THREE.Scene();
			scene.name = "glavna scena";
			scene.background = new THREE.Color(colorFog);
			// eksponentna megla:
			scene.fog = new THREE.FogExp2(colorFog, 0.0001);
			// linearna megla:
			//scene.fog = new THREE.Fog(colorFog, 10000, 20000);
			//renderer.setClearColor(colorFog);
			//scene.castShadow = true;
			//scene.receiveShadow = true;

			camera = initCamera();
			camera.name = "kamera";
			scene.add(camera);

			initControls();

			var ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
			ambientLight.name = "AmbientLight";
			scene.add(ambientLight);

			/*var spotLight = initSpotLight();
			spotLight.name = "SpotLight";
			//camera.add(spotLight);
			//scene.add(spotLight);*/

			var directionalLight = initDirectionalLight();
			directionalLight.name = "DirectionalLight";
			scene.add(directionalLight);

			grid = initGrid(2000, 100);
			grid.name = "mreza";
			grid.visible = false;
			scene.add(grid);


			sky = initSky(16192);
			sky.name = "nebo";
			scene.add(sky);

			grass = initGrass(16192);
			grass.name = "trata";
			scene.add(grass);

			/*var backgroundEnvironment = initBackgroundEnvironment();
			backgroundEnvironment.name = "velikanska kocka ozadja";
			scene.add(backgroundEnvironment);*/

			var axes = initAxes();
			axes.name = "osi";
			scene.add(axes);

			liveClub = graphicsLoaderService.getClub();
			liveClub.name = "liveClub";
			liveClub.visible = false;
			liveClub.castShadow = true;
			liveClub.receiveShadow = true;
			scene.add(liveClub);

			masterClub = graphicsLoaderService.getClub();
			masterClub.name = "masterClub";
			masterClub.visible = false;
			masterClub.castShadow = true;
			masterClub.receiveShadow = true;
			scene.add(masterClub);

			initStats();
			//initGui();

			golfBall = initGolfBall();
			golfBall.name = "golf zogica";
			scene.add(golfBall);

			masterBall = initFootBall();
			masterBall.name = "masterBall";
			masterBall.visible = false;
			masterBall.castShadow = true;
			masterBall.receiveShadow = true;
			scene.add(masterBall);

			liveBall = initFootBall();
			liveBall.name = "liveBall";
			liveBall.visible = false;
			liveBall.castShadow = true;
			liveBall.receiveShadow = true;
			scene.add(liveBall);

			human = initHuman();
			human.name = "clovek";
			human.visible = false;
			scene.add(human);

			//console.log(scene);


		}

		function initAxes() {

			var axes = new THREE.Object3D();

			var geometryCylinder = new THREE.CylinderGeometry(10, 10, 300, 32);
			var geometryCone = new THREE.CylinderGeometry(0, 30, 80, 32);

			// Axis Z
			var crtaZ = new THREE.Mesh(geometryCylinder, materialBlue);
			crtaZ.translateZ(150);
			crtaZ.rotation.x = 90 * Math.PI / 180;
			crtaZ.name = "os Z stozec";
			axes.add(crtaZ);

			var puscicaZ = new THREE.Mesh(geometryCone, materialBlue);
			puscicaZ.translateZ(300);
			puscicaZ.rotation.x = 90 * Math.PI / 180;
			puscicaZ.name = "oz Z puscica";
			axes.add(puscicaZ);

			// Axis Y
			var crtaY = new THREE.Mesh(geometryCylinder, materialGreen);
			crtaY.translateY(150);
			crtaY.name = "os Y crta";
			axes.add(crtaY);

			var puscicaY = new THREE.Mesh(geometryCone, materialGreen);
			puscicaY.translateY(300);
			puscicaY.name = "os Y puscica";
			axes.add(puscicaY);

			// Axis X
			var crtaX = new THREE.Mesh(geometryCylinder, materialRed);
			crtaX.translateX(150);
			crtaX.rotation.z = 90 * Math.PI / 180;
			crtaX.name = "os X crta";
			axes.add(crtaX);

			var puscicaX = new THREE.Mesh(geometryCone, materialRed);
			puscicaX.translateX(300);
			puscicaX.rotation.z = -90 * Math.PI / 180;
			puscicaX.name = "os X puscica";
			axes.add(puscicaX);

			return axes;
		}

		function initCamera() {
			var verticalFieldOfViewAngle = 75;
			var aspectRatio = window.innerWidth / window.innerHeight;
			var nearPlane = 0.1;
			var farPlane = 100000; // da lahko scroll-out-as prakticno v neskoncnost

			var camera = new THREE.PerspectiveCamera(verticalFieldOfViewAngle, aspectRatio, nearPlane, farPlane);
			camera.position.x = 2000;
			camera.position.y = 2000;
			camera.position.z = 2000;
			//camera.position.set(2000, 2000, 2000);


			// default os za "gor" v THREE.JS je os y
			camera.up.set(0, 0, 1); // da "gor" kaze os z
			//camera.up = new THREE.Vector3(0, 0, 1);


			// THREE.OrbitControls prikrito sam izvede spodnji stavek
			//camera.lookAt(new THREE.Vector3(0, 0, 0));
			return camera;
		}

		function initControls() {
			controls = new THREE.OrbitControls(camera, canvas);
			controls.enableDamping = true;
			controls.dampingFactor = 0.2;

			// zoom omejitve
			controls.minDistance = 200;
			controls.maxDistance = 6000;

			// vertikalno rotiranje
			controls.minPolarAngle = 0;
			controls.maxPolarAngle = 89.5 * Math.PI / 180; // da ne more iti pod ravnino

			// horizontalno rotiranje
			controls.minAzimuthAngle = -Infinity;
			controls.maxAzimuthAngle = Infinity;
		}

		function initSpotLight() {
			// osvetljuje iz dolocene smeri in tocke izvora
			// dodajanje luci v sceno ali v kamero?
			// POVZROCA SENCE
			var spotLight = new THREE.SpotLight(0xffffff, 0.8);
			spotLight.position.z = 5000;

			//https://threejs.org/docs/#api/lights/shadows/SpotLightShadow
			spotLight.castShadow = true;
			//var camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2500);
			//spotLight.shadow = new THREE.LightShadow(camera);
			spotLight.shadow.mapSize.width = 1024;
			spotLight.shadow.mapSize.height = 1024;
			spotLight.shadow.camera.near = 0.1;
			spotLight.shadow.camera.fa = 4000;
			var d = 1000;
			spotLight.shadow.camera.left = - d;
			spotLight.shadow.camera.right = d;
			spotLight.shadow.camera.top = d;
			spotLight.shadow.camera.bottom = - d;
			spotLight.shadow.camera.fov = 30;
			//directionalLight.shadowCameraNear = 3;
			//directionalLight.shadowCameraFar = camera.far;
			return spotLight;
		}

		function initDirectionalLight() {
			// osvetljuje iz dolocene smeri, tocka izvora je v neskoncnosti
			// POVZROCA SENCE
			var directionalLight = new THREE.DirectionalLight(0xffffff, 0.85);
			directionalLight.position.set(0, 0, 5000);
			//directionalLight.shadow.camera = true;

			//https://threejs.org/docs/#api/lights/shadows/DirectionalLightShadow
			directionalLight.castShadow = true;
			var camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
			// SPODANJE NE DELA, ZAKAJ?
			//directionalLight.shadow = new THREE.DirectionalLightShadow(camera);
			directionalLight.shadow = new THREE.LightShadow(camera);
			// spodnje regulira detajle oz. sistemsko pozresnost sencenja!
			directionalLight.shadow.mapSize.width = 2048;
			directionalLight.shadow.mapSize.height = 2048;

			/*directionalLight.shadowCameraVisible = true;
			directionalLight.shadowCameraRight     =  1000;
			directionalLight.shadowCameraLeft     = -1000;
			directionalLight.shadowCameraTop      =  1000;
			directionalLight.shadowCameraBottom   = -1000;*/

			//var helper = new THREE.DirectionalLightHelper(directionalLight, 5);
			//scene.add(helper);

			return directionalLight;
		}

		function initStats() {
			stats = new Stats();
			stats.showPanel(0);
			stats.domElement.style.position = "absolute";
			stats.domElement.style.removeProperty("left");
			stats.domElement.style.right = "0";
			document.getElementById("timestampsTable").appendChild(stats.dom);

			var statsMode = 0;
			var timestampsTable = document.getElementById("timestampsTable").style;
			timestampsTable.background = "rgb(0, 0, 34)";

			stats.dom.onclick = statsClicked;

			function statsClicked() {
				statsMode++;

				if (statsMode === 0) { // modra
					timestampsTable.background = "rgb(0, 0, 34)";
				} else if (statsMode === 1) { // zelena
					timestampsTable.background = "rgb(0, 34, 0)";
				} else { // vijola
					timestampsTable.background = "rgb(34, 0, 17)";
					statsMode = -1;
				}
			}
			// https://www.npmjs.com/package/stats-js
		}

		function initGui() {
			gui = new dat.GUI({
				width: 500
			});
			gui.close();
		}

		function initGrid(size, step) {
			console.log("initGrid();");

			var geometryLine = new THREE.Geometry();

			for (var i = -size; i <= size; i += step) {
				geometryLine.vertices.push(new THREE.Vector3(-size, i, 0));
				geometryLine.vertices.push(new THREE.Vector3(size, i, 0));
				geometryLine.vertices.push(new THREE.Vector3(i, -size, 0));
				geometryLine.vertices.push(new THREE.Vector3(i, size, 0));
			}

			var line = new THREE.LineSegments(geometryLine, materialLine);
			line.renderOrder = 1;
			// gornje "zgolj omili" z-buffer fighting s trato, ce prikazujem mrezo in trato hkrati
			return line;
		}

		function initGrass(size) {
			//size = size - 2048; // da tla ne grejo cisto do sfere neba (ce krozna ploskev trate)
			console.log("initGrass();");

			var textures = graphicsLoaderService.getGrass();
			var texture = textures.map;
			// simetricni repeat, da pa bi se na vsak repeat textura obrnila v random direction nisem nasel :/
			texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
			texture.offset.set(0, 0);
			texture.repeat.set(16, 16);
			texture.anisotropy = 16;

			// vse te spodaj dolocene "maps" prevzamejo offset in repeat lastnost od "texture" zgoraj
			var bumpMap = textures.bumpMap;
			bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;

			var specularMap = textures.specularMap;
			specularMap.wrapS = specularMap.wrapT = THREE.RepeatWrapping;

			var normalMap = textures.normalMap;
			normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;

			var displacementMap = textures.displacementMap;
			displacementMap.wrapS = displacementMap.wrapT = THREE.RepeatWrapping;

			var ambientOcclusionMap = textures.ambientOcclusionMap;
			ambientOcclusionMap.wrapS = ambientOcclusionMap.wrapT = THREE.RepeatWrapping;

			//var geometry = new THREE.CircleBufferGeometry(size, 100);
			var geometry = new THREE.PlaneGeometry(size * 2, size * 2, 200, 200);
			var material = new THREE.MeshLambertMaterial({
				map: texture,
				//bumpMap: bumpMap,
				//specularMap: specularMap,
				//normalMap: normalMap,
				//displacementMap: displacementMap,
				//displacementScale: 1,
				//aoMap: ambientOcclusionMap,
				//specular: 0x101010 za Phong Material
				side: THREE.FrontSide
			});

			var grass = new THREE.Mesh(geometry, material);
			//grass.position.z = -5; // zaradi z-buffer fighting
			grass.receiveShadow = true;

			setTimeout(function() {
				applyHeightDataToPlane(grass);
			}, 25); /* ce ni zakasnjeno ne prime pravilno in je trava kitajski kras, svasta...*/
			//grass.depthWrite = false;
			return grass;
		}

		function initBackgroundEnvironment() {
			var loader = new THREE.CubeTextureLoader();
			loader.setPath("img/");
			var background = loader.load([
				"pos-x.png",
				"neg-x.png",
				"pos-y.png",
				"neg-y.png",
				"pos-z.png",
				"neg-z.png"
			]);

			var shader = THREE.ShaderLib.cube;
			shader.uniforms.tCube.value = background;
			var material = new THREE.ShaderMaterial({
				fragmentShader: shader.fragmentShader,
				vertexShader: shader.vertexShader,
				uniforms: shader.uniforms,
				depthWrite: false,
				side: THREE.BackSide
			});
			var ogromnaKocka = new THREE.BoxGeometry(100000, 100000, 100000);
			var ozadje = new THREE.Mesh(ogromnaKocka, material);
			return ozadje;
		}

		function makeTraceBone(fromPoint, toPoint, material) {
			var fromPoint = new THREE.Vector3().fromArray(fromPoint);
			var toPoint = new THREE.Vector3().fromArray(toPoint);
			var direction = new THREE.Vector3().subVectors(toPoint, fromPoint);
			var arrow = new THREE.ArrowHelper(direction.clone().normalize(), fromPoint);

			// dostop do globalnih: debelinaSledi
			var boneGeometry = new THREE.CylinderBufferGeometry(debelinaSledi, debelinaSledi, direction.length(), 28, 1);
			var bone = new THREE.Mesh(boneGeometry, material);
			bone.geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, direction.length() / 2, 0));
			bone.rotation.copy(arrow.rotation);
			bone.position.set(fromPoint.x, fromPoint.y, fromPoint.z);

			return bone;
		}

		function makeTrace(name, frames, geometry, markers, bones, material,/* scene, */axis, steps) {
			// https://coderwall.com/p/kvzbpa/don-t-use-array-foreach-use-for-instead
			// markers in bones se spremenita na globalnem nivoju!
			// you can't reuse meshes, but u sure can reuse geometries :)

			var axis = axis || [1, 1, 1];
			var steps = steps || [0, 0, 0];

			var xStep = steps[0] / frames.length;
			var yStep = steps[1] / frames.length;
			var zStep = steps[2] / frames.length;

			var trace = new THREE.Object3D();

			markers[name] = [];
			bones[name] = [];

			for (var i = 0, length = frames.length; i < length; i++) {
				markers[name][i] = new THREE.Mesh(geometry, material);
				markers[name][i].position.x = axis[0] * frames[i].value[0] + i * xStep;
				markers[name][i].position.y = axis[1] * frames[i].value[1] + i * yStep;
				markers[name][i].position.z = axis[2] * frames[i].value[2] + i * zStep;
				markers[name][i].name = "marker " + i;
				markers[name][i].visible = false;
				//scene.add(markers[i]);
				trace.add(markers[name][i]);

				if (i > 0) {

					var fromPoint = [];
					fromPoint.push(axis[0] * frames[i - 1].value[0] + (i - 1) * xStep);
					fromPoint.push(axis[1] * frames[i - 1].value[1] + (i - 1) * yStep);
					fromPoint.push(axis[2] * frames[i - 1].value[2] + (i - 1) * zStep);
					var toPoint = [];
					toPoint.push(axis[0] * frames[i].value[0] + i * xStep);
					toPoint.push(axis[1] * frames[i].value[1] + i * yStep);
					toPoint.push(axis[2] * frames[i].value[2] + i * zStep);
					bones[name][i] = makeTraceBone(fromPoint, toPoint, material);
					bones[name][i].name = "bone " + i;
					bones[name][i].visible = false;
					//scene.add(bones[i]);
					trace.add(bones[name][i]);

				}
			}
			//scene.add(trace);
			return trace;
		}












		function triggerPlayback() {
			//console.log("triggerPlayback();");
			if(!golfMasterData || !golfLiveData) {
				alert("Ni podatkov!");
				return;
			}
			prikazujAnimacijo = true; // ob prvem trigganju nastavi na true oz. ce uporabnik nima vklopljenega repeat
			sharedInfoService.setAnimationOngoing(true);
			if (vm.playbackPaused) {
				playPlayback();
			} else {
				pausePlayback();
			}
		}
		function changePlaybackSpeed() {
			console.log("In function vm.changePlaybackSpeed", vm.playbackSpeedSlider.value);
			if(vm.playbackSpeedSlider.value === undefined) {
				console.log("vm.playbackSpeedSlider.value was undefined!");
			}
		}

		// HIDE FUNCTIONS
		function hideTrace(markers, bones, flag) {
			for (var key in markers) {
				markers[key].visible = false;
			}
			for (var key in bones) {
				bones[key].visible = false;
			}
		}

		function hideRigidBody(club) {
			club.visible = false;
		}


		function getAnimationLength(master, live) {
			// lokalne reference (hitrost javascripta?)

			if (!master && !live) {
				return;
			}

			// najvecja vrednost timestampa
			// http://stackoverflow.com/questions/4020796/finding-the-max-value-of-an-attribute-in-an-array-of-objects
			var biggestTimestampMaster = Math.max.apply(Math, master.map(function(x) { return x.timestamp; } ));
			var biggestTimestampLive = Math.max.apply(Math, live.map(function(x) { return x.timestamp; } ));

			// zadnji element podatkov udarca mora imeti najvecji "timestamp"
			// ce ne, podatki niso ok
			if (!(master[master.length - 1].timestamp === biggestTimestampMaster)) {
				alert("BAD MASTER DATA!");
			}
			if (!(live[live.length - 1].timestamp === biggestTimestampLive)) {
				alert("BAD LIVE DATA!");
			}

			// ce je slucajno dolzina enega udarca krajsa od drugega, dolzino animacijo nastavim na dolzino daljsega udarca
			return Math.max(biggestTimestampMaster, biggestTimestampLive);
		}

		function activatedChart(event, mass) {

			if (!prikazujAnimacijo) {
				return;
			}

			if (mass === undefined) {
				mass = aktivenGraf;
				console.log("mass ni bil dan");
			} else {
				aktivenGraf = mass;
			}

			if (flagPlot && prikazujAnimacijo) {

				console.log("Ponastavljam canvase za grafe!");

				var xyCanvas = document.getElementById("graph_xy");
				var yzCanvas = document.getElementById("graph_yz");
				var xzCanvas = document.getElementById("graph_xz");
				var torqueCanvas = document.getElementById("graph_torque");
				var timelineCanvas = document.getElementById("graph_timeline");

				xyPlot.renderer = null;
				initPlotRenderer(xyCanvas, xyPlot);
				yzPlot.renderer = null;
				initPlotRenderer(yzCanvas, yzPlot);
				xzPlot.renderer = null;
				initPlotRenderer(xzCanvas, xzPlot);
				torquePlot.renderer = null;
				initTorqueRenderer(torqueCanvas, torquePlot);
				timelinePlot.renderer = null;
				initTimelineRenderer(timelineCanvas, timelinePlot);

				var xyBackgroundCanvas = document.getElementById("background_xy");
				var yzBackgroundCanvas = document.getElementById("background_yz");
				var xzBackgroundCanvas = document.getElementById("background_xz");
				var torqueBackgroundCanvas = document.getElementById("background_torque");
				var timelineBackgroundCanvas = document.getElementById("background_timeline");

				drawPlotBackground(xyBackgroundCanvas);
				drawPlotBackground(yzBackgroundCanvas);
				drawPlotBackground(xzBackgroundCanvas);
				drawTorqueBackground(torqueBackgroundCanvas);
				drawTimelineBackground(timelineBackgroundCanvas);

				// enkrat pozeni rendererje, da se poinicializirajo in da "zasteka" samo 1x
				xyPlot.flag = true;
				yzPlot.flag = true;
				xzPlot.flag = true;
				torquePlot.flag = true;
				timelinePlot.flag = true;

				renderPlot(xyPlot);
				renderPlot(yzPlot);
				renderPlot(xzPlot);
				renderPlot(torquePlot);
				renderPlot(timelinePlot);

				flagPlot = false;
			}

			xyPlot.flag = false;
			yzPlot.flag = false;
			xzPlot.flag = false;
			torquePlot.flag = false;
			timelinePlot.flag = false;

			let tipMasterData = golfMasterData["3D"];
			let tipLiveData = golfLiveData["3D"];
			switch(mass) {
				case 1:
					console.log("Activated xy chart");
					xyPlot.flag = true;

					for (let x in tipMasterData) {
						drawTrace(0, frameMaster, tipMasterData[x], xyPlot.masterMarkers[x], xyPlot.masterBones[x], progress, xyPlot.flag);
					}

					for (let x in tipLiveData) {
						drawTrace(0, frameLive, tipLiveData[x], xyPlot.liveMarkers[x], xyPlot.liveBones[x], progress, xyPlot.flag);
					}

					break;
				case 2:
					console.log("Activated yz chart");
					yzPlot.flag = true;

					for (let x in tipMasterData) {
						drawTrace(0, frameMaster, tipMasterData[x], yzPlot.masterMarkers[x], yzPlot.masterBones[x], progress, yzPlot.flag);
					}

					for (let x in tipLiveData) {
						drawTrace(0, frameLive, tipLiveData[x], yzPlot.liveMarkers[x], yzPlot.liveBones[x], progress, yzPlot.flag);
					}

					break;
				case 3:
					console.log("Activated xz chart");
					xzPlot.flag = true;

					for (let x in tipMasterData) {
						drawTrace(0, frameMaster, tipMasterData[x], xzPlot.masterMarkers[x], xzPlot.masterBones[x], progress, xzPlot.flag);
					}

					for (let x in tipLiveData) {
						drawTrace(0, frameLive, tipLiveData[x], xzPlot.liveMarkers[x], xzPlot.liveBones[x], progress, xzPlot.flag);
					}

					break;
				case 4:
					console.log("Activated torque chart");
					torquePlot.flag = true;
					break;
				case 5:
					console.log("Activated timeline chart");
					timelinePlot.flag = true;

					for (let x in tipMasterData) {
						drawTrace(0, frameMaster, tipMasterData[x], timelinePlot.x.masterMarkers[x], timelinePlot.x.masterBones[x], progress, timelinePlot.flag);
						drawTrace(0, frameMaster, tipMasterData[x], timelinePlot.y.masterMarkers[x], timelinePlot.y.masterBones[x], progress, timelinePlot.flag);
						drawTrace(0, frameMaster, tipMasterData[x], timelinePlot.z.masterMarkers[x], timelinePlot.z.masterBones[x], progress, timelinePlot.flag);
					}

					for (let x in tipLiveData) {
						drawTrace(0, frameLive, tipLiveData[x], timelinePlot.x.liveMarkers[x], timelinePlot.x.liveBones[x], progress, timelinePlot.flag);
						drawTrace(0, frameLive, tipLiveData[x], timelinePlot.y.liveMarkers[x], timelinePlot.y.liveBones[x], progress, timelinePlot.flag);
						drawTrace(0, frameLive, tipLiveData[x], timelinePlot.z.liveMarkers[x], timelinePlot.z.liveBones[x], progress, timelinePlot.flag);
					}

					break;
				default:
					console.log("No chart is active");
			}
		}

		function changedPlaybackData() {
			console.log("changedPlaybackData();");

			console.log(scene);

			if (currentSocketMessage) {

				for (let e of currentSocketMessage) {
					if (e.vrsta === "referencna") {
						console.log("changedPlaybackData() - dobil referencno gibanje");
						sharedInfoService.setMasterData(e);
						golfMasterData = sharedInfoService.getMasterData();

						var zaOdstraniti = [];
						scene.traverse(function(x) {
							if (x instanceof THREE.Object3D && x.name.startsWith("traceMaster")) {
								console.log("Nasel objekt primeren za odstranitev (master):", x.name);
								zaOdstraniti.push(x.name);
								// ce tukaj znotraj odstranjujem iz scene z "scene.remove" vrze en wtf cuden error
							}
						});
						for (let objekt of zaOdstraniti) {
							scene.remove(scene.getObjectByName(objekt));
						}

						let tip = golfMasterData["3D"];
						for (let x in tip) {
							var traceMaster = makeTrace(x, tip[x], geometryMarker, masterMarkers, masterBones, materialMaster);
							traceMaster.name = "traceMaster_" + x;
							scene.add(traceMaster);
						}

					} else if (e.vrsta === "trenutna") {
						console.log("changedPlaybackData() - dobil trenutno gibanje");
						sharedInfoService.setLiveData(e);
						golfLiveData = sharedInfoService.getLiveData();

						var zaOdstraniti = [];
						scene.traverse(function(x) {
							if (x instanceof THREE.Object3D && x.name.startsWith("traceLive")) {
								console.log("Nasel objekt primeren za odstranitev (live):", x.name);
								zaOdstraniti.push(x.name);
							}
						});
						for (let objekt of zaOdstraniti) {
							scene.remove(scene.getObjectByName(objekt));
						}

						let tip = golfLiveData["3D"];
						for (let x in tip) {
							var traceLive = makeTrace(x, tip[x], geometryMarker, liveMarkers, liveBones, materialLive);
							traceLive.name = "traceLive_" + x;
							scene.add(traceLive);
						}
					}
				}

				flagPlot = true;

				var obvestilo = "";
				if (sharedInfoService.getMasterData().length === 0) {
					obvestilo += "Nimam podatkov referenčnega gibanja.\n";
				}
				if (sharedInfoService.getLiveData().length === 0) {
					obvestilo += "Nimam podatkov trenutnega gibanja.";
				}
				if (obvestilo !== "") {
					alert(obvestilo);
					return;
				}

				activatedChart();

				//splineCurve = initSplineCurve(testData.liveData["3D"], 0x8e44ad);
				//scene.add(splineCurve);

				animationLength = getAnimationLength(golfMasterData["6DOF"]["marker na glavi palice"], golfLiveData["6DOF"]["marker na glavi palice"]);
				vm.rangerMaximumValue = animationLength;
				vm.ranger = 0;
			}

			playbackSliderDown = false;
			playbackSliderMoving = false;

			if (prikazujAnimacijo) {
				reinitialize();
				konecPredvajanja = false;
				pausePlayback();
			}
		}

		function hideCanvasElement(canvas) {
			if (canvas) {
				canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
			}
		}

		function graphChanged(x) {
			$scope.$broadcast("graph changed", x); // $broadcast -- dispatches the event downwards to all child scopes
		}

		// ob izhodu odstrani fps counter
		$scope.$on("$destroy", function() {
			console.log("Removing stats from DOM");
			document.getElementById("timestampsTable").removeChild(stats.dom);
		});

		function initSky(size) {
			console.log("initSky();");

			// GLSL inside javascript (ES6 literals)
			var vertexShaderSource = `
				varying vec3 vWorldPosition;
				void main() {
					vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
					vWorldPosition = worldPosition.xyz;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}
			`;

			var fragmentShaderSource = `
				uniform vec3 topColor;
				uniform vec3 bottomColor;
				uniform float offset;
				uniform float exponent;
				varying vec3 vWorldPosition;
				void main() {
					float h = normalize( vWorldPosition + offset ).z;
					gl_FragColor = vec4( mix( bottomColor, topColor, max( pow( max( h, 0.0 ), exponent ), 0.0 ) ), 1.0 );
				}
			`;

			var uniforms = {
				topColor: 	 { type: "c", value: new THREE.Color( 0x0077ff ) },
				bottomColor: { type: "c", value: new THREE.Color( 0xffffff ) },
				offset:		 { type: "f", value: 400 },
				exponent:	 { type: "f", value: 0.6 }
			};
			//uniforms.topColor.value.copy( light.color );

			var skyGeo = new THREE.SphereGeometry(size, 32, 15);
			var skyMat = new THREE.ShaderMaterial( {
				uniforms: uniforms,
				vertexShader: vertexShaderSource,
				fragmentShader: fragmentShaderSource,
				side: THREE.BackSide
			} );
			/*var texture = new THREE.TextureLoader().load("img/terra/skyenv.jpg");
			var material = new THREE.MeshBasicMaterial({
				map: texture,
				side: THREE.BackSide
			});*/

			//renderer.gammaInput = true;
			//renderer.gammaOutput = true;

			var sky = new THREE.Mesh(skyGeo, skyMat);
			return sky;
		}

		function initGolfBall() {
			var golfBall = graphicsLoaderService.getGolfBall();
			golfBall.visible = true;
			golfBall.castShadow = true;
			golfBall.receiveShadow = true;
			golfBall.position.set(150, 150, 40);
			return golfBall;
		}

		function initFootBall() {
			var footBall = graphicsLoaderService.getFootBall();
			footBall.visible = true;
			footBall.castShadow = true;
			footBall.receiveShadow = true;
			footBall.position.set(750, 800, 100);
			return footBall;
		}

		function initHuman() {
			var human = graphicsLoaderService.getHuman();
			human.skinning = true;
			human.visible = true;
			human.castShadow = true;
			human.receiveShadow = true;

			//initHumanGui();
			//initSkeletonGui();
			//initClubGui();

			function initHumanGui() {
				var modelCloveka = gui.addFolder("SRT modela cloveka:");
				//modelCloveka.open();
				modelCloveka.add(human.scale, "x", 2, 10).name("Skaliranje po x").listen();
				modelCloveka.add(human.scale, "y", 2, 10).name("Skaliranje po y").listen();
				modelCloveka.add(human.scale, "z", 2, 10).name("Skaliranje po z").listen();

				modelCloveka.add(human.rotation, "x", -Math.PI, Math.PI, 0.001).name("Rotacija po x").listen();
				modelCloveka.add(human.rotation, "y", -Math.PI, Math.PI, 0.001).name("Rotacija po y").listen();
				modelCloveka.add(human.rotation, "z", -Math.PI, Math.PI, 0.001).name("Rotacija po z").listen();

				modelCloveka.add(human.position, "x", -750, 750).name("Transliranje po x").listen();
				modelCloveka.add(human.position, "y", -750, 750).name("Transliranje po y").listen();
				modelCloveka.add(human.position, "z", 0, 750).name("Transliranje po z").listen();
			}

			function initSkeletonGui() {
				var unwanted = ["Finger", "Head", "Toe", "Eye", "Jaw", "Pelvis"];
				var flag = true;
				var skeleton = gui.addFolder("Rotiranje skeletona:");
				//skeleton.open();

				for (var i = 0, data = human.skeleton.bones, iLength = data.length; i < iLength; i++) {

					flag = true;

					jLoop:
					for (var j = 0, jLength = unwanted.length; j < jLength; j++) {
						if(!(data[i].name.indexOf(unwanted[j]) === -1)) {
							console.log(data[i].name);
							flag = false;
							break jLoop;
						}
					}

					if (flag) {
						skeleton.add(data[i].rotation, "x", -Math.PI, Math.PI, 0.001).name("X: [" + i + "] " + data[i].name).listen();
						skeleton.add(data[i].rotation, "y", -Math.PI, Math.PI, 0.001).name("Y: [" + i + "] " + data[i].name).listen();
						skeleton.add(data[i].rotation, "z", -Math.PI, Math.PI, 0.001).name("Z: [" + i + "] " + data[i].name).listen();
					}
				}
			}

			function initClubGui() {
				var vmesnikPalice = gui.addFolder("Live palica:");
				vmesnikPalice.add(liveClub.children[0].rotation, "x", -Math.PI, Math.PI, 0.001).name("X:").listen();
				vmesnikPalice.add(liveClub.children[0].rotation, "y", -Math.PI, Math.PI, 0.001).name("Y:").listen();
				vmesnikPalice.add(liveClub.children[0].rotation, "z", -Math.PI, Math.PI, 0.001).name("Z:").listen();
				vmesnikPalice.add(liveClub.rotation, "x", -Math.PI, Math.PI, 0.001).name("X:").listen();
				vmesnikPalice.add(liveClub.rotation, "y", -Math.PI, Math.PI, 0.001).name("Y:").listen();
				vmesnikPalice.add(liveClub.rotation, "z", -Math.PI, Math.PI, 0.001).name("Z:").listen();
				vmesnikPalice.open();
			}

			//helper = new THREE.SkeletonHelper(human);
			//helper.material.linewidth = 3;
			//scene.add(helper);

			// privzeti vrstni red transformov v THREE: scale, rotate, translate
			human.scale.x = 8;
			human.scale.y = 8;
			human.scale.z = 8;

			// Default rotation order is 'XYZ'
			human.rotation.x = (Math.PI / 180) * 90;
			human.rotation.y = (Math.PI / 180) * -180;
			human.rotation.z = 0;

			human.position.x = 45;
			human.position.y = 560;
			human.position.z = 160; // malenkost pod visino palice

			return human;
		}

		function drawHuman(endFrame, frames, bones, progress, flag) {
			if (flag && endFrame > 0) {
				var startFrame = endFrame - 1;
				var ratio = 1;

				if (endFrame === frames.length) {
					endFrame = frames.length - 1;
					//return;
				}

				if (bones.length !== frames[startFrame].orientation.length) {
					throw "Arraya nista enako velika!";
				}

				var startRotations = frames[startFrame].orientation;
				var endRotations = frames[endFrame].orientation;

				if (endFrame < frames.length) { // interpolacija
					var wholeTimeDif = frames[endFrame].timestamp - frames[startFrame].timestamp;
					var actualTimeDif = progress - frames[startFrame].timestamp;
					ratio = actualTimeDif / wholeTimeDif;
				}

				for (let i = 0, length = bones.length; i < length; i++) {

					//bones[i].rotation.x = rotations[i][0];
					//bones[i].rotation.y = rotations[i][1];
					//bones[i].rotation.z = rotations[i][2];

					var startRot = new THREE.Vector3().fromArray(startRotations[i]);
					var endRot = new THREE.Vector3().fromArray(endRotations[i]);
					var interpolatedRot = getPointInBetweenByPercentage(startRot, endRot, ratio);

					bones[i].rotation.set(interpolatedRot.x, interpolatedRot.y, interpolatedRot.z);
				}
				human.visible = true;
				//helper.update();
			}
		}

		function drawPlotBackground(canvas) {
			console.log("drawPlotBackground();");
			var context = canvas.getContext("2d");
			context.clearRect(0, 0, canvas.width, canvas.height); // najprej vse pobrisi

			context.strokeStyle = "#000000";
			context.translate(0.5, 0.5); // za thin crte
			context.lineWidth = 1;

			context.beginPath();
			context.moveTo(xPadding, yPadding);
			context.lineTo(xPadding, canvas.height - yPadding);
			context.lineTo(canvas.width - xPadding, canvas.height - yPadding);
			context.lineTo(canvas.width - xPadding, yPadding);
			context.lineTo(xPadding, yPadding);

			// vodoravna crta po sredini
			context.moveTo(xPadding, canvas.height / 2);
			context.lineTo(canvas.width - xPadding, canvas.height / 2);

			// navpicna crta po sredini
			context.moveTo(canvas.width / 2, yPadding);
			context.lineTo(canvas.width / 2, canvas.height - yPadding);

			context.stroke();

			arrow(context, 20, 200, 380, 200, true, true);
			arrow(context, 200, 380, 200, 20, true, true);

			var zadnjiDve = canvas.id.slice(-2).toUpperCase();

			var prvaOsPos = zadnjiDve[1];
			var prvaOsNeg = "-" + zadnjiDve[1];

			var drugaOsPos = zadnjiDve[0];
			var drugaOsNeg = "-" + zadnjiDve[0];

			// XY
			if (prvaOsPos === "Y" && drugaOsPos === "X") {
				prvaOsPos = "-X";
				prvaOsNeg = "X";
				drugaOsPos = "-Y";
				drugaOsNeg = "Y";
			}

			// YZ
			if (prvaOsPos === "Z" && drugaOsPos === "Y") {
				drugaOsPos = "-Y";
				drugaOsNeg = "Y";
			}

			context.fillStyle = "black";
			context.font = "bold 16px Arial";
			context.fillText(prvaOsPos, 200 - 5, 20 - 5);
			context.fillStyle = "black";
			context.font = "bold 16px Arial";
			context.fillText(prvaOsNeg, 200 - 5, 380 + 15);

			context.fillStyle = "black";
			context.font = "bold 16px Arial";
			context.fillText(drugaOsPos, 20 - 15, 200 + 5);
			context.fillStyle = "black";
			context.font = "bold 16px Arial";
			context.fillText(drugaOsNeg, 380, 200 + 5);

			context.stroke();
		}

		//stackoverflow: http://jsfiddle.net/m1erickson/Sg7EZ/
		function arrow(ctx, x1, y1, x2, y2, start, end) {
			var dx = x2 - x1;
			var dy = y2 - y1;
			var rot = -Math.atan2(dx, dy);
			var len = Math.sqrt(dx * dx + dy * dy);
			var arrowHeadLen = 10;
			ctx.save();
			ctx.translate(x1, y1);
			ctx.rotate(rot);
			ctx.beginPath();
			ctx.moveTo(0, start ? arrowHeadLen : 0);
			ctx.lineTo(0, len - (end ? arrowHeadLen : 0));
			ctx.stroke();
			if (end) {
				ctx.save();
				ctx.translate(0, len);
				arrowHead(ctx);
				ctx.restore();
			}
			if (start) {
				ctx.rotate(Math.PI);
				arrowHead(ctx);
			}
			ctx.restore();
		}

		//stackoverflow: http://jsfiddle.net/m1erickson/Sg7EZ/
		function arrowHead(ctx) {
			ctx.beginPath();
			ctx.moveTo(0, 0);
			ctx.lineTo(-5, -12);
			ctx.lineTo(5, -12);
			ctx.closePath();
			ctx.fill();
		}

		function objectEquals(x, y) {

			if (x === null || x === undefined || y === null || y === undefined) { return x === y; }
			// after this just checking type of one would be enough
			if (x.constructor !== y.constructor) { return false; }
			// if they are functions, they should exactly refer to same one (because of closures)
			if (x instanceof Function) { return x === y; }
			// if they are regexps, they should exactly refer to same one (it is hard to better equality check on current ES)
			if (x instanceof RegExp) { return x === y; }
			if (x === y || x.valueOf() === y.valueOf()) { return true; }
			if (Array.isArray(x) && x.length !== y.length) { return false; }

			// if they are dates, they must had equal valueOf
			if (x instanceof Date) { return false; }

			// if they are strictly equal, they both need to be object at least
			if (!(x instanceof Object)) { return false; }
			if (!(y instanceof Object)) { return false; }

			// recursive object equality check
			var p = Object.keys(x);
			return Object.keys(y).every(function (i) { return p.indexOf(i) !== -1; }) &&
			p.every(function (i) { return objectEquals(x[i], y[i]); });

		}

		function drawTorqueBackground(canvas) {
			console.log("drawTorqueBackground();");
			var context = canvas.getContext("2d");
			context.clearRect(0, 0, canvas.width, canvas.height); // najprej vse pobrisi

			var imageGauge = graphicsLoaderService.getGauge();

			context.drawImage(imageGauge, 0, 0, imageGauge.width, imageGauge.height, xPadding, yPadding, canvas.width - 2 * xPadding, canvas.height - 2 * yPadding);

			var offsetX = 0.5;   // center x
			var offsetY = 0.5;   // center y
			//drawImageProp(context, imageGauge, 0, 0, canvas.width - 2 * xPadding, canvas.height - 2 * yPadding, offsetX, offsetY);

			context.fillStyle = "black";
			context.font = "bold 24px Arial";
			context.fillText("0 Nm", 20, 360);
			context.fillStyle = "black";
			context.font = "bold 24px Arial";
			context.fillText("100 Nm", 310, 360);
			context.stroke();
		}

		function drawTimelineBackground(canvas) {
			console.log("drawTimelineBackground();");
			var context = canvas.getContext("2d");
			context.clearRect(0, 0, canvas.width, canvas.height); // najprej vse pobrisi

			context.strokeStyle = "#000000";
			context.translate(0.5, 0.5); // za thin crte
			context.lineWidth = 1;

			context.beginPath();
			context.moveTo(xPadding, yPadding);
			context.lineTo(xPadding, canvas.height - yPadding);
			context.lineTo(canvas.width - xPadding, canvas.height - yPadding);
			context.lineTo(canvas.width - xPadding, yPadding);
			context.lineTo(xPadding, yPadding);

			var visinaKvadrata = canvas.height - 2 * yPadding;
			var sirinaKvadrata = canvas.width - 2 * xPadding;

			context.fillStyle = "black";
			context.font = "bold 16px Arial";
			context.fillText("X", 5, yPadding + (1 / 3) * visinaKvadrata - visinaKvadrata / 6 + 5);

			context.moveTo(xPadding, yPadding + (1 / 3) * visinaKvadrata);
			context.lineTo(xPadding + sirinaKvadrata, yPadding + (1 / 3) * visinaKvadrata);

			context.fillStyle = "black";
			context.font = "bold 16px Arial";
			context.fillText("Y", 5, yPadding + (2 / 3) * visinaKvadrata - visinaKvadrata / 6 + 5);

			context.moveTo(xPadding, yPadding + (2 / 3) * visinaKvadrata);
			context.lineTo(xPadding + sirinaKvadrata, yPadding + (2 / 3) * visinaKvadrata);

			context.fillStyle = "black";
			context.font = "bold 16px Arial";
			context.fillText("Z", 5, yPadding + visinaKvadrata - visinaKvadrata / 6 + 5);

			context.stroke();

			arrow(context, 20, yPadding + (1 / 3) * visinaKvadrata, 380, yPadding + (1 / 3) * visinaKvadrata, false, true);
			arrow(context, 20, yPadding + (2 / 3) * visinaKvadrata, 380, yPadding + (2 / 3) * visinaKvadrata, false, true);
			arrow(context, 20, yPadding + visinaKvadrata, 380, yPadding + visinaKvadrata, false, true);

			arrow(context, 20, yPadding + (1 / 3) * visinaKvadrata, 20, yPadding, true, true);
			arrow(context, 20, yPadding + (2 / 3) * visinaKvadrata, 20, yPadding + (1 / 3) * visinaKvadrata, true, true);
			arrow(context, 20, yPadding + visinaKvadrata, 20, yPadding + (2 / 3) * visinaKvadrata, true, true);

			context.stroke();
		}

		function goToDefaultModalState() {
			$state.go("default.modal");
		}



		function applyHeightDataToPlane(plane) {
			console.log("In applyHeightDataToPlane()");

			var data = graphicsLoaderService.getHeightMap();

			//set height of vertices
			for (var i = 0, length = plane.geometry.vertices.length; i < length; i++) {
				plane.geometry.vertices[i].z = data[i] * 22;
			}

			plane.geometry.computeFaceNormals();
			plane.geometry.computeVertexNormals();
		}

		function initSplineCurve(frames, colour) {

			var numPoints = 10000;
			var seznam = [];

			for (let x in frames) {
				for (let y of frames[x]) {
					seznam.push(new THREE.Vector3().fromArray(y.value));
				}
			}
			var spline = new THREE.CatmullRomCurve3(seznam);

			var geometry = new THREE.Geometry();
			var splinePoints = spline.getPoints(numPoints);
			for(let i = 0, length = splinePoints.length; i < length; i++) {
				geometry.vertices.push(splinePoints[i]);
			}

			var line = new MeshLine();
			var debelinaCevi = 12;
			line.setGeometry(geometry, function(p) {
				return debelinaCevi;
			});

			var material = new MeshLineMaterial({
				color: new THREE.Color(colour)
			});

			var mesh = new THREE.Mesh(line.geometry, material);

			return mesh;
		}

		function drawOnSplineCurve(startFrame, endFrame, frames, spline, progress, flag) { // ne deluje ok
			if (flag && endFrame > 0) {
				if (endFrame < frames.length) { // interpolacija

					var wholeTimeDif = frames[frames.length - 1].timestamp;
					var ratio = progress / wholeTimeDif;

					// spline.scale.x = ratio;
					// spline.scale.y = ratio;
					// spline.scale.z = ratio;


				}
			}
		}
		//console.log("At the end of DefaultController");
	}

})();

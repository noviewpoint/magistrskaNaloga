(function() {
	"use strict";

	angular
		.module("movementVisualizer")
		.service("graphicsLoaderService", graphicsLoaderService);

	graphicsLoaderService.$inject = [];

	/**
	 * @ngdoc service
	 * @name movementVisualizer.service:graphicsLoaderService
	 * @description
	 * Service, ki nalaga slike in grafične objekte s THREE.JS knjižnico.
	 */
	function graphicsLoaderService() {
		//console.log("graphicsLoaderService();");

		// Revealing Module Pattern
		var club = new MySpecialObject(THREE.Object3D);
		var golfBall = new MySpecialObject(THREE.Object3D);
		var footBall = new MySpecialObject(THREE.Object3D);
		var human = new MySpecialObject(THREE.Object3D);
		var gauge = new MySpecialObject(Image);
		var heightMap = new MySpecialObject(Image);
		var grassTextures = new MySpecialObject(TextureSet);

		// not returned objects
		var clubTexture = new MySpecialObject(THREE.Texture);
		var humanTexture = new MySpecialObject(THREE.Texture);
		var promises = [];

		// https://threejs.org/docs/index.html#api/loaders/managers/LoadingManager
		var manager = new THREE.LoadingManager();
		manager.onStart = function(url, itemsLoaded, itemsTotal) {
			console.log("Started loading files:");
			//console.log("Loading file:" + url + "\nLoaded " + itemsLoaded + " of " + itemsTotal + " files");
		};
		manager.onLoad = function() {
			console.log("Loading complete");
		};
		manager.onProgress = function(url, itemsLoaded, itemsTotal) {
			console.log("Recently finished loading " + url + "\nLoaded " + itemsLoaded + " of " + itemsTotal + " files");
		};
		manager.onError = function(url) {
			console.log("There was an error loading file: " + url);
		};

		// https://threejs.org/docs/index.html#api/loaders/ImageLoader
		var imageLoader = new THREE.ImageLoader(manager);
		// https://threejs.org/docs/index.html#api/loaders/ObjectLoader
		var objectLoader = new THREE.OBJLoader(manager);
		// https://threejs.org/docs/index.html#api/loaders/JSONLoader
		var jsonLoader = new THREE.JSONLoader(manager);
		// https://threejs.org/docs/index.html#api/loaders/BufferGeometryLoader
		var bufferGeometryLoader = new THREE.BufferGeometryLoader(manager);
		// https://threejs.org/docs/index.html#api/loaders/TextureLoader
		var textureLoader = new THREE.TextureLoader(manager);

		// ustvarjanje objektov s konstruktorjem, lastnosti vsakega ustvarjenega objekta kazejo v isti koscek rama
		function MySpecialObject(constructor) {
			this.val = new constructor()
		}
		function TextureSet() {

		}
		// https://developers.google.com/speed/articles/optimizing-javascript
		// avoid unnecessarily running the initialization code each time the constructor is called
		TextureSet.prototype.map = new THREE.Texture();
		TextureSet.prototype.bumpMap = new THREE.Texture();
		TextureSet.prototype.specularMap = new THREE.Texture();
		TextureSet.prototype.normalMap = new THREE.Texture();
		TextureSet.prototype.displacementMap = new THREE.Texture();
		TextureSet.prototype.aoMap = new THREE.Texture();


		/* ------------------------------- CLUB IMAGE ------------------------------------------- */
		/* -------------------------------------------------------------------------------------- */
		promises.push(genericPromise(imageLoader, "obj/pool_stick_diffuse_no_ao.jpg", clubTexture.val, "image"));


		/* ------------------------------- HUMAN IMAGE ------------------------------------------ */
		/* -------------------------------------------------------------------------------------- */
		promises.push(genericPromise(imageLoader, "obj/MarineCv2_color.jpg", humanTexture.val, "image"));


		/* ------------------------------- HEIGHT MAP ------------------------------------------- */
		/* -------------------------------------------------------------------------------------- */
		promises.push(genericPromise(imageLoader, "img/terra/terrain2.jpg", heightMap.val, "image"));


		/* ------------------------------ GRASS TEXTURES ---------------------------------------- */
		/* -------------------------------------------------------------------------------------- */
		promises.push(genericPromise(textureLoader, "img/trava_bitmap_1024x1024.png", grassTextures.val, "map")); //terra/terrain1.jpg
		promises.push(genericPromise(textureLoader, "img/BumpMap.png", grassTextures.val, "bumpMap"));
		promises.push(genericPromise(textureLoader, "img/SpecularMap.png", grassTextures.val, "specularMap"));
		promises.push(genericPromise(textureLoader, "img/NormalMap.png", grassTextures.val, "normalMap"));
		promises.push(genericPromise(textureLoader, "img/DisplacementMap.png", grassTextures.val, "displacementMap"));
		promises.push(genericPromise(textureLoader, "img/AmbientOcclusionMap.png", grassTextures.val, "ambientOcclusionMap"));


		/* ------------------------------- GAUGE IMAGE ------------------------------------------ */
		/* -------------------------------------------------------------------------------------- */
		promises.push(genericPromise(imageLoader, "img/gauge.png", gauge.val, "image"));


		/* ------------------------------- CLUB OBJECT ------------------------------------------ */
		/* -------------------------------------------------------------------------------------- */
		promises.push(new Promise((resolve, reject) => {
			objectLoader.load("obj/iron.obj", objectLoadDone, onProgress, onError);
			function objectLoadDone(x) {
				console.log("iron.obj successfully loaded");

				x.traverse(function(child) {
					if (child instanceof THREE.Mesh) {
						clubTexture.val.needsUpdate = true; // https://threejs.org/docs/#manual/introduction/How-to-update-things
						child.material.map = clubTexture.val;

						child.geometry.computeBoundingBox();
						var size = child.geometry.boundingBox.getSize();
						// da bo origin child objekta palice povsem na dnu palice
						child.geometry.translate(0, 0, size.z / 2);
						// ce ne izvedes translacije, origin ostane v sredini palice (rotacija se izvaja okoli sredisca palice)
						// pozicijo palice nastavljaj tako, da parentu (to je x) premikas position - to ze itak delas v DefaultController

						child.castShadow = true;
						child.receiveShadow = true;
					}
				});

				club.val = x;
				resolve("ok"); // uspesen resolve
			}
		}));
		/* tudi ce se objekt nalozi prej kot image, se objekt naknadno pravilno posodobi s sliko */


		/* ---------------------------- GOLF BALL OBJECT ---------------------------------------- */
		/* -------------------------------------------------------------------------------------- */
		promises.push(new Promise((resolve, reject) => {
			textureLoader.load("obj/golfZoga.jpg", textureLoadDone, onProgress, onError);
			function textureLoadDone(x) {
				var geometry = new THREE.SphereGeometry(20, 32, 32);

				x.wrapS = x.wrapT = THREE.RepeatWrapping;
				x.offset.set(0, 0);
				x.repeat.set(2, 2);

				var material = new THREE.MeshLambertMaterial({
					map: x
				})

				golfBall = new THREE.Mesh(geometry, material);
				resolve("ok"); // uspesen resolve
			}
		}));

		/* ------------------------------ FOOT BALL OBJECT -------------------------------------- */
		/* -------------------------------------------------------------------------------------- */
		promises.push(new Promise((resolve, reject) => {
			textureLoader.load("obj/fuzbalZoga.png", textureLoadDone, onProgress, onError);
			function textureLoadDone(x) {
				var geometry = new THREE.SphereGeometry(100, 32, 15);

				// GLSL inside javascript (ES6 literals)
				var vertexShaderSource = `
					varying vec3 vNormal;
					void main() {
						vNormal = normal;
						gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
					}
				`;

				var fragmentShaderSource = `
					uniform sampler2D texture;
					varying vec3 vNormal;
					void main() {
						vec2 uv = normalize( vNormal ).xy * 0.5 + 0.5;
						vec3 color = texture2D( texture, uv ).rgb;
						gl_FragColor = vec4( color, 1.0 );
					}
				`;

				var uniforms = {
					"texture": {
						type: "t",
						value: x
					}
				};
				var material = new THREE.ShaderMaterial({
					uniforms: uniforms,
					vertexShader: vertexShaderSource,
					fragmentShader: fragmentShaderSource
				});

				footBall = new THREE.Mesh(geometry, material);
				resolve("ok"); // uspesen resolve
			}
		}));


		/* ------------------------------ HUMAN OBJECT ------------------------------------------ */
		/* -------------------------------------------------------------------------------------- */
		promises.push(new Promise((resolve, reject) => {
			jsonLoader.load("obj/marinec.json", jsonLoadDone, onProgress, onError);
			function jsonLoadDone(geometry, materials) {
				console.log("obj/marinec.json successfully loaded");

				geometry.computeFaceNormals();
				geometry.computeVertexNormals();
				humanTexture.val.needsUpdate = true; // https://threejs.org/docs/#manual/introduction/How-to-update-things
				var material = new THREE.MeshPhongMaterial({
					map: humanTexture.val,
					//bumpMap: bumpMap,
					//specularMap: specularMap,
					//normalMap: normalMap,
					//displacementMap: displacementMap,
					//aoMap: ambientOcclusionMap,
					side: THREE.FrontSide,
					shading:THREE.SmoothShading,
					opacity: 0,
					vertexColors: THREE.VertexColors
				});
				material.skinning = true;

				human.val = new THREE.SkinnedMesh(geometry, material, false);
				resolve("ok"); // uspesen resolve
			}
		}));

		function genericPromise(loader, url, object, objectProperty) {
			return new Promise((resolve, reject) => {
				loader.load(url, loadDone, onProgress, onError);
				function loadDone(x) {
					console.log(url + " successfully loaded");

					if (objectProperty === undefined) {
						object = x;
					} else {
						object[objectProperty] = x;
					}
					resolve("ok"); // uspesen resolve
				}
			});
		}

		function onProgress(xhr) {
			if (xhr.lengthComputable) {
				var percentComplete = xhr.loaded / xhr.total * 100;
				console.log("Current file " + Math.round(percentComplete, 2) + "% loaded");
			}
		}

		function onError(xhr) {
			console.log("Error:", xhr);
		}

		/*This function returns an array with all the pixels of an image
		converted into a value. If the scale value is set to 1, you will get
		values from 1 (black) to 63,75 (white).*/
		function readDataFromImage(img, scale) {
			console.log("In readDataFromImage()");

			if (scale === undefined) {
				scale = 1;
			}

			var width = img.width;
			var height = img.height;

			var canvas = document.createElement("canvas");
			canvas.width = width;
			canvas.height = height;
			var context = canvas.getContext("2d");

			var size = width * height;
			var data = new Float32Array(size);

			context.drawImage(img, 0, 0);

			for (var i = 0; i < size; i++) {
				data[i] = 0;
			}

			var imgd = context.getImageData(0, 0, width, height);
			var pix = imgd.data;

			var j = 0;
			for (var i = 0, length = pix.length; i < length; i += 4) {
				var all = pix[i] + pix[i + 1] + pix[i + 2];
				data[j++] = all / (12 * scale);
			}

			return data;
		}

		return {
			returnAllPromises: returnAllPromises,
			getClub: getClub,
			getFootBall: getFootBall,
			getGolfBall: getGolfBall,
			getHuman: getHuman,
			getGauge: getGauge,
			getGrass: getGrass,
			getHeightMap: getHeightMap
		}

		function returnAllPromises() {
			return Promise.all(promises);
		}

		function getClub() {
			return club.val.clone(); // clone() prekine referenco
		}

		function getFootBall() {
			return footBall.clone(); // clone() prekine referenco
		}

		function getGolfBall() {
			return golfBall.clone(); // clone() prekine referenco
		}

		function getHuman() {
			return human.val.clone(); // clone() prekine referenco
		}

		function getGauge() {
			return gauge.val.image;
		}

		function getGrass() {
			return grassTextures.val;
		}

		function getHeightMap() {
			return readDataFromImage(heightMap.val.image);
		}

	}

})();

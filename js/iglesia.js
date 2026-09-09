import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const container = document.getElementById("viewer");
const loaderEl = document.getElementById("loader");
const btnReset = document.getElementById("btnReset");
const btnAuto = document.getElementById("btnAuto");
const btnWire = document.getElementById("btnWire");

if (!container) {
  console.error("ERROR CRITICO: No se encontro el elemento #viewer en el DOM");
} else {
  console.log("Contenedor #viewer encontrado. Iniciando aplicacion 3D...");
  initViewer();
}

function initViewer() {

  let scene, camera, renderer, controls, loader;

  let iglesiaModel = null;
  let autoRotate = true;
  let wireframeMode = false;
  let isLoaded = false;

  const clock = new THREE.Clock();

  function setupScene() {

    scene = new THREE.Scene();

    scene.background = new THREE.Color(0x0b1220);

    scene.fog = new THREE.Fog(
      0x0b1220,
      40,
      120
    );
  }

  function setupCamera() {

    camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    camera.position.set(
      65,
      38,
      65
    );

    camera.lookAt(
      0,
      2,
      0
    );
  }

  function setupRenderer() {

    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });

    renderer.setSize(
      window.innerWidth,
      window.innerHeight
    );

    renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio,
        2
      )
    );

    renderer.outputColorSpace =
      THREE.SRGBColorSpace;

    renderer.toneMapping =
      THREE.ACESFilmicToneMapping;

    renderer.toneMappingExposure = 1.2;

    renderer.shadowMap.enabled = true;

    renderer.shadowMap.type =
      THREE.PCFSoftShadowMap;

    container.appendChild(
      renderer.domElement
    );
  }

  function setupEnvironment() {

    const pmremGenerator =
      new THREE.PMREMGenerator(
        renderer
      );

    const roomEnvironment =
      new RoomEnvironment();

    scene.environment =
      pmremGenerator
        .fromScene(
          roomEnvironment,
          0.04
        )
        .texture;

    const ambientLight =
      new THREE.AmbientLight(
        0xffffff,
        0.6
      );

    scene.add(
      ambientLight
    );

    const directionalLight =
      new THREE.DirectionalLight(
        0xffffff,
        1.5
      );

    directionalLight.position.set(
      10,
      20,
      10
    );

    directionalLight.castShadow = true;

    directionalLight.shadow.mapSize.width =
      2048;

    directionalLight.shadow.mapSize.height =
      2048;

    scene.add(
      directionalLight
    );

    roomEnvironment.dispose();
    pmremGenerator.dispose();
  }

  function setupControls() {

    controls =
      new OrbitControls(
        camera,
        renderer.domElement
      );

    controls.enableDamping = true;

    controls.dampingFactor = 0.05;

    controls.enableRotate = true;

    controls.rotateSpeed = 0.8;

    controls.enableZoom = true;

    controls.enablePan = false;

    controls.minDistance = 20;

    controls.maxDistance = 110;

    controls.target.set(
      0,
      2,
      0
    );

    controls.update();
  }

  function loadModel() {

    loader =
      new GLTFLoader();

    if (loaderEl) {

      loaderEl.textContent =
        "Cargando iglesia-catavi.glb 42.8MB... 0%";
    }

    loader.load(

      "assets/models/iglesia-catavi.glb",

      function (gltf) {

        console.log(
          "MODELO CARGADO EXITOSAMENTE"
        );

        iglesiaModel =
          gltf.scene;

        iglesiaModel.traverse(
          function (child) {

            if (child.isMesh) {

              child.castShadow = true;

              child.receiveShadow = true;
            }
          }
        );

        const box =
          new THREE.Box3()
            .setFromObject(
              iglesiaModel
            );

        const center =
          box.getCenter(
            new THREE.Vector3()
          );

        iglesiaModel.position.sub(
          center
        );

        scene.add(
          iglesiaModel
        );

        isLoaded = true;

        camera.position.set(
          65,
          38,
          65
        );

        controls.target.set(
          0,
          2,
          0
        );

        controls.update();

        if (loaderEl) {

          loaderEl.textContent =
            "Modelo cargado correctamente!";

          setTimeout(
            () => {

              loaderEl.style.display =
                "none";

            },
            3000
          );
        }
      },

      function (xhr) {

        if (
          loaderEl &&
          xhr.lengthComputable
        ) {

          const percentComplete =
            (xhr.loaded / xhr.total) *
            100;

          const mbLoaded =
            (
              xhr.loaded /
              1048576
            ).toFixed(1);

          loaderEl.textContent =
            `Cargando... ${percentComplete.toFixed(0)}% - ${mbLoaded}MB / 42.8MB`;
        }
      },

      function (error) {

        console.error(
          "ERROR AL CARGAR EL MODELO:",
          error
        );

        if (loaderEl) {

          loaderEl.textContent =
            "ERROR: No se pudo cargar el modelo. Revisa la ruta y la consola F12";

          loaderEl.style.color =
            "#ff4444";
        }
      }
    );
  }

  function setupEventListeners() {

    btnReset?.addEventListener(
      "click",
      function () {

        camera.position.set(
          65,
          38,
          65
        );

        controls.target.set(
          0,
          2,
          0
        );

        controls.update();
      }
    );

    btnAuto?.addEventListener(
      "click",
      function () {

        autoRotate =
          !autoRotate;

        btnAuto.textContent =
          autoRotate
            ? "Detener rotación"
            : "Activar rotación";
      }
    );

    btnWire?.addEventListener(
      "click",
      function () {

        wireframeMode =
          !wireframeMode;

        if (iglesiaModel) {

          iglesiaModel.traverse(
            function (child) {

              if (
                child.isMesh &&
                child.material
              ) {

                if (
                  Array.isArray(
                    child.material
                  )
                ) {

                  child.material.forEach(
                    mat => {

                      mat.wireframe =
                        wireframeMode;
                    }
                  );

                } else {

                  child.material.wireframe =
                    wireframeMode;
                }
              }
            }
          );
        }

        btnWire.textContent =
          wireframeMode
            ? "Modo Sólido"
            : "Wireframe";
      }
    );

    window.addEventListener(
      "resize",
      onWindowResize
    );
  }

  function onWindowResize() {

    camera.aspect =
      window.innerWidth /
      window.innerHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(
      window.innerWidth,
      window.innerHeight
    );
  }

  function animate() {

    requestAnimationFrame(
      animate
    );

    const delta =
      clock.getDelta();

    if (
      autoRotate &&
      isLoaded &&
      iglesiaModel
    ) {

      iglesiaModel.rotation.y +=
        delta * 0.1;
    }

    controls.update();

    renderer.render(
      scene,
      camera
    );
  }

  setupScene();

  setupCamera();

  setupRenderer();

  setupEnvironment();

  setupControls();

  loadModel();

  setupEventListeners();

  animate();
}
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";


// ============================================================
// ELEMENTOS DEL HTML
// ============================================================

const container = document.getElementById("viewer");
const loaderEl = document.getElementById("loader");
const btnReset = document.getElementById("btnReset");
const btnAuto = document.getElementById("btnAuto");
const btnWire = document.getElementById("btnWire");


// ============================================================
// COMPROBAR CONTENEDOR
// ============================================================

if (!container) {

    console.error("ERROR: No se encontró #viewer");

} else {

    console.log("Iniciando Iglesia de Catavi 3D...");

    initViewer();
}


// ============================================================
// VISOR 3D
// ============================================================

function initViewer() {

    let scene;
    let camera;
    let renderer;
    let controls;
    let loader;


    // ========================================================
    // GRUPO PRINCIPAL
    // ========================================================
    //
    // La iglesia y el cura estarán dentro del mismo grupo.
    //
    // Así:
    //
    // iglesiaGroup
    //     ├── iglesia
    //     └── cura
    //
    // Cuando gira iglesiaGroup,
    // ambos giran juntos.
    //
    // ========================================================

    let iglesiaGroup = null;

    let iglesiaModel = null;

    let curaModel = null;


    // ========================================================
    // ANIMACION DEL CURA
    // ========================================================

    let curaMixer = null;

    let curaAnimations = [];

    let tiempoCura = 0;

    let posicionInicialCura =
        new THREE.Vector3();

    let rotacionInicialCura = 0;


    // ========================================================
    // ESTADOS
    // ========================================================

    let autoRotate = true;

    let wireframeMode = false;

    let isLoaded = false;


    const clock =
        new THREE.Clock();


    // ========================================================
    // CONFIGURACION DEL CURA
    // ========================================================
    //
    // PUEDES CAMBIAR ESTOS VALORES DESPUES.
    //
    // ========================================================

    // Izquierda / derecha
    // 0 = centro
    // negativo = izquierda
    // positivo = derecha

    const CURA_X = 0;


    // Distancia delante de la puerta.
    //
    // 0.01 = muy cerca
    // 0.03 = cerca
    // 0.05 = unos pasos
    // 0.08 = más adelante

    const CURA_DISTANCIA = 0.015;


    // Tamaño del cura.
    //
    // 0.25 = pequeño
    // 0.30 = normal
    // 0.35 = grande

    const CURA_ALTURA = 0.30;


    // ========================================================
    // ESCENA
    // ========================================================

    function setupScene() {

        scene =
            new THREE.Scene();

        scene.background =
            new THREE.Color(0x0b1220);

        scene.fog =
            new THREE.Fog(
                0x0b1220,
                40,
                120
            );
    }


    // ========================================================
    // CAMARA
    // ========================================================

    function setupCamera() {

        camera =
            new THREE.PerspectiveCamera(
                45,
                window.innerWidth /
                window.innerHeight,
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


    // ========================================================
    // RENDERER
    // ========================================================

    function setupRenderer() {

        renderer =
            new THREE.WebGLRenderer({
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

        renderer.toneMappingExposure =
            1.2;

        renderer.shadowMap.enabled =
            true;

        renderer.shadowMap.type =
            THREE.PCFSoftShadowMap;

        container.appendChild(
            renderer.domElement
        );
    }


    // ========================================================
    // ILUMINACION
    // ========================================================

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

        directionalLight.castShadow =
            true;

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


    // ========================================================
    // CONTROLES
    // ========================================================

    function setupControls() {

        controls =
            new OrbitControls(
                camera,
                renderer.domElement
            );

        controls.enableDamping =
            true;

        controls.dampingFactor =
            0.05;

        controls.enableRotate =
            true;

        controls.rotateSpeed =
            0.8;

        controls.enableZoom =
            true;

        controls.enablePan =
            false;

        controls.minDistance =
            20;

        controls.maxDistance =
            110;

        controls.target.set(
            0,
            2,
            0
        );

        controls.update();
    }


    // ========================================================
    // CREAR GRUPO
    // ========================================================

    function crearGrupoIglesia() {

        iglesiaGroup =
            new THREE.Group();

        iglesiaGroup.name =
            "IglesiaConCura";

        scene.add(
            iglesiaGroup
        );
    }


    // ========================================================
    // CARGAR IGLESIA
    // ========================================================

    function loadModels() {

        loader =
            new GLTFLoader();


        if (loaderEl) {

            loaderEl.style.display =
                "block";

            loaderEl.style.color =
                "";

            loaderEl.textContent =
                "Cargando Iglesia de Catavi...";
        }


        loader.load(

            "assets/models/iglesia-catavi.glb",


            // =================================================
            // IGLESIA CARGADA
            // =================================================

            function (gltf) {

                console.log(
                    "IGLESIA CARGADA CORRECTAMENTE"
                );


                iglesiaModel =
                    gltf.scene;


                // ---------------------------------------------
                // SOMBRAS
                // ---------------------------------------------

                iglesiaModel.traverse(
                    function (child) {

                        if (child.isMesh) {

                            child.castShadow =
                                true;

                            child.receiveShadow =
                                true;
                        }
                    }
                );


                // ---------------------------------------------
                // CENTRAR MODELO
                // ---------------------------------------------

                const boxOriginal =
                    new THREE.Box3()
                        .setFromObject(
                            iglesiaModel
                        );


                const center =
                    boxOriginal.getCenter(
                        new THREE.Vector3()
                    );


                iglesiaModel.position.sub(
                    center
                );


                // ---------------------------------------------
                // AGREGAR IGLESIA AL GRUPO
                // ---------------------------------------------

                iglesiaGroup.add(
                    iglesiaModel
                );


                isLoaded = true;


                // ---------------------------------------------
                // CAMARA
                // ---------------------------------------------

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


                // ---------------------------------------------
                // CARGAR CURA
                // ---------------------------------------------

                cargarCura();
            },


            // =================================================
            // PROGRESO
            // =================================================

            function (xhr) {

                if (
                    loaderEl &&
                    xhr.lengthComputable
                ) {

                    const porcentaje =
                        (
                            xhr.loaded /
                            xhr.total
                        ) * 100;


                    const mb =
                        (
                            xhr.loaded /
                            1048576
                        ).toFixed(1);


                    loaderEl.textContent =
                        `Cargando iglesia... ${porcentaje.toFixed(0)}% - ${mb} MB`;
                }
            },


            // =================================================
            // ERROR
            // =================================================

            function (error) {

                console.error(
                    "ERROR AL CARGAR IGLESIA:",
                    error
                );


                if (loaderEl) {

                    loaderEl.textContent =
                        "ERROR: No se pudo cargar la iglesia";

                    loaderEl.style.color =
                        "#ff4444";
                }
            }
        );
    }


    // ========================================================
    // CARGAR CURA
    // ========================================================

    function cargarCura() {

        console.log(
            "Intentando cargar assets/models/cura.glb..."
        );


        loader.load(

            "assets/models/cura.glb",


            // =================================================
            // CURA CARGADO
            // =================================================

            function (gltf) {

                console.log(
                    "=================================="
                );

                console.log(
                    "CURA CARGADO CORRECTAMENTE"
                );

                console.log(
                    "Animaciones:",
                    gltf.animations.length
                );

                console.log(
                    "=================================="
                );


                curaModel =
                    gltf.scene;


                curaAnimations =
                    gltf.animations || [];


                // ---------------------------------------------
                // SOMBRAS
                // ---------------------------------------------

                curaModel.traverse(
                    function (child) {

                        if (child.isMesh) {

                            child.castShadow =
                                true;

                            child.receiveShadow =
                                true;
                        }
                    }
                );


                // =================================================
                // OBTENER TAMAÑO DE IGLESIA
                // =================================================

                const iglesiaBox =
                    new THREE.Box3()
                        .setFromObject(
                            iglesiaModel
                        );


                const iglesiaSize =
                    iglesiaBox.getSize(
                        new THREE.Vector3()
                    );


                // =================================================
                // OBTENER TAMAÑO DEL CURA
                // =================================================

                let curaBox =
                    new THREE.Box3()
                        .setFromObject(
                            curaModel
                        );


                let curaSize =
                    curaBox.getSize(
                        new THREE.Vector3()
                    );


                console.log(
                    "Tamaño iglesia:",
                    iglesiaSize
                );


                console.log(
                    "Tamaño cura original:",
                    curaSize
                );


                // =================================================
                // ESCALAR CURA
                // =================================================

                const alturaDeseada =
                    iglesiaSize.y *
                    CURA_ALTURA;


                const escala =
                    alturaDeseada /
                    curaSize.y;


                curaModel.scale.set(
                    escala,
                    escala,
                    escala
                );


                // =================================================
                // ACTUALIZAR BOUNDING BOX
                // =================================================

                curaBox =
                    new THREE.Box3()
                        .setFromObject(
                            curaModel
                        );


                curaSize =
                    curaBox.getSize(
                        new THREE.Vector3()
                    );


                // =================================================
                // IMPORTANTE:
                // CALCULAMOS POSICION LOCAL
                // =================================================

                //
                // Como el cura será hijo de iglesiaGroup,
                // estas son coordenadas LOCALES.
                //
                // Ya NO usamos las coordenadas del mundo.
                //
                // =================================================


                // ---------------------------------------------
                // X
                // ---------------------------------------------

                const posicionX =
                    CURA_X *
                    iglesiaSize.x;


                // ---------------------------------------------
                // Y
                // ---------------------------------------------
                //
                // Hace que los pies toquen el suelo.
                //
                // ---------------------------------------------

                const AJUSTE_ALTURA_CURA = 0.00;

                const posicionY =
                iglesiaBox.min.y -
                curaBox.min.y +
                AJUSTE_ALTURA_CURA;


                // ---------------------------------------------
                // Z
                // ---------------------------------------------
                //
                // El cura queda delante de la fachada.
                //
                // ---------------------------------------------

                const posicionZ =
                    iglesiaBox.max.z +
                    (
                        iglesiaSize.z *
                        CURA_DISTANCIA
                    );


                // =================================================
                // AGREGAR CURA AL MISMO GRUPO
                // =================================================

                iglesiaGroup.add(
                    curaModel
                );


                // =================================================
                // POSICION
                // =================================================

                curaModel.position.set(
                    posicionX,
                    posicionY,
                    posicionZ
                );


                // =================================================
                // ORIENTACION
                // =================================================

                //
                // El cura mira hacia la iglesia.
                //
                // Si posteriormente queremos que mire a
                // la cámara, cambiamos solamente esta parte.
                //
                // =================================================

                curaModel.rotation.set(
                    0,
                    Math.PI,
                    0
                );


                // =================================================
                // GUARDAR POSICION
                // =================================================

                posicionInicialCura =
                    curaModel.position.clone();


                rotacionInicialCura =
                    curaModel.rotation.y;


                // =================================================
                // ANIMACIONES DEL GLB
                // =================================================

                if (
                    curaAnimations.length > 0
                ) {

                    console.log(
                        "El modelo contiene animaciones."
                    );


                    curaMixer =
                        new THREE.AnimationMixer(
                            curaModel
                        );


                    const accion =
                        curaMixer.clipAction(
                            curaAnimations[0]
                        );


                    accion.reset();

                    accion.setLoop(
                        THREE.LoopRepeat,
                        Infinity
                    );

                    accion.play();


                } else {

                    console.log(
                        "El modelo no contiene animaciones."
                    );

                    console.log(
                        "Se utilizará movimiento procedural."
                    );
                }


                // =================================================
                // INFORMACION
                // =================================================

                console.log(
                    "Posicion local del cura:",
                    curaModel.position
                );

                console.log(
                    "Escala del cura:",
                    escala
                );


                // =================================================
                // MENSAJE
                // =================================================

                if (loaderEl) {

                    loaderEl.textContent =
                        "Iglesia y cura cargados correctamente";

                    setTimeout(
                        function () {

                            loaderEl.style.display =
                                "none";

                        },
                        2500
                    );
                }
            },


            // =================================================
            // PROGRESO CURA
            // =================================================

            function (xhr) {

                if (
                    loaderEl &&
                    xhr.lengthComputable
                ) {

                    const porcentaje =
                        (
                            xhr.loaded /
                            xhr.total
                        ) * 100;


                    loaderEl.textContent =
                        `Cargando sacerdote... ${porcentaje.toFixed(0)}%`;
                }
            },


            // =================================================
            // ERROR CURA
            // =================================================

            function (error) {

                console.error(
                    "=================================="
                );

                console.error(
                    "ERROR AL CARGAR cura.glb"
                );

                console.error(
                    error
                );

                console.error(
                    "=================================="
                );


                if (loaderEl) {

                    loaderEl.textContent =
                        "La iglesia cargó, pero cura.glb no pudo cargarse";

                    loaderEl.style.color =
                        "#ffaa44";
                }
            }
        );
    }


    // ========================================================
    // ANIMACION DEL CURA
    // ========================================================

    function animarCura(delta) {

        if (!curaModel) {
            return;
        }


        // ====================================================
        // SI EL GLB TIENE ANIMACION
        // ====================================================

        if (curaMixer) {

            curaMixer.update(
                delta
            );

            return;
        }


        // ====================================================
        // ANIMACION PROPIA
        // ====================================================

        tiempoCura +=
            delta;


        // ----------------------------------------------------
        // MOVIMIENTO LATERAL
        // ----------------------------------------------------

        const movimiento =
            Math.sin(
                tiempoCura * 0.7
            ) * 0.35;


        curaModel.position.x =
            posicionInicialCura.x +
            movimiento;


        // ----------------------------------------------------
        // PEQUEÑO MOVIMIENTO
        // ----------------------------------------------------

        const balanceo =
            Math.sin(
                tiempoCura * 1.4
            ) * 0.025;


        curaModel.position.y =
            posicionInicialCura.y +
            Math.abs(balanceo);


        // ====================================================
        // MIRAR DE UN LADO A OTRO
        // ====================================================

        const giro =
            Math.sin(
                tiempoCura * 0.55
            ) * 0.35;


        curaModel.rotation.y =
            rotacionInicialCura +
            giro;


        // ====================================================
        // REVERENCIA
        // ====================================================

        const ciclo =
            tiempoCura % 10;


        if (
            ciclo >= 5 &&
            ciclo <= 7
        ) {

            const progreso =
                (ciclo - 5) / 2;


            const reverencia =
                Math.sin(
                    progreso *
                    Math.PI
                ) * 0.20;


            curaModel.rotation.x =
                reverencia;

        } else {

            curaModel.rotation.x =
                0;
        }
    }


    // ========================================================
    // EVENTOS
    // ========================================================

    function setupEventListeners() {


        // ====================================================
        // RESET
        // ====================================================

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


        // ====================================================
        // ROTACION
        // ====================================================

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


        // ====================================================
        // WIREFRAME
        // ====================================================

        btnWire?.addEventListener(
            "click",
            function () {

                wireframeMode =
                    !wireframeMode;


                cambiarWireframe(
                    iglesiaModel,
                    wireframeMode
                );


                cambiarWireframe(
                    curaModel,
                    wireframeMode
                );


                btnWire.textContent =
                    wireframeMode
                        ? "Modo Sólido"
                        : "Wireframe";
            }
        );


        // ====================================================
        // RESIZE
        // ====================================================

        window.addEventListener(
            "resize",
            onWindowResize
        );
    }


    // ========================================================
    // WIREFRAME
    // ========================================================

    function cambiarWireframe(
        modelo,
        activar
    ) {

        if (!modelo) {
            return;
        }


        modelo.traverse(
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
                            function (material) {

                                material.wireframe =
                                    activar;
                            }
                        );

                    } else {

                        child.material.wireframe =
                            activar;
                    }
                }
            }
        );
    }


    // ========================================================
    // RESIZE
    // ========================================================

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


    // ========================================================
    // ANIMACION PRINCIPAL
    // ========================================================

    function animate() {

        requestAnimationFrame(
            animate
        );


        const delta =
            clock.getDelta();


        // ----------------------------------------------------
        // CURA
        // ----------------------------------------------------

        animarCura(
            delta
        );


        // ----------------------------------------------------
        // IGLESIA + CURA
        // ----------------------------------------------------

        if (
            autoRotate &&
            isLoaded &&
            iglesiaGroup
        ) {

            iglesiaGroup.rotation.y +=
                delta * 0.1;
        }


        // ----------------------------------------------------
        // CONTROLES
        // ----------------------------------------------------

        controls.update();


        // ----------------------------------------------------
        // RENDER
        // ----------------------------------------------------

        renderer.render(
            scene,
            camera
        );
    }


    // ========================================================
    // INICIAR
    // ========================================================

    setupScene();

    setupCamera();

    setupRenderer();

    setupEnvironment();

    setupControls();

    crearGrupoIglesia();

    loadModels();

    setupEventListeners();

    animate();
}
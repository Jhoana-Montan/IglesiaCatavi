
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

// ======================================================
// ELEMENTOS HTML
// ======================================================

const container = document.querySelector("#viewer");
const loaderText = document.querySelector("#loader");
const infoCard = document.querySelector("#infoCard");
const infoTitle = document.querySelector("#infoTitle");
const infoText = document.querySelector("#infoText");
const closeInfo = document.querySelector("#closeInfo");

const btnReset = document.querySelector("#btnReset");
const btnAuto = document.querySelector("#btnAuto");
const btnLight = document.querySelector("#btnLight");
const btnVirgen = document.querySelector("#btnVirgen");
const btnWalk = document.querySelector("#btnWalk");
const btnTour = document.querySelector("#btnTour");
const btnPhoto = document.querySelector("#btnPhoto");
const btnFull = document.querySelector("#btnFull");
const btnMenu = document.querySelector("#btnMenu");
const walkHelp = document.querySelector("#walkHelp");

if (!container) {
    throw new Error("No se encontró el elemento #viewer en modelo3d.html");
}

// ======================================================
// ESCENA Y CÁMARA
// ======================================================

const scene = new THREE.Scene();
scene.background = new THREE.Color("#080d18");
scene.fog = new THREE.FogExp2("#080d18", 0.008);

const camera = new THREE.PerspectiveCamera(
    42,
    window.innerWidth / window.innerHeight,
    0.1,
    2000
);

camera.position.set(12, 8, 15);

const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "high-performance"
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.32;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

container.appendChild(renderer.domElement);

// ======================================================
// EFECTOS VISUALES
// ======================================================

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.34,
    0.55,
    0.78
);

composer.addPass(bloom);
composer.addPass(new OutputPass());

// ======================================================
// ILUMINACIÓN Y ENTORNO
// ======================================================

const pmrem = new THREE.PMREMGenerator(renderer);
const environment = pmrem.fromScene(new RoomEnvironment(), 0.04);
scene.environment = environment.texture;
pmrem.dispose();

scene.add(
    new THREE.HemisphereLight(0xdce9ff, 0x554638, 2.0)
);

const keyLight = new THREE.DirectionalLight(0xffe6b5, 3.4);
keyLight.position.set(-8, 14, 10);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -25;
keyLight.shadow.camera.right = 25;
keyLight.shadow.camera.top = 25;
keyLight.shadow.camera.bottom = -25;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x8ebdff, 1.8);
fillLight.position.set(10, 8, -10);
scene.add(fillLight);

const rimLight = new THREE.SpotLight(
    0xffd477,
    110,
    100,
    Math.PI / 5,
    0.55,
    1.2
);

rimLight.position.set(0, 20, -12);
rimLight.target.position.set(0, 3, 0);
scene.add(rimLight, rimLight.target);

const frontLight = new THREE.PointLight(0xffe2ac, 42, 50, 2);
frontLight.position.set(0, 5, 12);
scene.add(frontLight);

// Luz dedicada a la Virgen.
// Aporta detalle sin exagerar el brillo del modelo.
const virginLight = new THREE.SpotLight(
    0xffe5ad,
    24,
    40,
    Math.PI / 4,
    0.55,
    1.4
);

virginLight.position.set(0, 8, 8);
virginLight.target.position.set(0, 2, 0);
virginLight.visible = false;
scene.add(virginLight, virginLight.target);

// ======================================================
// SUELO
// ======================================================

const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(500, 500),
    new THREE.MeshStandardMaterial({
        color: 0x111a28,
        roughness: 0.88,
        metalness: 0.05
    })
);

ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.03;
ground.receiveShadow = true;
scene.add(ground);

// ======================================================
// CONTROLES
// ======================================================

const controls = new OrbitControls(camera, renderer.domElement);
const walkControls = new PointerLockControls(
    camera,
    renderer.domElement
);

controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.enableRotate = true;
controls.rotateSpeed = 0.72;
controls.enableZoom = true;
controls.zoomSpeed = 0.85;
controls.enablePan = true;
controls.panSpeed = 0.55;
controls.minDistance = 1.2;
controls.maxDistance = 65;
controls.minPolarAngle = 0.08;
controls.maxPolarAngle = Math.PI * 0.49;
controls.target.set(0, 2, 0);
controls.update();

let walkMode = false;
let tourActive = false;
let autoRotate = false;
let brighter = false;
let controlsVisible = true;
let showingVirgin = false;

const walkKeys = {};
const tourStops = [];

let savedChurchCamera = null;
let savedChurchTarget = null;
let savedMinDistance = 1.2;
let savedMaxDistance = 65;

// ======================================================
// MODELOS Y VARIABLES
// ======================================================

const loader = new GLTFLoader();
const world = new THREE.Group();
scene.add(world);

let church = null;
let priest = null;
let virgin = null;

let churchBox = null;
let churchSize = null;

let mixer = null;
let walkTime = 0;
let walkStart = null;
let walkEnd = null;

let selectedHotspot = null;
let doorTrigger = null;
let virginCenter = new THREE.Vector3();
let virginHeight = 1;

const hotspotObjects = [];
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

// ======================================================
// INFORMACIÓN HISTÓRICA
// ======================================================

const stories = [
    {
        id: "fachada",
        title: "La fachada principal",
        text: "La entrada y la fachada son algunos de los rasgos más reconocibles de la Iglesia de Catavi. Explora sus muros, la puerta y los detalles de su construcción."
    },
    {
        id: "historia",
        title: "Una iglesia con historia",
        text: "La historia local sitúa el inicio de la construcción en 1905 y su consagración en 1924. El templo forma parte de la memoria y la identidad de la comunidad de Catavi."
    },
    {
        id: "techo",
        title: "El techo y la torre",
        text: "La cubierta y la torre destacan en la silueta del templo. Gira el modelo y cambia el ángulo de cámara para observar sus volúmenes."
    },
    {
        id: "vitral",
        title: "El vitral",
        text: "Los vitrales aportan color y luz al interior de los templos. Este punto permite conocer uno de los detalles decorativos representados en el modelo."
    },
    {
        id: "comunidad",
        title: "Patrimonio de Catavi",
        text: "La iglesia es un espacio ligado a la vida religiosa y comunitaria. Su representación digital permite explorar el exterior desde diferentes ángulos."
    },
    {
        id: "virgen",
        title: "Virgen del Buen Consejo",
        text: ""
    }
];

// ======================================================
// TARJETAS INFORMATIVAS
// ======================================================

function showInfo(story) {
    if (!infoCard || !infoTitle || !infoText) return;

    infoTitle.textContent = story.title;
    infoText.textContent = story.text || "";

    infoCard.classList.add("visible");
    selectedHotspot = story.id;
}

function hideInfo() {
    if (infoCard) {
        infoCard.classList.remove("visible");
    }

    selectedHotspot = null;
}

if (closeInfo) {
    closeInfo.addEventListener("click", event => {
        event.stopPropagation();
        hideInfo();
    });
}

// ======================================================
// ETIQUETAS INTERACTIVAS DE LA IGLESIA
// ======================================================

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);

Object.assign(labelRenderer.domElement.style, {
    position: "fixed",
    inset: "0",
    pointerEvents: "none",
    zIndex: "3"
});

container.appendChild(labelRenderer.domElement);

function addHotspot(story, position) {
    const element = document.createElement("button");

    element.className = "hotspot";
    element.type = "button";
    element.title = story.title;
    element.setAttribute("aria-label", story.title);
    element.style.pointerEvents = "auto";

    element.addEventListener("click", event => {
        event.stopPropagation();

        // El punto de la Virgen abre su vista completa.
        if (story.id === "virgen") {
            showVirginView();
            return;
        }

        showInfo(story);
    });

    const object = new CSS2DObject(element);
    object.position.copy(position);
    world.add(object);
    hotspotObjects.push(object);

    return object;
}

// ======================================================
// VISTA INICIAL Y AJUSTE DE LA IGLESIA
// ======================================================

function centerAndFit(model) {
    const initialBox = new THREE.Box3().setFromObject(model);
    const initialCenter = initialBox.getCenter(new THREE.Vector3());

    model.position.sub(initialCenter);

    churchBox = new THREE.Box3().setFromObject(model);
    churchSize = churchBox.getSize(new THREE.Vector3());

    const floorOffset = churchBox.min.y;
    model.position.y -= floorOffset;

    churchBox.setFromObject(model);
    churchSize = churchBox.getSize(new THREE.Vector3());

    const radius = Math.max(churchSize.length() * 0.5, 1);

    // Se conserva la vista exterior amplia de la iglesia.
    const dist =
        radius /
        Math.sin(THREE.MathUtils.degToRad(camera.fov * 0.5)) *
        0.72;

    const viewDistance = dist * 1.18;

    camera.position.set(
        viewDistance * 0.92,
        viewDistance * 0.34,
        viewDistance * 1.12
    );

    camera.near = Math.max(0.05, radius / 100);
    camera.far = radius * 100;
    camera.updateProjectionMatrix();

    controls.minDistance = radius * 0.12;
    controls.maxDistance = radius * 8.0;

    controls.target.set(0, churchSize.y * 0.36, 0);
    controls.update();

    ground.position.y = 0;

    // Guardar la vista original para regresar desde la Virgen.
    saveChurchCamera();

    // PUNTOS HISTÓRICOS
    addHotspot(
        stories[0],
        new THREE.Vector3(
            0,
            churchSize.y * 0.28,
            churchSize.z * 0.52
        )
    );

    addHotspot(
        stories[1],
        new THREE.Vector3(
            -churchSize.x * 0.42,
            churchSize.y * 0.43,
            churchSize.z * 0.2
        )
    );

    addHotspot(
        stories[2],
        new THREE.Vector3(
            0,
            churchSize.y * 0.92,
            0
        )
    );

    addHotspot(
        stories[3],
        new THREE.Vector3(
            churchSize.x * 0.32,
            churchSize.y * 0.52,
            churchSize.z * 0.18
        )
    );

    addHotspot(
        stories[4],
        new THREE.Vector3(
            -churchSize.x * 0.42,
            churchSize.y * 0.22,
            -churchSize.z * 0.25
        )
    );

    // Punto adicional que abre la vista de la Virgen.
    addHotspot(
        stories[5],
        new THREE.Vector3(
            0,
            churchSize.y * 0.24,
            churchSize.z * 0.56
        )
    );

    // RECORRIDO GUIADO
    tourStops.length = 0;

    tourStops.push(
        {
            p: new THREE.Vector3(
                0,
                churchSize.y * 0.55,
                churchSize.z * 2.0
            ),
            t: new THREE.Vector3(
                0,
                churchSize.y * 0.4,
                0
            ),
            story: stories[0]
        },
        {
            p: new THREE.Vector3(
                churchSize.x * 1.7,
                churchSize.y * 0.8,
                churchSize.z * 1.3
            ),
            t: new THREE.Vector3(
                0,
                churchSize.y * 0.45,
                0
            ),
            story: stories[2]
        },
        {
            p: new THREE.Vector3(
                -churchSize.x * 1.6,
                churchSize.y * 0.65,
                -churchSize.z * 1.2
            ),
            t: new THREE.Vector3(
                0,
                churchSize.y * 0.45,
                0
            ),
            story: stories[4]
        }
    );

    createDoorTrigger();
}

// Guarda la cámara sin alterar el zoom ni la posición original.
function saveChurchCamera() {
    savedChurchCamera = camera.position.clone();
    savedChurchTarget = controls.target.clone();
    savedMinDistance = controls.minDistance;
    savedMaxDistance = controls.maxDistance;
}

// ======================================================
// ZONA CLICABLE DE LA PUERTA
// ======================================================

function createDoorTrigger() {
    if (doorTrigger) {
        world.remove(doorTrigger);
        doorTrigger.geometry.dispose();
        doorTrigger.material.dispose();
    }

    // Zona invisible situada delante de la fachada.
    // El ancho permite hacer clic en diferentes partes de la puerta.
    const width = Math.max(churchSize.x * 0.30, 0.8);
    const height = Math.max(churchSize.y * 0.40, 1.0);

    const geometry = new THREE.PlaneGeometry(width, height);

    const material = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        colorWrite: false,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    doorTrigger = new THREE.Mesh(geometry, material);

    doorTrigger.position.set(
        0,
        churchSize.y * 0.22,
        churchSize.z * 0.515
    );

    doorTrigger.name = "zonaPuertaVirgen";
    doorTrigger.userData.opensVirgin = true;

    world.add(doorTrigger);
}

// ======================================================
// CARGAR IGLESIA
// ======================================================

loader.load(
    "assets/models/iglesia-catavi.glb",
    gltf => {
        church = gltf.scene;

        church.traverse(object => {
            if (!object.isMesh) return;

            object.castShadow = true;
            object.receiveShadow = true;

            if (object.material) {
                const materials = Array.isArray(object.material)
                    ? object.material
                    : [object.material];

                materials.forEach(material => {
                    material.envMapIntensity = 1.25;
                });
            }
        });

        world.add(church);
        centerAndFit(church);

        if (loaderText) {
            loaderText.textContent = "Cargando detalles…";
        }

        loadPriest();
        loadVirgin();
    },
    undefined,
    error => {
        console.error("Error al cargar la iglesia:", error);

        if (loaderText) {
            loaderText.textContent =
                "No se pudo cargar iglesia-catavi.glb. Revisa assets/models.";
        }
    }
);

// ======================================================
// CARGAR CURA DELANTE DE LA IGLESIA
// ======================================================

function loadPriest() {
    loader.load(
        "assets/models/cura.glb",
        gltf => {
            priest = gltf.scene;

            priest.traverse(object => {
                if (object.isMesh) {
                    object.castShadow = true;
                    object.receiveShadow = true;
                }
            });

            const originalBox = new THREE.Box3().setFromObject(priest);
            const originalSize = originalBox.getSize(new THREE.Vector3());

            const desiredHeight = churchSize.y * 0.28;
            const scale = desiredHeight / Math.max(originalSize.y, 0.001);

            priest.scale.setScalar(scale);

            const scaledBox = new THREE.Box3().setFromObject(priest);

            // El cura queda delante de la puerta, sobre el suelo.
            // No se coloca en el centro del interior del edificio.
            priest.position.set(
                0,
                -scaledBox.min.y,
                churchSize.z * 0.40
            );

            priest.position.y += 2.0;
            priest.rotation.y = Math.PI;
            world.add(priest);

            walkStart = priest.position.clone();

            // Recorrido corto hacia la entrada sin alejarse del frente.//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
            walkEnd = walkStart.clone().add(
                new THREE.Vector3(
                    churchSize.x * 0.12,
                    0,
                    -churchSize.z * 0.10
                )
            );

            if (gltf.animations && gltf.animations.length > 0) {
                mixer = new THREE.AnimationMixer(priest);
                mixer.clipAction(gltf.animations[0]).play();
            }
        },
        undefined,
        error => {
            console.warn("No se pudo cargar cura.glb:", error);
        }
    );
}

// ======================================================
// CARGAR VIRGEN DEL BUEN CONSEJO
// ======================================================

function loadVirgin() {
    loader.load(
        "assets/models/virgensita.glb",
        gltf => {
            virgin = gltf.scene;

            virgin.traverse(object => {
                if (object.isMesh) {
                    object.castShadow = true;
                    object.receiveShadow = true;

                    const materials = Array.isArray(object.material)
                        ? object.material
                        : [object.material];

                    materials.forEach(material => {
                        material.envMapIntensity = 1.35;

                        // Conserva las texturas y evita modificar
                        // los colores originales de la imagen.
                        material.needsUpdate = true;
                    });
                }
            });

            const originalBox = new THREE.Box3().setFromObject(virgin);
            const originalSize = originalBox.getSize(new THREE.Vector3());

            const desiredHeight = churchSize.y * 0.24;
            const scale = desiredHeight / Math.max(originalSize.y, 0.001);

            virgin.scale.setScalar(scale);

            // Centrar el modelo de la Virgen en su propio origen.
            const scaledBox = new THREE.Box3().setFromObject(virgin);
            const center = scaledBox.getCenter(new THREE.Vector3());

            virgin.position.sub(center);

            const centeredBox = new THREE.Box3().setFromObject(virgin);
            virginHeight = centeredBox.getSize(new THREE.Vector3()).y;

            // Posición de espera fuera de la vista de la iglesia.
            // La Virgen se centra en pantalla cuando se selecciona.
            virgin.position.set(
                churchSize.x * 0.72,
                virginHeight * 0.5,
                -churchSize.z * 0.35
            );

            virgin.visible = false;
            world.add(virgin);

            console.log("Virgen del Buen Consejo cargada correctamente.");

            if (loaderText) {
                loaderText.textContent = "Modelo 3D listo";
            }
        },
        undefined,
        error => {
            console.warn(
                "No se encontró assets/models/virgensita.glb. " +
                "Comprueba el nombre y la ubicación del archivo.",
                error
            );
        }
    );
}

// ======================================================
// MOSTRAR VIRGEN A PANTALLA COMPLETA
// ======================================================

function showVirginView() {
    if (!virgin) {
        if (loaderText) {
            loaderText.textContent =
                "No se pudo cargar la Virgen. Revisa assets/models/virgensita.glb.";
        }

        return;
    }

    if (showingVirgin) return;

    // Guardar la cámara en el momento de entrar a la vista de la Virgen.
    // Así se conserva el zoom que tenía el usuario en la iglesia.
    saveChurchCamera();

    showingVirgin = true;
    autoRotate = false;
    tourActive = false;

    if (btnAuto) {
        btnAuto.classList.remove("active");
        const span = btnAuto.querySelector("span");
        if (span) span.textContent = "Giro automático";
    }

    if (btnTour) {
        const span = btnTour.querySelector("span");
        if (span) span.textContent = "Recorrido guiado";
    }

    hideInfo();

    // Ocultar la iglesia y el cura, sin borrar los modelos.
    if (church) church.visible = false;
    if (priest) priest.visible = false;

    // Ocultar los puntos de la iglesia y la zona clicable de la puerta.
    hotspotObjects.forEach(object => {
        object.visible = false;
    });

    if (doorTrigger) {
        doorTrigger.visible = false;
    }

    // Mostrar exclusivamente la Virgen.
    virgin.visible = true;
    virgin.rotation.y = 0;

    // El centro geométrico del modelo se utiliza como objetivo.
    const box = new THREE.Box3().setFromObject(virgin);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    virginCenter.copy(center);

    // La cámara mira a la Virgen de frente, sin cortar sus detalles.
    const distance = Math.max(size.y * 2.5, 1.5);

    controls.target.copy(center);

    camera.position.set(
        center.x,
        center.y + size.y * 0.12,
        center.z + distance
    );

    camera.near = 0.01;
    camera.far = 2000;
    camera.updateProjectionMatrix();

    controls.minDistance = Math.max(size.y * 0.8, 0.5);
    controls.maxDistance = Math.max(size.y * 7, 5);

    controls.maxPolarAngle = Math.PI * 0.95;
    controls.update();

    // Luz especial y efecto suave para destacar la imagen religiosa.
    virginLight.visible = true;
    virginLight.position.set(
        center.x,
        center.y + size.y * 1.2,
        center.z + size.y * 1.8
    );

    virginLight.target.position.copy(center);

    bloom.strength = 0.30;
    bloom.radius = 0.45;
    bloom.threshold = 0.82;

    renderer.toneMappingExposure = 1.18;

    // Mostrar únicamente el nombre completo, sin descripción adicional.
    showInfo({
        id: "virgen",
        title: "Virgen del Buen Consejo",
        text: ""
    });

    if (loaderText) {
        loaderText.textContent = "Virgen del Buen Consejo";
    }
}

// El botón de Virgen también abre esta vista.
if (btnVirgen) {
    btnVirgen.addEventListener("click", showVirginView);
}

// ======================================================
// REGRESAR A LA IGLESIA
// ======================================================

function resetView() {
    if (showingVirgin) {
        showingVirgin = false;

        if (virgin) {
            virgin.visible = false;
        }

        if (church) {
            church.visible = true;
        }

        if (priest) {
            priest.visible = true;
        }

        hotspotObjects.forEach(object => {
            object.visible = true;
        });

        if (doorTrigger) {
            doorTrigger.visible = true;
        }

        virginLight.visible = false;

        // Restaurar los efectos de la vista de la iglesia.
        bloom.strength = 0.34;
        bloom.radius = 0.55;
        bloom.threshold = 0.78;

        renderer.toneMappingExposure = brighter ? 1.65 : 1.32;

        controls.maxPolarAngle = Math.PI * 0.49;

        if (savedChurchCamera) {
            camera.position.copy(savedChurchCamera);
        }

        if (savedChurchTarget) {
            controls.target.copy(savedChurchTarget);
        }

        controls.minDistance = savedMinDistance;
        controls.maxDistance = savedMaxDistance;

        camera.near = 0.1;
        camera.far = 2000;
        camera.updateProjectionMatrix();

        controls.update();
        hideInfo();

        if (loaderText) {
            loaderText.textContent = "Arrastra para girar el modelo";
        }

        return;
    }

    // Si ya estamos en la iglesia, volver a la vista exterior original.
    if (!church || !churchSize) return;

    const radius = Math.max(churchSize.length() * 0.5, 1);

    const distance =
        radius /
        Math.sin(THREE.MathUtils.degToRad(camera.fov * 0.5)) *
        0.72 *
        1.18;

    camera.position.set(
        distance * 0.92,
        distance * 0.34,
        distance * 1.12
    );

    controls.target.set(0, churchSize.y * 0.36, 0);
    controls.minDistance = radius * 0.12;
    controls.maxDistance = radius * 8.0;
    controls.maxPolarAngle = Math.PI * 0.49;

    camera.near = Math.max(0.05, radius / 100);
    camera.far = radius * 100;
    camera.updateProjectionMatrix();

    controls.update();
    saveChurchCamera();
    hideInfo();
}

if (btnReset) {
    btnReset.addEventListener("click", resetView);
}

// ======================================================
// CLIC EN LA PUERTA: ABRIR LA VISTA DE LA VIRGEN
// ======================================================

renderer.domElement.addEventListener("click", event => {
    if (!church || !doorTrigger || showingVirgin || walkMode) return;

    const rect = renderer.domElement.getBoundingClientRect();

    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);

    const hits = raycaster.intersectObject(doorTrigger, false);

    if (hits.length > 0) {
        showVirginView();
    }
});

// ======================================================
// GIRO AUTOMÁTICO DE LA IGLESIA
// ======================================================

if (btnAuto) {
    btnAuto.addEventListener("click", () => {
        if (showingVirgin) return;

        autoRotate = !autoRotate;
        btnAuto.classList.toggle("active", autoRotate);

        const span = btnAuto.querySelector("span");
        if (span) {
            span.textContent = autoRotate
                ? "Detener giro"
                : "Giro automático";
        }
    });
}

// ======================================================
// ILUMINACIÓN DÍA / NOCHE
// ======================================================

if (btnLight) {
    btnLight.addEventListener("click", () => {
        brighter = !brighter;

        
renderer.toneMappingExposure = brighter ? 0.95 : 0.75;

keyLight.intensity = brighter ? 2.2 : 1.4;
fillLight.intensity = brighter ? 0.8 : 0.5;
frontLight.intensity = brighter ? 10 : 6;
rimLight.intensity = brighter ? 25 : 15;

bloom.strength = brighter ? 0.08 : 0.04;


        scene.background.set(
            brighter ? "#a8b7ca" : "#080d18"
        );

        scene.fog.color.set(
            brighter ? "#a8b7ca" : "#080d18"
        );

        ground.material.color.set(
            brighter ? 0x343a42 : 0x111a28
        );

        const span = btnLight.querySelector("span");
        if (span) {
            span.textContent = brighter ? "Modo noche" : "Día / Noche";
        }

        btnLight.classList.toggle("active", brighter);
    });
}

// ======================================================
// MODO CAMINAR
// ======================================================

function exitWalkMode() {
    walkMode = false;
    controls.enabled = true;

    if (walkHelp) {
        walkHelp.classList.remove("visible");
    }

    if (document.pointerLockElement) {
        document.exitPointerLock();
    }

    if (btnWalk) {
        const span = btnWalk.querySelector("span");
        if (span) span.textContent = "Caminar";
    }
}

if (btnWalk) {
    btnWalk.addEventListener("click", () => {
        if (!church || showingVirgin) return;

        if (walkMode) {
            exitWalkMode();
            return;
        }

        walkMode = true;
        controls.enabled = false;

        if (walkHelp) {
            walkHelp.classList.add("visible");
        }

        const span = btnWalk.querySelector("span");
        if (span) span.textContent = "Salir de caminar";

        walkControls.lock();
    });
}

walkControls.addEventListener("unlock", () => {
    if (walkMode) {
        walkMode = false;
        controls.enabled = true;

        if (walkHelp) {
            walkHelp.classList.remove("visible");
        }

        if (btnWalk) {
            const span = btnWalk.querySelector("span");
            if (span) span.textContent = "Caminar";
        }
    }
});

document.addEventListener("keydown", event => {
    walkKeys[event.code] = true;

    if (event.code === "Escape") {
        tourActive = false;
    }
});

document.addEventListener("keyup", event => {
    walkKeys[event.code] = false;
});

// ======================================================
// RECORRIDO GUIADO
// ======================================================

let tourStart = 0;

if (btnTour) {
    btnTour.addEventListener("click", () => {
        if (!church || showingVirgin || tourStops.length === 0) return;

        tourActive = !tourActive;
        tourStart = performance.now();

        if (tourActive) {
            exitWalkMode();
            hideInfo();

            const span = btnTour.querySelector("span");
            if (span) span.textContent = "Detener recorrido";
        } else {
            const span = btnTour.querySelector("span");
            if (span) span.textContent = "Recorrido guiado";
        }
    });
}

// ======================================================
// GUARDAR CAPTURA
// ======================================================

if (btnPhoto) {
    btnPhoto.addEventListener("click", () => {
        try {
            composer.render();

            const link = document.createElement("a");
            link.download = showingVirgin
                ? "virgen-del-buen-consejo.png"
                : "iglesia-catavi-recorrido.png";

            link.href = renderer.domElement.toDataURL("image/png");
            link.click();
        } catch (error) {
            console.warn("No se pudo guardar la captura:", error);

            if (loaderText) {
                loaderText.textContent =
                    "No se pudo guardar la captura en este navegador.";
            }
        }
    });
}

// ======================================================
// PANTALLA COMPLETA
// ======================================================

if (btnFull) {
    btnFull.addEventListener("click", async () => {
        try {
            if (!document.fullscreenElement) {
                await document.documentElement.requestFullscreen();
            } else {
                await document.exitFullscreen();
            }
        } catch (error) {
            console.warn("Pantalla completa no disponible:", error);
        }
    });
}

// ======================================================
// MOSTRAR / OCULTAR CONTROLES
// ======================================================

if (btnMenu) {
    btnMenu.addEventListener("click", () => {
        controlsVisible = !controlsVisible;

        document.querySelectorAll(".controls-3d button").forEach(button => {
            if (button.id !== "btnMenu") {
                button.style.display = controlsVisible ? "flex" : "none";
            }
        });

        const span = btnMenu.querySelector("span");
        if (span) {
            span.textContent = controlsVisible
                ? "Ocultar controles"
                : "Mostrar controles";
        }
    });
}

// ======================================================
// CERRAR INFORMACIÓN
// ======================================================

renderer.domElement.addEventListener("pointerdown", event => {
    // No cerrar la información al iniciar un clic en la zona de la puerta.
    if (event.target === renderer.domElement) {
        hideInfo();
    }
});

labelRenderer.domElement.addEventListener("pointerdown", event => {
    if (event.target === labelRenderer.domElement) {
        hideInfo();
    }
});

window.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        hideInfo();
    }
});

// ======================================================
// REDIMENSIONAR
// ======================================================

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
});

// ======================================================
// ANIMACIÓN PRINCIPAL
// ======================================================

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const dt = Math.min(clock.getDelta(), 0.05);

    controls.update();

    // Girar automáticamente la iglesia solo en su vista.
    if (autoRotate && church && !showingVirgin) {
        world.rotation.y += dt * 0.12;
    }

    // Movimiento del cura delante de la puerta.
    if (priest && walkStart && walkEnd && !showingVirgin) {
        walkTime += dt;

        const cycle = (walkTime % 12) / 12;

        const t = cycle < 0.78
            ? cycle / 0.78
            : 1 - (cycle - 0.78) / 0.22;

        priest.position.lerpVectors(
            walkStart,
            walkEnd,
            THREE.MathUtils.smoothstep(t, 0, 1)
        );

        priest.position.y +=
            Math.abs(Math.sin(walkTime * 2.2)) *
            churchSize.y * 0.008;

        priest.rotation.y =
            Math.PI + Math.sin(walkTime * 0.8) * 0.12;

        if (mixer) {
            mixer.update(dt);
        } else {
            priest.rotation.z = Math.sin(walkTime * 5) * 0.018;
        }
    }

    // Movimiento con teclado en modo caminar.
    if (walkMode && walkControls.isLocked && !showingVirgin) {
        const speed = churchSize ? churchSize.y * 0.48 : 1;

        if (walkKeys["KeyW"] || walkKeys["ArrowUp"]) {
            walkControls.moveForward(speed * dt);
        }

        if (walkKeys["KeyS"] || walkKeys["ArrowDown"]) {
            walkControls.moveForward(-speed * dt);
        }

        if (walkKeys["KeyA"] || walkKeys["ArrowLeft"]) {
            walkControls.moveRight(-speed * dt);
        }

        if (walkKeys["KeyD"] || walkKeys["ArrowRight"]) {
            walkControls.moveRight(speed * dt);
        }

        camera.position.y = Math.max(
            camera.position.y,
            churchSize ? churchSize.y * 0.12 : 1
        );
    }

    // Recorrido automático por los puntos de la iglesia.
    if (tourActive && tourStops.length && !showingVirgin) {
        const elapsed = (performance.now() - tourStart) / 1000;
        const duration = 6;
        const total = tourStops.length * duration;

        if (elapsed >= total) {
            tourActive = false;

            if (btnTour) {
                const span = btnTour.querySelector("span");
                if (span) span.textContent = "Recorrido guiado";
            }
        } else {
            const index = Math.min(
                Math.floor(elapsed / duration),
                tourStops.length - 1
            );

            const local = (elapsed % duration) / duration;
            const stop = tourStops[index];

            const previous = index === 0
                ? {
                    p: savedChurchCamera
                        ? savedChurchCamera.clone()
                        : camera.position.clone(),
                    t: savedChurchTarget
                        ? savedChurchTarget.clone()
                        : controls.target.clone()
                }
                : tourStops[index - 1];

            camera.position.lerpVectors(
                previous.p,
                stop.p,
                THREE.MathUtils.smoothstep(local, 0, 1)
            );

            controls.target.lerp(stop.t, 0.12);
            controls.update();

            if (local < 0.03 && stop.story) {
                showInfo(stop.story);
            }
        }
    }

    // Giro lento de la Virgen sin cambiar sus detalles.
    if (virgin && virgin.visible && showingVirgin) {
        virgin.rotation.y += dt * 0.08;
    }

    composer.render();
    labelRenderer.render(scene, camera);
}

if (loaderText) {
    loaderText.textContent = "Cargando modelo 3D…";
}

animate();

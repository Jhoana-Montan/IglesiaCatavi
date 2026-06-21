/* =========================================================
   Visor 3D — Three.js
   Escena profesional preparada para cargar:
     assets/models/iglesia-catavi.glb
   Si el archivo no existe, se renderiza una escena de
   marcador (templo procedural) para que la página funcione.
   ========================================================= */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader }    from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const container = document.getElementById("viewer");
if (container) initViewer();

function initViewer(){
  const loaderEl = document.getElementById("loader");
  const btnReset = document.getElementById("btnReset");
  const btnAuto  = document.getElementById("btnAuto");
  const btnWire  = document.getElementById("btnWire");

  // ----- Escena
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1220);
  scene.fog = new THREE.Fog(0x0b1220, 30, 90);

  // ----- Cámara
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
  camera.position.set(14, 9, 16);

  // ----- Renderer
  const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  // ----- Entorno PBR
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  // ----- Controles orbitales
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 5;
  controls.maxDistance = 60;
  controls.maxPolarAngle = Math.PI / 2.05;
  controls.target.set(0, 3, 0);

  // ----- Iluminación
  const hemi = new THREE.HemisphereLight(0xfff2d6, 0x1a2236, 0.55);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfbe7a8, 1.4);
  sun.position.set(18, 24, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -25; sun.shadow.camera.right = 25;
  sun.shadow.camera.top  =  25; sun.shadow.camera.bottom = -25;
  sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 80;
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0x6ea8ff, 0.4);
  fill.position.set(-15, 10, -8);
  scene.add(fill);

  // ----- Piso
  const floorMat = new THREE.MeshStandardMaterial({
    color:0x1b2538, roughness:0.85, metalness:0.05,
  });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 64), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Cuadrícula dorada decorativa
  const grid = new THREE.GridHelper(60, 30, 0xfbbf24, 0x273449);
  grid.material.transparent = true;
  grid.material.opacity = 0.18;
  scene.add(grid);

  // ----- Cargar modelo .glb si existe; si no, modelo procedural
  const model = new THREE.Group();
  scene.add(model);

  const loader = new GLTFLoader();
  loader.load(
    "assets/models/iglesia-catavi.glb",
    (gltf) => {
      const obj = gltf.scene;
      obj.traverse(c => { if (c.isMesh){ c.castShadow = true; c.receiveShadow = true; } });
      // Centrar y escalar
      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      obj.position.sub(center);
      obj.position.y += size.y / 2;
      const scale = 10 / Math.max(size.x, size.y, size.z);
      obj.scale.setScalar(scale);
      model.add(obj);
      hideLoader();
    },
    undefined,
    () => {
      // Sin .glb disponible: escena de marcador (templo procedural elegante)
      model.add(buildPlaceholderChurch());
      hideLoader();
    }
  );

  function hideLoader(){ if (loaderEl) loaderEl.classList.add("hidden"); }

  // ----- Botones
  const initialCam = camera.position.clone();
  const initialTarget = controls.target.clone();
  btnReset?.addEventListener("click", () => {
    camera.position.copy(initialCam);
    controls.target.copy(initialTarget);
  });
  let auto = true;
  btnAuto?.addEventListener("click", () => { auto = !auto; btnAuto.textContent = auto ? "Detener rotación" : "Rotación auto"; });
  let wire = false;
  btnWire?.addEventListener("click", () => {
    wire = !wire;
    model.traverse(c => { if (c.isMesh && c.material) c.material.wireframe = wire; });
    btnWire.textContent = wire ? "Modo sólido" : "Wireframe";
  });

  // ----- Resize
  function resize(){
    const r = container.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  // ----- Loop
  const clock = new THREE.Clock();
  function tick(){
    const dt = clock.getDelta();
    if (auto) model.rotation.y += dt * 0.18;
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  tick();
}

/* Templo procedural usado como marcador mientras no exista
   assets/models/iglesia-catavi.glb */
function buildPlaceholderChurch(){
  const g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color:0x9b8466, roughness:0.95, metalness:0.05 });
  const gold  = new THREE.MeshStandardMaterial({ color:0xfbbf24, roughness:0.25, metalness:0.85 });
  const wood  = new THREE.MeshStandardMaterial({ color:0x3a2418, roughness:0.7,  metalness:0.1  });
  const roof  = new THREE.MeshStandardMaterial({ color:0x6b3a2a, roughness:0.85, metalness:0.05 });

  // Nave principal
  const body = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 14), stone);
  body.position.y = 3; body.castShadow = body.receiveShadow = true; g.add(body);

  // Techo a dos aguas
  const roofGeo = new THREE.CylinderGeometry(0.01, 5.6, 14, 3, 1, true);
  const roofMesh = new THREE.Mesh(roofGeo, roof);
  roofMesh.rotation.z = Math.PI / 2; roofMesh.rotation.y = Math.PI / 2;
  roofMesh.position.y = 7.2; roofMesh.castShadow = true; g.add(roofMesh);

  // Torre / campanario
  const tower = new THREE.Mesh(new THREE.BoxGeometry(3.2, 10, 3.2), stone);
  tower.position.set(0, 5, -7.5); tower.castShadow = tower.receiveShadow = true; g.add(tower);
  const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(2.4, 3, 4), roof);
  towerRoof.position.set(0, 11.5, -7.5); towerRoof.rotation.y = Math.PI / 4; towerRoof.castShadow = true; g.add(towerRoof);

  // Cruz dorada
  const cv = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.6, 0.18), gold); cv.position.set(0, 14, -7.5); g.add(cv);
  const ch = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.18), gold); ch.position.set(0, 13.8, -7.5); g.add(ch);

  // Puerta
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 3, 0.2), wood);
  door.position.set(0, 1.5, 7.05); g.add(door);
  const arch = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.12, 16, 32, Math.PI), gold);
  arch.position.set(0, 3, 7.1); g.add(arch);

  // Ventanas
  for (let i = -1; i <= 1; i += 2){
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2, 1.2), gold);
    w.position.set(i * 5.05, 4, 0); g.add(w);
    for (let z = -4; z <= 4; z += 4){
      const w2 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.6, 1), gold);
      w2.position.set(i * 5.05, 4, z); g.add(w2);
    }
  }
  return g;
}

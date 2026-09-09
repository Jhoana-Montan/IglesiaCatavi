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

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1220);
  scene.fog = new THREE.Fog(0x0b1220, 35, 100);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
  camera.position.set(28, 18, 28);

  const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 8;
  controls.maxDistance = 60;
  controls.maxPolarAngle = Math.PI / 2.05;
  controls.target.set(0,50, 0);//ddddddddddddddddddddddddddddddddddddddddddddddddddd

  const hemi = new THREE.HemisphereLight(0xfff8e1, 0x1a2236, 0.65);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff2d6, 1.5);
  sun.position.set(25, 30, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -30; sun.shadow.camera.right = 30;
  sun.shadow.camera.top  =  30; sun.shadow.camera.bottom = -30;
  sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 100;
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  const groundMat = new THREE.MeshStandardMaterial({
    color:0x2a2a2a, roughness:0.95, metalness:0.02,
  });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 64), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const model = new THREE.Group();
  scene.add(model);

  const loader = new GLTFLoader();
  loader.load(
    "assets/models/iglesia-catavi.glb",
    (gltf) => {
      const obj = gltf.scene;
      obj.traverse(c => { if (c.isMesh){ c.castShadow = true; c.receiveShadow = true; } });
      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      obj.position.sub(center);
      obj.position.y += 14;//d
      const scale = 25 / Math.max(size.x, size.y, size.z);
      obj.scale.setScalar(scale);
      obj.position.y += size.y;
      model.add(obj);
      hideLoader();
    },
    (xhr) => {
      if (loaderEl) loaderEl.textContent = `Cargando... ${Math.round((xhr.loaded/xhr.total)*100)}%`;
    },
    () => {
      model.add(buildCataviExterior());
      hideLoader();
    }
  );

  function hideLoader(){ if (loaderEl) loaderEl.classList.add("hidden"); }

  const initialCam = camera.position.clone();
  const initialTarget = controls.target.clone();
  btnReset?.addEventListener("click", () => {
    camera.position.copy(initialCam);
    controls.target.copy(initialTarget);
  });
  let auto = true;
  btnAuto?.addEventListener("click", () => { 
    auto = !auto; 
    btnAuto.textContent = auto ? "Detener rotación" : "Rotación auto"; 
  });
  let wire = false;
  btnWire?.addEventListener("click", () => {
    wire = !wire;
    model.traverse(c => { if (c.isMesh && c.material) c.material.wireframe = wire; });
    btnWire.textContent = wire ? "Modo sólido" : "Wireframe";
  });

  function resize(){
    const r = container.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  const clock = new THREE.Clock();
  function tick(){
    const dt = clock.getDelta();
    if (auto) model.rotation.y += dt * 0.12;
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  tick();
}

/* Modelo  */
function buildCataviExterior(){
  const g = new THREE.Group();
  
  // Materiales exactos de la maqueta
  const stone = new THREE.MeshStandardMaterial({ 
    color: 0x9c8b6e, roughness: 0.95, metalness: 0.05 
  });
  const roofMat = new THREE.MeshStandardMaterial({ 
    color: 0xd64545, roughness: 0.7, metalness: 0.1 // Rojo teja correcto
  });
  const doorMat = new THREE.MeshStandardMaterial({ 
    color: 0xb91c1c, roughness: 0.6, metalness: 0.05 // Rojo puerta
  });
  const concrete = new THREE.MeshStandardMaterial({ 
    color: 0x9ca3af, roughness: 0.9, metalness: 0.02 
  });

  // 1. NAVE PRINCIPAL - proporciones correctas: más larga
  const nave = new THREE.Mesh(new THREE.BoxGeometry(8, 5.5, 14), stone);
  nave.position.y = 2.75;
  nave.castShadow = nave.receiveShadow = true;
  g.add(nave);

  // 2. TECHO A DOS AGUAS - corregido: más corto, sin volar tanto
  const roofGeo = new THREE.ConeGeometry(5.5, 3.5, 4);
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.set(0, 7.25, 0);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1, 1, 2.55); // Alarga el techo sobre la nave
  roof.castShadow = true;
  g.add(roof);

  // 3. ESPADAÑA CENTRADA - sobre la nave, no en la fachada
  const bellWall = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.5, 0.4), stone);
  bellWall.position.set(0, 9, 0); // Centrada sobre nave
  bellWall.castShadow = true;
  g.add(bellWall);

  // Arco de campana
  const bellArch = new THREE.Mesh(
    new THREE.TorusGeometry(0.5, 0.12, 8, 16, Math.PI),
    stone
  );
  bellArch.position.set(0, 9.8, 0.25);
  bellArch.rotation.x = Math.PI / 2;
  g.add(bellArch);

  // Cruz superior
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.1), stone);
  crossV.position.set(0, 10.85, 0);
  g.add(crossV);
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.1), stone);
  crossH.position.set(0, 10.65, 0);
  g.add(crossH);

  // 4. FACHADA FRONTAL con arco
  const facade = new THREE.Mesh(new THREE.BoxGeometry(8, 5.5, 0.3), stone);
  facade.position.set(0, 2.75, 7.15);
  facade.castShadow = facade.receiveShadow = true;
  g.add(facade);

  // Puerta roja
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.4, 3, 0.1), doorMat);
  door.position.set(0, 1.5, 7.3);
  g.add(door);

  // Arco de medio punto sobre puerta
  const doorArch = new THREE.Mesh(
    new THREE.TorusGeometry(0.8, 0.15, 8, 16, Math.PI),
    stone
  );
  doorArch.position.set(0, 3, 7.3);
  doorArch.rotation.x = Math.PI / 2;
  g.add(doorArch);

  // 5. ESCALINATA FRONTAL - 3 peldaños pegados al suelo
  const step1 = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.25, 1.2), concrete);
  step1.position.set(0, 0.125, 8.1);
  step1.receiveShadow = true;
  g.add(step1);

  const step2 = new THREE.Mesh(new THREE.BoxGeometry(3, 0.25, 1), concrete);
  step2.position.set(0, 0.375, 7.9);
  step2.receiveShadow = true;
  g.add(step2);

  const step3 = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.25, 0.8), concrete);
  step3.position.set(0, 0.625, 7.7);
  step3.receiveShadow = true;
  g.add(step3);

  // 6. CONTRAFUERTES LATERALES - 4 por lado, delgados
  for(let i = 0; i < 4; i++){
    const z = -5.25 + i * 3.5;
    const buttressL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.5, 0.8), stone);
    buttressL.position.set(-4.2, 2.25, z);
    buttressL.castShadow = true;
    g.add(buttressL);

    const buttressR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.5, 0.8), stone);
    buttressR.position.set(4.2, 2.25, z);
    buttressR.castShadow = true;
    g.add(buttressR);
  }

  // 7. VENTANAS LATERALES - 3 por lado, simples
  for(let side = -1; side <= 1; side += 2){
    for(let i = 0; i < 3; i++){
      const z = -3.5 + i * 3.5;
      const window = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2, 0.6), stone);
      window.position.set(side * 4.05, 3, z);
      g.add(window);
    }
  }

  // 8. CERCO PERIMETRAL BAJO - como en maqueta
  const fenceH = 0.6;
  const fenceW = 0.15;
  
  const fenceFront = new THREE.Mesh(new THREE.BoxGeometry(12, fenceH, fenceW), stone);
  fenceFront.position.set(0, fenceH/2, 10);
  g.add(fenceFront);
  
  const fenceLeft = new THREE.Mesh(new THREE.BoxGeometry(fenceW, fenceH, 20), stone);
  fenceLeft.position.set(-6, fenceH/2, 0);
  g.add(fenceLeft);
  
  const fenceRight = new THREE.Mesh(new THREE.BoxGeometry(fenceW, fenceH, 20), stone);
  fenceRight.position.set(6, fenceH/2, 0);
  g.add(fenceRight);

  const fenceBack = new THREE.Mesh(new THREE.BoxGeometry(12, fenceH, fenceW), stone);
  fenceBack.position.set(0, fenceH/2, -10);
  g.add(fenceBack);

  return g;
}
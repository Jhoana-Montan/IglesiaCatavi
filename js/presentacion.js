import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const container = document.getElementById("canvas-container");
if (container) initPresentacion();

function initPresentacion(){
  let scrollY = 0;
  let targetScroll = 0;
  let startY = 0;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050508);

  const camera = new THREE.PerspectiveCamera(25, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 20);

  const renderer = new THREE.WebGLRenderer({ antialias:true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  // LUCES
  scene.add(new THREE.AmbientLight(0xffffff, 1));
  const backLight = new THREE.DirectionalLight(0xfff4e6, 3);
  backLight.position.set(0, 0, -10);
  scene.add(backLight);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 8;
  controls.maxDistance = 25;
  controls.enablePan = true;
  controls.target.set(0, 0, 0);

  const loader = new GLTFLoader();
  let vitral = null;

  // VITRAL
  loader.load("assets/models/vitral1.glb", (gltf) => {
    vitral = gltf.scene;
    vitral.scale.set(8, 8, 8);
    vitral.position.set(0, 0, 3); // CENTRADO Y ADELANTE
    scene.add(vitral);
  });

  // SISTEMA DE CHISPITAS
  const particles = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(300 * 3), 3)),
    new THREE.PointsMaterial({ color: 0xffd700, size: 0.1, transparent: true, opacity: 0.8 })
  );
  scene.add(particles);
  const particlePos = particles.geometry.attributes.position.array;

  // CALCULAR INICIO
  function calcularInicio(){
    const startSection = document.querySelector('.hero-content');
    if(startSection){ startY = startSection.offsetTop; }
  }
  calcularInicio();
  window.addEventListener('resize', calcularInicio);

  window.addEventListener('scroll', () => { targetScroll = window.scrollY; });
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ANIMAR BURBUJAS DE TEXTO
  function animarBurbujas(progress){
    document.querySelectorAll('.info-burbuja').forEach((burbuja, i) => {
      const trigger = i * 0.3;
      if(progress > trigger){
        burbuja.classList.add('visible');
        // CHISPITAS CERCA DE LA BURBUJA
        for(let j=0; j<10; j++){
          const idx = (i*10 + j) * 3;
          particlePos[idx] = burbuja.offsetLeft / window.innerWidth * 20 - 10;
          particlePos[idx+1] = -progress * 5 + Math.random();
          particlePos[idx+2] = Math.random() * 2;
        }
      }
    });
    particles.geometry.attributes.position.needsUpdate = true;
  }

  const clock = new THREE.Clock();
  function tick(){
    requestAnimationFrame(tick);
    const dt = clock.getDelta();
    scrollY += (targetScroll - scrollY) * 0.1;
    
    if(vitral){
      const progress = (scrollY - startY) / window.innerHeight;
      const clampedProgress = Math.max(0, Math.min(progress, 1));

      // MOVIMIENTO CORTO: DE -3 A +3. NO SE PIERDE
      vitral.position.x = -3 + clampedProgress * 6;
      vitral.position.y = 0 - clampedProgress * 4; // BAJA DESPACIO
      vitral.position.z = 3;
      vitral.rotation.y += dt * 0.2;

      animarBurbujas(progress);
    }

    controls.update();
    renderer.render(scene, camera);
  }
  tick();
}
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// ---------- Interacción de la página (no depende de Three.js) ----------
const bar = document.getElementById("progress");
const container = document.getElementById("canvas-container");

// Aparición al hacer scroll
const io = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
}, { threshold: 0.15 });
document.querySelectorAll(".rv").forEach(el => io.observe(el));

// Contadores animados
document.querySelectorAll("[data-count]").forEach(el => {
  const end = +el.dataset.count, suffix = el.dataset.suffix || "", plain = "plain" in el.dataset;
  const t0 = performance.now() + 900, dur = 1800;
  const step = now => {
    const k = Math.min(Math.max((now - t0) / dur, 0), 1);
    const v = Math.round(end * (1 - Math.pow(1 - k, 3)));
    el.textContent = (plain ? v : v.toLocaleString("es")) + suffix;
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
});

// Brillo que sigue al ratón en las tarjetas
document.querySelectorAll(".card").forEach(card => {
  card.addEventListener("pointermove", e => {
    const r = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${e.clientX - r.left}px`);
    card.style.setProperty("--my", `${e.clientY - r.top}px`);
  });
});

// ---------- Vitral 3D ----------
if (container) initVitral();

function initVitral() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(25, innerWidth / innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 20);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 1));
  const back = new THREE.DirectionalLight(0xfff4e6, 3);
  back.position.set(0, 0, -10);
  scene.add(back);

  const pivot = new THREE.Group();
  scene.add(pivot);

  let vitral = null;
  new GLTFLoader().load("assets/models/vitral1.glb", gltf => {
    vitral = gltf.scene;
    vitral.scale.setScalar(8);
    pivot.add(vitral);
    pivot.position.z = 3;
  }, undefined, err => console.warn("No se pudo cargar vitral1.glb", err));

  // Chispas doradas flotando
  const N = 260;
  const pos = new Float32Array(N * 3), speed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 16;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 10;
    pos[i * 3 + 2] = Math.random() * 6 - 2;
    speed[i] = 0.1 + Math.random() * 0.35;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const sparks = new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xffd36b, size: 0.07, transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  scene.add(sparks);

  // Ratón y scroll
  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  addEventListener("pointermove", e => {
    mouse.x = (e.clientX / innerWidth - 0.5) * 2;
    mouse.y = (e.clientY / innerHeight - 0.5) * 2;
  });

  let scroll = 0, targetScroll = 0;
  const onScroll = () => {
    targetScroll = scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;
    if (bar) bar.style.width = (max > 0 ? scrollY / max * 100 : 0) + "%";
  };
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  const clock = new THREE.Clock();
  const ease = k => k * k * (3 - 2 * k);

  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    scroll += (targetScroll - scroll) * 0.08;
    mouse.sx += (mouse.x - mouse.sx) * 0.05;
    mouse.sy += (mouse.y - mouse.sy) * 0.05;

    const p = Math.min(scroll / innerHeight, 1.2);
    const wide = innerWidth > 840;
    const baseX = wide ? 3.6 : 0;
    const baseY = wide ? 0 : 2.2;

    // Del lado derecho del hero hacia la izquierda mientras se baja
    pivot.position.x = THREE.MathUtils.lerp(baseX, wide ? -4.2 : 0, ease(Math.min(p, 1)));
    pivot.position.y = baseY - p * 2 + Math.sin(t * 0.8) * 0.15;
    pivot.scale.setScalar(wide ? 1 : 0.6);

    if (vitral) vitral.rotation.y += dt * 0.35;
    pivot.rotation.x = mouse.sy * 0.18;
    pivot.rotation.z = -mouse.sx * 0.08;
    pivot.position.x += mouse.sx * 0.25;

    sparks.rotation.y = t * 0.03 + mouse.sx * 0.1;
    const arr = geo.attributes.position.array;
    for (let i = 0; i < N; i++) {
      arr[i * 3 + 1] += speed[i] * dt;
      if (arr[i * 3 + 1] > 5) arr[i * 3 + 1] = -5;
    }
    geo.attributes.position.needsUpdate = true;

    // El vitral se atenúa al bajar para no estorbar la lectura
    container.style.opacity = String(Math.max(0.25, 1 - p * 0.75));

    renderer.render(scene, camera);
  });
}
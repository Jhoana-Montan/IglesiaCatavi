import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

// ---------- PIEZAS DE LA COLECCIÓN ----------
const PIEZAS = [
  {
    archivo: "assets/models/Santo.glb",
    etiqueta: "Escultura",
    titulo: "Santo",
    sobre: "Esta escultura representa la tradición de las imágenes religiosas presentes en los templos católicos. Los santos son figuras reconocidas por su ejemplo de fe, sus virtudes y su dedicación a Dios. Su representación artística permite a los creyentes recordar sus enseñanzas y mantener viva la devoción religiosa.",
    curioso: "En la tradición católica, las imágenes de los santos no son objeto de adoración, sino representaciones que ayudan a recordar su vida, ejemplo y significado espiritual.",
    resumen: "Imagen religiosa vinculada al patrimonio devocional de Catavi, que recuerda el ejemplo de fe y las virtudes de los santos."
  },
  {
    archivo: "assets/models/vitral1.glb",
    etiqueta: "Arte religioso",
    titulo: "Vitral religioso",
    sobre: "El vitral es una expresión artística que utiliza piezas de vidrio de diferentes colores para formar imágenes, figuras y composiciones decorativas. En la arquitectura religiosa, estos elementos permiten representar escenas y símbolos relacionados con la fe cristiana. Su presencia aporta belleza al templo y transforma la luz natural en parte de la experiencia visual del espacio sagrado.",
    curioso: "Durante siglos, los vitrales fueron utilizados en iglesias para transmitir relatos y enseñanzas religiosas mediante imágenes y colores, incluso a personas que no sabían leer.",
    resumen: "Composición de vidrio y color vinculada al patrimonio religioso de Catavi, que convierte la luz en parte de la experiencia del espacio sagrado."
  },
  {
    archivo: "assets/models/virgensita.glb",
    etiqueta: "Advocación mariana",
    titulo: "Virgen del Buen Consejo",
    sobre: "Nuestra Señora del Buen Consejo es una advocación de la Virgen María que representa la protección maternal y la orientación espiritual. Su imagen muestra a María junto al Niño Jesús, transmitiendo una expresión de ternura, cercanía y confianza. Esta advocación tiene su origen en Genazzano, Italia, y forma parte de una tradición religiosa extendida por diferentes comunidades católicas del mundo. En Catavi, representa un símbolo de fe y devoción para sus habitantes.",
    curioso: "El 25 de abril de 1467 es la fecha tradicionalmente asociada con la aparición de la imagen de Nuestra Señora del Buen Consejo en Genazzano, Italia. Su festividad se celebra cada año en esa fecha.",
    resumen: "Imagen mariana vinculada a la tradición religiosa de Catavi, símbolo de protección, fe y orientación espiritual para la comunidad."
  }
];

// ---------- Escena ----------
const $ = id => document.getElementById(id);
const cont = $("escena");

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
cont.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.01, 1000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.autoRotate = true;
controls.autoRotateSpeed = 1.5;

const luz = new THREE.DirectionalLight(0xfff1d6, 2);
luz.position.set(3, 5, 4);
scene.add(luz);

// ---------- Carga de piezas ----------
const loader = new GLTFLoader();
const cache = new Map();
let actual = 0;
let modelo = null;
let tabActiva = "sobre";

function cargar(i) {
  const p = PIEZAS[i];
  if (cache.has(i)) return Promise.resolve(cache.get(i));
  return new Promise((ok, fallo) => {
    loader.load(
      p.archivo,
      gltf => { cache.set(i, gltf.scene); ok(gltf.scene); },
      e => { if (e.total) $("pct").textContent = `Cargando… ${Math.round(e.loaded / e.total * 100)}%`; },
      fallo
    );
  });
}

function encuadrar(obj) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const centro = box.getCenter(new THREE.Vector3());
  obj.position.sub(centro); // centra en el origen
  const radio = Math.max(size.x, size.y, size.z) || 1;
  const dist = radio / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.8;
  camera.near = radio / 100;
  camera.far = radio * 100;
  camera.updateProjectionMatrix();
  camera.position.set(dist * 0.6, dist * 0.3, dist);
  controls.target.set(0, 0, 0);
  controls.minDistance = dist * 0.5;
  controls.maxDistance = dist * 2;
  controls.update();
}

async function mostrar(i) {
  actual = (i + PIEZAS.length) % PIEZAS.length;
  const p = PIEZAS[actual];

  $("cargando").style.display = "flex";
  $("pct").textContent = "Cargando…";

  $("contador").textContent = `${actual + 1} / ${PIEZAS.length}`;
  $("etiqueta").textContent = p.etiqueta;
  $("titulo").textContent = p.titulo;
  pintarTexto();
  document.querySelectorAll("#tira button").forEach((b, n) => b.classList.toggle("activa", n === actual));

  try {
    const obj = await cargar(actual);
    if (modelo) scene.remove(modelo);
    modelo = obj;
    scene.add(modelo);
    encuadrar(modelo);
    $("cargando").style.display = "none";
  } catch (err) {
    console.error("No se pudo cargar", p.archivo, err);
    $("pct").textContent = "No se pudo cargar el modelo";
  }
}

function pintarTexto() {
  const p = PIEZAS[actual];
  $("texto").textContent = p[tabActiva];
  $("resumen").textContent = p.resumen;
}

// ---------- Interfaz ----------
document.querySelectorAll(".pestanas button").forEach(b => {
  b.addEventListener("click", () => {
    tabActiva = b.dataset.p;
    document.querySelectorAll(".pestanas button").forEach(x => x.classList.toggle("activa", x === b));
    pintarTexto();
  });
});

$("anterior").onclick = () => mostrar(actual - 1);
$("siguiente").onclick = () => mostrar(actual + 1);

$("btn-giro").onclick = e => {
  controls.autoRotate = !controls.autoRotate;
  e.currentTarget.classList.toggle("activo", controls.autoRotate);
};
$("btn-centrar").onclick = () => modelo && encuadrar(modelo);
$("btn-pantalla").onclick = () =>
  document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
$("btn-info").onclick = e => {
  const oculto = $("panel").style.display === "none";
  $("panel").style.display = oculto ? "" : "none";
  e.currentTarget.classList.toggle("activo", oculto);
};
$("btn-foto").onclick = () => {
  renderer.render(scene, camera);
  const a = document.createElement("a");
  a.href = renderer.domElement.toDataURL("image/png");
  a.download = `catavi-${PIEZAS[actual].titulo.replace(/\s+/g, "-")}.png`;
  a.click();
  const f = $("flash");
  f.style.opacity = 1;
  setTimeout(() => (f.style.opacity = 0), 150);
};

// Tira de miniaturas
PIEZAS.forEach((p, i) => {
  const b = document.createElement("button");
  b.textContent = p.titulo;
  b.onclick = () => mostrar(i);
  $("tira").appendChild(b);
});

addEventListener("keydown", e => {
  if (e.key === "ArrowLeft") mostrar(actual - 1);
  if (e.key === "ArrowRight") mostrar(actual + 1);
});

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});

mostrar(0);
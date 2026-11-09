/* Galería interactiva: filtros, mosaico con inclinación 3D y visor con zoom */
(function () {
  const B = "assets/img/";

  // ===== FOTOS (edita aquí títulos y descripciones) =====
  // size: "wide" (ancha), "tall" (alta) o "" (normal)
  const FOTOS = [
    // EXTERIOR
    { cat: "exterior", src: "exterior/frontal.jpg", t: "Vista frontal", d: "Fachada principal de piedra labrada con campanario central.", size: "wide" },
    { cat: "exterior", src: "exterior/aerea.jpg", t: "Vista aérea", d: "Toma aérea del conjunto arquitectónico y la plaza.", size: "wide" },
    { cat: "exterior", src: "exterior/parte izquierda serca.png", t: "Frontal izquierda", d: "Perspectiva cercana desde el lado izquierdo del atrio.", size: "tall" },
    { cat: "exterior", src: "exterior/parte derecha serca.png", t: "Frontal derecha", d: "Perspectiva cercana desde el lado derecho del atrio.", size: "" },
    { cat: "exterior", src: "exterior/parte izquierda lejos.png", t: "Lateral izquierda", d: "Muro lateral izquierdo con contrafuertes visto a distancia.", size: "" },
    { cat: "exterior", src: "exterior/parte derecha lejos.png", t: "Lateral derecha", d: "Fachada lateral derecha con ventanas altas.", size: "" },
    { cat: "exterior", src: "exterior/parte tracera.png", t: "Vista trasera", d: "Parte posterior del templo y su integración con el entorno.", size: "" },
    { cat: "exterior", src: "exterior/parte tracera lejos .png", t: "Trasera lejana", d: "Vista panorámica de la parte posterior del templo.", size: "wide" },
    // INTERIOR
    { cat: "interior", src: "interior/nave.jpg", t: "Nave central", d: "Vista desde la entrada hacia el altar mayor con la nave central.", size: "wide" },
    { cat: "interior", src: "interior/altar.jpg", t: "Altar principal", d: "Retablo mayor cubierto en pan de oro con detalles barrocos.", size: "tall" },
    { cat: "interior", src: "interior/Altar empotrado.jpg", t: "Altar empotrado", d: "Altar empotrado en el muro del templo.", size: "" },
    { cat: "interior", src: "interior/vitral.jpg", t: "Vitrales", d: "Vitrales con iconografía religiosa que filtran la luz natural.", size: "" },
    { cat: "interior", src: "interior/vitrales.jpg", t: "Vitrales de colores", d: "Detalle de los vitrales del templo con luz tamizada.", size: "" },
    { cat: "interior", src: "interior/puerta_interior.jpg", t: "Puerta interior", d: "Puerta de acceso vista desde el interior de la nave.", size: "" },
    { cat: "interior", src: "interior/cuadro.jpg", t: "Cuadro devocional", d: "Cuadro religioso que forma parte del patrimonio del templo.", size: "" },
    { cat: "interior", src: "interior/cuadro1.jpg", t: "Cuadro devocional II", d: "Pintura religiosa conservada en el interior.", size: "" },
    { cat: "interior", src: "interior/cuadro2.jpg", t: "Cuadro devocional III", d: "Pintura religiosa conservada en el interior.", size: "" },
    // VIRGEN
    { cat: "virgen", src: "interior/Virgen del Buen Consejo 26 de abril.png", t: "Virgen del Buen Consejo", d: "Imagen devocional de la Virgen del Buen Consejo de Catavi, patrona celebrada el 26 de abril.", size: "tall" },
    { cat: "virgen", src: "interior/Virgen del Buen Consejo.jpg", t: "Nuestra Señora del Buen Consejo", d: "Advocación mariana venerada en el templo.", size: "" },
    // DETALLES
    { cat: "detalles", src: "portada/portada.jpg", t: "Portada principal", d: "Detalle de la portada de piedra con elementos ornamentales.", size: "wide" },
    { cat: "detalles", src: "detalles/puerta.jpg", t: "La puerta", d: "Puerta de entrada del templo.", size: "" },
    { cat: "detalles", src: "exterior/lateral.jpg", t: "Muro lateral", d: "Textura y aparejo del muro de piedra con contrafuertes.", size: "" },
    { cat: "detalles", src: "detalles/CATAVI FOTO.jpg", t: "Catavi", d: "Paisaje de Catavi y su entorno.", size: "wide" }
  ];

  const CATS = [
    ["all", "Todo"], ["exterior", "Exterior"], ["interior", "Interior"],
    ["virgen", "Virgen"], ["detalles", "Detalles"]
  ];
  const NOMBRE = Object.fromEntries(CATS);
  const url = s => encodeURI(B + s);

  const $ = id => document.getElementById(id);
  const grid = $("gallery"), tabsEl = $("tabs"), countEl = $("count");
  const lb = $("lightbox"), stage = $("lbStage"), img = $("lbImg");
  let visible = FOTOS.slice(), idx = 0, zoom = 1, px = 0, py = 0, timer = null;

  // ===== Barra de progreso =====
  const bar = $("progress");
  addEventListener("scroll", () => {
    const m = document.documentElement.scrollHeight - innerHeight;
    if (bar) bar.style.width = (m > 0 ? scrollY / m * 100 : 0) + "%";
  }, { passive: true });

  // ===== Filtros =====
  CATS.forEach(([k, n], i) => {
    const c = k === "all" ? FOTOS.length : FOTOS.filter(f => f.cat === k).length;
    const b = document.createElement("button");
    b.className = "tab" + (i === 0 ? " active" : "");
    b.dataset.cat = k;
    b.innerHTML = `${n}<small>${c}</small>`;
    b.onclick = () => {
      tabsEl.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t === b));
      filtrar(k);
    };
    tabsEl.appendChild(b);
  });

  // ===== Mosaico =====
  FOTOS.forEach((f, i) => {
    const fig = document.createElement("figure");
    fig.className = "g-item " + f.size;
    fig.innerHTML = `
      <img src="${url(f.src)}" alt="${f.t}" loading="lazy">
      <span class="tag">${NOMBRE[f.cat]}</span><span class="zoom">⤢</span>
      <figcaption><h4>${f.t}</h4><p>${f.d}</p></figcaption>`;
    fig.addEventListener("click", () => abrir(visible.indexOf(f)));
    // Inclinación 3D siguiendo el ratón
    fig.addEventListener("pointermove", e => {
      if (e.pointerType === "touch") return;
      const r = fig.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      fig.style.setProperty("--ry", ((x - 0.5) * 10) + "deg");
      fig.style.setProperty("--rx", ((0.5 - y) * 10) + "deg");
      fig.style.setProperty("--mx", x * 100 + "%");
      fig.style.setProperty("--my", y * 100 + "%");
    });
    fig.addEventListener("pointerleave", () => { fig.style.setProperty("--rx", "0deg"); fig.style.setProperty("--ry", "0deg"); });
    fig.addEventListener("error", () => {}, true);
    f.el = fig;
    grid.appendChild(fig);
  });
  grid.querySelectorAll("img").forEach(im => im.addEventListener("error", () => {
    console.warn("No se encontró la imagen:", decodeURI(im.src));
  }));

  function filtrar(cat) {
    visible = FOTOS.filter(f => cat === "all" || f.cat === cat);
    FOTOS.forEach(f => { f.el.classList.remove("show"); f.el.classList.add("out"); });
    setTimeout(() => {
      FOTOS.forEach(f => { f.el.style.display = visible.includes(f) ? "" : "none"; });
      visible.forEach((f, i) => setTimeout(() => { f.el.classList.remove("out"); f.el.classList.add("show"); }, i * 60));
      countEl.textContent = visible.length + " fotografías";
    }, 260);
  }
  filtrar("all");

  // ===== Visor =====
  function abrir(i) {
    if (i < 0) i = 0;
    lb.classList.add("open"); lb.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => lb.classList.add("vis"));
    document.body.style.overflow = "hidden";
    miniaturas();
    ir(i);
  }
  function cerrar() {
    parar();
    lb.classList.remove("vis");
    setTimeout(() => lb.classList.remove("open"), 300);
    lb.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }
  function miniaturas() {
    $("lbThumbs").innerHTML = "";
    visible.forEach((f, i) => {
      const t = document.createElement("img");
      t.src = url(f.src); t.alt = f.t; t.loading = "lazy";
      t.onclick = () => { reiniciar(); ir(i); };
      $("lbThumbs").appendChild(t);
    });
  }
  function ir(i) {
    idx = (i + visible.length) % visible.length;
    const f = visible[idx];
    img.classList.add("swap");
    setTimeout(() => {
      img.src = url(f.src); img.alt = f.t;
      resetZoom();
      img.onload = () => img.classList.remove("swap");
    }, 150);
    $("lbTitle").textContent = f.t;
    $("lbDesc").textContent = f.d;
    $("lbCount").textContent = `${idx + 1} / ${visible.length}`;
    $("lbDown").href = url(f.src);
    $("lbDown").download = f.t + ".jpg";
    document.querySelectorAll("#lbThumbs img").forEach((t, n) => {
      t.classList.toggle("on", n === idx);
      if (n === idx) t.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    });
  }
  const sig = () => { reiniciar(); ir(idx + 1); };
  const ant = () => { reiniciar(); ir(idx - 1); };

  // ===== Pase automático =====
  function auto() {
    if (timer) return parar();
    $("lbPlay").classList.add("on"); $("lbPlay").textContent = "❚❚";
    let t0 = performance.now();
    timer = setInterval(() => {
      const k = (performance.now() - t0) / 4000;
      $("lbBar").style.width = Math.min(k, 1) * 100 + "%";
      if (k >= 1) { t0 = performance.now(); ir(idx + 1); }
    }, 50);
  }
  function parar() {
    clearInterval(timer); timer = null;
    $("lbPlay").classList.remove("on"); $("lbPlay").textContent = "▶";
    $("lbBar").style.width = "0";
  }
  function reiniciar() { if (timer) { parar(); auto(); } }

  // ===== Zoom y arrastre =====
  function pintar() { img.style.transform = `translate(${px}px,${py}px) scale(${zoom})`; stage.classList.toggle("zoomed", zoom > 1); }
  function resetZoom() { zoom = 1; px = py = 0; pintar(); }
  function setZoom(z) { zoom = Math.min(Math.max(z, 1), 4); if (zoom === 1) px = py = 0; pintar(); }

  $("lbZoom").onclick = () => setZoom(zoom > 1 ? 1 : 2.2);
  stage.addEventListener("dblclick", () => setZoom(zoom > 1 ? 1 : 2.2));
  stage.addEventListener("wheel", e => { e.preventDefault(); setZoom(zoom + (e.deltaY < 0 ? 0.4 : -0.4)); }, { passive: false });

  let drag = null, sx = 0, sy = 0;
  stage.addEventListener("pointerdown", e => {
    drag = { x: e.clientX, y: e.clientY, px, py }; sx = e.clientX; sy = e.clientY;
    stage.setPointerCapture(e.pointerId);
    if (zoom > 1) stage.classList.add("drag");
    img.style.transition = "opacity .35s";
  });
  stage.addEventListener("pointermove", e => {
    if (!drag || zoom <= 1) return;
    px = drag.px + e.clientX - drag.x; py = drag.py + e.clientY - drag.y; pintar();
  });
  stage.addEventListener("pointerup", e => {
    stage.classList.remove("drag");
    img.style.transition = "";
    // Deslizar para cambiar de foto (solo sin zoom)
    const dx = e.clientX - sx;
    if (drag && zoom === 1 && Math.abs(dx) > 60 && Math.abs(e.clientY - sy) < 80) dx < 0 ? sig() : ant();
    drag = null;
  });

  // ===== Controles =====
  $("lbClose").onclick = cerrar;
  $("lbPrev").onclick = ant;
  $("lbNext").onclick = sig;
  $("lbPlay").onclick = auto;
  lb.addEventListener("click", e => { if (e.target === lb) cerrar(); });
  document.addEventListener("keydown", e => {
    if (!lb.classList.contains("open")) return;
    if (e.key === "Escape") cerrar();
    else if (e.key === "ArrowLeft") ant();
    else if (e.key === "ArrowRight") sig();
    else if (e.key === " ") { e.preventDefault(); auto(); }
    else if (e.key === "+" || e.key === "=") setZoom(zoom + 0.4);
    else if (e.key === "-") setZoom(zoom - 0.4);
  });
})();
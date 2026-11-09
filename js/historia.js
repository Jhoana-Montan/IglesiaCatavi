(function () {
  const bar = document.getElementById("progress");
  const heroBg = document.getElementById("heroBg");
  const tl = document.getElementById("tl");
  const fill = document.getElementById("tlFill");

  // Aparición al hacer scroll
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll(".rv").forEach(el => io.observe(el));

  function onScroll() {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;

    // Barra de progreso de lectura
    if (bar) bar.style.width = (max > 0 ? (y / max) * 100 : 0) + "%";

    // Parallax de la foto de cabecera
    if (heroBg && y < window.innerHeight * 1.2) {
      heroBg.style.transform = "translateY(" + y * 0.25 + "px)";
    }

    // La línea de tiempo se dibuja al bajar
    if (tl && fill) {
      const r = tl.getBoundingClientRect();
      const reach = window.innerHeight * 0.6 - r.top;
      fill.style.height = Math.max(0, Math.min(reach, r.height)) + "px";
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll();
})();
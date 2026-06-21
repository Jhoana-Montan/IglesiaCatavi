/* Galería: filtros + lightbox con navegación */
(function(){
  const tabs    = document.querySelectorAll(".gallery-tabs .tab");
  const items   = Array.from(document.querySelectorAll(".g-item"));
  const lb      = document.getElementById("lightbox");
  const lbImg   = document.getElementById("lbImg");
  const lbTitle = document.getElementById("lbTitle");
  const lbDesc  = document.getElementById("lbDesc");
  const lbClose = document.getElementById("lbClose");
  const lbPrev  = document.getElementById("lbPrev");
  const lbNext  = document.getElementById("lbNext");
  let visible = items.slice();
  let index   = 0;

  // FILTROS
  tabs.forEach(tab => tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    const cat = tab.dataset.cat;
    items.forEach(it => {
      const show = cat === "all" || it.dataset.cat === cat;
      it.classList.toggle("hide", !show);
    });
    visible = items.filter(it => !it.classList.contains("hide"));
  }));

  // LIGHTBOX
  function open(i){
    if (!visible.length) return;
    index = (i + visible.length) % visible.length;
    const img = visible[index].querySelector("img");
    lbImg.src = img.src;
    lbImg.alt = img.alt;
    lbTitle.textContent = img.dataset.title || img.alt;
    lbDesc.textContent  = img.dataset.desc || "";
    lb.classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function close(){
    lb.classList.remove("open");
    document.body.style.overflow = "";
  }

  items.forEach((it, i) => it.addEventListener("click", () => {
    visible = items.filter(x => !x.classList.contains("hide"));
    const vi = visible.indexOf(it);
    open(vi >= 0 ? vi : 0);
  }));

  lbClose.addEventListener("click", close);
  lbPrev.addEventListener("click", () => open(index - 1));
  lbNext.addEventListener("click", () => open(index + 1));
  lb.addEventListener("click", (e) => { if (e.target === lb) close(); });
  document.addEventListener("keydown", (e) => {
    if (!lb.classList.contains("open")) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") open(index - 1);
    if (e.key === "ArrowRight") open(index + 1);
  });
})();

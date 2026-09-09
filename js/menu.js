/* Menú móvil + activo automático según URL */
(function(){
  const toggle = document.getElementById("navToggle");
  const links  = document.getElementById("navLinks");
  if (toggle && links){
    toggle.addEventListener("click", () => links.classList.toggle("open"));
    links.querySelectorAll("a").forEach(a => a.addEventListener("click", () => links.classList.remove("open")));
  }
  // sombra al hacer scroll
  const nav = document.querySelector(".navbar");
  if (nav){
    const onScroll = () => nav.style.boxShadow = window.scrollY > 10 ? "0 8px 30px -10px rgba(0,0,0,.6)" : "none";
    window.addEventListener("scroll", onScroll, {passive:true}); onScroll();
  }
})();

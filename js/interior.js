import * as THREE from "three";

// ======================================================
// INTERIOR DE LA IGLESIA
// - Se carga solo cuando se hace clic en la puerta (ahorra carga inicial).
// - Al entrar empiezas en PRIMERA PERSONA, junto a la puerta, mirando al altar.
//     W A S D caminar · SHIFT correr · arrastra el ratón para mirar.
// - Tecla C: controlar al cura (cámara detrás y por encima de él).
//            C otra vez: lo sueltas y vuelves a primera persona.
// - Tecla V: cambia de cámara (primera persona → atrás → hombros).
// - Tecla L: encender / apagar la luz del interior.
// - La cámara NUNCA sale de la estructura: choca con paredes, techo y suelo,
//   y además está limitada al tamaño del interior.
// ======================================================

export function createInterior(ctx) {
    const { scene, camera, renderer, controls, loader, setExteriorVisible } = ctx;

    // ---------- AJUSTES (puedes tocar estos valores) ----------
    const CONFIG = {
        modelPath: "assets/models/interior-iglesia-final.glb",
        priestPath: "assets/models/cura.glb",

        // El interior se escala para que su lado más largo mida esto (metros).
        lengthMeters: 32,
        priestHeight: 2.95,
        modelFacesBackward: false, // pon true si el cura camina de espaldas

        radius: 0.35,    // "grosor" del cura (y tuyo) para chocar
        walkSpeed: 1.7,  // m/s del cura
        runSpeed: 3.6,   // m/s del cura (con SHIFT)
        stepUp: 0.45,    // escalón máximo que se puede subir
        maxDrop: 1.5,    // caída máxima que se puede bajar

        // ---- PRIMERA PERSONA (cuando no controlas al cura) ----
        eyeHeight: 2.5,    // altura de los ojos (el cura mide 2.95)
        fpWalkSpeed: 2.6,  // m/s
        fpRunSpeed: 5.5,   // m/s (con SHIFT)

        // La cámara no puede acercarse a menos de esto (metros) del borde del interior.
        wallMargin: 0.3,

        // Lado donde está el altar. "auto" lo deduce solo (busca el crucifijo por nombre).
        // Si al entrar ves la pared de la puerta en vez del altar, pon "+z", "-z", "+x" o "-x"
        // (la consola del navegador, F12, te dice cuál probar).
        altarSide: "auto",

        // ---- VISTA INICIAL (al entrar) ----
        intro: {
            // Palabras que identifican al crucifijo en el .glb (separadas por |).
            // Con eso la cámara se inclina justo lo necesario para verlo COMPLETO.
            crucifix: "crucifij|cristo|jesus|jesús|christ|cross|cruz",
            backFromDoor: 2.5, // metros que te separas de la pared de la puerta
            lookUp: 0.12,      // inclinación hacia arriba si no se encuentra el crucifijo (radianes)
            priestAt: 0.36     // dónde empieza el cura: 0 = centro, 0.5 = pared del altar
        },

        // Altura del suelo en metros (0 = punto más bajo del modelo).
        // null = detectarlo solo. Si el cura sale hundido o flotando, mira en
        // la consola (F12) el valor "suelo detectado" y pon aquí otro número.
        floorY: null,
        minNaveHeight: 3.0, // altura mínima que debe tener la nave sobre el suelo

        // ---- ILUMINACIÓN: LUZ APAGADA (ambiente oscuro, es el estado inicial) ----
        exposure: 0.3,
        light: { intensity: 70, distance: 10, ambient: 0.2, follow: 4 },

        // ---- ILUMINACIÓN: LUZ ENCENDIDA (botón "Encender luz" o tecla L) ----
        // Sube estos valores para más claridad.
        bright: { exposure: 0.8, intensity: 160, ambient: 1.0, follow: 6 }
    };

    // Cámaras cuando controlas al cura (tercera persona).
    const CAMS = {
        back: { label: "atrás", distance: 4.8, side: 0, lift: 0.3, pitch: 0.22 },
        shoulder: { label: "hombros", distance: 1.5, side: 0.45, lift: 0.1, pitch: 0.12 }
    };

    // ---------- ESTADO ----------
    let active = false;
    let busy = false;
    let loaded = false;
    let controlling = false; // true = controlas al cura · false = primera persona
    let camMode = "back";
    let camYaw = 0;
    let camPitch = 0;        // positivo = mira hacia abajo, negativo = hacia arriba
    let camZoom = 1;
    let camSnap = false;
    let timeAcc = 0;

    let floorLevel = 0;
    let ceilingLevel = 0;

    // Luz del interior: 0 = apagada (oscuro), 1 = encendida (claro).
    let lightLevel = 0;
    let lightTarget = 0;
    let ambientLight = null;
    let followLight = null;
    const pointLights = [];

    let root = null;
    let collidables = [];
    const bounds = new THREE.Box3();
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();

    // Nave: naveDir apunta de la puerta hacia el altar.
    const naveDir = new THREE.Vector3(0, 0, -1);
    let naveLen = 1;
    let crucifixBox = null;

    let rig = null;
    let model = null;
    let modelBaseY = 0;
    let mixer = null;
    let action = null;

    // Tú en primera persona (posición de los pies).
    const walker = new THREE.Vector3();

    const ai = { target: null, wait: 0, stuck: 0, timer: 0 };
    const keys = {};
    const saved = {};
    const lights = new THREE.Group();

    const rc = new THREE.Raycaster();
    rc.firstHitOnly = true; // lo usa three-mesh-bvh para ir más rápido
    const DOWN = new THREE.Vector3(0, -1, 0);
    const UP = new THREE.Vector3(0, 1, 0);
    const _n = new THREE.Vector3();
    const _a = new THREE.Vector3();
    const _b = new THREE.Vector3();
    const _c = new THREE.Vector3();
    const _d = new THREE.Vector3();
    const _e = new THREE.Vector3();

    const pivot = new THREE.Vector3();
    const desired = new THREE.Vector3();
    const forward = new THREE.Vector3();
    const lookAt = new THREE.Vector3();

    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

    // ---------- PANTALLA NEGRA DE TRANSICIÓN ----------
    const overlay = document.createElement("div");
    Object.assign(overlay.style, {
        position: "fixed", inset: "0", zIndex: "50", background: "#05070d",
        color: "#ffe27a", display: "flex", alignItems: "center",
        justifyContent: "center", fontFamily: "Inter, sans-serif",
        fontSize: "18px", textAlign: "center", padding: "20px",
        opacity: "0", pointerEvents: "none", transition: "opacity .5s ease"
    });
    document.body.appendChild(overlay);

    async function showOverlay(text) {
        overlay.textContent = text;
        overlay.style.pointerEvents = "auto";
        overlay.style.opacity = "1";
        await wait(520);
    }

    function hideOverlay() {
        overlay.style.opacity = "0";
        overlay.style.pointerEvents = "none";
    }

    // ---------- PANEL DE AYUDA ----------
    const help = document.createElement("div");
    Object.assign(help.style, {
        position: "fixed", bottom: "25px", left: "50%", transform: "translateX(-50%)",
        zIndex: "9", maxWidth: "calc(100% - 30px)", padding: "12px 18px",
        border: "1px solid rgba(255,215,0,.4)", borderRadius: "12px",
        background: "rgba(5,8,18,.88)", color: "#fff", fontSize: "13px",
        lineHeight: "1.6", textAlign: "center", display: "none",
        fontFamily: "Inter, sans-serif", pointerEvents: "none"
    });
    document.body.appendChild(help);

    let btnControl = null;
    let btnCam = null;
    let btnLamp = null;
    const hiddenButtons = ["btnAuto", "btnVirgen", "btnWalk", "btnTour", "btnLight", "walkHelp"];

    function makeButton(text, onClick) {
        const button = document.createElement("button");
        button.type = "button";
        button.innerHTML = `<span>${text}</span>`;
        button.addEventListener("click", event => {
            event.stopPropagation();
            onClick();
            button.blur();
        });
        return button;
    }

    function setButtonText(button, text) {
        const span = button && button.querySelector("span");
        if (span) span.textContent = text;
    }

    function refreshUI() {
        setButtonText(
            btnControl,
            controlling ? "Soltar al cura (C)" : "Controlar al cura (C)"
        );
        setButtonText(
            btnCam,
            `Cámara: ${controlling ? CAMS[camMode].label : "primera persona"} (V)`
        );
        setButtonText(
            btnLamp,
            lightTarget ? "💡 Apagar luz (L)" : "💡 Encender luz (L)"
        );

        help.textContent = controlling
            ? "Controlas al cura: W A S D para moverte · SHIFT para correr · " +
              "arrastra el ratón para mirar · rueda para acercar · " +
              "V cambia la cámara · L la luz · C lo suelta (primera persona)"
            : "Primera persona: W A S D para caminar · SHIFT para correr · " +
              "arrastra el ratón para mirar · C para controlar al cura · " +
              "V cambia la cámara · L la luz · botón Salir al exterior para volver";
    }

    function createUI() {
        const nav = document.querySelector(".controls-3d");
        if (!nav) return;

        btnControl = makeButton("Controlar al cura (C)", () => setControl(!controlling));
        btnCam = makeButton("Cámara (V)", cycleCamera);
        btnLamp = makeButton("💡 Encender luz (L)", toggleLight);

        nav.insertBefore(btnCam, nav.firstChild);
        nav.insertBefore(btnControl, nav.firstChild);
        nav.insertBefore(btnLamp, btnCam.nextSibling);

        // Se ocultan los controles del exterior (incluido el sol Día/Atardecer/Noche).
        // Se marcan para que "Ocultar/Mostrar controles" no los vuelva a mostrar.
        hiddenButtons.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.style.display = "none";
            el.dataset.hiddenByInterior = "1";
        });

        const reset = document.getElementById("btnReset");
        if (reset) {
            saved.resetText = reset.querySelector("span")?.textContent;
            setButtonText(reset, "Salir al exterior");
        }

        const hint = document.getElementById("hint");
        if (hint) hint.style.display = "none";

        help.style.display = "block";
        refreshUI();
    }

    function removeUI() {
        if (btnControl) btnControl.remove();
        if (btnCam) btnCam.remove();
        if (btnLamp) btnLamp.remove();
        btnControl = null;
        btnCam = null;
        btnLamp = null;

        hiddenButtons.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.style.display = "";
            delete el.dataset.hiddenByInterior;
        });

        const reset = document.getElementById("btnReset");
        if (reset && saved.resetText) setButtonText(reset, saved.resetText);

        const hint = document.getElementById("hint");
        if (hint) hint.style.display = "";

        help.style.display = "none";
    }

    // ---------- LUZ DEL INTERIOR ----------
    function applyLight() {
        const k = lightLevel;
        const mix = (a, b) => a + (b - a) * k;

        renderer.toneMappingExposure = mix(CONFIG.exposure, CONFIG.bright.exposure);

        if (ambientLight) {
            ambientLight.intensity = mix(CONFIG.light.ambient, CONFIG.bright.ambient);
        }

        pointLights.forEach(light => {
            light.intensity = mix(CONFIG.light.intensity, CONFIG.bright.intensity);
        });

        if (followLight) {
            followLight.intensity = mix(CONFIG.light.follow, CONFIG.bright.follow);
        }
    }

    function toggleLight() {
        if (!active) return;
        lightTarget = lightTarget ? 0 : 1;
        refreshUI();
    }

    // ---------- COLISIONES ----------
    function hitNormalY(hit) {
        if (!hit.face) return 1;
        _n.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
        return _n.y;
    }

    // ¿Hay una pared (superficie casi vertical) en esa dirección?
    function wallRay(origin, dirX, dirZ, length) {
        _a.set(dirX, 0, dirZ);
        rc.set(origin, _a);
        rc.near = 0;
        rc.far = length;

        const hit = rc.intersectObjects(collidables, false)[0];
        return !!hit && Math.abs(hitNormalY(hit)) < 0.75;
    }

    // topHeight (opcional): una altura extra de revisión, para que la cabeza
    // de la cámara en primera persona tampoco atraviese vigas o arcos.
    function wallAhead(p, ax, az, topHeight) {
        const len = Math.hypot(ax, az);
        const base = Math.atan2(ax, az);
        const heights = topHeight ? [0.55, 1.1, 1.65, topHeight] : [0.55, 1.1, 1.65];

        for (const h of heights) {
            for (const off of [-0.5, 0, 0.5]) {
                _b.set(p.x, p.y + h, p.z);
                if (wallRay(_b, Math.sin(base + off), Math.cos(base + off), CONFIG.radius + len)) {
                    return true;
                }
            }
        }

        return false;
    }

    function isClear(x, y, z) {
        for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2;
            _b.set(x, y + 1.1, z);
            if (wallRay(_b, Math.sin(a), Math.cos(a), CONFIG.radius + 0.15)) return false;
        }
        return true;
    }

    function groundAtFrom(x, z, originY, far) {
        _c.set(x, originY, z);
        rc.set(_c, DOWN);
        rc.near = 0;
        rc.far = far;

        const hit = rc.intersectObjects(collidables, false)[0];
        if (!hit || Math.abs(hitNormalY(hit)) < 0.5) return null;

        return hit.point.y;
    }

    function groundAt(x, z, refY) {
        return groundAtFrom(
            x, z,
            refY + CONFIG.stepUp + 0.1,
            CONFIG.stepUp + 0.1 + CONFIG.maxDrop
        );
    }

    // Nunca deja que un cuerpo salga del rectángulo del interior.
    function keepInside(p) {
        const m = CONFIG.wallMargin;
        p.x = clamp(p.x, bounds.min.x + m, bounds.max.x - m);
        p.z = clamp(p.z, bounds.min.z + m, bounds.max.z - m);
    }

    // Mueve un cuerpo (el cura o tú) solo si no choca. Si choca de frente, intenta deslizarse.
    function moveBody(p, dx, dz, dt, topHeight) {
        for (const [ax, az] of [[dx, dz], [dx, 0], [0, dz]]) {
            if (Math.abs(ax) < 1e-5 && Math.abs(az) < 1e-5) continue;
            if (wallAhead(p, ax, az, topHeight)) continue;

            const gy = groundAt(p.x + ax, p.z + az, p.y);
            if (gy === null || gy - p.y > CONFIG.stepUp) continue;

            p.x += ax;
            p.z += az;
            p.y += (gy - p.y) * Math.min(1, dt * 14);
            keepInside(p);

            return true;
        }

        return false;
    }

    function moveRig(dx, dz, dt) {
        return moveBody(rig.position, dx, dz, dt);
    }

    function turnTo(angle, dt) {
        let diff = angle - rig.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        rig.rotation.y += diff * Math.min(8 * dt, 1);
        return Math.abs(diff);
    }

    // Espacio libre sobre la cabeza (para no atravesar un techo bajo, como un coro).
    function headroom(p) {
        _c.set(p.x, p.y + 0.5, p.z);
        rc.set(_c, UP);
        rc.near = 0;
        rc.far = CONFIG.eyeHeight + 2;

        const hit = rc.intersectObjects(collidables, false)[0];
        return hit ? hit.point.y - 0.15 : Infinity;
    }

    // ¿No hay nada tapando el cielo de la nave sobre ese punto? (para no empezar bajo un coro)
    function openAbove(x, gy, z) {
        const lowCeil = floorLevel + (ceilingLevel - floorLevel) * 0.7;
        const eyeY = gy + CONFIG.eyeHeight;

        _c.set(x, eyeY, z);
        rc.set(_c, UP);
        rc.near = 0;
        rc.far = Math.max(0.1, lowCeil - eyeY);

        return rc.intersectObjects(collidables, false).length === 0;
    }

    // ---------- CURA ----------
    function setMoving(moving) {
        if (action) {
            action.paused = !moving;
        } else if (model) {
            model.position.y =
                modelBaseY + (moving ? Math.abs(Math.sin(timeAcc * 8)) * 0.03 : 0);
        }
    }

    function buildPriest(gltf) {
        rig = new THREE.Group();

        if (gltf) {
            model = gltf.scene;
            model.rotation.y = CONFIG.modelFacesBackward ? Math.PI : 0;
            model.updateMatrixWorld(true);

            const box = new THREE.Box3().setFromObject(model);
            const s = box.getSize(new THREE.Vector3());
            model.scale.multiplyScalar(CONFIG.priestHeight / Math.max(s.y, 0.001));
            model.updateMatrixWorld(true);

            box.setFromObject(model);
            const c = box.getCenter(new THREE.Vector3());
            model.position.set(-c.x, -box.min.y, -c.z);

            model.traverse(o => {
                if (o.isMesh) {
                    o.castShadow = false;
                    o.frustumCulled = false;
                }
            });

            if (gltf.animations && gltf.animations.length) {
                mixer = new THREE.AnimationMixer(model);
                action = mixer.clipAction(gltf.animations[0]);
                action.play();
                action.paused = true;
            }
        } else {
            model = new THREE.Mesh(
                new THREE.CapsuleGeometry(0.25, CONFIG.priestHeight - 0.5, 4, 12),
                new THREE.MeshStandardMaterial({ color: 0x222222 })
            );
            model.position.y = CONFIG.priestHeight / 2;
        }

        modelBaseY = model.position.y;
        rig.add(model);

        // Luz suave que acompaña al cura para que siempre se vea.
        followLight = new THREE.PointLight(0xffe2b0, CONFIG.light.follow, 8, 2);
        followLight.position.set(0, CONFIG.priestHeight + 0.6, 0.4);
        rig.add(followLight);
    }

    // ---------- SUELO, TECHO, ALTAR Y VISTA INICIAL ----------

    // Todas las superficies horizontales en x, z (da igual hacia dónde miren).
    function surfacesAt(x, z) {
        const ys = [];
        const previous = rc.firstHitOnly;

        rc.firstHitOnly = false;
        rc.near = 0;
        rc.far = size.y + 4;

        [[bounds.max.y + 1, DOWN], [bounds.min.y - 1, UP]].forEach(([startY, dir]) => {
            _a.set(x, startY, z);
            rc.set(_a, dir);

            rc.intersectObjects(collidables, false).forEach(hit => {
                if (Math.abs(hitNormalY(hit)) > 0.7) ys.push(hit.point.y);
            });
        });

        rc.firstHitOnly = previous;
        ys.sort((a, b) => a - b);

        return ys.filter((y, i) => i === 0 || y - ys[i - 1] > 0.05);
    }

    // Para un punto: [suelo, techo] = la superficie más baja con espacio libre de nave encima.
    function levelsAt(x, z) {
        const ys = surfacesAt(x, z);

        for (let i = 0; i < ys.length - 1; i++) {
            if (ys[i + 1] - ys[i] >= CONFIG.minNaveHeight) return [ys[i], ys[i + 1]];
        }

        return null;
    }

    function detectLevels() {
        const floors = [];
        const ceilings = [];

        for (let i = -2; i <= 2; i++) {
            for (let j = -2; j <= 2; j++) {
                const lv = levelsAt(center.x + i * size.x * 0.12, center.z + j * size.z * 0.12);
                if (lv) {
                    floors.push(lv[0]);
                    ceilings.push(lv[1]);
                }
            }
        }

        const median = list => {
            list.sort((a, b) => a - b);
            return list[Math.floor(list.length / 2)];
        };

        let floor;
        let ceil;

        if (floors.length) {
            floor = median(floors);
            ceil = median(ceilings);
        } else {
            console.warn("No se detectó el suelo del interior; usa CONFIG.floorY.");
            floor = bounds.min.y + 0.05;
            ceil = bounds.max.y;
        }

        if (CONFIG.floorY !== null) floor = CONFIG.floorY;

        // El techo nunca puede quedar más bajo de lo que ocupa el cura con holgura.
        ceil = Math.max(ceil, floor + CONFIG.priestHeight + 2);

        return { floor, ceil };
    }

    // Busca el crucifijo por nombre dentro del .glb para poder encuadrarlo completo.
    function findCrucifix() {
        crucifixBox = null;

        let re;
        try {
            re = new RegExp(CONFIG.intro.crucifix, "i");
        } catch (error) {
            console.warn("CONFIG.intro.crucifix no es un texto válido.", error);
            return;
        }

        const box = new THREE.Box3();
        const names = new Set();
        let bestName = "";
        let bestHeight = 0;

        root.traverse(o => {
            if (o === root || !o.name) return;
            names.add(o.name);
            if (!re.test(o.name)) return;

            box.setFromObject(o);
            if (box.isEmpty()) return;

            const h = box.max.y - box.min.y;
            const w = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);

            // Se descartan objetos gigantes (por ejemplo, un grupo que contiene toda la iglesia).
            if (h > size.y * 0.6 || w > Math.min(size.x, size.z) * 0.4) return;

            if (h > bestHeight) {
                bestHeight = h;
                bestName = o.name;
                crucifixBox = box.clone();
            }
        });

        if (crucifixBox) {
            console.log(
                `Crucifijo encontrado: "${bestName}" (de ${crucifixBox.min.y.toFixed(2)} ` +
                `a ${crucifixBox.max.y.toFixed(2)} m de altura).`
            );
        } else {
            console.warn(
                "No encontré el crucifijo por nombre; la vista inicial usa CONFIG.intro.lookUp. " +
                "Estos son nombres de objetos del interior (pon el del crucifijo en CONFIG.intro.crucifix):",
                Array.from(names).slice(0, 120)
            );
        }
    }

    // Decide hacia dónde va la nave: naveDir apunta de la puerta hacia el altar.
    function computeNave() {
        let alongX = size.x >= size.z;
        let sign = -1; // por defecto el altar está en el lado negativo
        const side = String(CONFIG.altarSide).toLowerCase().trim();

        if (/^[+-][xz]$/.test(side)) {
            alongX = side[1] === "x";
            sign = side[0] === "+" ? 1 : -1;
        } else if (crucifixBox) {
            crucifixBox.getCenter(_e);
            const off = alongX ? _e.x - center.x : _e.z - center.z;
            if (Math.abs(off) > 1) sign = Math.sign(off);
        }

        naveDir.set(alongX ? sign : 0, 0, alongX ? 0 : sign);
        naveLen = alongX ? size.x : size.z;

        console.log(
            `Nave a lo largo de ${alongX ? "X" : "Z"}, altar en el lado ${sign > 0 ? "+" : "-"}. ` +
            `Si al entrar ves la puerta en vez del altar, pon CONFIG.altarSide = ` +
            `"${sign > 0 ? "-" : "+"}${alongX ? "x" : "z"}".`
        );
    }

    // Punto libre (con suelo y sin paredes cerca) lo más cerca posible de x, z.
    function findFreeSpot(baseX, baseZ) {
        for (let r = 0; r <= 6; r++) {
            const n = r === 0 ? 1 : 8;

            for (let k = 0; k < n; k++) {
                const a = (k / n) * Math.PI * 2;
                const x = baseX + Math.sin(a) * r;
                const z = baseZ + Math.cos(a) * r;
                const gy = groundAtFrom(x, z, floorLevel + 0.8, 1.6);

                if (gy !== null && isClear(x, gy, z)) {
                    return new THREE.Vector3(x, gy, z);
                }
            }
        }

        console.warn("No se encontró un punto libre; revisa CONFIG.intro.");
        return new THREE.Vector3(baseX, floorLevel, baseZ);
    }

    // Tu punto de partida: en el pasillo central, junto a la puerta, con el cielo despejado.
    function findIntroSpot() {
        const start = -(naveLen / 2 - CONFIG.intro.backFromDoor);

        for (let t = start; t <= 0; t += 1) {
            const x = center.x + naveDir.x * t;
            const z = center.z + naveDir.z * t;
            const gy = groundAtFrom(x, z, floorLevel + 0.8, 1.6);

            if (gy === null || !isClear(x, gy, z) || !openAbove(x, gy, z)) continue;

            return new THREE.Vector3(x, gy, z);
        }

        return null;
    }

    // Coloca al cura cerca del altar y a ti en la puerta, mirando al altar con el crucifijo completo.
    function placeIntro() {
        const priestT = naveLen * CONFIG.intro.priestAt;
        const priestSpot = findFreeSpot(
            center.x + naveDir.x * priestT,
            center.z + naveDir.z * priestT
        );

        rig.position.copy(priestSpot);
        rig.rotation.set(0, Math.atan2(-naveDir.x, -naveDir.z), 0); // mira hacia la puerta
        ai.target = null;
        ai.wait = 1;

        walker.copy(findIntroSpot() || findFreeSpot(center.x, center.z));

        camYaw = Math.atan2(naveDir.x, naveDir.z);
        camPitch = -CONFIG.intro.lookUp;

        if (crucifixBox) {
            crucifixBox.getCenter(_e);
            const dist = (_e.x - walker.x) * naveDir.x + (_e.z - walker.z) * naveDir.z;

            if (dist > 1) {
                // Se inclina solo lo necesario para que la punta del crucifijo
                // quede al 88 % de la altura de la pantalla.
                const half = THREE.MathUtils.degToRad(camera.fov / 2);
                const edge = Math.atan(0.88 * Math.tan(half));
                const eyeY = walker.y + CONFIG.eyeHeight;
                const up = Math.atan((crucifixBox.max.y + 0.4 - eyeY) / dist);

                camPitch = -clamp(up - edge, 0, 0.3);
            }
        }
    }

    // Al soltar al cura: tú empiezas a caminar donde estaba la cámara.
    function placeWalkerFromCamera() {
        const p = rig.position;

        _e.set(camera.position.x - p.x, 0, camera.position.z - p.z);
        const dist = _e.length();

        if (dist > 0.001) {
            _e.divideScalar(dist);
        } else {
            _e.set(-Math.sin(rig.rotation.y), 0, -Math.cos(rig.rotation.y));
        }

        const dirX = _e.x;
        const dirZ = _e.z;
        const candidates = [
            [camera.position.x, camera.position.z],
            [p.x + dirX * 1.5, p.z + dirZ * 1.5],
            [p.x + dirX * 3, p.z + dirZ * 3]
        ];

        for (const [x, z] of candidates) {
            const gy = groundAt(x, z, p.y);

            if (gy !== null && Math.abs(gy - p.y) < 0.8 && isClear(x, gy, z)) {
                walker.set(x, gy, z);
                return;
            }
        }

        walker.set(p.x + dirX * 1.2, p.y, p.z + dirZ * 1.2);
    }

    // ---------- CURA CAMINANDO SOLO ----------
    function pickTarget() {
        const p = rig.position;
        const margin = 1.0;

        for (let i = 0; i < 25; i++) {
            const x = bounds.min.x + margin + Math.random() * (size.x - margin * 2);
            const z = bounds.min.z + margin + Math.random() * (size.z - margin * 2);
            const gy = groundAt(x, z, p.y);

            if (gy !== null && Math.abs(gy - p.y) < 0.8 && isClear(x, gy, z)) {
                ai.target = { x, z };
                ai.timer = 0;
                return;
            }
        }
    }

    function updateWander(dt) {
        const p = rig.position;

        if (ai.wait > 0) {
            ai.wait -= dt;
            setMoving(false);
            return;
        }

        if (!ai.target) {
            pickTarget();
            if (!ai.target) ai.wait = 0.5;
            return;
        }

        ai.timer += dt;

        const dx = ai.target.x - p.x;
        const dz = ai.target.z - p.z;
        const dist = Math.hypot(dx, dz);

        if (dist < 0.4 || ai.timer > 25) {
            ai.target = null;
            ai.wait = 1 + Math.random() * 2.5;
            setMoving(false);
            return;
        }

        if (turnTo(Math.atan2(dx, dz), dt) > 0.5) {
            setMoving(false);
            return;
        }

        const step = CONFIG.walkSpeed * 0.7 * dt;
        const moved = moveRig((dx / dist) * step, (dz / dist) * step, dt);
        setMoving(moved);

        if (moved) {
            ai.stuck = 0;
        } else {
            ai.stuck += dt;

            if (ai.stuck > 0.6) {
                ai.target = null;
                ai.stuck = 0;
                ai.wait = 0.3;
            }
        }
    }

    // ---------- DIRECCIÓN DE MOVIMIENTO SEGÚN HACIA DÓNDE MIRAS ----------
    function inputDirection(out) {
        const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
        const r = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);

        if (!f && !r) return false;

        const fx = Math.sin(camYaw);
        const fz = Math.cos(camYaw);

        let dx = fx * f + -fz * r;
        let dz = fz * f + fx * r;

        const len = Math.hypot(dx, dz) || 1;
        out.x = dx / len;
        out.z = dz / len;

        return true;
    }

    const move = { x: 0, z: 0 };

    // ---------- CURA CONTROLADO POR TI ----------
    function updateControlled(dt) {
        if (!inputDirection(move)) {
            setMoving(false);
            return;
        }

        const speed = keys.ShiftLeft || keys.ShiftRight ? CONFIG.runSpeed : CONFIG.walkSpeed;

        turnTo(Math.atan2(move.x, move.z), dt);
        setMoving(moveRig(move.x * speed * dt, move.z * speed * dt, dt));
    }

    // ---------- TÚ EN PRIMERA PERSONA ----------
    function updateWalker(dt) {
        if (!inputDirection(move)) return;

        const speed = keys.ShiftLeft || keys.ShiftRight ? CONFIG.fpRunSpeed : CONFIG.fpWalkSpeed;

        moveBody(
            walker,
            move.x * speed * dt,
            move.z * speed * dt,
            dt,
            CONFIG.eyeHeight - 0.2
        );
    }

    // ---------- CÁMARA ----------

    // Mantiene la cámara dentro del interior: nunca fuera de los muros,
    // ni por debajo del suelo ni por encima del techo.
    function constrainCamera(v) {
        const m = CONFIG.wallMargin;

        v.x = clamp(v.x, bounds.min.x + m, bounds.max.x - m);
        v.z = clamp(v.z, bounds.min.z + m, bounds.max.z - m);
        v.y = clamp(v.y, floorLevel + 0.3, ceilingLevel - 0.3);

        return v;
    }

    // Si hay una pared entre el punto de mira y la cámara, acerca la cámara.
    function clipCamera(from, to) {
        _d.copy(to).sub(from);
        const d = _d.length();
        if (d < 0.001) return to;
        _d.normalize();

        rc.set(from, _d);
        rc.near = 0;
        rc.far = d + 0.25;

        const hit = rc.intersectObjects(collidables, false)[0];
        if (hit) to.copy(from).addScaledVector(_d, Math.max(0.35, hit.distance - 0.25));

        return to;
    }

    function viewDirection() {
        const cp = Math.cos(camPitch);
        return forward.set(Math.sin(camYaw) * cp, -Math.sin(camPitch), Math.cos(camYaw) * cp);
    }

    // Tercera persona: detrás del cura y un poco por encima de su cabeza.
    function updateThirdPerson(dt) {
        const cfg = CAMS[camMode];
        const p = rig.position;

        viewDirection();

        pivot.set(p.x, p.y + CONFIG.priestHeight * 0.88 + cfg.lift, p.z);
        pivot.x += -Math.cos(camYaw) * cfg.side;
        pivot.z += Math.sin(camYaw) * cfg.side;

        desired.copy(pivot).addScaledVector(forward, -cfg.distance * camZoom);
        clipCamera(pivot, desired);
        constrainCamera(desired);

        if (camSnap || camera.position.distanceTo(desired) > 8) {
            camera.position.copy(desired);
            camSnap = false;
        } else {
            camera.position.lerp(desired, 1 - Math.exp(-14 * dt));
        }

        // Revisión final: entre el cura y la cámara nunca puede haber una pared.
        clipCamera(pivot, camera.position);
        constrainCamera(camera.position);

        lookAt.copy(pivot).addScaledVector(forward, 6);
        camera.lookAt(lookAt);
        controls.target.copy(lookAt);
    }

    // Primera persona: la cámara son tus ojos.
    function updateFirstPerson() {
        const eyeY = Math.min(walker.y + CONFIG.eyeHeight, headroom(walker));

        camera.position.set(walker.x, Math.max(eyeY, walker.y + 0.6), walker.z);
        constrainCamera(camera.position);

        viewDirection();
        lookAt.copy(camera.position).addScaledVector(forward, 6);
        camera.lookAt(lookAt);
        controls.target.copy(lookAt);
    }

    function setControl(on) {
        if (!active || on === controlling) return;
        controlling = on;
        dragging = false;

        if (on) {
            // La cámara se coloca detrás del cura, mirando hacia donde mira él.
            camYaw = rig.rotation.y;
            camPitch = CAMS[camMode].pitch;
            camZoom = 1;
            camSnap = true;
        } else {
            // Primera persona: sigues donde estaba la cámara, mirando en la misma dirección.
            placeWalkerFromCamera();
            camPitch = Math.min(camPitch, 0.1);
        }

        setMoving(false);
        refreshUI();
    }

    // V: primera persona → atrás → hombros → primera persona
    function cycleCamera() {
        if (!active) return;

        if (!controlling) {
            camMode = "back";
            setControl(true);
        } else if (camMode === "back") {
            camMode = "shoulder";
            camPitch = CAMS.shoulder.pitch;
            camZoom = 1;
            refreshUI();
        } else {
            setControl(false);
        }
    }

    // ---------- ENTRADAS ----------
    document.addEventListener("keydown", event => {
        if (!active) return;

        keys[event.code] = true;

        if (event.repeat) return;
        if (event.code === "KeyC") setControl(!controlling);
        if (event.code === "KeyV") cycleCamera();
        if (event.code === "KeyL") toggleLight();

        if (event.code.startsWith("Arrow")) event.preventDefault();
    });

    document.addEventListener("keyup", event => {
        keys[event.code] = false;
    });

    window.addEventListener("blur", () => {
        Object.keys(keys).forEach(k => (keys[k] = false));
    });

    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const canvas = renderer.domElement;

    canvas.addEventListener("pointerdown", event => {
        if (!active || busy) return;
        dragging = true;
        lastX = event.clientX;
        lastY = event.clientY;
    });

    window.addEventListener("pointermove", event => {
        if (!dragging) return;

        // En primera persona puedes mirar más arriba (techo, vitrales).
        const minPitch = controlling ? -0.6 : -1.3;
        const maxPitch = controlling ? 1.1 : 1.3;

        camYaw -= (event.clientX - lastX) * 0.005;
        camPitch = clamp(camPitch + (event.clientY - lastY) * 0.004, minPitch, maxPitch);
        lastX = event.clientX;
        lastY = event.clientY;
    });

    window.addEventListener("pointerup", () => {
        dragging = false;
    });

    canvas.addEventListener(
        "wheel",
        event => {
            if (!active || !controlling) return;
            camZoom = clamp(camZoom * (1 + Math.sign(event.deltaY) * 0.08), 0.5, 2.5);
        },
        { passive: true }
    );

    // ---------- CARGA ----------
    async function setupBVH() {
        try {
            const bvh = await import("three-mesh-bvh");
            THREE.BufferGeometry.prototype.computeBoundsTree = bvh.computeBoundsTree;
            THREE.BufferGeometry.prototype.disposeBoundsTree = bvh.disposeBoundsTree;
            THREE.Mesh.prototype.raycast = bvh.acceleratedRaycast;
            return true;
        } catch (error) {
            console.warn("three-mesh-bvh no cargó: las colisiones irán más lentas.", error);
            return false;
        }
    }

    function buildLights() {
        const alongX = size.x >= size.z;
        const y = floorLevel + 10.5;
        const count = 6;

        pointLights.length = 0;

        ambientLight = new THREE.AmbientLight(0xffead0, CONFIG.light.ambient);
        lights.add(ambientLight);

        for (let i = 0; i < count; i++) {
            const t = (i + 0.5) / count - 0.5;
            const light = new THREE.PointLight(
                0xffdfae, CONFIG.light.intensity, CONFIG.light.distance, 2
            );

            light.position.set(
                center.x + (alongX ? t * size.x * 0.9 : 0),
                y,
                center.z + (alongX ? 0 : t * size.z * 0.9)
            );

            lights.add(light);
            pointLights.push(light);
        }
    }

    async function ensureLoaded() {
        if (loaded) return;

        const hasBVH = await setupBVH();

        const gltf = await loader.loadAsync(CONFIG.modelPath, event => {
            const mb = (event.loaded / 1048576).toFixed(0);
            const pct = event.total ? ` (${Math.round((event.loaded / event.total) * 100)}%)` : "";
            overlay.textContent = `Cargando el interior… ${mb} MB${pct}`;
        });

        root = gltf.scene;

        const box = new THREE.Box3().setFromObject(root);
        const s = box.getSize(new THREE.Vector3());
        root.scale.setScalar(CONFIG.lengthMeters / Math.max(s.x, s.z, 0.001));
        root.updateMatrixWorld(true);

        box.setFromObject(root);
        const c = box.getCenter(new THREE.Vector3());
        root.position.set(root.position.x - c.x, root.position.y - box.min.y, root.position.z - c.z);
        root.updateMatrixWorld(true);

        collidables = [];
        root.traverse(o => {
            if (!o.isMesh) return;
            o.castShadow = false;
            o.receiveShadow = false;
            collidables.push(o);
        });

        if (hasBVH) {
            overlay.textContent = "Preparando colisiones…";
            await wait(30);

            for (let i = 0; i < collidables.length; i++) {
                collidables[i].geometry.computeBoundsTree();

                if (i % 4 === 0) {
                    overlay.textContent =
                        `Preparando colisiones… ${Math.round((i / collidables.length) * 100)}%`;
                    await wait(0);
                }
            }
        }

        bounds.setFromObject(root);
        bounds.getSize(size);
        bounds.getCenter(center);

        const levels = detectLevels();
        floorLevel = levels.floor;
        ceilingLevel = levels.ceil;

        console.log(
            `Interior: suelo detectado en y=${floorLevel.toFixed(2)} m, ` +
            `techo en y=${ceilingLevel.toFixed(2)} m ` +
            `(modelo de ${bounds.min.y.toFixed(2)} a ${bounds.max.y.toFixed(2)} m)`
        );

        findCrucifix();
        computeNave();

        let priestGltf = null;
        try {
            priestGltf = await loader.loadAsync(CONFIG.priestPath);
        } catch (error) {
            console.warn("No se pudo cargar cura.glb para el interior:", error);
        }

        buildPriest(priestGltf);
        buildLights();

        loaded = true;
    }

    // ---------- ENTRAR / SALIR ----------
    async function enter() {
        if (active || busy) return;
        busy = true;

        await showOverlay("Entrando a la iglesia…");

        try {
            await ensureLoaded();
        } catch (error) {
            console.error("No se pudo cargar el interior:", error);
            overlay.textContent = "No se pudo cargar interior-iglesia.glb. Revisa assets/models.";
            await wait(2200);
            hideOverlay();
            busy = false;
            return;
        }

        // Guardar el estado del exterior
        saved.cameraPos = camera.position.clone();
        saved.target = controls.target.clone();
        saved.minD = controls.minDistance;
        saved.maxD = controls.maxDistance;
        saved.minPolar = controls.minPolarAngle;
        saved.polar = controls.maxPolarAngle;
        saved.pan = controls.enablePan;
        saved.autoRotate = controls.autoRotate;
        saved.near = camera.near;
        saved.far = camera.far;
        saved.exposure = renderer.toneMappingExposure;
        saved.bg = scene.background.clone();
        saved.fogDensity = scene.fog ? scene.fog.density : 0;

        setExteriorVisible(false);
        scene.add(root, lights, rig);

        scene.background.set("#0c0a09");
        if (scene.fog) scene.fog.density = 0;

        // Siempre se entra con la luz apagada (ambiente oscuro).
        lightLevel = 0;
        lightTarget = 0;
        applyLight();

        camera.near = 0.05;
        camera.far = 500;
        camera.updateProjectionMatrix();

        // Dentro de la iglesia la cámara es propia (no OrbitControls), así que
        // no hay forma de girar alrededor y salirse de la estructura.
        controls.enabled = false;
        controls.autoRotate = false;
        controls.enablePan = false;
        controls.minDistance = 0;
        controls.maxDistance = Infinity;
        controls.minPolarAngle = 0;
        controls.maxPolarAngle = Math.PI;

        // El cura cerca del altar; tú en la puerta, mirando al altar.
        placeIntro();

        controlling = false;
        dragging = false;
        camMode = "back";
        camZoom = 1;
        camSnap = false;
        active = true;

        createUI();
        setMoving(false);

        updateFirstPerson();
        controls.update();

        hideOverlay();
        busy = false;
    }

    async function exit() {
        if (!active || busy) return;
        busy = true;

        await showOverlay("Saliendo al exterior…");

        controlling = false;
        dragging = false;
        active = false;
        Object.keys(keys).forEach(k => (keys[k] = false));

        scene.remove(root, lights, rig);
        removeUI();

        scene.background.copy(saved.bg);
        if (scene.fog) scene.fog.density = saved.fogDensity;
        renderer.toneMappingExposure = saved.exposure;

        setExteriorVisible(true);

        controls.enabled = true;
        controls.enablePan = saved.pan;
        controls.autoRotate = saved.autoRotate;
        controls.minDistance = saved.minD;
        controls.maxDistance = saved.maxD;
        controls.minPolarAngle = saved.minPolar;
        controls.maxPolarAngle = saved.polar;

        camera.position.copy(saved.cameraPos);
        controls.target.copy(saved.target);
        camera.near = saved.near;
        camera.far = saved.far;
        camera.updateProjectionMatrix();
        controls.update();

        const loaderText = document.querySelector("#loader");
        if (loaderText) loaderText.textContent = "Arrastra para girar el modelo";

        hideOverlay();
        busy = false;
    }

    // ---------- ACTUALIZACIÓN POR FOTOGRAMA ----------
    function update(dt) {
        if (!active || !rig) return;

        dt = Math.min(dt, 0.05); // evita saltos grandes si la pestaña se queda en segundo plano
        timeAcc += dt;
        if (mixer) mixer.update(dt);

        // Transición suave al encender / apagar la luz.
        if (lightLevel !== lightTarget) {
            lightLevel += (lightTarget - lightLevel) * (1 - Math.exp(-4 * dt));
            if (Math.abs(lightTarget - lightLevel) < 0.002) lightLevel = lightTarget;
            applyLight();
        }

        if (controlling) {
            updateControlled(dt);
            updateThirdPerson(dt);
        } else {
            updateWander(dt);
            updateWalker(dt);
            updateFirstPerson();
        }
    }

    return {
        enter,
        exit,
        update,
        isActive: () => active || busy
    };
}
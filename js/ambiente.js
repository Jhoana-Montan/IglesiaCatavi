import * as THREE from "three";

// ======================================================
// AMBIENTE DE CATAVI
// - Fondo: fotografía de Catavi en una cúpula que sigue a la cámara.
// - Ciclo de luz progresivo: Día (0) → Atardecer (0.5) → Noche (1).
// - Control visual del sol (#sunTrack) conectado a este módulo.
// ======================================================

// Paradas del ciclo. 0 = Día, 0.5 = Atardecer, 1 = Noche
// (0.75 es el crepúsculo intermedio para que la transición sea natural).
const STOPS = [0, 0.5, 0.75, 1];

const col = v =>
    Array.isArray(v) ? new THREE.Color(v[0], v[1], v[2]) : new THREE.Color(v);

const PRESETS = [
    // ---------------- DÍA ----------------
    {
        exposure: 1.0,
        keyColor: "#fff1d6", keyInt: 2.8, elev: 58, az: 20,
        hemiSky: "#cfe2ff", hemiGround: "#8a7a62", hemiInt: 1.2,
        fillColor: "#9cc4ff", fillInt: 0.9,
        rimColor: "#ffe6a8", rimInt: 25,
        frontColor: "#ffe9c4", frontInt: 8,
        env: 1.0, bloom: 0.10, bloomThr: 0.92, shadow: 0.38,
        lamp: 0, spot: 0,
        skyHorizon: "#8fb6e8", skyZenith: "#4a82cf", skyReplace: 0,
        tint: [1, 1, 1], bright: 1.0, sat: 1.0,
        bodyColor: [8, 7, 5.5], glow: 0.12, stars: 0
    },
    // ---------------- ATARDECER ----------------
    {
        exposure: 0.95,
        keyColor: "#ff9a4a", keyInt: 2.6, elev: 9, az: 35,
        hemiSky: "#ffb48a", hemiGround: "#5a4448", hemiInt: 0.9,
        fillColor: "#7f8fe0", fillInt: 0.5,
        rimColor: "#ff7b3a", rimInt: 40,
        frontColor: "#ffb070", frontInt: 14,
        env: 0.5, bloom: 0.22, bloomThr: 0.85, shadow: 0.30,
        lamp: 0.2, spot: 0.1,
        skyHorizon: "#ff9a4f", skyZenith: "#3a4c96", skyReplace: 1,
        tint: [1.0, 0.68, 0.45], bright: 0.9, sat: 1.0,
        bodyColor: [7, 3, 1], glow: 0.9, stars: 0
    },
    // ---------------- CREPÚSCULO ----------------
    {
        exposure: 0.8,
        keyColor: "#8b8fe0", keyInt: 0.25, elev: -4, az: 80,
        hemiSky: "#4a4f8f", hemiGround: "#1b1a2a", hemiInt: 0.4,
        fillColor: "#6f86d8", fillInt: 0.3,
        rimColor: "#7e8fe8", rimInt: 20,
        frontColor: "#ffbf80", frontInt: 20,
        env: 0.22, bloom: 0.32, bloomThr: 0.8, shadow: 0.10,
        lamp: 0.8, spot: 0.5,
        skyHorizon: "#5b4a7e", skyZenith: "#0b1233", skyReplace: 1,
        tint: [0.45, 0.5, 0.85], bright: 0.4, sat: 0.8,
        bodyColor: [1.2, 0.5, 0.2], glow: 0.35, stars: 0.45
    },
    // ---------------- NOCHE ----------------
    {
        exposure: 0.85,
        keyColor: "#a8bcff", keyInt: 1.1, elev: 42, az: 35,
        hemiSky: "#27386e", hemiGround: "#10131f", hemiInt: 0.5,
        fillColor: "#6f86d8", fillInt: 0.35,
        rimColor: "#8fa4ff", rimInt: 25,
        frontColor: "#ffc88a", frontInt: 30,
        env: 0.12, bloom: 0.42, bloomThr: 0.72, shadow: 0.22,
        lamp: 1.6, spot: 1.2,
        skyHorizon: "#101a3a", skyZenith: "#02060f", skyReplace: 1,
        tint: [0.32, 0.42, 0.9], bright: 0.28, sat: 0.6,
        bodyColor: [2.2, 2.3, 2.7], glow: 0.25, stars: 1
    }
];

const NUM_KEYS = [
    "exposure", "keyInt", "elev", "az", "hemiInt", "fillInt", "rimInt",
    "frontInt", "env", "bloom", "bloomThr", "shadow", "lamp", "spot",
    "skyReplace", "bright", "sat", "glow", "stars"
];

const COL_KEYS = [
    "keyColor", "hemiSky", "hemiGround", "fillColor", "rimColor",
    "frontColor", "skyHorizon", "skyZenith", "tint", "bodyColor"
];

const KF = PRESETS.map(p => {
    const o = {};
    NUM_KEYS.forEach(k => (o[k] = p[k]));
    COL_KEYS.forEach(k => (o[k] = col(p[k])));
    return o;
});

// Estado actual (interpolado entre las paradas).
const cur = {};
NUM_KEYS.forEach(k => (cur[k] = 0));
COL_KEYS.forEach(k => (cur[k] = new THREE.Color()));

function sample(t) {
    let i = 0;
    while (i < STOPS.length - 2 && t > STOPS[i + 1]) i++;

    const a = KF[i];
    const b = KF[i + 1];

    let s = (t - STOPS[i]) / (STOPS[i + 1] - STOPS[i]);
    s = Math.min(Math.max(s, 0), 1);
    s = s * s * (3 - 2 * s); // suaviza cada tramo

    NUM_KEYS.forEach(k => (cur[k] = a[k] + (b[k] - a[k]) * s));
    COL_KEYS.forEach(k => cur[k].copy(a[k]).lerp(b[k], s));
}

// ======================================================
// SHADERS DE LA CÚPULA
// ======================================================

const VERT = /* glsl */ `
    varying vec3 vDir;
    void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const FRAG = /* glsl */ `
    uniform sampler2D uMap;
    uniform float uSpanH;
    uniform float uSpanV;
    uniform float uBottom;
    uniform float uPan;
    uniform vec2  uCrop;
    uniform vec3  uGround;
    uniform vec3  uHorizon;
    uniform vec3  uZenith;
    uniform float uSkyReplace;
    uniform vec3  uTint;
    uniform float uBright;
    uniform float uSat;
    uniform vec3  uSunDir;
    uniform vec3  uBodyColor;
    uniform float uGlow;
    uniform float uStars;
    uniform float uGain;
    uniform float uTime;
    varying vec3 vDir;

    float hash13(vec3 p3) {
        p3 = fract(p3 * 0.1031);
        p3 += dot(p3, p3.zyx + 31.32);
        return fract((p3.x + p3.y) * p3.z);
    }

    vec3 grade(vec3 c) {
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(vec3(l), c, uSat);
        return c * uTint * uBright;
    }

    void main() {
        vec3 d = normalize(vDir);
        float az = atan(d.x, d.z) + uPan;
        float el = asin(clamp(d.y, -1.0, 1.0));

        // Foto espejada horizontalmente: no hay cortes ni costuras.
        float p = az / uSpanH;
        float u = abs(mod(p, 2.0) - 1.0);

        float vn = (el - uBottom) / uSpanV;
        float v = mix(uCrop.x, uCrop.y, clamp(vn, 0.0, 1.0));
        vec3 photo = texture2D(uMap, vec2(u, v)).rgb;

        // Zonas de cielo dentro de la foto (azules, en la parte alta).
        float skyMask = smoothstep(0.03, 0.22, photo.b - photo.r)
                      * smoothstep(0.55, 0.80, vn);
        float top = smoothstep(0.80, 1.0, vn);
        float bottomFade = 1.0 - smoothstep(-0.10, 0.06, vn);

        vec3 land = grade(photo);
        land = mix(land, grade(uGround), bottomFade);

        // Cielo procedural: degradado + sol/luna + estrellas.
        float g = pow(clamp(el / radians(75.0), 0.0, 1.0), 0.6);
        vec3 sky = mix(uHorizon, uZenith, g);

        float c = dot(d, uSunDir);
        vec3 bc = uBodyColor / max(max(uBodyColor.r, uBodyColor.g), max(uBodyColor.b, 0.001));
        float disc = smoothstep(0.9988, 0.9993, c);
        sky += uBodyColor * disc;
        sky += bc * (pow(max(c, 0.0), 12.0) * 0.6 + pow(max(c, 0.0), 200.0)) * uGlow;

        vec2 a = d.xz / max(length(d.xz), 1e-4);
        vec2 s = uSunDir.xz / max(length(uSunDir.xz), 1e-4);
        float side = pow(max(dot(a, s), 0.0), 2.0);
        sky += bc * exp(-max(el, 0.0) * 6.0) * side * uGlow * 0.6;

        vec3 sp = d * 80.0;
        vec3 id = floor(sp);
        vec3 f = fract(sp) - 0.5;
        float rnd = hash13(id);
        vec3 off = vec3(hash13(id + 3.1), hash13(id + 7.7), hash13(id + 11.3)) - 0.5;
        float star = step(0.965, rnd) * smoothstep(0.14, 0.0, length(f - off * 0.6));
        float tw = 0.65 + 0.35 * sin(uTime * 2.0 + rnd * 60.0);
        sky += vec3(0.85, 0.9, 1.0) * star * tw * uStars * 2.2 * smoothstep(0.0, 0.15, el + 0.02);

        float m = clamp(max(skyMask * uSkyReplace, top), 0.0, 1.0);
        vec3 colr = mix(land, sky, m) * uGain;

        gl_FragColor = vec4(colr, 1.0);
    }
`;

// ======================================================
// CREAR AMBIENTE
// ======================================================

export function createAmbiente({ scene, camera, renderer, bloom, ground, lights, photoUrl }) {
    const { hemi, key, fill, rim, front } = lights;

    // Ajustes de la fotografía de fondo.
    const PHOTO = {
        spanH: 60,        // grados que ocupa una copia de la foto (360 / spanH debe ser par: 90, 60, 45…)
        bottomElev: -31,  // elevación (°) del borde inferior de la foto; sube/baja el paisaje
        pan: 0,           // gira la foto alrededor de la iglesia (radianes)
        cropBottom: 0.18  // recorta el rótulo "Catavi" de la parte inferior
    };

    const placeholder = new THREE.DataTexture(
        new Uint8Array([150, 175, 205, 255]), 1, 1
    );
    placeholder.colorSpace = THREE.SRGBColorSpace;
    placeholder.needsUpdate = true;

    const uniforms = {
        uMap: { value: placeholder },
        uSpanH: { value: THREE.MathUtils.degToRad(PHOTO.spanH) },
        uSpanV: { value: THREE.MathUtils.degToRad(PHOTO.spanH * 0.4) },
        uBottom: { value: THREE.MathUtils.degToRad(PHOTO.bottomElev) },
        uPan: { value: PHOTO.pan },
        uCrop: { value: new THREE.Vector2(PHOTO.cropBottom, 1) },
        uGround: { value: new THREE.Color("#7a6650") },
        uHorizon: { value: new THREE.Color() },
        uZenith: { value: new THREE.Color() },
        uSkyReplace: { value: 0 },
        uTint: { value: new THREE.Color(1, 1, 1) },
        uBright: { value: 1 },
        uSat: { value: 1 },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uBodyColor: { value: new THREE.Color(1, 1, 1) },
        uGlow: { value: 0 },
        uStars: { value: 0 },
        uGain: { value: 1 },
        uTime: { value: 0 }
    };

    const dome = new THREE.Mesh(
        new THREE.SphereGeometry(40, 48, 32),
        new THREE.ShaderMaterial({
            uniforms,
            vertexShader: VERT,
            fragmentShader: FRAG,
            side: THREE.BackSide,
            depthTest: false,
            depthWrite: false
        })
    );

    dome.name = "domoCatavi";
    dome.frustumCulled = false;
    dome.renderOrder = -1000;

    // Carga de la fotografía.
    new THREE.TextureLoader().load(
        encodeURI(photoUrl),
        tex => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.generateMipmaps = false;
            tex.minFilter = THREE.LinearFilter;
            tex.magFilter = THREE.LinearFilter;
            tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;

            const img = tex.image;
            const W = img.naturalWidth || img.width;
            const H = img.naturalHeight || img.height;
            const vFrac = 1 - PHOTO.cropBottom;

            uniforms.uSpanV.value = THREE.MathUtils.degToRad(
                PHOTO.spanH * (H * vFrac) / W
            );

            uniforms.uGround.value.copy(averageBottomColor(img, W, H));
            uniforms.uMap.value = tex;
        },
        undefined,
        error => console.warn("No se pudo cargar la foto de Catavi:", photoUrl, error)
    );

    // Color medio del borde inferior de la foto (para extender el suelo sin cortes).
    function averageBottomColor(img, W, H) {
        try {
            const canvas = document.createElement("canvas");
            canvas.width = 16;
            canvas.height = 4;

            const g = canvas.getContext("2d");
            const sh = H * 0.06;
            const sy = H * (1 - PHOTO.cropBottom) - sh;

            g.drawImage(img, 0, sy, W, sh, 0, 0, 16, 4);

            const data = g.getImageData(0, 0, 16, 4).data;
            let r = 0, gr = 0, b = 0;
            const n = data.length / 4;

            for (let i = 0; i < data.length; i += 4) {
                r += data[i];
                gr += data[i + 1];
                b += data[i + 2];
            }

            return new THREE.Color().setRGB(
                r / n / 255, gr / n / 255, b / n / 255, THREE.SRGBColorSpace
            );
        } catch (error) {
            console.warn("No se pudo calcular el color del suelo:", error);
            return new THREE.Color("#7a6650");
        }
    }

    // ---------- Luces de la iglesia (se encienden al caer la tarde) ----------
    const lampGroup = new THREE.Group();
    let lampL = null;
    let lampR = null;
    let spot = null;
    let lampDist = 6;
    let spotDist = 10;

    function setChurchSize(size) {
        lampGroup.clear();

        lampDist = Math.max(size.y * 0.55, 1);
        spotDist = Math.max(size.y * 1.0, 1);

        lampL = new THREE.PointLight(0xffb870, 0, 0, 2);
        lampR = new THREE.PointLight(0xffb870, 0, 0, 2);

        lampL.position.set(-size.x * 0.28, size.y * 0.30, size.z * 0.62);
        lampR.position.set(size.x * 0.28, size.y * 0.30, size.z * 0.62);

        spot = new THREE.SpotLight(0xffd9a0, 0, 0, 0.45, 0.9, 2);
        spot.position.set(0, size.y * 0.18, size.z * 1.15);
        spot.target.position.set(0, size.y * 0.75, 0);

        lampGroup.add(lampL, lampR, spot, spot.target);
    }

    // ---------- Materiales sensibles al entorno ----------
    const tracked = [];

    function trackMaterials(root, base) {
        root.traverse(o => {
            if (!o.isMesh || !o.material) return;
            const list = Array.isArray(o.material) ? o.material : [o.material];
            list.forEach(m => {
                if ("envMapIntensity" in m) tracked.push({ m, base });
            });
        });
    }

    // ---------- Estado ----------
    let currentT = 0;
    let targetT = 0;
    let time = 0;
    let exteriorVisible = true;

    const sunDir = new THREE.Vector3();
    const D2R = THREE.MathUtils.degToRad;

    function apply() {
        sample(currentT);

        renderer.toneMappingExposure = cur.exposure;

        hemi.color.copy(cur.hemiSky);
        hemi.groundColor.copy(cur.hemiGround);
        hemi.intensity = cur.hemiInt;

        const el = D2R(cur.elev);
        const az = D2R(cur.az);

        sunDir.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));

        // La luz nunca baja del horizonte (evita luz desde el suelo).
        const le = Math.max(el, D2R(6));
        key.color.copy(cur.keyColor);
        key.intensity = cur.keyInt;
        key.position
            .set(Math.cos(le) * Math.sin(az), Math.sin(le), Math.cos(le) * Math.cos(az))
            .multiplyScalar(45);

        fill.color.copy(cur.fillColor);
        fill.intensity = cur.fillInt;

        rim.color.copy(cur.rimColor);
        rim.intensity = cur.rimInt;

        front.color.copy(cur.frontColor);
        front.intensity = cur.frontInt;

        if (ground.material) ground.material.opacity = cur.shadow;

        bloom.strength = cur.bloom;
        bloom.threshold = cur.bloomThr;

        for (let i = 0; i < tracked.length; i++) {
            tracked[i].m.envMapIntensity = tracked[i].base * cur.env;
        }

        if (lampL) {
            lampL.intensity = lampR.intensity = cur.lamp * lampDist * lampDist;
            spot.intensity = cur.spot * spotDist * spotDist;
        }

        uniforms.uHorizon.value.copy(cur.skyHorizon);
        uniforms.uZenith.value.copy(cur.skyZenith);
        uniforms.uSkyReplace.value = cur.skyReplace;
        uniforms.uTint.value.copy(cur.tint);
        uniforms.uBright.value = cur.bright;
        uniforms.uSat.value = cur.sat;
        uniforms.uSunDir.value.copy(sunDir);
        uniforms.uBodyColor.value.copy(cur.bodyColor);
        uniforms.uGlow.value = cur.glow;
        uniforms.uStars.value = cur.stars;
        uniforms.uGain.value = 1 / Math.max(cur.exposure, 0.1);
        uniforms.uTime.value = time;
    }

    function update(dt) {
        if (!exteriorVisible) return;

        time += dt;

        currentT += (targetT - currentT) * (1 - Math.exp(-5 * dt));
        if (Math.abs(targetT - currentT) < 0.0005) currentT = targetT;

        dome.position.copy(camera.position);
        apply();
    }

    // Al entrar al interior se apaga todo el exterior y se restaura la luz ambiente original.
    function setExteriorVisible(visible) {
        exteriorVisible = visible;
        dome.visible = visible;
        lampGroup.visible = visible;

        if (!visible) {
            hemi.color.set(0xdce9ff);
            hemi.groundColor.set(0x554638);
            hemi.intensity = 2.0;
        }
    }

    scene.add(dome, lampGroup);

    // ---------- Control visual del sol ----------
    function initSunControl() {
        const track = document.getElementById("sunTrack");
        if (!track) return;

        const thumb = document.getElementById("sunThumb");
        const label = document.getElementById("sunLabel");
        const stopButtons = document.querySelectorAll("[data-sun]");

        const NAMES = [["☀️", "Día"], ["🌇", "Atardecer"], ["🌙", "Noche"]];
        const ORB = [col("#ffd84a"), col("#ff8a3d"), col("#cfd8ff")];
        const orb = new THREE.Color();

        function paint(t) {
            const i = t < 0.25 ? 0 : t < 0.62 ? 1 : 2;

            thumb.style.left = `${t * 100}%`;
            thumb.textContent = NAMES[i][0];
            label.textContent = `${NAMES[i][0]} ${NAMES[i][1]}`;

            if (t < 0.5) orb.copy(ORB[0]).lerp(ORB[1], t / 0.5);
            else orb.copy(ORB[1]).lerp(ORB[2], (t - 0.5) / 0.5);

            thumb.style.setProperty("--orb", `#${orb.getHexString()}`);

            track.setAttribute("aria-valuenow", String(Math.round(t * 100)));
            track.setAttribute("aria-valuetext", NAMES[i][1]);

            stopButtons.forEach(b => {
                b.classList.toggle("active", Math.abs(t - parseFloat(b.dataset.sun)) < 0.08);
            });
        }

        function set(t) {
            targetT = Math.min(Math.max(t, 0), 1);
            paint(targetT);
        }

        let dragging = false;

        const fromEvent = event => {
            const r = track.getBoundingClientRect();
            set((event.clientX - r.left) / r.width);
        };

        track.addEventListener("pointerdown", event => {
            dragging = true;
            track.setPointerCapture(event.pointerId);
            fromEvent(event);
            event.stopPropagation();
        });

        track.addEventListener("pointermove", event => {
            if (dragging) fromEvent(event);
        });

        const end = event => {
            dragging = false;
            try { track.releasePointerCapture(event.pointerId); } catch (e) { /* nada */ }
        };

        track.addEventListener("pointerup", end);
        track.addEventListener("pointercancel", end);

        track.addEventListener("keydown", event => {
            const step = event.shiftKey ? 0.25 : 0.05;

            if (event.key === "ArrowRight" || event.key === "ArrowUp") set(targetT + step);
            else if (event.key === "ArrowLeft" || event.key === "ArrowDown") set(targetT - step);
            else if (event.key === "Home") set(0);
            else if (event.key === "End") set(1);
            else return;

            event.preventDefault();
            event.stopPropagation();
        });

        stopButtons.forEach(button => {
            button.addEventListener("click", event => {
                event.stopPropagation();
                set(parseFloat(button.dataset.sun));
                button.blur();
            });
        });

        paint(targetT);
    }

    initSunControl();
    apply();

    return {
        dome,
        update,
        apply,
        setChurchSize,
        trackMaterials,
        setExteriorVisible,
        setTime(t) { targetT = Math.min(Math.max(t, 0), 1); },
        getTime: () => targetT
    };
}
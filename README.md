# Iglesia de Catavi · Sitio Web

Proyecto académico para la asignatura **Computación Gráfica** —
Carrera de **Ingeniería Informática**, gestión **2026**.

## Estructura

```
IglesiaCatavi/
├── index.html          # Inicio (Hero + tarjetas + estadísticas)
├── historia.html       # Historia + línea de tiempo
├── galeria.html        # Galería filtrable + lightbox
├── modelo3d.html       # Visor 3D con Three.js
├── css/
│   ├── estilos.css     # Estilos base, tipografía, secciones
│   ├── menu.css        # Menú de navegación fijo
│   ├── galeria.css     # Galería y lightbox
│   └── modelo3d.css    # Layout del visor 3D
├── js/
│   ├── menu.js         # Menú móvil
│   ├── galeria.js      # Filtros + lightbox
│   └── iglesia.js      # Escena Three.js (módulo ES)
└── assets/
    ├── img/
    │   ├── portada/
    │   ├── exterior/
    │   ├── interior/
    │   └── detalles/
    ├── textures/       # (vacío) — texturas adicionales
    └── models/         # Colocar aquí: iglesia-catavi.glb
```

## Cómo ejecutarlo

El visor 3D usa módulos ES e `importmap`, por lo que **debe servirse
desde un servidor HTTP local** (no abrir el HTML con doble click).

Opciones rápidas:

```bash
# Python
python3 -m http.server 8000

# Node
npx serve .
```

Luego abrir: <http://localhost:8000/>

## Modelo 3D

Coloca el archivo `iglesia-catavi.glb` en `assets/models/`.
Mientras no exista, el visor renderiza un **templo procedural**
generado en Three.js como marcador, con iluminación, sombras,
piso, cámara orbital, `OrbitControls` y `GLTFLoader` ya configurados.

## Paleta

- Fondo principal `#0f172a`
- Paneles `#1e293b`
- Detalles dorados `#fbbf24`
- Acción azul `#3b82f6`
- Tipografía: *Cormorant Garamond* (display) + *Inter* (texto).

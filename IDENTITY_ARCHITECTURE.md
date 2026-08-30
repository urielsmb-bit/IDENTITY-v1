# IDENTITY — Arquitectura actual

> Lección 01 · Auditoría. Estado del código a 28/08/2026.
> Actualizado tras la **Fase 0** (estabilización).
> Todo lo afirmado aquí está verificado leyendo el código o ejecutándolo.
> Lo que no pude verificar está marcado como **[sin verificar]**.
> El esquema del perfil vive aparte, en **`IDENTITY_SCHEMA.md`**.

---

## 1. Forma del proyecto

26 archivos, 504 KB, sin dependencias, sin build.

| Archivo | Líneas | Responsabilidad |
|---|---:|---|
| `IDENTITY_SCHEMA.md` | — | Versión, forma, defaults y migración del perfil |
| `serve.py` | 81 | Servidor de desarrollo: `Cache-Control: no-store` + reescritura de `/usuario` a `index.html` |
| `index.html` | 70 | Shell. Fuentes, 6 CSS, 17 scripts en orden manual |
| `css/base.css` | 286 | Tokens del sistema (39) |
| `css/chrome.css` | 343 | Barra de navegación + portada |
| `css/themes.css` | 288 | Los 14 temas como bloques de tokens |
| `css/profile.css` | 1318 | La página de perfil |
| `css/panels.css` | 577 | Descubrir, ranking, analytics, precios, plantillas |
| `css/dashboard.css` | 1364 | El editor |
| `js/media.js` | 250 | Almacén de vídeo en IndexedDB: referencias, blob URLs, huérfanos |
| `js/nets.js` | 345 | 54 redes: etiqueta, color, grupo, prefijo, icono SVG (40 logos de marca + 14 geométricos) |
| `js/data.js` | 579 | 32 catálogos + 14 perfiles semilla |
| `js/store.js` | 489 | Persistencia + reglas de negocio |
| `js/effects.js` | 404 | Partículas, tilt, cursores, contadores, reveal |
| `js/music.js` | 445 | YouTube + Spotify + controlador unificado |
| `js/router.js` | 120 | 9 rutas por hash |
| `js/app.js` | 160 | Arranque, avisos, portapapeles, archivos, metadatos |
| `js/views/profile.js` | 935 | Renderizador del perfil público |
| `js/views/dashboard.js` | **2382** | El editor completo, 9 secciones |
| `js/views/templates.js` | 446 | 13 plantillas + miniaturas en vivo |
| `js/views/onboard.js` | 315 | Asistente de 4 pasos |
| `js/views/ai.js` | 312 | Generador por reglas |
| `js/views/analytics.js` | 253 | Panel de estadísticas |
| `js/views/landing.js` | 232 | Portada |
| `js/views/discover.js` | 164 | Descubrir |
| `js/views/leaderboard.js` | 116 | Ranking |
| `js/views/pricing.js` | 114 | Precios + marketplace |

`dashboard.js` es el 21% de todo el JavaScript del proyecto.

---

## 2. Cómo se comunican los módulos

Todo cuelga de un único global: `window.ID`. No hay módulos ES, no hay
bundler; el orden de `<script>` en `index.html` **es** el grafo de dependencias.

```
nets.js ─┐
data.js ─┼──► store.js ──► effects.js ──► music.js
         │        │
         │        ▼
         └──► views/profile.js ──► resto de vistas ──► router.js ──► app.js
```

### Dirección real de las llamadas (verificada por grep)

```
vistas  ──►  ID.store    (leer/escribir perfiles)
vistas  ──►  ID.util     (esc, safeUrl, num, seed)
vistas  ──►  ID.fx       (efectos)
vistas  ──►  ID.app      (toast, copy, pickFile)
vistas  ──►  ID.music    (reproductor)
```

**Esto está bien.** Las dependencias fluyen en una sola dirección, sin ciclos.
`store.js`, `effects.js`, `music.js` y `nets.js` no llaman a ninguna vista.

Dos excepciones:

- `router.js` llama a `ID.views.dashboard.limpiar()` — el router conoce el
  detalle interno de una vista concreta.
- `landing.js` llama a `ID.views.discover.card()` — una vista reutiliza el
  renderizador de otra.

---

## 3. Modelo de datos

Un perfil es **un objeto plano** con 6 claves anidadas: `pos`, `bstyle`,
`blocks`, `sectionsOn`, `status`, `ratings`.

**Versión del esquema: `v: 3`** (`ID.store.VERSION`). Un perfil sin `v` es
anterior a la Fase 0; `store.migrar()` lo trae al día. La forma completa, los
valores por defecto y el patrón de migración están en **`IDENTITY_SCHEMA.md`**;
aquí sólo la vista de conjunto.

Ejemplo de la mezcla de conceptos en el mismo nivel:

```js
{
  username, name, title, location, emoji, bio,     // identidad
  theme, accent, font, gradient,                   // apariencia
  layoutMode, stackPos, gap, pad, radius,          // composición
  sOpacity, sBorder, sBlur, sGlow,                 // superficie
  bgType, bgValue, bgBlur, bgDim, vignette,        // fondo
  particles, cursor, tilt, hoverFx, enterFx,       // efectos
  socials, links, projects, gallery,               // contenido
  views, likes, level, xp, ratings,                // métricas
  discoverable, showStats, showRate, gate          // ajustes
}
```

### Persistencia — 14 claves de localStorage

| Clave | Contenido |
|---|---|
| `identity.profiles.v2` | Perfiles creados o editados aquí |
| `identity.stats.v1` | **Métricas, separadas del perfil** |
| `identity.mine.v1` | Cuál es el perfil activo |
| `identity.seen.v1` | Visitas ya contadas hoy |
| `identity.votes.v1` | Mis votos |
| `identity.clicks.v1` | Clics en redes |
| `identity.favs.v1` | Plantillas favoritas |
| `identity.mytpl.v1` | Plantillas publicadas |
| `identity.onboard.v1` | Asistente completado |
| `identity.hint.click` | Pista de "toca para editar" vista |
| `identity.editmode` | Simple o Avanzado |
| `identity.spotify.v1` / `.cid` / `.ver` | Token, Client ID, verificador PKCE |

**Decisión acertada:** las métricas viven aparte del perfil. `store.all()`
mezcla `SEED + local + stats` en tiempo de lectura, así que el catálogo de
perfiles semilla puede evolucionar sin perder las visitas ya acumuladas.

### Lectura

```
store.all()  →  reconstruye TODO el mapa y clona cada perfil con métricas
store.get()  →  store.all()[username]      ← SIN normalizar, objeto compartido
store.list() →  store.all() → array
```

Coste medido: `leaderboard('growth')` con 14 perfiles ejecuta **15
reconstrucciones completas** de `all()` (~1,7 ms). Sigue siendo deuda A2.

### Normalización — una sola puerta

```
                    ┌─ store.getEditable(u) ─┐
perfil en bruto ────┼─ store.mine()          ├──► store.normalizar(p) ──► copia
(SEED o disco)      ├─ store.blank()         │      │
                    └─ profile.render/       │      └─ store.migrar(p) primero
                       aplicar/mount ────────┘
```

`store.normalizar()` es la **única** tabla de valores por defecto del proyecto,
y **no muta** su argumento: devuelve una copia, así se puede llamar sobre las
semillas compartidas de `ID.SEED` sin ensuciarlas.

Que `get()` devuelva el objeto sin normalizar es deliberado: normalizar ahí
obligaría a clonar en cada lectura, y `all()` ya se llama 15 veces por ranking.
Quien pinta o edita entra por `normalizar()`. Medido: editor y perfil público
coinciden en **14 de 14** semillas (antes, 5 de 14).

### Medios — comprimir antes de guardar

Un avatar o un fondo acaban como data URI dentro de `localStorage`. La cuenta
real: base64 crece 4/3 y `localStorage` guarda UTF-16, así que **un archivo de
4 MB ocupa casi 11 MB**. Es lo que llenaba el almacén.

`ID.app.pickFile(accept, cb, { media: destino })` intercepta el archivo antes de
que entre al perfil:

| Destino | Lado máx. | Calidad | Presupuesto |
|---|---:|---:|---:|
| `avatar` | 512 px | 0.82 | 220 KB |
| `fondo` | 1920 px | 0.78 | 900 KB |
| `galeria` | 1024 px | 0.80 | 320 KB |
| `cover` | 640 px | 0.80 | 200 KB |
| `video` | — | — | **no se toca** (ver abajo) |

El presupuesto se mide en **espacio ocupado en el navegador**, no en tamaño de
archivo: es la única unidad que importa aquí.

- Se codifica en **WebP** si el navegador lo soporta (conserva transparencia),
  con JPEG sobre negro como reserva.
- Si no entra, baja calidad en pasos de 0.12 y cada dos intentos reduce también
  el lado un 22%. Máximo 7 intentos.
- **SVG y GIF no pasan por el lienzo si caben**: rasterizar un SVG le quita lo
  que lo hace bueno, y dibujar un GIF animado se queda con un fotograma. Si un
  GIF no cabe, se convierte a imagen fija y se dice.
- Si el original ya cabía y pesa menos que el resultado, **se queda el
  original**: recodificar una imagen pequeña la engorda y le quita calidad a
  cambio de nada.
- El vídeo **no se comprime ni se recorta**: va entero a IndexedDB.

Medido: una foto de 3000×2000 (5 MB de archivo, **13,7 MB de almacén**) queda en
**126 KB** como avatar y 513 KB como fondo, conservando la proporción.

### Vídeo — `js/media.js`

Un vídeo de calidad pesa, y eso está bien. El problema nunca fue el vídeo: era
meterlo en `localStorage`, donde paga el 4/3 de base64 **y** el ×2 de UTF-16.

```
vídeo 1280×720, 3 s              1.59 MB de archivo
  en localStorage (data URI)     4.35 MB     ← ×2.74
  en IndexedDB (Blob)            1.59 MB     ← ×1

espacio disponible
  localStorage                   ~5 MB
  IndexedDB                      2.91 GB     ← 600×
```

Así que el vídeo va a IndexedDB **tal como lo subió el usuario, sin
recomprimir**. El perfil sólo guarda una referencia:

```js
bgValue: "media:mtdmbg1e-qmgm5p"   en vez de   "data:video/mp4;base64,…"
```

Medido de extremo a extremo: un vídeo de 5,65 MB deja el perfil en **4 KB** de
`localStorage`. Antes el tope era 3 MB *de almacén*, o sea 1,1 MB de archivo.

**El contrato de `ID.media`:**

| | |
|---|---|
| `guardar(blob)` | → `media:<id>`, y lo deja ya en caché |
| `precargar(perfil)` | resuelve todas sus referencias. **Nunca falla** |
| `url(ref)` | **síncrono**: mira la tabla en memoria |
| `resolver(v)` | ref → blob URL; URL o data URI → tal cual |
| `borrar` · `recolectar(protegidas)` | huérfanos fuera |
| `inflar(p)` · `extraer(p)` | exportar / importar / rescatar |
| `espacio()` · `persistir()` | cuota real del dispositivo |

**Por qué `precargar` y no `async render`.** `render()` es síncrono y puro, y
eso es lo que hace que el editor se sienta instantáneo (el `touch()` de tres
caminos depende de ello). Los medios se resuelven antes; `url()` sólo lee una
tabla. Si una referencia no está en memoria, `render` **cae al fondo liso** en
lugar de dejar un `<video>` sin fuente.

**Caché acotada.** Una `blob:` URL mantiene vivo el Blob en memoria, así que se
guardan como mucho 8 (LRU) y las que salen se revocan. No se revoca al navegar:
`paintPreview()` llama a `ID.fx.clear()` en **cada** repintado, así que colgar
la limpieza de ahí mataría el fondo a cada tecla.

**Exportar sigue siendo autocontenido.** `inflar()` vuelve a incrustar el vídeo
antes de descargar el `.json`; `extraer()` lo saca al importar. Un perfil
exportado sirve en otro navegador.

**Rescate automático.** Al abrir el editor, un perfil que todavía llevara el
vídeo dentro se mueve a IndexedDB y se avisa de cuánto liberó. Medido:
19,7 MB → 4 KB.

**Lo que sigue pendiente.** El vídeo vive en *este* navegador. Que lo vea
cualquier visitante es la Lección 35 (backend + almacenamiento). Y el navegador
puede desalojar IndexedDB bajo presión de disco: se pide
`navigator.storage.persist()`, pero puede decir que no.

### Escritura — el contrato

```js
store.save(p)  store.saveRaw(u,p)  store.remove(u)  store.setMine(u)
   → true  sólo si la escritura ocurrió
   → false y store.ultimoError = { code, message }
```

`code` ∈ `lleno` · `bloqueado` · `sin-usuario` · `vacio` · `fallo`.
`localStorage.setItem` es atómico: cuando falla, lo ya guardado queda intacto
byte a byte (verificado llenando el almacén hasta el límite real). Quien llama
está obligado a mirar el retorno.

---

## 4. Renderizado del perfil

`js/views/profile.js` expone cuatro entradas:

| Función | Qué hace |
|---|---|
| `render(p, opts)` | Devuelve HTML como string. Puro, sin efectos secundarios |
| `aplicar(cont, p)` | Actualiza sólo variables CSS y atributos. **No reconstruye el DOM** |
| `mount(cont, p)` | Engancha efectos, reproductor y eventos |
| `route(mount, params)` | La ruta pública `#/u/<usuario>` |

Estructura interna:

```
norm(p)            delega en ID.store.normalizar (única fuente)
  ↓
varsDe(p)          → variables --u-*
atributosDe(p)     → data-theme, data-layout, data-surface, data-pos…
clasesDe(p)        → clases del contenedor
cajaDe(p, id)      → superficie por bloque → --b-*
  ↓
B.*                13 funciones, una por bloque del héroe
S.*                5 funciones, una por sección inferior
```

### Sistema de estilos: tres niveles de variables CSS

| Prefijo | Origen | Ejemplo |
|---|---|---|
| `--p-*` | El **tema** (`css/themes.css`) | `--p-bg`, `--p-primary`, `--p-fd` |
| `--u-*` | El **usuario** (`varsDe`) | `--u-gap`, `--u-av`, `--u-name` |
| `--b-*` | El **bloque** (`cajaDe`) | `--b-op`, `--b-blur`, `--b-pad` |

Cascada: tema → usuario → bloque. El bloque siempre gana.
Es el mecanismo de *overrides* que pide la Lección 06 — **ya existe para
superficies**, pero no para color ni tipografía.

### Regla fundacional de v2

```css
.pf[data-surface="none"] .pf-stack{
  background:transparent; border:0; box-shadow:none;
  backdrop-filter:none; padding:0;
}
```

Es lo que hace que **no exista una tarjeta obligatoria**. El perfil nace
integrado con el fondo; la caja es una opción que el usuario enciende.

### Piezas con identidad — «Build your identity»

Un bloque deja de ser *un tipo* para ser *una pieza*. El id de una copia es
`tipo#n`:

```
blockOrder  ['avatar','identity','bio','socials','bio#2','socials#2']
                                                  ^^^^^^  ^^^^^^^^^^
bstyle      { 'bio#2':  {s,op,w,rad,pad,font,anim} }   estilo propio
pos         { 'bio#2':  {col,span,align} }             sitio propio
blocks      { 'bio#2':  false }                        se apaga sola
bcontent    { 'bio#2':  {text:'…'} }                   voz propia
```

**El TIPO decide qué se pinta (`B[tipo]`); el ID, de quién es** el estilo, la
posición, el ancho, la tipografía, la animación y el contenido.

**Por qué así y no reestructurando el modelo.** La Lección 03 propone pasar de
`'bio'` a `{id,type,content,style,layout}`. Eso obliga a migrar todos los
perfiles y a tocar los ~15 sitios de la deuda A1. Aquí basta con que el id
**sea una instancia**: `pos`, `bstyle` y `blocks` ya son mapas indexados por id,
así que no cambian de forma. Un perfil de antes no tiene `#` en ningún id, así
que **no le afecta nada** — verificado sobre las 14 semillas: mismo orden, mismo
render, sin atributos nuevos. Y cuando llegue la Lección 02, el id de instancia
es justo el campo `id` del objeto componente: esto no estorba, adelanta.

`ID.BLOQUES_DUPLICABLES` limita la duplicación a los tipos que ganan algo:
`bio` (el bloque de texto, la pieza universal del constructor) y `socials` (un
grupo puede enseñar sólo un subconjunto de redes). Duplicar el avatar o el nivel
sería la misma pieza dos veces.

### Lo que puede ser distinto en cada pieza

| | Dónde vive | Ya existía |
|---|---|---|
| superficie, opacidad, borde, blur, radio, relleno | `bstyle[id]` | sí |
| ancho | `bstyle[id].w` → `--b-w` | sí |
| posición en la rejilla de 12 | `pos[id]` | sí |
| encendido/apagado | `blocks[id]` | sí |
| **tipografía** | `bstyle[id].font` → `--b-font` | **no** |
| **color** | `bstyle[id].color` → redefine `--p-text/--p-dim/--p-icon` | **no** |
| **animación de entrada** | `bstyle[id].anim` → `data-anim` | **no** |
| **contenido** | `bcontent[id]` | **no** |

**El color por pieza no toca ni una de las veinte reglas que pintan texto.**
Todas leen `--p-text`, `--p-dim` o `--p-icon` del tema, y las custom properties
se heredan: redefinirlas *en la pieza* tiñe todo su contenido y nada más. El
apagado sale del mismo color (`color-mix(… 66%, transparent)`), no de un gris
fijo, para que los secundarios sigan perteneciendo a la familia.

Con un matiz que costó encontrar: eso sólo alcanza a lo que **lee** la variable.
Lo que únicamente **hereda** —el nombre, que no declara `color`— se quedaba con
el valor ya computado en `.pf`. Por eso la pieza vuelve a declararlo:

```css
.pf-stack > *{ color:var(--p-text); }
```

Sin color propio es un no-op: la variable es la misma. Medido: 5 piezas, 5
colores distintos; y al quitarlos, las 5 vuelven exactamente al tema.

`--b-font` se declara con `.pf-stack > *{ font-family:var(--b-font, inherit) }`:
si la pieza no la define, hereda, así que no cambia nada en un perfil que no la
use. La animación de pieza gana sobre la del perfil, y su retardo escalonado va
**después** de la forma corta `animation:` — que reinicia el delay a cero.

Medido sobre un perfil construido: 6 piezas, dos textos distintos, dos grupos de
redes con subconjuntos distintos (4 y 2), y tipografía, superficie, animación y
ancho independientes en cada una. 10 piezas × 6 anchos con contenido extremo:
cero desbordes.

### Direcciones visuales

Un preset **no es un ajuste de medidas: es una dirección completa**. Antes los
nueve cambiaban caja y tamaños y nada más, así que los nueve se veían igual.
Medido sobre el mismo perfil, valores distintos de 9:

| | antes | ahora (de 11) |
|---|---:|---:|
| tema | 1 | **8** |
| fuente de títulos | 1 | **6** |
| fuente de cuerpo | 1 | 4 |
| color de acento | 1 | **8** |
| peso del nombre | 1 | 4 |
| radio | 1 | **9** |
| partículas · cursor · efecto de entrada | 1 | **5 · 5 · 5** |
| espaciado del nombre | 2 | **8** |
| superficie · estilo de redes | 4 | 5 · 4 |

Las once: `center` `immersive` `glass` `card` `left` `minimal` `editorial`
`gaming` `futurista` `row` `libre`.

Dos claves de por qué antes no cambiaba nada:

1. **`blank()` fija un `accent`**, y `varsDe` lo emite como `--p-primary`. Eso
   pisaba el acento del tema, así que cambiar de tema no cambiaba el color.
   Las direcciones ponen `accent:''` para devolvérselo al tema.
2. **`p.preset` nunca llega al render.** Es sólo una marca de UI: el aspecto
   sale de los campos que el preset escribe. Por eso cambiar el catálogo de
   presets no puede alterar ningún perfil ya guardado — verificado sobre las
   14 semillas.

Una dirección es un **punto de partida, no una jaula**: después de aplicarla
cada control individual sigue mandando, y deshacer la revierte en un paso.

### Tipografía: display y cuerpo separadas

El sistema de temas ya distinguía `--p-fd` (display) y `--p-fb` (cuerpo), pero
`--u-font` se usaba en lugar de **las dos**: en cuanto el usuario elegía una
fuente, títulos y cuerpo se volvían la misma cara y el emparejamiento
desaparecía. Ahora:

```css
titulares   var(--u-fontd, var(--u-font, var(--p-fd)))
cuerpo      var(--u-font,  var(--p-fb))
peso nombre var(--u-nameW, 700)
caja nombre var(--u-nameCase, var(--p-uppercase, none))
```

Elegir sólo la fuente de cuerpo sigue cambiándolo todo (compatible hacia
atrás); elegir además la de títulos permite emparejar dos caras, que es lo que
separa una página diseñada de una plantilla. El peso y la caja del nombre
estaban fijos en `700` y en lo que dijera el tema: sin ellos una dirección
editorial no puede tener un nombre fino ni una gaming un nombre en mayúsculas.

Campos nuevos: `fontDisplay`, `nameWeight`, `nameCase`. Los tres vacíos por
defecto, así que un perfil que no los use renderiza exactamente igual que antes
— comprobado sobre las 14 semillas y el perfil en blanco.

### Sin cajas: verificado, no supuesto

| | |
|---|---|
| Direcciones que nacen sin ninguna caja | **6 de 11** |
| `surface:'none'` en los 14 temas | limpio: sin fondo, borde, sombra, blur ni padding |
| `surface:'none'` + `blockStyle:'transparent'` | sólo el avatar pinta caja (tiene sus propios controles) |
| + `avShape:'bare'`, `avBorder:false`, `avGlow:false` | **cero cajas en toda la estructura**, contenido intacto |

### Motor de movimiento

Había **siete bucles `requestAnimationFrame` independientes** y ninguno se
detenía con la pestaña oculta. Ahora hay un solo reloj:

```js
fx.ticker(fn)   // suscribirse; devuelve como bajarse
fx.raf(fn)      // rAF que NO gasta fotogramas con la pestaña oculta
fx.equipo       // { nucleos, memoria, nivel, fps }
fx.puede(coste) // ¿este equipo aguanta este efecto?
```

**Presupuesto de movimiento.** Antes de encender nada se decide cuánto aguanta
el equipo: `hardwareConcurrency`, `deviceMemory`, `(update: slow)` y **los
fotogramas reales del primer segundo**. Por debajo de 45 fps baja a nivel 1
(sólo lo esencial); por debajo de 25, a 0. El parallax declara coste 2, así que
es lo primero que se apaga solo.

**Un fallo que encontró la propia prueba:** `oculto` se inicializaba a `false`
en vez de a `document.hidden`. Si la página carga en una pestaña de fondo,
`requestAnimationFrame` no dispara nunca y, con la suposición equivocada, las
animaciones no arrancaban jamás al volver. Se lee el estado real al arrancar.

### Efectos de puntero

Tres cosas distintas que suelen confundirse en una:

| | Qué hace | Coste |
|---|---|---|
| `fx.magnetismo` | las piezas pequeñas se inclinan hacia el cursor, con caída cuadrática | 1 |
| `fx.brillo` | una luz recorre el fondo bajo el ratón | 1 |
| `fx.parallax` | fondo y contenido se mueven a distinta velocidad | 2 |

Los tres escriben **variables CSS desde el reloj común** y dejan el trabajo al
compositor: ni layout ni repintado del árbol por fotograma. El magnetismo mueve
la pieza y no el puntero, para que el clic siga cayendo donde el ojo lo espera.
Los tres se apagan solos en táctil, con `prefers-reduced-motion` y en equipos
modestos.

El cursor pasa de interpolación lineal a **muelle real** (rigidez 0.22,
amortiguación 0.72): una interpolación llega y se planta; un muelle acelera,
pasa un pelo de largo y se asienta. Y el modo `glitch` distorsiona **según la
velocidad** — quieto no vibra: un glitch constante es ruido.

### Alineación dentro de una pieza

Redes, badges y campos son **filas dentro de una columna**. El stack sólo
declara `align-items` (eje transversal); su `justify-content` no se fija nunca.
Esas tres usaban `justify-content:inherit`, así que tomaban del stack un valor
que nadie establecía y **resolvían a la izquierda aunque el perfil estuviera
centrado** — visible en cuanto se estiraba el bloque a todo el ancho.

Una variable en lugar de tres reglas por elemento, para que ninguna pelea de
especificidad la pueda pisar:

```css
.pf{ --u-just:flex-start; }
.pf[data-align="center"]{ --u-just:center; }
.pf[data-align="right"]{ --u-just:flex-end; }
.pf-socials, .pf-badges, .pf-fields{ justify-content:var(--u-just, flex-start); }
```

Medido con el bloque estirado a 520 px: **172 px a cada lado**. Con alineación
lateral, pegado al borde correcto. En móvil la variable también se centra, como
ya hacía el resto.

### Una sola forma de colocar: el modo libre

Existía un modo «cabecera en fila» que fusionaba el avatar y el nombre en una
pieza (`headrow`). Se quitó: el modo libre hace eso y mucho más, poniendo cada
pieza donde se quiera en una rejilla de 12 columnas. Dos formas de hacer lo
mismo, una de ellas más pobre, sólo confunden.

Fuera con él: `headerLayout`, `ID.HEADER_LAYOUTS`, la fusión en `render()`, el
atributo `data-header` y **diez reglas de `.pf-headrow`**.

### Halos: de caja o de silueta

`box-shadow` dibuja la sombra del **borde de la caja**. En los estilos de redes
que tienen caja —`boxed` (42px, radio 12) y `glow` (42px, círculo)— eso es lo
correcto: el halo rodea la caja.

En `icons` **no hay caja**: fondo transparente, borde 0, radio 0. Ahí el
`box-shadow` pintaba un rectángulo de 28×28 flotando detrás de un icono
redondo, y se veía que era la sombra de una caja invisible.

```css
sin caja   filter: drop-shadow(…)   sigue el canal alfa → la silueta real
con caja   box-shadow: …            sigue el borde → correcto
solo texto text-shadow: …           sigue las letras
```

Dos capas de `drop-shadow`: una corta y densa que define el contorno, otra
larga y suave para el resplandor. El color sale de `--halo`, que es el acento o
el de la marca cuando el monocromo está apagado.

**Detalle de cascada:** la regla que quita el `box-shadow` lleva `.pf` delante a
propósito. Sin él empata en especificidad (0,3,0) con
`.pf.glow-social .pf-social` y pierde por orden de aparición — que es
exactamente lo que pasaba al primer intento.

Verificado: 14 temas × 4 estilos × halo sí/no = **112 combinaciones**, ninguna
con sombra de caja sobre un elemento sin caja, y ninguna que pierda el halo
donde sí hay caja.

### Regla estructural de desbordes

```css
:where(.pf, .pf *){ min-width:0; }
.pf{ overflow-wrap:break-word; }
:where(.pf) :where(.pf-links, .pf-proj){ grid-template-columns:minmax(0,1fr); }
:where(.pf) :where(svg, img, .pf-avatar, .pf-social, .pf-proj__tag,
                   .pf-link__ico, .pf-link__arrow, .pf-status__dot){ flex:none; }
```

Un hijo de rejilla o de caja flexible arranca con `min-width:auto` — «nunca más
estrecho que mi contenido» —, y como el perfil no tiene scroll horizontal, lo
que se sale no queda a un scroll de distancia: desaparece. Antes esto se
parcheaba bloque a bloque (11 `min-width:0` sueltos); ahora la causa se declara
una vez. `:where()` no suma especificidad, así que cualquier `min-width`
explícito del archivo sigue mandando.

La cuarta regla es el contrapeso: lo que tiene tamaño propio no debe encoger.

Verificado en 320 · 375 · 390 · 430 · 768 · 1180 px con perfiles de contenido
extremo y las 14 semillas: cero desbordes.

---

## 5. El editor

`dashboard.js`. Rejilla de tres columnas:
`200px (secciones) | 380px (controles) | resto (previsualización)`

### El principio: una cosa a la vez

El editor tenía **278 controles**, y `Diseño` sola llevaba **121 en 6,3
pantallas de scroll**. Mezclaba lo global con lo que pertenece a cada pieza, y
además lo duplicaba: el avatar y las redes tenían sus opciones en `Diseño` **y**
en el panel de su bloque.

Ahora la regla es simple: **lo que pertenece a una pieza vive en su pieza.**

| | Dónde |
|---|---|
| Superficie global, composición, movimiento | sección `Diseño` |
| Tema, acento, colores, brillo | sección `Apariencia` |
| Tipografía del nombre, peso, caja, halo | panel de **Nombre** |
| **Color propio** | panel de **cada** pieza |
| Imagen, emoji, forma, tamaño, borde, halo | panel de **Avatar** |
| Estilo, tamaño, monocromo, halo de silueta | panel de **Redes** |
| Texto, tipografía del cuerpo, tamaño, interlineado | panel de **Texto** |
| Su caja, su animación, su sitio | panel de **cada** pieza |

**Con una pieza seleccionada se ve sólo su panel.** Antes se pintaba el panel de
la pieza *y además* la sección entera debajo: el usuario tenía las dos cosas
delante y no sabía cuál mandaba.

Resultado medido:

| | Antes | Ahora |
|---|---:|---:|
| `Diseño` | 121 ctrl · 6,3 pantallas | **58 · 3,7** |
| Panel de una pieza | no existía completo | 28–44 ctrl · 1,7–2,8 pantallas |

### Identidad en piezas sueltas

Nombre, `@usuario`, oficio y fecha eran **un solo bloque**: no se podían mover,
vestir ni posicionar por separado. Ahora son cuatro piezas, cada una con su
tipografía, su caja y su sitio.

**Dos cosas había que resolver para no romper lo ya guardado:**

`normalizar()` añade al final los ids del catálogo que falten. Sin migración,
el `@usuario` habría aparecido **al pie del perfil** en todo lo existente. Por
eso el paso **v3 → v4** las inserta justo detrás del nombre:

```
antes    avatar, identity, status, bio, socials, views
después  avatar, identity, handle, meta, joined, status, bio, socials, views
```

Y `.pf-idblock` tenía `gap:4px` entre sus hijos; como piezas sueltas quedarían
separadas por el hueco del stack —16 px, **cuatro veces más**—. Una regla las
mantiene juntas *cuando van seguidas*, y las suelta si el usuario las separa a
propósito:

```css
.pf:not([data-layout="free"]) .pf-stack > .pf-idblock + .pf-idblock{
  margin-top:calc(4px - var(--u-gap, 16px));
}
```

Medido: 4 px entre piezas seguidas con cualquier hueco de stack; 16 px cuando
el usuario las separa.

### Dos puertas a la misma pieza

Tocar el bloque en la vista previa ya funcionaba, pero **hay que descubrirlo**.
La segunda puerta es evidente: en la lista de Bloques el nombre de cada fila es
un botón con una flecha. Trece filas, trece puertas.

Cambiar de sección **suelta** la pieza abierta (`irA()`). Sin eso la navegación
parece rota: pulsas «Apariencia» y sigue delante el panel del bloque.

### El modo Simple, que antes no simplificaba

Medido: Simple y Avanzado enseñaban **los mismos 214 controles**. El interruptor
sólo plegaba acordeones que casi nadie usaba, porque apenas había nada envuelto
en `avanzado()`.

Ahora lo que la pieza **es** va siempre visible, y lo que la **afina** —su caja,
su animación, su sitio exacto, los píxeles— se pliega en Simple y se abre solo
en Avanzado:

| Panel | Simple | Avanzado |
|---|---|---|
| Redes | **8** de 32 · 1,0 pantalla | 32 · 2,1 |
| Texto | **15** de 28 · 1,3 | 28 · 2,0 |
| Avatar | **19** de 37 · 1,5 | 37 · 2,2 |
| Nombre | **28** de 44 · 1,9 | 44 · 2,8 |
| Sección Diseño | **38** de 58 · 2,5 | 58 · 3,7 |

El criterio de qué queda visible: **las decisiones con más efecto visual por
decisión** (tipografía, forma, color) se ven; el ajuste numérico (píxeles,
espaciado, opacidad) se pliega. Quien está creando su primera bio no debería
tropezarse con un deslizador de opacidad.

### El corazón: `touch(mount, tipo)`

Tres caminos según lo que cambió — este es el motivo de que el editor se
sienta fluido:

| tipo | Qué hace |
|---|---|
| `'estilo'` | `profile.aplicar()` — sólo variables CSS. **No reconstruye** |
| `'texto'` | Repinta con 260 ms de retardo |
| `'estructura'` | Repinta inmediatamente |

Además: historial de undo agrupado a 420 ms, autoguardado a 900 ms.

## 6. Rutas

```
#/                        portada
#/u/<usuario>             perfil público
#/dashboard[?claim=x]     editor
#/discover                descubrir
#/top                     ranking
#/analytics               estadísticas
#/ai                      generador
#/templates               plantillas
#/pricing                 precios
```

15 nombres reservados: `dashboard discover top analytics ai pricing templates
u api admin login signup settings help about`.

`serve.py` reescribe `/usuario` → `index.html`, así que la URL limpia ya
funciona en desarrollo.

---

## 7. Efectos

`effects.js` tiene un ciclo de vida correcto y consistente:

```js
fx.register(fn)   // apunta una función de limpieza
fx.clear()        // ejecuta y vacía todas
```

Cada efecto (`particles`, `tilt`, `cursor`, `countUp`, `reveal`) devuelve su
propia limpieza: cancela el `requestAnimationFrame`, desconecta el
`ResizeObserver`, quita los listeners. El router llama a `fx.clear()` en cada
navegación.

**Esto está bien construido y no debe tocarse.**

---

## 8. Música

`music.js` separa correctamente motor de interfaz:

```
reproductorYouTube(cont, id, cb)  ─┐
                                   ├──► crearReproductor(host, pistas, cb)
Audio() para previews de Spotify ─┘        (controlador unificado)
```

`crearReproductor` expone `play/pause/siguiente/anterior/buscar/tiempo` sin que
quien lo usa sepa qué motor hay debajo.

Spotify usa **PKCE**, que funciona sin secreto de servidor. Requiere que el
usuario pegue su propio Client ID.

**Limitación real:** Spotify sólo entrega fragmentos de 30 s, y no para todas
las pistas. La interfaz lo etiqueta como "sin audio" cuando no hay fragmento.

---

## 9. Qué es real — ya no hay nada simulado

En producción no puede haber datos de relleno: un visitante no distingue un
perfil real de uno inventado, y el dueño de un perfil no puede saber que el
«42% Colombia» que lee no lo contó nadie.

**Quitado:**

| Qué | Cuánto |
|---|---|
| `ID.SEED` — 14 perfiles inventados con sus visitas, votos y badges | 271 líneas |
| Catálogo de 13 plantillas con autor, usos y estrellas falsos (@ana, 183.051 usos) | 131 líneas |
| `ID.MARKET` — 6 artículos de mercado | 26 líneas |
| El PRNG de analíticas: serie por día, países, referentes, dispositivos, tiempo medio | 67 líneas |

**Lo que queda, y está medido:**

| Dato | Cómo se mide |
|---|---|
| Visitas | contadas, 1 por perfil / día / navegador (`identity.seen.v1`) |
| Serie diaria | las visitas de cada día, guardadas al contarlas (`stats[u].dias`) |
| Tendencia y mejor día | derivados de esa serie real |
| Clics en redes | contados al pulsar (`identity.clicks.v1`) |
| Votos y medias | reales |
| Nivel, XP y badges | reglas sobre datos reales |

**Lo que no se puede medir sin servidor** —país, referente, dispositivo, tiempo
de permanencia— aparece **vacío y declarado**, no estimado. `analytics()`
devuelve `sinDatos: ['geo','refs','devices','avgTime']` para que la vista pueda
decirlo en lugar de inventarlo.

### Estados vacíos

Con cero perfiles, las listas tienen que decir que la plataforma es nueva, no
que la búsqueda falló. Descubrir distingue «no hay nadie» de «tu búsqueda no
encuentra»; el Ranking no dibuja un podio de tres huecos; Plantillas invita a
publicar la primera. Los tres llevan a crear un perfil.

### Guardar como plantilla

**Lista negra, no blanca.** La lista blanca que había enumeraba los campos que
podían viajar, y se quedó obsoleta en cuanto el perfil creció: no incluía la
tipografía de títulos, el peso ni la caja del nombre, el orden de los bloques,
sus posiciones, el color por pieza ni el estilo de cada una. **Una plantilla
publicada con aquella lista perdía justo lo que hace único a un perfil.**

Enumerar lo que **no** puede viajar es una lista corta y estable —quién eres y
lo que has escrito—; todo lo demás es apariencia, y cualquier campo nuevo entra
solo.

`bcontent` es el caso fino: lleva la **estructura** de las copias (qué redes
enseña cada grupo) pero se le quita el `text`. Una plantilla no te escribe la
bio.

El formulario enseña **lo que se va a guardar** al lado del nombre: nombrar algo
a ciegas es como se publican plantillas que nadie reconoce después. Sustituye a
un `prompt()`. Se llega desde Ajustes en el editor (`#/templates?nueva=1`), que
es donde de verdad se diseña.

### Dónde van las plantillas oficiales

En `js/views/templates.js`, la constante `SEED`, con el formato documentado
ahí mismo. `config` acepta cualquier campo del perfil salvo identidad y
contenido: una plantilla cambia cómo se ve, no quién eres. Las de la comunidad
no se escriben ahí — llegan de `identity.mytpl.v1` cuando alguien publica.

## 10. Seguridad actual

- `ID.util.esc()` escapa todo texto de usuario antes de entrar al HTML.
  Verificado: los 10 archivos de vista lo importan desde `ID.util`, ninguno
  redefine el suyo.
- `ID.util.safeUrl()` filtra por esquema: sólo `http:`, `https:`, `mailto:`,
  `tel:`, `#`. Todo lo demás → `#`. `ejemplo.com` → `https://ejemplo.com`.
- Enlaces externos con `rel="noopener noreferrer nofollow"`.
- Dentro del editor los enlaces no navegan.

**Lo que no hay:** validación de entrada en `store.save()`. Sólo comprueba que
haya un `username` válido; el resto del objeto entra sin verificar (deuda M4).
Es tolerable mientras el único escritor sea el editor del propio dueño; deja de
serlo con backend (Lección 36).

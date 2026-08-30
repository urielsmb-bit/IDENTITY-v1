# IDENTITY

**Tu identidad, en línea.** No es un Linktree: es un constructor de identidad digital.
Cada usuario tiene una URL (`identity.gg/uriel`) que abre una página propia a pantalla
completa, compuesta por bloques que él decide, sobre el fondo que él elija.

Sin dependencias, sin build, sin Node. HTML + CSS + JS plano.

---

## Cómo abrirlo

```bash
python serve.py
```

Y entra a <http://127.0.0.1:8765>.

`serve.py` hace dos cosas que `python -m http.server` no hace: manda `Cache-Control: no-store`
(sin eso el navegador sigue sirviendo el JS viejo mientras editas, y se pierde muchísimo
tiempo depurando código ya arreglado) y reescribe `/uriel` a `index.html`, que es como
funcionaría en producción.

También funciona abriendo `index.html` con doble clic: todo el estado vive en `localStorage`.

---

## La decisión de diseño que sostiene el producto

**No existe una tarjeta de perfil obligatoria.**

El perfil no es un contenedor con cosas dentro. Es una pila de bloques independientes sobre
un fondo, y la caja es *una opción más* entre cinco:

| Superficie | Qué hace |
|---|---|
| `none` | El contenido flota sobre el fondo. **Es el valor por defecto.** |
| `glass` | Vidrio con desenfoque y opacidad regulables |
| `solid` | Caja opaca clásica |
| `outline` | Sólo el borde, fondo transparente |
| `glow` | Caja con halo del color de acento |

Esto es lo que separa un perfil de un formulario. Por eso `Diseño` va antes que
`Apariencia` en el panel: la primera pregunta no es "¿de qué color?", es "¿hay caja?".

### Posicionamiento libre

Hay dos modos de composición:

- **En columna** — los bloques se apilan. Arrastrando en `Bloques` se cambia el orden.
- **Libre** — la pila se vuelve una **rejilla de 12 columnas** y cada bloque elige columna
  de inicio, ancho y alineación. Así se pueden poner dos bloques en la misma fila (avatar a
  la izquierda, nombre a la derecha), empujar las redes a un lado o dejar la bio a todo lo
  ancho.

Es libertad real sin posicionamiento absoluto, que es justo donde estos editores se rompen:
**en móvil la rejilla se rinde sola** y todo vuelve a una columna en el orden que elegiste.

Una aclaración importante: **la alineación no mueve el bloque por la pantalla.** El bloque
va siempre centrado; `Alineación del contenido` alinea el texto dentro, y si de verdad
quieres pegarlo a un borde está `Posición en pantalla` aparte. Mezclar las dos cosas era un
error que hacía que elegir "izquierda" mandara todo contra el filo del navegador.

### Todo lo demás que el usuario controla

- **Composición**: alineación (centro / izquierda / derecha), ancho, separación entre bloques
- **Tipografía**: 10 familias, más la del tema
- **Avatar**: forma (círculo, redondeado, cuadrado, sin máscara), tamaño, borde, halo, 5 animaciones
- **Redes**: 4 estilos (iconos sueltos, en caja, con halo, sólo texto) y tamaño de icono
- **Música**: 4 estilos (minimal, compacto, tarjeta, sólo controles)
- **Fondo por capas**: media → opacidad → overlay → desenfoque → ruido → viñeta → partículas
- **Bloques**: 16 interruptores, reordenables arrastrando
- **Cajas internas**: estado, enlaces, música y stats pueden vestirse aparte de la caja
  principal (sin caja, vidrio, sólida, sólo borde) con su propia curvatura
- **Movimiento**: 4 animaciones al pasar el puntero y 6 de entrada (incluida escalonada)
- **Ancho**: ajustar al contenido, fijo o completo — el modo "ajustar" evita el problema
  de la caja enorme y medio vacía
- **Secciones**: 5 secciones reordenables que aparecen al hacer scroll
- **Color por elemento**: acento, texto, fondo, icono, y gradiente
- **Brillo selectivo**: nombre, redes y badges por separado

9 presets (`Centro`, `Inmersivo`, `Vidrio`, `Tarjeta`, `Izquierda`, `Minimal`, `Editorial`,
`Gaming`, `Fila`) son puntos de partida, no jaulas: configuran varias cosas de golpe y
después se toca lo que sea.

---

## El editor

**Fácil de empezar, difícil de agotar.** El mismo editor sirve a quien no sabe nada de
diseño y a quien quiere pasarse horas.

- **Asistente de creación** en 4 pasos: estilo → color → identidad → redes. Nunca se
  empieza con una página en blanco: el paso 1 ya trae un estilo aplicado y el preview lo
  demuestra en vivo. Se puede saltar.
- **Click para editar**: tocas cualquier elemento del preview y se abre la sección que lo
  configura, con el bloque resaltado. No hay que adivinar en qué menú vive cada cosa.
- **Arrastrar con el ratón** sobre el propio preview: arriba y abajo reordena; en modo libre,
  a los lados cambia de columna. Un click corto sigue seleccionando — el arrastre sólo
  empieza pasados 5px. Si mueves de lado un bloque que ocupa las 12 columnas, se estrecha
  solo a 6: quedarse quieto sin explicación sería peor que decidir por el usuario.
- **Redimensionar tirando de los bordes**: al seleccionar un bloque en modo libre aparecen
  dos asas. La derecha cambia el ancho; la izquierda mueve el borde izquierdo dejando fijo
  el derecho.
- **Panel del bloque seleccionado**: al tocar una caja del preview aparece arriba su propio
  panel con lo justo para ella — el avatar trae forma, tamaño y animación; las redes, estilo
  y color. No hay que buscar en qué menú vive cada cosa.

### Cada bloque tiene su propia caja

La superficie dejó de ser una sola caja que envuelve todo el perfil. Ahora **cada bloque
lleva la suya**: el de redes puede ser de vidrio, la bio de solo borde y el resto sin caja,
a la vez. Cada una con su opacidad, desenfoque, borde, curvatura, **relleno** y halo.

El tamaño se ajusta **tirando de los bordes con el ratón**, en los dos modos: en columna
cambia el ancho en porcentaje, en rejilla libre cambia las columnas que ocupa.

La caja global (`Diseño → Superficie`) sigue existiendo para quien la quiera; si un bloque
define la suya, manda la suya.

### Música

Tres fuentes:

- **Manual** — una ficha sin sonido, para enseñar qué escuchas sin reproducir nada.
- **YouTube** — pegas el enlace y suena de verdad con el reproductor incrustado. El título
  y la portada se rellenan solos con oEmbed, que es público y no necesita clave.
- **Spotify** — conectas tu cuenta y eliges una canción de tus playlists.

El reproductor funciona de verdad: **tiempo que avanza, barra arrastrable** (con ratón,
tacto y flechas del teclado) y **anterior / pausa / siguiente**. Admite **lista de
reproducción**: añades varias canciones, las reordenas arrastrando y los botones las
recorren. Con una sola, los botones reinician la pista en vez de quedarse muertos.

Un controlador único envuelve los dos motores (el iframe de YouTube y el `<audio>` de los
fragmentos de Spotify) tras la misma interfaz, así que la vista del perfil no sabe de dónde
sale el sonido.

Sobre Spotify, sin adornos: la conexión usa **PKCE**, que sí funciona desde un sitio
estático porque no necesita secreto de servidor. Lo que sí hace falta es que registres una
app en `developer.spotify.com` y pegues su Client ID; el editor te muestra la URI de retorno
exacta para copiarla. Reproducir el catálogo completo exigiría Premium y el Web Playback
SDK, así que usamos el fragmento de 30s (`preview_url`). Cuando una pista no lo trae, se
guarda la ficha y se enlaza a Spotify **en vez de fingir que suena** — y la interfaz lo
marca con una etiqueta.

### El preview no se reconstruye a cada cambio

Antes, cualquier ajuste rehacía todo el HTML del perfil: se reiniciaban las partículas,
se perdía el scroll y parpadeaba. Ahora hay tres caminos:

| Tipo de cambio | Qué hace |
|---|---|
| **Estilo** (colores, tamaños, espaciado, superficie, fuentes, posición) | Se aplica encima del DOM existente. Sin reconstruir, sin parpadeo. Es la mayoría. |
| **Texto** (nombre, bio, título) | Reconstruye agrupado a 260ms, para no rehacerlo en cada tecla. |
| **Estructura** (encender bloques, añadir enlaces, reordenar) | Reconstruye al instante, conservando el scroll. |

Mover o redimensionar un bloque **no reconstruye nada**: el DOM ya quedó en su sitio
durante el arrastre.
- **Autoguardado**: no hay botón de guardar. `Publicar` existe sólo para el momento de
  compartir, que tiene su propia pantalla con el enlace y la tarjeta de previsualización.
- **Deshacer / rehacer** con `Ctrl+Z` y `Ctrl+Shift+Z`. Los pasos se agrupan: arrastrar un
  deslizador no genera cuarenta pasos de historial.
- **El preview es la columna grande**: barra 200px · controles 350px · preview el resto.
  A 1440px eso son 898px de perfil al 72%, y el botón de concentración esconde los controles
  para verlo al 100%. Los controles se quedan estrechos a propósito y sus rejillas internas
  se adaptan con container queries, porque esa columna mide lo mismo sea cual sea la ventana.
- **Simple / Avanzado**: por defecto sólo lo importante. Lo fino vive detrás de
  desplegables, y el modo Avanzado los abre todos de golpe.
- **Lenguaje humano**: "Compacto / Normal / Amplio" en vez de pedir píxeles. Las medidas
  exactas siguen ahí, en Avanzado.

---

## Rutas

| Ruta | Qué es |
|---|---|
| `#/` | Portada, con un perfil demo **funcionando** y editable en vivo |
| `#/u/uriel` | Un perfil público |
| `#/dashboard` | Panel de 9 secciones con vista previa en tiempo real |
| `#/templates` | Plantillas de la comunidad, con miniaturas vivas |
| `#/discover` | Explorar perfiles, con búsqueda y 9 filtros |
| `#/top` | Ranking con podio y 6 categorías |
| `#/analytics` | Métricas con gráfica dibujada en canvas |
| `#/ai` | Generador de perfiles a partir de una descripción |
| `#/pricing` | Planes y marketplace de temas |

---

## Mapa del código

```
serve.py         servidor de desarrollo (sin caché + rutas limpias)
css/
  base.css       tokens del sistema (superficies, texto, radios, motion)
  chrome.css     navegación + portada
  themes.css     los 14 temas de perfil
  profile.css    la página de perfil  ← la arquitectura v2 vive aquí
  panels.css     descubrir, ranking, analytics, generador, precios, plantillas
  dashboard.css  el panel de edición
js/
  nets.js        catálogo de ~54 redes con color, prefijo e icono
  data.js        temas, badges, presets, fuentes, bloques y perfiles semilla
  store.js       persistencia y reglas  ← el único archivo que cambia con backend
  effects.js     partículas, inclinación 3D, cursores, contadores
  router.js      enrutador por hash
  app.js         arranque, avisos, portapapeles, archivos
  views/         una vista por pantalla
```

### La separación que sostiene todo

**Dashboard = claridad. Perfil = personalidad.**

El chrome del producto usa Inter, acento blanco y superficies neutras. Los perfiles usan
las tipografías y paletas que el usuario elija. Por eso el editor puede ser aburrido
mientras los perfiles son extremos.

### Cómo se añade un tema

Un tema es un bloque de tokens. `profile.css` no se toca:

```css
.pf[data-theme="vaporwave"]{
  --p-bg:#1A0B2E;      --p-bg2:#3D1F5C;
  --p-surface:rgba(255,255,255,.06);
  --p-text:#F0E6FF;    --p-dim:#A98BC7;
  --p-primary:#FF71CE; --p-accent:#01CDFE;
  --p-line:rgba(255,113,206,.3);
  --p-chip-r:14px;
  --p-fd:'Chakra Petch', system-ui, sans-serif;
}
```

Luego añade `{ id:'vaporwave', name:'Vaporwave' }` a `ID.THEMES` en `data.js` y una muestra
`.sw-vaporwave` en `themes.css`.

### Cómo se añade una red

Una entrada en `ID.NETS` (`js/nets.js`) con `label`, `color`, `group`, `prefix`, `ph` e
`icon`. Aparece sola en el selector, en el buscador y en el filtro por grupo.

---

## Qué es real y qué está simulado

Esto importa más que la lista de funciones.

### Real

- Todo el editor y la vista previa en vivo.
- 14 temas, 5 superficies, 9 presets, 10 tipografías, 7 tipos de partículas, 5 cursores.
- 54 redes con iconos propios, búsqueda, filtro por grupo y URL personalizada.
- Guardado, exportación e importación de perfiles.
- **Conteo de visitas**, una por perfil y día. **Clics en redes**, contados de verdad.
- Votación con media móvil.
- Búsqueda, filtros, ranking, perfil del día y plantillas (aplicar, favoritas, publicar).
- Motor de badges: cada uno se desbloquea por una condición evaluada sobre el perfil.
- Progreso del perfil: 8 pasos accionables que llevan a la sección que los resuelve.

### Simulado, y por qué

| Qué | Por qué no es real |
|---|---|
| Países, referentes, dispositivos, serie histórica | Sin servidor no hay forma honesta de saber de dónde viene un visitante. Se generan con un PRNG sembrado con el usuario: son **estables** entre recargas, no ruido. |
| "Live Status" y el widget de Discord | Requiere la API de presencia de Discord (Lanyard o un bot propio). |
| Previsualización al compartir (Open Graph) | Las etiquetas se escriben en el DOM y funcionan en el navegador, pero Twitter, Discord y WhatsApp leen el HTML **del servidor**. Para que la tarjeta salga bien al pegar el enlace hace falta renderizarlas en el servidor. |
| Pagos y marketplace | No hay pasarela conectada. Los botones lo dicen. |
| Perfiles de otras personas | Son semillas locales. No hay cuentas ni base de datos compartida. |

Los **iconos de las redes** son interpretaciones geométricas propias, no los assets oficiales
de cada marca: se leen bien a 20px y no arrastran problemas de licencia. Si algún día quieres
los logos reales, hay que revisar las condiciones de uso de cada marca una por una.

El generador de `#/ai` **no llama a ningún modelo**: es un motor de reglas local, para que
funcione sin red y sin clave. Para enchufar un LLM, sustituye `generate()` en
`js/views/ai.js` — devuelve un objeto de perfil y el resto de la app no se entera.

---

## Qué falta para que esto sea un producto

1. **Backend y cuentas.** Hoy dos personas no pueden ver el mismo perfil. Todo pasa por
   `ID.store`, así que es el único archivo que hay que reescribir: `localStorage` → `fetch`.
2. **Rutas limpias en producción.** `serve.py` ya las hace en local; en Netlify es
   `_redirects`, en Vercel `rewrites`, en nginx `try_files`.
3. **Analytics de verdad.** Un endpoint que registre visita + país + referente y sustituya
   `store.analytics()`.
4. **Subida de archivos.** Ahora las imágenes se guardan como data URI en `localStorage`,
   que se llena rápido. Hace falta almacenamiento de objetos (S3, R2) y límites de tamaño.
   Es el cuello de botella más urgente si la gente va a subir fondos de video.
5. **Presencia de Discord** vía Lanyard o un bot propio.
6. **Pagos** (Wompi o Mercado Pago para Colombia; Stripe fuera).
7. **Moderación.** Perfiles públicos con imágenes y texto libre necesitan reportes y revisión.

---

## Detalles que quizá no se noten

- Las **métricas viven aparte del perfil** (`identity.stats.v1`). Antes, contar una visita
  clonaba el perfil entero a `localStorage` y esa copia tapaba al original para siempre:
  cualquier mejora al catálogo se volvía invisible para quien ya lo hubiera visitado.
- La **puerta de entrada** ("toca para entrar") no es decorativa: es lo que permite arrancar
  el audio, porque el navegador exige un gesto del usuario.
- En **móvil** las partículas bajan de 130 a 44 como máximo, el brillo del puntero se apaga
  y las alineaciones laterales se centran (a esa anchura dejan líneas huérfanas).
- `prefers-reduced-motion` desactiva partículas, inclinación, cursores y el nombre animado.
- Todo el texto de usuario se escapa; las URLs se filtran por esquema (`javascript:` → `#`);
  los enlaces externos llevan `rel="noopener noreferrer nofollow"`.
- El canvas de partículas se detiene al cambiar de vista (`ID.fx.clear()`), así que nada
  queda consumiendo CPU de fondo.

---

## Decisiones que quizá quieras discutir

- **Pago único en vez de suscripción.** Cobrar mensualidad por un perfil personal ahuyenta
  justo al público objetivo. Los precios en COP son una propuesta.
- **El watermark "Crea tu perfil"** sólo aparece en perfiles gratuitos. Es el motor del
  bucle viral y a la vez el incentivo para pagar.
- **Los badges no se compran.** En cuanto un badge se puede comprar deja de significar algo.
  Los de pago son sólo `premium` y `supporter`, y se ven distintos.
- **Los presets no bloquean nada.** Después de aplicar uno, todos los controles siguen
  disponibles. Un preset que no se puede desarmar es una plantilla, no un punto de partida.

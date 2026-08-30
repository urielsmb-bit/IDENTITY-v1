# IDENTITY — Esquema del perfil

> Fase 0 · 28/08/2026. Versión actual del modelo: **v4**.
> Este documento describe **qué es un perfil**, qué significa que un campo
> falte, y cómo se migra un perfil viejo. Es la referencia para cualquier
> cambio de forma futuro.

---

## 1. La versión

Todo perfil lleva un campo `v` con la versión de su esquema.

```js
ID.store.VERSION   // 4
```

| `v` | Qué es |
|---|---|
| *ausente* | Perfil anterior a la Fase 0. Objeto plano sin declaración de esquema. Es lo que hay en `identity.profiles.v2` de cualquier navegador que usara IDENTITY antes de esta versión, y también la forma de las 14 semillas de `js/data.js`. |
| `3` | El mismo objeto plano, pero **declarando su esquema** y con la estructura mínima garantizada por `normalizar()`. |
| `4` | Versión actual. El bloque de identidad se partió en piezas: `handle`, `meta` y `joined` entran en `blockOrder` **justo detrás de `identity`**. |

**Por qué 3 y no 1.** La clave de almacenamiento se llama `identity.profiles.v2`
y el sistema de composición se documenta como «v2» en el código. Numerar la
primera versión declarada como 3 evita que el número del esquema y el de la
clave digan cosas distintas. El siguiente cambio de forma —el modelo agrupado
de la Lección 02— será **v4**.

`v` se escribe en tres momentos:

- `store.save(p)` y `store.saveRaw(u, p)` — todo lo que se guarda queda al día.
- `store.normalizar(p)` — todo lo que se pinta o se edita también.

---

## 2. La forma

Un perfil es un **objeto plano**. Solo seis claves están anidadas:
`pos`, `bstyle`, `blocks`, `sectionsOn`, `status`, `ratings`.

```js
{
  v: 3,

  // identidad
  username, name, title, location, pronouns, age, emoji, avatarUrl, fields[]

  // apariencia
  theme, accent, font, colText, colBg, colIcon, gradient, monoIcons,
  animatedName, glowName, glowSocials, glowBadges, noise

  // composición
  preset, align, layoutMode, stackPos, widthMode, headerLayout,
  stackWidth, gap, pad, radius, blockOrder[], pos{}, bstyle{}

  // superficie
  surface, sOpacity, sBorder, sBlur, sGlow, blockStyle, blockRadius

  // fondo
  bgType, bgValue, bgBlur, bgDim, bgOpacity, vignette, bgFixed

  // efectos
  particles, cursor, tilt, avatarFx, hoverFx, enterFx

  // contenido
  bio, about, socials[], links[], projects[], gallery[], live[], audio, tags[]

  // bloques y secciones
  blocks{}, sections[], sectionsOn{}

  // métricas (viven además en identity.stats.v1)
  views, likes, level, xp, xpMax, badges[], ratings{}

  // ajustes
  discoverable, verified, premium, gate, showStats, showRate, showLevel, joined
}
```

### Ids de pieza

`blockOrder` puede llevar **ids de instancia** con la forma `tipo#n`
(`bio#2`, `socials#3`). El tipo se saca con `ID.util.tipoBloque(id)` y
`ID.util.esCopia(id)` dice si es una copia.

`pos`, `bstyle`, `blocks` y `bcontent` están indexados por ese id, así que cada
pieza lleva su propio estilo, sitio, interruptor y contenido. **Esto no sube la
versión del esquema**: la forma de los mapas no cambia y un perfil anterior no
tiene ningún id con `#`.

`normalizar()` razona por tipo, no por id: completa el catálogo con los tipos
que falten y conserva las copias.

| Mapa | Qué guarda de una pieza |
|---|---|
| `bstyle[id]` | `s` `op` `bd` `blur` `rad` `pad` `glow` `w` `font` `anim` |
| `pos[id]` | `col` `span` `align` (modo libre) |
| `blocks[id]` | encendido/apagado |
| `bcontent[id]` | `text` (bio) · `nets` (subconjunto de redes) |

### Tipografía

| Campo | Vacío significa |
|---|---|
| `font` | la fuente de cuerpo del tema (`--p-fb`) |
| `fontDisplay` | la de títulos hereda de `font`, y si tampoco hay, del tema (`--p-fd`) |
| `nameWeight` | `700` |
| `nameCase` | lo que diga el tema (`--p-uppercase`) |

Los cuatro vacíos por defecto: un perfil que no los toque se pinta exactamente
igual que antes de que existieran.

### Referencias a medios

`bgValue` puede contener tres cosas distintas, y son autodescriptivas:

| Valor | Qué es |
|---|---|
| `https://…` | una URL externa; no ocupa nada |
| `data:video/…` | el medio incrustado (perfiles anteriores, y ficheros exportados) |
| `media:<id>` | una referencia a IndexedDB (ver `js/media.js`) |

**Esto no sube la versión del esquema**, y es deliberado: la *forma* del objeto
no cambia y el prefijo dice por sí solo qué es cada valor. Subir a v4 por un
cambio que no necesita migración nos enseñaría a ignorar el número de versión
justo cuando la Lección 02 va a necesitar que signifique algo.

*(En la propuesta previa dije que esto sería v3 → v4. Al implementarlo quedó
claro que no hay nada que migrar: el código lee los tres formatos y los perfiles
viejos siguen funcionando sin tocarlos.)*

### Campos heredados

Tres campos son anteriores al sistema de bloques y **no se han eliminado**:
siguen siendo la forma en que un perfil viejo expresa su intención.

| Campo | Lo que decide hoy |
|---|---|
| `showStats` | valor por defecto de `blocks.stats` |
| `showRate` | valor por defecto de `sectionsOn.rate` |
| `discordWidget` | valor por defecto de `blocks.discord` |

Un perfil que ya traiga `blocks` o `sectionsOn` manda sobre ellos. La Lección 02
es el sitio donde se retirarán, con una migración que los traduzca.

---

## 3. Los valores por defecto

**Hay una sola función que decide qué significa que un campo falte:**

```js
ID.store.normalizar(perfil)   // -> copia normalizada, no muta el argumento
```

Antes de la Fase 0 había tres tablas de defaults —`store.blank()`,
`store.normalizar()` y un `norm()` privado de `js/views/profile.js`— y no
coincidían. El resultado medido: con el mismo perfil, **9 de las 14 semillas
pintaban un bloque en el editor que el perfil público no pintaba**.

### Tabla de campos sueltos

```js
preset:'center'  align:'center'  surface:'none'
avShape:'circle' avSize:112  avBorder:true  avGlow:true
socialStyle:'icons'  musicStyle:'compact'  badgeStyle:'full'
font:''  fontDisplay:''  nameWeight:''  nameCase:''
stackWidth:460  gap:16  pad:null  radius:18
nameSize:0  bioSize:0  iconSize:20
sOpacity:null  sBorder:null  sBlur:22  sGlow:40
bgOpacity:100  vignette:0  bgFixed:true  monoIcons:true
widthMode:'fixed'  headerLayout:'stack'
layoutMode:'stack' stackPos:'center'
blockStyle:'inherit'  blockRadius:null
hoverFx:'lift'  enterFx:'rise'
nameSpacing:0  lineHeight:0
```

### Bloques

Cuatro de ellos **se derivan del propio perfil**, no son constantes:

```js
avatar:true   name:true    handle:true  meta:true   joined:false
fields:true   live:true    bio:true     badges:true socials:true  music:true
views:false

status:  true
discord: !!p.discordWidget
level:   p.layout === 'gamecard'
stats:   p.showStats !== false
```

### Secciones

```js
sections:   ['links','about','gallery','projects','rate']
sectionsOn: { about: !!p.about, links:true, gallery:true,
              projects:true, rate: p.showRate !== false }
```

### Estructura mínima garantizada

Después de `normalizar()`, quien lee un perfil puede dar por hecho que:

- `blockOrder` existe, contiene solo ids del catálogo `ID.BLOCK_ORDER`, y está
  completo (los ids nuevos del catálogo se añaden al final; los que ya no
  existen se descartan).
- `pos`, `bstyle`, `blocks`, `sectionsOn`, `status` y `ratings` son objetos.
- `socials`, `links`, `projects`, `gallery`, `tags`, `live`, `fields` y `badges`
  son arrays.
- `v === 3`.

### `blank()` no es una segunda tabla

`store.blank()` es **un perfil concreto** que pasa por `normalizar()` como
cualquier otro. Solo declara lo que un perfil nuevo tiene de propio y los dos
valores en los que el punto de partida se aparta a propósito del esquema:

| Campo | Esquema | `blank()` | Por qué |
|---|---|---|---|
| `widthMode` | `'fixed'` | `'auto'` | un perfil nuevo se adapta al ancho disponible |
| `blocks.views` | `false` | `true` | el perfil nuevo enseña su contador |
| `blocks.stats` | derivado (`true`) | `false` | un perfil recién creado no tiene estadísticas que enseñar |

---

## 4. La migración

```js
ID.store.migrar(perfil)   // -> perfil en el esquema actual
```

Reglas:

1. Si `p.v === 3`, **devuelve el mismo objeto sin tocarlo**.
2. Si `p.v > 3`, lo deja pasar tal cual. Un perfil de una versión más nueva
   nunca se degrada.
3. Si no hay `v`, copia el objeto y le pone `v: 3`. **No renombra ni elimina
   ningún campo.**

Es **idempotente** por construcción: `migrar(migrar(p))` es idéntico a
`migrar(p)`, porque la segunda llamada entra por la regla 1.

`normalizar()` llama a `migrar()` como primer paso, así que cualquier perfil que
se pinte o se edite queda migrado por el camino.

### El paso v3 → v4 sí transforma

Es el primero que mueve datos. `normalizar()` añade al final los ids que falten
del catálogo, así que sin este paso el `@usuario` aparecería al pie del perfil
en todo lo ya guardado. La migración los coloca donde estaban:

```js
['handle','meta','joined'].forEach(function (id, k) {
  if (orden.indexOf(id) === -1) {
    var i = orden.indexOf('identity');
    orden.splice(i === -1 ? k : i + 1 + k, 0, id);
  }
});
```

Un perfil sin `v` sella v3 y **vuelve a entrar** en `migrar()`, para no tener
que repetir el salto en cada escalón futuro.

### El paso v2 → v3 no transforma nada

Es deliberado. La forma del objeto plano no cambia; lo que aporta v3 es que el
perfil **declara** su esquema y que la estructura mínima está garantizada. Sin
ese campo, la Lección 02 no tendría forma de saber con qué forma se escribió
cada perfil guardado, y reestructurar el modelo los rompería todos sin
posibilidad de recuperarlos.

`migrar()` es el sitio donde irá el paso **v3 → v4** (modelo agrupado). El patrón
que debe seguir:

```js
if (v < 4) { /* traducir campos planos a grupos */ out.v = 4; }
```

Escalón a escalón, sin saltos, y siempre conservando lo que el usuario escribió.

---

## 5. Guardar

```js
ID.store.save(p)          // true solo si quedó escrito
ID.store.saveRaw(u, p)    // idem, sin evaluar badges
ID.store.remove(u)        // idem
ID.store.setMine(u)       // idem
ID.store.ultimoError      // { code, message } del último fallo
```

`false` significa que **nada se escribió**. Los códigos:

| `code` | Cuándo |
|---|---|
| `lleno` | el navegador rechazó por cuota (`QuotaExceededError`) |
| `bloqueado` | modo privado o permisos (`SecurityError`) |
| `sin-usuario` | el perfil no tiene nombre de usuario válido |
| `vacio` | no se pasó perfil |
| `fallo` | cualquier otra excepción, con su mensaje |

`localStorage.setItem` es atómico: cuando falla, **lo que ya estaba guardado
queda intacto byte a byte**. Verificado en la Fase 0 llenando el almacén hasta
el límite real y comprobando que el contenido de `identity.profiles.v2` no
cambiaba ni un byte.

Quien llame a `save()` está obligado a mirar el resultado. El editor lo hace:
si falla, marca **«Error al guardar»**, deja el estado como pendiente, enseña el
motivo y avisa antes de cerrar la pestaña.

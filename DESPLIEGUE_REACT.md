# IDENTITY React — sacarlo a producción

> Complementa a `DESPLIEGUE_VERCEL.md`, que describe el despliegue de la
> versión vanilla que hoy vive en `identity-v1.vercel.app`. Aquí solo va lo
> que cambia al subir `react/`.

---

## Primero: por qué al entrar te manda a `identity-v1.vercel.app`

No es un fallo del código de React. Es la configuración de Supabase.

En **Authentication → URL Configuration** hay dos campos:

| Campo | Valor actual | Qué hace |
|---|---|---|
| **Site URL** | `https://identity-v1.vercel.app` | El destino por defecto |
| **Redirect URLs** | `https://identity-v1.vercel.app/**` | La lista blanca |

Cuando la app pide volver a una dirección concreta —y la nuestra lo hace,
`redirectTo: window.location.origin + destino`— Supabase comprueba si esa
dirección está en **Redirect URLs**. Si no está, **la ignora en silencio y usa
el Site URL**. Como `http://localhost:3000/**` no está en la lista, al entrar
con Discord o Google te deja en producción, en la versión vieja.

**Arreglo (30 segundos, sin tocar código):** Supabase → Authentication → URL
Configuration → *Redirect URLs* → añadir

```
http://localhost:3000/**
```

Ese es el puerto que declara `vite.config.ts`. Añade también el de cualquier
otro puerto que uses. A partir de ahí, entrar en local vuelve a local.

---

## La decisión previa: ¿reemplazar o convivir?

**A — Apuntar el proyecto de Vercel que ya existe a `react/`.**
Se cambia el *Root Directory* a `react` y listo. El dominio no cambia, así que
Supabase no hay que tocarlo y todos los enlaces que la gente ya haya compartido
siguen funcionando. Pero la versión vanilla desaparece en el mismo paso: si algo
sale mal, la vuelta atrás es otro despliegue.

**B — Proyecto nuevo (`identity-v2.vercel.app`), y cambiar el dominio cuando esté probado.** *(recomendada)*
Las dos versiones conviven contra la misma base de datos, se prueba con calma y
el cambio final es mover el dominio. Cuesta un paso extra: hay que meter el
dominio nuevo en las *Redirect URLs* de Supabase, o el login del v2 te mandará
al v1 exactamente por lo de arriba.

El resto de esta guía asume la **B**.

---

## Pasos

### 1 · Repositorio

Hoy no hay ninguno (`git status` no devuelve nada). Conviene inicializarlo en
la carpeta padre `c\`, no dentro de `react\`: así el mismo repositorio guarda
las dos versiones y el esquema de `supabase/`, y Vercel elige cuál construye
con el *Root Directory*.

```bash
cd "C:/Users/uriel/Desktop/c" && git init && git add -A && git status --short
```

Antes de commitear, **mira la lista que imprime ese `git status`**. Los dos
`.gitignore` ya excluyen `node_modules/`, `dist/`, los `.env*` y los documentos
internos, pero conviene comprobarlo con los ojos una vez: un secreto que entra
en un commit no se saca del historial borrando el archivo, se considera
comprometido y hay que rotarlo.

### 2 · Vercel

**Add New → Project → Import**, y en la pantalla de configuración:

| Campo | Valor |
|---|---|
| **Root Directory** | `react` ← lo importante |
| Framework Preset | Vite *(lo detecta solo)* |
| Build Command | `npm run build` |
| Output Directory | `dist` |

El `react/vercel.json` ya trae los *rewrites* de SPA (sin ellos, `/discover` o
`/u/shark` darían 404 al recargar), las cabeceras de seguridad y el cacheado de
`/assets`.

### 3 · Variables de entorno

En Vercel → Settings → Environment Variables. Los mismos valores que tienes en
`react/.env.local`:

| Variable | Obligatoria | Nota |
|---|---|---|
| `VITE_SUPABASE_URL` | sí | Solo el dominio, sin `/rest/v1` |
| `VITE_SUPABASE_KEY` | sí | La *anon public*. Viaja al navegador por diseño; lo que protege los datos es RLS |
| `VITE_FN_VISTAS` | no | Vacío = se deduce de la URL del proyecto |
| `VITE_BUCKET_MEDIA` | no | Por defecto `media` |
| `VITE_VERSION_LEGAL` | no | Por defecto `2026-08-29` |

Sin las dos primeras la app arranca en **modo local**: se puede editar un perfil
pero no hay cuentas ni nube. Es a propósito — un fallo visible en vez de uno
silencioso.

### 4 · Las direcciones de retorno

Con la URL del despliegue ya en la mano, Supabase → Authentication → URL
Configuration → **Redirect URLs**, añadir:

```
https://identity-v2.vercel.app/**
http://localhost:3000/**
```

El **Site URL** se deja en el v1 hasta que decidas cambiar. Discord y Google no
se tocan: sus *redirect URI* apuntan al callback de Supabase, no a tu dominio.

### 5 · Las funciones de borde

Solo si quieres el contador de visitas y el borrado de cuenta. La lista de
orígenes es una lista blanca que **falla cerrada**, así que el dominio nuevo
tiene que estar dentro o el contador se queda a cero sin decir por qué:

```bash
supabase secrets set ORIGENES_PERMITIDOS="https://identity-v2.vercel.app,https://identity-v1.vercel.app,http://localhost:3000"
```

```bash
supabase functions deploy registrar-vista && supabase functions deploy borrar-cuenta
```

El secreto va **antes** del despliegue: la función lee la variable al arrancar.

### 6 · Comprobar

- [ ] La portada carga
- [ ] `/u/shark` y `/shark` muestran el mismo perfil *(la ruta corta es un
      alias; los enlaces que ya circulan del v1 siguen valiendo)*
- [ ] Recargar estando en `/discover` **no** da 404 *(prueba los rewrites)*
- [ ] Entrar con Discord vuelve a **tu** dominio
- [ ] El editor guarda y el cambio se ve al abrir el perfil en otro dispositivo
- [ ] La consola no tiene errores de CSP *(mira el punto siguiente)*

---

## Vimeo

Dos cosas que conviene separar, porque tu mensaje las junta:

**El vídeo, sí.** Ya está construido: `lib/vimeo.ts` reconoce las cuatro formas
del enlace (incluidos los privados con `hash`) y arma el `iframe` de fondo con
`background=1&autoplay=1&loop=1&muted=1&dnt=1`. El `dnt=1` es lo que impide que
Vimeo rastree a quien visita tu perfil.

**Las imágenes, no.** Vimeo aloja vídeo; no es un CDN de imágenes. Los avatares,
los fondos y los GIF **ya viajan a Supabase Storage** (bucket `media`, migración
`0006_storage.sql`), y eso funciona hoy: `SubirMedio` reduce y recomprime las
fotos, y deja pasar los GIF enteros para no matarles la animación. No hay nada
que mover a Vimeo.

### Tres cosas que sí hay que mirar

1. **CSP.** El `vercel.json` de la versión vanilla permitía YouTube y Spotify
   pero **no** Vimeo, y el de React no traía CSP ninguna. Ya está puesta, con
   `frame-src … https://player.vimeo.com`. Sin eso el fondo de vídeo saldría en
   negro en producción y en local no, que es la peor forma de encontrarlo.

2. **El plan de Vimeo.** El parámetro `background=1` —el que quita controles,
   barra y logotipo— **es de pago, a partir de Plus**. En la cuenta gratuita se
   ignora y sale el reproductor completo, con sus botones encima del perfil.
   Merece la pena confirmar qué plan tienes antes de prometerlo como función.

3. **Dominios permitidos en Vimeo.** Si pones un vídeo como privado, hay que
   añadir el dominio en *Vimeo → el vídeo → Embed → Specific domains*, o el
   `iframe` responde 403.

---

## Limpieza ya hecha en esta ronda

- Fuera `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` y `zod`:
  cuatro dependencias con **cero** importaciones en `src/`.
- CSP añadida al `react/vercel.json`, con Vimeo dentro.
- `sourcemap: false` ya estaba: en producción no se publica el código fuente.

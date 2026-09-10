# Subir IDENTITY a Hostinger

Hostinger Premium es hosting compartido: sirve ficheros y ejecuta PHP, pero
no Node. La aplicación es un `dist/` estático y todo el backend vive en
Supabase, así que encaja — **salvo una pieza**, y por eso existe esta
carpeta.

## La pieza

`api/perfil.ts` es una función que en Vercel se pone delante de
`/u/<usuario>` y devuelve el HTML con las etiquetas `og:` ya puestas. No es
un detalle de posicionamiento: **el producto es el enlace**. Cuando alguien
pega su perfil en Discord, en WhatsApp o en Telegram, la tarjeta de vista
previa la arma un robot que **no ejecuta JavaScript** — lee el HTML tal como
llega y se va. Sin esa pieza, todos los perfiles se comparten iguales: sin
nombre y sin foto.

`perfil.php` es su gemelo. Hace lo mismo, con los mismos textos, sacados de
las mismas funciones de `src/lib/tarjeta.ts` traducidas una a una. Está
comprobado contra la salida real de Vercel para el mismo perfil: las nueve
etiquetas salen idénticas.

## 1 · Armar la carpeta

```bash
npm run build:hostinger
```

Deja todo listo en `salida-hostinger/`: la aplicación compilada más
`perfil.php`, `.htaccess` y un `config.php` generado desde tu `.env.local`.

## 2 · Subirlo

Todo el contenido de `salida-hostinger/` va dentro de `public_html`, **sin
la carpeta**: `index.html` tiene que quedar en la raíz de `public_html`, no
en `public_html/salida-hostinger/`.

> **Cuidado con `.htaccess`.** Empieza por punto y casi todos los clientes de
> FTP y los administradores de archivos lo esconden por defecto. Si no lo
> subes, la web arranca y parece que todo va bien — hasta que alguien recarga
> dentro de un perfil y le sale un 404, o comparte su enlace y sale sin
> tarjeta. Activa «mostrar archivos ocultos» y compruébalo.

## 3 · Tres ajustes que no están en el código

Cambiar de dominio rompe tres cosas que viven fuera del repositorio. Ninguna
da un error claro: simplemente dejan de funcionar.

### a) El origen permitido de las funciones

Las funciones de Supabase **fallan hacia cerrado**: sin el dominio en la
lista no devuelven cabecera de CORS y el navegador rechaza la respuesta.
Deja de contarse las visitas, de poder borrar la cuenta y de subir vídeos.

```bash
npx supabase secrets set ORIGENES_PERMITIDOS="https://TU-DOMINIO,http://localhost:5199"
```

Ojo: **sustituye** la lista entera, no añade. Pon todos los que quieras que
sigan valiendo.

### b) Las direcciones de vuelta del login

En el panel de Supabase → **Authentication → URL Configuration**: pon tu
dominio en *Site URL* y añádelo a *Redirect URLs*. Sin esto, entrar con
Discord o con Google te devuelve a un sitio que Supabase no acepta y el
inicio de sesión se queda a medias.

### c) Vimeo, si usas fondos de vídeo

Vimeo limita por dominio dónde se pueden incrustar sus vídeos. El dominio
nuevo no está en esa lista, así que los fondos de vídeo salen en negro.

```bash
npx supabase secrets set VIMEO_DOMINIOS="TU-DOMINIO,localhost"
```

Y en la propia cuenta de Vimeo hay que añadir el dominio a los permitidos de
cada vídeo o de la cuenta.

## 4 · Comprobar que quedó bien

Cuatro pruebas, en este orden. Las cuatro fallan de formas distintas y las
cuatro son silenciosas:

1. **La portada carga.** Si no, es que `index.html` no está en la raíz.
2. **Entra a `TU-DOMINIO/u/shark` y recarga.** Si sale 404, falta el
   `.htaccess`.
3. **La tarjeta.** Pega la dirección de un perfil en el validador de Meta
   (`developers.facebook.com/tools/debug`) o en un chat de Discord: tiene que
   salir el nombre y la foto. Si sale «IDENTITY — Tu identidad, en línea», es
   que `perfil.php` no se está ejecutando; si sale el nombre pero sin foto,
   es que ese perfil no tiene avatar.
4. **Inicia sesión.** Si te devuelve a la portada sin sesión, es el punto 3b.

## Qué NO se sube

`config.php` lleva la clave **anónima**, la misma que ya viaja dentro del
JavaScript que descarga cualquier visitante: no es un secreto. La clave de
**servicio** no entra en esta carpeta por ningún motivo — esa se salta todas
las políticas de la base.

## Lo que se pierde respecto a Vercel

Nada de la aplicación, pero sí dos comodidades:

- **No hay despliegue al hacer `git push`.** Cada cambio es compilar y subir
  por FTP. Es el precio real de mudarse.
- **`s-maxage` deja de valer.** Sin un CDN delante, `perfil.php` consulta a
  Supabase en cada visita a un perfil. Con el tráfico de hoy no se nota, y el
  día que se note, poner Cloudflare gratis delante lo arregla sin tocar nada:
  la cabecera ya está puesta y empieza a funcionar sola.

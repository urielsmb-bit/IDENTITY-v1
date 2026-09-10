<?php
/**
 * Las etiquetas de un perfil, puestas en el servidor. Version de Hostinger.
 *
 * Esto es el gemelo en PHP de `api/perfil.ts`, la funcion que en Vercel se
 * pone delante de `/u/<usuario>`. Hace falta porque un hosting compartido no
 * ejecuta Node, y sin esta pieza el producto pierde justo lo que lo hace
 * funcionar:
 *
 * sharee es una sola pagina que se rellena en el navegador, asi que lo que
 * sale por el cable es SIEMPRE el mismo cascaron, con el mismo titulo para
 * todo el mundo y sin una sola etiqueta `og:`. Cuando alguien pega su perfil
 * en Discord, en WhatsApp o en Telegram, la tarjeta de vista previa la arma
 * un robot que NO ejecuta JavaScript: lee el HTML tal como llega y se va. Sin
 * esto, todos los perfiles se comparten iguales — sin nombre y sin foto.
 *
 * Lo que cambia respecto a la version de Vercel, y por que:
 *
 *  - El cascaron se lee del DISCO (`index.html`, aqui al lado) en vez de
 *    pedirse por HTTP. Alla habia que pedirlo para acertar con la version
 *    del despliegue; aqui el fichero y este guion se suben juntos, asi que
 *    leerlo es mas rapido, no puede fallar por red y no necesita reintentos.
 *
 *  - No hay marca `_o` ni redireccion de rescate. Alla el guion vivia
 *    DELANTE del CDN y tenia que poder devolverle el turno; aqui es el guion
 *    quien sirve el fichero, asi que no hay a quien devolverselo ni bucle
 *    posible.
 *
 * Si algo falla se devuelve el cascaron sin tocar. Una vista previa pobre es
 * un problema; una pagina que no carga es otro mucho mayor.
 */

/* ---- de donde salen la direccion y la clave -------------------------
   La clave es la ANONIMA, la misma que ya viaja dentro del JavaScript que
   descarga cualquier visitante: aqui no se publica nada que no estuviera
   publicado. La clave de servicio NO se pone en este fichero ni en ningun
   otro que sirva el servidor web. */
$SUPA  = getenv('VITE_SUPABASE_URL') ?: '';
$CLAVE = getenv('VITE_SUPABASE_KEY') ?: '';
if ((!$SUPA || !$CLAVE) && is_file(__DIR__ . '/config.php')) {
    $cfg   = require __DIR__ . '/config.php';
    $SUPA  = $SUPA  ?: ($cfg['url'] ?? '');
    $CLAVE = $CLAVE ?: ($cfg['key'] ?? '');
}

/** El mismo `NOMBRE_SITIO` de `src/lib/tarjeta.ts`. */
const NOMBRE_SITIO = 'sharee';

/**
 * Escapar aqui no es higiene, es la diferencia entre una etiqueta y un
 * agujero. El nombre y la biografia los escribe cualquiera; metidos en un
 * atributo sin escapar, un `">` cierra la etiqueta y lo que venga detras se
 * ejecuta en el dominio de sharee para todo el que abra ese perfil.
 */
function esc($v): string
{
    return htmlspecialchars((string) $v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** Una linea, sin saltos y sin pasarse de largo: es para una tarjeta.
 *  Gemelo de `linea()` en `src/lib/tarjeta.ts`. `mb_substr` y no `substr`:
 *  cortar por bytes parte una tilde por la mitad. */
function linea($v, int $max): string
{
    $t = trim(preg_replace('/\s+/u', ' ', (string) $v) ?? '');
    return mb_substr($t, 0, $max, 'UTF-8');
}

/** «Uriel (@shark) · sharee». Gemelo de `tituloTarjeta()`. */
function tituloTarjeta(array $p): string
{
    $usuario = linea($p['username'] ?? '', 32);
    $nombre  = linea($p['name'] ?? '', 60) ?: $usuario;
    return $nombre . ' (@' . $usuario . ') · ' . NOMBRE_SITIO;
}

/** La biografia; si no hay, el oficio; si tampoco, una frase que al menos
 *  diga de quien es la pagina. Gemelo de `descripcionTarjeta()`. */
function descripcionTarjeta(array $p): string
{
    $usuario = linea($p['username'] ?? '', 32);
    $bio     = linea($p['bio'] ?? '', 160);
    if ($bio !== '') return $bio;
    $oficio = linea($p['title'] ?? '', 60);
    if ($oficio !== '') return $oficio;
    return 'El perfil de @' . $usuario . ' en ' . NOMBRE_SITIO . '.';
}

/** Solo sirve un avatar que este en la red. `media:` apunta al almacen del
 *  propio navegador —esa foto nunca sale de su maquina— asi que como imagen
 *  de una tarjeta no existe. Gemelo de `imagenTarjeta()`. */
function imagenTarjeta($url): string
{
    $s = (string) $url;
    return preg_match('#^https://#i', $s) ? substr($s, 0, 500) : '';
}

/**
 * Servir el HTML y salir.
 *
 * La cabecera es la misma que en Vercel. `s-maxage` no hace nada sin un CDN
 * delante, y no estorba: el dia que se ponga uno —Cloudflare, sin ir mas
 * lejos— empieza a valer sin tocar esto. Se guarda en el borde y NO en el
 * navegador a proposito: asi un cambio en el perfil se ve en minutos y no
 * cuando le caduque la copia a cada visitante.
 */
function servir(string $cuerpo, int $segundos): void
{
    header('Content-Type: text/html; charset=utf-8');
    header("Cache-Control: public, max-age=0, s-maxage=$segundos, stale-while-revalidate=86400");
    echo $cuerpo;
    exit;
}

/* ---- el cascaron ---------------------------------------------------- */
$html = @file_get_contents(__DIR__ . '/index.html');
if ($html === false || strpos($html, 'id="root"') === false) {
    /* Sin cascaron no hay pagina que servir, y eso no es un fallo de esta
       pieza: es que la subida esta incompleta. Se dice en claro, porque un
       502 mudo aqui manda a buscar el problema al sitio equivocado. */
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo "Falta index.html junto a perfil.php. Sube el contenido de dist/ entero.";
    exit;
}

/* El nombre de usuario se limpia antes de tocar nada: va a una consulta y va
   al HTML, y en los dos sitios lo que no sea un nombre de usuario no tiene
   por que pasar. */
$usuario = strtolower((string) ($_GET['u'] ?? ''));
$usuario = substr(preg_replace('/[^a-z0-9_.-]/', '', $usuario) ?? '', 0, 32);
if ($usuario === '' || $SUPA === '' || $CLAVE === '') servir($html, 60);

/* Las mismas columnas que pide el navegador. No es capricho: la fila se manda
   entera dentro del HTML para que la aplicacion no tenga que volver a
   pedirla, y si aqui faltara una columna el perfil llegaria distinto segun
   por donde entres —sin visitas, sin nota—. */
$CAMPOS = 'id,username,apariencia,creado,actualizado,vistas,nota,num_notas';

/* La vista publica, no la tabla: es la que existe para que la lea cualquiera,
   y a proposito no expone el dueño de cada perfil. */
$url = rtrim($SUPA, '/') . '/rest/v1/perfiles_publicos'
     . '?select=' . rawurlencode($CAMPOS)
     . '&username=eq.' . rawurlencode($usuario)
     . '&limit=1';

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => ['apikey: ' . $CLAVE, 'Authorization: Bearer ' . $CLAVE],
    CURLOPT_TIMEOUT        => 3,
    CURLOPT_CONNECTTIMEOUT => 2,
]);
$cuerpo = curl_exec($ch);
$estado = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($cuerpo === false || $estado !== 200) servir($html, 60);

$filas = json_decode($cuerpo, true);
if (!is_array($filas) || !isset($filas[0]) || !is_array($filas[0])) {
    /* No existe ese perfil. Se cachea mas rato: la respuesta a «no existe»
       no va a cambiar en el minuto siguiente. */
    servir($html, 300);
}
$fila = $filas[0];
$ap   = is_array($fila['apariencia'] ?? null) ? $fila['apariencia'] : [];

/* Los tres, del mismo sitio que la previsualizacion del editor, para que lo
   que te enseña antes de compartir sea literalmente lo que va a leer
   Discord. Una previa que miente es peor que no tener ninguna. */
$datos = [
    'username' => $usuario,
    'name'     => linea($ap['name']  ?? '', 60),
    'title'    => linea($ap['title'] ?? '', 60),
    'bio'      => linea($ap['bio']   ?? '', 160),
];
$titulo      = tituloTarjeta($datos);
$descripcion = descripcionTarjeta($datos);
$imagen      = imagenTarjeta($ap['avatarUrl'] ?? '');

$esquema = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host    = (string) ($_SERVER['HTTP_HOST'] ?? '');
$enlace  = $esquema . '://' . $host . '/' . $usuario;

$etiquetas = array_filter([
    '<title>' . esc($titulo) . '</title>',
    '<meta name="description" content="' . esc($descripcion) . '" />',
    '<link rel="canonical" href="' . esc($enlace) . '" />',
    '<meta property="og:site_name" content="' . NOMBRE_SITIO . '" />',
    '<meta property="og:type" content="profile" />',
    '<meta property="og:url" content="' . esc($enlace) . '" />',
    '<meta property="og:title" content="' . esc($titulo) . '" />',
    '<meta property="og:description" content="' . esc($descripcion) . '" />',
    $imagen ? '<meta property="og:image" content="' . esc($imagen) . '" />' : '',
    /* `summary` y no `summary_large_image`: un avatar es cuadrado, y pedir
       tarjeta ancha lo deja recortado o con franjas a los lados. */
    '<meta name="twitter:card" content="summary" />',
    '<meta name="twitter:title" content="' . esc($titulo) . '" />',
    '<meta name="twitter:description" content="' . esc($descripcion) . '" />',
    $imagen ? '<meta name="twitter:image" content="' . esc($imagen) . '" />' : '',
]);
$etiquetas = implode("\n  ", $etiquetas);

/**
 * Y la fila entera, para que el navegador no la vuelva a pedir.
 *
 * Ver un perfil eran cuatro pasos en fila india —HTML, JavaScript, consulta a
 * Supabase, pintar— y los tres primeros no se solapan. El tercero sobra: la
 * fila ya esta aqui, se consulto para escribir las etiquetas de arriba.
 *
 * Va escapado el `<`, que es lo unico que puede romper esto: un `</script`
 * dentro del JSON cerraria la etiqueta ahi mismo y lo que siguiera —una
 * biografia, un nombre— pasaria a ser HTML de la pagina.
 *
 * Y con tope: pasado cierto tamaño, meterlo en el HTML retrasa lo que venia a
 * adelantar.
 */
$precarga = '';
$json = json_encode($fila, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if (is_string($json) && strlen($json) <= 48 * 1024) {
    $precarga = "\n  <script id=\"perfil-precargado\" type=\"application/json\">"
              . str_replace('<', '\\u003c', $json)
              . '</script>';
}

/* Se SUSTITUYE lo que ya trae el cascaron. Añadir los nuevos sin quitar los
   viejos deja dos de cada, y cual gana lo decide cada robot por su cuenta: la
   mitad enseñaria el titulo generico. Ya paso una vez. */
$salida = preg_replace('#<title>[\s\S]*?</title>\s*#i', '', $html, 1);
$salida = preg_replace('#<meta\s+name="description"[^>]*>\s*#i', '', $salida, 1);
$salida = preg_replace('#<meta\s+(?:property|name)="(?:og|twitter):[^"]*"[^>]*>\s*#i', '', $salida);

$pos = stripos($salida, '</head>');
if ($pos !== false) {
    $salida = substr($salida, 0, $pos)
            . '  ' . $etiquetas . $precarga . "\n"
            . substr($salida, $pos);
}

servir($salida, 300);

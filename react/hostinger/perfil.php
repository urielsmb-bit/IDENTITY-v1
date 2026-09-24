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

/** El titulo de la PESTAÑA: el nombre y nada mas; sin nombre, el usuario.
 *  Gemelo de `tituloPestana()`. No es el de la tarjeta: ese lo lee alguien
 *  que no ha abierto el perfil y necesita el @usuario y el «· sharee». */
function tituloPestana(array $p): string
{
    return linea($p['name'] ?? '', 60) ?: linea($p['username'] ?? '', 32);
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
    $s = is_string($url) ? $url : '';
    return preg_match('#^https://#i', $s) ? substr($s, 0, 500) : '';
}

/** La cara que enseña el perfil: la subida, la de Discord o la de la
 *  cuenta, en ese orden. Gemelo de `caraTarjeta()`. Aqui solo se miraba la
 *  subida, asi que quien entraba con Discord tenia un perfil CON cara y una
 *  tarjeta SIN ella. */
function caraTarjeta(array $ap): string
{
    foreach (['avatarUrl', 'discordAvatar', 'cuentaAvatar'] as $k) {
        $u = imagenTarjeta($ap[$k] ?? '');
        if ($u !== '') return $u;
    }
    return '';
}

/** Sin cara, la de la marca: la de la portada, 1200 x 630. Gemelo de
 *  `IMAGEN_MARCA`. Una tarjeta sin imagen se lee como enlace sospechoso. */
const IMAGEN_MARCA = '/compartir.jpg';

/** `ProfilePage` de schema.org, lo que le dice a Google que esto es el
 *  perfil de una persona. Gemelo de `datosEstructurados()`. */
function datosEstructurados(array $d): array
{
    $redes = [];
    foreach ((is_array($d['redes'] ?? null) ? $d['redes'] : []) as $r) {
        $u = imagenTarjeta(is_array($r) ? ($r['url'] ?? '') : '');
        /* Con algo detras del dominio: `https://discord.gg/` a secas es una
           red añadida y sin rellenar, no la cuenta de nadie. */
        if (preg_match('#^https://[^/]+/[^?\#]#i', $u)) $redes[] = $u;
        if (count($redes) >= 20) break;
    }
    $persona = [
        '@type'         => 'Person',
        'name'          => linea($d['nombre'] ?? '', 60) ?: $d['usuario'],
        'alternateName' => '@' . $d['usuario'],
        'identifier'    => $d['usuario'],
        'url'           => $d['enlace'],
    ];
    $bio = linea($d['bio'] ?? '', 160);
    if ($bio !== '') $persona['description'] = $bio;
    if (($d['cara'] ?? '') !== '') $persona['image'] = $d['cara'];
    if ($redes) $persona['sameAs'] = $redes;

    $pagina = [
        '@context'   => 'https://schema.org',
        '@type'      => 'ProfilePage',
        'url'        => $d['enlace'],
        'mainEntity' => $persona,
    ];
    if (is_string($d['creado'] ?? null) && $d['creado'] !== '') $pagina['dateCreated'] = $d['creado'];
    if (is_string($d['actualizado'] ?? null) && $d['actualizado'] !== '') $pagina['dateModified'] = $d['actualizado'];
    return $pagina;
}

/**
 * Servir el HTML y salir.
 *
 * Se guarda en el BORDE y no en el navegador, a proposito: asi un cambio en
 * el perfil se ve en minutos y no cuando le caduque la copia a cada
 * visitante.
 *
 * ---- POR QUE YA NO HAY `stale-while-revalidate` -----------------------
 *
 * Habia uno de 86.400 segundos. Lo que hace esa directiva es: mientras se
 * comprueba si hay algo nuevo, SIRVE LA COPIA VIEJA. Durante veinticuatro
 * horas. Asi que quien ya habia visitado un perfil veia el de su visita
 * anterior al instante, y el actual solo en la carga SIGUIENTE.
 *
 * Y no era solo el aspecto: este HTML lleva la fila del perfil escrita
 * dentro -`perfil-precargado`- y el cliente la usa sin preguntar a nadie.
 * O sea que un HTML de ayer son DATOS de ayer, y nada los refrescaba.
 *
 * Tambien apuntaba a los `assets/` de su despliegue, que llevan resumen en
 * el nombre: HTML viejo, bundle viejo, aplicacion vieja.
 *
 * `s-maxage` se queda -eso es el CDN, no el visitante- pero corto. Un
 * minuto de margen para absorber una punta de trafico es util; un dia de
 * copia vieja en el navegador de cada uno, no.
 */
function servir(string $cuerpo, int $segundos, int $estado = 200, string $cuando = ''): void
{
    /**
     * Y con ETag, que es lo que convierte «revalida siempre» en algo
     * barato.
     *
     * `max-age=0, must-revalidate` obliga al navegador a preguntar en cada
     * visita, que es lo que queremos. Pero sin un validador no hay nada que
     * comparar: el servidor no puede contestar «no ha cambiado» y tiene que
     * mandar el HTML ENTERO cada vez. Medido antes de esto: `/shark` no
     * traia ni `ETag` ni `Last-Modified`.
     *
     * El resumen sale del cuerpo ya montado, o sea que incluye el perfil
     * escrito dentro: si alguien cambia su nombre, su tema o un enlace, el
     * ETag cambia y la respuesta viaja. Si no ha cambiado nada, son 304 y
     * cero bytes.
     *
     * Ojo con el orden: el 304 se contesta ANTES de escribir nada, y sin
     * cuerpo — un 304 con cuerpo es una respuesta invalida.
     */
    $etag = '"' . md5($cuerpo) . '"';
    header("Cache-Control: public, max-age=0, must-revalidate, s-maxage=$segundos");
    header("ETag: $etag");

    /**
     * Y `Last-Modified`, porque el ETag NO LLEGA.
     *
     * Comprobado en produccion: se pone —el codigo esta desplegado, un
     * `If-None-Match: *` contesta 304— pero la cabecera no aparece en la
     * respuesta, ni con compresion ni sin ella. Alguien de la cadena la
     * quita: los ETag FUERTES se caen a menudo cuando el servidor o el CDN
     * recomprimen, porque el cuerpo que sale ya no es el que se resumio.
     *
     * `Last-Modified` sobrevive mucho mejor a esa misma cadena, y ademas
     * aqui es mas honesto que un resumen: la fecha sale de `actualizado`,
     * o sea de cuando su dueño toco el perfil por ultima vez. Si no lo ha
     * tocado, no ha cambiado.
     *
     * Se mandan los dos y se acepta cualquiera de los dos. Lo que
     * sobreviva, sirve.
     */
    if ($cuando !== '') {
        /**
         * LA MAS RECIENTE DE LAS DOS, Y ESTO NO ES UN DETALLE.
         *
         * `actualizado` dice cuando toco su dueño el perfil. Pero esta
         * respuesta es perfil MAS cascaron, y el cascaron cambia en cada
         * despliegue: nombres de bundle nuevos, que son justo los que hay
         * que entregar.
         *
         * Con la fecha del perfil a secas, alguien que vuelve despues de un
         * despliegue mandaria su `If-Modified-Since`, el perfil no habria
         * cambiado, se le contestaria 304 y se quedaria con el HTML viejo
         * apuntando a ficheros que ya no existen. O sea exactamente el
         * fallo que se acaba de arreglar, reintroducido por la puerta de
         * atras y solo para quien repite visita.
         *
         * Asi que manda la mas nueva de las dos.
         */
        $ts = strtotime($cuando);
        $delCascaron = @filemtime(__DIR__ . '/index.html');
        if ($delCascaron && (!$ts || $delCascaron > $ts)) $ts = $delCascaron;
        if ($ts) {
            $fecha = gmdate('D, d M Y H:i:s', $ts) . ' GMT';
            header("Last-Modified: $fecha");
            $desde = trim((string) ($_SERVER['HTTP_IF_MODIFIED_SINCE'] ?? ''));
            if ($desde !== '' && $estado === 200) {
                $t2 = strtotime($desde);
                if ($t2 && $ts <= $t2) {
                    http_response_code(304);
                    exit;
                }
            }
        }
    }

    $traido = trim((string) ($_SERVER['HTTP_IF_NONE_MATCH'] ?? ''));
    /* El navegador puede mandarlo con el prefijo `W/` de validador debil, o
       varios separados por coma. Basta con que el nuestro este entre ellos. */
    if ($traido !== '' && $estado === 200) {
        foreach (explode(',', $traido) as $uno) {
            $uno = trim($uno);
            if ($uno === $etag || $uno === 'W/' . $etag || $uno === '*') {
                http_response_code(304);
                exit;
            }
        }
    }

    http_response_code($estado);
    header('Content-Type: text/html; charset=utf-8');
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
    /* No existe ese perfil: 404, no 200. El navegador pinta el cuerpo de un
       404 igual, asi que quien llegue sigue viendo la pantalla de «este
       perfil no existe»; lo que cambia es que un buscador deja de llevarse
       mil paginas distintas diciendo todas que estan bien. Se cachea mas
       rato: la respuesta a «no existe» no va a cambiar en el minuto
       siguiente. Aqui solo se entra cuando la consulta FUE BIEN y no hay
       fila; si falla, se ha salido antes con 200. */
    servir($html, 300, 404);
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

$esquema = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
/* Detras de Cloudflare, PHP puede ver la conexion interna en claro aunque
   el visitante llegue por https. La imagen tiene que ir en https: una en
   http la descartan casi todos los robots. */
if (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https') $esquema = 'https';
$host    = (string) ($_SERVER['HTTP_HOST'] ?? '');
$origen  = $esquema . '://' . $host;
$enlace  = $origen . '/' . $usuario;

$cara   = caraTarjeta($ap);
$imagen = $cara !== '' ? $cara : $origen . IMAGEN_MARCA;

/* El `<` escapado, igual que en la precarga: un `</script` en una
   biografia cerraria la etiqueta y lo que siguiera seria HTML. */
$ld = json_encode(
    datosEstructurados([
        'enlace'      => $enlace,
        'usuario'     => $usuario,
        'nombre'      => $datos['name'],
        'bio'         => $datos['bio'],
        'cara'        => $cara,
        'redes'       => $ap['socials'] ?? [],
        'creado'      => $fila['creado'] ?? '',
        'actualizado' => $fila['actualizado'] ?? '',
    ]),
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
);
$ld = is_string($ld) ? str_replace('<', '\\u003c', $ld) : '';

$etiquetas = array_filter([
    /* La pestaña, solo el nombre; la tarjeta, abajo, con todo. */
    '<title>' . esc(tituloPestana($datos)) . '</title>',
    '<meta name="description" content="' . esc($descripcion) . '" />',
    '<link rel="canonical" href="' . esc($enlace) . '" />',
    '<meta property="og:site_name" content="' . NOMBRE_SITIO . '" />',
    '<meta property="og:type" content="profile" />',
    '<meta property="og:url" content="' . esc($enlace) . '" />',
    '<meta property="og:title" content="' . esc($titulo) . '" />',
    '<meta property="og:description" content="' . esc($descripcion) . '" />',
    '<meta property="og:image" content="' . esc($imagen) . '" />',
    $cara === '' ? '<meta property="og:image:width" content="1200" />' : '',
    $cara === '' ? '<meta property="og:image:height" content="630" />' : '',
    /* `summary` con la cara: un avatar es cuadrado, y pedir tarjeta ancha
       lo deja recortado o con franjas a los lados. La de la marca SI es
       ancha y va en grande. */
    '<meta name="twitter:card" content="' . ($cara !== '' ? 'summary' : 'summary_large_image') . '" />',
    '<meta name="twitter:title" content="' . esc($titulo) . '" />',
    '<meta name="twitter:description" content="' . esc($descripcion) . '" />',
    '<meta name="twitter:image" content="' . esc($imagen) . '" />',
    $ld !== '' ? '<script type="application/ld+json">' . $ld . '</script>' : '',
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

/* Con la fecha de la ultima edicion: es lo que hace que un visitante que
   vuelve reciba un 304 de cero bytes en vez del HTML entero. */
servir($salida, 300, 200, (string) ($fila['actualizado'] ?? ''));

<?php
/**
 * `/sitemap.xml`: la lista de todo lo que hay que encontrar en sharee.
 *
 * No habia ninguna. Google encontraba los perfiles solo si alguien los
 * enlazaba desde otro sitio que ya conociera, asi que un perfil nuevo podia
 * pasarse semanas sin existir para un buscador. Y los perfiles SON el
 * producto: es lo que la gente busca por su nombre.
 *
 * Lleva las paginas de sharee, los articulos de ayuda y todos los perfiles
 * publicos con la fecha de su ultimo cambio, que es lo que le dice a un
 * buscador cual merece volver a mirar.
 *
 * Los perfiles salen de `perfiles_publicos`, la misma vista que lee
 * `perfil.php`: la que existe para que la lea cualquiera. Con la clave
 * ANONIMA, la misma que ya va dentro del JavaScript publico.
 */

$SUPA  = getenv('VITE_SUPABASE_URL') ?: '';
$CLAVE = getenv('VITE_SUPABASE_KEY') ?: '';
if ((!$SUPA || !$CLAVE) && is_file(__DIR__ . '/config.php')) {
    $cfg   = require __DIR__ . '/config.php';
    $SUPA  = $SUPA  ?: ($cfg['url'] ?? '');
    $CLAVE = $CLAVE ?: ($cfg['key'] ?? '');
}

/** El tope de un sitemap son 50.000 direcciones. Si algun dia se llega,
 *  toca partirlo en varios con un indice; hasta entonces, uno basta. */
const TOPE = 50000;
const POR_PAGINA = 1000;

/**
 * SI LA BASE NO CONTESTA, 503 Y NO UNA LISTA A MEDIAS.
 *
 * Un sitemap con solo las paginas de sharee le diria a Google que los
 * perfiles han desaparecido. Un 503 le dice «vuelve luego», que es la
 * verdad, y no toca nada de lo que ya tenia.
 */
function noAhora(): void
{
    http_response_code(503);
    header('Retry-After: 600');
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');
    echo "El sitemap no esta disponible ahora mismo.";
    exit;
}

if ($SUPA === '' || $CLAVE === '') noAhora();

$esquema = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
if (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https') $esquema = 'https';
$origen = $esquema . '://' . (string) ($_SERVER['HTTP_HOST'] ?? 'sharee.fun');

/* ---- las de sharee ---------------------------------------------------- */
$urls = [];
foreach (['/', '/top', '/plantillas', '/pricing', '/ayuda', '/terminos', '/privacidad', '/copyright'] as $ruta) {
    $urls[] = ['loc' => $origen . $ruta, 'lastmod' => ''];
}

/* Los articulos de ayuda son los `.md` de `ayuda/`: los mismos que pinta
   la pagina de ayuda. Escribir uno nuevo lo mete aqui sin tocar nada. */
foreach (glob(__DIR__ . '/ayuda/*.md') ?: [] as $f) {
    $slug = basename($f, '.md');
    if (!preg_match('/^[a-z0-9-]+$/', $slug)) continue;
    $urls[] = ['loc' => $origen . '/ayuda/' . $slug, 'lastmod' => gmdate('Y-m-d', (int) filemtime($f))];
}

/* ---- los perfiles, de mil en mil -------------------------------------- */
for ($desde = 0; count($urls) < TOPE; $desde += POR_PAGINA) {
    $url = rtrim($SUPA, '/') . '/rest/v1/perfiles_publicos'
         . '?select=username,actualizado'
         . '&order=username.asc'
         . '&limit=' . POR_PAGINA
         . '&offset=' . $desde;

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => ['apikey: ' . $CLAVE, 'Authorization: Bearer ' . $CLAVE],
        CURLOPT_TIMEOUT        => 8,
        CURLOPT_CONNECTTIMEOUT => 3,
    ]);
    $cuerpo = curl_exec($ch);
    $estado = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($cuerpo === false || $estado !== 200) noAhora();
    $filas = json_decode($cuerpo, true);
    if (!is_array($filas)) noAhora();

    foreach ($filas as $f) {
        $u = strtolower((string) ($f['username'] ?? ''));
        if (!preg_match('/^[a-z0-9_-]{1,32}$/', $u)) continue;
        $ts = strtotime((string) ($f['actualizado'] ?? ''));
        $urls[] = ['loc' => $origen . '/' . $u, 'lastmod' => $ts ? gmdate('Y-m-d', $ts) : ''];
        if (count($urls) >= TOPE) break;
    }
    if (count($filas) < POR_PAGINA) break;
}

/* ---- y fuera -----------------------------------------------------------
   Una hora en el borde: un perfil nuevo tarda como mucho eso en aparecer,
   y Google no lo va a pedir mas a menudo que eso. */
header('Content-Type: application/xml; charset=utf-8');
header('Cache-Control: public, max-age=3600, s-maxage=3600');

echo '<?xml version="1.0" encoding="UTF-8"?>', "\n";
echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', "\n";
foreach ($urls as $u) {
    echo '  <url><loc>', htmlspecialchars($u['loc'], ENT_XML1 | ENT_QUOTES, 'UTF-8'), '</loc>';
    if ($u['lastmod'] !== '') echo '<lastmod>', $u['lastmod'], '</lastmod>';
    echo "</url>\n";
}
echo "</urlset>\n";

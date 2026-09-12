/**
 * Autoriza un dominio en los vídeos que YA están subidos a Vimeo.
 *
 * ────────────────────────────────────────────────────────────────────────
 * POR QUÉ HACE FALTA ESTO SI YA ESTÁ AUTOMATIZADO
 * ────────────────────────────────────────────────────────────────────────
 *
 * La función `vimeo-subida` sube cada vídeo con la lista blanca de dominios
 * de `VIMEO_DOMINIOS` y lo deja listo para incrustar. Eso pasa UNA vez, al
 * subirlo, y es lo correcto: si la subida se corta a medias, el vídeo queda
 * igualmente inservible fuera de sitio.
 *
 * Pero por eso mismo, cambiar `VIMEO_DOMINIOS` no toca los que ya están. Al
 * mudarse de dominio —o al descubrir que la variable apuntaba al sitio
 * equivocado— los vídeos viejos se quedan con la lista blanca de antes, y
 * una lista blanca que no te incluye devuelve exactamente lo mismo que una
 * vacía: el reproductor en negro con un «Lo sentimos». Desde fuera parece
 * que se ha roto el perfil.
 *
 * Esto es esa pasada de una vez. No sustituye a la automatización: la
 * alcanza.
 *
 * ────────────────────────────────────────────────────────────────────────
 * CÓMO SE USA
 * ────────────────────────────────────────────────────────────────────────
 *
 * El token NO se escribe aquí ni se pasa por la línea de órdenes —lo que va
 * en los argumentos se ve en la lista de procesos de la máquina y se queda
 * en el historial del intérprete—. Se pasa por el entorno:
 *
 *   # PowerShell
 *   $env:VIMEO_TOKEN = "..."
 *   node scripts/vimeo-dominios.mjs sharee.fun www.sharee.fun
 *
 *   # bash
 *   VIMEO_TOKEN="..." node scripts/vimeo-dominios.mjs sharee.fun www.sharee.fun
 *
 * Por defecto solo MIRA y cuenta qué haría. Para que toque algo hay que
 * decirlo:
 *
 *   node scripts/vimeo-dominios.mjs sharee.fun --aplicar
 *
 * Es una cuenta ajena con los vídeos de otra gente dentro: el que se
 * equivoque de dominio y le dé a ejecutar se merece ver antes la lista.
 */

const API = 'https://api.vimeo.com';
const ACEPTA = 'application/vnd.vimeo.*+json;version=3.4';

const token = process.env.VIMEO_TOKEN ?? '';
const args = process.argv.slice(2);
const aplicar = args.includes('--aplicar');
const dominios = args.filter((a) => !a.startsWith('--'));

if (!token) {
  console.error('Falta VIMEO_TOKEN en el entorno.');
  console.error('Sale de developer.vimeo.com → My Apps → tu app → Authentication.');
  process.exit(1);
}
if (dominios.length === 0) {
  console.error('Uso: node scripts/vimeo-dominios.mjs <dominio> [otro...] [--aplicar]');
  console.error('Ejemplo: node scripts/vimeo-dominios.mjs sharee.fun www.sharee.fun --aplicar');
  process.exit(1);
}
/* Un dominio, no una URL: Vimeo quiere `sharee.fun`, y `https://sharee.fun/`
   se acepta en silencio y no coincide con nada después. */
const malos = dominios.filter((d) => !/^[a-z0-9.-]+\.[a-z]{2,}$|^localhost$/i.test(d));
if (malos.length) {
  console.error('Esto no son dominios: ' + malos.join(', '));
  console.error('Sin `https://`, sin barra final, sin ruta. Solo `sharee.fun`.');
  process.exit(1);
}

const api = (ruta, init = {}) =>
  fetch(API + ruta, {
    ...init,
    headers: {
      Authorization: 'bearer ' + token,
      Accept: ACEPTA,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

/** Todos los vídeos de la cuenta, página a página. */
async function* videos() {
  let ruta = '/me/videos?per_page=100&fields=uri,name,privacy.view,privacy.embed';
  while (ruta) {
    const r = await api(ruta);
    if (!r.ok) {
      throw new Error(`Vimeo respondió ${r.status}: ${(await r.text()).slice(0, 200)}`);
    }
    const d = await r.json();
    for (const v of d.data ?? []) yield v;
    ruta = d.paging?.next ?? '';
  }
}

console.log(aplicar ? 'APLICANDO' : 'SOLO MIRANDO (añade --aplicar para tocar algo)');
console.log('Dominios: ' + dominios.join(', ') + '\n');

let vistos = 0;
let tocados = 0;
let saltados = 0;
const fallos = [];

try {
  for await (const v of videos()) {
    vistos++;
    const id = String(v.uri ?? '').split('/').pop();
    if (!id) continue;

    /* Solo los de lista blanca. Un vídeo `public` ya se incrusta en todas
       partes y meterle dominios no lo mejora; uno `private` está así porque
       alguien lo quiso, y no es cosa de este guion cambiarlo. */
    if (v.privacy?.embed !== 'whitelist') {
      saltados++;
      continue;
    }

    const nombre = (v.name ?? '').slice(0, 40);
    if (!aplicar) {
      console.log(`  ${id}  ${nombre}`);
      tocados++;
      continue;
    }

    for (const dom of dominios) {
      const r = await api(`/videos/${id}/privacy/domains/${dom}`, { method: 'PUT' });
      if (!r.ok) {
        fallos.push(`${id} ← ${dom}: ${r.status} ${(await r.text()).slice(0, 120)}`);
      }
    }
    tocados++;
    console.log(`  ${id}  ${nombre}  ✓`);
  }
} catch (e) {
  console.error('\n' + e.message);
  process.exit(1);
}

console.log(`\n${vistos} vídeos en la cuenta · ${tocados} con lista blanca · ${saltados} sin tocar`);
if (fallos.length) {
  console.log('\nNo se pudo con ' + fallos.length + ':');
  for (const f of fallos) console.log('  ' + f);
  process.exit(1);
}
if (!aplicar && tocados > 0) {
  console.log('\nNada cambiado. Repite con --aplicar cuando la lista te cuadre.');
}

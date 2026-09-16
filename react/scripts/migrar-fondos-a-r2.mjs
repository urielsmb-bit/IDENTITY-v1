#!/usr/bin/env node
/**
 * Mudar a R2 los fondos que ya viven en Vimeo.
 *
 * ────────────────────────────────────────────────────────────────────────
 * ESTO NO FUNCIONA CON LA CUENTA DE HOY. LEE ESTO ANTES DE PERDER UNA HORA
 * ────────────────────────────────────────────────────────────────────────
 *
 * Vimeo solo entrega los archivos por la API en los planes Standard,
 * Advanced, Pro, Business, Premium y Enterprise. Preguntado a la propia
 * API con el token puesto:
 *
 *     permisos del token : private create edit interact upload stats
 *                          video_files public          <- el permiso SI esta
 *     cuenta             : starter                     <- el plan NO llega
 *
 *     y del video, con estado `complete`:
 *       files / download   no aparecen
 *       play.progressive   0 versiones
 *       play.hls           no
 *
 * O sea que no es el token ni el video: es el plan. Y no hay forma de
 * rodearlo por la API. Rascar el reproductor si daria los bytes, pero se
 * romperia el dia que Vimeo mueva algo y no merece la pena para seis
 * archivos.
 *
 * SE DECIDIO NO MIGRAR. Se les pide a las seis personas que vuelvan a
 * subir su fondo, que ademas sale MEJOR: su archivo original pasa por el
 * aligerado del editor y acaba en 1080p bien codificado y con portada, en
 * vez de por la version que Vimeo tuviera preparada. Y cuesta cero.
 *
 * Este archivo se queda por si algun dia hay plan de sobra: funciona, esta
 * probado hasta donde se puede, y lo unico que le falta es que Vimeo
 * suelte los archivos.
 *
 * ────────────────────────────────────────────────────────────────────────
 * QUE HACE Y QUE NO
 * ────────────────────────────────────────────────────────────────────────
 *
 * Por cada perfil con fondo en Vimeo:
 *
 *   1. le pide a Vimeo el enlace directo de su version 1080p
 *   2. y su foto fija oficial
 *   3. sube las dos a R2
 *   4. COMPRUEBA que la direccion nueva contesta 200 y pesa lo que debe
 *   5. y entonces escribe el SQL que cambia el perfil
 *
 * NO toca la base de datos. Imprime el SQL y lo pegas tu en el editor de
 * Supabase, donde ya estas identificado. Asi este archivo no necesita la
 * clave de servicio —la que se salta TODAS las reglas de acceso— y por
 * tanto no puede haber una copia de esa clave en el portatil de nadie.
 *
 * NO borra nada de Vimeo. Los videos se quedan donde estan. Si algo sale
 * torcido, volver atras es pegar el otro SQL que tambien imprime.
 *
 * ────────────────────────────────────────────────────────────────────────
 * POR QUE AQUI Y NO EN UNA FUNCION DE BORDE
 * ────────────────────────────────────────────────────────────────────────
 *
 * Porque es de una vez. Una funcion de borde para esto seria superficie
 * nueva en produccion —con su autenticacion, su control de admin y su
 * mantenimiento— para un trabajo de seis archivos que no se va a repetir.
 * Y ademas tendria que hacer pasar decenas de megas por una funcion con
 * limite de memoria.
 *
 * ────────────────────────────────────────────────────────────────────────
 * COMO SE USA
 * ────────────────────────────────────────────────────────────────────────
 *
 *   node scripts/migrar-fondos-a-r2.mjs              mira y cuenta, no toca
 *   node scripts/migrar-fondos-a-r2.mjs --hacerlo    sube de verdad
 *   node scripts/migrar-fondos-a-r2.mjs --solo shark  uno concreto
 *
 * ────────────────────────────────────────────────────────────────────────
 * DONDE VAN LAS CLAVES
 * ────────────────────────────────────────────────────────────────────────
 *
 * En `react/.env.migracion`, que git ignora. Se lee solo al arrancar.
 *
 *   VIMEO_TOKEN_ARCHIVOS=...    token de Vimeo CON el permiso `video_files`
 *   R2_CUENTA=...               id de cuenta de Cloudflare
 *   R2_CUBO=sharee
 *   R2_CLAVE_ID=...             Access Key ID de R2
 *   R2_CLAVE_SECRETA=...        Secret Access Key de R2
 *   R2_PUBLICO=https://cdn.sharee.fun
 *
 * Lo de Supabase —`VITE_SUPABASE_URL` y `VITE_SUPABASE_KEY`, que solo sirven
 * para leer la lista de perfiles— sale de `.env.local`, donde ya esta.
 *
 * Cuando termine la mudanza, BORRA `.env.migracion`. Esas claves dan
 * escritura sobre el cubo y no tienen por que seguir en el disco de nadie
 * despues de un trabajo que se hace una sola vez.
 */

import { AwsClient } from 'aws4fetch';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';

/* Los dos archivos de donde salen las variables, si existen. Los dos estan
   ignorados por git —comprobado con `git check-ignore`, no leyendo el
   `.gitignore` con la vista— asi que un secreto puesto ahi no se puede
   subir por descuido.

   `.env.local` ya existe y ya tiene lo de Supabase. `.env.migracion` es
   para lo de esta mudanza, aparte, para poder borrarlo al terminar sin
   tocar lo que usa la aplicacion. */
for (const f of ['.env.local', '.env.migracion']) {
  if (existsSync(f)) process.loadEnvFile(f);
}

const ARG = process.argv.slice(2);
const HACERLO = ARG.includes('--hacerlo');
const SOLO = ARG.includes('--solo') ? ARG[ARG.indexOf('--solo') + 1] : null;

/** Lo mismo que aplica el editor desde ayer. No se recodifica nada aqui:
 *  se coge la version que Vimeo ya tiene preparada mas cercana por debajo. */
const ANCHO_MAX = 1920;

function falta() {
  return [
    'VIMEO_TOKEN_ARCHIVOS', 'R2_CUENTA', 'R2_CUBO', 'R2_CLAVE_ID',
    'R2_CLAVE_SECRETA', 'R2_PUBLICO', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_KEY',
  ].filter((n) => !process.env[n]);
}

/** El id de cuenta, venga suelto o dentro del campo «S3 API» del panel.
 *  Mismo criterio que la funcion de borde, y por el mismo motivo: pegar ese
 *  campo entero es lo que hace cualquiera, porque es lo que hay para copiar. */
function idDeCuenta(crudo) {
  const t = String(crudo || '').trim();
  const conDominio = t.match(/([0-9a-f]{32})\.r2\.cloudflarestorage\.com/i);
  if (conDominio) return conDominio[1].toLowerCase();
  const suelto = t.replace(/^https?:\/\//i, '').split('/')[0].split('.')[0];
  return /^[0-9a-f]{32}$/i.test(suelto) ? suelto.toLowerCase() : '';
}

function idVimeo(url) {
  const m = String(url || '').match(/vimeo\.com\/(?:manage\/videos\/)?(\d{6,12})/);
  return m ? m[1] : '';
}

const CACHE = 'public, max-age=31536000, immutable';

async function perfilesConVimeo() {
  const base = process.env.VITE_SUPABASE_URL.replace(/\/+$/, '');
  const k = process.env.VITE_SUPABASE_KEY;
  const r = await fetch(`${base}/rest/v1/perfiles_publicos?select=username,apariencia`, {
    headers: { apikey: k, authorization: 'Bearer ' + k },
  });
  if (!r.ok) throw new Error(`No se pudo leer la lista de perfiles: ${r.status}`);
  return (await r.json())
    .filter((p) => p.apariencia?.bgType === 'video' && idVimeo(p.apariencia?.bgValue))
    .filter((p) => !SOLO || p.username === SOLO);
}

/**
 * Lo que Vimeo deja bajar de un video.
 *
 * `files` son enlaces que no caducan y `download` son enlaces de 24 horas.
 * Se piden los dos porque no todos los planes devuelven ambos, y con que
 * venga uno basta.
 */
async function archivosDeVimeo(id) {
  const r = await fetch(
    `https://api.vimeo.com/videos/${id}?fields=files,download,pictures,name`,
    {
      headers: {
        authorization: 'Bearer ' + process.env.VIMEO_TOKEN_ARCHIVOS,
        accept: 'application/vnd.vimeo.*+json;version=3.4',
      },
    },
  );
  if (r.status === 401) throw new Error('El token no vale o le falta el permiso `video_files`.');
  if (!r.ok) throw new Error(`Vimeo contesto ${r.status} al pedir el video ${id}.`);
  return r.json();
}

/** La version mas grande que no pase de 1920 de ancho. Si todas pasan, la
 *  mas pequeña de las que pasan — mejor eso que mudar un 4K. */
function mejorVersion(d) {
  const todas = [...(d.files || []), ...(d.download || [])]
    .filter((f) => f.link && /video\/mp4/i.test(f.type || 'video/mp4') && f.width);
  if (!todas.length) return null;
  const cabe = todas.filter((f) => f.width <= ANCHO_MAX);
  const lista = cabe.length ? cabe : todas;
  return lista.sort((a, b) => (cabe.length ? b.width - a.width : a.width - b.width))[0];
}

function mejorFoto(d) {
  const s = d.pictures?.sizes || [];
  if (!s.length) return null;
  return s.slice().sort((a, b) => b.width - a.width)[0]?.link || null;
}

/* Perezoso a proposito. Creandolo aqui arriba, la libreria revienta al
   IMPORTAR el archivo si falta una clave — antes de que pueda salir el
   aviso de «faltan estas variables», que es justo el momento en que hace
   falta. Un error util tapado por uno inutil. */
let _r2 = null;
function r2() {
  if (!_r2) {
    _r2 = new AwsClient({
      accessKeyId: process.env.R2_CLAVE_ID,
      secretAccessKey: process.env.R2_CLAVE_SECRETA,
      service: 's3',
      region: 'auto',
    });
  }
  return _r2;
}

async function subirAR2(bytes, tipo, carpeta, ext) {
  const cuenta = idDeCuenta(process.env.R2_CUENTA);
  const cubo = process.env.R2_CUBO.trim();
  const clave = `${carpeta}/${randomUUID()}.${ext}`;
  const destino = `https://${cuenta}.r2.cloudflarestorage.com/${cubo}/${clave}`;
  const r = await r2().fetch(destino, {
    method: 'PUT',
    body: bytes,
    headers: { 'Content-Type': tipo, 'Cache-Control': CACHE },
  });
  if (!r.ok) throw new Error(`R2 contesto ${r.status}: ${(await r.text()).slice(0, 160)}`);
  return `${process.env.R2_PUBLICO.replace(/\/+$/, '')}/${clave}`;
}

/** La comprobacion del paso 4. Se hace ANTES de tocar el perfil de nadie:
 *  cambiar la fila y descubrir despues que el archivo no esta es dejarle a
 *  alguien el fondo en negro sin enterarte. */
async function seVe(url, bytesEsperados) {
  const r = await fetch(url, { method: 'HEAD' });
  if (!r.ok) throw new Error(`La direccion nueva contesta ${r.status}`);
  const n = Number(r.headers.get('content-length') || 0);
  if (n !== bytesEsperados) {
    throw new Error(`Pesa ${n} y deberia pesar ${bytesEsperados}`);
  }
}

const mb = (n) => (n / 1048576).toFixed(1) + ' MB';

async function main() {
  const sinPoner = falta();
  if (sinPoner.length) {
    console.error('Faltan variables de entorno: ' + sinPoner.join(', '));
    console.error('Estan explicadas en la cabecera de este archivo.');
    process.exit(1);
  }

  const perfiles = await perfilesConVimeo();
  console.log(`\n${perfiles.length} perfil(es) con fondo en Vimeo.\n`);
  if (!HACERLO) {
    for (const p of perfiles) {
      console.log(`  ${p.username.padEnd(14)} ${p.apariencia.bgValue}`);
    }
    console.log('\nEsto es solo el recuento. Para mudarlos de verdad:');
    console.log('  node scripts/migrar-fondos-a-r2.mjs --hacerlo\n');
    return;
  }

  const hechos = [];
  const fallados = [];

  for (const p of perfiles) {
    const id = idVimeo(p.apariencia.bgValue);
    process.stdout.write(`  ${p.username.padEnd(14)} `);
    try {
      const d = await archivosDeVimeo(id);
      const v = mejorVersion(d);
      if (!v) throw new Error('Vimeo no devolvio ningun archivo descargable.');

      const bytes = Buffer.from(await (await fetch(v.link)).arrayBuffer());
      const urlVideo = await subirAR2(bytes, 'video/mp4', 'fondos', 'mp4');
      await seVe(urlVideo, bytes.length);

      let urlFoto = '';
      try {
        const foto = mejorFoto(d);
        if (foto) {
          const fb = Buffer.from(await (await fetch(foto)).arrayBuffer());
          urlFoto = await subirAR2(fb, 'image/jpeg', 'posters', 'jpg');
          await seVe(urlFoto, fb.length);
        }
      } catch {
        /* La foto fija es un adorno: sin ella el fondo sigue estando. */
        urlFoto = '';
      }

      console.log(`${v.width}x${v.height} · ${mb(bytes.length)}${urlFoto ? ' · con portada' : ''}`);
      hechos.push({ username: p.username, antes: p.apariencia.bgValue, urlVideo, urlFoto,
                    antesPoster: p.apariencia.bgPoster || '' });
    } catch (e) {
      console.log('FALLO · ' + (e instanceof Error ? e.message : String(e)));
      fallados.push(p.username);
    }
  }

  if (!hechos.length) {
    console.log('\nNo se pudo mudar ninguno. La base no se ha tocado.\n');
    return;
  }

  console.log('\n' + '='.repeat(68));
  console.log('PEGA ESTO EN EL SQL EDITOR DE SUPABASE');
  console.log('='.repeat(68) + '\n');
  for (const h of hechos) {
    const campos = { bgValue: h.urlVideo };
    if (h.urlFoto) campos.bgPoster = h.urlFoto;
    console.log(
      `update public.perfiles set apariencia = apariencia || '${JSON.stringify(campos)}'::jsonb\n` +
      ` where username = '${h.username}';`,
    );
  }

  console.log('\n' + '='.repeat(68));
  console.log('Y ESTO ES LO QUE LO DESHACE, POR SI ACASO. Guardalo.');
  console.log('='.repeat(68) + '\n');
  for (const h of hechos) {
    const vuelta = { bgValue: h.antes, bgPoster: h.antesPoster };
    console.log(
      `update public.perfiles set apariencia = apariencia || '${JSON.stringify(vuelta)}'::jsonb\n` +
      ` where username = '${h.username}';`,
    );
  }
  console.log('');
  if (fallados.length) console.log('Sin mudar: ' + fallados.join(', ') + '\n');
  console.log('Los videos siguen en Vimeo. No se ha borrado nada.\n');
}

main().catch((e) => {
  console.error('\n' + (e instanceof Error ? e.message : String(e)) + '\n');
  process.exit(1);
});

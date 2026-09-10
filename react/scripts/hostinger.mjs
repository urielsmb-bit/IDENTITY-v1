/**
 * Arma la carpeta que se sube a Hostinger.
 *
 * Se hace con un guion y no con una lista de pasos en un documento porque
 * los tres ficheros que hay que añadir a `dist/` son justo los que no se
 * notan si faltan: sin `.htaccess`, recargar dentro de un perfil da 404;
 * sin `perfil.php`, los enlaces compartidos salen sin tarjeta; sin
 * `config.php`, salen con tarjeta pero vacia. Nada de eso rompe la portada,
 * que es lo primero que uno mira despues de subir.
 *
 *   npm run build:hostinger
 *
 * Deja todo en `salida-hostinger/`. Lo que hay dentro se sube tal cual a
 * `public_html`, con los puntos y todo: `.htaccess` empieza por punto y
 * muchos clientes de FTP lo esconden.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(raiz, 'dist');
const salida = join(raiz, 'salida-hostinger');

if (!existsSync(dist)) {
  console.error('No hay `dist/`. Lanza `npm run build` antes.');
  process.exit(1);
}

/* Se borra entera y se rehace. Copiar encima deja los ficheros de la
   compilacion anterior —cada una tiene sus propios nombres con resumen— y
   la carpeta va creciendo con basura que despues se sube. */
rmSync(salida, { recursive: true, force: true });
mkdirSync(salida, { recursive: true });
cpSync(dist, salida, { recursive: true });

cpSync(join(raiz, 'hostinger', 'perfil.php'), join(salida, 'perfil.php'));
cpSync(join(raiz, 'hostinger', '.htaccess'), join(salida, '.htaccess'));

/* ---- la configuracion del PHP -------------------------------------
   Sale del mismo `.env.local` con el que se acaba de compilar, y por eso se
   genera en vez de escribirse a mano: escrita a mano, el dia que cambie la
   clave habria que acordarse de cambiarla en dos sitios, y el que se olvida
   siempre es este. */
const env = {};
const ficheroEnv = join(raiz, '.env.local');
if (existsSync(ficheroEnv)) {
  for (const linea of readFileSync(ficheroEnv, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(linea);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const url = env.VITE_SUPABASE_URL || '';
const key = env.VITE_SUPABASE_KEY || '';

if (!url || !key) {
  console.error('Falta VITE_SUPABASE_URL o VITE_SUPABASE_KEY en .env.local.');
  console.error('Sin eso, `perfil.php` sirve la pagina pero sin etiquetas.');
  process.exit(1);
}

/* La clave que va aqui es la ANONIMA: la misma que ya viaja dentro del
   JavaScript que descarga cualquier visitante. No se publica nada nuevo. La
   de servicio no entra en esta carpeta por ningun motivo. */
writeFileSync(
  join(salida, 'config.php'),
  `<?php
/* Generado por \`npm run build:hostinger\`. No se edita a mano: sale de
   .env.local, que es el mismo con el que se compilo la aplicacion.

   La clave es la ANONIMA, la que ya va dentro del JavaScript publico.
   La de servicio NUNCA se pone aqui. */
return [
    'url' => ${JSON.stringify(url)},
    'key' => ${JSON.stringify(key)},
];
`,
  'utf8',
);

console.log('Listo: ' + salida);
console.log('Sube TODO lo de dentro a `public_html`, incluido el `.htaccess`.');

/**
 * El markdown de NUESTROS documentos: los legales y los de ayuda.
 *
 * No es un markdown completo ni quiere serlo. Es el trozo que de verdad se
 * usa al escribir una página de ayuda, y nada más — traerse una librería de
 * cuarenta kilobytes para pintar títulos y listas sería pagar el paquete
 * entero por seis reglas.
 *
 * IMPORTANTE, Y ES LA RAZÓN DE QUE ESTO PUEDA SER TAN SIMPLE: aquí sólo
 * entra texto NUESTRO, de ficheros que viven en `public/`. Nada que escriba
 * un usuario pasa por aquí. Si algún día hiciera falta pintar markdown de
 * otra persona, esto no vale: haría falta una librería con un saneador de
 * verdad, porque la lista de cosas que se pueden colar por un `<a href>` o
 * por una imagen es más larga de lo que parece.
 *
 * Aun así se escapa todo antes de tocar nada, porque el coste es cero y
 * porque el día que alguien pegue aquí un fichero de otro sitio, el fallo
 * no debería ser catastrófico.
 */

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
};

function esc(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) => ESCAPES[c] ?? c);
}

/**
 * Una dirección a la que un documento nuestro puede mandar.
 *
 * Rutas de este sitio, direcciones http(s) y correos. Nada más — y en
 * concreto nada de `javascript:`, que es por lo que esto existe en vez de
 * meter la url tal cual.
 */
function enlaceSeguro(url: string): string | null {
  const s = url.trim();
  if (/^\/(?!\/)/.test(s)) return s;
  if (/^(https?:\/\/|mailto:)/i.test(s)) return s;
  return null;
}

/**
 * Lo que se puede escribir DENTRO de una línea.
 *
 * Antes esto sólo se aplicaba a los párrafos, así que un `- **Plan**: lo que
 * trae` salía en la lista con los asteriscos a la vista. Ahora pasa por
 * títulos, citas y elementos de lista también, que es donde más se usa.
 */
function enLinea(texto: string): string {
  /* El código se aparta primero y vuelve al final.
   *
   * Dos cosas que hay que conseguir a la vez, y son opuestas:
   *
   *  · Lo que va entre acentos graves NO se formatea. Para eso se escribe
   *    así: `` `**esto**` `` tiene que salir con sus asteriscos a la vista.
   *    Convertirlo a `<code>` de primeras no basta, porque la negrita de
   *    más abajo sigue entrando dentro de la etiqueta.
   *  · Pero el resto de la línea SÍ se formatea de punta a punta, aunque
   *    haya código en medio. Esto es de la política de privacidad
   *    publicada: `hasta **`[N]` días** más`. Partiendo la línea en trozos
   *    y formateando cada uno por su cuenta, los dos `**` caen en trozos
   *    distintos y no se emparejan nunca — salían impresos.
   *
   * Por eso el código sale a un lado dejando una marca, y la línea se
   * formatea entera y seguida.
   *
   * La marca es `&0&`, `&1&`… y es segura por lo que pasa justo antes:
   * `esc()` ya ha convertido todo `&` suelto en `&amp;`, así que en el
   * texto no queda ni un `&` seguido de un dígito. Los únicos que hay son
   * los que ponemos aquí.
   */
  const trozos: string[] = [];
  const conMarcas = esc(texto).replace(
    /`([^`]+)`/g,
    (_t, codigo: string) => `&${trozos.push(codigo) - 1}&`,
  );

  return formatear(conMarcas).replace(
    /&(\d+)&/g,
    (_t, i: string) => `<code>${trozos[Number(i)] ?? ''}</code>`,
  );
}

/** Enlaces, negrita y cursiva. Nunca sobre código. */
function formatear(trozo: string): string {
  return trozo
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_todo, txt: string, url: string) => {
      const destino = enlaceSeguro(url);
      if (!destino) return txt;
      /* Los de fuera se abren aparte y sin `opener`; los de casa, no: son
         la misma aplicación y abrir una pestaña por cada enlace interno
         convierte leer la ayuda en una fila de pestañas. */
      const fuera = /^https?:/i.test(destino);
      const extra = fuera ? ' target="_blank" rel="noopener noreferrer"' : '';
      return `<a href="${esc(destino)}"${extra}>${txt}</a>`;
    })
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

/** Notas que nos escribimos y que no salen publicadas. */
function quitarNotas(md: string): string {
  let s = md.split(/\n#{1,3} Notas para ti/)[0] ?? '';
  s = s.replace(
    /^(#{1,4})\s+[^\n]*(?:para ti|borrar antes de publicar)[^\n]*\n[\s\S]*?(?=^#{1,4}\s|(?![\s\S]))/gim,
    '',
  );
  s = s.replace(/^> \*\*(?:Nota para ti|Borrador|Ojo con esto)[\s\S]*?(?=\n\n)/gim, '');
  return s;
}

/**
 * UN PÁRRAFO SON VARIAS LÍNEAS, hasta una vacía.
 *
 * Esto parece un detalle y no lo es. Los ficheros de `public/` están
 * cortados a unos setenta y ocho caracteres, como se escribe cualquier
 * texto largo, así que una frase ocupa tres o cuatro líneas. Tratando cada
 * línea como un párrafo pasaban dos cosas, y las dos se veían:
 *
 *  · `**Todo lo que publiques` en una línea y `lo puede ver cualquiera.**`
 *    en la siguiente NO es negrita para un analizador que mira línea a
 *    línea: los asteriscos salían impresos en la página. En los términos
 *    publicados había seis sitios así.
 *  · Y el documento salía con un `<p>` por renglón —ochenta y uno en los
 *    términos, para unos treinta párrafos de verdad— o sea con el espacio
 *    entre párrafos metido en mitad de las frases.
 *
 * Se juntan las líneas seguidas y se formatea el párrafo entero de una vez,
 * que es lo que markdown hace desde siempre. Lo mismo con los elementos de
 * lista y con las citas: una línea que continúa a la anterior es parte de
 * ella.
 */
export function markdownAHtml(md: string): string {
  const lineas = quitarNotas(md).split('\n');
  const salida: string[] = [];

  /** Lo que se está juntando ahora, y de qué tipo. */
  let buffer: string[] = [];
  let tipo: 'p' | 'li' | 'cita' | null = null;
  /* Las listas se abren y se cierran. Antes se soltaban `<li>` sueltos sin
     `<ul>` alrededor: el navegador lo aguanta, pero no es una lista para
     quien la lee con un lector de pantalla —que anuncia «lista de tres
     elementos» y aquí no anunciaba nada— y el estilo de la viñeta depende
     del navegador de turno. */
  /** Qué lista está abierta, si hay alguna. */
  let lista: 'ul' | 'ol' | null = null;

  const volcar = () => {
    if (!tipo || buffer.length === 0) {
      buffer = [];
      tipo = null;
      return;
    }
    const texto = enLinea(buffer.join(' '));
    if (tipo === 'li') salida.push(`<li>${texto}</li>`);
    else if (tipo === 'cita') salida.push(`<blockquote>${texto}</blockquote>`);
    else salida.push(`<p>${texto}</p>`);
    buffer = [];
    tipo = null;
  };

  const cerrarLista = () => {
    if (lista) {
      salida.push(`</${lista}>`);
      lista = null;
    }
  };

  /** Abre la lista que toque, cerrando la otra si estaba abierta. */
  const abrirLista = (cual: 'ul' | 'ol') => {
    if (lista === cual) return;
    cerrarLista();
    salida.push(`<${cual}>`);
    lista = cual;
  };

  for (const cruda of lineas) {
    const linea = cruda.trimEnd();

    // Línea en blanco: se acaba lo que hubiera empezado.
    if (!linea.trim()) {
      volcar();
      cerrarLista();
      continue;
    }

    const titulo = /^(#{1,4})\s+(.*)$/.exec(linea);
    if (titulo) {
      volcar();
      cerrarLista();
      const n = titulo[1]!.length;
      salida.push(`<h${n}>${enLinea(titulo[2] ?? '')}</h${n}>`);
      continue;
    }

    if (/^---+$/.test(linea)) {
      volcar();
      cerrarLista();
      salida.push('<hr />');
      continue;
    }

    if (/^[-*]\s+/.test(linea)) {
      volcar();
      abrirLista('ul');
      tipo = 'li';
      buffer = [linea.replace(/^[-*]\s+/, '')];
      continue;
    }

    /* Numeradas. Hacen falta de verdad en la ayuda —«primero esto, luego
       lo otro»— y sin ellas un `1.` era texto suelto: al juntar las líneas
       de un párrafo, los tres pasos acababan fundidos en un renglón.
       El número del fichero no se usa para nada: `<ol>` los cuenta él, así
       que una lista escrita 1., 1., 1. sale igual de bien. */
    const numerada = /^\d{1,2}[.)]\s+(.*)$/.exec(linea);
    if (numerada) {
      volcar();
      abrirLista('ol');
      tipo = 'li';
      buffer = [numerada[1] ?? ''];
      continue;
    }

    if (/^>\s*/.test(linea)) {
      if (tipo !== 'cita') {
        volcar();
        cerrarLista();
        tipo = 'cita';
      }
      buffer.push(linea.replace(/^>\s*/, ''));
      continue;
    }

    /* Una línea normal. Si venimos de un elemento de lista o de una cita,
       la continúa; si no, empieza o sigue un párrafo. */
    if (tipo === null) tipo = 'p';
    buffer.push(linea.trim());
  }

  volcar();
  cerrarLista();
  return salida.join('');
}

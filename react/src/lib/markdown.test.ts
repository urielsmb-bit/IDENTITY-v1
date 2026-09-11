import { describe, it, expect } from 'vitest';
import { markdownAHtml } from './markdown';

describe('markdown · un parrafo son varias lineas', () => {
  /* El fallo que hizo falta arreglar esto. Los ficheros de `public/` estan
     cortados a unos setenta y ocho caracteres, asi que una frase con
     negrita la parte por la mitad. Mirando linea a linea, los asteriscos
     salian impresos en la pagina: en los terminos publicados habia seis
     sitios asi. */
  it('une la negrita partida en dos lineas', () => {
    const html = markdownAHtml('Esto es **una frase\nen negrita.** Y esto no.');
    expect(html).toContain('<strong>una frase en negrita.</strong>');
    expect(html).not.toContain('**');
  });

  it('junta las lineas seguidas en UN parrafo', () => {
    const html = markdownAHtml('una\ndos\ntres');
    expect(html).toBe('<p>una dos tres</p>');
  });

  it('una linea en blanco separa parrafos', () => {
    const html = markdownAHtml('uno\n\ndos');
    expect(html).toBe('<p>uno</p><p>dos</p>');
  });
});

describe('markdown · listas', () => {
  it('envuelve los elementos en <ul>', () => {
    const html = markdownAHtml('- uno\n- dos');
    expect(html).toBe('<ul><li>uno</li><li>dos</li></ul>');
  });

  /* Sin esto, «1. primero» era texto suelto y al juntar las lineas de un
     parrafo los tres pasos acababan fundidos en un renglon. */
  it('reconoce las numeradas', () => {
    const html = markdownAHtml('1. uno\n2. dos');
    expect(html).toBe('<ol><li>uno</li><li>dos</li></ol>');
  });

  it('cierra una lista al cambiar de tipo', () => {
    const html = markdownAHtml('- a\n1. b');
    expect(html).toBe('<ul><li>a</li></ul><ol><li>b</li></ol>');
  });

  /* Antes el formato solo se aplicaba a los parrafos, asi que un
     `- **Plan**: lo que trae` salia con los asteriscos a la vista. */
  it('aplica negrita y codigo DENTRO de una lista', () => {
    const html = markdownAHtml('- **Plan**: con `codigo`');
    expect(html).toContain('<strong>Plan</strong>');
    expect(html).toContain('<code>codigo</code>');
  });

  it('aplica negrita dentro de un titulo', () => {
    expect(markdownAHtml('## Un **titulo**')).toBe('<h2>Un <strong>titulo</strong></h2>');
  });
});

describe('markdown · enlaces', () => {
  it('deja pasar una ruta de casa, en la misma pestana', () => {
    const html = markdownAHtml('Ve a [los planes](/pricing).');
    expect(html).toContain('<a href="/pricing">los planes</a>');
    expect(html).not.toContain('target=');
  });

  it('los de fuera se abren aparte y sin opener', () => {
    const html = markdownAHtml('[Vimeo](https://vimeo.com)');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('admite mailto', () => {
    expect(markdownAHtml('[correo](mailto:hola@ejemplo.com)')).toContain('href="mailto:hola@ejemplo.com"');
  });

  /* Estos documentos los escribimos nosotros, asi que esto no tapa un
     agujero abierto — pero el dia que alguien pegue aqui un fichero de
     otro sitio, el fallo no deberia ser catastrofico. */
  it('un esquema ejecutable no se convierte en enlace', () => {
    for (const malo of ['javascript:alert(1)', 'data:text/html,<script>', 'vbscript:x']) {
      const html = markdownAHtml(`[pulsa](${malo})`);
      expect(html).not.toContain('<a ');
      expect(html).toContain('pulsa');
    }
  });

  it('no deja pasar la absoluta disfrazada de ruta', () => {
    expect(markdownAHtml('[ir](//evil.example)')).not.toContain('<a ');
  });
});

describe('markdown · lo que no se publica', () => {
  it('escapa el HTML que venga en el texto', () => {
    expect(markdownAHtml('un <script>alert(1)</script> suelto')).not.toContain('<script>');
  });

  it('los asteriscos dentro de `codigo` no son negrita', () => {
    expect(markdownAHtml('usa `**esto**` tal cual')).toContain('<code>**esto**</code>');
  });

  /* De la politica de privacidad publicada: `hasta **`[N]` dias** mas`. La
     negrita abre, hay codigo en medio, y cierra despues. Si se formatea
     trozo a trozo los dos `**` caen en trozos distintos y salen impresos. */
  it('la negrita cruza un trozo de codigo', () => {
    const html = markdownAHtml('hasta **`[N]` dias** mas');
    expect(html).toContain('<strong>');
    expect(html).toContain('<code>[N]</code>');
    expect(html).not.toContain('**');
  });

  it('no confunde una entidad HTML con una marca de codigo', () => {
    const html = markdownAHtml('Tom & Jerry & 5 & compania, con `codigo`');
    expect(html).toContain('&amp;');
    expect(html).toContain('<code>codigo</code>');
    expect(html).not.toContain('undefined');
  });
});

#!/usr/bin/env python3
"""
Servidor de desarrollo para IDENTITY.

Hace dos cosas que `python -m http.server` no hace:

  1. Manda Cache-Control: no-store, para que al editar un .js o .css
     el navegador NO siga sirviendo la version vieja. Sin esto se
     pierde muchisimo tiempo depurando codigo que ya arreglaste.

  2. Reescribe /uriel -> index.html, que es como funcionaria en
     produccion. Asi puedes probar las URLs limpias sin el #.

Uso:
    python serve.py            # puerto 8765
    python serve.py 3000       # otro puerto
"""

import sys
import io
import os
import posixpath
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, unquote

RAIZ = os.path.dirname(os.path.abspath(__file__))

# rutas que sirve la app en el cliente: todas devuelven index.html
RUTAS_APP = {
    'dashboard', 'discover', 'top', 'analytics',
    'ai', 'pricing', 'templates', 'u',
}


def _csp_de_vercel():
    """La CSP sale de vercel.json, no de una copia aqui.

    Dos cadenas separadas se van despegando y entonces las pruebas
    dejan de probar lo que se despliega, que es la peor forma de
    fallar: parece verde y no lo esta.

    En local se manda APLICADA aunque en vercel.json siga en
    Report-Only. Es a proposito: un Report-Only local no rompe nada
    y por tanto no ensena nada. Si algo se va a caer al apretar la
    CSP, que se caiga en este servidor y no en produccion.
    """
    try:
        import json
        with io.open(os.path.join(RAIZ, 'vercel.json'), encoding='utf-8') as f:
            d = json.load(f)
        for h in d.get('headers', []):
            for k in h.get('headers', []):
                if 'Content-Security-Policy' in k['key']:
                    return k['value']
    except Exception as e:
        print('  aviso: no pude leer la CSP de vercel.json (%s)' % e)
    return None


CSP = _csp_de_vercel()


class Handler(SimpleHTTPRequestHandler):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=RAIZ, **kwargs)

    def end_headers(self):
        # nada de cache mientras se desarrolla
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        if CSP:
            self.send_header('Content-Security-Policy', CSP)
        super().end_headers()

    def translate_path(self, path):
        """Cualquier ruta sin extension cae en index.html (SPA fallback)."""
        limpio = unquote(urlparse(path).path)
        nombre = posixpath.basename(limpio.rstrip('/'))

        es_archivo = '.' in nombre
        if not es_archivo and limpio not in ('/', ''):
            primero = limpio.strip('/').split('/')[0]
            # /uriel, /u/uriel, /dashboard... todos entran por index.html
            if primero in RUTAS_APP or primero.replace('-', '').replace('_', '').isalnum():
                return os.path.join(RAIZ, 'index.html')

        return super().translate_path(path)

    def log_message(self, fmt, *args):
        # una linea por peticion, sin ruido de favicon
        if 'favicon' in (args[0] if args else ''):
            return
        sys.stderr.write("  %s\n" % (fmt % args))


def main():
    puerto = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    srv = ThreadingHTTPServer(('127.0.0.1', puerto), Handler)
    print("IDENTITY en http://127.0.0.1:%d" % puerto)
    print("Sin cache y con rutas limpias (/uriel funciona sin #).")
    print("Ctrl+C para parar.\n")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nAdios.")
        srv.server_close()


if __name__ == '__main__':
    main()

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
    /**
     * A qué navegador se compila.
     *
     * Sin esto, Vite baja el código a una base muy ancha: reescribe cosas que
     * todos los navegadores de los últimos cuatro años entienden de nacimiento
     * y añade ayudantes para sostener la reescritura. Sale más código, y más
     * código que ejecutar antes de pintar.
     *
     * `es2022` es Chrome 94, Safari 15.4 y Firefox 93 — finales de 2021. Por
     * debajo de eso esta aplicación no funciona igualmente: la CSP, el
     * `structuredClone` del editor y los lienzos que usan los efectos piden
     * más que eso.
     */
    target: 'es2022',
    // Los sourcemaps publicarían todo el código fuente legible en producción.
    sourcemap: false,
    rollupOptions: {
      output: {
        /**
         * Las librerías, en su propio archivo.
         *
         * Iban mezcladas con el código de IDENTITY en un solo trozo de
         * 504 kB. Como el nombre del archivo lleva la firma del contenido,
         * cambiar una línea de CSS o un texto le cambiaba el nombre al
         * paquete entero: quien ya había estado volvía a bajarse React,
         * el enrutador, la caché de consultas y el cliente de Supabase
         * —que no habían cambiado— en cada publicación. Y publicamos a
         * menudo.
         *
         * Separadas, su archivo conserva el nombre entre versiones y el
         * navegador se lo salta. La primera visita baja lo mismo; a partir
         * de ahí, solo lo que de verdad cambió.
         */
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          /* SEPARADOS, y ese es el detalle que importa.
          
             Iban juntos en un trozo llamado `datos`. React Query se usa
             desde `main.tsx`, o sea desde el arranque, asi que ese trozo
             entero era de arranque… y el cliente de Supabase viajaba
             dentro. Cincuenta y cinco kilobytes comprimidos de SDK —con
             su motor de websockets, que esta aplicacion no usa en ninguna
             parte— en la primera carga de un perfil publico, donde nadie
             ha iniciado sesion y lo unico que hace falta es leer una fila.
          
             Aparte, el SDK solo llega a quien lo pide: el editor, entrar,
             guardar. Quien mira un perfil no se lo baja. */
          consultas: ['@tanstack/react-query'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
});

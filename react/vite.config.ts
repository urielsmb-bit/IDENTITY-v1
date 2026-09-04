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
          datos: ['@tanstack/react-query', '@supabase/supabase-js'],
        },
      },
    },
  },
});

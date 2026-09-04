import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';

// Styles — imported in layer order matching the original project
import './styles/base.css';
import './styles/chrome.css';
import './styles/themes.css';
import './styles/fuentes.css';
import './styles/profile.css';
import './styles/panels.css';
import './styles/dashboard.css';
import './styles/cuenta.css';
import './styles/guia.css';

/**
 * La pagina quedaba rota tras cada publicacion.
 *
 * Cada seccion se carga en su propio trozo de codigo, y al publicar una
 * version nueva esos trozos cambian de nombre: los de la anterior dejan de
 * existir. Quien tuviera IDENTITY abierta en ese momento seguia con el
 * indice viejo en memoria, asi que al pasar a otra seccion pedia un archivo
 * que ya no esta, y lo unico que veia era «Algo se rompio en esta pagina»
 * sobre un hueco negro. No estaba roto: estaba desactualizado.
 *
 * Se recarga sola, que es lo que arregla el caso de verdad. Una sola vez
 * por minuto: si la recarga tampoco lo soluciona el problema es otro, y un
 * bucle de recargas lo taparia en vez de enseñarlo.
 */
const MARCA_RECARGA = 'identity.recarga-version';
window.addEventListener('vite:preloadError', (e) => {
  let ultima = 0;
  try {
    ultima = Number(sessionStorage.getItem(MARCA_RECARGA)) || 0;
  } catch {
    /* Navegador con el almacenamiento cerrado: se recarga igual. */
  }
  if (Date.now() - ultima < 60_000) return;
  try {
    sessionStorage.setItem(MARCA_RECARGA, String(Date.now()));
  } catch {
    /* ídem: sin marca no hay freno, pero es mejor que quedarse roto. */
  }
  e.preventDefault();
  window.location.reload();
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      retry: 1,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);

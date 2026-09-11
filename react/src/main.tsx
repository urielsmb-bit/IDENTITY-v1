import './lib/fuentes';
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
import './styles/efectos.css';

/* Aqui se quedan SOLO las hojas que hacen falta para pintar un perfil
   publico, que es la pagina que recibe las visitas. Las demas ya no
   estan: se las lleva cada ruta.
   
   Todo esto acababa en UN archivo de 247 kB que bloquea el pintado, y
   casi la mitad eran el editor, el panel de plantillas, las analiticas,
   la ayuda, el ranking y el admin. Quien abre el perfil de alguien no
   entra en ninguna de esas, y aun asi las esperaba. */

/**
 * La pagina quedaba rota tras cada publicacion.
 *
 * Cada seccion se carga en su propio trozo de codigo, y al publicar una
 * version nueva esos trozos cambian de nombre: los de la anterior dejan de
 * existir. Quien tuviera sharee abierta en ese momento seguia con el
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
      /**
       * NO se vuelve a pedir al volver a la pestaña.
       *
       * Viene encendido de fábrica y para una aplicación de datos que
       * cambian solos —un panel, una bandeja— está bien. Un perfil no es
       * eso: el nombre, los enlaces y el tema de alguien cambian cada
       * varias semanas, y quien lo mira no va a estar pendiente de si le
       * han cambiado el color mientras tenía la pestaña de fondo.
       *
       * Lo que costaba: una petición a Supabase por CADA vez que alguien
       * vuelve a la pestaña. Y la fila del perfil viene escrita dentro del
       * HTML —`filaPrecargada`, que se entrega una sola vez—, así que esa
       * segunda consulta ni siquiera la aprovecha: sale a la red de verdad
       * para traer lo que ya estaba pintado.
       *
       * Multiplicado por el tráfico que tiene que aguantar esto, es una
       * petición por foco y por visitante para no enterarse de casi nada.
       */
      refetchOnWindowFocus: false,
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

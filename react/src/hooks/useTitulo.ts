import { useEffect } from 'react';

/**
 * El título de la pestaña.
 *
 * No lo tocaba nadie. `index.html` pone «sharee — Tu identidad, en línea.»
 * y ahí se quedaba para siempre: el mismo en el panel, en los términos, en
 * el top y en una página que no existe. Con cuatro pestañas abiertas, las
 * cuatro se llamaban igual.
 *
 * En un perfil era peor y al revés. `api/perfil.ts` SÍ escribe el título
 * bueno en el servidor —hace falta para la tarjeta de Discord— así que
 * entrar directo a `sharee.fun/shark` deja la pestaña bien puesta. Pero al
 * pulsar «Ir al inicio» desde ahí, la portada se quedaba llamándose
 * «Uriel (@shark) · sharee». El título era de la primera página que
 * hubieras abierto, no de la que estás mirando.
 *
 * Cada página dice el suyo. Sin `titulo` vuelve al de la casa, que es lo
 * que tiene que pasar al salir de un perfil.
 */
export const TITULO_POR_DEFECTO = 'sharee — Tu identidad, en línea.';

export function useTitulo(titulo?: string | null): void {
  useEffect(() => {
    /* Una línea y sin pasarse: un nombre con saltos o de trescientas
       letras no se corta solo en la pestaña, se come la barra entera. */
    const limpio = String(titulo ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
    document.title = limpio || TITULO_POR_DEFECTO;
  }, [titulo]);
}

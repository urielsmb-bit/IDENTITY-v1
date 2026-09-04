/**
 * El perfil que viene ya escrito dentro del HTML.
 *
 * Sin esto, ver un perfil son cuatro pasos en fila india: pedir el HTML,
 * bajar y ejecutar el JavaScript, preguntar a Supabase quién es esta
 * persona, y recién entonces pintar. Los tres primeros no se solapan —cada
 * uno necesita que termine el anterior— así que el visitante mira una
 * pantalla negra durante toda la cadena.
 *
 * El paso de Supabase se puede borrar entero: `api/perfil.ts` ya consulta
 * ese mismo perfil para poder escribir el título y la imagen de la vista
 * previa. Ya tiene la fila en la mano. Escribirla en el HTML no le cuesta
 * ninguna petición más, y al navegador le ahorra una ida y vuelta completa
 * a otro dominio antes de poder pintar nada.
 *
 * La fila NO se cree sin más: sale por `aPerfil`, el mismo embudo que
 * limpia lo que llega por la red. Que venga en el HTML no la hace más de
 * fiar — sale de la misma base y de la misma vista pública.
 */

/** `undefined` = todavía no se ha mirado. `null` = se miró y no había. */
let fila: Record<string, unknown> | null | undefined;

const ID = 'perfil-precargado';

/**
 * La fila del perfil pedido, si el servidor la dejó puesta.
 *
 * Se entrega UNA sola vez. Es una foto del momento en que se sirvió la
 * página: si alguien navega a otro perfil y vuelve, o si el perfil cambia
 * mientras la pestaña está abierta, lo que vale es lo que diga el servidor
 * en ese momento y no un papel guardado de la primera carga.
 */
export function filaPrecargada(username: string): Record<string, unknown> | null {
  if (fila === undefined) {
    fila = null;
    try {
      const el = typeof document !== 'undefined' ? document.getElementById(ID) : null;
      if (el?.textContent) {
        const leido: unknown = JSON.parse(el.textContent);
        if (leido && typeof leido === 'object' && !Array.isArray(leido)) {
          fila = leido as Record<string, unknown>;
        }
      }
      // Se quita del documento: ya está leída, y dejarla ahí es peso muerto
      // en el DOM de cada perfil.
      el?.remove();
    } catch {
      /* HTML de otra versión, JSON cortado, lo que sea: se pide por la red
         como se ha hecho siempre. */
      fila = null;
    }
  }

  if (!fila) return null;
  // Que sea la del perfil que se está pidiendo, no la de la página anterior.
  if (String(fila.username ?? '').toLowerCase() !== username.toLowerCase()) return null;

  const usar = fila;
  fila = null;
  return usar;
}

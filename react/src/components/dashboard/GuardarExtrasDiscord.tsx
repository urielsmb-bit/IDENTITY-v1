import { useEffect, useRef } from 'react';
import { useDecoracionDeLaSesion } from '@/hooks/useDiscord';
import { insigniasDe } from '@/data/insigniasDiscord';
import type { Profile } from '@/types';

/**
 * Lo que solo se puede saber de Discord en la vuelta del enlace.
 *
 * ────────────────────────────────────────────────────────────────────────
 * POR QUE ESTO VIVE AQUI Y NO EN EL PANEL DE DISCORD
 * ────────────────────────────────────────────────────────────────────────
 *
 * Estaba dentro del panel, y ahi tenia una trampa que costo encontrar:
 * reconectar Discord NO BASTABA. El enlace devuelve a `/dashboard`, y si
 * no abrias ademas el bloque de Discord, esto no llegaba a montarse nunca
 * y el token se gastaba sin que nadie le preguntara nada.
 *
 * Visto desde fuera: conectas, vuelves, y no aparece. Sin error, sin
 * aviso, sin nada que mirar. Medido en los perfiles publicados: `nitro` y
 * `flags` faltaban en los seis que tienen Discord conectado.
 *
 * Montandolo en el panel entero se pregunta en cuanto vuelves, que es lo
 * que cualquiera espera que pase.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Y POR QUE HAY QUE PREGUNTARLO ASI
 * ────────────────────────────────────────────────────────────────────────
 *
 * `premium_type` —el Nitro— Discord solo se lo cuenta a la propia cuenta,
 * con el token de su inicio de sesion. A un bot no se lo dice. Es el unico
 * dato del widget que no puede traer la presencia, y por eso es el unico
 * que obliga a volver a conectar.
 *
 * El resto (marco, etiqueta, insignias) lo trae ya el bot para CUALQUIER
 * perfil y se refresca solo. Aqui se guardan igualmente porque llegan en
 * la misma respuesta y no cuesta nada: sirven de respaldo mientras la
 * presencia no haya llegado.
 */
export function GuardarExtrasDiscord({
  profile,
  update,
  avisar,
}: {
  profile: Profile;
  update: (p: Partial<Profile>) => void;
  /** Para decirlo en voz alta cuando pasa. Ver el aviso de abajo. */
  avisar?: (texto: string, mal?: boolean) => void;
}) {
  const extras = useDecoracionDeLaSesion();
  const yaAvisado = useRef(false);

  useEffect(() => {
    if (!profile.discordId) return;
    const cambios: Partial<Profile> = {};

    /* Las direcciones solo se guardan cuando traen algo. Una vacia quiere
       decir «Discord no la ha mandado esta vez», y pisar con eso lo que ya
       habia seria perder el marco por un fallo de red. */
    if (extras.deco && profile.discordDecoUrl !== extras.deco) {
      cambios.discordDecoUrl = extras.deco;
    }
    if (extras.tag && profile.discordTag !== extras.tag) cambios.discordTag = extras.tag;
    if (extras.tagIcono && profile.discordTagIcono !== extras.tagIcono) {
      cambios.discordTagIcono = extras.tagIcono;
    }

    /* Nitro y las insignias, al reves: se guardan TAMBIEN cuando valen
       `false` y `0`. Son un si o un no, y si el no no se guardara, quien
       deje de pagar Nitro se quedaria la insignia puesta para siempre.
       `null` es «todavia no se sabe», que no es lo mismo que «no». */
    if (extras.nitro !== null && profile.discordNitro !== extras.nitro) {
      cambios.discordNitro = extras.nitro;
    }
    if (extras.flags !== null && profile.discordFlags !== extras.flags) {
      cambios.discordFlags = extras.flags;
    }

    if (Object.keys(cambios).length > 0) update(cambios);

    /**
     * Y SE DICE EN VOZ ALTA, UNA VEZ.
     *
     * Esto pasa en un instante que no se ve: `provider_token` solo existe
     * mientras Discord acaba de devolverte, y Supabase lo tira en el primer
     * refresco de sesion. O sea que si sale bien no hay nada que mirar, y
     * si sale mal tampoco — y las dos cosas se parecen demasiado.
     *
     * Costo una tarde averiguar que no estaba pasando. Un aviso de dos
     * lineas lo convierte en algo que se ve.
     */
    if (!yaAvisado.current && avisar && extras.nitro !== null) {
      yaAvisado.current = true;
      const cuantas = insigniasDe(extras.flags, extras.nitro).length;
      /* Con los numeros de verdad cuando no sale ninguna. «No tienes» y
         «Discord no me lo ha querido decir» se parecen desde fuera, y la
         diferencia entre las dos cambia por completo que hay que hacer. */
      const prem =
        extras.premiumCrudo === null ? 'Discord no mando el dato de Nitro' :
        extras.premiumCrudo === 0 ? 'sin Nitro' : `Nitro (tipo ${extras.premiumCrudo})`;
      /* Y se dice cuando el Nitro no lo dijo Discord sino la decoracion.
         Una insignia deducida no es lo mismo que una confirmada, y quien
         mire esto dentro de un año tiene que poder saber cual era. */
      const comoSalio = extras.nitroDeducido ? ' (Nitro por la decoracion)' : '';
      avisar(
        cuantas > 0
          ? `Discord leido: ${cuantas} insignia${cuantas === 1 ? '' : 's'}${extras.nitro ? ', Nitro incluido' : ''}.${comoSalio}`
          : `Discord leido: public_flags ${extras.flags ?? '?'}, ${prem}. Lo que llevas en Discord no esta en su API.`,
      );
    }
  }, [
    update, avisar,
    extras.deco, extras.tag, extras.tagIcono, extras.nitro, extras.flags, extras.premiumCrudo, extras.nitroDeducido,
    profile.discordId, profile.discordDecoUrl, profile.discordTag,
    profile.discordTagIcono, profile.discordNitro, profile.discordFlags,
  ]);

  return null;
}

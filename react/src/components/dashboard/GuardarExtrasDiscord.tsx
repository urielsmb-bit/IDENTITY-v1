import { useEffect } from 'react';
import { useDecoracionDeLaSesion } from '@/hooks/useDiscord';
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
}: {
  profile: Profile;
  update: (p: Partial<Profile>) => void;
}) {
  const extras = useDecoracionDeLaSesion();

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
  }, [
    update,
    extras.deco, extras.tag, extras.tagIcono, extras.nitro, extras.flags,
    profile.discordId, profile.discordDecoUrl, profile.discordTag,
    profile.discordTagIcono, profile.discordNitro, profile.discordFlags,
  ]);

  return null;
}

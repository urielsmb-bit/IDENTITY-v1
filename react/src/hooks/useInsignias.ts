import { useEffect, useState } from 'react';
import type { Profile } from '@/types';
import { type DatosInsignias, insigniasGanadas } from '@/lib/insignias';
import * as backend from '@/lib/backend';
import { hasBackend } from '@/lib/supabase';

/**
 * Las insignias de un perfil, con lo que sabe el servidor.
 *
 * Existe porque el panel de Badges y la vista previa del editor las
 * calculaban por separado, y no daban lo mismo:
 *
 *   · El panel PEDIA al servidor y por eso veia «Verificado», que se gana
 *     al enlazar una red y no se puede deducir de ningun numero.
 *   · La previa NO pedia nada, asi que solo veia las de antiguedad,
 *     visitas y notas.
 *
 * Resultado: el panel decia «Llevas 1 de 17» y la previa, al lado, decia
 * «en cuanto ganes la primera». Dos pantallas contradiciendose delante de
 * quien las mira, y ninguna de las dos mentia: es que preguntaban a
 * sitios distintos.
 *
 * Con un solo sitio del que salen, eso no puede volver a pasar.
 */
export function useInsignias(perfil: Profile | null | undefined) {
  const [datos, setDatos] = useState<DatosInsignias>({});

  const usuario = perfil?.username;
  const creado = perfil?.joined;
  const vistas = perfil?.views;
  const nota = perfil?.nota;
  const numNotas = perfil?.numNotas;

  useEffect(() => {
    /* Lo que se puede saber sin preguntar va primero: asi las de
       antiguedad salen desde el primer pintado y no aparecen de golpe
       cuando contesta el servidor. */
    const base: DatosInsignias = { creado, vistas, nota, numNotas };
    setDatos(base);

    if (!hasBackend() || !usuario) return;
    let vivo = true;
    backend
      .insigniasDe(usuario)
      .then((d) => {
        if (vivo) setDatos({ ...base, ...d });
      })
      .catch(() => {
        /* Sin servidor se sigue con lo que trae el perfil, que alcanza
           para las de antiguedad. Quedarse en blanco seria peor. */
      });
    return () => {
      vivo = false;
    };
  }, [usuario, creado, vistas, nota, numNotas]);

  return { datos, ganadas: insigniasGanadas(datos) };
}

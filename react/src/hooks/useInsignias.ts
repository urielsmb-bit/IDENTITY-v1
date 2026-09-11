import { useEffect, useMemo, useState } from 'react';
import type { Profile } from '@/types';
import { type DatosInsignias, insigniasGanadas } from '@/lib/insignias';
import * as publico from '@/lib/publico';

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
 * Con un solo sitio del que salen, eso no puede volver a pasar. Y desde
 * ahora tambien el perfil publico entra por aqui, que era la tercera copia
 * de esto mismo.
 */
export function useInsignias(perfil: Profile | null | undefined) {
  const usuario = perfil?.username;
  /* El id de la fila, cuando ya se sabe. Con el, la consulta se va derecha
     a las concedidas; sin el hay que buscarlo primero por el nombre. */
  const id = perfil?._id;
  const creado = perfil?.joined;
  const vistas = perfil?.views;
  const nota = perfil?.nota;
  const numNotas = perfil?.numNotas;

  /** Lo que haya contestado el servidor. Vacío mientras no conteste. */
  const [servidor, setServidor] = useState<Partial<DatosInsignias>>({});

  /* La consulta depende SOLO de a quien se mira, no de sus cifras.
     Estaban todas en la lista de dependencias, y las cifras cambian una vez
     por carga —primero las de la copia local, luego las del servidor—, asi
     que cada perfil pedia sus insignias dos veces para recibir exactamente
     la misma respuesta. Las cifras no hacen falta para preguntar: se
     mezclan abajo, ya en memoria. */
  useEffect(() => {
    setServidor({});
    if (!publico.hayBackend() || !usuario) return;
    let vivo = true;
    const pedir = id
      ? publico.concedidasDe(id).then((concedidas) => ({ concedidas }))
      : publico.insigniasDe(usuario);
    pedir
      .then((d) => {
        if (vivo) setServidor(d);
      })
      .catch(() => {
        /* Sin servidor se sigue con lo que trae el perfil, que alcanza
           para las de antiguedad. Quedarse en blanco seria peor. */
      });
    return () => {
      vivo = false;
    };
  }, [usuario, id]);

  /* Lo que se puede saber sin preguntar va primero, asi las de antiguedad
     salen desde el primer pintado y no aparecen de golpe cuando contesta el
     servidor. Lo suyo pisa a lo nuestro: si contesta, manda el. */
  const datos = useMemo<DatosInsignias>(
    () => ({ creado, vistas, nota, numNotas, ...servidor }),
    [creado, vistas, nota, numNotas, servidor],
  );

  const ganadas = useMemo(() => insigniasGanadas(datos), [datos]);

  return { datos, ganadas };
}

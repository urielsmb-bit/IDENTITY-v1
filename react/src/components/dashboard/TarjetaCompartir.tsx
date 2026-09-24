import type { Profile } from '@/types';
import { safeMedia } from '@/lib/utils';
import { tituloTarjeta, descripcionTarjeta, caraTarjeta, IMAGEN_MARCA } from '@/lib/tarjeta';

/**
 * Cómo se verá tu enlace cuando lo pegues.
 *
 * En una página de enlaces, la tarjeta que sale al pegar la dirección en
 * Discord o en WhatsApp es lo que decide si la abren. Es la portada del
 * producto, y hasta ahora se publicaba a ciegas: no había forma de saber
 * qué iba a salir sin pegar el enlace en algún sitio y mirar.
 *
 * El CSS de esto (`.ogcard`) llevaba escrito desde hace mucho, sin usar.
 *
 * LOS TEXTOS NO SE ARMAN AQUÍ. Salen de `tarjeta.ts`, que es exactamente el
 * mismo sitio del que los saca la función del borde que escribe las
 * etiquetas `og:`. Si cada uno hiciera el suyo acabarían diciendo cosas
 * distintas, y una previsualización que miente es peor que ninguna.
 *
 * Y la imagen es el AVATAR, no una miniatura del perfil, porque eso es lo
 * que se manda de verdad en `og:image`. Enseñar aquí una foto bonita del
 * perfil entero quedaría mejor y sería falso.
 */
export function TarjetaCompartir({ profile }: { profile: Profile }) {
  const titulo = tituloTarjeta(profile);
  const descripcion = descripcionTarjeta(profile);
  /* La misma cara que ve todo el mundo, no solo la que subiste, y sacada de
     la MISMA funcion que usa el servidor. Aqui ya se miraban las tres
     fotos, pero el servidor solo miraba la subida: esta previa prometia una
     imagen que luego no salia. Sin ninguna, va la de la marca. */
  const cara = caraTarjeta(profile);
  const imagen = cara || IMAGEN_MARCA;

  /* El dominio real cuando lo hay. En local sale `localhost`, que es
     justo lo que se vería si compartieras desde aquí. */
  const host = typeof window !== 'undefined' ? window.location.host : 'sharee';

  return (
    <div>
      <div className="ogcard">
        <div className="ogcard__thumb">
          <img
            src={cara ? safeMedia(imagen) : imagen}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>

        <div className="ogcard__b">
          <div className="ogcard__t">{titulo}</div>
          <div className="ogcard__d">{descripcion}</div>
          <div className="ogcard__u">{host}</div>
        </div>
      </div>

      <p className="f__d" style={{ marginTop: 0 }}>
        {cara
          ? 'Esto es lo que verá quien pegue tu enlace en Discord, WhatsApp o Twitter. Sale de tu nombre, tu biografía y tu foto.'
          : 'Así saldrá tu enlace al pegarlo. Sin foto de perfil, la tarjeta lleva la imagen de sharee; con tu foto, lleva tu cara, que es la mitad de lo que hace que alguien pulse.'}
      </p>
    </div>
  );
}

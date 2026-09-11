/**
 * Un `<animate>` que se calla cuando se le pide.
 *
 * SMIL NO mira `prefers-reduced-motion`: eso es para el CSS, y esto no es
 * CSS. Un ruido animado dentro de un filtro seguiria moviendose para quien ha
 * pedido expresamente que nada se mueva, y encima seria el unico movimiento
 * que quedaria en toda la pagina —el resto ya esta apagado—, asi que se
 * notaria mas que antes.
 *
 * Se resuelve no PINTANDO la animacion. Sin el elemento no hay nada que
 * apagar: el filtro se queda con su primer valor, que es un ruido fijo, y el
 * material sigue siendo el mismo material, sin ondular.
 */
const QUIETO =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function Anima(props: React.ComponentProps<'animate'>) {
  if (QUIETO) return null;
  return <animate {...props} />;
}

/**
 * Los filtros SVG que usan los efectos avanzados.
 *
 * Se montan UNA vez para toda la aplicación. Un `<filter>` no cuesta nada
 * mientras nadie lo apunte: es una definición, no un dibujo. Lo que cuesta es
 * el elemento que lo usa, y eso ya lo decide cada efecto.
 *
 * ¿Por qué SVG y no CSS? Porque `filter` de CSS sabe desenfocar, girar el
 * tono y poco más. Lo que hace falta aquí es DESPLAZAR píxeles siguiendo un
 * ruido —que una letra se curve, que el vidrio doble la luz que lo cruza—, y
 * eso sólo lo hace `feDisplacementMap`. Sin él, «entropía» y «cristal» serían
 * otra vez un desenfoque con nombre bonito.
 *
 * ¿Por qué `<animate>` y no JavaScript? Porque `baseFrequency` no es una
 * propiedad CSS y no se puede poner en unos fotogramas. La alternativa era un
 * bucle de JavaScript escribiendo un atributo sesenta veces por segundo, que
 * es justo lo que no se debe hacer. SMIL lo lleva el navegador.
 *
 * Todos declaran `color-interpolation-filters="sRGB"`. Sin eso el navegador
 * opera en RGB lineal y los colores salen lavados: el mismo filtro se ve
 * descolorido y nadie entiende por qué.
 */
export function FiltrosEfectos() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      /* Fuera de la vista pero DENTRO del documento: `display:none` deja los
         filtros sin resolver en algunos navegadores y lo que referencie a
         `url(#…)` se queda sin pintar. */
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
    >
      <defs>
        {/* ENTROPÍA · la deformación orgánica.
            Frecuencia muy baja en X y algo más alta en Y: así la letra se
            curva por tramos largos en vez de temblar. Dos octavas bastan;
            con más, el ruido se vuelve grano y el nombre se ensucia. */}
        <filter
          id="fx-entropia"
          x="-15%"
          y="-30%"
          width="130%"
          height="160%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence type="fractalNoise" baseFrequency="0.009 0.022" numOctaves="2" seed="7" result="n">
            <Anima
              attributeName="baseFrequency"
              dur="26s"
              values="0.009 0.022; 0.017 0.012; 0.011 0.026; 0.009 0.022"
              repeatCount="indefinite"
            />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.7" xChannelSelector="R" yChannelSelector="G" />
        </filter>

        {/* NEÓN LÍQUIDO · lo que hace que el color CORRA en vez de deslizarse.
            El degradado de debajo se mueve en línea recta; esto lo dobla, y
            un degradado doblado por un ruido que cambia parece un fluido. */}
        <filter
          id="fx-liquido"
          x="-12%"
          y="-25%"
          width="124%"
          height="150%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence type="turbulence" baseFrequency="0.013 0.031" numOctaves="2" seed="3" result="n">
            <Anima
              attributeName="baseFrequency"
              dur="19s"
              values="0.013 0.031; 0.022 0.019; 0.013 0.031"
              repeatCount="indefinite"
            />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G" />
        </filter>

        {/* CRISTAL · la refracción.
            QUIETO a propósito, y no por ahorrar: el vidrio no se retuerce. Lo
            que se mueve en un cristal es el reflejo, y de eso se encarga una
            capa aparte. Un ruido sin animar se calcula una vez y se queda en
            caché, así que además sale gratis. */}
        <filter
          id="fx-cristal"
          x="-10%"
          y="-20%"
          width="120%"
          height="140%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence type="turbulence" baseFrequency="0.042 0.058" numOctaves="1" seed="11" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" xChannelSelector="R" yChannelSelector="G" />
        </filter>

        {/* SINGULARIDAD · el espacio curvado.
            La frecuencia más baja de las cuatro y la escala más corta: la
            letra se dobla entera y despacio, no se pica. Si esto se nota como
            un efecto, está mal puesto; tiene que notarse como que algo no
            termina de encajar. */}
        <filter
          id="fx-singular"
          x="-18%"
          y="-35%"
          width="136%"
          height="170%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence type="fractalNoise" baseFrequency="0.006 0.009" numOctaves="1" seed="19" result="n">
            <Anima
              attributeName="baseFrequency"
              dur="31s"
              values="0.006 0.009; 0.010 0.006; 0.006 0.009"
              repeatCount="indefinite"
            />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.3" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        {/* ══════════════════════════════════════════════════════════
            MATERIALES
            ══════════════════════════════════════════════════════════
            Los cuatro de arriba DEFORMAN. Estos tres ILUMINAN, que es
            otra cosa y es la que hace falta para que unas letras dejen
            de parecer pintadas.

            La receta es siempre la misma y cabe en tres pasos:

              1. la silueta desenfocada hace de MAPA DE ALTURAS. Donde
                 la letra es opaca, alto; en el borde, la pendiente. El
                 desenfoque es el bisel: poco, canto duro; mucho, canto
                 redondeado.
              2. `feSpecularLighting` ilumina ese relieve desde un punto
                 del espacio, y devuelve dónde rebotaría la luz.
              3. ese brillo se recorta a la silueta y se SUMA al texto.

            Cambiando tres números salen materiales que no se parecen en
            nada: lo duro que es el brillo (`specularExponent`), lo alto
            que es el relieve (`surfaceScale`) y de qué color es la luz.
            Obsidiana y metal fundido son el mismo filtro con distintos
            números, y ahí está la gracia de hacerlo así.

            La luz la mueve `lib/luz.ts`, una para toda la página: dos
            nombres iluminados desde sitios distintos es justo el detalle
            que delata que una escena es falsa. */}

        {/* OBSIDIANA · vidrio volcánico pulido.
            Poco desenfoque y exponente muy alto: el brillo es una línea
            estrecha que recorre el canto, que es exactamente lo que hace
            una piedra pulida. El cuerpo casi negro lo pone el CSS. */}
        <filter
          id="fx-obsidiana"
          x="-25%"
          y="-55%"
          width="150%"
          height="210%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur in="SourceAlpha" stdDeviation="2.2" result="alto" />

          {/* 1 · DIFUSA: cuánta luz recibe cada punto de la superficie. Esto
                 es lo que da CUERPO. Sin ella sólo hay un filo brillante sobre
                 algo plano, que es como se veía la primera versión. */}
          <feDiffuseLighting in="alto" surfaceScale="8" diffuseConstant="1.15" lightingColor="#cbb8ff" result="dif">
            <fePointLight data-fx-luz="1" x="-30" y="-28" z="60" />
          </feDiffuseLighting>
          <feComposite in="dif" in2="SourceAlpha" operator="in" result="difDentro" />
          <feComposite in="SourceGraphic" in2="difDentro" operator="arithmetic" k1="1" k2="0" k3="0" k4="0" result="cuerpo" />

          {/* 2 · ESPECULAR: dónde rebota la luz hacia quien mira. Esto es el
                 BRILLO, y su exponente es lo que distingue un material de
                 otro: alto, un filo de piedra pulida; bajo, el derrame ancho
                 de algo caliente. */}
          <feSpecularLighting in="alto" surfaceScale="8" specularConstant="2.8" specularExponent="30" lightingColor="#ffffff" result="esp">
            <fePointLight data-fx-luz="1" x="-30" y="-28" z="60" />
          </feSpecularLighting>
          <feComposite in="esp" in2="SourceAlpha" operator="in" result="espDentro" />
          <feComposite in="cuerpo" in2="espDentro" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" />
        </filter>

        {/* FUNDIDO · metal recién sacado del fuego.
            Mismos tres pasos, tres números distintos: relieve más alto,
            exponente bajo —el brillo se ensancha y se derrama, que es lo
            que hace un metal caliente y no uno pulido— y luz ámbar.

            Y antes de iluminar, el mapa de alturas pasa por un ruido que
            cambia despacio: la superficie ondula. Eso es lo que separa
            «metal» de «metal FUNDIDO». */}
        <filter
          id="fx-fundido"
          x="-25%"
          y="-55%"
          width="150%"
          height="210%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence type="fractalNoise" baseFrequency="0.021 0.05" numOctaves="2" seed="5" result="n">
            <Anima
              attributeName="baseFrequency"
              dur="15s"
              values="0.021 0.05; 0.032 0.036; 0.021 0.05"
              repeatCount="indefinite"
            />
          </feTurbulence>
          <feGaussianBlur in="SourceAlpha" stdDeviation="3.4" result="alto0" />
          <feDisplacementMap in="alto0" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G" result="alto" />

          {/* 1 · DIFUSA: cuánta luz recibe cada punto de la superficie. Esto
                 es lo que da CUERPO. Sin ella sólo hay un filo brillante sobre
                 algo plano, que es como se veía la primera versión. */}
          <feDiffuseLighting in="alto" surfaceScale="11" diffuseConstant="1.3" lightingColor="#ffb877" result="dif">
            <fePointLight data-fx-luz="1" x="-30" y="-28" z="60" />
          </feDiffuseLighting>
          <feComposite in="dif" in2="SourceAlpha" operator="in" result="difDentro" />
          <feComposite in="SourceGraphic" in2="difDentro" operator="arithmetic" k1="1" k2="0" k3="0" k4="0" result="cuerpo" />

          {/* 2 · ESPECULAR: dónde rebota la luz hacia quien mira. Esto es el
                 BRILLO, y su exponente es lo que distingue un material de
                 otro: alto, un filo de piedra pulida; bajo, el derrame ancho
                 de algo caliente. */}
          <feSpecularLighting in="alto" surfaceScale="11" specularConstant="1.7" specularExponent="8" lightingColor="#ffd9a8" result="esp">
            <fePointLight data-fx-luz="1" x="-30" y="-28" z="60" />
          </feSpecularLighting>
          <feComposite in="esp" in2="SourceAlpha" operator="in" result="espDentro" />
          <feComposite in="cuerpo" in2="espDentro" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" />
        </filter>

        {/* CÁUSTICA · la luz que el agua dibuja en el fondo de una piscina.
            Aquí no hay relieve ni luz: hay un ruido APRETADO hasta que sólo
            sobreviven sus crestas. Esa es toda la idea de una cáustica —los
            rayos que la superficie concentra en filamentos—, y sale de la
            fila de alfa de la matriz: multiplicar por siete y restar cinco y
            medio deja fuera todo lo que no sea el pico.

            Las tres filas de color son constantes a uno: los filamentos
            salen blancos y el color se lo pone después el CSS con el acento
            de cada perfil. Un blanco que se tiñe vale para cualquier tema;
            un color escrito aquí, para uno. */}
        <filter
          id="fx-caustica"
          x="-12%"
          y="-30%"
          width="124%"
          height="160%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence type="fractalNoise" baseFrequency="0.026 0.042" numOctaves="3" seed="9" result="n">
            <Anima
              attributeName="baseFrequency"
              dur="18s"
              values="0.026 0.042; 0.037 0.03; 0.026 0.042"
              repeatCount="indefinite"
            />
          </feTurbulence>
          <feColorMatrix
            in="n"
            type="matrix"
            values="0 0 0 0 1
                    0 0 0 0 1
                    0 0 0 0 1
                    7 7 7 0 -5.6"
            result="filamentos"
          />
          <feGaussianBlur in="filamentos" stdDeviation="0.45" result="suaves" />
          <feComposite in="suaves" in2="SourceAlpha" operator="in" result="dentro" />
          <feComposite
            in="SourceGraphic"
            in2="dentro"
            operator="arithmetic"
            k1="0"
            k2="1"
            k3="1"
            k4="0"
          />
        </filter>

        {/* HIELO · el tercer material del mismo aparato, y el que enseña
            para qué servía montarlo así: aquí no hay código nuevo, hay
            otros números y un paso de más.

            El de más es la REFRACCIÓN. Antes de iluminar, el propio texto
            pasa por un ruido que lo dobla: eso es lo que hace el hielo con
            lo que hay detrás, y es lo que lo separa de un cristal. Después,
            relieve redondeado —desenfoque alto: el hielo no tiene canto
            vivo— y luz fría. */}
        <filter
          id="fx-hielo"
          x="-25%"
          y="-55%"
          width="150%"
          height="210%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence type="turbulence" baseFrequency="0.048 0.07" numOctaves="2" seed="23" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.3" xChannelSelector="R" yChannelSelector="G" result="refractado" />
          <feGaussianBlur in="SourceAlpha" stdDeviation="4.2" result="alto" />

          {/* 1 · DIFUSA: cuánta luz recibe cada punto de la superficie. Esto
                 es lo que da CUERPO. Sin ella sólo hay un filo brillante sobre
                 algo plano, que es como se veía la primera versión. */}
          <feDiffuseLighting in="alto" surfaceScale="9" diffuseConstant="1.25" lightingColor="#bfe6ff" result="dif">
            <fePointLight data-fx-luz="1" x="-30" y="-28" z="60" />
          </feDiffuseLighting>
          <feComposite in="dif" in2="SourceAlpha" operator="in" result="difDentro" />
          <feComposite in="refractado" in2="difDentro" operator="arithmetic" k1="1" k2="0" k3="0" k4="0" result="cuerpo" />

          {/* 2 · ESPECULAR: dónde rebota la luz hacia quien mira. Esto es el
                 BRILLO, y su exponente es lo que distingue un material de
                 otro: alto, un filo de piedra pulida; bajo, el derrame ancho
                 de algo caliente. */}
          <feSpecularLighting in="alto" surfaceScale="9" specularConstant="1.8" specularExponent="13" lightingColor="#eaf9ff" result="esp">
            <fePointLight data-fx-luz="1" x="-30" y="-28" z="60" />
          </feSpecularLighting>
          <feComposite in="esp" in2="SourceAlpha" operator="in" result="espDentro" />
          <feComposite in="cuerpo" in2="espDentro" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" />
        </filter>
      </defs>
    </svg>
  );
}

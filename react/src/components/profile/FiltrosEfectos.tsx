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
            <animate
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
            <animate
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
            <animate
              attributeName="baseFrequency"
              dur="31s"
              values="0.006 0.009; 0.010 0.006; 0.006 0.009"
              repeatCount="indefinite"
            />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.3" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}

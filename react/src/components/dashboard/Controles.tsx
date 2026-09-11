import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { acotarCanal, hexARgb, rgbAHex, type Rgb } from '@/lib/color';
import { FONTS } from '@/data/themes';
import { fuenteEsPro } from '@/data/premium';

/**
 * Controles del editor.
 *
 * Todos se apoyan en las clases que ya vivían en `dashboard.css` (.f, .rng,
 * .sw-box, .chip, .col-custom). No se estilan en línea: el editor tenía cien
 * `style={{}}` sueltos y una hoja de estilos entera sin usar.
 */

/** El rombo del plan. El mismo dibujo que la insignia del diamante, que es
 *  lo que de verdad concede el plan: si se parecieran a medias, nadie ataria
 *  una cosa con la otra. */
export const ROMBO = (
  <svg viewBox="23 32 465 448" fill="currentColor" aria-hidden="true">
    <path d="M396.31 32H264l84.19 112.26L396.31 32zm-280.62 0l48.12 112.26L248 32H115.69zM256 74.67L192 160h128l-64-85.33zm166.95-23.61L376.26 160H488L422.95 51.06zm-333.9 0L23 160h112.74L89.05 51.06zM146.68 192H24l222.8 288h.53L146.68 192zm218.64 0L264.67 480h.53L488 192H365.32zm-35.93 0H182.61L256 400l73.39-208z" />
  </svg>
);

/**
 * Un control que pide el plan.
 *
 * Se VE, con su nombre y su valor, y no se puede tocar. Es lo contrario de
 * esconderlo: un ajuste que no existe no vende nada —nadie echa de menos lo
 * que no sabe que hay— y un candado en mitad de la lista, sin decir qué hay
 * detrás, solo molesta. Aquí se lee lo que hace, se ve apagado, y el rombo
 * lleva a los planes.
 *
 * Sin plan y sin ser de pago, esto no pinta nada: devuelve el control tal
 * cual, sin una caja de más en el árbol.
 */
export function Pro({ bloqueado, children }: { bloqueado: boolean; children: ReactNode }) {
  if (!bloqueado) return <>{children}</>;
  return (
    <div className="pro">
      <Link className="pro__eti" to="/pricing" title="Esto lo trae el plan">
        <span className="pro__ic">{ROMBO}</span>
        Premium
      </Link>
      {/* `fieldset disabled` apaga todo lo de dentro de una vez y ademas lo
          saca del recorrido del teclado. Hacerlo mando a mando seria pasar
          una prop por veinte componentes y olvidarla en el proximo. */}
      <fieldset className="pro__campos" disabled>
        {children}
      </fieldset>
    </div>
  );
}

/** Campo con etiqueta a la izquierda y lectura del valor a la derecha. */
export function Campo({
  label,
  valor,
  guia,
  children,
}: {
  label: string;
  valor?: ReactNode;
  /** Id de la pista de la guia que apunta aqui. */
  guia?: string;
  children: ReactNode;
}) {
  return (
    <div className="f" data-guia={guia}>
      <div className="f__l">
        <span>{label}</span>
        {valor != null && <em>{valor}</em>}
      </div>
      {children}
    </div>
  );
}

export function Deslizador({
  label,
  desc,
  value,
  min,
  max,
  step = 1,
  sufijo = '',
  onChange,
}: {
  label: string;
  /** Una línea de por qué, para los que no se explican solos. */
  desc?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  sufijo?: string;
  onChange: (v: number) => void;
}) {
  return (
    <Campo label={label} valor={`${value}${sufijo}`}>
      <div className="rng">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label={label}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
      {desc && <p className="f__d">{desc}</p>}
    </Campo>
  );
}

/** Interruptor. `role="switch"` para que un lector de pantalla lo anuncie. */
export function Interruptor({
  label,
  desc,
  on,
  onChange,
}: {
  label: string;
  desc?: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="sw-row">
      <div>
        {label}
        {desc && <small>{desc}</small>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        className={`sw-box${on ? ' on' : ''}`}
        onClick={() => onChange(!on)}
      />
    </div>
  );
}

/** Grupo de opciones excluyentes, en píldoras. */
export function Pastillas<T extends string>({
  opciones,
  value,
  onChange,
}: {
  opciones: ReadonlyArray<{ id: T; name: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="chips chips--sm" role="group">
      {opciones.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          className={`chip${value === o.id ? ' on' : ''}`}
          onClick={() => onChange(o.id)}
        >
          {o.name}
        </button>
      ))}
    </div>
  );
}

/**
 * Opciones en tarjeta con una miniatura de lo que hacen.
 *
 * Para lo que se elige por su FORMA, un dibujo dice en un vistazo lo que
 * "Normal / Split / Minimal" no dice en tres palabras.
 */
export function Tarjetas<T extends string>({
  opciones,
  value,
  onChange,
  dibujos,
}: {
  opciones: ReadonlyArray<{ id: T; name: string; dibujo?: ReactNode }>;
  value: T;
  onChange: (v: T) => void;
  /**
   * Dibujo por id, para los catalogos que viven en `data/`.
   *
   * Alli hay datos, y un catalogo que exportara JSX dejaria de poder usarse
   * fuera de React. El puente es el id, que es lo unico que las dos partes
   * comparten. Si falta uno, la tarjeta sale solo con su nombre en vez de
   * con un hueco.
   */
  dibujos?: Record<string, ReactNode>;
}) {
  return (
    <div className="cards" role="group">
      {opciones.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          className={`card${value === o.id ? ' on' : ''}`}
          onClick={() => onChange(o.id)}
        >
          {(o.dibujo ?? dibujos?.[o.id]) && (
            <span className="card__fig" aria-hidden="true">
              {o.dibujo ?? dibujos?.[o.id]}
            </span>
          )}
          <span className="card__n">{o.name}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Elegir tipografía viéndola.
 *
 * Esto era un `<select>`. Un desplegable nativo enseña los nombres, y un
 * nombre no es una letra: «Bastliga», «Chiikawa» o «Video» no le dicen nada
 * a nadie hasta que se ven escritos. Con 37 fuentes eso son 37 pruebas de
 * ensayo y error, cerrando y abriendo la lista una por una.
 *
 * Aquí cada opción está escrita CON su propia fuente, así que elegir es
 * mirar. Sigue en dos grupos —las de texto y las decorativas— porque son
 * dos intenciones distintas y mezclarlas hace la rejilla ilegible.
 */
export function SelectorFuente({
  value,
  onChange,
  premium = true,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Sin plan, las decorativas se ven y no se eligen. */
  premium?: boolean;
}) {
  const opcion = (id: string, nombre: string, stack?: string) => {
    /* Las decorativas piden plan. Se cierra la FUENTE, no la tipografia:
       cerrar el grupo entero dejaria a un perfil gratis sin poder cambiar el
       tamaño de su propio nombre, y eso no es una limitacion, es un fallo.

       Y se enseñan con su muestra de verdad, escritas con su propia letra.
       Una lista de nombres apagados no dice nada; ver «Death Note» escrito
       en Death Note es el anuncio. */
    const cerrada = !premium && fuenteEsPro(id);
    return (
      <button
        key={id || 'perfil'}
        type="button"
        className={`fnt${value === id ? ' on' : ''}${cerrada ? ' fnt--pro' : ''}`}
        aria-pressed={value === id}
        aria-disabled={cerrada || undefined}
        onClick={() => (cerrada ? undefined : onChange(id))}
        title={cerrada ? `${nombre} — la trae el plan` : nombre}
      >
        <span className="fnt__m" style={stack ? { fontFamily: stack } : undefined}>
          {nombre}
        </span>
        {cerrada && (
          <span className="fnt__pro" aria-hidden="true">
            {ROMBO}
          </span>
        )}
      </button>
    );
  };

  const deco = FONTS.filter((f) => f.grupo === 'deco');

  return (
    <div className="fnts" role="group" aria-label="Fuente">
      {/* La del perfil va la primera y sin muestra propia: es «no elijas
          ninguna», no una fuente mas. */}
      {opcion('', 'La del perfil')}

      <span className="fnts__g">De texto</span>
      {FONTS.filter((f) => f.grupo !== 'deco').map((f) => opcion(f.id, f.name, f.stack))}

      <span className="fnts__g">
        Decorativas
        {!premium && (
          <Link className="fnts__pro" to="/pricing">
            {deco.length} con Premium
          </Link>
        )}
      </span>
      {deco.map((f) => opcion(f.id, f.name, f.stack))}
    </div>
  );
}

// ── Color por canales ────────────────────────────────────────

/**
 * Selector de color con los tres canales a la vista.
 * `value` vacío significa "el del tema": se muestra `porDefecto` pero no se
 * escribe nada hasta que la persona toca algo.
 */
export function ColorRGB({
  label,
  value,
  porDefecto,
  onChange,
}: {
  label: string;
  value: string;
  porDefecto: string;
  onChange: (hex: string) => void;
}) {
  /* El selector nativo dispara `change` MUCHAS veces por fotograma
     mientras se arrastra el raton por el cuadro de color, y cada una de
     esas veces repintaba el perfil entero: por eso el cursor se sentia
     pegajoso, como si fuera por detras de la mano.

     Ahora el color se guarda aparte y se enseña al instante —el selector
     y las cifras responden sin esperar a nadie— y al perfil solo se le
     manda UNA vez por fotograma. Se pintan los mismos fotogramas que
     antes; lo que se dejan de hacer son los repintados de mas entre
     fotograma y fotograma, que no se veian y costaban todo. */
  const [local, setLocal] = useState<string | null>(null);
  const pendiente = useRef<string | null>(null);
  const cuadro = useRef(0);

  /* Mientras no se esta arrastrando manda el perfil, para que un color
     puesto desde otro sitio —una muestra, otra plantilla— se vea aqui. */
  const vigente = local ?? value;
  const rgb = hexARgb(vigente, porDefecto);
  const hex = rgbAHex(rgb);

  const empujar = useCallback(
    (nuevo: string) => {
      setLocal(nuevo);
      pendiente.current = nuevo;
      if (cuadro.current) return;
      cuadro.current = requestAnimationFrame(() => {
        cuadro.current = 0;
        const v = pendiente.current;
        pendiente.current = null;
        if (v) onChange(v);
      });
    },
    [onChange],
  );

  /* Al soltar se suelta tambien el borrador: a partir de ahi vuelve a
     mandar lo que diga el perfil. Y si quedaba un fotograma pedido, se
     manda su valor para no perder el ultimo movimiento. */
  const soltar = useCallback(() => {
    if (cuadro.current) {
      cancelAnimationFrame(cuadro.current);
      cuadro.current = 0;
      const v = pendiente.current;
      pendiente.current = null;
      if (v) onChange(v);
    }
    setLocal(null);
  }, [onChange]);

  useEffect(() => () => {
    if (cuadro.current) cancelAnimationFrame(cuadro.current);
  }, []);

  const canal = (k: keyof Rgb, v: number) => empujar(rgbAHex({ ...rgb, [k]: acotarCanal(v) }));

  return (
    <Campo label={label} valor={`R:${rgb.r} G:${rgb.g} B:${rgb.b}`}>
      <div className="rgb">
        <input
          type="color"
          className="col-custom"
          value={hex}
          aria-label={`${label}: selector de color`}
          onChange={(e) => empujar(e.target.value.toUpperCase())}
          onBlur={soltar}
        />
        {(['r', 'g', 'b'] as const).map((k) => (
          <label key={k} className="rgb__c">
            <span>{k.toUpperCase()}</span>
            <input
              type="number"
              min={0}
              max={255}
              value={rgb[k]}
              aria-label={`${label}: canal ${k.toUpperCase()}`}
              onChange={(e) => canal(k, Number(e.target.value))}
            />
          </label>
        ))}
      </div>
    </Campo>
  );
}

/** Caja de ajustes que depende de la opción elegida arriba. */
export function Subpanel({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="surf">
      <h3 className="surf__t">{titulo}</h3>
      {children}
    </section>
  );
}

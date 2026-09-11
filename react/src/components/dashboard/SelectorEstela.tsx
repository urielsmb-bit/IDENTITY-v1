import { useEffect, useRef } from 'react';
import { ESTELAS, estela as buscarEstela } from '@/data/estelas';
import { crearEstela, type Estela } from '@/lib/estela';
import { Campo, Deslizador } from './Controles';

/**
 * Elegir la estela viéndola.
 *
 * ────────────────────────────────────────────────────────────────────────
 * LAS TARJETAS USAN EL MOTOR DE VERDAD
 * ────────────────────────────────────────────────────────────────────────
 *
 * Cada tarjeta es el mismo `crearEstela` que corre en tu perfil, dibujando
 * en el lienzo de la tarjeta y con un puntero de mentira que recorre un ocho
 * tumbado. No es una animación que imite el efecto: es el efecto.
 *
 * Dibujar la previa aparte habría sido tener dos implementaciones de la
 * misma física, y dos implementaciones de lo mismo divergen siempre. Cuando
 * eso pasa, eliges una cosa y te llevas otra.
 *
 * ────────────────────────────────────────────────────────────────────────
 * Y LAS QUE NO SE VEN NO CORREN
 * ────────────────────────────────────────────────────────────────────────
 *
 * Quince tarjetas animándose a la vez cuando en el panel caben seis es pagar
 * por nueve efectos que nadie mira. Cada una tiene su vigía: al salir de la
 * pantalla se PARA —no se atenúa, se para— y vuelve al acercarse.
 */

/** Colores a mano. El primero de cada estela es el suyo de fábrica. */
const PALETA = ['#ff5fa8', '#4da3ff', '#3ee0c0', '#ffb545', '#ff7a7a', '#c9d4e0'];

function TarjetaEstela({
  id,
  puesta,
  color,
  onElegir,
}: {
  id: string;
  puesta: boolean;
  /** El color elegido, o vacío para que cada una use el suyo. */
  color: string;
  onElegir: () => void;
}) {
  const lienzo = useRef<HTMLCanvasElement | null>(null);
  const viva = useRef<Estela | null>(null);
  const def = buscarEstela(id);

  useEffect(() => {
    const cv = lienzo.current;
    if (!cv) return;

    const e = crearEstela({
      fx: id,
      /* Bastante para que se vea de qué va, sin que la tarjeta se convierta
         en una mancha: la densidad de verdad la eliges tú abajo. */
      cantidad: 7,
      color: color || undefined,
      lienzo: cv,
      guion: true,
    });
    viva.current = e;
    if (!e) return;

    /* `rootMargin` para que arranque justo ANTES de entrar: si esperara a
       tocar el borde, lo primero que verías al bajar sería una tarjeta
       vacía llenándose. */
    const vigia = new IntersectionObserver(
      ([x]) => e.pausar(!x?.isIntersecting),
      { rootMargin: '80px' },
    );
    vigia.observe(cv);

    return () => {
      vigia.disconnect();
      e.destruir();
      viva.current = null;
    };
  }, [id]);

  /* Cambiar el color NO vuelve a montar el lienzo. */
  useEffect(() => {
    viva.current?.actualizar({ fx: id, cantidad: 7, color: color || undefined, guion: true });
  }, [id, color]);

  return (
    <button
      type="button"
      className={`est__b${puesta ? ' on' : ''}`}
      aria-pressed={puesta}
      onClick={onElegir}
      title={def?.desc}
    >
      <canvas ref={lienzo} className="est__lienzo" aria-hidden="true" />
      <span className="est__n">{def?.nombre ?? id}</span>
    </button>
  );
}

export function SelectorEstela({
  fx,
  color,
  intensidad,
  cantidad,
  direccion,
  onCambio,
}: {
  fx: string;
  color: string;
  intensidad: number;
  cantidad: number;
  direccion: string;
  onCambio: (cambio: Record<string, unknown>) => void;
}) {
  const def = buscarEstela(fx);
  /* El color que se enseña como puesto: el elegido, o el de fábrica de esta
     estela. Ninguna es morada por defecto; cada una tiene el suyo, y el
     color es la mitad de lo que hace que se reconozcan. */
  const actual = color || def?.color || '#ffffff';
  const colores = [...new Set([def?.color ?? '#ffffff', ...PALETA])].slice(0, 7);

  return (
    <>
      <Campo label="Estela">
        <div className="est" role="group" aria-label="Tipo de estela">
          {ESTELAS.map((e) => (
            <TarjetaEstela
              key={e.id}
              id={e.id}
              puesta={fx === e.id}
              color={color}
              onElegir={() => onCambio({ cursorTrailFx: e.id })}
            />
          ))}
        </div>
      </Campo>

      {def && <p className="est__pie">{def.desc}</p>}

      <Campo label="Color">
        <div className="est__cols" role="group" aria-label="Color de la estela">
          {colores.map((c) => (
            <button
              key={c}
              type="button"
              className={`est__col${actual.toLowerCase() === c.toLowerCase() ? ' on' : ''}`}
              style={{ background: c }}
              aria-label={`Color ${c}`}
              onClick={() => onCambio({ cursorTrailColor: c })}
            />
          ))}
          {/* El de fábrica, para volver. Sin esto, tocar un color es una
              decisión sin marcha atrás: no hay forma de acordarse de cuál
              era el de esta estela. */}
          <button
            type="button"
            className="est__col est__col--suyo"
            title="El color propio de esta estela"
            onClick={() => onCambio({ cursorTrailColor: '' })}
          >
            ↺
          </button>
          <label className="est__col est__col--mio" title="Otro color">
            <input
              type="color"
              value={actual}
              onChange={(ev) => onCambio({ cursorTrailColor: ev.target.value })}
            />
          </label>
        </div>
      </Campo>

      <Deslizador
        label="Cantidad"
        desc="Cuántas motas deja al pasar. 0 = ninguna."
        min={0}
        max={12}
        value={cantidad}
        onChange={(v) => onCambio({ cursorTrail: v })}
      />

      <Deslizador
        label="Intensidad"
        desc="Su tamaño y su brillo."
        sufijo="%"
        min={25}
        max={200}
        step={5}
        value={intensidad}
        onChange={(v) => onCambio({ cursorTrailInt: v })}
      />

      <Campo label="Dirección">
        <select
          className="inp"
          value={direccion}
          onChange={(ev) => onCambio({ cursorTrailDir: ev.target.value })}
        >
          <option value="seguimiento">Seguimiento</option>
          <option value="arriba">Hacia arriba</option>
          <option value="abajo">Hacia abajo</option>
          <option value="libre">A su aire</option>
        </select>
      </Campo>
    </>
  );
}

import type { ReactNode } from 'react';
import { acotarCanal, hexARgb, rgbAHex, type Rgb } from '@/lib/color';

/**
 * Controles del editor.
 *
 * Todos se apoyan en las clases que ya vivían en `dashboard.css` (.f, .rng,
 * .sw-box, .chip, .col-custom). No se estilan en línea: el editor tenía cien
 * `style={{}}` sueltos y una hoja de estilos entera sin usar.
 */

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
}: {
  opciones: ReadonlyArray<{ id: T; name: string; dibujo: ReactNode }>;
  value: T;
  onChange: (v: T) => void;
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
          <span className="card__fig" aria-hidden="true">
            {o.dibujo}
          </span>
          <span className="card__n">{o.name}</span>
        </button>
      ))}
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
  const rgb = hexARgb(value, porDefecto);
  const hex = rgbAHex(rgb);
  const canal = (k: keyof Rgb, v: number) => onChange(rgbAHex({ ...rgb, [k]: acotarCanal(v) }));

  return (
    <Campo label={label} valor={`R:${rgb.r} G:${rgb.g} B:${rgb.b}`}>
      <div className="rgb">
        <input
          type="color"
          className="col-custom"
          value={hex}
          aria-label={`${label}: selector de color`}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
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

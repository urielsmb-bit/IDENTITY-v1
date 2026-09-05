import { useEffect, useMemo, useRef, useState } from 'react';
import { buscar, type Resultado } from '@/data/buscar';

/**
 * Buscar un ajuste.
 *
 * IDENTITY tiene once bloques y casi cien controles. Es más de lo que ofrece
 * la competencia — y no servía de nada, porque encontrar «el degradado del
 * nombre» exigía saber ya que vive en Bloques → Nombre → Color. Una opción
 * que no se encuentra no existe.
 *
 * Esto no añade ninguna función: hace alcanzable lo que ya estaba.
 *
 * Es un `<dialog>` de verdad, como el resto de las ventanas de aquí: el foco
 * encerrado dentro, Esc para cerrar y el fondo inerte vienen gratis y bien
 * hechos. Lo que no se hereda —moverse con las flechas y entrar con Enter—
 * va abajo, porque un buscador al que hay que llegar con el ratón no ahorra
 * nada a quien acaba de pulsar Ctrl+K.
 */
export function Buscador({
  abierto,
  alCerrar,
  alIr,
}: {
  abierto: boolean;
  alCerrar: () => void;
  alIr: (r: Resultado) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);

  const res = useMemo(() => buscar(q), [q]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) {
      d.showModal();
      setQ('');
      setI(0);
      // Tras `showModal`, no antes: el diálogo todavía no era enfocable.
      campo.current?.focus();
    }
    if (!abierto && d.open) d.close();
  }, [abierto]);

  /* Si la lista se acorta al escribir, el señalado puede quedarse fuera. */
  useEffect(() => {
    setI((n) => (n >= res.length ? 0 : n));
  }, [res.length]);

  const ir = (r: Resultado | undefined) => {
    if (!r) return;
    alIr(r);
    alCerrar();
  };

  return (
    <dialog
      ref={ref}
      className="busc"
      onClose={alCerrar}
      onClick={(e) => {
        // Los clics en el fondo llegan al propio <dialog>; los de dentro, no.
        if (e.target === ref.current) alCerrar();
      }}
    >
      <div className="busc__caja">
        <div className="busc__campo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.6-3.6" strokeLinecap="round" />
          </svg>
          <input
            ref={campo}
            type="text"
            value={q}
            placeholder="Buscar un ajuste…"
            aria-label="Buscar un ajuste"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setI((n) => (res.length ? (n + 1) % res.length : 0));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setI((n) => (res.length ? (n - 1 + res.length) % res.length : 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                ir(res[i]);
              }
            }}
          />
        </div>

        {q.trim() !== '' && res.length === 0 && (
          <p className="busc__nada">
            Nada con «{q.trim()}». Prueba con lo que quieres conseguir —
            «caja», «letra», «brillo»— y no con el nombre del control.
          </p>
        )}

        {res.length > 0 && (
          <ul className="busc__l" role="listbox" aria-label="Resultados">
            {res.map((r, n) => (
              <li key={r.clave}>
                <button
                  type="button"
                  role="option"
                  aria-selected={n === i}
                  className={`busc__it${n === i ? ' on' : ''}`}
                  // `mouseMove` y no `mouseEnter`: si la lista se mueve bajo
                  // un ratón quieto, `enter` señala algo que nadie apuntó.
                  onMouseMove={() => setI(n)}
                  onClick={() => ir(r)}
                >
                  <span className="busc__t">{r.titulo}</span>
                  <span className="busc__d">{r.ruta}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="busc__pie">
          <kbd>↑</kbd><kbd>↓</kbd> moverse · <kbd>↵</kbd> ir · <kbd>Esc</kbd> cerrar
        </div>
      </div>
    </dialog>
  );
}

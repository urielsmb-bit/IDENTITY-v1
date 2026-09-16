import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { ProfileView } from '@/components/profile/ProfileView';
import { LienzoBloques } from '@/components/dashboard/LienzoBloques';
import { Frontera } from '@/components/layout/Frontera';
import { HojaInferior } from './HojaInferior';
import { ContenidoHerramienta } from './ContenidoHerramienta';
import { BarraContextual } from './BarraContextual';
import { HERRAMIENTAS, HERRAMIENTA_POR_ID, type IdHerramienta } from '@/data/herramientasMovil';
import { BLOQUE_POR_ID } from '@/data/bloques';
import type { DatosInsignias } from '@/lib/insignias';
import type { Profile } from '@/types';

/**
 * El editor táctil: lienzo arriba, herramientas abajo, hoja contextual.
 *
 * ────────────────────────────────────────────────────────────────────────
 * QUE ES ESTO EXACTAMENTE
 * ────────────────────────────────────────────────────────────────────────
 *
 * Una capa de PRESENTACIÓN, no un segundo editor. No tiene estado propio
 * del perfil, no guarda, no valida y no sabe qué es un control: todo eso
 * sigue viviendo donde vivía.
 *
 *                        editorStore
 *                             │
 *                    ┌────────┴────────┐
 *                 escritorio          móvil
 *                    │                  │
 *                  ratón              dedo
 *                    └────────┬─────────┘
 *                     mismos datos
 *                     mismos controles
 *                     mismo guardado
 *
 * El lienzo son los MISMOS `ProfileView` y `LienzoBloques` que usa el
 * escritorio, con las mismas props. No es una copia que se parece: es el
 * mismo componente, así que no puede desviarse.
 *
 * ────────────────────────────────────────────────────────────────────────
 * POR QUE EL LIENZO MANDA
 * ────────────────────────────────────────────────────────────────────────
 *
 * Hoy, en un teléfono, el editor y la vista previa son dos pestañas: para
 * ver lo que acabas de cambiar hay que irse y volver. Eso convierte cada
 * ajuste en un viaje de ida y vuelta, y con cincuenta ajustes son cincuenta
 * viajes.
 *
 * Aquí el perfil está siempre delante y las herramientas se le ponen
 * encima. La regla es «veo algo, lo toco, lo edito, lo veo», y todo lo
 * demás —que la hoja nunca tape del todo, que se cierre con el dedo, que
 * el riel se desplace en vez de encoger los iconos— sale de ahí.
 *
 * ────────────────────────────────────────────────────────────────────────
 * FASE 1
 * ────────────────────────────────────────────────────────────────────────
 *
 * Está el armazón: barra, lienzo, riel de doce y hoja. Las hojas todavía
 * no traen sus controles dentro — eso es la fase 2, y se hace conectando
 * los grupos que YA declara `data/bloques.ts`, no escribiendo controles
 * nuevos.
 *
 * Mientras tanto esto NO sustituye a nada: se entra a propósito con
 * `?movil=nuevo`. El editor de hoy sigue siendo el que ve todo el mundo,
 * así que esto se puede subir a medio hacer sin que nadie se quede sin
 * editor.
 */

export interface EditorMovilProps {
  profile: Profile;
  insignias: string[];
  premium: boolean;
  update: (p: Partial<Profile>) => void;
  datosInsignias: DatosInsignias;
  guardando: boolean;
  onPublicar: () => void;
  onSalir: () => void;
}

export function EditorMovil({
  profile, insignias, premium, update, datosInsignias, guardando, onPublicar, onSalir,
}: EditorMovilProps) {
  const [herramienta, setHerramienta] = useState<IdHerramienta | null>(null);
  /**
   * El bloque abierto DENTRO de la hoja.
   *
   * Es una pila de dos escalones, no una pantalla nueva: herramienta →
   * bloque. Más profundidad en un teléfono se convierte en «¿por dónde
   * había entrado?», y la cabecera de la hoja ya sabe volver un paso.
   */
  const [bloque, setBloque] = useState<string | null>(null);
  /** Y el seleccionado en el lienzo, que es lo que `LienzoBloques` marca. */
  const [pieza, setPieza] = useState<string | null>(null);
  /** El grupo al que hay que bajar al abrir la hoja, si se llegó por la
   *  barra contextual. Es un título, no un índice: los títulos ya son
   *  únicos dentro de un bloque y sobreviven a que se reordenen. */
  const [grupoDestino, setGrupoDestino] = useState<string | null>(null);

  /* Mientras este editor esta en pantalla, el documento entero cambia de
     modo: se aparta la barra del sitio y se corta el desplazamiento de la
     pagina de debajo. Se pone y se quita aqui —no en una hoja de estilos
     global— para que al salir no quede rastro. */
  useEffect(() => {
    document.body.classList.add('editor-tactil');
    return () => document.body.classList.remove('editor-tactil');
  }, []);

  /* Deshacer y rehacer salen del MISMO almacen que en el escritorio. No
     hay una historia para el raton y otra para el dedo: es la misma pila,
     asi que se puede deshacer en el telefono algo hecho en el ordenador
     dentro de la misma sesion. */
  const undo = useEditorStore((e) => e.undo);
  const redo = useEditorStore((e) => e.redo);
  const historyIndex = useEditorStore((e) => e.historyIndex);
  const history = useEditorStore((e) => e.history);
  const sePuedeDeshacer = historyIndex > 0;
  const sePuedeRehacer = historyIndex < history.length - 1;

  /**
   * El encogido del perfil cuando la hoja le quita sitio.
   *
   * «si sube el visualizador sube con él y se pone más pequeño, todo debe
   *  ser una escala».
   *
   * El tamaño de REPOSO —el hueco entero, sin hoja— se mide una vez y se
   * guarda. A partir de ahí, lo que se ve es siempre ese mismo perfil
   * escalado a lo que quede: nunca se le cambia el alto de verdad.
   *
   * La diferencia importa. Cambiando el alto, el perfil se RECOMPONE: la
   * tarjeta se reajusta, el texto parte en otras líneas, el fondo se
   * reencuadra. O sea que al abrir una hoja verías un perfil distinto del
   * que vas a publicar, que es lo contrario de lo que sirve una vista
   * previa. Escalando, es el mismo perfil visto desde más lejos.
   */
  const hueco = useRef<HTMLDivElement>(null);
  const [reposo, setReposo] = useState({ ancho: 0, alto: 0 });
  const [hay, setHay] = useState({ ancho: 0, alto: 0 });

  useLayoutEffect(() => {
    const el = hueco.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const obs = new ResizeObserver(([e]) => {
      const r = e?.contentRect;
      if (!r) return;
      const m = { ancho: Math.round(r.width), alto: Math.round(r.height) };
      setHay(m);
      /* El reposo es el hueco MAS GRANDE que se ha visto. Es lo mismo que
         «sin hoja» sin tener que saber si la hay: la hoja solo puede
         quitar sitio, nunca dar. Y asi girar el telefono o que aparezca la
         barra del navegador tambien lo actualiza. */
      setReposo((r0) => (m.alto > r0.alto ? m : r0));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const escala = reposo.alto > 0 ? Math.min(1, hay.alto / reposo.alto) : 1;

  const activa = herramienta ? HERRAMIENTA_POR_ID[herramienta] : null;

  const lienzo =
    profile.layoutMode === 'free' ? (
      <LienzoBloques
        profile={profile}
        update={update}
        premium={premium}
        vista="mobile"
        seleccionado={pieza}
        onAbrirBloque={(id) => { if (BLOQUE_POR_ID[id]) setPieza(id); }}
      >
        <ProfileView profile={profile} insignias={insignias} preview editando />
      </LienzoBloques>
    ) : (
      <ProfileView profile={profile} insignias={insignias} preview editando />
    );

  return (
    <div className="em">
      <header className="em__barra">
        <button type="button" className="em__icono" onClick={onSalir} aria-label="Volver">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
               strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <div className="em__quien">
          <span className="em__usuario">@{profile.username || 'tu-perfil'}</span>
          {/* El estado de guardado en el sitio donde ya se está mirando —al
              lado del nombre— y no en una esquina: es lo que contesta a
              «¿se ha guardado?» sin tener que buscarlo. */}
          <span className="em__estado" aria-live="polite">
            {guardando ? 'Guardando…' : 'Guardado'}
          </span>
        </div>

        <button
          type="button"
          className="em__icono"
          onClick={undo}
          disabled={!sePuedeDeshacer}
          aria-label="Deshacer"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
               strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 14 4 9l5-5" />
            <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
          </svg>
        </button>
        <button
          type="button"
          className="em__icono"
          onClick={redo}
          disabled={!sePuedeRehacer}
          aria-label="Rehacer"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
               strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 14 5-5-5-5" />
            <path d="M20 9H10a6 6 0 0 0 0 12h3" />
          </svg>
        </button>

        <button type="button" className="em__publicar" onClick={onPublicar}>
          Publicar
        </button>
      </header>

      {/**
        * Tocar el lienzo selecciona la pieza tocada.
        *
        * El oyente va AQUI, en el contenedor, y no dentro del perfil, por
        * dos razones. Una: en el modo apilado no hay `LienzoBloques`, que
        * es quien avisa en el modo libre — pero las piezas llevan su
        * `data-bloque` en el DOM en los dos modos, así que subiendo por los
        * padres se encuentra igual. Y dos: no hay que tocar `ProfileView`,
        * que es el componente que comparten el editor y el perfil público.
        *
        * Con `click` y no con `pointerdown`: en el modo libre el mismo dedo
        * puede estar arrastrando una pieza, y `click` solo llega si el dedo
        * no se movió — que es exactamente la diferencia entre seleccionar y
        * mover.
        */}
      <main
        className="em__lienzo"
        ref={hueco}
        onClick={(e) => {
          const el = (e.target as HTMLElement).closest?.('[data-bloque]');
          const id = el?.getAttribute('data-bloque') ?? '';
          /* Tocar el fondo deselecciona: si no, la barra contextual se
             queda puesta y no hay forma evidente de quitarla. */
          setPieza(BLOQUE_POR_ID[id] ? id : null);
        }}
      >
        <div
          className="em__escena"
          style={{
            /* Alto de reposo, no el de ahora: es lo que hace que el perfil
               no se recomponga al encoger. */
            height: reposo.alto ? `${reposo.alto}px` : '100%',
            transform: escala < 1 ? `scale(${escala})` : undefined,
          }}
        >
          <Frontera donde="la vista previa" reintentarCon={profile.username}>
            {lienzo}
          </Frontera>
        </div>
      </main>

      {pieza && (
        <BarraContextual
          bloque={pieza}
          onGrupo={(id, grupo) => {
            setHerramienta('bloques');
            setBloque(id);
            setGrupoDestino(grupo);
          }}
          onCerrar={() => setPieza(null)}
        />
      )}

      {/* Doce, y se desplaza. Encogerlas para que quepan las doce a la vez
          daría iconos de veinte píxeles con una palabra debajo que no se
          lee: caben todas y no se usa ninguna. */}
      <nav className="em__riel" aria-label="Herramientas">
        <ul className="em__riel-lista">
          {HERRAMIENTAS.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                className={`em__h${herramienta === h.id ? ' on' : ''}`}
                aria-pressed={herramienta === h.id}
                title={h.titulo}
                onClick={() => {
                  setBloque(null);
                  setHerramienta(herramienta === h.id ? null : h.id);
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
                     strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                     dangerouslySetInnerHTML={{ __html: h.icono }} />
                <span>{h.nombre}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <HojaInferior
        abierta={!!activa}
        /* El título dice dónde estás: la herramienta, o el bloque si has
           entrado en uno. Sin eso, dos escalones de profundidad en una
           hoja de 52 % de alto se pierden enseguida. */
        titulo={bloque ? (BLOQUE_POR_ID[bloque]?.nombre ?? activa?.titulo ?? '') : (activa?.titulo ?? '')}
        onVolver={bloque ? () => setBloque(null) : undefined}
        onCerrar={() => { setBloque(null); setGrupoDestino(null); setHerramienta(null); }}
      >
        {activa && (
          <ContenidoHerramienta
            herramienta={activa.id}
            bloque={bloque}
            profile={profile}
            update={update}
            premium={premium}
            insignias={insignias}
            datosInsignias={datosInsignias}
            grupoDestino={grupoDestino}
            onGrupoVisto={() => setGrupoDestino(null)}
            onAbrirBloque={(id) => { setGrupoDestino(null); setBloque(id); }}
            onVolver={() => { setGrupoDestino(null); setBloque(null); }}
          />
        )}
      </HojaInferior>
    </div>
  );
}

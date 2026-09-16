import { useEffect, useState } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { ProfileView } from '@/components/profile/ProfileView';
import { LienzoBloques } from '@/components/dashboard/LienzoBloques';
import { Frontera } from '@/components/layout/Frontera';
import { HojaInferior } from './HojaInferior';
import { ContenidoHerramienta } from './ContenidoHerramienta';
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

  const activa = herramienta ? HERRAMIENTA_POR_ID[herramienta] : null;

  const lienzo =
    profile.layoutMode === 'free' ? (
      <LienzoBloques
        profile={profile}
        update={update}
        premium={premium}
        vista="mobile"
        seleccionado={pieza}
        onAbrirBloque={(id) => {
          if (!BLOQUE_POR_ID[id]) return;
          /* Tocar en el lienzo abre su editor. Es media fase 3 y sale
             gratis: `LienzoBloques` ya avisa de que se ha tocado un
             bloque, y la hoja ya sabe enseñar uno. */
          setPieza(id);
          setHerramienta('bloques');
          setBloque(id);
        }}
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

      <main className="em__lienzo">
        <Frontera donde="la vista previa" reintentarCon={profile.username}>
          {lienzo}
        </Frontera>
      </main>

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
        onCerrar={() => { setBloque(null); setHerramienta(null); }}
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
            onAbrirBloque={setBloque}
            onVolver={() => setBloque(null)}
          />
        )}
      </HojaInferior>
    </div>
  );
}

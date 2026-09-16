import { useEffect, useState } from 'react';
import { ProfileView } from '@/components/profile/ProfileView';
import { LienzoBloques } from '@/components/dashboard/LienzoBloques';
import { Frontera } from '@/components/layout/Frontera';
import { HojaInferior } from './HojaInferior';
import { HERRAMIENTAS, HERRAMIENTA_POR_ID, type IdHerramienta } from '@/data/herramientasMovil';
import { BLOQUE_POR_ID } from '@/data/bloques';
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
  guardando: boolean;
  onPublicar: () => void;
  onSalir: () => void;
}

export function EditorMovil({
  profile, insignias, premium, update, guardando, onPublicar, onSalir,
}: EditorMovilProps) {
  const [herramienta, setHerramienta] = useState<IdHerramienta | null>(null);
  /** El bloque tocado en el lienzo. Todavía no abre nada —eso es la fase
   *  3— pero ya se recoge, que es lo que prueba que el lienzo responde. */
  const [pieza, setPieza] = useState<string | null>(null);

  /* Mientras este editor esta en pantalla, el documento entero cambia de
     modo: se aparta la barra del sitio y se corta el desplazamiento de la
     pagina de debajo. Se pone y se quita aqui —no en una hoja de estilos
     global— para que al salir no quede rastro. */
  useEffect(() => {
    document.body.classList.add('editor-tactil');
    return () => document.body.classList.remove('editor-tactil');
  }, []);

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
                onClick={() => setHerramienta(herramienta === h.id ? null : h.id)}
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
        titulo={activa?.titulo ?? ''}
        onCerrar={() => setHerramienta(null)}
      >
        <p className="em__pendiente">
          Los controles de <strong>{activa?.titulo}</strong> se conectan en la fase 2.
          Serán los mismos que en el ordenador, no otros.
        </p>
      </HojaInferior>
    </div>
  );
}

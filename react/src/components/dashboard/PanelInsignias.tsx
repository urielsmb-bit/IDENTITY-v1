import { useEffect, useMemo, useState } from 'react';
import type { Profile } from '@/types/profile';
import { estadoInsignias, type DatosInsignias, type EstadoInsignia } from '@/lib/insignias';
import { COLOR_RAREZA, NOMBRE_RAREZA } from '@/data/badges';
import * as backend from '@/lib/backend';
import { hasBackend } from '@/lib/supabase';

/** Por qué una insignia todavía no puede darse a nadie. */
const BLOQUEO: Record<string, string> = {
  servidor: 'La concede el equipo',
  plan: 'Necesita un plan activo',
  externo: 'Necesita otra conexión',
};

/**
 * Las insignias, de sólo lectura.
 *
 * Antes esto era una rejilla de botones que escribían en `profile.badges`:
 * cualquiera podía activarse «Staff» o «Verificado» y salía en su perfil
 * como si se lo hubieran dado. Ahora no hay nada que pulsar. Se calculan con
 * cifras del servidor —antigüedad, visitas, notas— y con lo que el equipo
 * haya concedido.
 *
 * Y como se calculan, se puede enseñar lo que antes no existía: **cuánto
 * falta para la siguiente**. Una insignia que no sabes que existe no te
 * mueve a nada; una con la barra a medias, sí.
 */
export function PanelInsignias({ profile }: { profile: Profile }) {
  const [datos, setDatos] = useState<DatosInsignias>({});

  /* Las cifras no viajan con el perfil: viven en la vista `descubrir` y en
     `insignias_de_perfil`. Se piden aquí, y si fallan se sigue con lo que
     trae el perfil, que alcanza para las de antigüedad. */
  useEffect(() => {
    const base: DatosInsignias = {
      creado: profile.joined,
      vistas: profile.views,
      nota: profile.nota,
      numNotas: profile.numNotas,
    };
    setDatos(base);

    if (!hasBackend() || !profile.username) return;
    let vivo = true;
    backend
      .insigniasDe(profile.username)
      .then((d) => {
        if (vivo) setDatos({ ...base, ...d });
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [profile.username, profile.joined, profile.views, profile.nota, profile.numNotas]);

  /* Orden: primero las que llevas, luego las que están más cerca, y al final
     las que hoy no puede tener nadie. Así lo alcanzable queda arriba. */
  const lista = useMemo(() => {
    const todas = estadoInsignias(datos);
    return todas.sort((a, b) => {
      if (a.ganada !== b.ganada) return a.ganada ? -1 : 1;
      const aAuto = a.badge.fuente === 'perfil';
      const bAuto = b.badge.fuente === 'perfil';
      if (aAuto !== bAuto) return aAuto ? -1 : 1;
      return b.progreso - a.progreso;
    });
  }, [datos]);

  const ganadas = lista.filter((x) => x.ganada).length;
  const enCamino = lista.filter((x) => !x.ganada && x.badge.fuente === 'perfil');

  return (
    <div className="ins">
      <div>
        <h2 className="dash__h2">Insignias</h2>
        <p className="ins__sub">
          {ganadas === 0
            ? 'Todavía ninguna. No se eligen: se ganan.'
            : `Llevas ${ganadas} de ${lista.length}.`}
          {enCamino.length > 0 && ` Tienes ${enCamino.length} a tiro.`}
        </p>
      </div>

      <div className="bgrid" data-guia="insignias">
        {lista.map((e) => (
          <Ficha key={e.id} e={e} />
        ))}
      </div>

      <p className="ins__pie">
        Nadie puede ponerse una insignia a sí mismo. Las de antigüedad,
        visitas y valoraciones salen solas de tus cifras; el resto las da el
        equipo.
      </p>
    </div>
  );
}

function Ficha({ e }: { e: EstadoInsignia }) {
  const { badge: b } = e;
  const auto = b.fuente === 'perfil';
  const pct = Math.round(e.progreso * 100);

  return (
    <div
      className={`bcard bcard--fija${e.ganada ? ' is-on' : ''}`}
      style={{ '--rare': COLOR_RAREZA[b.rare] } as React.CSSProperties}
      title={`${NOMBRE_RAREZA[b.rare]} · ${b.how}`}
    >
      <span
        className="bcard__i"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: b.icon }}
      />
      <span className="bcard__c">
        <span className="bcard__n">
          <span>{b.label}</span>
          <i className="bcard__r" aria-label={NOMBRE_RAREZA[b.rare]} />
        </span>
        <span className="bcard__d">{b.how}</span>

        {/* Sólo hay barra donde hay algo que avanzar. En las que da el
            equipo una barra al 0% sería mentira: no depende de ti. */}
        {!e.ganada && auto && (
          <span className="ins__prog">
            <span
              className="ins__barra"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Progreso de ${b.label}`}
            >
              <i style={{ width: `${pct}%` }} />
            </span>
            {e.falta && <em className="ins__falta">{e.falta}</em>}
          </span>
        )}

        {!e.ganada && !auto && (
          <span className="ins__cerrada">{BLOQUEO[b.fuente] ?? ''}</span>
        )}

        {e.ganada && <span className="ins__hecha">Conseguida</span>}
      </span>
    </div>
  );
}

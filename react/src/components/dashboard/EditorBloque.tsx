import { useEffect, useState } from 'react';
import type { Profile, BlockStyle } from '@/types';
import type { ControlId, DefBloque, GrupoControles } from '@/data/bloques';
import {
  AV_POS,
  AV_SHAPES,
  BADGE_STYLES,
  BLOCK_ANIMS,
  BLOCK_SURFACES,
  FONTS,
  SOCIAL_STYLES,
} from '@/data/themes';
import { NETS } from '@/data/nets';
import { getBadge, resolveBadges } from '@/data/badges';
import { safeUrl } from '@/lib/utils';
import { idYouTube } from '@/lib/music';
import { Campo, ColorRGB, Deslizador, Interruptor, Pastillas } from './Controles';
import { PanelAnimacion } from './PanelAnimacion';
import { useDiscord, useIdDiscordDeLaSesion } from '@/hooks/useDiscord';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { SubirMedio } from './SubirMedio';

interface EditorBloqueProps {
  def: DefBloque;
  profile: Profile;
  onVolver: () => void;
  update: (partial: Partial<Profile>) => void;
}

const ALINEACIONES = [
  { id: 'left', name: 'Izquierda' },
  { id: 'center', name: 'Centro' },
  { id: 'right', name: 'Derecha' },
] as const;

const CASOS = [
  { id: 'none', name: 'Normal' },
  { id: 'uppercase', name: 'MAYÚS' },
  { id: 'lowercase', name: 'minús' },
  { id: 'capitalize', name: 'Título' },
] as const;

const ETIQUETA_TEXTO: Record<string, string> = {
  name: 'Nombre visible',
  username: 'Nombre de usuario',
  bio: 'Biografía',
  title: 'Oficio',
  about: 'Sobre mí',
};

/**
 * Los iconos de verdad, con el estilo elegido puesto.
 *
 * Una fila de pastillas no dice si "solo iconos" deja los glifos sueltos o
 * los mete en un cuadrito: hay que verlo. Se reutilizan las clases del
 * perfil (`.pf-socials`, `.pf-badges`) para que la muestra y el perfil no
 * puedan discrepar; `.muestra` sólo aporta los tokens `--p-*` que esas
 * clases esperan y que fuera de `.pf` no existen.
 */
function MuestraRedes({ profile }: { profile: Profile }) {
  const redes = profile.socials ?? [];
  if (redes.length === 0) {
    return (
      <p className="muestra__vacio">
        Aún no has enlazado ninguna red. Añádelas en «Redes &amp; Enlaces».
      </p>
    );
  }
  return (
    <div className="muestra">
      <div
        className="pf-socials"
        data-style={profile.socialStyle || 'icons'}
        data-mono={profile.monoIcons === false ? 'off' : 'on'}
      >
        {redes.map((sn, i) => {
          const net = NETS[sn.net];
          if (!net) return null;
          const label = sn.label || net.label;
          return (
            <a
              key={`${sn.net}-${i}`}
              className="pf-social"
              href={safeUrl(sn.url)}
              target="_blank"
              rel="noopener noreferrer nofollow"
              data-net={sn.net}
              data-label={label}
              style={{ '--brand': net.color } as React.CSSProperties}
              title={label}
              aria-label={label}
              dangerouslySetInnerHTML={{ __html: net.icon }}
            />
          );
        })}
      </div>
    </div>
  );
}

function MuestraInsignias({ profile }: { profile: Profile }) {
  const insignias = resolveBadges(profile.badges);
  if (insignias.length === 0) {
    return (
      <p className="muestra__vacio">
        Todavía no tienes insignias. Elígelas en «Badges».
      </p>
    );
  }
  return (
    <div className="muestra">
      <div className="pf-badges" data-style={profile.badgeStyle || 'icons'}>
        {insignias.slice(0, 8).map((id) => {
          const b = getBadge(id);
          if (!b) return null;
          return (
            <span key={id} className="pf-badge" data-rare={b.rare} title={b.label}>
              <i aria-hidden="true" dangerouslySetInnerHTML={{ __html: b.icon }} />
              <b>{b.label}</b>
            </span>
          );
        })}
      </div>
    </div>
  );
}

/**
 * El unico mando que deberia necesitar quien entro con Discord.
 *
 * Se enseña en cuanto la pagina PUEDE saber su id —por la sesion o porque
 * ya esta guardado—, sin pedir que lo escriba. Y dice si la cuenta tiene
 * decoracion o no, para que nadie active algo que no va a verse.
 */
function MarcoDiscord({
  profile,
  update,
}: {
  profile: Profile;
  update: (p: Partial<Profile>) => void;
}) {
  const idSesion = useIdDiscordDeLaSesion();
  const id = profile.discordId || idSesion;
  const { presencia } = useDiscord(id, !!id);

  if (!id) return null;

  const tiene = !!presencia?.decoracion;
  return (
    <div>
      <Interruptor
        label="Marco de Discord"
        desc="Rodea tu avatar con tu decoración de Nitro"
        on={profile.discordDeco !== false}
        onChange={(v) => {
          // Al encenderlo se guarda tambien el id, por si venia solo de la
          // sesion: el perfil publico no tiene sesion de la que sacarlo.
          update(
            profile.discordId
              ? { discordDeco: v }
              : { discordDeco: v, discordId: idSesion },
          );
        }}
      />
      {profile.discordDeco !== false && presencia && !tiene && (
        <p className="f__d">
          Tu cuenta no tiene decoración puesta ahora mismo, así que no se ve
          nada. En cuanto pongas una aparecerá sola.
        </p>
      )}
    </div>
  );
}

/**
 * La cuenta de Discord, sin pedir nada escrito.
 *
 * Antes esto era un campo con el id a la vista. Si el id se saca solo del
 * inicio de sesion, enseñarlo es enseñar fontaneria: no hay nada que hacer
 * con el y ocupa sitio. Quien no entro con Discord no necesita un campo
 * vacio, necesita el boton para entrar.
 */
function CampoDiscord({
  profile,
  update,
}: {
  profile: Profile;
  update: (p: Partial<Profile>) => void;
}) {
  const idSesion = useIdDiscordDeLaSesion();
  const id = profile.discordId || idSesion;
  const { presencia, error, cargando } = useDiscord(id, !!id);
  const { enlazarDiscord } = useAuth();
  const { toast } = useToast();
  const [enlazando, setEnlazando] = useState(false);

  // Sin Discord en la cuenta, lo unico util es ofrecerselo.
  if (!id) {
    return (
      <Campo label="Discord">
        <p className="f__d" style={{ marginTop: 0 }}>
          Conecta tu cuenta y el widget se llena solo: tu nombre, tu estado y
          lo que estés haciendo, en vivo.
        </p>
        <button
          type="button"
          className="btn btn--sm btn--prov"
          disabled={enlazando}
          onClick={async () => {
            setEnlazando(true);
            try {
              await enlazarDiscord('/dashboard');
            } catch (e) {
              setEnlazando(false);
              toast(
                e instanceof Error ? e.message : 'No se pudo conectar con Discord',
                true,
              );
            }
          }}
        >
          {enlazando ? 'Abriendo Discord…' : 'Iniciar sesión con Discord'}
        </button>
      </Campo>
    );
  }

  return (
    <Campo label="Tu cuenta de Discord" valor={presencia ? 'conectado' : undefined}>
      {cargando && !presencia && <p className="f__d" style={{ marginTop: 0 }}>Conectando…</p>}

      {presencia && (
        <p className="f__d" style={{ marginTop: 0 }}>
          <b>{presencia.mostrar || presencia.usuario}</b> · {presencia.actividad}
          {presencia.decoracion ? ' · con decoración' : ''}
        </p>
      )}

      {error === 'sin-lanyard' && (
        <div className="drop__err" role="alert">
          <p style={{ margin: 0 }}>
            Falta un paso: la presencia se lee de Lanyard, y Lanyard sólo
            publica la de quien está en su servidor.
          </p>
          <a
            className="btn btn--sm btn--ghost dc__unir"
            href="https://discord.gg/lanyard"
            target="_blank"
            rel="noopener noreferrer"
          >
            Entrar en el servidor de Lanyard ↗
          </a>
          <p className="f__d" style={{ margin: 0 }}>
            Se abre en otra pestaña. Entra y vuelve: esto se conecta solo, sin
            recargar.
          </p>
        </div>
      )}

      {error === 'sin-conexion' && (
        <p className="drop__err" role="alert">
          No se pudo conectar con Lanyard. Puede ser cosa suya; inténtalo en un
          rato.
        </p>
      )}

      {/* Guardar el id sólo cuando ya no está: viene de la sesión, y el
          perfil público no tiene sesión de la que sacarlo. */}
      {!profile.discordId && idSesion ? <GuardarId id={idSesion} update={update} /> : null}
    </Campo>
  );
}

/** Fija el id en el perfil en cuanto se sabe, sin que nadie lo pulse. */
function GuardarId({
  id,
  update,
}: {
  id: string;
  update: (p: Partial<Profile>) => void;
}) {
  useEffect(() => {
    update({ discordId: id });
  }, [id, update]);
  return null;
}

/**
 * Editor de un bloque suelto.
 *
 * No sabe nada de bloques concretos: pinta los controles que su definición
 * declara. Añadir un control a un bloque es tocar `data/bloques.ts`, no este
 * archivo; y añadir un tipo de control nuevo es tocar solo el `switch`.
 */
export function EditorBloque({ def, profile, onVolver, update }: EditorBloqueProps) {
  const estilo: BlockStyle = profile.bstyle?.[def.id] ?? {};
  const ocultos = profile.blocksOff ?? [];
  const visible = !ocultos.includes(def.id);

  /** Escribe una sola clave del estilo del bloque, sin pisar el resto. */
  const setEstilo = (k: keyof BlockStyle, v: unknown) =>
    update({
      bstyle: {
        ...(profile.bstyle ?? {}),
        [def.id]: { ...estilo, [k]: v },
      },
    });

  const setVisible = (v: boolean) =>
    update({
      blocksOff: v ? ocultos.filter((x) => x !== def.id) : [...ocultos, def.id],
    });

  function control(id: ControlId) {
    switch (id) {
      case 'visible':
        return (
          <Interruptor
            key={id}
            label={`Mostrar ${def.nombre.toLowerCase()}`}
            on={visible}
            onChange={setVisible}
          />
        );

      case 'texto': {
        const campo = def.campoTexto;
        if (!campo) return null;
        const largo = campo === 'bio' || campo === 'about';
        return (
          <Campo key={id} label={ETIQUETA_TEXTO[campo] ?? 'Texto'}>
            {largo ? (
              <textarea
                className="ta"
                rows={3}
                value={(profile[campo] as string) || ''}
                onChange={(e) => update({ [campo]: e.target.value } as Partial<Profile>)}
              />
            ) : (
              <input
                type="text"
                className="inp"
                value={(profile[campo] as string) || ''}
                onChange={(e) =>
                  update({
                    [campo]:
                      campo === 'username'
                        ? e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
                        : e.target.value,
                  } as Partial<Profile>)
                }
              />
            )}
          </Campo>
        );
      }

      case 'fuente':
        return (
          <Campo key={id} label="Fuente">
            <select
              className="sel"
              value={estilo.font || ''}
              onChange={(e) => setEstilo('font', e.target.value)}
            >
              <option value="">La del perfil</option>
              {/* Dos grupos: 37 nombres en una lista plana no se
                  recorren, y las decorativas son otra intención. */}
              <optgroup label="De texto">
                {FONTS.filter((f) => f.grupo !== 'deco').map((f) => (
                  <option key={f.id} value={f.id} style={{ fontFamily: f.stack }}>
                    {f.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Decorativas">
                {FONTS.filter((f) => f.grupo === 'deco').map((f) => (
                  <option key={f.id} value={f.id} style={{ fontFamily: f.stack }}>
                    {f.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </Campo>
        );

      case 'caso':
        return (
          <Campo key={id} label="Caja del texto">
            <Pastillas
              opciones={CASOS}
              value={(estilo.case || 'none') as (typeof CASOS)[number]['id']}
              onChange={(v) => setEstilo('case', v)}
            />
          </Campo>
        );

      case 'tamano':
        return (
          <Deslizador
            key={id}
            label="Tamaño del texto"
            sufijo="%"
            min={50}
            max={250}
            step={5}
            value={estilo.size ?? 100}
            onChange={(v) => setEstilo('size', v)}
          />
        );

      case 'espaciado':
        return (
          <Deslizador
            key={id}
            label="Espaciado entre letras"
            sufijo="%"
            min={-20}
            max={60}
            value={estilo.lsp ?? 0}
            onChange={(v) => setEstilo('lsp', v)}
          />
        );

      case 'color':
        return (
          <ColorRGB
            key={id}
            label="Color del texto"
            value={estilo.color || ''}
            porDefecto="#FFFFFF"
            onChange={(hex) => setEstilo('color', hex)}
          />
        );

      case 'halo':
        return (
          <div key={id}>
            <Interruptor
              label="Resplandor"
              desc="Sigue la silueta del contenido, no la caja"
              on={!!estilo.halo}
              onChange={(v) => setEstilo('halo', v ? profile.accent || '#A855F7' : '')}
            />
            {estilo.halo && (
              <>
                <ColorRGB
                  label="Color del halo"
                  value={estilo.halo}
                  porDefecto={profile.accent || '#A855F7'}
                  onChange={(hex) => setEstilo('halo', hex)}
                />
                <Deslizador
                  label="Intensidad del resplandor"
                  desc="100 % es el de siempre"
                  sufijo="%"
                  min={0}
                  max={200}
                  step={5}
                  value={estilo.hi ?? 100}
                  onChange={(v) => setEstilo('hi', v)}
                />
              </>
            )}
          </div>
        );

      case 'superficie':
        return (
          <Campo key={id} label="Caja del bloque">
            <Pastillas
              opciones={BLOCK_SURFACES}
              value={estilo.s || 'inherit'}
              onChange={(v) => setEstilo('s', v)}
            />
          </Campo>
        );

      case 'animacion':
        return (
          <PanelAnimacion
            key={id}
            destino={`[data-bloque="${def.id}"]`}
            catalogo={BLOCK_ANIMS}
            queEs="esta pieza"
            estilo={estilo}
            set={(k, v) => setEstilo(k as keyof BlockStyle, v)}
          />
        );

      case 'marcoDiscord':
        return <MarcoDiscord key={id} profile={profile} update={update} />;

      case 'discordId':
        return <CampoDiscord key={id} profile={profile} update={update} />;

      case 'heredarCaja': {
        /**
         * Copia los ajustes de la superficie del perfil a esta pieza.
         *
         * «Del perfil» en el selector de arriba significa NO tener caja
         * propia: la pieza se deja llevar por el estilo de bloque general.
         * Esto es otra cosa: le da caja propia y la deja igual que la
         * tarjeta —mismo tipo, misma opacidad, mismo borde, mismo
         * desenfoque— para poder retocarla desde ahí sin partir de cero.
         */
        const superficie = profile.surface || 'glass';
        if (superficie === 'none') return null;

        const heredar = () =>
          update({
            bstyle: {
              ...(profile.bstyle ?? {}),
              [def.id]: {
                ...estilo,
                s: superficie,
                op: profile.sOpacity ?? undefined,
                bd: profile.sBorderOn === false ? 0 : (profile.sBorder ?? undefined),
                blur: profile.sBlur ?? undefined,
                glow: profile.sGlow ?? undefined,
                rad: profile.radius ?? undefined,
              },
            },
          });

        const yaIgual =
          estilo.s === superficie &&
          (estilo.op ?? null) === (profile.sOpacity ?? null) &&
          (estilo.blur ?? null) === (profile.sBlur ?? null);

        return (
          <Campo key={id} label="Heredar estilo de superficie">
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              disabled={yaIgual}
              onClick={heredar}
            >
              {yaIgual ? 'Ya es igual que la tarjeta' : 'Copiar el de la tarjeta'}
            </button>
            <p className="f__d">
              Le da caja propia con los mismos ajustes que la superficie del
              perfil. Desde ahí puedes retocarla.
            </p>
          </Campo>
        );
      }

      case 'anim':
        return (
          <Campo key={id} label="Animación de entrada">
            <Pastillas
              opciones={BLOCK_ANIMS}
              value={estilo.anim || ''}
              onChange={(v) => setEstilo('anim', v)}
            />
          </Campo>
        );

      case 'relleno':
        return (
          <Deslizador
            key={id}
            label="Relleno"
            sufijo="px"
            min={0}
            max={60}
            value={estilo.pad ?? 14}
            onChange={(v) => setEstilo('pad', v)}
          />
        );

      case 'radio':
        return (
          <Deslizador
            key={id}
            label="Radio de esquinas"
            sufijo="px"
            min={0}
            max={40}
            value={estilo.rad ?? 12}
            onChange={(v) => setEstilo('rad', v)}
          />
        );

      case 'ancho':
        // Con la rejilla libre el ancho lo fija la posición del lienzo, que
        // se escribe arrastrando. Si este control siguiera escribiendo en el
        // estilo, movería un valor que el lienzo pisa: el deslizador parecía
        // roto. Aquí los dos mandos son el mismo.
        return modoLibre ? (
          <Deslizador
            key={id}
            label="Ancho"
            desc="El mismo que el tirador de la vista previa"
            sufijo="%"
            min={5}
            max={100}
            value={Math.round(profile.pos?.[def.id]?.w ?? 100)}
            onChange={(v) =>
              update({
                pos: {
                  ...(profile.pos ?? {}),
                  [def.id]: {
                    ...(profile.pos?.[def.id] ?? { col: 1, span: 12, align: 'stretch' as const }),
                    w: v,
                  },
                },
              })
            }
          />
        ) : (
          <Deslizador
            key={id}
            label="Ancho"
            sufijo="%"
            min={20}
            max={100}
            value={estilo.w ?? 100}
            onChange={(v) => setEstilo('w', v)}
          />
        );

      case 'opacidad':
      case 'borde':
        return (
          <Deslizador
            key={id}
            label={id === 'borde' ? 'Borde' : 'Opacidad'}
            sufijo="%"
            min={0}
            max={100}
            value={(id === 'borde' ? estilo.bd : estilo.op) ?? (id === 'borde' ? 18 : 100)}
            onChange={(v) => setEstilo(id === 'borde' ? 'bd' : 'op', v)}
          />
        );

      case 'desenfoque':
        return (
          <Deslizador
            key={id}
            label="Desenfoque"
            sufijo="px"
            min={0}
            max={40}
            value={estilo.blur ?? 18}
            onChange={(v) => setEstilo('blur', v)}
          />
        );

      case 'brillo':
        return (
          <Deslizador
            key={id}
            label="Intensidad del halo de la caja"
            min={0}
            max={100}
            value={estilo.glow ?? 40}
            onChange={(v) => setEstilo('glow', v)}
          />
        );

      case 'alinear':
        return (
          <Campo key={id} label="Alineación">
            <Pastillas
              opciones={ALINEACIONES}
              value={(estilo.align || '') as (typeof ALINEACIONES)[number]['id']}
              onChange={(v) => setEstilo('align', estilo.align === v ? '' : v)}
            />
          </Campo>
        );

      case 'enlaceMusica': {
        const audio = profile.audio;
        return (
          <Campo key={id} label="Enlace de YouTube" valor={audio?.yt ? `ID ${audio.yt}` : undefined}>
            <input
              type="url"
              className="inp"
              placeholder="https://www.youtube.com/watch?v=…"
              value={audio?.ytUrl || ''}
              onChange={(e) => {
                const url = e.target.value;
                // `yt` guarda el ID, no la URL: el validador recorta ese campo
                // a 20 caracteres y una URL entera se guardaba corrupta. Y sin
                // src:'youtube' el reproductor no sonaba.
                const ytId = idYouTube(url);
                update({
                  audio: {
                    provider: 'youtube',
                    title: '',
                    artist: '',
                    cover: '',
                    tracks: [],
                    ...(audio ?? {}),
                    yt: ytId,
                    ytUrl: url,
                    src: ytId ? 'youtube' : 'manual',
                  },
                });
              }}
            />
            {!!audio?.ytUrl && !audio?.yt && (
              <p className="drop__err" role="alert">
                No reconozco ese enlace de YouTube.
              </p>
            )}
          </Campo>
        );
      }

      case 'portadaMusica': {
        // `cover` estaba en el modelo y el reproductor ya lo pintaba, pero no
        // habia forma de ponerlo: la pista salia siempre con el hueco vacio.
        const audio = profile.audio;
        return (
          <SubirMedio
            key={id}
            titulo="Portada"
            destino="portada"
            lado={512}
            maxAnimadoMB={2}
            value={audio?.cover || ''}
            onChange={(r) =>
              update({
                audio: {
                  provider: 'youtube',
                  src: 'manual',
                  title: '',
                  artist: '',
                  yt: '',
                  ytUrl: '',
                  tracks: [],
                  ...(audio ?? {}),
                  cover: r.url,
                },
              })
            }
          />
        );
      }

      case 'estiloRedes':
        return (
          <Campo key={id} label="Estilo de los iconos">
            <Pastillas
              opciones={SOCIAL_STYLES}
              value={profile.socialStyle || 'icons'}
              onChange={(v) => update({ socialStyle: v })}
            />
          </Campo>
        );

      case 'estiloInsignias':
        return (
          <Campo key={id} label="Estilo de las insignias">
            <Pastillas
              opciones={BADGE_STYLES}
              value={profile.badgeStyle || 'icons'}
              onChange={(v) => update({ badgeStyle: v })}
            />
          </Campo>
        );

      case 'formaAvatar':
        return (
          <Campo key={id} label="Forma">
            <Pastillas
              opciones={AV_SHAPES}
              value={profile.avShape || 'circle'}
              onChange={(v) => update({ avShape: v })}
            />
          </Campo>
        );

      case 'posAvatar':
        return (
          <Campo key={id} label="Dónde va">
            <Pastillas
              opciones={AV_POS}
              value={profile.avPos || 'center'}
              onChange={(v) => update({ avPos: v })}
            />
          </Campo>
        );

      case 'centrar': {
        // Centrar a ojo con el ratón no sale nunca exacto. El centro es
        // aritmética: la pieza ocupa `w` por ciento, así que sobra
        // (100 - w) y la mitad va a cada lado.
        const posActual = profile.pos?.[def.id];
        const ancho = posActual?.w ?? 100;
        const xCentro = Math.round(((100 - ancho) / 2) * 10) / 10;
        const centrada = Math.abs((posActual?.x ?? 0) - xCentro) < 0.6;
        return (
          <Campo key={id} label="Centrar en la superficie">
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              disabled={centrada}
              onClick={() =>
                update({
                  pos: {
                    ...(profile.pos ?? {}),
                    [def.id]: {
                      ...(posActual ?? { col: 1, span: 12, align: 'stretch' as const }),
                      x: xCentro,
                    },
                  },
                })
              }
            >
              {centrada ? 'Ya está centrada' : `Centrar (x = ${xCentro}%)`}
            </button>
          </Campo>
        );
      }

      case 'monoRedes':
        // `monoIcons` estaba en el perfil, en el validador y en el CSS desde
        // la migración, pero sin un solo control en el editor: era una
        // opción que existía y nadie podía tocar.
        return (
          <Interruptor
            key={id}
            label="Iconos en monocromo"
            desc="Apagado, cada logo va en el color de su marca"
            on={profile.monoIcons === true}
            onChange={(v) => update({ monoIcons: v })}
          />
        );

      case 'listaRedes':
        return <MuestraRedes key={id} profile={profile} />;

      case 'listaInsignias':
        return <MuestraInsignias key={id} profile={profile} />;

      case 'margen':
        return (
          <Deslizador
            key={id}
            label="Margen superior"
            sufijo="px"
            min={0}
            max={120}
            value={estilo.mt ?? 0}
            onChange={(v) => setEstilo('mt', v)}
          />
        );

      default:
        return null;
    }
  }

  /**
   * Los controles de la caja solo tienen sentido si hay caja. Con
   * "Del perfil" o "Sin caja" no hay nada que rellenar ni redondear.
   */
  const modoLibre = (profile.layoutMode || 'stack') === 'free';
  const hayCaja = !!estilo.s && estilo.s !== 'inherit' && estilo.s !== 'none';
  const dependeDeCaja: ControlId[] = [
    'relleno',
    'radio',
    // `ancho` no está aquí: con la rejilla libre mide la pieza entera, haya
    // caja o no, y esconderlo dejaba sin control de tamaño a los bloques de
    // texto suelto, que son justo los que más se recolocan.
    'borde',
    'desenfoque',
    'brillo',
    'opacidad',
  ];
  if (!modoLibre) dependeDeCaja.push('ancho');

  /**
   * Con la rejilla libre TODA pieza se coloca y se redimensiona en el lienzo,
   * tenga caja o no. Pero el ancho sólo aparecía en los bloques cuyo esquema
   * declara el grupo «Caja» — así que el nombre, la bio o las visitas se
   * podían estirar con el ratón y no tenían el mando equivalente en el
   * editor. Se les añade aquí en vez de tocar los dieciséis esquemas: es una
   * capacidad del modo, no de cada bloque.
   */
  const gruposVisibles: GrupoControles[] = modoLibre
    ? [
        ...def.grupos,
        {
          titulo: 'En el lienzo',
          // El ancho solo si su esquema no lo traía ya (los bloques con
          // grupo «Caja» lo tienen); centrar, siempre: es del modo.
          controles: def.grupos.some((g) => g.controles.includes('ancho'))
            ? ['centrar']
            : ['ancho', 'centrar'],
        },
      ]
    : def.grupos;

  return (
    <div className="dash__seccion">
      <nav className="miga">
        <button type="button" className="miga__volver" onClick={onVolver}>
          ← Bloques
        </button>
        <span className="miga__sep">›</span>
        <span className="miga__aqui">{def.nombre}</span>
      </nav>

      <h2 className="dash__h2">Editor de {def.nombre}</h2>
      <p className="dash__sub">{def.descripcion}</p>

      {gruposVisibles.map((grupo) => {
        const controles = grupo.controles.filter(
          (c) => !(dependeDeCaja.includes(c) && !hayCaja),
        );
        if (controles.length === 0) return null;
        return (
          <section className="grupo" key={grupo.titulo}>
            <h3 className="grupo__t">{grupo.titulo}</h3>
            {controles.map(control)}
          </section>
        );
      })}
    </div>
  );
}

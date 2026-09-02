import { BADGES, resolveBadges, type Badge } from '@/data/badges';

/**
 * Lo que hace falta saber de un perfil para decidir sus insignias.
 *
 * Todo esto viene del servidor. Ninguno de estos números lo escribe quien
 * edita su perfil, y esa es la diferencia con lo de antes: antes `badges`
 * era un campo más del perfil, editable, así que cualquiera podía ponerse
 * «Staff» o «Verificado» y salía en su página como si se lo hubieran dado.
 */
export interface DatosInsignias {
  /** ISO de creación de la cuenta. En el perfil viaja como `joined`. */
  creado?: string;
  /** Visitas únicas, de `perfil_metricas`. */
  vistas?: number;
  /** Nota media, o null si todavía no la ha votado nadie. */
  nota?: number | null;
  numNotas?: number;
  /** Ids concedidos por el equipo. Vienen de `insignias_concedidas`. */
  concedidas?: string[];
}

export interface EstadoInsignia {
  id: string;
  badge: Badge;
  ganada: boolean;
  /** Entre 0 y 1. Sólo significa algo en las que se calculan solas. */
  progreso: number;
  /** Lo que falta, ya redactado: «Te faltan 84 visitas». Vacío si no aplica. */
  falta: string;
}

/** Días enteros desde una fecha ISO. 0 si la fecha no vale. */
function diasDesde(iso: string | undefined): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

/**
 * El estado de todas las insignias para un perfil.
 *
 * Devuelve las diecisiete, ganadas y no ganadas. Enseñar sólo las ganadas
 * era lo que las dejaba en pegatinas: una insignia que no sabes que existe
 * no te mueve a hacer nada. Las que faltan, con lo que falta escrito al
 * lado, son la mitad útil.
 */
export function estadoInsignias(d: DatosInsignias): EstadoInsignia[] {
  /* Por el traductor de alias: la tabla de concesiones puede guardar ids
     del catalogo viejo (`top10`, `founder`), y sin traducirlos una insignia
     concedida de verdad no apareceria. */
  const concedidas = new Set(resolveBadges(d.concedidas));

  return Object.entries(BADGES).map(([id, badge]) => {
    // Las que no se calculan solas dependen enteramente del servidor.
    if (badge.fuente !== 'perfil' || !badge.meta) {
      return {
        id,
        badge,
        ganada: concedidas.has(id),
        progreso: concedidas.has(id) ? 1 : 0,
        falta: '',
      };
    }

    const meta = badge.meta;
    const llevas =
      meta.campo === 'dias'
        ? diasDesde(d.creado)
        : meta.campo === 'vistas'
          ? d.vistas ?? 0
          : d.numNotas ?? 0;

    const media = d.nota ?? 0;
    const mediaOk = meta.minMedia == null || media >= meta.minMedia;

    /* El equipo también puede concederlas a mano. Sirve para arreglar un
       caso raro sin tocar el cálculo. */
    const ganada = concedidas.has(id) || (llevas >= meta.valor && mediaOk);
    const progreso = ganada ? 1 : Math.min(1, llevas / meta.valor);

    let falta = '';
    if (!ganada) {
      const restan = Math.max(0, meta.valor - llevas);
      if (restan > 0) {
        falta = `Te ${restan === 1 ? 'falta' : 'faltan'} ${plural(
          restan,
          meta.unidad,
          meta.unidadPlural,
        )}`;
      } else if (!mediaOk) {
        // Ya hay bastantes votos, lo que falta es que suban la media.
        falta = `Tu media es ${media.toFixed(1)}; hace falta ${meta.minMedia}`;
      }
    }

    return { id, badge, ganada, progreso, falta };
  });
}

/** Sólo los ids ganados, que es lo que pinta el perfil público. */
export function insigniasGanadas(d: DatosInsignias): string[] {
  return estadoInsignias(d)
    .filter((e) => e.ganada)
    .map((e) => e.id);
}

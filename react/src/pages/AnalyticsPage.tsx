import { useState, useMemo, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useMyProfile } from '@/hooks/useProfile';
import { num } from '@/lib/utils';
import * as backend from '@/lib/backend';
import { hasBackend } from '@/lib/supabase';

type Rango = 7 | 30 | 90;

interface Datos {
  unicas: number;
  totales: number;
  nota: number | null;
  numNotas: number;
  porDia: Record<string, number>;
  ultima: string;
}

const VACIO: Datos = {
  unicas: 0,
  totales: 0,
  nota: null,
  numNotas: 0,
  porDia: {},
  ultima: '',
};

/** «hace 3 días», que es como se lee una fecha reciente. */
function haceCuanto(iso: string): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const min = Math.floor((Date.now() - t) / 60000);
  if (min < 2) return 'ahora mismo';
  if (min < 60) return `hace ${min} minutos`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} ${h === 1 ? 'hora' : 'horas'}`;
  const d = Math.floor(h / 24);
  if (d < 31) return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
  return new Date(t).toLocaleDateString();
}

/**
 * Analíticas del perfil propio.
 *
 * Todo lo de aquí viene del servidor. Antes esta página leía `localStorage`,
 * así que enseñaba las visitas contadas EN ESTE NAVEGADOR: quien entrara
 * desde el móvil veía ceros aunque tuviera mil visitas de verdad.
 */
export default function AnalyticsPage() {
  const [rango, setRango] = useState<Rango>(30);
  const { profile } = useMyProfile();
  const [datos, setDatos] = useState<Datos>(VACIO);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const lienzo = useRef<HTMLCanvasElement>(null);

  const id = profile?._id ?? '';

  useEffect(() => {
    if (!hasBackend() || !id) {
      setCargando(false);
      return;
    }
    let vivo = true;
    setCargando(true);
    setError('');
    backend
      .analiticasDe(id, rango)
      .then((d) => {
        if (vivo) setDatos(d);
      })
      .catch((e) => {
        if (vivo) setError(e instanceof Error ? e.message : 'No se pudieron cargar');
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, [id, rango]);

  const serie = useMemo(
    () =>
      Object.entries(datos.porDia)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([dia, n]) => ({ dia, n })),
    [datos.porDia],
  );

  const nuevosEnRango = useMemo(() => serie.reduce((a, x) => a + x.n, 0), [serie]);

  /* El gráfico. Canvas y no SVG porque son 90 puntos y se redibuja al
     cambiar de rango: aquí el canvas es más barato y no ensucia el DOM. */
  useEffect(() => {
    const c = lienzo.current;
    if (!c || serie.length < 2) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const caja = c.getBoundingClientRect();
    c.width = caja.width * dpr;
    c.height = caja.height * dpr;
    ctx.scale(dpr, dpr);

    const W = caja.width;
    const H = caja.height;
    ctx.clearRect(0, 0, W, H);

    const raya = getComputedStyle(document.documentElement)
      .getPropertyValue('--accent')
      .trim() || '#A855F7';
    const pad = 30;
    const anchoU = W - pad * 2;
    const altoU = H - pad * 2;
    const tope = Math.max(...serie.map((x) => x.n), 4);

    ctx.strokeStyle = 'rgba(255,255,255,.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad + (altoU / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(W - pad, y);
      ctx.stroke();
    }

    const px = (i: number) => pad + (anchoU / (serie.length - 1)) * i;
    const py = (v: number) => H - pad - (v / tope) * altoU;

    ctx.beginPath();
    serie.forEach((p, i) => (i ? ctx.lineTo(px(i), py(p.n)) : ctx.moveTo(px(i), py(p.n))));
    ctx.strokeStyle = raya;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.lineTo(W - pad, H - pad);
    ctx.lineTo(pad, H - pad);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, pad, 0, H - pad);
    grad.addColorStop(0, 'rgba(168,85,247,.22)');
    grad.addColorStop(1, 'rgba(168,85,247,0)');
    ctx.fillStyle = grad;
    ctx.fill();

    // El último punto marcado: es el dato que se mira primero.
    const fin = serie[serie.length - 1];
    if (fin) {
      ctx.beginPath();
      ctx.arc(px(serie.length - 1), py(fin.n), 3.5, 0, Math.PI * 2);
      ctx.fillStyle = raya;
      ctx.fill();
    }
  }, [serie]);

  if (!hasBackend()) {
    return (
      <div className="wrap ana__aviso">
        <h2>Las analíticas necesitan una cuenta</h2>
        <p>
          Las visitas las cuenta el servidor. Sin cuenta, el perfil vive sólo
          en este navegador y no hay nada que contar.
        </p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="wrap ana__aviso">
        <h2>Todavía no tienes perfil</h2>
        <p>Créalo en el panel y aquí aparecerán sus visitas.</p>
        <Link className="btn btn--primary" to="/dashboard">
          Ir al panel
        </Link>
      </div>
    );
  }

  return (
    <div className="wrap ana">
      <header className="ana__cab">
        <div>
          <h1 className="ana__h1">Analíticas</h1>
          <p className="ana__sub">
            Visitas de <strong>@{profile.username}</strong>
            {datos.ultima && ` · la última, ${haceCuanto(datos.ultima)}`}
          </p>
        </div>

        <div className="ana__rangos" role="group" aria-label="Período">
          {([7, 30, 90] as Rango[]).map((r) => (
            <button
              key={r}
              type="button"
              className={`btn btn--sm ${rango === r ? 'btn--primary' : 'btn--quiet'}`}
              aria-pressed={rango === r}
              onClick={() => setRango(r)}
            >
              {r} días
            </button>
          ))}
        </div>
      </header>

      {error && (
        <p className="ana__error" role="alert">
          {error}
        </p>
      )}

      <div className="ana__kpis">
        <Kpi
          t="Personas distintas"
          v={num(datos.unicas)}
          d="Visitantes únicos desde siempre"
          cargando={cargando}
        />
        <Kpi
          t="Visitas totales"
          v={num(datos.totales)}
          d="Contando las veces que alguien vuelve"
          cargando={cargando}
        />
        <Kpi
          t="Gente nueva"
          v={num(nuevosEnRango)}
          d={`Te descubrieron en los últimos ${rango} días`}
          cargando={cargando}
        />
        <Kpi
          t="Nota"
          v={datos.numNotas ? datos.nota!.toFixed(1) : '—'}
          d={
            datos.numNotas
              ? `${datos.numNotas} ${datos.numNotas === 1 ? 'voto' : 'votos'}`
              : 'Nadie ha votado todavía'
          }
          cargando={cargando}
        />
      </div>

      <div className="ana__panel">
        <div className="ana__panelCab">
          <h2 className="ana__h2">Gente nueva por día</h2>
          {/* Se dice lo que es. Antes ponia «visitas diarias», y no lo eran:
              la tabla guarda una fila por visitante, no por visita. */}
          <p className="ana__nota">
            Cada punto es cuántas personas te vieron por primera vez ese día.
            Las repeticiones cuentan en «visitas totales», no aquí.
          </p>
        </div>
        <div className="ana__grafico">
          {cargando ? (
            <div className="cargando" aria-busy="true" />
          ) : nuevosEnRango === 0 ? (
            <p className="ana__vacio">
              Todavía no hay visitas en este período. Comparte tu enlace:{' '}
              <strong>/u/{profile.username}</strong>
            </p>
          ) : (
            <canvas ref={lienzo} />
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({
  t,
  v,
  d,
  cargando,
}: {
  t: string;
  v: string;
  d: string;
  cargando: boolean;
}) {
  return (
    <div className="ana__kpi">
      <span className="ana__kpiT">{t}</span>
      <span className="ana__kpiV">{cargando ? '·' : v}</span>
      <span className="ana__kpiD">{d}</span>
    </div>
  );
}

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
  porHora: number[];
  porPais: { pais: string; n: number }[];
  sinPais: number;
  vuelven: number;
  ultima: string;
}

const VACIO: Datos = {
  unicas: 0,
  totales: 0,
  nota: null,
  numNotas: 0,
  porDia: {},
  porHora: new Array(24).fill(0),
  porPais: [],
  sinPais: 0,
  vuelven: 0,
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
  const [misPlantillas, setMisPlantillas] = useState({ plantillas: 0, usos: 0, mejor: '' });
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

  /* Las plantillas no dependen del rango: se piden una vez. */
  useEffect(() => {
    if (!hasBackend()) return;
    let vivo = true;
    backend.usosDeMisPlantillas()
      .then((r) => { if (vivo) setMisPlantillas(r); })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

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

    /* Los colores salen de la hoja. El relleno estaba escrito a mano en
       morado —`rgba(168,85,247,...)`— cuando el trazo ya venia de
       `--accent`: dos criterios distintos en el mismo grafico, y un color
       que no es de la paleta. */
    const raiz = getComputedStyle(document.documentElement);
    const tinta = raiz.getPropertyValue('--text-primary').trim() || '#F2F2F2';
    const tenue = raiz.getPropertyValue('--text-faint').trim() || '#5F5F5F';
    const linea = raiz.getPropertyValue('--border').trim() || 'rgba(255,255,255,.07)';
    const mono = raiz.getPropertyValue('--font-mono').trim() || 'monospace';

    /* Margenes asimetricos: a la izquierda cabe la cifra del eje, abajo
       la fecha, y arriba y a la derecha solo hace falta que la curva no
       toque el borde. Un margen igual en los cuatro lados desperdicia
       sitio en dos de ellos. */
    const izq = 34;
    const der = 14;
    const arr = 16;
    const aba = 26;
    const anchoU = W - izq - der;
    const altoU = H - arr - aba;
    const tope = Math.max(...serie.map((x) => x.n), 4);

    const px = (i: number) => izq + (anchoU / (serie.length - 1)) * i;
    const py = (v: number) => arr + altoU - (v / tope) * altoU;

    /* ---- rejilla y eje vertical ---- */
    ctx.font = `10px ${mono}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const y = arr + (altoU / 4) * i;
      ctx.strokeStyle = linea;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(izq, y);
      ctx.lineTo(W - der, y);
      ctx.stroke();
      /* Solo el techo y el suelo llevan cifra: cinco numeros en un
         grafico de esta altura es mas ruido que informacion, y con estos
         dos ya se sabe la escala. */
      if (i === 0 || i === 4) {
        ctx.fillStyle = tenue;
        ctx.fillText(String(i === 0 ? tope : 0), izq - 8, y);
      }
    }

    /* ---- eje horizontal: las fechas ----
       Antes no habia ninguna, asi que se veian los picos pero no CUANDO
       fueron, que es la mitad de la informacion. Se reparten cuatro o
       cinco para que no se toquen sea cual sea el rango. */
    const cada = Math.max(1, Math.round(serie.length / 5));
    ctx.textAlign = 'center';
    ctx.fillStyle = tenue;
    serie.forEach((p, i) => {
      if (i % cada !== 0 && i !== serie.length - 1) return;
      const x = px(i);
      if (x < izq + 14 || x > W - der - 14) return;
      const d = new Date(p.dia + 'T00:00:00');
      ctx.fillText(
        d.toLocaleDateString('es', { day: 'numeric', month: 'short' }).replace('.', ''),
        x,
        H - aba / 2,
      );
    });

    /* ---- la curva ----
       Suave, con una cuadratica por cada par de puntos pasando por su
       punto medio. Con lineas rectas, un dato aislado se veia como un
       pico de aguja; asi se lee como una tendencia, que es lo que es. */
    const curva = () => {
      ctx.beginPath();
      ctx.moveTo(px(0), py(serie[0]?.n ?? 0));
      for (let i = 1; i < serie.length; i++) {
        const x0 = px(i - 1);
        const y0 = py(serie[i - 1]?.n ?? 0);
        const x1 = px(i);
        const y1 = py(serie[i]?.n ?? 0);
        ctx.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      }
      ctx.lineTo(px(serie.length - 1), py(serie[serie.length - 1]?.n ?? 0));
    };

    curva();
    ctx.lineTo(W - der, arr + altoU);
    ctx.lineTo(izq, arr + altoU);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, arr, 0, arr + altoU);
    grad.addColorStop(0, 'rgba(255,255,255,.14)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fill();

    curva();
    ctx.strokeStyle = tinta;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // El último punto marcado: es el dato que se mira primero.
    const fin = serie[serie.length - 1];
    if (fin) {
      const x = px(serie.length - 1);
      const y = py(fin.n);
      /* Un cerco del color del panel para que el punto se despegue de la
         curva en vez de fundirse con ella. */
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = raiz.getPropertyValue('--surface').trim() || '#0E0E0E';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = tinta;
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
        {/* «Gente nueva» salia aqui Y era el grafico entero de abajo: el
            mismo dato dos veces. En su sitio va el que no estaba en
            ninguna parte y es el que de verdad dice algo de un perfil:
            cuanta de esa gente ha vuelto. Una visita es que te vieron;
            volver es que les intereso. */}
        <Kpi
          t="Han vuelto"
          v={cargando ? '·' : `${num(datos.vuelven)}`}
          d={
            nuevosEnRango === 0
              ? 'Sin visitas todavía en este período'
              : `de ${num(nuevosEnRango)} que te descubrieron · ${Math.round((datos.vuelven / nuevosEnRango) * 100)}%`
          }
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

      {/* Los tres de abajo, en rejilla y no apilados. Cada uno ocupaba el
          ancho entero para enseñar contenido de un palmo: la lista de
          paises son cuatro renglones y las plantillas son un numero.
          Puestos en columnas, la pagina cabe de una vez en pantalla en
          vez de pedir tres pantallazos de desplazamiento. */}
      <div className="ana__rej">
      {/* A que hora te descubren. Es lo unico accionable de esta pagina:
          todo lo demas cuenta lo que ya paso; esto dice cuando compartir
          el enlace la proxima vez. */}
      {nuevosEnRango > 0 && (
        <div className="ana__panel ana__panel--ancho">
          <div className="ana__panelCab">
            <h2 className="ana__h2">A qué hora te descubren</h2>
            <p className="ana__nota">
              Cuándo llegó cada persona que te vio por primera vez. La hora es
              la de tu reloj, no la de quien te visita: de dónde entran no se
              guarda.
            </p>
          </div>
          <Horas datos={datos.porHora} />
        </div>
      )}

      {/* De donde te ven. Lo que se guarda son DOS LETRAS por visita, y
          la IP se sigue tirando despues de hashear al visitante: el pais
          lo pone Cloudflare en una cabecera, asi que no hay que mirar la
          IP para saberlo ni mandarsela a ningun servicio de nadie. */}
      {(datos.porPais.length > 0 || datos.sinPais > 0) && (
        <div className="ana__panel">
          <div className="ana__panelCab">
            <h2 className="ana__h2">De dónde te ven</h2>
            <p className="ana__nota">
              {datos.porPais.length > 0
                ? 'Sólo el país, nunca la ciudad ni la dirección de nadie.'
                : 'Sólo el país, nunca la ciudad ni la dirección de nadie. Se empezó a guardar hace poco: las próximas visitas ya lo traerán.'}
            </p>
          </div>
          <Paises lista={datos.porPais} sin={datos.sinPais} />
        </div>
      )}

      {/* Lo unico aqui que no habla de visitas, y por eso vale la pena: una
          visita dice que te vieron, un uso dice que a alguien le gusto tu
          diseño lo bastante como para ponerselo. */}
      {misPlantillas.plantillas > 0 && (
        /* A todo el ancho: su contenido es un numero y un boton en una
           fila, asi que en una columna de un tercio dejaba la otra mitad
           de la fila vacia. Como banda llena el hueco y ademas cierra la
           pagina, que es donde le toca. */
        <div className="ana__panel ana__panel--tira">
          <div className="ana__panelCab">
            <h2 className="ana__h2">Tus plantillas</h2>
            <p className="ana__nota">
              {misPlantillas.plantillas === 1
                ? 'Has publicado una plantilla.'
                : `Has publicado ${misPlantillas.plantillas} plantillas.`}{' '}
              {misPlantillas.usos === 0
                ? 'Todavía no las ha usado nadie.'
                : `Se han aplicado ${num(misPlantillas.usos)} ${misPlantillas.usos === 1 ? 'vez' : 'veces'}.`}
            </p>
          </div>
          <div className="ana__plt">
            <div className="ana__pltN">
              <span className="ana__kpiV">{num(misPlantillas.usos)}</span>
              <span className="ana__kpiD">
                {misPlantillas.usos === 1 ? 'uso en total' : 'usos en total'}
              </span>
            </div>
            {misPlantillas.mejor && (
              <p className="ana__nota">
                La más usada es <strong>«{misPlantillas.mejor}»</strong>.
              </p>
            )}
            <Link className="btn btn--ghost btn--sm" to="/templates">
              Ver la biblioteca
            </Link>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

/* «CO» -> «Colombia». Lo trae el navegador; una tabla de doscientos
   paises escrita a mano seria doscientas cosas que mantener y traducir.
   Si un navegador viejo no lo tiene, se queda el codigo, que se entiende
   igual. */
const NOMBRES = (() => {
  try {
    return new Intl.DisplayNames(['es'], { type: 'region' });
  } catch {
    return null;
  }
})();

/* «CO» -> 🇨🇴. Las dos letras corren 127397 posiciones y caen en los
   indicadores regionales, que el sistema junta en una bandera. No es un
   adorno de color: es lo que hace que una lista de paises se lea de un
   vistazo sin leerla. */
function bandera(cc: string) {
  return String.fromCodePoint(...[...cc].map((c) => 127397 + c.charCodeAt(0)));
}

function Paises({ lista, sin }: { lista: { pais: string; n: number }[]; sin: number }) {
  const tope = Math.max(1, ...lista.map((x) => x.n));
  return (
    <div className="ana__paises">
      {/* Sin paises todavia no se dice nada aqui: la explicacion de arriba
          ya lo cuenta, y repetirlo era gastar un panel entero en decir dos
          veces que no hay nada. */}
      {lista.length === 0 ? null : (
        <ol className="ana__paisL">
          {/* Ocho y basta: una lista de cuarenta paises con una visita cada
              uno no se lee, y los que importan son los de arriba. */}
          {lista.slice(0, 8).map(({ pais, n }) => (
            <li className="ana__pais" key={pais}>
              <span className="ana__paisB" aria-hidden="true">{bandera(pais)}</span>
              <span className="ana__paisN">{NOMBRES?.of(pais) ?? pais}</span>
              <span className="ana__paisBar" aria-hidden="true">
                <i style={{ width: `${Math.max(4, (n / tope) * 100)}%` }} />
              </span>
              <span className="ana__paisC">{n}</span>
            </li>
          ))}
        </ol>
      )}

      {sin > 0 && (
        <p className="ana__nota ana__paisSin">
          {sin === 1
            ? 'Una visita más, de antes de que esto se guardara.'
            : `${num(sin)} visitas más, de antes de que esto se guardara.`}
        </p>
      )}
    </div>
  );
}

/**
 * Las 24 horas, en barras.
 *
 * Sin biblioteca de graficos y sin canvas: son 24 numeros y un `div` por
 * hora los dibuja igual de bien. La altura sale del mayor, asi que la
 * forma se lee aunque los numeros sean pequeños —con 11 visitas, escalar
 * contra un maximo fijo dejaria 24 rayas planas—.
 */
function Horas({ datos }: { datos: number[] }) {
  const tope = Math.max(1, ...datos);
  return (
    <div className="ana__horas">
      <div className="ana__horasG">
        {datos.map((n, h) => (
          <div
            key={h}
            className={`ana__hora${n ? ' on' : ''}`}
            style={{ height: `${Math.max(n ? 8 : 2, (n / tope) * 100)}%` }}
            title={`${String(h).padStart(2, '0')}:00 · ${n} ${n === 1 ? 'persona' : 'personas'}`}
          />
        ))}
      </div>
      <div className="ana__horasEje" aria-hidden="true">
        <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
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

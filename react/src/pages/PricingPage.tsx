import '@/styles/panels.css';
import { Link } from 'react-router-dom';
import { useTitulo } from '@/hooks/useTitulo';
import { CUENTA_FUENTES } from '@/data/premium';

/**
 * Los planes.
 *
 * Esta pagina decia cosas que el producto no hacia, y no una ni dos:
 *
 *   · Gratis prometia «efectos de particulas y 3D tilt» — las dos se pagan.
 *   · Pro vendia «analiticas completas (90 dias)» frente a «basicas (30)»:
 *     `analiticasDe()` tiene un solo valor, 30, y no mira el plan.
 *   · Pro vendia «prioridad en el ranking», que no existe — y que ademas no
 *     deberia existir: un top que se compra deja de valer para todos.
 *   · Pro vendia «widget de musica de Spotify», que es gratis.
 *   · Habia un tercer plan, «Creator», con verificacion oficial, quitar una
 *     marca de agua que no existe, y publicar plantillas —que ya puede
 *     hacer cualquiera—. El codigo tiene UN booleano: `tienePlan()`, que
 *     lee la insignia del diamante. No hay un segundo nivel que dar.
 *
 * Vender lo que no se entrega no es un descuido de copia: es lo primero que
 * mira quien paga y no recibe. Ahora esta lista es exactamente lo que
 * `data/premium.ts` bloquea, ni una linea mas.
 */
const PLANS = [
  {
    id: 'free',
    name: 'Gratis',
    price: '$0',
    period: 'para siempre',
    desc: 'Un perfil completo, tuyo y presentable. Sin recortes tontos.',
    features: [
      'Tu dirección: sharee.fun/tu-nombre',
      'Las cinco plantillas y toda la galería de la comunidad',
      'Todas tus redes y tus enlaces, sin limite',
      `${CUENTA_FUENTES.libres} tipografías, con su tamaño, sus mayúsculas y su espaciado`,
      'El color de cada pieza, y dónde se coloca cada una',
      'La caja de cada pieza: tipo, relleno, esquinas, ancho y borde',
      'Avatar y fondo de imagen, con desenfoque y viñeta',
      'Cinco punteros, y música en tu perfil',
      'Widget de Discord en vivo',
      'Tus analíticas: visitas, países, horas y clics',
    ],
    cta: 'Empezar gratis',
    highlight: false,
  },
  {
    id: 'pro',
    name: 'Premium',
    price: '$4.99',
    period: 'pago único, para siempre',
    desc: 'Para que tu perfil no se parezca al de nadie.',
    features: [
      'Todo lo del plan Gratis',
      'La insignia del diamante',
      'Rejilla libre: coloca cada pieza donde quieras, arrastrándola',
      `${CUENTA_FUENTES.pro} tipografías decorativas`,
      'Resplandor en el nombre, el @usuario, las insignias, las redes y el avatar',
      'Barrido de luz y degradado en el nombre',
      'Animación de entrada del perfil',
      'Partículas de fondo',
      'Fondo de vídeo',
      'Tu propia imagen de cursor, con estela',
      'Inclinación 3D de la tarjeta',
    ],
    cta: 'Conseguir Premium',
    highlight: true,
  },
];

export default function PricingPage() {
  useTitulo('Planes · sharee');
  return (
    <div className="pricing-page wrap" style={{ paddingTop: '40px', paddingBottom: '80px' }}>
      <header style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto 48px' }}>
        <h1 style={{ fontSize: 'var(--tf-page)', marginBottom: '12px' }}>Precios simples y transparentes</h1>
        <p className="t-meta" style={{ fontSize: 'var(--t4)' }}>
          Sin suscripciones mensuales recurrentes que se olvidan. Pagas una sola vez y lo tienes para siempre.
        </p>
      </header>

      {/* Plans Grid */}
      <p
        style={{
          margin: '0 auto 28px',
          maxWidth: '58ch',
          textAlign: 'center',
          padding: '12px 16px',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--surface-2)',
          color: 'var(--text-secondary)',
          fontSize: 'var(--t3)',
          lineHeight: 1.6,
        }}
      >
        Todavía no hay forma de pagar esto. El diamante lo concede el equipo
        a mano, así que <strong>por ahora Premium no se puede comprar</strong>:
        la lista de la derecha es lo que traerá cuando se abra.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', alignItems: 'stretch' }}>
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className="panel"
            style={{
              padding: '36px 28px',
              borderRadius: '20px',
              background: plan.highlight
                ? 'linear-gradient(180deg, rgba(168, 85, 247, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%)'
                : 'var(--card-bg, rgba(255, 255, 255, 0.03))',
              border: plan.highlight
                ? '2px solid var(--p-primary, #A855F7)'
                : '1px solid var(--border, rgba(255, 255, 255, 0.08))',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
            }}
          >
            {plan.highlight && (
              <span
                style={{
                  position: 'absolute',
                  top: '-12px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'var(--p-primary, #A855F7)',
                  color: '#fff',
                  fontSize: 'var(--t2)',
                  fontWeight: 700,
                  padding: '4px 12px',
                  borderRadius: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Más popular
              </span>
            )}

            <div>
              <h3 style={{ fontSize: 'var(--t5)', marginBottom: '8px' }}>{plan.name}</h3>
              <p className="t-meta" style={{ fontSize: 'var(--t3)', minHeight: '40px' }}>{plan.desc}</p>

              <div style={{ margin: '24px 0' }}>
                <span style={{ fontSize: 'var(--tf-page)', fontWeight: 800 }}>{plan.price}</span>
                <span className="t-meta" style={{ display: 'block', fontSize: 'var(--t3)' }}>{plan.period}</span>
              </div>

              <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '24px', marginBottom: '24px' }}>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px', fontSize: 'var(--t3)' }}>
                  {plan.features.map((feat, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ color: 'var(--p-primary, #A855F7)', fontWeight: 700 }}>✓</span>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {plan.id === 'free' ? (
              <Link
                to="/dashboard"
                className="btn btn--primary"
                style={{ width: '100%', textAlign: 'center', padding: '12px' }}
              >
                {plan.cta}
              </Link>
            ) : (
              /* No hay cobro conectado. Antes este boton decia «Obtener Pro»
                 y llevaba al panel: quien lo pulsaba se quedaba esperando
                 una pantalla de pago que no existe. */
              <button
                type="button"
                className="btn btn--quiet"
                disabled
                style={{ width: '100%', padding: '12px' }}
              >
                Todavía no está a la venta
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

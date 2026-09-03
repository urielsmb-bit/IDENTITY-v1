import { Link } from 'react-router-dom';

const PLANS = [
  {
    id: 'free',
    name: 'Gratis',
    price: '$0',
    period: 'para siempre',
    desc: 'Todo lo esencial para crear tu identidad digital.',
    features: [
      'Perfil personalizado @tu-nombre',
      '14 temas prediseñados',
      'Enlaces a redes sociales ilimitados',
      'Efectos de partículas y 3D tilt',
      'Analíticas básicas (30 días)',
      'Subida de avatar e imágenes',
    ],
    cta: 'Comenzar gratis',
    highlight: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$4.99',
    period: 'pago único de por vida',
    desc: 'Para creadores y desarrolladores que quieren destacar.',
    features: [
      'Todo lo del plan Gratis',
      'Badge exclusivo "Premium 💎"',
      'Fondos de video MP4/WebM de hasta 64MB',
      'Efectos de cursor avanzados y halo interactivo',
      'Analíticas completas (90 días)',
      'Widget de música de Spotify e integraciones',
      'Prioridad en el directorio de Descubrir',
    ],
    cta: 'Obtener Pro',
    highlight: true,
  },
  {
    id: 'creator',
    name: 'Creator',
    price: '$12.99',
    period: 'pago único de por vida',
    desc: 'El control total de tu marca personal y presencia web.',
    features: [
      'Todo lo del plan Pro',
      'Badge exclusivo "Founder 👑"',
      'Verificación oficial de identidad',
      'Publicación de plantillas en el marketplace',
      'Sin marca de agua IDENTITY en pie de página',
      'Soporte prioritario 24/7',
    ],
    cta: 'Obtener Creator',
    highlight: false,
  },
];

export default function PricingPage() {
  return (
    <div className="pricing-page wrap" style={{ paddingTop: '40px', paddingBottom: '80px' }}>
      <header style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto 48px' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '12px' }}>Precios simples y transparentes</h1>
        <p className="t-meta" style={{ fontSize: '1.15rem' }}>
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
          fontSize: '.9rem',
          lineHeight: 1.6,
        }}
      >
        Los planes de pago todavía no están abiertos. Mientras tanto{' '}
        <strong>todo lo de esta página funciona sin pagar nada</strong>: no hay
        nada bloqueado.
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
                  fontSize: '0.75rem',
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
              <h3 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>{plan.name}</h3>
              <p className="t-meta" style={{ fontSize: '0.9rem', minHeight: '40px' }}>{plan.desc}</p>

              <div style={{ margin: '24px 0' }}>
                <span style={{ fontSize: '3rem', fontWeight: 800 }}>{plan.price}</span>
                <span className="t-meta" style={{ display: 'block', fontSize: '0.85rem' }}>{plan.period}</span>
              </div>

              <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '24px', marginBottom: '24px' }}>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem' }}>
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

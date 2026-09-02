import { useState, useMemo, useRef, useEffect } from 'react';
import { useProfileStore, getStats } from '@/stores/profileStore';
import { num } from '@/lib/utils';

type Range = 7 | 30 | 90;

export default function AnalyticsPage() {
  const [range, setRange] = useState<Range>(30);
  const mine = useProfileStore((s) => s.mineName ? s.profiles[s.mineName] : undefined);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const stats = useMemo(() => {
    if (!mine?.username) return {};
    return getStats(mine.username, range);
  }, [mine?.username, range]);

  const totalViewsInRange = useMemo(() => {
    return Object.values(stats).reduce((acc, v) => acc + v, 0);
  }, [stats]);

  // Draw chart in Canvas 2D
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;
    ctx.clearRect(0, 0, W, H);

    const entries = Object.entries(stats).reverse();
    if (entries.length < 2) return;

    const maxVal = Math.max(...entries.map(([, v]) => v), 10);
    const pad = 30;
    const chartW = W - pad * 2;
    const chartH = H - pad * 2;

    // Draw horizontal grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(W - pad, y);
      ctx.stroke();
    }

    // Line and gradient fill
    ctx.beginPath();
    entries.forEach(([_, val], i) => {
      const x = pad + (chartW / (entries.length - 1)) * i;
      const y = H - pad - (val / maxVal) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    // Stroke line
    ctx.strokeStyle = '#A855F7';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Area fill
    ctx.lineTo(W - pad, H - pad);
    ctx.lineTo(pad, H - pad);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, pad, 0, H - pad);
    grad.addColorStop(0, 'rgba(168, 85, 247, 0.25)');
    grad.addColorStop(1, 'rgba(168, 85, 247, 0.0)');
    ctx.fillStyle = grad;
    ctx.fill();
  }, [stats]);

  if (!mine) {
    return (
      <div className="wrap" style={{ textAlign: 'center', padding: '100px 20px' }}>
        <h2>No tienes un perfil creado todavía</h2>
        <p className="t-meta" style={{ marginTop: '8px', marginBottom: '24px' }}>
          Crea tu perfil en el panel para ver estadísticas de visitas y clics.
        </p>
      </div>
    );
  }

  return (
    <div className="analytics-page wrap" style={{ paddingTop: '40px', paddingBottom: '80px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '8px' }}>Analíticas</h1>
          <p className="t-meta" style={{ fontSize: '1.1rem' }}>
            Rendimiento y visitas de <strong>@{mine.username}</strong>
          </p>
        </div>

        {/* Date range picker */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {([7, 30, 90] as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              className={`btn btn--sm ${range === r ? 'btn--primary' : 'btn--quiet'}`}
              onClick={() => setRange(r)}
            >
              {r} días
            </button>
          ))}
        </div>
      </header>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <div className="panel" style={{ padding: '24px', borderRadius: '16px', background: 'var(--card-bg, rgba(255,255,255,0.03))', border: '1px solid var(--border, rgba(255,255,255,0.08))' }}>
          <span className="t-meta" style={{ fontSize: '0.85rem' }}>Visitas en el período</span>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px', color: 'var(--p-primary, #A855F7)' }}>
            {num(totalViewsInRange)}
          </div>
        </div>

        <div className="panel" style={{ padding: '24px', borderRadius: '16px', background: 'var(--card-bg, rgba(255,255,255,0.03))', border: '1px solid var(--border, rgba(255,255,255,0.08))' }}>
          <span className="t-meta" style={{ fontSize: '0.85rem' }}>Visitas totales</span>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px' }}>
            {num(mine.views || 0)}
          </div>
        </div>

        <div className="panel" style={{ padding: '24px', borderRadius: '16px', background: 'var(--card-bg, rgba(255,255,255,0.03))', border: '1px solid var(--border, rgba(255,255,255,0.08))' }}>
          <span className="t-meta" style={{ fontSize: '0.85rem' }}>Nivel de cuenta</span>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '8px', color: '#FAA61A' }}>
            Nv {mine.level || 1}
          </div>
        </div>
      </div>

      {/* Chart Panel */}
      <div className="panel" style={{ padding: '24px', borderRadius: '16px', background: 'var(--card-bg, rgba(255,255,255,0.03))', border: '1px solid var(--border, rgba(255,255,255,0.08))' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Visitas diarias</h2>
        <div style={{ width: '100%', height: '280px', position: 'relative' }}>
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
        </div>
      </div>
    </div>
  );
}

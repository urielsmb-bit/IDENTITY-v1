import { useCallback, useEffect, useState } from 'react';
import {
  AQUI, FUNCIONES, pruebaCors, pruebaFuentes, pruebaRest, pruebaVimeo,
  pruebasDeCompilacion, type Prueba,
} from '@/lib/salud';
import { useTitulo } from '@/hooks/useTitulo';
import '@/styles/salud.css';

/**
 * «¿Por qué no funciona?», en una pantalla.
 *
 * Se mira después de mudarse de dominio, de desplegar, o cuando algo dejó de
 * ir sin que nadie tocara nada. Cada línea que sale mal trae la orden exacta
 * que la arregla: un diagnóstico que no dice qué hacer es una queja.
 *
 * No lleva enlace desde ninguna parte a propósito — no es una pantalla para
 * quien visita un perfil — y se carga aparte, así que no pesa ni un byte
 * hasta que alguien escribe la dirección.
 *
 * Tampoco enseña ningún secreto: la clave que usa es la pública, la misma
 * que ya viaja dentro del JavaScript de cualquier visita.
 */

const COLOR: Record<Prueba['estado'], string> = {
  bien: '#3ddc97',
  mal: '#ff5a6e',
  aviso: '#ffc24b',
  mirando: '#8a93a6',
};

const SIMBOLO: Record<Prueba['estado'], string> = {
  bien: '✓', mal: '✕', aviso: '!', mirando: '…',
};

function Linea({ p }: { p: Prueba }) {
  return (
    <li className="sal__i" data-estado={p.estado}>
      <span className="sal__p" style={{ color: COLOR[p.estado] }} aria-hidden="true">
        {SIMBOLO[p.estado]}
      </span>
      <div className="sal__c">
        <b className="sal__n">{p.nombre}</b>
        <span className="sal__d">{p.detalle}</span>
        {p.estado !== 'bien' && p.arreglo && (
          <code className="sal__f">{p.arreglo}</code>
        )}
      </div>
    </li>
  );
}

export default function SaludPage() {
  useTitulo('Salud · sharee');

  const [pruebas, setPruebas] = useState<Prueba[]>([]);
  const [mirando, setMirando] = useState(false);
  const [enlaceVimeo, setEnlaceVimeo] = useState('');

  const mirar = useCallback(async () => {
    setMirando(true);
    /* Lo que se sabe sin preguntar sale YA. Lo demás tarda lo que tarde la
       red, y mientras tanto la pantalla no está en blanco. */
    const deEntrada = [...pruebasDeCompilacion(), pruebaFuentes()];
    setPruebas([
      ...deEntrada,
      { id: 'rest', nombre: 'Base de datos (REST)', estado: 'mirando', detalle: 'Preguntando…' },
      ...FUNCIONES.map(([n, para]) => ({
        id: `cors:${n}`,
        nombre: `Permiso de origen · ${n}`,
        estado: 'mirando' as const,
        detalle: `Para ${para}.`,
      })),
    ]);

    /* Todas a la vez: son cinco funciones y preguntarlas en fila multiplica
       por cinco lo que tarda la pantalla en servir para algo. */
    const hechas = await Promise.all([
      pruebaRest(),
      ...FUNCIONES.map(([n]) => pruebaCors(n)),
    ]);
    setPruebas([...deEntrada, ...hechas]);
    setMirando(false);
  }, []);

  useEffect(() => { void mirar(); }, [mirar]);

  const [vimeo, setVimeo] = useState<Prueba | null>(null);
  const mirarVimeo = useCallback(async () => {
    setVimeo({ id: 'v', nombre: 'Vimeo deja incrustar aquí', estado: 'mirando', detalle: 'Preguntando a Vimeo…' });
    setVimeo(await pruebaVimeo(enlaceVimeo));
  }, [enlaceVimeo]);

  const mal = pruebas.filter((p) => p.estado === 'mal').length;
  const avisos = pruebas.filter((p) => p.estado === 'aviso').length;

  return (
    <main className="sal">
      <header className="sal__h">
        <h1>Salud</h1>
        <p className="sal__sub">
          Mirando desde <b>{AQUI}</b>. Las respuestas dependen del dominio desde
          el que se pregunta, así que esto solo vale para este.
        </p>
        <p
          className="sal__res"
          style={{ color: mal ? COLOR.mal : avisos ? COLOR.aviso : COLOR.bien }}
        >
          {mirando
            ? 'Mirando…'
            : mal
              ? `${mal} ${mal === 1 ? 'cosa rota' : 'cosas rotas'}${avisos ? ` y ${avisos} para mirar` : ''}.`
              : avisos
                ? `Todo responde. ${avisos} ${avisos === 1 ? 'cosa' : 'cosas'} para mirar.`
                : 'Todo responde.'}
        </p>
        <button className="btn" type="button" onClick={() => void mirar()} disabled={mirando}>
          Volver a mirar
        </button>
      </header>

      <ul className="sal__l">
        {pruebas.map((p) => <Linea key={p.id} p={p} />)}
      </ul>

      <section className="sal__h">
        <h2>Un vídeo de Vimeo</h2>
        <p className="sal__sub">
          Si un fondo sale en negro, casi siempre es que Vimeo no deja
          incrustar ese vídeo en este dominio. Pégalo y te lo dice.
        </p>
        <div className="sal__fila">
          <input
            className="inp"
            type="url"
            inputMode="url"
            placeholder="https://vimeo.com/1234567890"
            value={enlaceVimeo}
            onChange={(e) => setEnlaceVimeo(e.target.value)}
          />
          <button className="btn" type="button" onClick={() => void mirarVimeo()}>
            Comprobar
          </button>
        </div>
        {vimeo && <ul className="sal__l"><Linea p={vimeo} /></ul>}
      </section>
    </main>
  );
}

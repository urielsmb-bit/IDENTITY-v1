import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useMyProfile } from '@/hooks/useProfile';
import { useInsignias } from '@/hooks/useInsignias';
import { tienePlan, diasDePrueba } from '@/lib/insignias';
import { concedidasDe } from '@/lib/publico';
import { hayTienda, comprarPremium } from '@/lib/tebex';

export type FaseCompra = 'nada' | 'abriendo' | 'abierto' | 'activando' | 'hecho' | 'tarda';

/** ¿Ya es de por vida? El diamante y sin fecha de caducidad: la semana de
 *  prueba también es el diamante, pero caduca. */
async function esDePorVida(perfilId: string): Promise<boolean> {
  const c = await concedidasDe(perfilId);
  return c.ids.includes('premium') && !c.caducaPlan;
}

/**
 * Todo lo que rodea a comprar Premium: quién compra, si ya lo tiene, y en
 * qué punto está el pago.
 *
 * Lo que cuenta como «ya lo tienes» lo dice la BASE, no la ventana de
 * Tebex: al pagar se pregunta cada pocos segundos hasta que ha llegado el
 * aviso firmado y el diamante está puesto. Decirlo antes sería prometer
 * algo que depende de un aviso que todavía no ha llegado.
 */
export function useCompraPremium() {
  const hayUsuario = useAuthStore((s) => !!s.user);
  const { profile } = useMyProfile();
  const { datos } = useInsignias(profile);
  const [fase, setFase] = useState<FaseCompra>('nada');
  const [fallo, setFallo] = useState<string | null>(null);
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  const perfilId: string | undefined = profile?._id;
  const sabido = Array.isArray(datos.concedidas);
  const deporVida = sabido && tienePlan(datos) && !datos.caducaPlan;
  const diasPrueba = diasDePrueba(datos);

  /* Hasta 90 segundos, cada 3. El aviso de Tebex suele llegar en menos de
     diez; si tarda más, se dice, y el diamante aparece igual cuando llegue. */
  async function esperarDiamante(id: string) {
    setFase('activando');
    for (let i = 0; i < 30 && vivo.current; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      if (await esDePorVida(id).catch(() => false)) {
        if (vivo.current) setFase('hecho');
        return;
      }
    }
    if (vivo.current) setFase('tarda');
  }

  async function comprar() {
    if (!perfilId || !profile?.username) return;
    setFallo(null);
    setFase('abriendo');
    try {
      await comprarPremium(perfilId, profile.username, {
        alPagar: () => void esperarDiamante(perfilId),
        alCerrar: () => setFase((f) => (f === 'abierto' || f === 'abriendo' ? 'nada' : f)),
      });
      setFase((f) => (f === 'abriendo' ? 'abierto' : f));
    } catch (e) {
      setFallo(e instanceof Error ? e.message : String(e));
      setFase('nada');
    }
  }

  return {
    /** Tebex conectado: se puede vender. */
    tienda: hayTienda(),
    hayUsuario,
    perfilId,
    /** Ya lo tiene para siempre (no cuenta la semana de prueba). */
    deporVida: deporVida || fase === 'hecho',
    /** Días de prueba que le quedan, o null. */
    diasPrueba,
    fase,
    fallo,
    comprar,
  };
}

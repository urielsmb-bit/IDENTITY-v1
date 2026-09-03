import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Qué parte es, para poder decirlo: «el editor», «la vista previa». */
  donde: string;
  /**
   * Cambia esto y la frontera se rearma sola.
   *
   * Sirve para que un fallo causado por un dato concreto —un perfil roto, un
   * bloque con basura dentro— desaparezca en cuanto se cambia de dato, sin
   * que haya que pulsar nada.
   */
  reintentarCon?: unknown;
}

interface Estado {
  roto: boolean;
}

/**
 * Frontera de error.
 *
 * Sin una de estas, un fallo al pintar CUALQUIER componente desmonta el
 * árbol entero: React deja la página en blanco, sin mensaje y sin forma de
 * volver. No es hipotético — pasó mientras se construía esto, y desde fuera
 * era indistinguible de que la aplicación no cargara.
 *
 * Con la frontera, el fallo se queda dentro de su trozo: si revienta la
 * vista previa, el editor sigue en pie y no se pierde lo que se estaba
 * haciendo.
 *
 * Tiene que ser una clase: `getDerivedStateFromError` no existe en hooks, y
 * a día de hoy no hay equivalente.
 */
export class Frontera extends Component<Props, Estado> {
  state: Estado = { roto: false };

  static getDerivedStateFromError(): Estado {
    return { roto: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // A la consola entero, que es donde sirve. A la pantalla, no: un
    // volcado de pila no le dice nada a quien está montando su perfil.
    console.error(`[frontera: ${this.props.donde}]`, error, info.componentStack);
  }

  componentDidUpdate(anterior: Props) {
    if (this.state.roto && anterior.reintentarCon !== this.props.reintentarCon) {
      this.setState({ roto: false });
    }
  }

  render() {
    if (!this.state.roto) return this.props.children;

    return (
      <div className="frontera" role="alert">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          <path d="M12 9v4M12 17h.01" />
        </svg>

        <div>
          <p className="frontera__t">Algo se rompió en {this.props.donde}.</p>
          <p className="frontera__d">
            El resto sigue funcionando. Si vuelve a pasar con lo mismo, recarga
            la página.
          </p>
        </div>

        <div className="frontera__acc">
          <button
            type="button"
            className="btn btn--sm btn--quiet"
            onClick={() => this.setState({ roto: false })}
          >
            Reintentar
          </button>
          <button
            type="button"
            className="btn btn--sm btn--quiet"
            onClick={() => window.location.reload()}
          >
            Recargar
          </button>
        </div>
      </div>
    );
  }
}

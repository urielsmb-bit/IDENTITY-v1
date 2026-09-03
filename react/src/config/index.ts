/**
 * Configuración central de la app.
 *
 * Todo sale de variables de entorno y NADA lleva un valor de respaldo que
 * apunte a un proyecto concreto: un despliegue mal configurado que caiga en
 * un respaldo escribiría contra la base de datos de otra persona sin avisar.
 * Si falta la configuración, `hayBackend()` da false y la app trabaja en
 * modo local, que es un fallo visible y no uno silencioso.
 */
const env = import.meta.env;

export const CONFIG = {
  /**
   * Settings → API → Project URL. SOLO el dominio: sin /rest/v1
   * ni nada detrás, o supabase-js vuelve a añadir la ruta y sale
   * "Invalid path specified in request URL".
   */
  SUPABASE_URL: env.VITE_SUPABASE_URL ?? '',

  /**
   * La clave pública: "anon public" o "publishable". Viaja al navegador
   * por diseño; lo que protege los datos son las políticas RLS de la base,
   * no el secreto de esta clave.
   */
  SUPABASE_KEY: env.VITE_SUPABASE_KEY ?? '',

  /**
   * Dónde vive la función que cuenta las visitas. Si se deja vacía se
   * deduce de la URL del proyecto; solo hay que ponerla si la despliegas
   * en otro sitio.
   */
  FN_VISTAS: env.VITE_FN_VISTAS ?? '',

  /**
   * Vimeo, encendido o no.
   *
   * Subir a Vimeo necesita tres cosas que no dependen del codigo: una cuenta
   * con permiso de subida por API, un token en la funcion de borde y esa
   * funcion desplegada. Mientras falte cualquiera de las tres, los videos
   * van a Supabase Storage, que funciona sin nada de eso.
   *
   * Se enciende poniendo VITE_VIMEO con cualquier valor.
   */
  VIMEO: (env.VITE_VIMEO ?? '') !== '',

  /** Cubo de Storage. Se crea en Storage → New bucket. */
  BUCKET_MEDIA: env.VITE_BUCKET_MEDIA ?? 'media',

  /**
   * Versión de los documentos legales que se acepta en el alta.
   * Al cambiar los términos se sube este número y se puede
   * distinguir quién aceptó qué.
   */
  VERSION_LEGAL: env.VITE_VERSION_LEGAL ?? '2026-08-29',

  /** ¿Hay backend, o seguimos en el modo de siempre? */
  hayBackend(): boolean {
    return !!(this.SUPABASE_URL && this.SUPABASE_KEY);
  },
};

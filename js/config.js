/* ============================================================
   IDENTITY — configuración del proyecto

   Los dos valores de aquí son PÚBLICOS por diseño: viajan en el
   navegador de todo el que abra la página. Lo que los protege no
   es el secreto, son las políticas de RLS de la base de datos.

   Lo que NUNCA puede estar en este archivo, ni en ningún otro que
   sirva el navegador, es la clave de servicio (service_role o
   sb_secret_...). Esa se salta TODAS las políticas: quien la tenga
   puede leer y borrar la base entera. Vive solo en las variables
   de entorno de las funciones de borde.

   Si SUPABASE_URL se deja vacío, IDENTITY funciona como hasta
   ahora: todo en el navegador, sin cuentas y sin perfiles
   públicos. Es el modo con el que se ha desarrollado hasta hoy y
   sigue sirviendo para probar sin tocar la base.
   ============================================================ */
(function () {
  'use strict';
  var ID = (window.ID = window.ID || {});

  ID.CONFIG = {
    /* Settings → API → Project URL. SOLO el dominio: sin /rest/v1
       ni nada detrás, o supabase-js vuelve a añadir la ruta y sale
       "Invalid path specified in request URL". */
    SUPABASE_URL: 'https://ypvipmhfnraalcqbttiq.supabase.co',

    /* La clave pública: "anon public" o "publishable". */
    SUPABASE_KEY: 'sb_publishable_nLG38Yt_fsyLt30IPNy6Ow_Zk7mH4S2',

    /* Dónde vive la función que cuenta las visitas. Se deduce de
       la URL del proyecto; solo hay que tocarlo si la despliegas
       en otro sitio. */
    FN_VISTAS: '',

    /* Cubos de Storage. Se crean en Storage → New bucket. */
    BUCKET_MEDIA: 'media',

    /* Versión de los documentos legales que se acepta en el alta.
       Al cambiar los términos se sube este número y se puede
       distinguir quién aceptó qué. */
    VERSION_LEGAL: '2026-08-29'
  };

  /* ¿Hay backend, o seguimos en el modo de siempre? */
  ID.CONFIG.hayBackend = function () {
    return !!(ID.CONFIG.SUPABASE_URL && ID.CONFIG.SUPABASE_KEY);
  };
})();

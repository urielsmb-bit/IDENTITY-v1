/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_KEY?: string;
  readonly VITE_FN_VISTAS?: string;
  readonly VITE_BUCKET_MEDIA?: string;
  readonly VITE_VERSION_LEGAL?: string;
  readonly VITE_TEBEX_TOKEN?: string;
  readonly VITE_TEBEX_PAQUETE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

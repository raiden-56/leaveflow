/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** "browser" = static build with the API running in the browser (GitHub Pages). */
  readonly VITE_DATA_MODE?: string;
  readonly VITE_DEMO_PASSWORD?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

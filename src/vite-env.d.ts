/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_MODE?: 'standard' | 'trial' | string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

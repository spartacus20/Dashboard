/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_IS_PRODUCTION?: string
  readonly VITE_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
/// <reference types="vite/client" />
/// <reference types="vitest/config" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

/** 应用版本号，构建时取自 package.json */
declare const __APP_VERSION__: string

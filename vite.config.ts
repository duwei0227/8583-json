import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import pkg from './package.json' with { type: 'json' }

// 同一份配置服务 Web 构建与 Tauri（tauri dev 访问固定端口 1420）
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  clearScreen: false,
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ['**/src-tauri/**', '**/crates/**', '**/target/**'] },
  },
  test: {
    environment: 'node',
    // e2e/ 下是 Playwright 用例，由 `pnpm test:e2e` 运行
    include: ['src/**/*.test.ts'],
  },
})

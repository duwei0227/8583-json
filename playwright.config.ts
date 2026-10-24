import { defineConfig } from '@playwright/test'

const PORT = 4173

/**
 * 端到端测试：在真实浏览器里操作 Web 版。
 * 运行前需要先构建一次 WASM（`pnpm wasm`）；测试会自行启动 Vite 开发服务器。
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    // 已有 Chromium 时（如版本与 Playwright 不一致的预装浏览器）可用环境变量指定路径
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: `pnpm dev:web --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
})

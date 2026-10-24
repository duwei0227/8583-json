import { compact, expect, sample, test } from './app'

test('加载编解码核心并显示当前规范', async ({ app }) => {
  await expect(app.footer).toContainText(/编解码核心 v[\d.]+ 已加载 · 银联 POS · 32 个域/)
})

test('载入示例后解析成功，HEX 与示例一致', async ({ app }) => {
  await app.loadSample('消费撤销')
  await expect(app.footer).toContainText('解析成功 · 155 字节 · 18 个数据域')
  expect(compact(await app.editorText('hex-in'))).toBe(compact(sample('消费撤销').hex))
})

test('打开域定义面板，列出全部域', async ({ app, page }) => {
  await app.button('域定义').click()
  await expect(page.locator('[role=dialog] tbody tr')).toHaveCount(32)
})

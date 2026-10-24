import { expect, test } from './app'

test('历史记录在刷新后保留，可重新载入', async ({ app, page }) => {
  for (const title of ['消费撤销', '签到']) {
    await app.loadSample(title)
    await expect(app.footer).toContainText('解析成功')
  }
  await page.reload()
  await expect(app.footer).toContainText('已加载')

  const history = page.getByRole('button', { name: /^历史/ })
  await expect(history).toHaveText('历史 2')
  await history.click()
  await expect(page.locator('[role=dialog] li')).toHaveCount(2)
  await app.button('载入').first().click()
  await expect(app.footer).toContainText('解析成功 · 62 字节 · 5 个数据域')
})

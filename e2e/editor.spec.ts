import { expect, test } from './app'

test('HEX 编辑器高亮选中段，点字节可反向选中', async ({ app, page }) => {
  const mark = page.locator('#hex-in .cm-segment')
  await app.loadSample('消费')
  await expect(mark).toHaveText('00 D0')

  await app.row('服务点输入方式码').click()
  await expect(mark).toHaveText('00 51')

  // 点击 F52 的第一个字节 8A（点表格行时页面可能已滚走，先把编辑器滚回视野）
  await page.locator('#hex-in').scrollIntoViewIfNeeded()
  const box = await page.evaluate(() => {
    for (const line of document.querySelectorAll('#hex-in .cm-line')) {
      const node = [...line.childNodes].find((n) => n.textContent?.includes('8A 3F'))
      if (!node) continue
      const text = (node.nodeType === Node.TEXT_NODE ? node : node.firstChild)!
      const i = text.textContent!.indexOf('8A 3F')
      const r = document.createRange()
      r.setStart(text, i)
      r.setEnd(text, i + 1)
      const b = r.getBoundingClientRect()
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
    }
  })
  expect(box, 'HEX 编辑器里应能找到 8A 3F').toBeTruthy()
  await page.mouse.click(box!.x, box!.y)
  await expect(app.detailTitle).toContainText('第 52 域')
  await expect(app.selectedRow).toContainText('F52')
  await expect(mark.first()).toContainText('8A 3F')
})

test('JSON 语法错误有标记', async ({ app, page }) => {
  await app.setEditorText('json-in', '{ "mti": "0200", ')
  await expect(page.locator('#json-in .cm-lintRange-error, #json-in .cm-lint-marker-error').first()).toBeVisible()
})

test('组包后 HEX 编辑器同步更新', async ({ app, page }) => {
  const message = { mti: '0800', tpdu: '6000030000', header: '603100000000', fields: { 11: '000200', 41: '87654321', 42: '123456789012345', 60: '00000001003' } }
  await app.setEditorText('json-in', JSON.stringify(message, null, 2))
  await app.button('组包').click()
  await expect(app.footer).toContainText('组包成功 · 57 字节 · 4 个数据域')
  await expect(page.locator('#hex-in .cm-line').first()).toHaveText('00 37 60 00 03 00 00 60 31 00 00 00 00 08 00 00')
})

import { compact, expect, sample, test } from './app'

const bytesOf = (hex: string) => Buffer.from(compact(hex), 'hex')

test.describe('快捷键', () => {
  test('在 HEX 编辑器里按 Ctrl+Enter 解析', async ({ app }) => {
    await app.setEditorText('hex-in', sample('消费').hex)
    await app.page.locator('#hex-in .cm-content').press('Control+Enter')
    await expect(app.footer).toContainText('解析成功 · 210 字节 · 18 个数据域')
  })

  test('Ctrl+, 打开域定义，Ctrl+H 打开历史记录', async ({ app, page }) => {
    await page.keyboard.press('Control+Comma')
    await expect(page.locator('div.p-drawer.p-drawer-full')).toBeVisible()
    await app.button('关闭').click()
    await expect(page.locator('div.p-drawer.p-drawer-full')).toHaveCount(0)
    await page.keyboard.press('Control+h')
    await expect(page.locator('.p-drawer')).toContainText('历史记录')
  })
})

test('打开 .bin 文件按原始字节解析', async ({ app, page }) => {
  const signIn = sample('签到')
  const chooser = page.waitForEvent('filechooser')
  await app.button('打开报文文件').click()
  await (await chooser).setFiles({ name: 'signin.bin', mimeType: 'application/octet-stream', buffer: bytesOf(signIn.hex) })
  await expect(app.footer).toContainText(`已打开 signin.bin · 解析成功 · ${bytesOf(signIn.hex).length} 字节`)
})

test.describe('拖入文件', () => {
  async function drop(app: { page: import('@playwright/test').Page }, name: string, content: string, type: string) {
    const page = app.page
    const data = await page.evaluateHandle(
      ([name, content, type]) => {
        const dt = new DataTransfer()
        dt.items.add(new File([content], name, { type }))
        return dt
      },
      [name, content, type],
    )
    await page.dispatchEvent('body', 'dragenter', { dataTransfer: data })
    await expect(page.getByText('松开以打开报文文件')).toBeVisible()
    await page.dispatchEvent('body', 'drop', { dataTransfer: data })
    await expect(page.getByText('松开以打开报文文件')).toBeHidden()
  }

  test('拖入 JSON 文件后组包', async ({ app }) => {
    await drop(app, 'sale.json', JSON.stringify(sample('消费').message), 'application/json')
    await expect(app.footer).toContainText('已打开 sale.json · 组包成功 · 210 字节 · 18 个数据域')
  })

  test('拖入截断的 HEX 文件时报错', async ({ app }) => {
    await drop(app, 'partial.hex', sample('消费').hex.slice(0, 32), 'text/plain')
    await expect(app.footer).toContainText('错误')
  })
})

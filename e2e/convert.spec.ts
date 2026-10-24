import { expect, test } from './app'

test.beforeEach(async ({ app }) => {
  await app.loadSample('消费')
  await expect(app.footer).toContainText('解析成功 · 210 字节 · 18 个数据域')
})

test('逐段解析表列出每一段', async ({ page }) => {
  // 长度头、TPDU、报文头、MTI、位图 + 18 个数据域
  await expect(page.locator('tbody tr')).toHaveCount(23)
})

test.describe('选中联动', () => {
  test('默认选中长度头', async ({ app }) => {
    await expect(app.detailTitle).toHaveText('报文长度头')
    await expect(app.selectedRow).toContainText('长度')
    await expect(app.chip('长度')).toHaveAttribute('aria-pressed', 'true')
  })

  test('点表格行，结构色块、位图、详情、状态栏一起切换', async ({ app, page }) => {
    await app.row('服务点输入方式码').click()
    await expect(app.detailTitle).toHaveText('第 22 域 · 服务点输入方式码')
    await expect(app.chip('F22')).toHaveAttribute('aria-pressed', 'true')
    await expect(app.bit(22)).toHaveAttribute('aria-current', 'true')
    await expect(page.getByText('第 22 域 → 位图第 3 字节 06 = 0000 0110，从高位数第 6 位为 1')).toBeVisible()
    await expect(app.footer).toContainText('选中 F22 · 0x0030–0x0031')
  })

  test('点位图格子，选中对应的域', async ({ app }) => {
    await app.bit(41).click()
    await expect(app.detailTitle).toHaveText('第 41 域 · 受卡机终端标识码')
    await expect(app.selectedRow).toContainText('F41')
    await expect(app.chip('F41')).toHaveAttribute('aria-pressed', 'true')
  })

  test('点 MTI 色块，详情逐位拆解 MTI', async ({ app, page }) => {
    await app.chip('MTI').click()
    await expect(app.detailTitle).toHaveText('MTI 报文类型标识')
    await expect(app.selectedRow).toContainText('MTI')
    await expect(page.locator('aside span[aria-current="true"]')).toHaveText(['0 1987 版', '2 金融类', '0 请求', '0 收单方发起'])
  })

  test('F55 按 TLV 拆出子域', async ({ app, page }) => {
    await app.row('IC卡数据域').click()
    await expect(page.locator('aside .grid-cols-\\[48px_minmax\\(0\\,1fr\\)\\]')).toHaveCount(12)
  })
})

test('改 JSON 后组包', async ({ app }) => {
  const json = JSON.parse(await app.editorText('json-in'))
  json.fields['4'] = '000000099900'
  await app.setEditorText('json-in', JSON.stringify(json, null, 2))
  await app.button('组包').click()
  await expect(app.footer).toContainText('组包成功 · 210 字节 · 18 个数据域')
  await expect(app.row('交易金额')).toContainText('00 00 00 09 99 00')
  await expect(app.row('交易金额')).toContainText('¥ 999.00')
})

test('报文被截断时给出出错位置', async ({ app }) => {
  await app.setEditorText('hex-in', (await app.editorText('hex-in')).trimEnd().slice(0, -6))
  await app.button('解析').click()
  await expect(app.footer).toContainText('第 64 域 越界：偏移 202，需要 8 字节，剩余 6 字节')
})

test('切换到另一个示例', async ({ app }) => {
  await app.loadSample('批结算')
  await expect(app.footer).toContainText('解析成功 · 129 字节 · 7 个数据域')
})

import { expect, test, type App } from './app'

/** 全屏的域定义面板 */
const panel = (app: App) => app.page.locator('div.p-drawer.p-drawer-full')
const panelStatus = (app: App) => panel(app).locator('.p-drawer-header span.text-xs')
const problems = (app: App) => panel(app).locator('.p-message li')
const confirm = (app: App) => app.page.locator('.p-confirmdialog-accept-button').click()

async function setMaxLen(app: App, value: number) {
  await app.page.fill('#field-max', String(value))
  await app.page.press('#field-max', 'Tab')
}

test.beforeEach(async ({ app }) => {
  await app.loadSample('消费')
  await expect(app.footer).toContainText('解析成功')
  await app.button('域定义').click()
  await expect(panel(app).locator('tbody tr')).toHaveCount(32)
  await expect(panelStatus(app)).toHaveText('已与当前解析结果同步')
})

test('改域定义后重新解析；恢复默认后恢复正常', async ({ app }) => {
  await panel(app).locator('tbody tr', { hasText: '主账号' }).click()
  await setMaxLen(app, 18)
  await expect(panelStatus(app)).toContainText('有未应用的修改')
  await app.button('完成并重新解析').click()
  await expect(app.footer).toContainText('第 2 域（偏移 23）：长度 19 超过最大值 18')

  await app.button('域定义').click()
  await app.button('恢复默认').click()
  await confirm(app)
  await app.button('完成并重新解析').click()
  await expect(app.footer).toContainText('解析成功 · 210 字节 · 18 个数据域')
})

test('无效的域定义会被拦下，可放弃修改', async ({ app }) => {
  await panel(app).locator('tbody tr', { hasText: '主账号' }).click()
  await setMaxLen(app, 120)
  await expect(panelStatus(app)).toHaveText('1 个问题待修正')
  await expect(problems(app)).toHaveText(['第 2 域：LLVAR 最大长度不能超过 99，当前 120'])
  await expect(app.button('完成并重新解析')).toBeDisabled()
  await app.button('放弃修改').click()
  await expect(panelStatus(app)).toHaveText('已与当前解析结果同步')
})

test('报文头子段位数必须与报文头长度一致', async ({ app, page }) => {
  const first = page.locator('input[aria-label="报文头子段（按 BCD 展开后的位数切分）第 1 项长度"]')
  await first.fill('3')
  await first.press('Tab')
  await expect(problems(app)).toHaveText(['报文头子段共 13 位，应等于报文头 6 字节展开后的 12 位'])
})

test('新建、改名、切换、删除规范', async ({ app, page }) => {
  await panel(app).getByRole('button', { name: '新建' }).click()
  await page.fill('#spec-name', '某银行 ATM')
  await app.button('完成并重新解析').click()
  await expect(page.getByRole('combobox', { name: '当前规范' })).toHaveText('规范：某银行 ATM')
  await expect(app.footer).toContainText('解析成功 · 210 字节 · 18 个数据域')

  await app.button('域定义').click()
  const specs = panel(app).locator('section button[aria-pressed]')
  await expect(specs).toHaveText(['银联 POS内置 · 32 个域', '某银行 ATM自定义 · 32 个域 · 当前使用'])
  await app.button('删除规范 某银行 ATM').click()
  await confirm(app)
  await expect(specs).toHaveCount(1)
})

test('带未应用的修改关闭面板时需要确认', async ({ app, page }) => {
  await panel(app).locator('tbody tr', { hasText: '主账号' }).click()
  await setMaxLen(app, 17)
  await app.button('关闭').click()
  await expect(page.locator('.p-confirmdialog .p-dialog-title')).toHaveText('放弃未应用的修改？')
  await confirm(app)
  await expect(panel(app)).toHaveCount(0)
})

test('导入无效的规范 JSON 时提示原因', async ({ app, page }) => {
  await app.button('关闭').click()
  await page.getByRole('button', { name: '更多' }).click()
  await page.getByRole('menuitem', { name: '导入规范…' }).click()
  await page.fill('textarea[aria-label="规范 JSON"]', '{ "name": 1 }')
  await app.button('导入').click()
  await expect(page.locator('.p-dialog .p-message li')).toContainText('规范 JSON 无效：invalid type: integer `1`, expected a string')
})

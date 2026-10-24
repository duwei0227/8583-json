import { expect, test } from './app'

test.beforeEach(async ({ app, page }) => {
  await app.loadSample('消费')
  await expect(page.locator('#hex-in .cm-segment')).toBeVisible()
})

test('点表格行或位图时页面不跳动', async ({ app }) => {
  await app.setScrollTop(900)
  const top = await app.scrollTop()
  expect(top).toBeGreaterThan(0)

  await app.row('二磁道数据').click()
  await expect(app.selectedRow).toContainText('F35')
  await app.page.waitForTimeout(400)
  expect(await app.scrollTop()).toBe(top)

  await app.bit(41).click()
  await expect(app.selectedRow).toContainText('F41')
  await app.page.waitForTimeout(400)
  expect(await app.scrollTop()).toBe(top)
})

test('点结构色块时表格滚到对应行，重复点击也会定位', async ({ app }) => {
  const f64 = app.row('报文鉴别码')
  for (let i = 0; i < 2; i++) {
    await app.setScrollTop(0)
    await expect(f64).not.toBeInViewport()
    await app.chip('F64').click()
    await expect(f64).toBeInViewport()
  }
})

test('HEX 编辑器内部滚动到选中字节', async ({ app, page }) => {
  await app.chip('F64').click()
  await expect(page.locator('#hex-in .cm-segment').first()).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() => {
        const scroller = document.querySelector('#hex-in .cm-scroller')!.getBoundingClientRect()
        const mark = document.querySelector('#hex-in .cm-segment')!.getBoundingClientRect()
        return mark.top >= scroller.top && mark.bottom <= scroller.bottom
      }),
    )
    .toBe(true)
})

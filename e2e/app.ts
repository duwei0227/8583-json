import { test as base, expect, type Locator, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

export { expect }

export interface Sample {
  title: string
  hex: string
  message: { mti: string; fields: Record<string, string> }
}

/** 与前端、Rust 黄金测试共用的示例报文 */
export const samples: Sample[] = JSON.parse(readFileSync(new URL('../src/samples/samples.json', import.meta.url), 'utf8'))
export const sample = (title: string) => samples.find((s) => s.title === title)!

/** 去掉空白后的大写十六进制，便于比较编辑器内容 */
export const compact = (hex: string) => hex.replace(/\s+/g, '').toUpperCase()

/** 页面操作的薄封装：只放多个用例都会用到的定位和动作 */
export class App {
  readonly footer: Locator
  readonly selectedRow: Locator
  readonly detailTitle: Locator

  constructor(readonly page: Page) {
    this.footer = page.locator('footer')
    this.selectedRow = page.locator('tbody tr[aria-current="true"]')
    this.detailTitle = page.locator('aside h2').nth(1)
  }

  button(name: string) {
    return this.page.getByRole('button', { name, exact: true })
  }

  async loadSample(title: string) {
    await this.page.getByRole('button', { name: '载入示例' }).click()
    await this.page.getByRole('menuitem', { name: title, exact: true }).click()
  }

  row(text: string) {
    return this.page.locator('tbody tr', { hasText: text })
  }

  chip(tag: string) {
    return this.page.locator('section button[aria-pressed]').filter({ has: this.page.getByText(tag, { exact: true }) })
  }

  bit(n: number) {
    return this.page.getByRole('button', { name: `第 ${n} 位 已置位` })
  }

  /** 编辑器只渲染可视区附近的行，所以从 EditorView 读完整文档（同 EditorView.findFromDOM） */
  async editorText(id: 'hex-in' | 'json-in') {
    const text = await this.page.evaluate(
      (id) => (document.querySelector(`#${id} .cm-content`) as any)?.cmTile?.root?.view?.state.doc.toString() as string | undefined,
      id,
    )
    if (text === undefined) throw new Error(`读不到 #${id} 的编辑器内容`)
    return text
  }

  setEditorText(id: 'hex-in' | 'json-in', text: string) {
    return this.page.locator(`#${id} .cm-content`).fill(text)
  }

  /** 页面主滚动区的位置 */
  scrollTop() {
    return this.page.locator('main').evaluate((m) => m.scrollTop)
  }

  setScrollTop(top: number) {
    return this.page.locator('main').evaluate((m, top) => (m.scrollTop = top), top)
  }
}

/** 每个用例打开一个全新页面，等编解码核心加载完；结束时页面不应有任何报错 */
export const test = base.extend<{ app: App }>({
  app: async ({ page }, use) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    await page.goto('/')
    await expect(page.locator('footer')).toContainText('已加载')
    await use(new App(page))
    expect(errors, '页面报错').toEqual([])
  },
})

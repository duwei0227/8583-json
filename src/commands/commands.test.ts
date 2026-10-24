import { describe, expect, it } from 'vitest'
import { COMMAND_GROUPS, createCommands, formatShortcut, matchShortcut, type CommandActions } from '.'

const noop = () => {}
const asyncNoop = async () => {}
const actions: CommandActions = {
  openFile: asyncNoop,
  saveHex: asyncNoop,
  saveJson: asyncNoop,
  parse: noop,
  pack: noop,
  format: noop,
  clear: noop,
  copyHex: asyncNoop,
  copyJson: asyncNoop,
  toggleLayout: noop,
  toggleEditors: noop,
  toggleAnalysis: noop,
  toggleHistory: noop,
  editSpec: noop,
  newSpec: noop,
  importSpec: noop,
  exportSpec: asyncNoop,
  showFieldReference: noop,
  showShortcuts: noop,
  showAbout: noop,
}

describe('command registry', () => {
  const commands = createCommands(actions)

  it('has unique ids and shortcuts', () => {
    const ids = commands.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    const shortcuts = commands.flatMap((c) => (c.shortcut ? [c.shortcut] : []))
    expect(new Set(shortcuts).size).toBe(shortcuts.length)
  })

  it('puts every command in a known menu group', () => {
    const groups = new Set(COMMAND_GROUPS.map((g) => g.id))
    for (const c of commands) expect(groups.has(c.group)).toBe(true)
  })

  it('formats shortcuts per platform', () => {
    expect(formatShortcut('CmdOrCtrl+Shift+Enter', false)).toBe('Ctrl+Shift+Enter')
    expect(formatShortcut('CmdOrCtrl+O', true)).toBe('⌘+O')
  })

  it('matches keyboard events against accelerators', () => {
    const key = (k: string, mods: Partial<KeyboardEvent> = {}) =>
      ({ key: k, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...mods }) as KeyboardEvent
    expect(matchShortcut('CmdOrCtrl+Enter', key('Enter', { ctrlKey: true }), false)).toBe(true)
    expect(matchShortcut('CmdOrCtrl+Enter', key('Enter', { metaKey: true }), true)).toBe(true)
    expect(matchShortcut('CmdOrCtrl+Enter', key('Enter', { ctrlKey: true, shiftKey: true }), false)).toBe(false)
    expect(matchShortcut('CmdOrCtrl+Shift+S', key('S', { ctrlKey: true, shiftKey: true }), false)).toBe(true)
    expect(matchShortcut('CmdOrCtrl+O', key('o'), false)).toBe(false)
  })
})

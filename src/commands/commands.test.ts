import { describe, expect, it } from 'vitest'
import { COMMAND_GROUPS, createCommands, formatShortcut, type CommandActions } from '.'

const noop = () => {}
const asyncNoop = async () => {}
const actions: CommandActions = {
  openFile: asyncNoop,
  saveHex: asyncNoop,
  saveJson: asyncNoop,
  parse: noop,
  pack: noop,
  formatHex: noop,
  clear: noop,
  copyHex: asyncNoop,
  copyJson: asyncNoop,
  toggleLayout: noop,
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
})

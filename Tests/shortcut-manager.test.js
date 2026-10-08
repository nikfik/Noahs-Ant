/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals'
import { createShortcutManager } from '../public/scripts/workspace/shortcuts/shortcut-manager.js'

const press = (init, target = document.body) => {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  return event
}
const release = (init, target = document.body) => {
  const event = new KeyboardEvent('keyup', { bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  return event
}
const savedShortcut = (id, primary, secondary = '', operator = '/') => ({ id, value: { primary, secondary, operator } })

describe('Shortcut manager', () => {
  let manager
  let api
  let settingsListener

  async function setup(settings = {}) {
    document.body.removeAttribute('data-view')
    document.body.removeAttribute('data-capturing-key')
    document.body.innerHTML = ''
    settingsListener = null
    api = {
      getAppSettings: jest.fn().mockResolvedValue(settings),
      onSettingsChange: jest.fn((callback) => { settingsListener = callback; return jest.fn() })
    }
    manager = createShortcutManager({ api })
    await manager.load()
    manager.attach()
  }

  afterEach(() => manager?.detach())

  test('runs the action of the default key and cancels the browser default', async () => {
    await setup()
    const actions = Object.fromEntries(['skip-forward', 'skip-back', 'frame-forward', 'frame-back', 'toggle-mute', 'play-pause', 'next-animal', 'previous-animal']
      .map((id) => [id, jest.fn()]))
    Object.entries(actions).forEach(([id, handler]) => manager.register(id, handler))
    const called = () => Object.entries(actions).filter(([, handler]) => handler.mock.calls.length).map(([id]) => id)
    const reset = () => Object.values(actions).forEach((handler) => handler.mockClear())

    expect(press({ key: 'ArrowRight' }).defaultPrevented).toBe(true)
    expect(called()).toEqual(['skip-forward'])
    reset()

    press({ key: 'ArrowLeft' })
    expect(called()).toEqual(['skip-back'])
    reset()

    press({ key: '.' })
    expect(called()).toEqual(['frame-forward'])
    reset()

    press({ key: ',' })
    expect(called()).toEqual(['frame-back'])
    reset()

    press({ key: ' ' })
    expect(called()).toEqual(['play-pause'])
    reset()

    press({ key: 'Enter' })
    expect(called()).toEqual(['play-pause'])
    reset()

    press({ key: 'M', shiftKey: true })
    expect(called()).toEqual(['toggle-mute'])
    reset()

    press({ key: 'm' })
    expect(called()).toEqual([])
  })

  test('Alt + arrows change the animal and do not also skip 5 seconds', async () => {
    await setup()
    const skip = jest.fn()
    const next = jest.fn()
    const previous = jest.fn()
    manager.register('skip-forward', skip)
    manager.register('next-animal', next)
    manager.register('previous-animal', previous)

    press({ key: 'ArrowRight', altKey: true })
    press({ key: 'ArrowLeft', altKey: true })

    expect(next).toHaveBeenCalledTimes(1)
    expect(previous).toHaveBeenCalledTimes(1)
    expect(skip).not.toHaveBeenCalled()
  })

  test('holding a key repeats only the actions that allow it', async () => {
    await setup()
    const skip = jest.fn()
    const play = jest.fn()
    manager.register('skip-forward', skip, { allowRepeat: true })
    manager.register('play-pause', play)

    press({ key: 'ArrowRight', repeat: true })
    expect(skip).toHaveBeenCalledTimes(1)

    const held = press({ key: ' ', repeat: true })
    expect(play).not.toHaveBeenCalled()
    expect(held.defaultPrevented).toBe(true)
  })

  test('stays out of the way while typing, in dialogs, while a key is being assigned, and outside the video view', async () => {
    await setup()
    const play = jest.fn()
    manager.register('play-pause', play)

    document.body.innerHTML = '<input id="field" /><select id="choice"></select><textarea id="note"></textarea>'
    ;['field', 'choice', 'note'].forEach((id) => press({ key: ' ' }, document.getElementById(id)))
    expect(play).not.toHaveBeenCalled()

    document.body.innerHTML = '<div class="modal"></div>'
    press({ key: ' ' })
    expect(play).not.toHaveBeenCalled()

    document.body.innerHTML = '<div class="modal hidden"></div>'
    press({ key: ' ' })
    expect(play).toHaveBeenCalledTimes(1)

    document.body.dataset.capturingKey = 'true'
    press({ key: ' ' })
    expect(play).toHaveBeenCalledTimes(1)
    delete document.body.dataset.capturingKey

    document.body.dataset.view = 'view-data'
    press({ key: ' ' })
    expect(play).toHaveBeenCalledTimes(1)
  })

  test('ignores keys whose action nobody registered, and lets them through', async () => {
    await setup()
    const event = press({ key: ',' })
    expect(event.defaultPrevented).toBe(false)
  })

  test('cancels the click a focused button would get when the shortcut key is released', async () => {
    await setup()
    manager.register('play-pause', jest.fn())

    press({ key: ' ' })
    expect(release({ key: ' ' }).defaultPrevented).toBe(true)
    expect(release({ key: 'x' }).defaultPrevented).toBe(false)
  })

  test('follows changes made in the settings window', async () => {
    await setup()
    const skip = jest.fn()
    const changed = jest.fn()
    manager.register('skip-forward', skip)
    manager.subscribe(changed)
    expect(manager.describe('skip-forward')).toBe('→')

    settingsListener({ programShortcuts: [savedShortcut('skip-forward', 'L')] })

    expect(changed).toHaveBeenCalledTimes(1)
    expect(manager.describe('skip-forward')).toBe('L')
    press({ key: 'l' })
    expect(skip).toHaveBeenCalledTimes(1)
    press({ key: 'ArrowRight' })
    expect(skip).toHaveBeenCalledTimes(1)
  })

  test('uses saved keys, including a chord, and falls back to the defaults for the rest', async () => {
    await setup({ programShortcuts: [savedShortcut('play-pause', 'P', 'K', '+')] })
    expect(manager.describe('play-pause')).toBe('P + K')
    expect(manager.describe('frame-back')).toBe(',')

    const play = jest.fn()
    manager.register('play-pause', play)
    press({ key: 'p' })
    expect(play).not.toHaveBeenCalled()
    press({ key: 'p' })
    press({ key: 'k' })
    expect(play).toHaveBeenCalledTimes(1)
  })

  test('describes shortcuts and reports which program actions already use a key', async () => {
    await setup()
    expect(manager.describe('play-pause')).toBe('Spacja / Enter')
    expect(manager.describe('toggle-mute')).toBe('Shift + M')
    expect(manager.describe('unknown')).toBe('')

    const conflicts = (primary, secondary = '', operator = '/') => manager.findConflicts({ primary, secondary, operator }).map((entry) => entry.id)
    expect(conflicts('Enter')).toEqual(['play-pause'])
    expect(conflicts('ArrowLeft')).toEqual(['skip-back'])
    expect(conflicts('M')).toEqual([])
    expect(conflicts('Q', 'ArrowRight', '/')).toEqual(['skip-forward'])
  })

  test('falls back to the defaults when the settings cannot be read', async () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {})
    document.body.innerHTML = ''
    manager = createShortcutManager({ api: { getAppSettings: jest.fn().mockRejectedValue(new Error('disk')) } })
    await manager.load()
    expect(manager.describe('play-pause')).toBe('Spacja / Enter')
    errors.mockRestore()
  })

  test('stops listening after detach', async () => {
    await setup()
    const play = jest.fn()
    manager.register('play-pause', play)
    manager.detach()
    press({ key: ' ' })
    expect(play).not.toHaveBeenCalled()
  })
})

import { isVideoViewActive } from '../../shared/workspace-view.js'
import { normalizeAppSettings } from '../../settings/settings-model.js'
import { describeShortcut, shortcutsOverlap } from '../../settings/shortcut-utils.js'
import { eventKey, matchesShortcut } from './shortcut-matching.js'

const TYPING_TARGET = 'input, textarea, select, [contenteditable="true"]'
const OPEN_DIALOG = '.modal:not(.hidden):not([hidden]), .animal-name-modal:not(.hidden)'

// Owns the program's keyboard shortcuts: loads them from the settings, follows changes made in the settings window,
// and runs the handler that modules registered for an action. It listens before everyone else, so when a key is
// taken by the program, behavior keys of the etogram do not fire for it.
export function createShortcutManager({ api = globalThis.window?.electronAPI } = {}) {
  let shortcuts = []
  let attached = false
  let stopListeningToSettings = null
  const handlers = new Map()
  const listeners = new Set()
  const pressedKeys = new Set()
  const handledKeys = new Set()

  function setShortcuts(settings) {
    shortcuts = normalizeAppSettings(settings).programShortcuts
    listeners.forEach((listener) => listener(shortcuts))
  }

  async function load() {
    try {
      setShortcuts(await api?.getAppSettings?.())
    } catch (error) {
      console.error('Could not load keyboard shortcuts:', error)
      setShortcuts({})
    }
  }

  const isBlocked = (event) =>
    event.isComposing
    || document.body?.dataset.capturingKey === 'true'
    || Boolean(event.target?.matches?.(TYPING_TARGET))
    || Boolean(document.querySelector(OPEN_DIALOG))

  function onKeyDown(event) {
    const key = eventKey(event)
    if (key) pressedKeys.add(key)
    if (isBlocked(event) || !isVideoViewActive()) return

    const match = shortcuts.find((entry) => handlers.has(entry.id) && matchesShortcut(entry.value, event, pressedKeys))
    if (!match) return

    event.preventDefault()
    handledKeys.add(key)
    const { handler, allowRepeat } = handlers.get(match.id)
    if (!event.repeat || allowRepeat) handler(event)
  }

  function onKeyUp(event) {
    const key = eventKey(event)
    pressedKeys.delete(key)
    // Space on a focused button would otherwise click it when the key is released, right after the shortcut ran.
    if (handledKeys.delete(key)) event.preventDefault()
  }

  const clearPressedKeys = () => pressedKeys.clear()

  function attach() {
    if (attached) return
    attached = true
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('keyup', onKeyUp, true)
    window.addEventListener('blur', clearPressedKeys)
    stopListeningToSettings = api?.onSettingsChange?.((settings) => setShortcuts(settings)) || null
  }

  function detach() {
    if (!attached) return
    attached = false
    document.removeEventListener('keydown', onKeyDown, true)
    document.removeEventListener('keyup', onKeyUp, true)
    window.removeEventListener('blur', clearPressedKeys)
    if (typeof stopListeningToSettings === 'function') stopListeningToSettings()
    stopListeningToSettings = null
  }

  function register(actionId, handler, { allowRepeat = false } = {}) {
    handlers.set(actionId, { handler, allowRepeat })
    return () => handlers.delete(actionId)
  }

  const getShortcut = (actionId) => shortcuts.find((entry) => entry.id === actionId)?.value

  return {
    load,
    attach,
    detach,
    register,
    getShortcuts: () => shortcuts,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    // "Spacja / Enter", "Shift + M"; empty when the action has no key.
    describe: (actionId) => describeShortcut(getShortcut(actionId)),
    // The program actions that already use any key combination of this shortcut.
    findConflicts: (shortcut) => shortcuts.filter((entry) => shortcutsOverlap(shortcut, entry.value))
  }
}

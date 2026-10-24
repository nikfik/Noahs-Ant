/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals'
import { createVideoPopout } from '../public/scripts/workspace/video/video-popout.js'

// A stand-in for the second window: a separate document with the slot the panel is moved into.
function fakeChild() {
  const doc = document.implementation.createHTMLDocument('Film')
  doc.body.innerHTML = '<div id="video-popout-host"></div>'
  const listeners = {}
  return {
    document: doc,
    closed: false,
    outerWidth: 800,
    outerHeight: 500,
    screenX: 100,
    screenY: 50,
    focus: jest.fn(),
    close() { this.closed = true },
    addEventListener(type, handler) { (listeners[type] ||= []).push(handler) },
    emit(type, event = {}) { (listeners[type] || []).forEach((handler) => handler(event)) }
  }
}

describe('video in its own window', () => {
  let host
  let panel
  let notice
  let video
  let child
  let onLayout
  let onToggle
  let popout

  beforeEach(() => {
    document.body.innerHTML = '<div id="host"><div class="video-card"><video id="v"></video></div><div class="notice" hidden></div></div>'
    host = document.getElementById('host')
    panel = host.querySelector('.video-card')
    notice = host.querySelector('.notice')
    video = document.getElementById('v')
    video.play = jest.fn().mockResolvedValue(undefined)
    child = fakeChild()
    onLayout = jest.fn()
    onToggle = jest.fn()
    popout = createVideoPopout({ panel, host, notice, video, url: 'VideoPopout.html', open: jest.fn(() => child), onLayout, onToggle, timeoutMs: 0 })
  })

  test('moves the panel to the new window, shows the notice and keeps the playback state', async () => {
    Object.defineProperty(video, 'paused', { value: false, configurable: true })
    video.currentTime = 42
    video.playbackRate = 1.5
    video.muted = true

    expect(await popout.open()).toBe(true)

    expect(child.document.getElementById('video-popout-host').contains(panel)).toBe(true)
    expect(notice.hidden).toBe(false)
    expect(onToggle).toHaveBeenLastCalledWith(true)
    expect(onLayout).toHaveBeenCalled()
    expect(video.currentTime).toBe(42)
    expect(video.playbackRate).toBe(1.5)
    expect(video.muted).toBe(true)
    expect(video.play).toHaveBeenCalled()
    expect(popout.isOpen()).toBe(true)
  })

  test('passes the keys pressed in the new window on to the main window, but not those typed into a field', async () => {
    await popout.open()
    const received = []
    document.addEventListener('keydown', (event) => received.push([event.key, event.shiftKey, event.defaultPrevented]))
    document.addEventListener('keydown', (event) => event.preventDefault())

    const original = { type: 'keydown', key: 'M', code: 'KeyM', shiftKey: true, ctrlKey: false, altKey: false, metaKey: false, repeat: false, target: child.document.body, preventDefault: jest.fn() }
    child.emit('keydown', original)
    expect(received).toEqual([['M', true, false]])
    expect(original.preventDefault).toHaveBeenCalled()

    child.emit('keydown', { ...original, target: { matches: () => true }, preventDefault: jest.fn() })
    expect(received).toHaveLength(1)
  })

  test('brings the panel back when asked to, when the window is closed and when the page is left', async () => {
    await popout.open()
    await popout.close()
    expect(host.firstElementChild).toBe(panel)
    expect(notice.hidden).toBe(true)
    expect(child.closed).toBe(true)
    expect(onToggle).toHaveBeenLastCalledWith(false)
    expect(popout.isOpen()).toBe(false)

    child = fakeChild()
    popout = createVideoPopout({ panel, host, notice, video, url: 'x', open: () => child, onLayout, onToggle, timeoutMs: 0 })
    await popout.open()
    child.emit('pagehide')
    await new Promise((resolve) => setTimeout(resolve, 5))
    expect(host.firstElementChild).toBe(panel)
    expect(notice.hidden).toBe(true)

    child = fakeChild()
    popout = createVideoPopout({ panel, host, notice, video, url: 'x', open: () => child, onLayout, onToggle, timeoutMs: 0 })
    await popout.open()
    window.dispatchEvent(new Event('pagehide'))
    await new Promise((resolve) => setTimeout(resolve, 5))
    expect(child.closed).toBe(true)
    expect(host.firstElementChild).toBe(panel)
  })

  test('does nothing when the browser refuses to open the window', async () => {
    popout = createVideoPopout({ panel, host, notice, video, url: 'x', open: () => null, onLayout, onToggle, timeoutMs: 0 })
    expect(await popout.open()).toBe(false)
    expect(host.firstElementChild).toBe(panel)
    expect(notice.hidden).toBe(true)
  })

  test('copies the theme colors to the new window', async () => {
    document.documentElement.style.setProperty('--primary-color', '#123456')
    await popout.open()
    expect(child.document.documentElement.style.getPropertyValue('--primary-color')).toBe('#123456')
  })
})

/** @jest-environment jsdom */
import { askVideoQuality, formatBytes, formatDuration } from '../public/scripts/workspace/video/video-quality-dialog.js'

const info = {
  fileName: 'cam.MTS',
  extension: '.MTS',
  size: 200e6,
  probe: { duration: 120, video: { codec: 'h264', width: 1920, height: 1080, fps: 25, interlaced: true }, audio: { codec: 'ac3' } }
}
const dialog = () => document.querySelector('.video-quality-modal')

describe('video quality dialog', () => {
  afterEach(() => { document.body.innerHTML = '' })

  test('formats sizes and times', () => {
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(0)).toBe('–')
    expect(formatDuration(45)).toBe('45 s')
    expect(formatDuration(125)).toBe('2 min 5 s')
  })

  test('shows the file, starts on the given preset and confirms it', async () => {
    const answer = askVideoQuality(info, { maxHeight: 720, maxFrameRate: 25, quality: 'medium' })
    expect(dialog().textContent).toContain('cam.MTS')
    expect(dialog().textContent).toContain('1920×1080i')
    expect(dialog().querySelector('input[value="light"]').checked).toBe(true)
    expect(dialog().classList.contains('modal')).toBe(true)

    dialog().querySelector('form').requestSubmit()
    await expect(answer).resolves.toEqual({
      settings: { preset: 'light', maxHeight: 720, maxFrameRate: 25, quality: 'medium' },
      remember: false
    })
    expect(dialog()).toBeNull()
  })

  test('the advanced fields make a custom setting and the presets reset them', async () => {
    const answer = askVideoQuality(info, undefined)
    const height = dialog().querySelector('[data-field="maxHeight"]')
    height.value = '480'
    height.dispatchEvent(new Event('change'))
    expect(dialog().querySelector('input:checked[name="video-quality-preset"]')).toBeNull()

    dialog().querySelector('input[value="balanced"]').click()
    expect(height.value).toBe('1080')
    height.value = '360'
    height.dispatchEvent(new Event('change'))
    dialog().querySelector('[data-remember]').click()
    dialog().querySelector('form').requestSubmit()
    await expect(answer).resolves.toMatchObject({ settings: { preset: 'custom', maxHeight: 360, maxFrameRate: 30 }, remember: true })
  })

  test('Cancel and Escape resolve with null', async () => {
    const first = askVideoQuality(info)
    dialog().querySelector('[data-cancel]').click()
    await expect(first).resolves.toBeNull()

    const second = askVideoQuality(info)
    dialog().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await expect(second).resolves.toBeNull()
    expect(dialog()).toBeNull()
  })
})

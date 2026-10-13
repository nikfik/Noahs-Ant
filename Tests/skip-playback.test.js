/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals'
import { WorkspaceVideoModule } from '../public/scripts/workspace/workspace-video-module.js'
import { askSkip } from '../public/scripts/workspace/trials/skip-dialog.js'
import { isSkipping, setSkipping } from '../public/scripts/workspace/trials/skip-playback.js'

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('skipping while playing', () => {
  let video

  beforeEach(async () => {
    document.body.innerHTML = '<div id="video-module"></div>'
    window.electronAPI = {}
    window.HTMLMediaElement.prototype.load = jest.fn()
    window.HTMLMediaElement.prototype.pause = jest.fn()
    setSkipping(true)
    const trial = { id: 't', videoPath: 'C:/v.mp4', frameRate: 25, skips: [{ id: 's', start: 10, end: 20, countTime: false }, { id: 'c', start: 30, end: 40, countTime: true }] }
    await WorkspaceVideoModule.init('video-module', { projectFile: 'Study', trialCatalog: { getActiveTrial: () => trial, getData: () => ({ trials: [trial] }), updateTrial: jest.fn() } })
    video = document.getElementById('video-player')
    Object.defineProperty(video, 'paused', { value: false, configurable: true })
  })

  const timeupdate = (time) => {
    video.currentTime = time
    video.dispatchEvent(new Event('timeupdate'))
  }

  test('jumps over counted and uncounted skips alike', () => {
    timeupdate(12)
    expect(video.currentTime).toBe(20)
    timeupdate(35)
    expect(video.currentTime).toBe(40)
    timeupdate(25)
    expect(video.currentTime).toBe(25)
  })

  test('does not keep jumping when a seek lands a picture before the end of the skip', () => {
    timeupdate(12)
    expect(video.currentTime).toBe(20)
    timeupdate(19.97)
    expect(video.currentTime).toBe(19.97)
    Object.defineProperty(video, 'seeking', { value: true, configurable: true })
    timeupdate(12)
    expect(video.currentTime).toBe(12)
  })

  test('does not jump when playing skips is switched on, or while paused', () => {
    setSkipping(false)
    expect(isSkipping()).toBe(false)
    timeupdate(12)
    expect(video.currentTime).toBe(12)

    setSkipping(true)
    Object.defineProperty(video, 'paused', { value: true, configurable: true })
    timeupdate(12)
    expect(video.currentTime).toBe(12)
  })
})

describe('skip dialog', () => {
  afterEach(() => { document.body.innerHTML = '' })
  const dialog = () => document.querySelector('.skip-modal')

  test('validates the times, defaults to not counting and saves', async () => {
    const answer = askSkip({ start: 5, end: 15, duration: 60 })
    expect(dialog().querySelector('[data-skip="count"]').checked).toBe(false)

    dialog().querySelector('[data-skip="end"]').value = '3'
    dialog().querySelector('form').requestSubmit()
    expect(dialog().querySelector('.skip-dialog-error').hidden).toBe(false)

    dialog().querySelector('[data-skip="start"]').value = '0:10'
    dialog().querySelector('[data-skip="end"]').value = '90'
    dialog().querySelector('[data-skip="count"]').click()
    dialog().querySelector('form').requestSubmit()
    await expect(answer).resolves.toEqual({ type: 'save', start: 10, end: 60, countTime: true })
  })

  test('can delete only an existing skip, and cancel', async () => {
    expect(askSkip({ start: 1, end: 2 }) && dialog().querySelector('[data-skip-delete]')).toBeNull()
    dialog().querySelector('[data-skip-cancel]').click()

    const editing = askSkip({ start: 1, end: 2, editing: true })
    dialog().querySelector('[data-skip-delete]').click()
    await expect(editing).resolves.toEqual({ type: 'delete' })
  })
})

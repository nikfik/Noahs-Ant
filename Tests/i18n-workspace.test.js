/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals'
import { setLanguage } from '../public/scripts/shared/i18n.js'
import { WorkspaceVideoModule } from '../public/scripts/workspace/workspace-video-module.js'
import { WorkspaceEtogramModule } from '../public/scripts/workspace/workspace-etogram-module.js'
import { askSkip } from '../public/scripts/workspace/trials/skip-dialog.js'
import { askEventTimes } from '../public/scripts/workspace/observations/event-dialog.js'
import { createTimelineModule } from '../public/scripts/workspace/workspace-timeline-module.js'
import { nextTrialName } from '../public/scripts/workspace/trials/trial-model.js'
import { findShortcutConflicts } from '../public/scripts/workspace/workspace-etogram-module.js'

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => setLanguage('en'))
afterEach(() => {
  setLanguage('pl')
  document.body.innerHTML = ''
})

describe('the workspace in English', () => {
  test('the video panel: buttons, tooltips and the empty state', async () => {
    document.body.innerHTML = '<div id="video-module"></div>'
    window.HTMLMediaElement.prototype.load = jest.fn()
    window.electronAPI = {}
    await WorkspaceVideoModule.init('video-module', { projectFile: 'Study', trialCatalog: { getActiveTrial: () => ({ id: 't', videoPath: '' }), getData: () => ({ trials: [] }) } })
    const text = (selector) => document.querySelector(selector)
    expect(text('.video-empty p').textContent).toBe('This trial has no video yet')
    expect(text('#pick-video-empty-btn').textContent).toBe('Choose a video file')
    expect(text('#skip-forward-video-btn').title).toBe('Forward 5 s')
    expect(text('#skip-back-video-btn').getAttribute('aria-label')).toBe('Back 5 s')
    expect(text('#step-forward-video-btn').title).toBe('Forward 1 frame')
    expect(text('#play-pause-video-btn').title).toBe('Play')
    expect(text('#mute-video-btn').title).toBe('Mute')
    expect(text('#video-quality-btn').textContent).toBe('Quality')
    expect(text('#pick-video-btn').textContent).toBe('Change video')
    expect(text('.video-popout-notice p').textContent).toBe('The video is shown in a separate window.')
  })

  test('the etogram editor and its warnings', () => {
    const rows = [{ id: 'a', name: 'Run', category: '', description: '', color: '#42a56b', continuous: true, shortcut: { primary: 'Q', secondary: '', operator: '/' }, relations: [] }]
    const html = WorkspaceEtogramModule.renderEditorTable(rows, [])
    expect(html).toContain('placeholder="Category"')
    expect(html).toContain('aria-label="Continuous behavior"')
    expect(html).toContain('aria-label="Delete behavior Run"')
    const conflicts = findShortcutConflicts([
      { name: 'Run', shortcut: { primary: 'Q', secondary: '', operator: '/' } },
      { name: '', shortcut: { primary: 'Q', secondary: '', operator: '/' } }
    ], [{ label: 'Jump forward', value: { primary: 'Q', secondary: '', operator: '/' } }])
    expect(conflicts[0]).toBe('This shortcut is also used by: unnamed behavior · Used by the program: Jump forward')
  })

  test('the dialogs for skips and event times', async () => {
    const skip = askSkip({ start: 1, end: 5, duration: 100 })
    expect(document.querySelector('.skip-modal h3').textContent).toBe('Add skip')
    expect(document.querySelector('.skip-modal').textContent).toContain('Count this time in the analysis')
    document.querySelector('[data-skip="end"]').value = '0'
    document.querySelector('.skip-modal form').requestSubmit()
    expect(document.querySelector('.skip-dialog-error').textContent).toBe('The end must be later than the start.')
    document.querySelector('[data-skip-cancel]').click()
    await skip

    const event = askEventTimes({ title: 'Run', kind: 'interval', start: 1, end: null })
    expect(document.querySelector('.event-modal').textContent).toContain('Start (s)')
    expect(document.querySelector('[data-event="end"]').placeholder).toContain('ongoing')
    document.querySelector('[data-event="start"]').value = 'x'
    document.querySelector('.event-modal form').requestSubmit()
    expect(document.querySelector('.skip-dialog-error').textContent).toBe('Enter a valid time, e.g. 12.5 or 1:02.5.')
    document.querySelector('[data-event-cancel]').click()
    await event
  })

  test('the timeline header and the default trial name', async () => {
    document.body.innerHTML = '<div id="events-module"></div>'
    window.electronAPI = { getProjectObservations: jest.fn().mockResolvedValue({ observations: [] }), saveProjectObservations: jest.fn(), getAppSettings: jest.fn().mockResolvedValue({}) }
    await createTimelineModule().init('events-module', {
      projectId: 'Study',
      animalCatalog: { getData: () => ({ animals: [{ id: 'a', name: 'Ant', color: '#42a56b' }], activeAnimalId: 'a' }) }
    })
    await flush()
    const button = (action) => document.querySelector(`[data-timeline-action="${action}"]`)
    expect(button('undo').title).toBe('Undo (Ctrl+Z)')
    expect(button('add-skip').textContent).toBe('＋ Skip')
    expect(button('skip-playback').textContent).toBe('Skipping: on')
    expect(button('snap').textContent).toMatch(/^Snap: o(n|ff)$/)
    expect(nextTrialName({ trials: [{ name: 'Trial 1' }, { name: 'x' }] })).toBe('Trial 3')
  })
})

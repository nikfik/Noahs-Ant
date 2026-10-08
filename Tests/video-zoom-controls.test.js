/**
 * @jest-environment jsdom
 */

import { VideoZoomControls, clampPan, pictureSize, zoomAround } from '../public/scripts/workspace/video/VideoZoomControls.js'

describe('Zoom math', () => {
  test('finds the size of the picture inside the letterboxed player box', () => {
    expect(pictureSize({ width: 1000, height: 500 }, { videoWidth: 500, videoHeight: 1000 })).toEqual({ width: 250, height: 500 })
    expect(pictureSize({ width: 1000, height: 500 }, { videoWidth: 2000, videoHeight: 500 })).toEqual({ width: 1000, height: 250 })
    expect(pictureSize({ width: 1000, height: 500 }, {})).toEqual({ width: 1000, height: 500 })
  })

  test('lets the picture move only while it is bigger than the window, and never past its edges', () => {
    const box = { width: 1000, height: 500 }
    const picture = { width: 250, height: 500 }

    expect(clampPan({ x: 300, y: 300 }, 1, box, picture)).toEqual({ x: 0, y: 0 })
    expect(clampPan({ x: 300, y: 300 }, 2, box, picture)).toEqual({ x: 0, y: 250 })
    expect(clampPan({ x: -999, y: -999 }, 2, box, picture)).toEqual({ x: 0, y: -250 })
    expect(clampPan({ x: 300, y: 0 }, 6, box, picture)).toEqual({ x: 250, y: 0 })
  })

  test('zooming keeps the point under the cursor where it is', () => {
    const start = { zoom: 1, pan: { x: 0, y: 0 } }
    const cursor = { x: 100, y: -50 }
    const next = zoomAround(start, 2, cursor)
    expect(next.zoom).toBe(2)

    // the picture point that was under the cursor before: (cursor - pan) / zoom; it must be under the cursor after too
    const before = { x: (cursor.x - start.pan.x) / start.zoom, y: (cursor.y - start.pan.y) / start.zoom }
    expect(cursor.x - next.pan.x).toBeCloseTo(before.x * next.zoom)
    expect(cursor.y - next.pan.y).toBeCloseTo(before.y * next.zoom)

    const centered = zoomAround(start, 4, { x: 0, y: 0 })
    expect(centered.pan).toEqual({ x: 0, y: 0 })
  })
})

describe('VideoZoomControls', () => {
  let controls
  let stageInner
  let input

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="host"><div class="video-stage"><div class="video-stage-inner"><video></video></div></div>
      <input id="zoom-level-input" /><button id="zoom-in-btn"></button><button id="zoom-out-btn"></button><button id="zoom-fit-btn"></button></div>
    `
    const host = document.getElementById('host')
    const video = host.querySelector('video')
    Object.defineProperty(video, 'videoWidth', { value: 500 })
    Object.defineProperty(video, 'videoHeight', { value: 500 })
    host.querySelector('.video-stage').getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 500 })

    controls = new VideoZoomControls(host, video)
    input = document.getElementById('zoom-level-input')
    controls.attachInteractions({
      zoomInput: input,
      zoomOutBtn: document.getElementById('zoom-out-btn'),
      zoomInBtn: document.getElementById('zoom-in-btn'),
      zoomFitBtn: document.getElementById('zoom-fit-btn')
    })
    stageInner = host.querySelector('.video-stage-inner')
  })

  test('keeps the zoom between 100% and 800% and shows it as a percentage', () => {
    controls.setZoom(20)
    expect(controls.zoom).toBe(8)
    expect(input.value).toBe('800%')

    controls.setZoom(0.2)
    expect(controls.zoom).toBe(1)
    expect(input.value).toBe('100%')
    expect(stageInner.style.transform).toBe('')
    expect(document.querySelector('.video-stage').classList.contains('is-zoomed')).toBe(false)

    controls.setZoom(2)
    expect(stageInner.style.transform).toContain('scale(2)')
    expect(document.querySelector('.video-stage').classList.contains('is-zoomed')).toBe(true)
  })

  test('zooms with the buttons, the typed value, the mouse wheel and a double click, and fits again', () => {
    document.getElementById('zoom-in-btn').click()
    expect(controls.zoom).toBeCloseTo(1.25)
    document.getElementById('zoom-out-btn').click()
    expect(controls.zoom).toBe(1)

    input.value = '300%'
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(controls.zoom).toBe(3)

    input.value = 'abc'
    input.dispatchEvent(new Event('blur'))
    expect(input.value).toBe('300%')

    document.getElementById('zoom-fit-btn').click()
    expect(controls.zoom).toBe(1)

    document.querySelector('.video-stage').dispatchEvent(new WheelEvent('wheel', { deltaY: -100, clientX: 500, clientY: 250, bubbles: true, cancelable: true }))
    expect(controls.zoom).toBeCloseTo(1.15)

    controls.fitToContainer()
    controls.toggleZoom(500, 250)
    expect(controls.zoom).toBe(2)
    controls.toggleZoom(500, 250)
    expect(controls.zoom).toBe(1)
  })

  test('drags the zoomed picture but not past its edges, and ignores dragging at 100%', () => {
    const press = (x, y) => stageInner.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: x, clientY: y }))
    const move = (x, y) => stageInner.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: x, clientY: y }))

    press(100, 100)
    move(100, 400)
    expect(controls.pan).toEqual({ x: 0, y: 0 })

    controls.setZoom(2)
    press(100, 100)
    move(100, 400)
    expect(controls.pan.y).toBe(250)
    expect(document.querySelector('.video-stage').classList.contains('is-panning')).toBe(true)

    stageInner.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
    expect(document.querySelector('.video-stage').classList.contains('is-panning')).toBe(false)
    move(100, 0)
    expect(controls.pan.y).toBe(250)

    controls.fitToContainer()
    expect(controls.pan).toEqual({ x: 0, y: 0 })
  })
})

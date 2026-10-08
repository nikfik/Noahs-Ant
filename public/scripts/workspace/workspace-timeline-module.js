//Single responsibility principle
import { escapeHtml } from '../shared/escape-html.js'
import { isVideoViewActive } from '../shared/workspace-view.js'
import { getObservationDisplayEnd } from './observations/observation-model.js'
import { createObservationStore } from './observations/observation-store.js'

// Where time 0 starts, measured from the left edge of the timeline: the 150 px label column plus an 8 px gap (see Workspace.css).
const LABEL_WIDTH = 158
const LANE_HEIGHT = 32
const MIN_LANE_WIDTH = 4
// Zoom 1x fits the whole video in view. Zooming in stops at the closer of these limits, so a long video can never
// stretch the timeline (and the page) without bound.
const MAX_TIMELINE_WIDTH = 60000
const MAX_PIXELS_PER_SECOND = 300
const ANNOUNCEMENT_MS = 3500

const videoFileName = (videoPath) => String(videoPath || '').split(/[\\/]/).pop()

export function allocateAnimalLanes(observations, animals, playhead, duration) {
  const result = new Map()
  const laneCounts = new Map()

  animals.forEach((animal) => {
    const events = observations
      .filter((item) => item.animalId === animal.id)
      .slice()
      .sort((left, right) => left.start - right.start || left.id.localeCompare(right.id))
    const laneEnds = []

    events.forEach((item) => {
      const displayEnd = item.kind === 'point'
        ? item.start + 0.0001
        : getObservationDisplayEnd(item, playhead, duration)
      const requestedLane = Number.isInteger(item.lane) && item.lane >= 0 ? item.lane : null
      let lane = requestedLane

      const laneIsFree = (candidate) => laneEnds[candidate] === undefined || laneEnds[candidate] <= item.start
      if (lane === null || !laneIsFree(lane)) {
        lane = 0
        while (!laneIsFree(lane)) lane += 1
      }

      laneEnds[lane] = Math.max(displayEnd, item.start + 0.0001)
      result.set(item.id, { lane, displayEnd })
    })

    laneCounts.set(animal.id, Math.max(1, laneEnds.length))
  })

  return { placements: result, laneCounts }
}

export function toggleObservation(observations, request, context) {
  const time = Number(context.currentTime)
  const duration = Number(context.duration)
  if (!Number.isFinite(time) || time < 0 || !Number.isFinite(duration) || duration <= 0) return observations
  if (!context.animalId || !request?.activityId) return observations

  const next = observations.map((item) => ({ ...item }))
  const trialId = context.trialId ?? null
  const matching = next.filter((item) =>
    item.animalId === context.animalId && item.activityId === request.activityId && (item.trialId ?? null) === trialId
  )

  if (!request.continuous) {
    if (context.repeat) return observations
    next.push({
      id: `observation-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`,
      animalId: context.animalId,
      activityId: request.activityId,
      activityName: request.activityName || 'Czynność',
      activityColor: request.activityColor || '#ff4f1a',
      kind: 'point',
      start: time,
      end: time,
      lane: null,
      trialId
    })
    return next
  }

  const open = matching.find((item) => item.kind === 'interval' && item.end === null)
  if (open) {
    if (time < open.start) return observations
    open.end = time
    return next
  }

  const closedAtPlayhead = matching.find((item) =>
    item.kind === 'interval' && item.end !== null && item.start <= time && time <= item.end
  )
  if (closedAtPlayhead) {
    if (time < closedAtPlayhead.start) return observations
    closedAtPlayhead.end = time
    return next
  }

  next.push({
    id: `observation-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`,
    animalId: context.animalId,
    activityId: request.activityId,
    activityName: request.activityName || 'Czynność',
    activityColor: request.activityColor || '#ff4f1a',
    kind: 'interval',
    start: time,
    end: null,
    lane: null,
    trialId
  })
  return next
}

export function createTimelineModule() {
  let animalCatalog = null
  let trialCatalog = null
  let store = null
  let duration = 0
  let currentTime = 0
  let videoPath = ''
  let zoomLevel = 0
  let effectiveScale = 1
  let announcementTimer = 0
  let snapEnabled = true
  let snapThresholdPx = 9
  let selectedId = null
  let drag = null
  let scrubbing = false
  let host = null
  let scroller = null
  let workspaceSettings = {}

  function currentAnimals() {
    return animalCatalog?.getData?.().animals || []
  }

  function activeTrialId() {
    return trialCatalog?.getActiveTrial?.()?.id ?? null
  }

  function trialObservations() {
    return store.getForTrial(activeTrialId())
  }

  function animalMap() {
    return new Map(currentAnimals().map((animal) => [animal.id, animal]))
  }

  function onStoreChange({ reason }) {
    if (reason === 'undo' || reason === 'redo' || reason === 'remove-trial') selectedId = null
    render()
    if (reason !== 'preview') emitActiveStates()
  }

  const visibleTrackWidth = () => Math.max(500, (scroller?.clientWidth || 1000) - LABEL_WIDTH)

  // How far this video can be zoomed in (1 = no zoom, the whole video fits the view).
  function maxZoom() {
    if (duration <= 0) return 1
    return Math.max(1, Math.min(MAX_TIMELINE_WIDTH, MAX_PIXELS_PER_SECOND * duration) / visibleTrackWidth())
  }

  const zoomFactor = () => maxZoom() ** (zoomLevel / 100)

  function getScaleWidth() {
    return Math.round(visibleTrackWidth() * zoomFactor())
  }

  // The slider is logarithmic (equal steps feel like equal magnification) and keeps the middle of the view in place.
  function setZoom(level) {
    const visible = (scroller?.clientWidth || 1000) - LABEL_WIDTH
    const centerTime = (scroller.scrollLeft + visible / 2) / effectiveScale
    zoomLevel = level
    render()
    if (duration > 0) scroller.scrollLeft = Math.max(0, centerTime * effectiveScale - visible / 2)
  }

  // Keeps the playhead in view when the video moves it out (playback, frame steps, seeking).
  function followPlayhead() {
    const visible = (scroller?.clientWidth || 0) - LABEL_WIDTH
    if (!scroller || visible <= 0 || duration <= 0) return

    const x = currentTime * effectiveScale
    if (x < scroller.scrollLeft || x > scroller.scrollLeft + visible) {
      scroller.scrollLeft = Math.max(0, x - visible * 0.2)
    }
  }

  function updateZoomControl() {
    const slider = host.querySelector('[data-timeline-zoom]')
    const factor = zoomFactor()
    slider.disabled = maxZoom() < 1.05
    host.querySelector('[data-timeline-zoom-value]').textContent = `${factor >= 10 ? Math.round(factor) : factor.toFixed(1)}×`
  }

  function saveTimelineSettings() {
    if (!window.electronAPI?.getAppSettings || !window.electronAPI?.saveAppSettings) return
    window.electronAPI.getAppSettings().then((settings) => window.electronAPI.saveAppSettings({
      ...settings,
      timeline: { snapEnabled, snapThresholdPx }
    })).catch((error) => console.error('Could not save timeline preferences:', error))
  }

  function formatTime(seconds) {
    const safe = Math.max(0, Number(seconds) || 0)
    const minutes = Math.floor(safe / 60)
    const wholeSeconds = Math.floor(safe % 60)
    const fraction = Math.floor((safe % 1) * 10)
    return `${String(minutes).padStart(2, '0')}:${String(wholeSeconds).padStart(2, '0')}.${fraction}`
  }

  function getTickStep() {
    const usableWidth = getScaleWidth()
    const pxPerSecond = usableWidth / Math.max(duration, 1)
    const desired = 90 / pxPerSecond
    const powers = [1, 2, 5]
    const magnitude = 10 ** Math.floor(Math.log10(Math.max(desired, 0.01)))
    return powers.map((value) => value * magnitude).find((step) => step >= desired) || 10 * magnitude
  }

  function renderRuler(width) {
    if (duration <= 0) return '<div class="timeline-no-video">Wczytaj film, aby oznaczać czynności na osi czasu.</div>'
    const step = getTickStep()
    const ticks = []
    for (let time = 0; time <= duration; time += step) {
      const x = (time / duration) * width
      ticks.push(`<span class="timeline-tick" style="left:${x}px"><i></i><b>${formatTime(time)}</b></span>`)
    }
    return `<div class="timeline-ruler-track" style="width:${width}px">${ticks.join('')}<div class="timeline-playhead-ruler" style="left:${(currentTime / duration) * width}px"></div></div>`
  }

  function renderTrackEvents(animal, lane, width, placements) {
    return trialObservations().filter((item) => item.animalId === animal.id && placements.get(item.id)?.lane === lane).map((item) => {
      const placement = placements.get(item.id)
      const left = Math.max(0, Math.min(width, (item.start / duration) * width))
      const right = Math.max(left, Math.min(width, (placement.displayEnd / duration) * width))
      const isPoint = item.kind === 'point'
      const eventWidth = isPoint ? 0 : Math.max(MIN_LANE_WIDTH, right - left)
      const selected = selectedId === item.id ? ' selected' : ''
      const isOpen = item.kind === 'interval' && item.end === null
      const style = `left:${left}px;${isPoint ? '' : `width:${eventWidth}px;`}--event-color:${escapeHtml(item.activityColor)}`
      return `<div class="timeline-event ${isPoint ? 'point' : 'interval'}${isOpen ? ' open' : ''}${selected}" data-observation-id="${escapeHtml(item.id)}" data-animal-id="${escapeHtml(item.animalId)}" title="${escapeHtml(item.activityName)} · ${formatTime(item.start)}${item.end === null ? ' · trwa' : `–${formatTime(item.end)}`} (Delete usuwa zaznaczone)" style="${style}" tabindex="0">${isPoint ? '' : `<span class="timeline-event-label">${escapeHtml(item.activityName)}</span>`}<span class="timeline-resize-handle start" data-resize="start"></span>${isPoint || isOpen ? '' : '<span class="timeline-resize-handle end" data-resize="end"></span>'}</div>`
    }).join('')
  }

  function render() {
    if (!host) return
    const animals = currentAnimals()
    if (!animals.length) {
      host.innerHTML = `<section class="timeline-panel"><header class="timeline-header"><h3>Oś czasu</h3></header><p class="timeline-empty">Dodaj zwierzęta do projektu, aby rozpocząć oznaczanie.</p></section>`
      scroller = host.querySelector('.timeline-scroller')
      return
    }

    if (!scroller) {
      host.innerHTML = `
        <section class="timeline-panel">
          <header class="timeline-header">
            <div class="timeline-title"><h3>Oś czasu</h3><span class="timeline-current-time">00:00.0</span></div>
            <div class="timeline-actions">
              <button type="button" data-timeline-action="undo" title="Cofnij (Ctrl+Z)" aria-label="Cofnij">↶</button>
              <button type="button" data-timeline-action="redo" title="Ponów (Ctrl+Y)" aria-label="Ponów">↷</button>
              <button type="button" data-timeline-action="snap" title="Przyciąganie (Alt chwilowo wyłącza)" aria-pressed="true">Snap: wł.</button>
              <label class="timeline-snap-label" title="Odległość przyciągania">Czułość <select data-timeline-snap-threshold><option value="5">Niska</option><option value="9">Średnia</option><option value="14">Wysoka</option><option value="20">Bardzo wysoka</option></select></label>
              <label class="timeline-zoom-label" title="Powiększenie osi czasu: 1× pokazuje całe wideo, dalej da się zbliżać tylko do sensownej granicy">Zoom <input type="range" min="0" max="100" step="1" value="0" data-timeline-zoom><output data-timeline-zoom-value>1×</output></label>
            </div>
          </header>
          <div class="timeline-scroller" tabindex="0" aria-label="Oś czasu zwierząt">
            <div class="timeline-content"></div>
          </div>
          <footer class="timeline-status" role="status" hidden><span data-timeline-message></span></footer>
        </section>`
      scroller = host.querySelector('.timeline-scroller')
      host.querySelector('[data-timeline-zoom]').addEventListener('input', (event) => setZoom(Number(event.target.value)))
      host.querySelectorAll('[data-timeline-action]').forEach((button) => {
        button.addEventListener('click', () => {
          if (button.dataset.timelineAction === 'undo') store.undo()
          if (button.dataset.timelineAction === 'redo') store.redo()
          if (button.dataset.timelineAction === 'snap') {
            snapEnabled = !snapEnabled
            button.textContent = `Snap: ${snapEnabled ? 'wł.' : 'wył.'}`
            button.setAttribute('aria-pressed', String(snapEnabled))
            saveTimelineSettings()
          }
        })
      })
      const snapSelect = host.querySelector('[data-timeline-snap-threshold]')
      snapSelect.value = String(snapThresholdPx)
      snapSelect.addEventListener('change', () => {
        snapThresholdPx = Number(snapSelect.value)
        saveTimelineSettings()
      })
      scroller.addEventListener('pointerdown', onPointerDown)
      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp)
      window.addEventListener('pointercancel', onPointerUp)
    }

    const content = host.querySelector('.timeline-content')
    const width = getScaleWidth()
    effectiveScale = duration > 0 ? width / duration : 1
    const laneLayout = allocateAnimalLanes(trialObservations(), animals, currentTime, duration)
    const animalLookup = animalMap()
    const rowsHtml = animals.map((animal) => {
      const count = laneLayout.laneCounts.get(animal.id) || 1
      const laneRows = Array.from({ length: count }, (_, lane) => `
        <div class="timeline-track" data-animal-id="${escapeHtml(animal.id)}" data-lane="${lane}" style="width:${width}px">
          ${renderTrackEvents(animal, lane, width, laneLayout.placements)}
          <div class="timeline-playhead" style="left:${duration > 0 ? (currentTime / duration) * width : 0}px"></div>
        </div>
      `).join('')
      return `
        <div class="timeline-animal-row" data-animal-id="${escapeHtml(animal.id)}">
          <div class="timeline-animal-label" style="--animal-color:${escapeHtml(animal.color)};height:${count * LANE_HEIGHT}px" title="${escapeHtml(animal.name)}">
            <span class="timeline-animal-swatch"></span><span>${escapeHtml(animal.name)}</span>
          </div>
          <div class="timeline-animal-lanes">${laneRows}</div>
        </div>
      `
    }).join('')

    content.innerHTML = `
      <div class="timeline-ruler-row"><div class="timeline-ruler-label" title="${escapeHtml(videoPath)}"><span class="timeline-ruler-name">${escapeHtml(videoFileName(videoPath) || 'WIDEO')}</span></div>${renderRuler(width)}</div>
      ${rowsHtml || '<div class="timeline-empty">Brak zwierząt</div>'}
    `
    host.querySelector('.timeline-current-time').textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`
    updateZoomControl()
    const snapButton = host.querySelector('[data-timeline-action="snap"]')
    snapButton.textContent = `Snap: ${snapEnabled ? 'wł.' : 'wył.'}`
    snapButton.setAttribute('aria-pressed', String(snapEnabled))
  }

  // Short feedback ("select an animal first") that shows below the timeline for a moment; nothing permanent is shown there.
  function announce(message) {
    const footer = host?.querySelector('.timeline-status')
    if (!footer) return

    footer.querySelector('[data-timeline-message]').textContent = message
    footer.hidden = false
    window.clearTimeout(announcementTimer)
    announcementTimer = window.setTimeout(() => { footer.hidden = true }, ANNOUNCEMENT_MS)
  }

  function activeAnimalId() {
    return animalCatalog?.getData?.().activeAnimalId || null
  }

  async function onActivityRequest(event) {
    const request = event.detail || {}
    const animalId = request.animalId || activeAnimalId()
    if (!animalId) {
      announce('Wybierz aktywne zwierzę przed oznaczeniem.')
      return
    }
    let exactState = null
    window.dispatchEvent(new CustomEvent('video-timeline-state-request', {
      detail: { respond: (state) => { exactState = state } }
    }))
    if (exactState) onVideoState({ detail: exactState })
    if (!(duration > 0)) {
      announce('Wczytaj film przed oznaczaniem.')
      return
    }
    const current = store.getAll()
    const next = toggleObservation(current, request, { animalId, currentTime, duration, repeat: request.repeat, trialId: activeTrialId() })
    if (next === current) return
    await store.commit(next)
    announce(`${request.activityName || 'Czynność'} · ${formatTime(currentTime)}`)
  }

  // The playhead and the edges of the other events act as magnets; without one nearby the time falls back to the frame grid.
  function snapTime(time, event) {
    if (!snapEnabled || event.altKey) return time
    const magnets = [currentTime]
    trialObservations().filter((item) => item.id !== drag?.id).forEach((item) => {
      magnets.push(item.start)
      if (item.end !== null) magnets.push(item.end)
    })
    const closest = magnets.reduce((best, magnet) => Math.abs(magnet - time) < Math.abs(best - time) ? magnet : best)
    if (Math.abs(closest - time) <= snapThresholdPx / effectiveScale) return closest

    const frameStep = 1 / 30
    return Math.round(time / frameStep) * frameStep
  }

  function timeFromClientX(clientX) {
    const scrollRect = scroller.getBoundingClientRect()
    const x = clientX - scrollRect.left + scroller.scrollLeft - LABEL_WIDTH
    return Math.max(0, Math.min(duration, x / effectiveScale))
  }

  function movePlayhead() {
    host.querySelectorAll('.timeline-playhead, .timeline-playhead-ruler').forEach((node) => {
      node.style.left = `${currentTime * effectiveScale}px`
    })
    host.querySelector('.timeline-current-time').textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`
  }

  // The playhead follows the pointer at once; the video catches up with its own seek afterwards.
  function scrubTo(clientX) {
    const time = timeFromClientX(clientX)
    currentTime = time
    const hasOpenInterval = trialObservations().some((item) => item.kind === 'interval' && item.end === null)
    if (hasOpenInterval) render()
    else movePlayhead()
    window.dispatchEvent(new CustomEvent('video-seek-request', { detail: { time } }))
  }

  function onPointerDown(event) {
    if (duration <= 0 || event.button !== 0) return
    const itemNode = event.target.closest('.timeline-event')
    if (itemNode) {
      startDrag(event, itemNode)
    } else if (event.target.closest('.timeline-ruler-track')) {
      scrubbing = true
      scroller.setPointerCapture?.(event.pointerId)
      scrubTo(event.clientX)
      event.preventDefault()
    }
  }

  function startDrag(event, itemNode) {
    const observation = store.getAll().find((item) => item.id === itemNode.dataset.observationId)
    if (!observation) return
    selectedId = observation.id
    const original = { ...observation }
    const resize = observation.kind === 'point' ? null : event.target.closest('[data-resize]')?.dataset.resize || null
    drag = {
      id: observation.id,
      animalId: observation.animalId,
      mode: resize || (observation.kind === 'point' ? 'move-point' : 'move'),
      startX: event.clientX,
      startY: event.clientY,
      initial: original,
      initialLane: Number(itemNode.closest('.timeline-track')?.dataset.lane) || 0,
      before: store.snapshot(),
      moved: false,
      altKey: event.altKey
    }
    scroller.setPointerCapture?.(event.pointerId)
    render()
    event.preventDefault()
  }

  function onPointerMove(event) {
    if (scrubbing) {
      scrubTo(event.clientX)
      return
    }
    if (!drag || duration <= 0) return
    if (!store.getAll().some((item) => item.id === drag.id)) return
    const deltaX = (event.clientX - drag.startX) / effectiveScale
    const deltaY = event.clientY - drag.startY
    if (Math.abs(deltaX) < 0.025 && Math.abs(deltaY) < 5 && !drag.moved) return
    drag.moved = true

    const changes = {}
    if (drag.mode === 'move' || drag.mode === 'move-point') {
      const nextStart = snapTime(Math.max(0, drag.initial.start + deltaX), event, drag.initial)
      changes.start = nextStart
      if (drag.initial.end !== null) changes.end = Math.max(nextStart, drag.initial.end + (nextStart - drag.initial.start))
    } else if (drag.mode === 'start') {
      const nextStart = snapTime(Math.max(0, drag.initial.start + deltaX), event, drag.initial)
      changes.start = Math.min(nextStart, drag.initial.end === null ? duration : drag.initial.end - 1 / 30)
    } else if (drag.mode === 'end') {
      const nextEnd = snapTime(Math.max(drag.initial.start + 1 / 30, drag.initial.end + deltaX), event, drag.initial)
      changes.end = Math.min(duration, nextEnd)
    }
    changes.lane = Math.max(0, Math.round(drag.initialLane + deltaY / LANE_HEIGHT))

    store.preview(store.getAll().map((item) => item.id === drag.id ? { ...item, ...changes } : item))
  }

  async function onPointerUp() {
    scrubbing = false
    if (!drag) return
    const completedDrag = drag
    drag = null
    if (completedDrag.moved) {
      await store.finishPreview(completedDrag.before)
    } else {
      render()
    }
  }

  function emitActiveStates() {
    const active = new Set(trialObservations().filter((item) => item.kind === 'interval' && item.end === null).map((item) => `${item.animalId}:${item.activityId}`))
    window.dispatchEvent(new CustomEvent('timeline-active-observations', { detail: { active } }))
  }

  async function removeSelected() {
    if (!selectedId) return
    const removedId = selectedId
    selectedId = null
    await store.commit(store.getAll().filter((item) => item.id !== removedId))
  }

  function onKeyDown(event) {
    const target = event.target
    if (target?.matches?.('input, textarea, select, [contenteditable="true"]')) return
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      if (event.shiftKey) store.redo()
      else store.undo()
      return
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
      event.preventDefault()
      store.redo()
      return
    }
    if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId && isVideoViewActive()) {
      event.preventDefault()
      removeSelected()
    }
  }

  function onVideoState(event) {
    const state = event.detail || {}
    duration = Math.max(0, Number(state.duration) || 0)
    videoPath = typeof state.videoPath === 'string' ? state.videoPath : ''
    // While scrubbing, the video's delayed position reports must not pull the playhead back.
    if (scrubbing) return
    currentTime = Math.max(0, Number(state.currentTime) || 0)
    if (drag) return

    render()
    followPlayhead()
  }

  async function init(containerId = 'events-module', options = {}) {
    host = document.getElementById(containerId)
    if (!host) return
    animalCatalog = options.animalCatalog || null
    trialCatalog = options.trialCatalog || null
    store = options.observationStore
    if (!store) {
      store = createObservationStore({ projectId: options.projectId || '', api: window.electronAPI })
      await store.load()
    }
    store.subscribe(onStoreChange)

    try {
      workspaceSettings = await window.electronAPI?.getAppSettings?.() || {}
      snapEnabled = workspaceSettings.timeline?.snapEnabled ?? true
      snapThresholdPx = workspaceSettings.timeline?.snapThresholdPx ?? 9
    } catch (_error) {
      workspaceSettings = {}
    }

    window.addEventListener('video-timeline-state', onVideoState)
    window.addEventListener('resize', () => render())
    window.addEventListener('etogram-activity-request', onActivityRequest)
    window.addEventListener('active-animal-changed', () => render())
    window.addEventListener('active-trial-changed', () => {
      selectedId = null
      render()
      emitActiveStates()
    })
    document.addEventListener('keydown', onKeyDown)
    render()
    return { getObservations: () => store.getAll().map((item) => ({ ...item })) }
  }

  return { init }
}

export const WorkspaceTimelineModule = createTimelineModule()

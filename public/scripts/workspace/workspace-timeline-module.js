import { normalizeObservationData, getObservationDisplayEnd } from './observations/observation-model.js'

const LABEL_WIDTH = 150
const LANE_HEIGHT = 32
const MIN_LANE_WIDTH = 4
const MAX_HISTORY = 100

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character])

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
  const matching = next.filter((item) => item.animalId === context.animalId && item.activityId === request.activityId)

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
      lane: null
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
    lane: null
  })
  return next
}

export function createTimelineModule() {
  let projectId = ''
  let animalCatalog = null
  let observations = []
  let duration = 0
  let currentTime = 0
  let paused = true
  let pixelsPerSecond = 24
  let effectiveScale = 24
  let snapEnabled = true
  let snapThresholdPx = 9
  let selectedId = null
  let history = []
  let future = []
  let drag = null
  let saveQueue = Promise.resolve()
  let host = null
  let scroller = null
  let workspaceSettings = {}

  function currentAnimals() {
    return animalCatalog?.getData?.().animals || []
  }

  function animalMap() {
    return new Map(currentAnimals().map((animal) => [animal.id, animal]))
  }

  function pushHistory() {
    history.push(JSON.stringify(observations))
    if (history.length > MAX_HISTORY) history.shift()
    future = []
  }

  function persist() {
    if (!projectId || !window.electronAPI?.saveProjectObservations) return Promise.resolve()
    const snapshot = { version: 1, observations: observations.map((item) => ({ ...item })) }
    saveQueue = saveQueue.catch(() => {}).then(() => window.electronAPI.saveProjectObservations(projectId, snapshot))
    return saveQueue
  }

  async function commit(nextObservations) {
    pushHistory()
    observations = normalizeObservationData({ observations: nextObservations }).observations
    render()
    await persist()
    emitActiveStates()
  }

  async function restoreFromHistory(source, destination) {
    if (!source.length) return
    destination.push(JSON.stringify(observations))
    observations = normalizeObservationData({ observations: JSON.parse(source.pop()) }).observations
    selectedId = null
    render()
    await persist()
    emitActiveStates()
  }

  function getScaleWidth() {
    const availableWidth = Math.max(500, (scroller?.clientWidth || 1000) - LABEL_WIDTH)
    return Math.max(availableWidth, duration * pixelsPerSecond)
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
    return observations.filter((item) => item.animalId === animal.id && placements.get(item.id)?.lane === lane).map((item) => {
      const placement = placements.get(item.id)
      const left = Math.max(0, Math.min(width, (item.start / duration) * width))
      const right = Math.max(left, Math.min(width, (placement.displayEnd / duration) * width))
      const isPoint = item.kind === 'point'
      const eventWidth = isPoint ? 0 : Math.max(MIN_LANE_WIDTH, right - left)
      const selected = selectedId === item.id ? ' selected' : ''
      const isOpen = item.kind === 'interval' && item.end === null
      const style = `left:${left}px;${isPoint ? '' : `width:${eventWidth}px;`}--event-color:${escapeHtml(item.activityColor)}`
      return `<div class="timeline-event ${isPoint ? 'point' : 'interval'}${isOpen ? ' open' : ''}${selected}" data-observation-id="${escapeHtml(item.id)}" data-animal-id="${escapeHtml(item.animalId)}" title="${escapeHtml(item.activityName)} · ${formatTime(item.start)}${item.end === null ? ' · trwa' : `–${formatTime(item.end)}`}" style="${style}" tabindex="0">${isPoint ? '' : `<span class="timeline-event-label">${escapeHtml(item.activityName)}</span>`}<span class="timeline-resize-handle start" data-resize="start"></span>${isPoint || isOpen ? '' : '<span class="timeline-resize-handle end" data-resize="end"></span>'}</div>`
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
              <label class="timeline-zoom-label" title="Powiększenie osi">Zoom <input type="range" min="1" max="80" value="24" data-timeline-zoom></label>
            </div>
          </header>
          <div class="timeline-scroller" tabindex="0" aria-label="Oś czasu zwierząt">
            <div class="timeline-content"></div>
          </div>
          <footer class="timeline-status"><span data-timeline-message>Gotowe</span><span>Delete usuwa zaznaczone zdarzenie · Alt wyłącza Snap</span></footer>
        </section>`
      scroller = host.querySelector('.timeline-scroller')
      host.querySelector('[data-timeline-zoom]').addEventListener('input', (event) => {
        pixelsPerSecond = Number(event.target.value)
        render()
      })
      host.querySelectorAll('[data-timeline-action]').forEach((button) => {
        button.addEventListener('click', () => {
          if (button.dataset.timelineAction === 'undo') restoreFromHistory(history, future)
          if (button.dataset.timelineAction === 'redo') restoreFromHistory(future, history)
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
      scroller.addEventListener('click', onTimelineClick)
    }

    const content = host.querySelector('.timeline-content')
    const width = getScaleWidth()
    effectiveScale = duration > 0 ? width / duration : pixelsPerSecond
    const laneLayout = allocateAnimalLanes(observations, animals, currentTime, duration)
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
      <div class="timeline-ruler-row"><div class="timeline-ruler-label">WIDEO</div>${renderRuler(width)}</div>
      ${rowsHtml || '<div class="timeline-empty">Brak zwierząt</div>'}
    `
    host.querySelector('.timeline-current-time').textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`
    host.querySelector('[data-timeline-message]').textContent = paused ? 'Wstrzymano' : 'Odtwarzanie'
    const snapButton = host.querySelector('[data-timeline-action="snap"]')
    snapButton.textContent = `Snap: ${snapEnabled ? 'wł.' : 'wył.'}`
    snapButton.setAttribute('aria-pressed', String(snapEnabled))
  }

  function announce(message) {
    const node = host?.querySelector('[data-timeline-message]')
    if (node) node.textContent = message
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
    const next = toggleObservation(observations, request, { animalId, currentTime, duration, repeat: request.repeat })
    if (next === observations) return
    await commit(next)
    announce(`${request.activityName || 'Czynność'} · ${formatTime(currentTime)}`)
  }

  function snapTime(time, event, original) {
    if (!snapEnabled || event.altKey) return time
    const frameStep = 1 / 30
    const candidates = [Math.round(time / frameStep) * frameStep]
    observations.forEach((item) => {
      candidates.push(item.start)
      if (item.end !== null) candidates.push(item.end)
    })
    const maxDistance = snapThresholdPx / effectiveScale
    const closest = candidates.reduce((best, candidate) =>
      Math.abs(candidate - time) < Math.abs(best - time) ? candidate : best, time)
    return Math.abs(closest - time) <= maxDistance ? closest : time
  }

  function timeFromClientX(clientX) {
    const scrollRect = scroller.getBoundingClientRect()
    const x = clientX - scrollRect.left + scroller.scrollLeft - LABEL_WIDTH
    return Math.max(0, Math.min(duration, x / effectiveScale))
  }

  function onPointerDown(event) {
    if (duration <= 0 || event.button !== 0) return
    const itemNode = event.target.closest('.timeline-event')
    if (!itemNode) return
    const observation = observations.find((item) => item.id === itemNode.dataset.observationId)
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
      before: JSON.stringify(observations),
      moved: false,
      altKey: event.altKey
    }
    scroller.setPointerCapture?.(event.pointerId)
    render()
    event.preventDefault()
  }

  function onPointerMove(event) {
    if (!drag || duration <= 0) return
    const observation = observations.find((item) => item.id === drag.id)
    if (!observation) return
    const deltaX = (event.clientX - drag.startX) / effectiveScale
    const deltaY = event.clientY - drag.startY
    if (Math.abs(deltaX) < 0.025 && Math.abs(deltaY) < 5 && !drag.moved) return
    drag.moved = true

    if (drag.mode === 'move' || drag.mode === 'move-point') {
      let nextStart = Math.max(0, drag.initial.start + deltaX)
      nextStart = snapTime(nextStart, event, drag.initial)
      const shift = nextStart - drag.initial.start
      observation.start = nextStart
      if (drag.initial.end !== null) observation.end = Math.max(nextStart, drag.initial.end + shift)
    } else if (drag.mode === 'start') {
      const nextStart = snapTime(Math.max(0, drag.initial.start + deltaX), event, drag.initial)
      observation.start = Math.min(nextStart, observation.end === null ? duration : observation.end - 1 / 30)
    } else if (drag.mode === 'end') {
      const nextEnd = snapTime(Math.max(drag.initial.start + 1 / 30, drag.initial.end + deltaX), event, drag.initial)
      observation.end = Math.min(duration, nextEnd)
    }

    const targetLane = Math.max(0, Math.round(drag.initialLane + deltaY / LANE_HEIGHT))
    observation.lane = targetLane
    render()
  }

  async function onPointerUp() {
    if (!drag) return
    const completedDrag = drag
    const changed = completedDrag.moved
    drag = null
    if (changed) {
      history.push(completedDrag.before)
      if (history.length > MAX_HISTORY) history.shift()
      future = []
      render()
      await persist()
    } else {
      render()
    }
  }

  function onTimelineClick(event) {
    if (event.target.closest('.timeline-event')) return
    if (event.target.closest('.timeline-ruler-track') && duration > 0) {
      window.dispatchEvent(new CustomEvent('video-seek-request', { detail: { time: timeFromClientX(event.clientX) } }))
    }
  }

  function emitActiveStates() {
    const active = new Set(observations.filter((item) => item.kind === 'interval' && item.end === null).map((item) => `${item.animalId}:${item.activityId}`))
    window.dispatchEvent(new CustomEvent('timeline-active-observations', { detail: { active } }))
  }

  async function removeSelected() {
    if (!selectedId) return
    await commit(observations.filter((item) => item.id !== selectedId))
    selectedId = null
  }

  function onKeyDown(event) {
    const target = event.target
    if (target?.matches?.('input, textarea, select, [contenteditable="true"]')) return
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      restoreFromHistory(event.shiftKey ? future : history, event.shiftKey ? history : future)
      return
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
      event.preventDefault()
      restoreFromHistory(future, history)
      return
    }
    if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId) {
      event.preventDefault()
      removeSelected()
    }
  }

  function onVideoState(event) {
    const state = event.detail || {}
    currentTime = Math.max(0, Number(state.currentTime) || 0)
    duration = Math.max(0, Number(state.duration) || 0)
    paused = state.paused !== false
    if (!drag) render()
  }

  async function init(containerId = 'events-module', options = {}) {
    host = document.getElementById(containerId)
    if (!host) return
    projectId = options.projectId || ''
    animalCatalog = options.animalCatalog || null
    try {
      const stored = await window.electronAPI?.getProjectObservations?.(projectId)
      observations = normalizeObservationData(stored).observations
    } catch (error) {
      observations = []
      console.error('Could not load project observations:', error)
    }

    try {
      workspaceSettings = await window.electronAPI?.getAppSettings?.() || {}
      snapEnabled = workspaceSettings.timeline?.snapEnabled ?? true
      snapThresholdPx = workspaceSettings.timeline?.snapThresholdPx ?? 9
    } catch (_error) {
      workspaceSettings = {}
    }

    window.addEventListener('video-timeline-state', onVideoState)
    window.addEventListener('etogram-activity-request', onActivityRequest)
    window.addEventListener('active-animal-changed', () => render())
    document.addEventListener('keydown', onKeyDown)
    render()
    return { getObservations: () => observations.map((item) => ({ ...item })) }
  }

  return { init }
}

export const WorkspaceTimelineModule = createTimelineModule()

if (typeof window !== 'undefined') {
  window.WorkspaceTimelineModule = WorkspaceTimelineModule
}

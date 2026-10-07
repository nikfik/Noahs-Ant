import { normalizeObservationData } from './observation-model.js'

const MAX_HISTORY = 100

const normalize = (observations) => normalizeObservationData({ observations }).observations

export function createObservationStore({ projectId = '', api = null } = {}) {
  let observations = []
  let history = []
  let future = []
  let saveQueue = Promise.resolve()
  const listeners = new Set()

  function notify(reason) {
    listeners.forEach((listener) => listener({ observations, reason }))
  }

  function persist() {
    if (!projectId || !api?.saveProjectObservations) return Promise.resolve()
    const snapshot = { version: 1, observations: observations.map((item) => ({ ...item })) }
    saveQueue = saveQueue.catch(() => {}).then(() => api.saveProjectObservations(projectId, snapshot))
    return saveQueue
  }

  function pushHistory(snapshot) {
    history.push(snapshot)
    if (history.length > MAX_HISTORY) history.shift()
    future = []
  }

  async function load() {
    try {
      observations = normalize((await api?.getProjectObservations?.(projectId))?.observations)
    } catch (error) {
      observations = []
      console.error('Could not load project observations:', error)
    }
    history = []
    future = []
    notify('load')
    return observations
  }

  function getAll() {
    return observations
  }

  function getForTrial(trialId) {
    return observations.filter((item) => (item.trialId ?? null) === (trialId ?? null))
  }

  function snapshot() {
    return JSON.stringify(observations)
  }

  function subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  async function commit(nextObservations) {
    pushHistory(snapshot())
    observations = normalize(nextObservations)
    notify('commit')
    await persist()
  }

  // A preview changes what subscribers see without touching history or disk (used while dragging).
  function preview(nextObservations) {
    observations = nextObservations
    notify('preview')
  }

  async function finishPreview(beforeSnapshot) {
    pushHistory(beforeSnapshot)
    observations = normalize(observations)
    notify('commit')
    await persist()
  }

  async function restore(source, destination, reason) {
    if (!source.length) return
    destination.push(snapshot())
    observations = normalize(JSON.parse(source.pop()))
    notify(reason)
    await persist()
  }

  const undo = () => restore(history, future, 'undo')
  const redo = () => restore(future, history, 'redo')

  async function removeTrialEvents(trialId) {
    observations = observations.filter((item) => item.trialId !== trialId)
    history = []
    future = []
    notify('remove-trial')
    await persist()
  }

  return {
    load,
    getAll,
    getForTrial,
    snapshot,
    subscribe,
    commit,
    preview,
    finishPreview,
    undo,
    redo,
    removeTrialEvents,
    canUndo: () => history.length > 0,
    canRedo: () => future.length > 0
  }
}

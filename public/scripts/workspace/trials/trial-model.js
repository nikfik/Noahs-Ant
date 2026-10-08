import { createId } from '../animals/animal-model.js'

export function createEmptyTrialData() {
  return { version: 1, activeTrialId: null, trials: [] }
}

const positiveOrNull = (value) => Number.isFinite(value) && value > 0 ? value : null
const nonNegativeOrNull = (value) => Number.isFinite(value) && value >= 0 ? value : null

function normalizeTrial(trial) {
  const windowStart = nonNegativeOrNull(trial.windowStart)
  const windowEnd = positiveOrNull(trial.windowEnd)
  return {
    id: String(trial.id || createId('trial')),
    name: String(trial.name || '').trim() || 'Bez nazwy',
    videoPath: typeof trial.videoPath === 'string' ? trial.videoPath : '',
    // The original file when the player works on a converted copy (e.g. a camera MTS file).
    sourcePath: typeof trial.sourcePath === 'string' ? trial.sourcePath : '',
    // Pictures per second of the video; frame steps and snapping use it instead of a fixed 30.
    frameRate: positiveOrNull(trial.frameRate),
    duration: positiveOrNull(trial.duration),
    windowStart,
    windowEnd: windowEnd !== null && windowEnd <= (windowStart ?? 0) ? null : windowEnd
  }
}

export function normalizeTrialData(value = {}) {
  const source = value && typeof value === 'object' ? value : {}
  const seenIds = new Set()
  const trials = (Array.isArray(source.trials) ? source.trials : [])
    .filter((trial) => trial && typeof trial === 'object')
    .map(normalizeTrial)
    .filter((trial) => !seenIds.has(trial.id) && seenIds.add(trial.id))

  const activeTrialId = trials.some((trial) => trial.id === source.activeTrialId)
    ? source.activeTrialId
    : trials[0]?.id ?? null

  return { version: 1, activeTrialId, trials }
}

export function getActiveTrial(data) {
  return data.trials.find((trial) => trial.id === data.activeTrialId) || null
}

export function nextTrialName(data) {
  const names = new Set(data.trials.map((trial) => trial.name))
  let number = data.trials.length + 1
  while (names.has(`Próba ${number}`)) number += 1
  return `Próba ${number}`
}

export function createTrial(data, name, videoPath = '') {
  const normalized = normalizeTrialData(data)
  const trial = normalizeTrial({ id: createId('trial'), name: String(name || '').trim() || nextTrialName(normalized), videoPath })
  return { ...normalized, activeTrialId: trial.id, trials: [...normalized.trials, trial] }
}

export function ensureDefaultTrial(data, videoPath = '') {
  const normalized = normalizeTrialData(data)
  return normalized.trials.length ? normalized : createTrial(normalized, 'Próba 1', videoPath)
}

export function updateTrial(data, trialId, changes) {
  const normalized = normalizeTrialData(data)
  return normalizeTrialData({
    ...normalized,
    trials: normalized.trials.map((trial) => trial.id === trialId ? { ...trial, ...changes } : trial)
  })
}

export function setActiveTrial(data, trialId) {
  const normalized = normalizeTrialData(data)
  return normalized.trials.some((trial) => trial.id === trialId)
    ? { ...normalized, activeTrialId: trialId }
    : normalized
}

export function removeTrial(data, trialId) {
  const normalized = normalizeTrialData(data)
  if (normalized.trials.length <= 1) return normalized
  return normalizeTrialData({
    ...normalized,
    trials: normalized.trials.filter((trial) => trial.id !== trialId)
  })
}

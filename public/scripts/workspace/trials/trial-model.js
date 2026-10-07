import { createId } from '../animals/animal-model.js'

export function createEmptyTrialData() {
  return { version: 1, activeTrialId: null, trials: [] }
}

export function normalizeTrialData(value = {}) {
  const source = value && typeof value === 'object' ? value : {}
  const seenIds = new Set()
  const trials = (Array.isArray(source.trials) ? source.trials : [])
    .filter((trial) => trial && typeof trial === 'object')
    .map((trial) => ({
      id: String(trial.id || createId('trial')),
      name: String(trial.name || '').trim() || 'Bez nazwy',
      videoPath: typeof trial.videoPath === 'string' ? trial.videoPath : ''
    }))
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
  const trial = { id: createId('trial'), name: String(name || '').trim() || nextTrialName(normalized), videoPath }
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

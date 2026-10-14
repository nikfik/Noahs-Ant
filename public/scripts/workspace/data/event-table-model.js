const COLOR_PATTERN = /^#[0-9a-f]{6}$/i

export function formatSeconds(value) {
  return Number.isFinite(value) ? value.toFixed(3) : ''
}

// Accepts plain seconds ("12.5", "12,5") or m:ss.f ("1:02.5"). Returns null for empty input, NaN for invalid input.
export function parseTimeInput(text) {
  const raw = String(text ?? '').trim().replace(',', '.')
  if (!raw) return null

  const clock = raw.match(/^(\d+):(\d{1,2}(?:\.\d+)?)$/)
  if (clock) return Number(clock[1]) * 60 + Number(clock[2])
  return /^\d+(\.\d+)?$/.test(raw) ? Number(raw) : NaN
}

export function getAnimalActivities(animal, presets = []) {
  const preset = presets.find((item) => item.id === animal?.etogramPresetId)
  return (preset?.activities || []).map((activity) => ({
    id: String(activity.id),
    name: String(activity.name || 'Bez nazwy'),
    color: COLOR_PATTERN.test(activity.color) ? activity.color : '#ff4f1a',
    category: String(activity.category || '').trim(),
    continuous: Boolean(activity.continuous)
  }))
}

export function buildEventRows(observations, { trials = [], animals = [], trialFilter = 'all', animalFilter = 'all' } = {}) {
  const trialOrder = new Map(trials.map((trial, index) => [trial.id, index]))
  const trialNames = new Map(trials.map((trial) => [trial.id, trial.name]))
  const animalById = new Map(animals.map((animal) => [animal.id, animal]))

  return observations
    .filter((item) => (trialFilter === 'all' || (item.trialId ?? null) === trialFilter)
      && (animalFilter === 'all' || item.animalId === animalFilter))
    .map((item) => ({
      ...item,
      trialName: trialNames.get(item.trialId) ?? '—',
      animalName: animalById.get(item.animalId)?.name ?? '—',
      duration: item.kind === 'interval' && item.end !== null ? item.end - item.start : null
    }))
    .sort((left, right) =>
      (trialOrder.get(left.trialId) ?? Infinity) - (trialOrder.get(right.trialId) ?? Infinity)
      || left.start - right.start
      || left.id.localeCompare(right.id))
}

function validTime(raw) {
  const value = parseTimeInput(raw)
  return value === null || Number.isNaN(value) || value < 0 ? undefined : value
}

// Returns { observations } with the edit applied, or { error } with a message for the user. Never mutates its input.
export function applyEventEdit(observations, id, field, rawValue, { animals = [], trials = [], getActivities = () => [] } = {}) {
  const index = observations.findIndex((item) => item.id === id)
  if (index < 0) return { error: 'Nie znaleziono zdarzenia.' }
  const item = observations[index]
  let changes

  if (field === 'start') {
    const start = validTime(rawValue)
    if (start === undefined) return { error: 'Podaj poprawny czas startu, np. 12.5 lub 1:02.5.' }
    if (item.kind === 'point') {
      changes = { start, end: start, lane: null }
    } else if (item.end !== null && start > item.end) {
      return { error: 'Start nie może być późniejszy niż koniec.' }
    } else {
      changes = { start, lane: null }
    }
  } else if (field === 'end') {
    if (item.kind === 'point') return { error: 'Zdarzenie punktowe nie ma czasu końca.' }
    if (parseTimeInput(rawValue) === null) {
      changes = { end: null, lane: null }
    } else {
      const end = validTime(rawValue)
      if (end === undefined) return { error: 'Podaj poprawny czas końca, np. 12.5 lub 1:02.5.' }
      if (end < item.start) return { error: 'Koniec nie może być wcześniejszy niż start.' }
      changes = { end, lane: null }
    }
  } else if (field === 'activityId') {
    const activity = getActivities(item.animalId).find((candidate) => candidate.id === rawValue)
    if (!activity) return { error: 'To zwierzę nie ma takiej czynności.' }
    if (activity.continuous !== (item.kind === 'interval')) {
      return { error: 'Można wybrać tylko czynność tego samego typu (punktowa albo ciągła).' }
    }
    changes = { activityId: activity.id, activityName: activity.name, activityColor: activity.color }
  } else if (field === 'animalId') {
    const animal = animals.find((candidate) => candidate.id === rawValue)
    if (!animal) return { error: 'Nie znaleziono zwierzęcia.' }
    const current = getActivities(item.animalId).find((candidate) => candidate.id === item.activityId)
    const available = getActivities(animal.id)
    const target = available.find((candidate) => candidate.id === item.activityId)
      || available.find((candidate) => current && candidate.name === current.name && candidate.continuous === current.continuous)
    if (!target) return { error: `${animal.name} nie ma czynności „${item.activityName}”.` }
    changes = { animalId: animal.id, activityId: target.id, activityName: target.name, activityColor: target.color, lane: null }
  } else if (field === 'trialId') {
    if (!trials.some((trial) => trial.id === rawValue)) return { error: 'Nie znaleziono próby.' }
    changes = { trialId: rawValue, lane: null }
  } else {
    return { error: 'Tego pola nie można edytować.' }
  }

  return { observations: observations.map((candidate, position) => position === index ? { ...candidate, ...changes } : candidate) }
}

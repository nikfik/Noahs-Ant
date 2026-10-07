import { getAnimalActivities } from './event-table-model.js'

const UNCATEGORIZED = 'Bez kategorii'

// The analysis window of a trial: the part of the video the metrics are calculated for.
// Falls back to the latest event time when the video length is not known yet (source: 'events').
export function resolveWindow(trial, trialEvents = []) {
  const start = trial?.windowStart ?? 0
  let end = trial?.windowEnd ?? trial?.duration ?? null
  let source = trial?.windowEnd ? 'custom' : trial?.duration ? 'video' : 'events'

  if (end === null) {
    end = trialEvents.reduce((latest, item) => Math.max(latest, item.end ?? item.start), 0)
    source = 'events'
  }

  return { start, end: Math.max(end, start), length: Math.max(end - start, 0), source }
}

function emptyMetrics(window) {
  return { present: false, count: 0, duration: 0, latency: null, percentOfWindow: window.length > 0 ? 0 : null, percentAfterLatency: null, window }
}

function withPercentages({ count, duration, latency }, window) {
  return {
    present: count > 0,
    count,
    duration,
    latency,
    percentOfWindow: window.length > 0 ? duration / window.length * 100 : null,
    // The sheet's own formula: time spent, divided by the time that was left after the first occurrence.
    percentAfterLatency: latency !== null && window.length - latency > 0 ? duration / (window.length - latency) * 100 : null,
    window
  }
}

// Events outside the window are ignored, events crossing its edges are clipped, and open intervals last until the window ends.
function clipToWindow(item, window) {
  const isPoint = item.kind === 'point'
  const inside = isPoint
    ? item.start >= window.start && item.start <= window.end
    : item.start <= window.end && (item.end ?? window.end) >= window.start
  if (!inside) return null

  return {
    isPoint,
    start: Math.max(item.start, window.start),
    end: Math.min(isPoint ? item.start : item.end ?? window.end, window.end)
  }
}

export function computeBehaviorMetrics(events, window) {
  let count = 0
  let duration = 0
  let firstStart = null

  events.forEach((item) => {
    const clipped = clipToWindow(item, window)
    if (!clipped) return

    count += 1
    if (!clipped.isPoint) duration += Math.max(0, clipped.end - clipped.start)
    firstStart = firstStart === null ? clipped.start : Math.min(firstStart, clipped.start)
  })

  if (!count) return emptyMetrics(window)
  return withPercentages({ count, duration, latency: firstStart - window.start }, window)
}

// Overlapping or touching intervals count once: the time is the union of the intervals and the count is the number of
// separate episodes (plus point events).
export function computeMergedMetrics(events, window) {
  const spans = []
  let points = 0
  let firstStart = null

  events.forEach((item) => {
    const clipped = clipToWindow(item, window)
    if (!clipped) return

    firstStart = firstStart === null ? clipped.start : Math.min(firstStart, clipped.start)
    if (clipped.isPoint) points += 1
    else spans.push([clipped.start, clipped.end])
  })

  let episodes = 0
  let duration = 0
  let episodeStart = null
  let episodeEnd = null
  spans.sort((left, right) => left[0] - right[0]).forEach(([start, end]) => {
    if (episodeEnd !== null && start <= episodeEnd) {
      episodeEnd = Math.max(episodeEnd, end)
      return
    }
    if (episodeEnd !== null) duration += episodeEnd - episodeStart
    episodes += 1
    episodeStart = start
    episodeEnd = end
  })
  if (episodeEnd !== null) duration += episodeEnd - episodeStart

  const count = episodes + points
  if (!count) return emptyMetrics(window)
  return withPercentages({ count, duration, latency: firstStart - window.start }, window)
}

export function hasCategoryGroups(animals = [], presets = []) {
  return animals.some((animal) => {
    const names = getAnimalActivities(animal, presets).map((activity) => activity.category).filter((name) => name && name !== UNCATEGORIZED)
    return names.some((name, index) => names.indexOf(name) !== index)
  })
}

// A category adds up its behaviors: any presence, the sum of counts and durations, the earliest latency.
export function aggregateMetrics(metricsList, window) {
  const latencies = metricsList.map((metrics) => metrics.latency).filter((latency) => latency !== null)
  return withPercentages({
    count: metricsList.reduce((sum, metrics) => sum + metrics.count, 0),
    duration: metricsList.reduce((sum, metrics) => sum + metrics.duration, 0),
    latency: latencies.length ? Math.min(...latencies) : null
  }, window)
}

// How much of a trial's events the analysis window keeps (shown next to the window settings).
export function summarizeTrialWindow(observations, trial) {
  const trialEvents = observations.filter((item) => (item.trialId ?? null) === trial.id)
  const window = resolveWindow(trial, trialEvents)
  return { window, total: trialEvents.length, inside: trialEvents.filter((item) => clipToWindow(item, window)).length }
}

// One row per trial x animal x behavior (plus a row per category with several behaviors), in the order of the project.
export function buildMetricRows(observations, { trials = [], animals = [], presets = [], trialFilter = 'all', animalFilter = 'all', includeCategories = true, mergeCategories = false } = {}) {
  const rows = []

  trials.filter((trial) => trialFilter === 'all' || trial.id === trialFilter).forEach((trial) => {
    const trialEvents = observations.filter((item) => (item.trialId ?? null) === trial.id)
    const window = resolveWindow(trial, trialEvents)

    animals.filter((animal) => animalFilter === 'all' || animal.id === animalFilter).forEach((animal) => {
      const animalEvents = trialEvents.filter((item) => item.animalId === animal.id)
      const activities = getAnimalActivities(animal, presets)
      const known = new Set(activities.map((activity) => activity.id))
      const orphans = animalEvents
        .filter((item) => !known.has(item.activityId))
        .map((item) => ({ id: item.activityId, name: item.activityName, category: '', continuous: item.kind === 'interval' }))
        .filter((activity, index, all) => all.findIndex((candidate) => candidate.id === activity.id) === index)

      const behaviorRows = [...activities, ...orphans].map((activity) => ({
        kind: 'behavior',
        trialId: trial.id,
        trialName: trial.name,
        animalId: animal.id,
        animalName: animal.name,
        activityId: activity.id,
        name: activity.name,
        category: activity.category || '',
        continuous: activity.continuous,
        ...computeBehaviorMetrics(animalEvents.filter((item) => item.activityId === activity.id), window)
      }))
      rows.push(...behaviorRows)

      if (!includeCategories) return
      const categories = new Map()
      behaviorRows.forEach((row) => {
        if (!row.category || row.category === UNCATEGORIZED) return
        categories.set(row.category, [...(categories.get(row.category) || []), row])
      })
      categories.forEach((members, category) => {
        if (members.length < 2) return
        const memberIds = new Set(members.map((member) => member.activityId))
        const totals = mergeCategories
          ? computeMergedMetrics(animalEvents.filter((item) => memberIds.has(item.activityId)), window)
          : aggregateMetrics(members, window)
        rows.push({
          kind: 'category',
          trialId: trial.id,
          trialName: trial.name,
          animalId: animal.id,
          animalName: animal.name,
          activityId: null,
          name: `Σ ${category}`,
          category,
          continuous: true,
          members: members.length,
          ...totals
        })
      })
    })
  })

  return rows
}

export function createEmptyObservationData() {
  return { version: 1, observations: [] }
}

export function normalizeObservationData(value = {}) {
  const source = value && typeof value === 'object' ? value : {}
  const observations = Array.isArray(source.observations) ? source.observations : []

  return {
    version: 1,
    observations: observations
      .filter((item) => item && typeof item === 'object')
      .map((item, index) => {
        const start = Number(item.start)
        const end = item.end === null || item.end === undefined ? null : Number(item.end)
        const isValidStart = Number.isFinite(start) && start >= 0
        const isValidEnd = end === null || (Number.isFinite(end) && end >= start)
        if (!isValidStart || !isValidEnd || !item.animalId || !item.activityId) return null

        return {
          id: String(item.id || `observation-${Date.now()}-${index}`),
          animalId: String(item.animalId),
          activityId: String(item.activityId),
          activityName: String(item.activityName || 'Czynność'),
          activityColor: /^#[0-9a-f]{6}$/i.test(item.activityColor) ? item.activityColor : '#ff4f1a',
          kind: item.kind === 'point' ? 'point' : 'interval',
          start,
          end: item.kind === 'point' ? start : end,
          lane: Number.isInteger(item.lane) && item.lane >= 0 ? item.lane : null,
          trialId: item.trialId ? String(item.trialId) : null
        }
      })
      .filter(Boolean)
  }
}

export function getObservationDisplayEnd(observation, playhead, duration) {
  if (observation.kind === 'point') return observation.start
  if (observation.end !== null) return observation.end
  if (playhead >= observation.start) return Math.min(playhead, duration)
  return duration
}

export function isObservationOpen(observation) {
  return observation.kind === 'interval' && observation.end === null
}

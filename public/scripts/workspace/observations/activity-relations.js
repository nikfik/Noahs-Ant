// Related actions: an etogram action can start or end other actions of the same animal at the very moment it happens.
// A rule reads: "when this action {starts|ends}, {start|end} the action {targetId}".
const WHEN = new Set(['start', 'end'])
const MAX_CHAIN = 50

// Keeps the well-formed, distinct rules. An empty target is kept so a half-filled rule survives while it is being edited.
export function normalizeRelations(value) {
  const seen = new Set()
  return (Array.isArray(value) ? value : [])
    .filter((rule) => rule && typeof rule === 'object' && WHEN.has(rule.when) && WHEN.has(rule.do))
    .map((rule) => ({ when: rule.when, do: rule.do, targetId: typeof rule.targetId === 'string' ? rule.targetId : '' }))
    .filter((rule) => {
      const key = `${rule.when}|${rule.do}|${rule.targetId}`
      return !seen.has(key) && seen.add(key)
    })
}

// What is saved: only rules that point at another continuous action of the same etogram, and "ends" only on continuous ones.
export function pruneRelations(rows) {
  const continuousIds = new Set(rows.filter((row) => row.continuous).map((row) => row.id))
  return rows.map((row) => ({
    ...row,
    relations: normalizeRelations(row.relations).filter((rule) =>
      rule.targetId && rule.targetId !== row.id && continuousIds.has(rule.targetId) && (rule.when === 'start' || row.continuous)
    )
  }))
}

const newObservationId = () => `observation-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`

// What the key press changed: which actions started (new observations) and which ended (an open one was closed).
function describeChanges(before, after) {
  const previous = new Map(before.map((item) => [item.id, item]))
  const changes = []
  after.forEach((item) => {
    const old = previous.get(item.id)
    if (!old) changes.push({ activityId: item.activityId, type: 'start' })
    else if (old.kind === 'interval' && old.end === null && item.end !== null) changes.push({ activityId: item.activityId, type: 'end' })
  })
  return changes
}

// Applies the rules of the actions that just started or ended and returns the new list of observations (all in one go,
// so one undo takes everything back). `activities` maps an action id to { id, name, color, continuous, relations }.
// A rule can set off further rules; every rule runs once per key press, so loops cannot go on forever.
export function applyRelations(before, after, { animalId, trialId = null, time, activities = {} }) {
  const queue = describeChanges(before, after)
  if (!queue.length || !animalId) return after

  let result = after.map((item) => ({ ...item }))
  const done = new Set()
  const isOpen = (item, activityId) => item.animalId === animalId && item.activityId === activityId && (item.trialId ?? null) === trialId && item.kind === 'interval' && item.end === null

  for (let step = 0; step < queue.length && step < MAX_CHAIN; step += 1) {
    const { activityId, type } = queue[step]
    normalizeRelations(activities[activityId]?.relations).filter((rule) => rule.when === type && rule.targetId).forEach((rule) => {
      const key = `${activityId}|${type}|${rule.do}|${rule.targetId}`
      const target = activities[rule.targetId]
      if (done.has(key) || !target?.continuous) return
      done.add(key)

      const open = result.find((item) => isOpen(item, target.id))
      if (rule.do === 'start' && !open) {
        result.push({
          id: newObservationId(),
          animalId,
          activityId: target.id,
          activityName: target.name || 'Czynność',
          activityColor: target.color || '#ff4f1a',
          kind: 'interval',
          start: time,
          end: null,
          lane: null,
          trialId
        })
        queue.push({ activityId: target.id, type: 'start' })
      } else if (rule.do === 'end' && open && time >= open.start) {
        result = result.map((item) => item === open ? { ...item, end: time } : item)
        queue.push({ activityId: target.id, type: 'end' })
      }
    })
  }

  return result
}

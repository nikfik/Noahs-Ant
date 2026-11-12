// Transition probabilities between behaviors: "after behavior A, how often does B come next?".
// Two ways to read the events:
//  - 'sequence': one state per event, in the order the events start (a repeat of the same behavior is a loop);
//  - 'parallel': a state is the set of behaviors running at the same time (e.g. "Stoi + Idzie"); the state changes
//    whenever a behavior starts or ends.
// Everything is calculated per animal and trial; the analysis window and uncounted skips are respected like in the metrics.

import { clipToWindow, effectiveOffset, resolveWindow } from '../data/metrics-model.js'

export const START = 'START'
const SEPARATOR = ' + '

export const TRANSITION_MODES = [
  { id: 'sequence', label: 'Kolejność zdarzeń', hint: 'Każde zdarzenie to jeden stan. Powtórzenie tej samej czynności to pętla.' },
  { id: 'parallel', label: 'Stany równoległe', hint: 'Stan to zestaw czynności trwających jednocześnie, np. „Stoi + Idzie”. Zdarzenia punktowe są pomijane.' }
]

function sequenceStates(events) {
  return [...events]
    .sort((left, right) => left.start - right.start || left.end - right.end || left.name.localeCompare(right.name))
    .map((event) => ({ state: event.name, time: event.start }))
}

function parallelStates(events) {
  const intervals = events.filter((event) => !event.isPoint && event.end > event.start)
  const boundaries = [...new Set(intervals.flatMap((event) => [event.start, event.end]))].sort((left, right) => left - right)
  const states = []
  boundaries.slice(0, -1).forEach((time) => {
    const active = [...new Set(intervals.filter((event) => event.start <= time && event.end > time).map((event) => event.name))].sort()
    const label = active.join(SEPARATOR)
    if (label && states[states.length - 1]?.state !== label) states.push({ state: label, time })
  })
  return states
}

// source: { observations, trials, animals, groups }
// options: { mode, animalFilter: 'all' | 'group:<id>' | 'animal:<id>', trialIds: Set | null, behaviors: Set | null, includePoints, includeStart }
export function buildTransitions(source, options = {}) {
  const { mode = 'sequence', animalFilter = 'all', trialIds = null, behaviors = null, includePoints = true, includeStart = false } = options
  const animals = (source.animals || []).filter((animal) =>
    animalFilter === 'all' || animalFilter === `animal:${animal.id}` || animalFilter === `group:${animal.groupId}`)

  const edges = new Map()
  const visits = new Map()
  let units = 0
  let totalTransitions = 0
  const note = (state) => visits.set(state, (visits.get(state) || 0) + 1)

  ;(source.trials || []).filter((trial) => !trialIds || trialIds.has(trial.id)).forEach((trial) => {
    const trialEvents = (source.observations || []).filter((item) => (item.trialId ?? null) === trial.id)
    const window = resolveWindow(trial, trialEvents)

    animals.forEach((animal) => {
      const events = trialEvents
        .filter((item) => item.animalId === animal.id && (!behaviors || behaviors.has(item.activityName)))
        .filter((item) => mode === 'parallel' ? item.kind === 'interval' : includePoints || item.kind === 'interval')
        .map((item) => {
          const clipped = clipToWindow(item, window)
          return clipped ? { ...clipped, name: item.activityName } : null
        })
        .filter(Boolean)
      const states = mode === 'parallel' ? parallelStates(events) : sequenceStates(events)
      if (!states.length) return

      units += 1
      states.forEach(({ state }) => note(state))
      const path = includeStart ? [{ state: START, time: null }, ...states] : states
      if (includeStart) note(START)

      for (let index = 0; index < path.length - 1; index += 1) {
        const key = `${path[index].state}\u0000${path[index + 1].state}`
        const edge = edges.get(key) || { from: path[index].state, to: path[index + 1].state, count: 0, latencies: [] }
        edge.count += 1
        if (index === 0 && includeStart) edge.latencies.push(effectiveOffset(window, states[0].time))
        edges.set(key, edge)
        totalTransitions += 1
      }
    })
  })

  const outgoing = new Map()
  edges.forEach((edge) => outgoing.set(edge.from, (outgoing.get(edge.from) || 0) + edge.count))
  const edgeList = [...edges.values()].map((edge) => ({
    from: edge.from,
    to: edge.to,
    count: edge.count,
    probability: edge.count / outgoing.get(edge.from),
    meanLatency: edge.latencies.length ? edge.latencies.reduce((total, value) => total + value, 0) / edge.latencies.length : null
  })).sort((left, right) => left.from.localeCompare(right.from) || right.probability - left.probability)

  const nodes = [...visits.entries()]
    .map(([id, count]) => ({ id, label: id, visits: count, isStart: id === START }))
    .sort((left, right) => Number(right.isStart) - Number(left.isStart) || right.visits - left.visits || left.label.localeCompare(right.label))

  return { mode, nodes, edges: edgeList, units, totalTransitions }
}

// The same numbers as a table: one row per "from" state, one column per "to" state.
export function transitionMatrix(result) {
  const columns = result.nodes.filter((node) => !node.isStart)
  const rows = result.nodes.filter((node) => result.edges.some((edge) => edge.from === node.id))
  const edgeOf = (from, to) => result.edges.find((edge) => edge.from === from && edge.to === to)
  return { columns: columns.map((node) => node.label), rows: rows.map((node) => ({ label: node.label, cells: columns.map((column) => edgeOf(node.id, column.id) || null) })) }
}

// A "time skip" is a stretch of a trial's video that is not worth watching (e.g. the animal left the frame).
// The player jumps over it; `countTime` says whether that time still belongs to the analysis.
import { createId } from '../animals/animal-model.js'

const finiteNumber = (value) => typeof value === 'number' && Number.isFinite(value)

export function createSkip(start, end, countTime = false) {
  return { id: createId('skip'), start, end, countTime: Boolean(countTime) }
}

// Drops invalid entries and keeps the rest in time order.
export function normalizeSkips(value) {
  const seen = new Set()
  return (Array.isArray(value) ? value : [])
    .filter((skip) => skip && typeof skip === 'object' && finiteNumber(skip.start) && finiteNumber(skip.end) && skip.start >= 0 && skip.end > skip.start)
    .map((skip) => ({ id: String(skip.id || createId('skip')), start: skip.start, end: skip.end, countTime: skip.countTime === true }))
    .filter((skip) => !seen.has(skip.id) && seen.add(skip.id))
    .sort((left, right) => left.start - right.start || left.end - right.end)
}

// The skip the given time falls into (start included, end excluded), or null.
export function skipAt(skips, time) {
  return (skips || []).find((skip) => time >= skip.start && time < skip.end) || null
}

// Overlapping ranges become one, so time is never subtracted twice.
export function mergeRanges(ranges) {
  const merged = []
  ;[...ranges].sort((left, right) => left[0] - right[0]).forEach(([start, end]) => {
    const last = merged[merged.length - 1]
    if (last && start <= last[1]) last[1] = Math.max(last[1], end)
    else merged.push([start, end])
  })
  return merged
}

// The skips whose time is not counted, clipped to [from, to] and merged: what the metrics take out of the window.
export function excludedRanges(skips, from, to) {
  return mergeRanges(
    (skips || [])
      .filter((skip) => !skip.countTime)
      .map((skip) => [Math.max(skip.start, from), Math.min(skip.end, to)])
      .filter(([start, end]) => end > start)
  )
}

// How much of [start, end] lies inside the given (merged) ranges.
export function overlapWith(ranges, start, end) {
  return ranges.reduce((total, [from, to]) => total + Math.max(0, Math.min(end, to) - Math.max(start, from)), 0)
}

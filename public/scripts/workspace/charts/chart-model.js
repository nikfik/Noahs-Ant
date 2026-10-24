// Turns the project's metrics into the numbers a chart shows. One data point is one trial of one category (a group of
// animals, one animal, ...): the values of all animals of the category in that trial are combined into one number.
import { buildMetricRows } from '../data/metrics-model.js'

export const METRICS = [
  { id: 'duration', label: 'czas łączny', unit: 's', combine: 'sum', continuousOnly: true },
  { id: 'count', label: 'liczba', unit: '', combine: 'sum' },
  { id: 'latency', label: 'latencja', unit: 's', combine: 'min' },
  { id: 'percentOfWindow', label: '% okna', unit: '%', combine: 'sum', continuousOnly: true },
  { id: 'present', label: 'wystąpiła (tak/nie)', unit: '', combine: 'max' }
]

export const GROUPINGS = [
  { id: 'group', label: 'Grupa zwierząt', hint: 'np. gatunek' },
  { id: 'animal', label: 'Zwierzę', hint: 'każde zwierzę osobno' },
  { id: 'trial', label: 'Próba', hint: 'każde nagranie osobno' }
]

export const AGGREGATES = [
  { id: 'mean', label: 'Średnia ± SE' },
  { id: 'sum', label: 'Suma' },
  { id: 'median', label: 'Mediana' },
  { id: 'percent', label: '% prób z wystąpieniem' }
]

export const CHART_KINDS = [
  { id: 'bar', label: 'Słupkowy' },
  { id: 'box', label: 'Pudełkowy' }
]

const metricById = new Map(METRICS.map((metric) => [metric.id, metric]))
const valueBlockId = (behavior, metricId) => `value|${metricId}|${behavior}`

export function parseValueBlock(id) {
  const [kind, metricId, ...rest] = String(id).split('|')
  const metric = metricById.get(metricId)
  return kind === 'value' && metric ? { id, metric, behavior: rest.join('|') } : null
}

// The pairs "animal in trial" that were actually observed: the animal has at least one event in that trial.
function observedPairs(observations) {
  return new Set(observations.map((item) => `${item.trialId ?? ''}|${item.animalId}`))
}

function metricRowsFor({ observations, trials, animals, presets }) {
  const observed = observedPairs(observations)
  return buildMetricRows(observations, { trials, animals, presets, includeCategories: true })
    .filter((row) => observed.has(`${row.trialId}|${row.animalId}`))
}

// Everything that can be dragged into a chart: the value blocks (behavior x metric) and the grouping blocks.
export function buildBlocks({ observations = [], trials = [], animals = [], presets = [] } = {}) {
  const rows = buildMetricRows(observations, { trials, animals, presets, includeCategories: true })
  const behaviors = []
  rows.forEach((row) => {
    if (!behaviors.some((item) => item.name === row.name)) behaviors.push({ name: row.name, continuous: row.continuous, category: row.kind === 'category' })
  })

  const values = behaviors.flatMap((behavior) => METRICS
    .filter((metric) => !metric.continuousOnly || behavior.continuous)
    .map((metric) => ({
      id: valueBlockId(behavior.name, metric.id),
      behavior: behavior.name,
      metric,
      label: `${behavior.name} · ${metric.label}`,
      isCategory: behavior.category
    })))

  return { values, groupings: GROUPINGS }
}

function categoryOf(row, grouping, { animals, groups }) {
  if (grouping === 'none') return { key: 'all', label: 'Wszystko' }
  if (grouping === 'animal') return { key: row.animalId, label: row.animalName }
  if (grouping === 'trial') return { key: row.trialId, label: row.trialName }
  const animal = animals.find((item) => item.id === row.animalId)
  const group = groups.find((item) => item.id === animal?.groupId)
  return { key: group?.id ?? 'none', label: group?.name ?? 'Bez grupy' }
}

function rowValue(row, metric) {
  if (metric.id === 'present') return row.present ? 1 : 0
  if (metric.continuousOnly && !row.continuous) return null
  const value = row[metric.id]
  return Number.isFinite(value) ? value : null
}

const COMBINE = {
  sum: (values) => values.reduce((total, value) => total + value, 0),
  max: (values) => Math.max(...values),
  min: (values) => Math.min(...values)
}

const mean = (values) => values.reduce((total, value) => total + value, 0) / values.length

function median(sorted) {
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

// Quartiles by the "median of halves" rule; whiskers reach the furthest value within 1.5 x the interquartile range.
export function boxStats(values) {
  const sorted = [...values].sort((left, right) => left - right)
  if (!sorted.length) return null
  const half = Math.floor(sorted.length / 2)
  const lower = sorted.slice(0, half)
  const upper = sorted.slice(Math.ceil(sorted.length / 2))
  const q1 = median(lower.length ? lower : sorted)
  const q3 = median(upper.length ? upper : sorted)
  const spread = (q3 - q1) * 1.5
  const inside = sorted.filter((value) => value >= q1 - spread && value <= q3 + spread)
  return {
    n: sorted.length,
    min: inside[0],
    q1,
    median: median(sorted),
    q3,
    max: inside[inside.length - 1],
    outliers: sorted.filter((value) => value < q1 - spread || value > q3 + spread)
  }
}

export function summarize(values, aggregate) {
  const n = values.length
  if (!n) return { n: 0, value: null, se: null, values }
  if (aggregate === 'sum') return { n, value: values.reduce((total, value) => total + value, 0), se: null, values }
  if (aggregate === 'median') return { n, value: median([...values].sort((left, right) => left - right)), se: null, values }
  if (aggregate === 'percent') return { n, value: values.filter((value) => value > 0).length / n * 100, se: null, values }

  const average = mean(values)
  const variance = n > 1 ? values.reduce((total, value) => total + (value - average) ** 2, 0) / (n - 1) : null
  return { n, value: average, se: variance === null ? null : Math.sqrt(variance / n), values }
}

// The numbers behind a chart: one list of data points per value block, for every category.
export function buildChartData(source, config) {
  const blocks = (config.valueIds || []).map(parseValueBlock).filter(Boolean)
  const grouping = config.grouping || 'none'
  const aggregate = config.aggregate || 'mean'
  const groups = source.groups || []
  const animals = source.animals || []
  const rows = metricRowsFor(source)

  // trial x category -> one number per block (the animals of a category are combined within a trial)
  const categories = new Map()
  const unitValues = new Map()
  rows.forEach((row) => {
    const category = categoryOf(row, grouping, { animals, groups })
    if (!categories.has(category.key)) categories.set(category.key, category.label)
    blocks.forEach((block) => {
      if (row.name !== block.behavior) return
      const value = rowValue(row, block.metric)
      if (value === null) return
      const key = `${block.id}|${category.key}|${row.trialId}`
      unitValues.set(key, [...(unitValues.get(key) || []), value])
    })
  })

  const categoryList = [...categories.entries()].map(([key, label]) => ({ key, label }))
  const series = blocks.map((block) => ({
    id: block.id,
    label: block.behavior === '' ? block.metric.label : `${block.behavior} · ${block.metric.label}`,
    behavior: block.behavior,
    metric: block.metric,
    points: categoryList.map((category) => {
      const values = []
      unitValues.forEach((list, key) => {
        if (key.startsWith(`${block.id}|${category.key}|`)) values.push(COMBINE[block.metric.combine](list))
      })
      return {
        category: category.label,
        ...summarize(values, aggregate),
        box: config.kind === 'box' ? boxStats(values) : null
      }
    })
  }))

  return { grouping, aggregate, categories: categoryList.map((category) => category.label), series }
}

// The raw numbers of one block: one row per trial and animal (only animals that were observed in that trial).
export function blockRows(source, blockId) {
  const block = parseValueBlock(blockId)
  if (!block) return []
  return metricRowsFor(source)
    .filter((row) => row.name === block.behavior)
    .map((row) => {
      const value = rowValue(row, block.metric)
      return [row.trialName, row.animalName, value === null ? '—' : Number(value.toFixed(3))]
    })
}

export function yAxisLabel(chartData, kind) {
  const metrics = [...new Set(chartData.series.map((series) => series.metric.id))]
  const unit = [...new Set(chartData.series.map((series) => series.metric.unit))]
  const suffix = unit.length === 1 && unit[0] ? ` [${unit[0]}]` : ''
  if (kind === 'bar' && chartData.aggregate === 'percent') return '% prób z wystąpieniem'
  const name = metrics.length === 1 ? metricById.get(metrics[0]).label : 'wartość'
  const prefix = kind === 'bar' && chartData.aggregate === 'mean' ? 'średni ' : kind === 'bar' && chartData.aggregate === 'median' ? 'mediana: ' : ''
  return `${prefix}${name}${suffix}`
}

// What the preview table under the chart shows (the same numbers as the chart).
export function previewRows(chartData, kind) {
  const decimals = (value) => (Number.isFinite(value) ? Number(value.toFixed(3)) : '')
  return chartData.series.flatMap((series) => series.points.map((point) => kind === 'box'
    ? [series.label, point.category, point.n, decimals(point.box?.min), decimals(point.box?.q1), decimals(point.box?.median), decimals(point.box?.q3), decimals(point.box?.max)]
    : [series.label, point.category, point.n, decimals(point.value), decimals(point.se)]))
}

export const previewHeaders = (kind) => kind === 'box'
  ? ['Wartość', 'Kategoria', 'n', 'min', 'Q1', 'mediana', 'Q3', 'max']
  : ['Wartość', 'Kategoria', 'n', 'wynik', 'SE']

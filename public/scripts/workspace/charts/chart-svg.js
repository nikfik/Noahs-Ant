// Draws a chart as an SVG string. The chart is drawn like a figure for a paper (dark text on a white page), so what is
// shown on the screen is also what is exported.

import { escapeHtml } from '../../shared/escape-html.js'

export const PALETTE = ['#e0a526', '#b83b2e', '#3b7ea1', '#5a9a4b', '#8a5aa8', '#6b6f76']
const INK = '#1b1b1b'
const GRID = '#d9d9d9'
const FONT = 'Inter, "Segoe UI", system-ui, sans-serif'

// Axis steps that look "round": 1, 2, 5 times a power of ten.
export function niceScale(max, ticks = 5) {
  if (!(max > 0)) return { max: 1, step: 0.2 }
  const raw = max / ticks
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * magnitude).find((candidate) => candidate >= raw)
  return { max: Math.ceil(max / step) * step, step }
}

const format = (value) => (Math.abs(value) >= 100 ? String(Math.round(value)) : String(Number(value.toFixed(2))))

// Long category names are split over two lines at a space.
function wrapLabel(text, maxChars = 14) {
  const words = String(text).split(' ')
  const lines = ['']
  words.forEach((word) => {
    const last = lines.length - 1
    if (lines[last] && `${lines[last]} ${word}`.length > maxChars && lines.length < 3) lines.push(word)
    else lines[last] = lines[last] ? `${lines[last]} ${word}` : word
  })
  return lines
}

// config: { kind, title, yLabel, referenceLine, aggregate, width, height }
export function renderChartSvg(chartData, config) {
  const width = config.width || 760
  const height = config.height || 440
  const margin = { top: config.title ? 52 : 24, right: 24, bottom: 74, left: 78 }
  const plot = { width: width - margin.left - margin.right, height: height - margin.top - margin.bottom }
  const isBox = config.kind === 'box'
  const isPercent = !isBox && chartData.aggregate === 'percent'

  const tops = chartData.series.flatMap((series) => series.points.map((point) => {
    if (isBox) return point.box ? Math.max(point.box.max, ...point.box.outliers) : 0
    return (point.value ?? 0) + (point.se ?? 0)
  }))
  const reference = Number.isFinite(config.referenceLine) ? config.referenceLine : 0
  const scale = isPercent ? { max: 100, step: 20 } : niceScale(Math.max(...tops, reference, 0))
  const y = (value) => margin.top + plot.height - (value / scale.max) * plot.height

  const body = []
  for (let value = 0; value <= scale.max + scale.step / 1000; value += scale.step) {
    body.push(`<line x1="${margin.left}" x2="${margin.left + plot.width}" y1="${y(value)}" y2="${y(value)}" stroke="${GRID}" stroke-width="${value === 0 ? 0 : 1}"/>`)
    body.push(`<text x="${margin.left - 10}" y="${y(value) + 4}" text-anchor="end" font-size="12" fill="${INK}">${format(value)}</text>`)
  }

  const categories = chartData.categories
  const slot = plot.width / Math.max(categories.length, 1)
  const seriesCount = Math.max(chartData.series.length, 1)
  const groupWidth = Math.min(slot * 0.78, 150 * seriesCount)
  const barWidth = groupWidth / seriesCount

  categories.forEach((category, index) => {
    const center = margin.left + slot * (index + 0.5)
    wrapLabel(category).forEach((line, lineIndex) => {
      body.push(`<text x="${center}" y="${margin.top + plot.height + 22 + lineIndex * 15}" text-anchor="middle" font-size="13" fill="${INK}">${escapeHtml(line)}</text>`)
    })

    chartData.series.forEach((series, seriesIndex) => {
      const point = series.points[index]
      const color = PALETTE[seriesIndex % PALETTE.length]
      const left = center - groupWidth / 2 + seriesIndex * barWidth
      const tooltip = `<title>${escapeHtml(series.label)} – ${escapeHtml(category)} (n = ${point.n})</title>`

      if (isBox) {
        if (!point.box) return
        const box = point.box
        const mid = left + barWidth / 2
        const boxLeft = left + barWidth * 0.2
        const boxWidth = barWidth * 0.6
        body.push(`<g>${tooltip}
          <line x1="${mid}" x2="${mid}" y1="${y(box.min)}" y2="${y(box.max)}" stroke="${INK}" stroke-width="1.5"/>
          <line x1="${boxLeft + boxWidth * 0.25}" x2="${boxLeft + boxWidth * 0.75}" y1="${y(box.min)}" y2="${y(box.min)}" stroke="${INK}" stroke-width="1.5"/>
          <line x1="${boxLeft + boxWidth * 0.25}" x2="${boxLeft + boxWidth * 0.75}" y1="${y(box.max)}" y2="${y(box.max)}" stroke="${INK}" stroke-width="1.5"/>
          <rect x="${boxLeft}" y="${y(box.q3)}" width="${boxWidth}" height="${Math.max(1, y(box.q1) - y(box.q3))}" fill="${color}" stroke="${INK}" stroke-width="1.5"/>
          <line x1="${boxLeft}" x2="${boxLeft + boxWidth}" y1="${y(box.median)}" y2="${y(box.median)}" stroke="${INK}" stroke-width="2.5"/>
          ${box.outliers.map((value) => `<circle cx="${mid}" cy="${y(value)}" r="3" fill="none" stroke="${INK}" stroke-width="1.2"/>`).join('')}
        </g>`)
        return
      }

      if (point.value === null) return
      const top = y(point.value)
      const barLeft = left + barWidth * 0.08
      const innerWidth = barWidth * 0.84
      body.push(`<g>${tooltip}<rect x="${barLeft}" y="${top}" width="${innerWidth}" height="${Math.max(0, y(0) - top)}" fill="${color}"/>`)
      if (point.se !== null) {
        const mid = barLeft + innerWidth / 2
        const cap = Math.min(7, innerWidth / 4)
        body.push(`<line x1="${mid}" x2="${mid}" y1="${y(point.value - point.se)}" y2="${y(point.value + point.se)}" stroke="${INK}" stroke-width="1.8"/>
          <line x1="${mid - cap}" x2="${mid + cap}" y1="${y(point.value + point.se)}" y2="${y(point.value + point.se)}" stroke="${INK}" stroke-width="1.8"/>
          <line x1="${mid - cap}" x2="${mid + cap}" y1="${y(Math.max(0, point.value - point.se))}" y2="${y(Math.max(0, point.value - point.se))}" stroke="${INK}" stroke-width="1.8"/>`)
      }
      if (isPercent || chartData.aggregate === 'sum' || chartData.aggregate === 'median') {
        body.push(`<text x="${barLeft + innerWidth / 2}" y="${top - 7}" text-anchor="middle" font-size="13" fill="${INK}">${format(point.value)}${isPercent ? '%' : ''}</text>`)
      }
      body.push('</g>')
    })
  })

  if (Number.isFinite(config.referenceLine)) {
    body.push(`<line x1="${margin.left}" x2="${margin.left + plot.width}" y1="${y(config.referenceLine)}" y2="${y(config.referenceLine)}" stroke="#c0392b" stroke-width="1.5" stroke-dasharray="6 4"/>
      <text x="${margin.left + plot.width - 4}" y="${y(config.referenceLine) - 5}" text-anchor="end" font-size="12" fill="#c0392b">${format(config.referenceLine)}</text>`)
  }

  const legend = chartData.series.length > 1
    ? chartData.series.map((series, index) => `<g transform="translate(${margin.left + index * 170}, ${height - 14})"><rect width="12" height="12" y="-10" fill="${PALETTE[index % PALETTE.length]}"/><text x="18" font-size="12" fill="${INK}">${escapeHtml(series.label.length > 22 ? `${series.label.slice(0, 21)}…` : series.label)}</text></g>`).join('')
    : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family='${FONT}' role="img">
  <rect width="${width}" height="${height}" fill="#ffffff"/>
  ${config.title ? `<text x="${margin.left + plot.width / 2}" y="30" text-anchor="middle" font-size="18" fill="${INK}">${escapeHtml(config.title)}</text>` : ''}
  <line x1="${margin.left}" x2="${margin.left}" y1="${margin.top}" y2="${margin.top + plot.height}" stroke="${INK}" stroke-width="1.2"/>
  <line x1="${margin.left}" x2="${margin.left + plot.width}" y1="${margin.top + plot.height}" y2="${margin.top + plot.height}" stroke="${INK}" stroke-width="1.2"/>
  ${body.join('\n  ')}
  <text transform="translate(18 ${margin.top + plot.height / 2}) rotate(-90)" text-anchor="middle" font-size="13" fill="${INK}">${escapeHtml(config.yLabel || '')}</text>
  ${legend}
</svg>`
}

// Draws the transition diagram: a circle of states with curved arrows labeled with the probability (and the count).

import { escapeHtml } from '../../shared/escape-html.js'

const INK = '#1b1b1b'
const FONT = 'Inter, "Segoe UI", system-ui, sans-serif'
const NODE_HEIGHT = 40

const boundaryPoint = (node, toward) => {
  const dx = toward.x - node.x
  const dy = toward.y - node.y
  const scale = 1 / Math.sqrt((dx / node.rx) ** 2 + (dy / node.ry) ** 2 || 1)
  return { x: node.x + dx * scale, y: node.y + dy * scale }
}

const unit = (dx, dy) => {
  const length = Math.hypot(dx, dy) || 1
  return { x: dx / length, y: dy / length }
}

export function layoutNodes(nodes, size) {
  const center = { x: size.width / 2, y: size.height / 2 + 16 }
  const radius = Math.min(size.width, size.height) / 2 - 140
  return nodes.map((node, index) => {
    const width = Math.max(92, node.label.length * 7.6 + 30)
    const angle = -Math.PI / 2 + (index / Math.max(nodes.length, 1)) * Math.PI * 2
    const single = nodes.length === 1
    return {
      ...node,
      rx: width / 2,
      ry: NODE_HEIGHT / 2,
      x: single ? center.x : center.x + radius * Math.cos(angle) * 1.18,
      y: single ? center.y : center.y + radius * Math.sin(angle),
      outward: single ? { x: 0, y: -1 } : { x: Math.cos(angle), y: Math.sin(angle) }
    }
  })
}

function labelText(edge, options) {
  const parts = []
  if (options.showProbabilities) parts.push(edge.probability.toFixed(3))
  if (options.showCounts) parts.push(`${options.showProbabilities ? '(' : ''}${edge.count}×${options.showProbabilities ? ')' : ''}`)
  if (options.showLatency && edge.meanLatency !== null) parts.push(`~${edge.meanLatency.toFixed(1)} s`)
  return parts.join(' ')
}

// options: { minProbability, showProbabilities, showCounts, showLatency, title }
export function renderTransitionSvg(result, options = {}) {
  const visibleEdges = result.edges.filter((edge) => edge.probability >= (options.minProbability || 0))
  const usedIds = new Set(visibleEdges.flatMap((edge) => [edge.from, edge.to]))
  const visibleNodes = result.nodes.filter((node) => usedIds.has(node.id))
  const size = Math.max(560, Math.min(1000, 380 + visibleNodes.length * 60))
  const dimensions = { width: Math.round(size * 1.35), height: size }
  const nodes = layoutNodes(visibleNodes, dimensions)
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const parts = []

  visibleEdges.forEach((edge) => {
    const from = byId.get(edge.from)
    const to = byId.get(edge.to)
    const strokeWidth = (1 + edge.probability * 2).toFixed(2)
    const text = labelText(edge, options)
    let path
    let labelPoint

    if (from === to) {
      const u = from.outward
      const t = { x: -u.y, y: u.x }
      const start = boundaryPoint(from, { x: from.x + u.x * 40 - t.x * 26, y: from.y + u.y * 40 - t.y * 26 })
      const end = boundaryPoint(from, { x: from.x + u.x * 40 + t.x * 26, y: from.y + u.y * 40 + t.y * 26 })
      const c1 = { x: start.x + u.x * 54 - t.x * 6, y: start.y + u.y * 54 - t.y * 6 }
      const c2 = { x: end.x + u.x * 54 + t.x * 6, y: end.y + u.y * 54 + t.y * 6 }
      path = `M ${start.x} ${start.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${end.x} ${end.y}`
      labelPoint = { x: (start.x + end.x + 3 * (c1.x + c2.x)) / 8 + u.x * 40, y: (start.y + end.y + 3 * (c1.y + c2.y)) / 8 + u.y * 14 }
    } else {
      const direction = unit(to.x - from.x, to.y - from.y)
      const distance = Math.hypot(to.x - from.x, to.y - from.y)
      const control = {
        x: (from.x + to.x) / 2 - direction.y * distance * 0.17,
        y: (from.y + to.y) / 2 + direction.x * distance * 0.17
      }
      const start = boundaryPoint(from, control)
      const end = boundaryPoint(to, control)
      path = `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`
      // Labels of the two arrows between a pair of states sit at different places along the line, so they do not collide.
      const t = from.id < to.id ? 0.42 : 0.58
      labelPoint = {
        x: (1 - t) ** 2 * start.x + 2 * t * (1 - t) * control.x + t ** 2 * end.x,
        y: (1 - t) ** 2 * start.y + 2 * t * (1 - t) * control.y + t ** 2 * end.y
      }
    }

    parts.push(`<g><title>${escapeHtml(edge.from)} → ${escapeHtml(edge.to)}: ${edge.count}× (p = ${edge.probability.toFixed(3)})</title>
      <path d="${path}" fill="none" stroke="${INK}" stroke-width="${strokeWidth}" marker-end="url(#arrow)"/>
      ${text ? `<text x="${labelPoint.x}" y="${labelPoint.y + 4}" text-anchor="middle" font-size="13" fill="${INK}" stroke="#fff" stroke-width="4" paint-order="stroke">${escapeHtml(text)}</text>` : ''}</g>`)
  })

  nodes.forEach((node) => {
    parts.push(`<g><title>${escapeHtml(node.label)} (${node.visits}×)</title>
      <ellipse cx="${node.x}" cy="${node.y}" rx="${node.rx}" ry="${node.ry}" fill="${node.isStart ? '#eeeeee' : '#ffffff'}" stroke="${INK}" stroke-width="1.4"/>
      <text x="${node.x}" y="${node.y + 5}" text-anchor="middle" font-size="14" fill="${INK}">${escapeHtml(node.label)}</text></g>`)
  })

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dimensions.width} ${dimensions.height}" width="${dimensions.width}" height="${dimensions.height}" font-family='${FONT}' role="img">
  <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${INK}"/></marker></defs>
  <rect width="${dimensions.width}" height="${dimensions.height}" fill="#ffffff"/>
  ${options.title ? `<text x="${dimensions.width / 2}" y="28" text-anchor="middle" font-size="18" fill="${INK}">${escapeHtml(options.title)}</text>` : ''}
  ${parts.join('\n  ')}
</svg>`
}

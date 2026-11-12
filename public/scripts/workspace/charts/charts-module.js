// The charts screen: building blocks on the left (behaviors x measures, and the ways to group), a chart in the middle.
import { t } from '../../shared/i18n.js'
import { escapeHtml } from '../../shared/escape-html.js'
import {
  AGGREGATES,
  CHART_KINDS,
  GROUPINGS,
  blockRows,
  buildBlocks,
  buildChartData,
  parseValueBlock,
  previewHeaders,
  previewRows,
  yAxisLabel
} from './chart-model.js'
import { renderChartSvg } from './chart-svg.js'
import { exportSvg } from './export-image.js'

const STORAGE_PREFIX = 'noahs-ant.charts.'
const DEFAULT_CONFIG = { valueIds: [], grouping: null, aggregate: 'mean', kind: 'bar', title: '', referenceLine: null }

const normalizeText = (text) => String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l')

function autoTitle(chartData, kind) {
  const behaviors = [...new Set(chartData.series.map((series) => series.behavior))]
  const name = behaviors.length === 1 ? behaviors[0] : behaviors.join(', ')
  return kind === 'bar' && chartData.aggregate === 'mean' && chartData.series.some((series) => series.points.some((point) => point.se !== null)) ? `${name} (±SE)` : name
}

export function createChartsModule() {
  let host = null
  let store = null
  let animalCatalog = null
  let trialCatalog = null
  let projectName = ''
  let config = { ...DEFAULT_CONFIG }
  let search = ''
  let previewBlockId = null
  let lastSvg = ''

  const trials = () => trialCatalog?.getData?.().trials || []
  const animals = () => animalCatalog?.getData?.().animals || []
  const groups = () => animalCatalog?.getData?.().groups || []
  const presets = () => animalCatalog?.getPresets?.() || []
  const isVisible = () => Boolean(host) && !host.closest('[hidden]')
  const source = () => ({ observations: store.getAll(), trials: trials(), animals: animals(), groups: groups(), presets: presets() })

  function load() {
    try {
      config = { ...DEFAULT_CONFIG, ...JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}${projectName}`) || '{}') }
    } catch (_error) {
      config = { ...DEFAULT_CONFIG }
    }
  }

  function save() {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${projectName}`, JSON.stringify(config))
    } catch (_error) {
      // The chart then simply starts empty next time.
    }
  }

  function renderBlocks(blocks) {
    const query = normalizeText(search.trim())
    const matches = (text) => !query || normalizeText(text).includes(query)

    const byBehavior = new Map()
    blocks.values.forEach((block) => {
      if (!matches(block.label)) return
      byBehavior.set(block.behavior, [...(byBehavior.get(block.behavior) || []), block])
    })

    const groupingChips = GROUPINGS.filter((item) => matches(`${t(item.label)} ${t(item.hint)}`)).map((item) => `
      <button type="button" class="chart-chip chart-chip-grouping" draggable="true" data-block-id="grouping|${item.id}" title="${escapeHtml(t(item.hint))}">${escapeHtml(t(item.label))}</button>`).join('')

    const valueSections = [...byBehavior.entries()].map(([behavior, list]) => `
      <details class="chart-behavior" ${query || list.some((block) => config.valueIds.includes(block.id)) ? 'open' : ''}>
        <summary>${escapeHtml(behavior)}</summary>
        <div class="chart-chips">${list.map((block) => `
          <span class="chart-chip-row">
            <button type="button" class="chart-chip" draggable="true" data-block-id="${escapeHtml(block.id)}" title="${t('Przeciągnij na wykres albo kliknij, aby dodać')}">${escapeHtml(t(block.metric.label))}</button>
            <button type="button" class="chart-peek" data-peek="${escapeHtml(block.id)}" title="${t('Podejrzyj dane tego bloku')}" aria-label="${escapeHtml(t('Podgląd danych: {name}', { name: block.label }))}">👁</button>
          </span>`).join('')}</div>
      </details>`).join('')

    return `
      ${groupingChips ? `<h4>${t('Grupowanie')}</h4><div class="chart-chips">${groupingChips}</div>` : ''}
      <h4>${t('Wartości')}</h4>
      ${valueSections || `<p class="charts-muted">${t('Brak pasujących czynności.')}</p>`}`
  }

  function zoneContent(blocks) {
    const chips = config.valueIds.map(parseValueBlock).filter(Boolean).map((block) => `
      <span class="chart-chip placed">${escapeHtml(block.behavior)} · ${escapeHtml(t(block.metric.label))}<button type="button" data-remove="${escapeHtml(block.id)}" aria-label="${t('Usuń')}">×</button></span>`).join('')
    const grouping = GROUPINGS.find((item) => item.id === config.grouping)
    return {
      values: chips || `<span class="charts-zone-empty">${t('Przeciągnij tutaj czynność z listy po lewej')}</span>`,
      grouping: grouping
        ? `<span class="chart-chip placed chart-chip-grouping">${escapeHtml(t(grouping.label))}<button type="button" data-remove="grouping" aria-label="${t('Usuń')}">×</button></span>`
        : `<span class="charts-zone-empty">${t('Bez grupowania – jeden słupek (opcjonalnie)')}</span>`
    }
  }

  function render() {
    if (!host || !store) return
    const blocks = buildBlocks(source())
    const known = new Set(blocks.values.map((block) => block.id))
    config.valueIds = config.valueIds.filter((id) => known.has(id))

    const chartData = config.valueIds.length ? buildChartData(source(), config) : null
    const hasData = chartData?.series.some((series) => series.points.some((point) => point.n > 0))
    const title = config.title || (chartData ? autoTitle(chartData, config.kind) : '')
    lastSvg = hasData
      ? renderChartSvg(chartData, { kind: config.kind, title, yLabel: yAxisLabel(chartData, config.kind), referenceLine: config.referenceLine })
      : ''
    const zones = zoneContent(blocks)

    const preview = previewBlockId
      ? (() => {
        const rows = blockRows(source(), previewBlockId)
        const block = parseValueBlock(previewBlockId)
        return `<p class="charts-muted">${escapeHtml(t('Dane bloku „{block}” – jeden wiersz na próbę i zwierzę (tylko zwierzęta oznaczone w danej próbie).', { block: `${block?.behavior || ''} · ${t(block?.metric.label || '')}` }))} <button type="button" data-close-peek>${t('Wróć do liczb wykresu')}</button></p>
          ${table([t('Próba'), t('Zwierzę'), t('Wartość')], rows)}`
      })()
      : (chartData ? `${table(previewHeaders(config.kind), previewRows(chartData, config.kind))}
        <p class="charts-muted">${t('Jedna wartość to jedna próba. Gdy w próbie jest kilka zwierząt z tej samej kategorii, ich wartości są łączone: czas i liczba – suma, „wystąpiła” – tak, jeśli którekolwiek, latencja – najkrótsza. Liczone są tylko próby, w których zwierzę miało choć jedno oznaczone zdarzenie.')}</p>` : `<p class="charts-muted">${t('Tu pojawią się liczby, z których powstał wykres.')}</p>`)

    host.innerHTML = `
      <section class="charts-screen">
        <aside class="charts-sidebar">
          <h3>${t('Bloki')}</h3>
          <input type="search" class="charts-search" data-search placeholder="${t('Szukaj czynności lub miary…')}" value="${escapeHtml(search)}" aria-label="${t('Szukaj bloków')}" />
          <div class="charts-blocks">${renderBlocks(blocks)}</div>
        </aside>
        <div class="charts-main">
          <div class="charts-zones">
            <div class="charts-zone" data-zone="values"><span class="charts-zone-label">${t('Wartość')}</span><div class="charts-zone-body">${zones.values}</div></div>
            <div class="charts-zone" data-zone="grouping"><span class="charts-zone-label">${t('Grupuj według')}</span><div class="charts-zone-body">${zones.grouping}</div></div>
          </div>
          <div class="charts-options">
            <div class="charts-kinds" role="group" aria-label="${t('Typ wykresu')}">${CHART_KINDS.map((kind) => `<button type="button" class="${config.kind === kind.id ? 'active' : ''}" data-kind="${kind.id}">${t(kind.label)}</button>`).join('')}</div>
            <label ${config.kind === 'box' ? 'hidden' : ''}>${t('Wynik')} <select data-aggregate>${AGGREGATES.map((item) => `<option value="${item.id}" ${config.aggregate === item.id ? 'selected' : ''}>${t(item.label)}</option>`).join('')}</select></label>
            <label>${t('Tytuł')} <input data-title value="${escapeHtml(config.title)}" placeholder="${escapeHtml(chartData ? autoTitle(chartData, config.kind) : 'automatyczny')}" /></label>
            <label title="${t('Pozioma linia na wykresie, np. wartość odniesienia')}">${t('Linia pomocnicza')} <input data-reference type="number" step="any" value="${config.referenceLine ?? ''}" placeholder="${t('brak')}" /></label>
            <span class="charts-export">
              <button type="button" data-export="png" ${hasData ? '' : 'disabled'}>${t('Zapisz PNG')}</button>
              <button type="button" data-export="svg" ${hasData ? '' : 'disabled'}>${t('Zapisz SVG')}</button>
            </span>
          </div>
          <div class="charts-canvas ${hasData ? '' : 'empty'}" data-zone="values">
            ${hasData ? lastSvg : `<p>${chartData ? t('Brak danych dla tego wyboru. Oznacz zdarzenia w widoku Wideo.') : t('Przeciągnij czynność z listy po lewej do pola „Wartość”, aby zobaczyć wykres.')}</p>`}
          </div>
          <details class="charts-preview" open>
            <summary>${t('Podgląd danych')}</summary>
            ${preview}
          </details>
        </div>
      </section>`
    const searchInput = host.querySelector('[data-search]')
    if (host.dataset.focusSearch === 'true' && searchInput) {
      searchInput.focus()
      searchInput.setSelectionRange(search.length, search.length)
    }
  }

  function table(headers, rows) {
    if (!rows.length) return `<p class="charts-muted">${t('Brak wierszy.')}</p>`
    return `<div class="charts-table-wrap"><table class="data-table"><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((row) => `<tr>${row.map((cell, index) => `<td class="${index > 1 || typeof cell === 'number' ? 'num' : ''}">${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
  }

  function refresh() {
    if (isVisible()) render()
  }

  function place(blockId) {
    if (blockId.startsWith('grouping|')) {
      config.grouping = blockId.slice('grouping|'.length)
    } else if (parseValueBlock(blockId) && !config.valueIds.includes(blockId)) {
      config.valueIds = [...config.valueIds, blockId]
    }
    previewBlockId = null
    save()
    render()
  }

  function exportChart(format) {
    exportSvg(lastSvg, `${projectName || 'projekt'}_wykres`, format)
  }

  function bindEvents() {
    host.addEventListener('input', (event) => {
      if (event.target.matches('[data-search]')) {
        search = event.target.value
        host.dataset.focusSearch = 'true'
        render()
        host.dataset.focusSearch = 'false'
      } else if (event.target.matches('[data-title]')) {
        config.title = event.target.value
        save()
        refreshChartOnly()
      }
    })

    host.addEventListener('change', (event) => {
      if (event.target.matches('[data-aggregate]')) config.aggregate = event.target.value
      else if (event.target.matches('[data-reference]')) config.referenceLine = event.target.value === '' || !Number.isFinite(Number(event.target.value)) ? null : Number(event.target.value)
      else return
      save()
      render()
    })

    host.addEventListener('click', (event) => {
      const target = event.target
      const kind = target.closest('[data-kind]')
      const remove = target.closest('[data-remove]')
      const peek = target.closest('[data-peek]')
      const exportButton = target.closest('[data-export]')
      const chip = target.closest('.chart-chip[data-block-id]')

      if (kind) config.kind = kind.dataset.kind
      else if (remove) {
        if (remove.dataset.remove === 'grouping') config.grouping = null
        else config.valueIds = config.valueIds.filter((id) => id !== remove.dataset.remove)
      } else if (peek) previewBlockId = peek.dataset.peek
      else if (target.closest('[data-close-peek]')) previewBlockId = null
      else if (exportButton) { if (!exportButton.disabled) exportChart(exportButton.dataset.export); return }
      else if (chip) { place(chip.dataset.blockId); return }
      else return
      save()
      render()
    })

    host.addEventListener('dragstart', (event) => {
      const chip = event.target.closest?.('.chart-chip[data-block-id]')
      if (!chip) return
      event.dataTransfer.setData('text/plain', chip.dataset.blockId)
      event.dataTransfer.effectAllowed = 'copy'
    })

    const accepts = (zone, id) => (zone === 'grouping' ? id.startsWith('grouping|') : Boolean(parseValueBlock(id)))
    host.addEventListener('dragover', (event) => {
      const zone = event.target.closest?.('[data-zone]')
      if (!zone) return
      event.preventDefault()
      zone.classList.add('drag-over')
    })
    host.addEventListener('dragleave', (event) => event.target.closest?.('[data-zone]')?.classList.remove('drag-over'))
    host.addEventListener('drop', (event) => {
      const zone = event.target.closest?.('[data-zone]')
      if (!zone) return
      event.preventDefault()
      zone.classList.remove('drag-over')
      const id = event.dataTransfer.getData('text/plain')
      if (id && accepts(zone.dataset.zone, id)) place(id)
    })
  }

  // Typing a title only redraws the chart, so the text field keeps the focus.
  function refreshChartOnly() {
    const canvas = host.querySelector('.charts-canvas')
    if (!canvas || !lastSvg || !config.valueIds.length) return
    const chartData = buildChartData(source(), config)
    lastSvg = renderChartSvg(chartData, {
      kind: config.kind,
      title: config.title || autoTitle(chartData, config.kind),
      yLabel: yAxisLabel(chartData, config.kind),
      referenceLine: config.referenceLine
    })
    canvas.innerHTML = lastSvg
  }

  function init(containerId = 'charts-module', dependencies = {}) {
    host = document.getElementById(containerId)
    store = dependencies.observationStore || null
    animalCatalog = dependencies.animalCatalog || null
    trialCatalog = dependencies.trialCatalog || null
    projectName = dependencies.projectName || ''
    if (!host || !store) return null

    load()
    bindEvents()
    store.subscribe(({ reason }) => {
      if (reason !== 'preview') refresh()
    })
    window.addEventListener('active-animal-changed', refresh)
    window.addEventListener('active-trial-changed', refresh)
    window.addEventListener('workspace-view-changed', refresh)
    render()
    return { render }
  }

  return { init }
}

export const ChartsModule = createChartsModule()

import {
  FRAME_RATE_CHOICES,
  QUALITY_LEVELS,
  QUALITY_PRESETS,
  RESOLUTION_CHOICES,
  estimateOutput,
  matchPreset,
  normalizeQualitySettings,
  planConversion,
  presetSettings
} from '../../shared/video-quality.js'

const escapeHtml = (text) => String(text).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char])

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '–'
  const units = ['B', 'KB', 'MB', 'GB']
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / 1024 ** exponent
  return `${value >= 100 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '–'
  const total = Math.round(seconds)
  if (total < 60) return `${Math.max(1, total)} s`
  const minutes = Math.floor(total / 60)
  return minutes < 60 ? `${minutes} min ${total % 60} s` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}

const describeSource = (info) => {
  const { video, duration } = info.probe
  return [
    video.width && video.height ? `${video.width}×${video.height}${video.interlaced ? 'i' : ''}` : null,
    video.fps ? `${Math.round(video.fps * 100) / 100} klatek/s` : null,
    duration ? formatDuration(duration) : null,
    formatBytes(info.size)
  ].filter(Boolean).join(' · ')
}

function estimateText(info, settings) {
  const plan = planConversion(info.probe, info.extension || '', settings)
  if (plan.action === 'none') return 'Bez konwersji – film zostanie użyty bez zmian.'
  if (plan.action === 'remux') return `Szybkie przepakowanie (ok. ${formatDuration(estimateOutput(info.probe, plan, info.size).seconds)}), jakość bez zmian.`
  const { sizeBytes, seconds } = estimateOutput(info.probe, plan, info.size)
  return `Konwersja potrwa ok. ${formatDuration(seconds)}, plik będzie miał ok. ${formatBytes(sizeBytes)}.`
}

const options = (choices) => choices
  .map((choice) => `<option value="${choice.value ?? ''}">${escapeHtml(choice.label)}</option>`)
  .join('')

// Asks how the picked video should be prepared. Resolves with { settings, remember }, or null when cancelled.
export function askVideoQuality(info, initialSettings, { doc = document } = {}) {
  return new Promise((resolve) => {
    let settings = normalizeQualitySettings(initialSettings)
    const root = doc.createElement('div')
    root.className = 'modal video-quality-modal'
    root.innerHTML = `
      <form class="modal-card video-quality-dialog" role="dialog" aria-modal="true" aria-labelledby="video-quality-title">
        <h3 id="video-quality-title">Jakość filmu</h3>
        <p class="video-quality-source"><strong>${escapeHtml(info.fileName)}</strong><br>${escapeHtml(describeSource(info))}</p>
        <p>Mniejsza rozdzielczość i mniej klatek na sekundę sprawiają, że film działa płynniej na słabszym komputerze.</p>
        <div class="video-quality-presets" role="radiogroup" aria-label="Gotowe ustawienia">
          ${QUALITY_PRESETS.map((preset) => `
            <label class="video-quality-preset">
              <input type="radio" name="video-quality-preset" value="${preset.id}">
              <span class="video-quality-preset-body">
                <span class="video-quality-preset-title">${escapeHtml(preset.label)}</span>
                <span class="video-quality-preset-text">${escapeHtml(preset.description)}</span>
                <span class="video-quality-preset-estimate">${escapeHtml(estimateText(info, presetSettings(preset.id)))}</span>
              </span>
            </label>`).join('')}
        </div>
        <details class="video-quality-advanced">
          <summary>Ustawienia zaawansowane</summary>
          <div class="video-quality-fields">
            <label>Rozdzielczość (maks.)<select data-field="maxHeight">${options(RESOLUTION_CHOICES)}</select></label>
            <label>Liczba klatek (maks.)<select data-field="maxFrameRate">${options(FRAME_RATE_CHOICES)}</select></label>
            <label>Jakość obrazu<select data-field="quality">${QUALITY_LEVELS.map((level) => `<option value="${level.id}">${escapeHtml(level.label)}</option>`).join('')}</select></label>
          </div>
        </details>
        <p class="video-quality-estimate" role="status"></p>
        <label class="video-quality-remember"><input type="checkbox" data-remember> Zapamiętaj mój wybór i nie pytaj ponownie (można to zmienić w ustawieniach)</label>
        <div class="modal-actions">
          <button type="button" class="module-action" data-cancel>Anuluj</button>
          <button type="submit" class="module-action primary" data-confirm>Dalej</button>
        </div>
      </form>`
    doc.body.appendChild(root)

    const form = root.querySelector('form')
    const advanced = root.querySelector('.video-quality-advanced')
    const fields = Object.fromEntries([...root.querySelectorAll('[data-field]')].map((select) => [select.dataset.field, select]))

    const render = () => {
      const presetId = matchPreset(settings)
      root.querySelectorAll('input[name="video-quality-preset"]').forEach((radio) => { radio.checked = radio.value === presetId })
      fields.maxHeight.value = settings.maxHeight ?? ''
      fields.maxFrameRate.value = settings.maxFrameRate ?? ''
      fields.quality.value = settings.quality
      root.querySelector('.video-quality-estimate').textContent = estimateText(info, settings)
    }

    const close = (result) => {
      root.remove()
      resolve(result)
    }

    root.querySelectorAll('input[name="video-quality-preset"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        settings = normalizeQualitySettings(presetSettings(radio.value))
        render()
      })
    })
    Object.values(fields).forEach((select) => select.addEventListener('change', () => {
      settings = normalizeQualitySettings({
        maxHeight: fields.maxHeight.value || null,
        maxFrameRate: fields.maxFrameRate.value || null,
        quality: fields.quality.value
      })
      render()
    }))
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      close({ settings, remember: root.querySelector('[data-remember]').checked })
    })
    root.querySelector('[data-cancel]').addEventListener('click', () => close(null))
    root.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close(null)
      }
    })

    advanced.open = matchPreset(settings) === 'custom'
    render()
    root.querySelector('[data-confirm]').focus()
  })
}

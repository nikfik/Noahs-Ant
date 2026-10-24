// Saves a figure that is drawn as an SVG string, as an SVG file or as a sharp PNG (twice the screen size).
function download(name, blob) {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}

export function exportSvg(svg, baseName, format) {
  if (!svg) return
  if (format === 'svg') {
    download(`${baseName}.svg`, new Blob([svg], { type: 'image/svg+xml' }))
    return
  }

  const image = new Image()
  image.onload = () => {
    const scale = 2
    const canvas = document.createElement('canvas')
    canvas.width = image.width * scale
    canvas.height = image.height * scale
    const context = canvas.getContext('2d')
    context.scale(scale, scale)
    context.drawImage(image, 0, 0)
    canvas.toBlob((blob) => blob && download(`${baseName}.png`, blob), 'image/png')
  }
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

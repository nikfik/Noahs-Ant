// Switches between the panels of the Dane view (events table, metrics) without leaving the page.
export function initDataTabs(root = document) {
  const buttons = Array.from(root.querySelectorAll('[data-data-tab]'))
  const panels = new Map(Array.from(root.querySelectorAll('[data-data-panel]')).map((node) => [node.dataset.dataPanel, node]))

  function show(tab) {
    if (!panels.has(tab)) return

    panels.forEach((node, id) => { node.hidden = id !== tab })
    buttons.forEach((button) => button.classList.toggle('active', button.dataset.dataTab === tab))
    window.dispatchEvent(new CustomEvent('data-tab-changed', { detail: { tab } }))
  }

  buttons.forEach((button) => button.addEventListener('click', () => show(button.dataset.dataTab)))
  return { show }
}

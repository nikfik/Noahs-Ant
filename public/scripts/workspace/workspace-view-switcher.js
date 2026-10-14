import { VIDEO_VIEW } from '../shared/workspace-view.js'

// Shows one view at a time inside the single page; the toolbar announces the wanted view with 'workspace-view-change'.
export function initViewSwitcher(viewIds, defaultView = VIDEO_VIEW) {
  const views = new Map(viewIds.map((id) => [id, document.getElementById(id)]).filter(([, node]) => node))
  let current = defaultView

  function show(viewId) {
    if (!views.has(viewId)) return current

    current = viewId
    views.forEach((node, id) => { node.hidden = id !== viewId })
    document.body.dataset.view = viewId
    window.dispatchEvent(new CustomEvent('workspace-view-changed', { detail: { view: viewId } }))
    return current
  }

  window.addEventListener('workspace-view-change', (event) => show(event.detail?.view))
  show(defaultView)

  return { show, getCurrent: () => current }
}

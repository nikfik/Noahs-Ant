import { UiToolbar } from '../ui/ui-toolbar.js'

export function initWorkspaceToolbar() {
  const bottomToolbar = document.getElementById('bottom-toolbar')
  if (!bottomToolbar) return

  UiToolbar.initToolbarButtons(bottomToolbar, {
    selector: '.tb-btn',
    activeClass: 'active',
    onChange: (button) => {
      const view = button.dataset.view
      const evt = new CustomEvent('workspace-view-change', { detail: { view } })
      window.dispatchEvent(evt)
    },
  })
}

export const WorkspaceToolbar = {
  initWorkspaceToolbar,
}

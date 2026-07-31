(function () {
  function initWorkspaceToolbar() {
    const bottomToolbar = document.getElementById('bottom-toolbar')
    if (!bottomToolbar) return

    window.UiToolbar.initToolbarButtons(bottomToolbar, {
      selector: '.tb-btn',
      activeClass: 'active',
      onChange: (button) => {
        const view = button.dataset.view
        const evt = new CustomEvent('workspace-view-change', { detail: { view } })
        window.dispatchEvent(evt)
      },
    })
  }

  window.WorkspaceToolbar = {
    initWorkspaceToolbar,
  }
})()

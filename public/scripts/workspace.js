// workspace.js — initializes toolbar and view switching inside the workspace fragment
(function () {
  function initWorkspace() {
    const bottomToolbar = document.getElementById('bottom-toolbar')
    if (!bottomToolbar) return
    bottomToolbar.querySelectorAll('.tb-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const view = e.currentTarget.dataset.view
        // toggle active class
        bottomToolbar.querySelectorAll('.tb-btn').forEach(b => b.classList.toggle('active', b === e.currentTarget))
        // For now we just log — actual view changes are handled by renderer showView
        const evt = new CustomEvent('workspace-view-change', { detail: { view } })
        window.dispatchEvent(evt)
      })
    })
  }

  // expose init function
  window.initWorkspace = initWorkspace
})()

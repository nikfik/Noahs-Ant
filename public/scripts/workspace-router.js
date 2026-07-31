(function () {
  function navigateToWorkspace(project) {
    if (!project) return
    window.location.href = `Workspace.html?project=${encodeURIComponent(project.fileName)}`
  }

  window.WorkspaceRouter = {
    navigateToWorkspace,
  }
})()

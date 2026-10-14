export function navigateToWorkspace(project) {
  if (!project) return
  window.location.href = `Workspace.html?project=${encodeURIComponent(project.fileName)}`
}

export const WorkspaceRouter = {
  navigateToWorkspace,
}

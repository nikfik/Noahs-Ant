const INVALID_PROJECT_NAME_REGEX = /[<>:\"/\\|?*]/

function isValidProjectName(value) {
  if (typeof value !== 'string') {
    return false
  }

  const trimmed = value.trim()
  if (trimmed.length < 3 || trimmed.length > 120) {
    return false
  }

  if (INVALID_PROJECT_NAME_REGEX.test(trimmed)) {
    return false
  }

  return true
}

if (typeof window !== 'undefined') {
  window.projectUtils = window.projectUtils || {}
  window.projectUtils.isValidProjectName = isValidProjectName
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { isValidProjectName }
}

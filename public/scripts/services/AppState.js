(function () {
  class AppState {
    static #instance = null

    #currentProject = null
    #currentTheme = {
      bgColor: '#1a1a1a',
      textColor: '#e0e0e0',
      primaryColor: '#ff4f1a'
    }
    #observers = {}

    static getInstance() {
      if (!AppState.#instance) {
        AppState.#instance = new AppState()
      }

      return AppState.#instance
    }

    constructor() {
      this.#observers = {}
    }

    getCurrentProject() {
      return this.#currentProject
    }

    getTheme() {
      return { ...this.#currentTheme }
    }

    notify(eventName, payload) {
      const listeners = this.#observers[eventName] || []
      listeners.forEach((callback) => callback(payload))
    }

    subscribe(eventName, callback) {
      if (typeof callback !== 'function') {
        return () => {}
      }

      if (!this.#observers[eventName]) {
        this.#observers[eventName] = []
      }

      this.#observers[eventName].push(callback)
      return () => {
        this.#observers[eventName] = (this.#observers[eventName] || []).filter((fn) => fn !== callback)
      }
    }

    async loadProject(projectFile) {
      if (!projectFile || !window.electronAPI?.openProject) {
        this.#currentProject = null
        this.notify('project:changed', this.#currentProject)
        return this.#currentProject
      }

      try {
        const project = await window.electronAPI.openProject(projectFile)
        this.#currentProject = project || null
        this.notify('project:changed', this.#currentProject)
        return this.#currentProject
      } catch (_error) {
        this.#currentProject = null
        this.notify('project:error', { projectFile })
        return null
      }
    }

    async setTheme(theme) {
      this.#currentTheme = { ...this.#currentTheme, ...(theme || {}) }
      this.notify('theme:changed', this.getTheme())

      if (window.electronAPI?.setTheme) {
        await window.electronAPI.setTheme(this.#currentTheme)
      }

      if (window.ThemeService?.applyTheme) {
        window.ThemeService.applyTheme(this.#currentTheme)
      }

      return this.getTheme()
    }

    async hydrateFromAppSettings() {
      try {
        const settings = await window.electronAPI?.getAppSettings?.()
        if (settings?.theme) {
          await this.setTheme(settings.theme)
        }
      } catch (_error) {
        // Ignore settings hydration errors and keep defaults.
      }
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AppState }
  }

  window.AppState = AppState
})()

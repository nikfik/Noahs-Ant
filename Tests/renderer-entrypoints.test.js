/**
 * @jest-environment jsdom
 */

import fs from 'node:fs'
import path from 'node:path'
import { jest } from '@jest/globals'

const root = path.resolve('public')

describe('Renderer entry point wiring', () => {
  test('Settings.html points to an existing settings module and that module renders controls', async () => {
    const html = fs.readFileSync(path.join(root, 'views', 'Settings.html'), 'utf8')
    const scriptPath = html.match(/<script type="module" src="([^"]*settings[^"]*)"><\/script>/)?.[1]
    expect(scriptPath).toBe('../scripts/settings/settings.js')
    expect(fs.existsSync(path.resolve(root, 'views', scriptPath))).toBe(true)

    document.body.innerHTML = `
      <nav id="settings-tabs"></nav><h2 id="settings-section-title"></h2>
      <div id="settings-options"></div><button id="apply-btn"></button>
      <button id="reset-btn"></button><button class="window-close"></button>
    `
    window.electronAPI = {
      getAppSettings: jest.fn().mockResolvedValue({}),
      saveAppSettings: jest.fn().mockResolvedValue({}),
      getTheme: jest.fn().mockResolvedValue({ bgColor: '#1a1a1a' }),
      setTheme: jest.fn().mockResolvedValue({}),
      onThemeChange: jest.fn()
    }

    await import('../public/scripts/settings/settings.js')
    document.dispatchEvent(new Event('DOMContentLoaded'))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(document.querySelectorAll('#settings-tabs .settings-tab').length).toBeGreaterThan(0)
    expect(document.querySelectorAll('#settings-options .settings-option').length).toBeGreaterThan(0)
    expect(window.electronAPI.getAppSettings).toHaveBeenCalled()
  })

  test('Workspace toolbar imports an existing ui-toolbar module and the bootstrap exports its initializer', async () => {
    const entry = fs.readFileSync(path.join(root, 'scripts', 'workspace', 'workspace-toolbar.js'), 'utf8')
    const toolbarImport = entry.match(/from ['"]([^'"]*ui-toolbar\.js)['"]/)?.[1]
    expect(toolbarImport).toBe('../ui/ui-toolbar.js')
    expect(fs.existsSync(path.resolve(root, 'scripts', 'workspace', toolbarImport))).toBe(true)

    const workspace = await import('../public/scripts/workspace/workspace-init.js')
    expect(workspace.initWorkspace).toEqual(expect.any(Function))
  })
})

export function applyTheme(theme) {
  if (!theme) return

  document.documentElement.style.setProperty('--bg-color', theme.bgColor || '#1a1a1a')
  document.documentElement.style.setProperty('--text-color', theme.textColor || '#e0e0e0')
  document.documentElement.style.setProperty('--primary-color', theme.primaryColor || '#ff4f1a')
}

export const ThemeService = {
  applyTheme,
}

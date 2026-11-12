// Translation of the interface. The Polish text in the code is the key: t('Zapisz') returns the same text in Polish and
// looks it up in the dictionary of the chosen language otherwise (a text without a translation simply stays Polish).
// A new language is one more dictionary file in ./languages and one line in LANGUAGES below.
import en from './languages/en.js'

export const DEFAULT_LANGUAGE = 'pl'

export const LANGUAGES = [
  { value: 'pl', label: 'Polski', locale: 'pl-PL', dictionary: null },
  { value: 'en', label: 'English', locale: 'en-GB', dictionary: en }
]

let current = LANGUAGES[0]

export const isLanguage = (code) => LANGUAGES.some((language) => language.value === code)

export function setLanguage(code) {
  current = LANGUAGES.find((language) => language.value === code) || LANGUAGES[0]
  if (globalThis.document?.documentElement) document.documentElement.lang = current.value
  return current.value
}

export const getLanguage = () => current.value

// The locale for dates and numbers.
export const locale = () => current.locale

// Texts like 'Zapisano: {path}' take their values from `params`.
export function t(text, params) {
  const translated = current.dictionary?.[text] ?? text
  return params ? translated.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match)) : translated
}

// Picks the form of a counted word: Polish has three ("1 próba", "2 próby", "5 prób"), English two.
// `forms` are the Polish forms [one, few, many]; for another language the dictionary holds the same texts as an array.
export function plural(count, forms) {
  const translated = current.dictionary?.[forms[0]]
  const list = Array.isArray(translated) ? translated : forms
  if (current.value === 'pl') {
    const lastTwo = Math.abs(count) % 100
    const last = lastTwo % 10
    if (count === 1) return list[0]
    return last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14) ? list[1] : list[2]
  }
  return count === 1 ? list[0] : list[1]
}

// Translates the page: the text of elements marked data-i18n, and the attributes given as data-i18n-title,
// data-i18n-placeholder and data-i18n-aria-label (each holds the Polish text of that attribute).
export function translatePage(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((node) => {
    node.dataset.i18nSource ??= node.textContent.trim()
    node.textContent = t(node.dataset.i18nSource)
  })
  ;['title', 'placeholder', 'aria-label'].forEach((attribute) => {
    root.querySelectorAll(`[data-i18n-${attribute}]`).forEach((node) => {
      node.setAttribute(attribute, t(node.getAttribute(`data-i18n-${attribute}`)))
    })
  })
}

// Reads the saved language before the page draws itself, and reloads the page when the language is changed in the settings.
export async function initLanguage(api = globalThis.window?.electronAPI, reload = () => globalThis.location?.reload()) {
  try {
    const settings = await api?.getAppSettings?.()
    setLanguage(settings?.language)
  } catch (error) {
    console.error('Could not read the language:', error)
  }
  api?.onSettingsChange?.((settings) => {
    if (settings?.language && settings.language !== getLanguage()) reload()
  })
}

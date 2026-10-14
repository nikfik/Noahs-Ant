export const ANIMAL_COLORS = [
  '#ef5350', '#42a56b', '#448aff', '#ffb300', '#ab47bc', '#26a69a',
  '#ec407a', '#7e57c2', '#66bb6a', '#ffa726', '#29b6f6', '#d4e157'
]

export function createId(prefix) {
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `${prefix}-${id}`
}

export function createEmptyAnimalData() {
  return {
    version: 1,
    activeGroupId: null,
    activeAnimalId: null,
    groups: [],
    animals: []
  }
}

export function normalizeAnimalData(value = {}) {
  const data = value && typeof value === 'object' ? value : {}
  const groups = Array.isArray(data.groups) ? data.groups : []
  const groupIds = new Set(groups.map((group) => group.id))
  const legacyGroupPresetIds = new Map(groups.map((group) => [group.id, group.etogramPresetId]))
  const animals = (Array.isArray(data.animals) ? data.animals : [])
    .filter((animal) => groupIds.has(animal.groupId))
    .map((animal) => ({
      id: String(animal.id || createId('animal')),
      groupId: animal.groupId,
      name: String(animal.name || 'Bez nazwy'),
      color: /^#[0-9a-f]{6}$/i.test(animal.color) ? animal.color : ANIMAL_COLORS[0],
      etogramPresetId: typeof animal.etogramPresetId === 'string'
        ? animal.etogramPresetId
        : (typeof legacyGroupPresetIds.get(animal.groupId) === 'string' ? legacyGroupPresetIds.get(animal.groupId) : null)
    }))
  const normalizedGroups = groups.map((group) => ({
    id: String(group.id || createId('group')),
    name: String(group.name || 'Bez nazwy')
  }))
  const activeAnimalId = animals.some((animal) => animal.id === data.activeAnimalId) ? data.activeAnimalId : null
  const activeAnimal = animals.find((animal) => animal.id === activeAnimalId)
  const activeGroupId = normalizedGroups.some((group) => group.id === data.activeGroupId)
    ? data.activeGroupId
    : activeAnimal?.groupId || normalizedGroups[0]?.id || null

  return {
    version: 1,
    activeGroupId,
    activeAnimalId,
    groups: normalizedGroups,
    animals
  }
}

export function chooseAnimalColor(animals = [], random = Math.random, excludedColor = null) {
  const usedColors = new Set(animals.map((animal) => animal.color.toLowerCase()))
  if (excludedColor) usedColors.add(excludedColor.toLowerCase())
  let palette = ANIMAL_COLORS.filter((color) => !usedColors.has(color.toLowerCase()))
  if (!palette.length && excludedColor) {
    palette = ANIMAL_COLORS.filter((color) => color.toLowerCase() !== excludedColor.toLowerCase())
  }
  if (!palette.length) palette = ANIMAL_COLORS
  return palette[Math.floor(random() * palette.length)]
}

export function createGroup(data, name) {
  const normalized = normalizeAnimalData(data)
  const groupId = createId('group')
  const group = { id: groupId, name: name.trim() }
  normalized.groups.push(group)
  normalized.activeGroupId = groupId
  normalized.activeAnimalId = null
  return normalized
}

export function createAnimal(data, groupId, name, random = Math.random, etogramPresetId = null) {
  const normalized = normalizeAnimalData(data)
  if (!normalized.groups.some((group) => group.id === groupId)) return normalized
  const inheritedPresetId = normalized.animals.find((animal) => animal.groupId === groupId && animal.etogramPresetId)?.etogramPresetId
  const animal = {
    id: createId('animal'),
    groupId,
    name: name.trim(),
    color: chooseAnimalColor(normalized.animals.filter((item) => item.groupId === groupId), random),
    etogramPresetId: etogramPresetId || inheritedPresetId || null
  }
  normalized.animals.push(animal)
  normalized.activeGroupId = groupId
  normalized.activeAnimalId = animal.id
  return normalized
}

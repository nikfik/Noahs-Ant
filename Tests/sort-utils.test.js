import { ariaSort, nextSort, sortMark, sortRows } from '../public/scripts/workspace/data/sort-utils.js'

describe('Column sorting', () => {
  test('cycles ascending, descending, and back to the natural order', () => {
    let sort = nextSort(null, 'start')
    expect(sort).toEqual({ key: 'start', direction: 'asc' })
    sort = nextSort(sort, 'start')
    expect(sort).toEqual({ key: 'start', direction: 'desc' })
    expect(nextSort(sort, 'start')).toBeNull()
    expect(nextSort(sort, 'name')).toEqual({ key: 'name', direction: 'asc' })
  })

  test('sorts numbers and natural-order text, keeps missing values last in both directions, and stays stable', () => {
    const rows = [
      { id: 'a', name: 'Próba 10', value: 5 },
      { id: 'b', name: 'Próba 2', value: null },
      { id: 'c', name: 'Próba 1', value: 5 },
      { id: 'd', name: 'próba 3', value: 1 }
    ]
    const getters = { name: (row) => row.name, value: (row) => row.value }

    expect(sortRows(rows, { key: 'name', direction: 'asc' }, getters).map((row) => row.id)).toEqual(['c', 'b', 'd', 'a'])
    expect(sortRows(rows, { key: 'name', direction: 'desc' }, getters).map((row) => row.id)).toEqual(['a', 'd', 'b', 'c'])
    expect(sortRows(rows, { key: 'value', direction: 'asc' }, getters).map((row) => row.id)).toEqual(['d', 'a', 'c', 'b'])
    expect(sortRows(rows, { key: 'value', direction: 'desc' }, getters).map((row) => row.id)).toEqual(['a', 'c', 'd', 'b'])
    expect(sortRows(rows, null, getters)).toBe(rows)
    expect(sortRows(rows, { key: 'unknown', direction: 'asc' }, getters)).toBe(rows)
  })

  test('describes the sort state for the header', () => {
    const sort = { key: 'start', direction: 'desc' }
    expect(sortMark(sort, 'start')).toBe('▼')
    expect(sortMark(sort, 'end')).toBe('')
    expect(ariaSort(sort, 'start')).toBe('descending')
    expect(ariaSort(sort, 'end')).toBe('none')
    expect(ariaSort({ key: 'start', direction: 'asc' }, 'start')).toBe('ascending')
  })
})

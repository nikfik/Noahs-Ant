// Click a column header: ascending, then descending, then back to the natural order.
export function nextSort(current, key) {
  if (current?.key !== key) return { key, direction: 'asc' }
  return current.direction === 'asc' ? { key, direction: 'desc' } : null
}

const compareValues = (left, right) => typeof left === 'string' || typeof right === 'string'
  ? String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' })
  : left - right

// Stable sort; missing values (null / undefined) always go last, whichever the direction.
export function sortRows(rows, sort, getters) {
  const getValue = sort && getters[sort.key]
  if (!getValue) return rows

  const factor = sort.direction === 'desc' ? -1 : 1
  return rows
    .map((row, index) => ({ row, index, value: getValue(row) }))
    .sort((left, right) => {
      const leftMissing = left.value === null || left.value === undefined
      const rightMissing = right.value === null || right.value === undefined
      if (leftMissing || rightMissing) return leftMissing === rightMissing ? left.index - right.index : leftMissing ? 1 : -1
      return factor * compareValues(left.value, right.value) || left.index - right.index
    })
    .map(({ row }) => row)
}

export function sortMark(sort, key) {
  if (sort?.key !== key) return ''
  return sort.direction === 'asc' ? '▲' : '▼'
}

export function ariaSort(sort, key) {
  if (sort?.key !== key) return 'none'
  return sort.direction === 'asc' ? 'ascending' : 'descending'
}

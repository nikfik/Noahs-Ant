import path from 'node:path'
import { resolveDataRoot } from '../public/scripts/main/data-root.js'

describe('resolveDataRoot', () => {
  test('uses the project folder in development', () => {
    expect(resolveDataRoot({ isPackaged: false, env: { PORTABLE_EXECUTABLE_DIR: 'X' }, devRoot: 'dev' })).toBe('dev')
  })
  test('uses the folder of the portable exe when packaged', () => {
    expect(resolveDataRoot({ isPackaged: true, env: { PORTABLE_EXECUTABLE_DIR: 'D:\Apps' }, devRoot: 'dev' })).toBe('D:\Apps')
  })
  test('falls back to the folder of the executable', () => {
    expect(resolveDataRoot({ isPackaged: true, env: {}, execPath: path.join('C:', 'app', 'NoahsAnt.exe'), devRoot: 'dev' })).toBe(path.join('C:', 'app'))
  })
})

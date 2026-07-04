/**
 * @jest-environment jsdom
 */

const { isValidProjectName } = require('../public/scripts/project-utils')

describe('Walidacja nazw projektów', () => {
  test('poprawna nazwa projektu zwraca true', () => {
    expect(isValidProjectName('Badanie Szczurów - Lab 3')).toBe(true)
  })

  test('pusta nazwa projektu jest zablokowana', () => {
    expect(isValidProjectName('')).toBe(false)
    expect(isValidProjectName('   ')).toBe(false)
  })

  test('nazwa projektu zawierająca niedozwolony znak jest zablokowana', () => {
    expect(isValidProjectName('Badanie/Projekt')).toBe(false)
    expect(isValidProjectName('Badanie:Projekt')).toBe(false)
    expect(isValidProjectName('Badanie?Projekt')).toBe(false)
  })

  test('krótka nazwa projektu jest zablokowana', () => {
    expect(isValidProjectName('ab')).toBe(false)
  })
})

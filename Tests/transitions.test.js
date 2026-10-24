/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals'
import { START, buildTransitions, transitionMatrix } from '../public/scripts/workspace/transitions/transition-model.js'
import { renderTransitionSvg, layoutNodes } from '../public/scripts/workspace/transitions/transition-svg.js'
import { createTransitionsModule } from '../public/scripts/workspace/transitions/transitions-module.js'

const animals = [{ id: 'a', groupId: 'g1', name: 'A' }, { id: 'b', groupId: 'g2', name: 'B' }]
const groups = [{ id: 'g1', name: 'Gatunek 1' }, { id: 'g2', name: 'Gatunek 2' }]
const trials = [{ id: 't1', name: 'Test 1', duration: 100, skips: [] }, { id: 't2', name: 'Test 2', duration: 100, skips: [] }]
let counter = 0
const ev = (animalId, trialId, name, start, end) => ({
  id: `e${counter += 1}`, animalId, trialId, activityId: name, activityName: name, activityColor: '#fff', kind: end === undefined ? 'point' : 'interval', start, end: end ?? start, lane: null
})
const source = (observations, extraTrials = trials) => ({ observations, trials: extraTrials, animals, groups })
const edge = (result, from, to) => result.edges.find((item) => item.from === from && item.to === to)

describe('transition probabilities', () => {
  test('counts what follows what, per animal and trial, and the rows add up to 1', () => {
    const result = buildTransitions(source([
      ev('a', 't1', 'Stoi', 0, 5), ev('a', 't1', 'Idzie', 5, 10), ev('a', 't1', 'Stoi', 10, 12), ev('a', 't1', 'Leży', 12, 20),
      ev('a', 't2', 'Stoi', 0, 5), ev('a', 't2', 'Idzie', 6, 9),
      ev('b', 't1', 'Leży', 0, 3)
    ]))
    expect(edge(result, 'Stoi', 'Idzie')).toMatchObject({ count: 2, probability: 2 / 3 })
    expect(edge(result, 'Stoi', 'Leży')).toMatchObject({ count: 1, probability: 1 / 3 })
    expect(edge(result, 'Idzie', 'Stoi')).toMatchObject({ count: 1, probability: 1 })
    // the animal B had one event only, and nothing connects different animals or trials
    expect(result.edges.some((item) => item.from === 'Leży')).toBe(false)
    expect(result.units).toBe(3)
    expect(result.totalTransitions).toBe(4)
  })

  test('a repeated behavior is a loop, point events can be left out, and filters narrow the data', () => {
    const observations = [ev('a', 't1', 'Stoi', 0, 2), ev('a', 't1', 'Stoi', 3, 5), ev('a', 't1', 'kropa', 6), ev('a', 't1', 'Idzie', 7, 9), ev('b', 't1', 'Idzie', 0, 1), ev('b', 't1', 'Stoi', 2, 3)]
    const all = buildTransitions(source(observations))
    expect(edge(all, 'Stoi', 'Stoi')).toMatchObject({ count: 1, probability: 0.5 })
    expect(edge(all, 'Stoi', 'kropa')).toBeTruthy()

    expect(buildTransitions(source(observations), { includePoints: false }).edges.some((item) => item.to === 'kropa')).toBe(false)
    expect(buildTransitions(source(observations), { animalFilter: 'animal:b' }).edges.map((item) => `${item.from}>${item.to}`)).toEqual(['Idzie>Stoi'])
    expect(buildTransitions(source(observations), { animalFilter: 'group:g2' }).units).toBe(1)
    expect(buildTransitions(source(observations), { trialIds: new Set(['t2']) }).units).toBe(0)
    expect(buildTransitions(source(observations), { behaviors: new Set(['Stoi']) }).edges).toHaveLength(1)
  })

  test('parallel mode makes states out of behaviors that run together', () => {
    const result = buildTransitions(source([ev('a', 't1', 'Stoi', 0, 10), ev('a', 't1', 'Idzie', 4, 7), ev('a', 't1', 'kropa', 5)]), { mode: 'parallel' })
    expect(result.nodes.map((node) => node.label).sort()).toEqual(['Idzie + Stoi', 'Stoi'])
    expect(edge(result, 'Stoi', 'Idzie + Stoi')).toMatchObject({ count: 1, probability: 1 })
    expect(edge(result, 'Idzie + Stoi', 'Stoi')).toMatchObject({ count: 1 })
  })

  test('the START node counts the first behavior of every animal and trial, with its latency', () => {
    const result = buildTransitions(source([ev('a', 't1', 'Stoi', 10, 12), ev('a', 't2', 'Stoi', 30, 32), ev('b', 't1', 'Idzie', 4, 5)]), { includeStart: true })
    expect(edge(result, START, 'Stoi')).toMatchObject({ count: 2, probability: 2 / 3, meanLatency: 20 })
    expect(edge(result, START, 'Idzie')).toMatchObject({ meanLatency: 4 })
    expect(result.nodes[0].id).toBe(START)
  })

  test('uncounted skips and the analysis window are respected', () => {
    const skipTrial = [{ ...trials[0], skips: [{ id: 's', start: 5, end: 8, countTime: false }], windowStart: 1 }]
    const result = buildTransitions(source([ev('a', 't1', 'Przed', 0, 0.5), ev('a', 't1', 'W', 5.5, 6), ev('a', 't1', 'Stoi', 2, 4), ev('a', 't1', 'Idzie', 9, 10)], skipTrial))
    expect(result.nodes.map((node) => node.label).sort()).toEqual(['Idzie', 'Stoi'])
  })

  test('builds a matrix of the same numbers', () => {
    const matrix = transitionMatrix(buildTransitions(source([ev('a', 't1', 'A', 0, 1), ev('a', 't1', 'B', 2, 3)])))
    expect(matrix.columns).toEqual(['A', 'B'])
    expect(matrix.rows).toHaveLength(1)
    expect(matrix.rows[0].cells[1]).toMatchObject({ probability: 1 })
  })
})

describe('transition diagram', () => {
  const result = buildTransitions(source([ev('a', 't1', 'Stoi', 0, 2), ev('a', 't1', 'Idzie', 3, 4), ev('a', 't1', 'Stoi', 5, 6), ev('a', 't1', 'Stoi', 7, 8)]))

  test('draws a node per state, an arrow with its probability and a loop', () => {
    const svg = renderTransitionSvg(result, { showProbabilities: true, showCounts: true, title: 'Przejścia' })
    expect((svg.match(/<ellipse/g) || [])).toHaveLength(2)
    expect(svg).toContain('0.500')
    expect(svg).toContain('1.000')
    expect(svg).toContain('(1×)')
    expect(svg).toContain('marker-end="url(#arrow)"')
    expect(svg).toContain('Przejścia')
    expect(renderTransitionSvg(result, { showProbabilities: false })).not.toContain('>0.500')
  })

  test('hides the rare arrows', () => {
    const svg = renderTransitionSvg(result, { showProbabilities: true, minProbability: 0.9 })
    expect((svg.match(/marker-end/g) || [])).toHaveLength(1)
    const lonely = buildTransitions(source([ev('a', 't1', 'A', 0, 1), ev('a', 't1', 'B', 2, 3), ev('a', 't1', 'A', 4, 5), ev('a', 't1', 'A', 6, 7), ev('b', 't1', 'C', 0, 1), ev('b', 't1', 'D', 2, 3)]))
    expect((renderTransitionSvg(lonely, { minProbability: 0.9 }).match(/<ellipse/g) || [])).toHaveLength(4)
    expect(layoutNodes([{ label: 'A', id: 'A' }], { width: 400, height: 300 })[0]).toMatchObject({ x: 200, y: 166 })
  })
})

describe('transitions screen', () => {
  test('shows the diagram and reacts to the options', () => {
    document.body.innerHTML = '<div id="transitions-module"></div>'
    localStorage.clear()
    const observations = [ev('a', 't1', 'Stoi', 0, 2), ev('a', 't1', 'Idzie', 3, 4), ev('a', 't1', 'Stoi', 5, 6)]
    const store = { getAll: () => observations, subscribe: jest.fn() }
    createTransitionsModule().init('transitions-module', {
      observationStore: store,
      animalCatalog: { getData: () => ({ animals, groups }), getPresets: () => [] },
      trialCatalog: { getData: () => ({ trials }) },
      projectName: 'Study'
    })

    expect(document.querySelector('.transitions-canvas svg')).not.toBeNull()
    expect(document.querySelectorAll('.transitions-matrix tbody tr')).toHaveLength(2)

    const counts = document.querySelector('[data-opt="showCounts"]')
    counts.checked = true
    counts.dispatchEvent(new Event('change', { bubbles: true }))
    expect(document.querySelector('.transitions-canvas svg').textContent).toContain('1×')

    const trial = document.querySelector('[data-trial="t1"]')
    trial.checked = false
    trial.dispatchEvent(new Event('change', { bubbles: true }))
    expect(document.querySelector('.transitions-canvas.empty')).not.toBeNull()
    document.querySelector('[data-all-trials]').click()
    expect(document.querySelector('.transitions-canvas svg')).not.toBeNull()

    const mode = document.querySelector('[data-mode]')
    mode.value = 'parallel'
    mode.dispatchEvent(new Event('change', { bubbles: true }))
    expect(document.querySelector('[data-opt="includePoints"]').disabled).toBe(true)
  })
})

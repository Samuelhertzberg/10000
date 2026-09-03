import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BankedPointsScoreEvent,
  buildBankedPointsHeatmap,
} from '../src/bankedPointsHeatmap.js'

const event = (
  id: string,
  slot: number,
  points: number,
  totalScore: number | null,
  createdAt: number,
  maxPoints: number | null = 10000,
): BankedPointsScoreEvent => ({
  id,
  slot,
  points,
  totalScore,
  createdAt: new Date(createdAt),
  maxPoints,
})

test('groups accepted points by the score before banking', () => {
  const result = buildBankedPointsHeatmap(new Map([
    ['session-1', [event('a', 0, 500, 3500, 1)]],
  ]), new Map())

  assert.deepEqual(result, {
    bin_size: 50,
    cells: [{ current_score: 3000, accepted_points: 500, round_count: 1 }],
  })
})

test('combines repeated pairs and keeps players and sessions separate', () => {
  const result = buildBankedPointsHeatmap(new Map([
    ['session-1', [
      event('a', 0, 3000, null, 1),
      event('b', 0, 500, null, 2),
      event('c', 1, 3000, null, 3),
      event('d', 1, 500, null, 4),
    ]],
    ['session-2', [
      event('e', 0, 3000, null, 1),
      event('f', 0, 500, null, 2),
    ]],
  ]), new Map())

  assert.deepEqual(result.cells, [
    { current_score: 0, accepted_points: 3000, round_count: 3 },
    { current_score: 3000, accepted_points: 500, round_count: 3 },
  ])
})

test('reconstructs current scores for old events without total_score', () => {
  const result = buildBankedPointsHeatmap(new Map([
    ['session-1', [
      event('b', 0, 500, null, 2),
      event('a', 0, 3000, null, 1),
      event('c', 1, 1000, null, 3),
    ]],
  ]), new Map())

  assert.deepEqual(result.cells, [
    { current_score: 0, accepted_points: 1000, round_count: 1 },
    { current_score: 0, accepted_points: 3000, round_count: 1 },
    { current_score: 3000, accepted_points: 500, round_count: 1 },
  ])
})

test('uses corrections in later scores but does not count them as payouts', () => {
  const result = buildBankedPointsHeatmap(new Map([
    ['session-1', [
      event('a', 0, 3051, null, 1),
      event('b', 0, -51, null, 2),
      event('c', 0, 549, null, 3),
      event('d', 0, 0, null, 4),
    ]],
  ]), new Map())

  assert.deepEqual(result.cells, [
    { current_score: 0, accepted_points: 3050, round_count: 1 },
    { current_score: 3000, accepted_points: 500, round_count: 1 },
  ])
})

test('includes a winning round and excludes later rounds from that player', () => {
  const result = buildBankedPointsHeatmap(new Map([
    ['session-1', [
      event('a', 0, 500, 10000, 1),
      event('b', 0, -1000, 9000, 2),
      event('c', 0, 500, 9500, 3),
    ]],
  ]), new Map([['session-1', 10000]]))

  assert.deepEqual(result.cells, [
    { current_score: 9500, accepted_points: 500, round_count: 1 },
  ])
})

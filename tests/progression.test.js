import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggest, findLastEntry } from '../js/progression.js';

const press = { id: 'p', type: 'reps', sets: 3, min: 6, max: 8, incKg: 2 };
const done = (kg, reps) => ({ kg, reps, done: true });

test('no history -> start without weight', () => {
  assert.deepEqual(suggest(press, null), { action: 'start', kg: null });
});

test('all sets at top of range with RIR >= 1 -> up by increment', () => {
  const last = { sets: [done(24, 8), done(24, 8), done(24, 8)], rir: 1 };
  assert.deepEqual(suggest(press, last), { action: 'up', kg: 26 });
});

test('empty RIR counts as acceptable', () => {
  const last = { sets: [done(24, 8), done(24, 9), done(24, 8)], rir: null };
  assert.equal(suggest(press, last).action, 'up');
});

test('top of range but RIR 0 -> hold', () => {
  const last = { sets: [done(24, 8), done(24, 8), done(24, 8)], rir: 0 };
  assert.deepEqual(suggest(press, last), { action: 'hold', kg: 24 });
});

test('one set short of max -> hold at heaviest weight', () => {
  const last = { sets: [done(24, 8), done(24, 8), done(22, 7)], rir: 2 };
  assert.deepEqual(suggest(press, last), { action: 'hold', kg: 24 });
});

test('fewer completed sets than target -> hold', () => {
  const last = { sets: [done(24, 8), done(24, 8)], rir: 2 };
  assert.equal(suggest(press, last).action, 'hold');
});

test('every completed set below min -> down by increment', () => {
  const last = { sets: [done(30, 5), done(30, 4), done(30, 4)], rir: 0 };
  assert.deepEqual(suggest(press, last), { action: 'down', kg: 28 });
});

test('down never goes below zero', () => {
  const ex = { ...press, incKg: 5 };
  const last = { sets: [done(2, 3), done(2, 3), done(2, 3)], rir: 0 };
  assert.equal(suggest(ex, last).kg, 0);
});

test('assisted (negative kg) going up reduces assistance instead of clamping to zero', () => {
  const pullup = { id: 'pu', type: 'reps', sets: 3, min: 6, max: 10, incKg: 2.5 };
  const last = { sets: [done(-20, 10), done(-20, 10), done(-20, 10)], rir: 1 };
  assert.deepEqual(suggest(pullup, last), { action: 'up', kg: -17.5 });
});

test('assisted (negative kg) going down adds assistance', () => {
  const pullup = { id: 'pu', type: 'reps', sets: 3, min: 6, max: 10, incKg: 2.5 };
  const last = { sets: [done(-20, 4), done(-20, 4), done(-20, 3)], rir: 0 };
  assert.deepEqual(suggest(pullup, last), { action: 'down', kg: -22.5 });
});

test('weighted (positive kg) going up adds load as usual', () => {
  const pullup = { id: 'pu', type: 'reps', sets: 3, min: 6, max: 10, incKg: 2.5 };
  const last = { sets: [done(10, 10), done(10, 10), done(10, 10)], rir: 2 };
  assert.deepEqual(suggest(pullup, last), { action: 'up', kg: 12.5 });
});

test('time exercise without weight -> up keeps kg null', () => {
  const plank = { id: 't', type: 'time', sets: 3, min: 30, max: 45, incKg: 0 };
  const last = { sets: [done(null, 45), done(null, 50), done(null, 45)], rir: null };
  assert.deepEqual(suggest(plank, last), { action: 'up', kg: null });
});

test('sets not marked done are ignored', () => {
  const last = { sets: [done(24, 8), done(24, 8), { kg: 24, reps: 8, done: false }], rir: 1 };
  assert.equal(suggest(press, last).action, 'hold');
});

test('findLastEntry returns most recent session entry with done sets', () => {
  const logs = [
    { date: '2026-11-02', exercises: [{ exId: 'p', sets: [done(22, 8)], rir: 1 }] },
    { date: '2026-11-09', exercises: [{ exId: 'p', sets: [done(24, 8)], rir: 1 }] },
    { date: '2026-11-16', exercises: [{ exId: 'p', sets: [{ kg: 26, reps: null, done: false }], rir: null }] },
  ];
  assert.equal(findLastEntry(logs, 'p').sets[0].kg, 24);
  assert.equal(findLastEntry(logs, 'x'), null);
});

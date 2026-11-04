import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exerciseSeries, streaks, heatmapWeeks } from '../js/stats.js';

const done = (kg, reps) => ({ kg, reps, done: true });
const log = (date, exercises) => ({ id: `l${date}`, date, dayId: 'd1', dayName: 'A', exercises });

test('exerciseSeries returns top kg and best reps at that kg per session, in date order', () => {
  const logs = [
    log('2026-10-01', [{ exId: 'p', sets: [done(20, 8), done(22, 6), done(22, 7)] }]),
    log('2026-10-03', [{ exId: 'x', sets: [done(50, 5)] }]),
    log('2026-10-05', [{ exId: 'p', sets: [done(22, 8)] }]),
  ];
  assert.deepEqual(exerciseSeries(logs, 'p'), [
    { date: '2026-10-01', kg: 22, reps: 7 },
    { date: '2026-10-05', kg: 22, reps: 8 },
  ]);
});

test('exerciseSeries without weight uses best reps or seconds', () => {
  const logs = [log('2026-10-01', [{ exId: 't', sets: [done(null, 40), done(null, 45)] }])];
  assert.deepEqual(exerciseSeries(logs, 't'), [{ date: '2026-10-01', kg: null, reps: 45 }]);
});

test('exerciseSeries keeps assisted (negative) loads', () => {
  const logs = [log('2026-10-01', [{ exId: 'pu', sets: [done(-20, 8), done(-25, 10)] }])];
  assert.deepEqual(exerciseSeries(logs, 'pu'), [{ date: '2026-10-01', kg: -20, reps: 8 }]);
});

test('streaks counts consecutive training days, current alive if trained yesterday', () => {
  const dates = ['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'];
  assert.deepEqual(streaks(dates, '2026-11-03'), { current: 4, longest: 4 });
  assert.deepEqual(streaks(dates, '2026-11-02'), { current: 4, longest: 4 });
  assert.deepEqual(streaks(dates, '2026-11-05'), { current: 0, longest: 4 });
  assert.deepEqual(streaks([], '2026-11-05'), { current: 0, longest: 0 });
});

test('streaks ignores duplicate dates', () => {
  assert.deepEqual(streaks(['2026-11-02', '2026-11-02', '2026-11-03'], '2026-11-03'), { current: 2, longest: 2 });
});

test('heatmapWeeks builds Monday-first weeks ending on the week of today, future days null', () => {
  const weeks = heatmapWeeks('2026-11-04', 2); // Wednesday
  assert.equal(weeks.length, 2);
  assert.deepEqual(weeks[0], ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
  assert.deepEqual(weeks[1], ['2026-11-02', '2026-11-03', '2026-11-04', null, null, null, null]);
});

test('streaks ignores sessions dated after today', () => {
  assert.deepEqual(streaks(['2026-11-02', '2026-11-03', '2026-11-10'], '2026-11-03'), { current: 2, longest: 2 });
});

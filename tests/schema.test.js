import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBackup } from '../js/schema.js';

const valid = () => ({
  app: 'rutina',
  routine: {
    version: 1, context: 'Contexto de prueba',
    days: [{ id: 'd1', name: 'Empuje A', weekday: 1, exercises: [
      { id: 'e1', name: 'Press', type: 'reps', sets: 3, min: 6, max: 8, restSec: 150, incKg: 2, perSide: false, notes: '' },
    ] }],
  },
  logs: [{ id: 'l1', date: '2026-11-02', dayId: 'd1', dayName: 'Empuje A', exercises: [
    { exId: 'e1', name: 'Press', type: 'reps', rir: 1, sets: [{ kg: 24, reps: 8, done: true }] },
  ] }],
});

test('valid backup passes unchanged', () => {
  assert.deepEqual(parseBackup(valid()), { routine: valid().routine, logs: valid().logs });
});

test('rejects non-backup input', () => {
  assert.throws(() => parseBackup(null), /backup válido/);
  assert.throws(() => parseBackup({ app: 'otra' }), /backup válido/);
});

test('rejects ids that could break out of HTML attributes', () => {
  const d = valid(); d.routine.days[0].exercises[0].id = 'e1" onmouseover="alert(1)';
  assert.throws(() => parseBackup(d), /id inválido/);
});

test('rejects malformed dates', () => {
  const d = valid(); d.logs[0].date = '<img src=x onerror=alert(1)>';
  assert.throws(() => parseBackup(d), /fecha inválida/);
});

test('rejects non-numeric set values', () => {
  const d = valid(); d.logs[0].exercises[0].sets[0].kg = '<script>alert(1)</script>';
  assert.throws(() => parseBackup(d), /número inválido/);
});

test('rejects non-numeric routine numbers', () => {
  const d = valid(); d.routine.days[0].exercises[0].max = '8"><script>';
  assert.throws(() => parseBackup(d), /número inválido/);
});

test('rejects unknown exercise type', () => {
  const d = valid(); d.routine.days[0].exercises[0].type = 'x" onclick="y';
  assert.throws(() => parseBackup(d), /tipo inválido/);
});

test('drops unknown fields and coerces optional ones', () => {
  const d = valid();
  d.routine.days[0].evil = '<b>'; delete d.routine.context;
  d.routine.days[0].weekday = null;
  const out = parseBackup(d);
  assert.equal('evil' in out.routine.days[0], false);
  assert.equal(out.routine.context, '');
  assert.equal(out.routine.days[0].weekday, null);
});

test('text fields are kept as plain strings (escaped later at render)', () => {
  const d = valid(); d.routine.days[0].name = '<b>Pecho</b>';
  assert.equal(parseBackup(d).routine.days[0].name, '<b>Pecho</b>');
});

test('session note survives import and stays absent when missing', () => {
  const data = { app: 'rutina', routine: { days: [] }, logs: [
    { id: 'l1', date: '2026-11-02', dayId: 'd1', dayName: 'A', note: 'Dormí mal', exercises: [] },
    { id: 'l2', date: '2026-11-03', dayId: 'd1', dayName: 'A', exercises: [] },
  ] };
  const { logs } = parseBackup(data);
  assert.equal(logs[0].note, 'Dormí mal');
  assert.equal('note' in logs[1], false);
  const long = parseBackup({ ...data, logs: [{ ...data.logs[0], note: 'x'.repeat(900) }] });
  assert.equal(long.logs[0].note.length, 500);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCsv, toClaudeMarkdown } from '../js/export.js';

const routine = {
  days: [{
    id: 'd1', name: 'Empuje A', weekday: 1, exercises: [
      { id: 'e1', name: 'Press inclinado', type: 'reps', sets: 3, min: 6, max: 8, restSec: 150, incKg: 2, perSide: false, notes: '' },
      { id: 'e2', name: 'Plancha, lateral', type: 'time', sets: 2, min: 30, max: 45, restSec: 45, incKg: 0, perSide: true, notes: '' },
    ],
  }],
};
const logs = [{
  id: 'l1', date: '2026-11-02', dayId: 'd1', dayName: 'Empuje A', exercises: [
    { exId: 'e1', name: 'Press inclinado', type: 'reps', rir: 1, sets: [
      { kg: 24, reps: 8, done: true }, { kg: 24, reps: 8, done: true }, { kg: 24, reps: 8, done: true },
    ] },
    { exId: 'e2', name: 'Plancha, lateral', type: 'time', rir: null, sets: [{ kg: null, reps: 40, done: true }] },
  ],
}];

test('csv has header and one row per done set, quoting commas', () => {
  const lines = toCsv(logs).trim().split('\n');
  assert.equal(lines[0], 'date,day,exercise,type,set,kg,reps_or_seconds,rir');
  assert.equal(lines.length, 5);
  assert.equal(lines[1], '2026-11-02,Empuje A,Press inclinado,reps,1,24,8,1');
  assert.equal(lines[4], '2026-11-02,Empuje A,"Plancha, lateral",time,1,,40,');
});

test('claude markdown includes routine, sessions and current suggestion', () => {
  const md = toClaudeMarkdown(routine, logs, { today: '2026-11-03', weeks: 8 });
  assert.match(md, /Press inclinado: 3 × 6–8 reps, descanso 150 s, progresión \+2 kg/);
  assert.match(md, /### 2026-11-02 · Empuje A/);
  assert.match(md, /- Press inclinado: 24×8, 24×8, 24×8 \(RIR 1\)/);
  assert.match(md, /- Plancha, lateral: 40 s/);
  assert.match(md, /Press inclinado: SUBIR → 26 kg/);
});

test('claude markdown skips sessions older than the window', () => {
  const md = toClaudeMarkdown(routine, logs, { today: '2027-03-01', weeks: 8 });
  assert.doesNotMatch(md, /### 2026-11-02/);
});

test('csv neutralizes text that spreadsheets would run as a formula', () => {
  const evil = [{ date: '2026-11-02', dayName: '=HYPERLINK("http://x")', exercises: [
    { name: '@SUM(A1)', type: 'reps', rir: null, sets: [{ kg: -10, reps: 8, done: true }] },
  ] }];
  const row = toCsv(evil).trim().split('\n')[1];
  assert.equal(row, `2026-11-02,"'=HYPERLINK(""http://x"")",'@SUM(A1),reps,1,-10,8,`);
});

test('claude markdown includes user context only when configured', () => {
  assert.doesNotMatch(toClaudeMarkdown(routine, logs, { today: '2026-11-03' }), /Contexto:/);
  const md = toClaudeMarkdown({ ...routine, context: 'Contexto de prueba' }, logs, { today: '2026-11-03' });
  assert.match(md, /Contexto: Contexto de prueba/);
});

test('claude markdown includes the session note when present', () => {
  const withNote = [{ ...logs[0], note: 'Hombro izquierdo hizo click en press' }];
  const md = toClaudeMarkdown(routine, withNote, { today: '2026-11-03' });
  assert.match(md, /### 2026-11-02 · Empuje A\nNota: Hombro izquierdo hizo click en press\n/);
  assert.doesNotMatch(toClaudeMarkdown(routine, logs, { today: '2026-11-03' }), /Nota:/);
});

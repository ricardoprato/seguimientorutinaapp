import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, buildRoutine, emptyRoutine } from '../js/presets.js';
import { parseBackup } from '../js/schema.js';

test('offers several presets with name and description', () => {
  assert.ok(PRESETS.length >= 4);
  for (const p of PRESETS) {
    assert.ok(p.id && p.name && p.description, p.id);
    assert.ok(p.days.length > 0, p.id);
  }
});

test('every preset builds a routine that passes import validation', () => {
  for (const p of PRESETS) {
    const routine = buildRoutine(p.id);
    assert.doesNotThrow(() => parseBackup({ app: 'rutina', routine, logs: [] }), p.id);
  }
});

test('ids are unique inside a built routine', () => {
  for (const p of PRESETS) {
    const r = buildRoutine(p.id);
    const ids = [...r.days.map((d) => d.id), ...r.days.flatMap((d) => d.exercises.map((e) => e.id))];
    assert.equal(new Set(ids).size, ids.length, p.id);
  }
});

test('no preset assigns two days to the same weekday', () => {
  for (const p of PRESETS) {
    const wd = p.days.map((d) => d.weekday).filter((w) => w != null);
    assert.equal(new Set(wd).size, wd.length, p.id);
  }
});

test('min never exceeds max and sets are positive', () => {
  for (const p of PRESETS) {
    for (const e of p.days.flatMap((d) => d.exercises)) {
      assert.ok(e.min <= e.max && e.sets >= 1, `${p.id}: ${e.name}`);
    }
  }
});

test('built routine starts without personal context', () => {
  for (const p of PRESETS) assert.equal(buildRoutine(p.id).context, '');
});

test('unknown preset fails fast; empty routine has no days', () => {
  assert.throws(() => buildRoutine('nope'), /Plantilla desconocida/);
  assert.deepEqual(emptyRoutine(), { version: 1, context: '', days: [] });
});

test('two builds never share ids, so old history is not mixed with a new routine', () => {
  const ids = (r) => r.days.flatMap((d) => [d.id, ...d.exercises.map((e) => e.id)]);
  const a = new Set(ids(buildRoutine('ppl6')));
  assert.ok(ids(buildRoutine('ppl6')).every((x) => !a.has(x)));
});

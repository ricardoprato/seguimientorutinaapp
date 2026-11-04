// Strict whitelist for data coming from outside the app (imported backups, linked files).
// Anything that is not exactly the expected shape is rejected, so it never reaches the DOM.

const ID = /^[A-Za-z0-9_-]{1,40}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TYPES = ['reps', 'time'];
const MAX_TEXT = 500;

function fail(msg) { throw new Error(`El archivo no es un backup válido: ${msg}.`); }

const id = (v) => (typeof v === 'string' && ID.test(v) ? v : fail(`id inválido (${String(v).slice(0, 20)})`));
const date = (v) => (typeof v === 'string' && DATE.test(v) ? v : fail('fecha inválida'));
const type = (v) => (TYPES.includes(v) ? v : fail('tipo inválido'));
const text = (v, fallback = '') => (v == null ? fallback : String(v).slice(0, MAX_TEXT));
const bool = (v) => v === true;
const list = (v, what) => (Array.isArray(v) ? v : fail(`${what} no es una lista`));

function number(v, { nullable = false } = {}) {
  if (v == null && nullable) return null;
  return typeof v === 'number' && Number.isFinite(v) ? v : fail('número inválido');
}

const exercise = (e) => ({
  id: id(e.id), name: text(e.name), type: type(e.type),
  sets: number(e.sets), min: number(e.min), max: number(e.max),
  restSec: number(e.restSec), incKg: number(e.incKg),
  perSide: bool(e.perSide), notes: text(e.notes),
});

const day = (d) => ({
  id: id(d.id), name: text(d.name),
  weekday: d.weekday == null ? null : number(d.weekday),
  exercises: list(d.exercises, 'ejercicios').map(exercise),
});

const setEntry = (s) => ({ kg: number(s.kg, { nullable: true }), reps: number(s.reps, { nullable: true }), done: bool(s.done) });

const logExercise = (e) => ({
  exId: id(e.exId), name: text(e.name), type: type(e.type),
  rir: number(e.rir, { nullable: true }), sets: list(e.sets, 'series').map(setEntry),
});

const log = (l) => ({
  id: id(l.id), date: date(l.date), dayId: id(l.dayId), dayName: text(l.dayName),
  ...(l.note != null && { note: text(l.note) }),
  exercises: list(l.exercises, 'ejercicios').map(logExercise),
});

export function parseBackup(data) {
  if (!data || typeof data !== 'object' || data.app !== 'rutina' || !data.routine || typeof data.routine !== 'object') {
    fail('formato desconocido');
  }
  return {
    routine: { version: 1, context: text(data.routine.context), days: list(data.routine.days, 'días').map(day) },
    logs: list(data.logs, 'sesiones').map(log),
  };
}

import { suggest, findLastEntry } from './progression.js';

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const ACTION_LABEL = { start: 'EMPEZAR', up: 'SUBIR', hold: 'MANTENER', down: 'BAJAR' };

// Text cells starting with = + - @ are prefixed so spreadsheets don't run them as formulas.
const csvCell = (v) => {
  let s = v == null ? '' : String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(logs) {
  const rows = [['date', 'day', 'exercise', 'type', 'set', 'kg', 'reps_or_seconds', 'rir']];
  for (const log of logs) {
    for (const e of log.exercises) {
      e.sets.filter((s) => s.done).forEach((s, i) => {
        rows.push([log.date, log.dayName, e.name, e.type, i + 1, s.kg, s.reps, e.rir]);
      });
    }
  }
  return rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}

export const formatSet = (s, type) =>
  type === 'time' ? `${s.kg != null ? `${s.kg} kg · ` : ''}${s.reps} s` : `${s.kg ?? 0}×${s.reps}`;

export const formatTarget = (e) =>
  `${e.sets} × ${e.min}–${e.max} ${e.type === 'time' ? 's' : 'reps'}${e.perSide ? ' por lado' : ''}`;

export function toClaudeMarkdown(routine, logs, { today, weeks = 8 }) {
  const from = new Date(`${today}T00:00:00`);
  from.setDate(from.getDate() - weeks * 7);
  const fromIso = from.toISOString().slice(0, 10);
  const out = [`# Mi registro de entrenamiento (exportado ${today})`, ''];

  out.push('## Rutina configurada', '');
  for (const day of routine.days) {
    out.push(`### ${day.name}${day.weekday != null ? ` (${WEEKDAYS[day.weekday]})` : ''}`);
    for (const e of day.exercises) {
      out.push(`- ${e.name}: ${formatTarget(e)}, descanso ${e.restSec} s, progresión +${e.incKg} kg${e.notes ? `. ${e.notes}` : ''}`);
    }
    out.push('');
  }

  out.push(`## Sesiones (últimas ${weeks} semanas)`, '');
  const recent = logs.filter((l) => l.date >= fromIso);
  if (!recent.length) out.push('Sin sesiones en el período.', '');
  for (const log of recent) {
    out.push(`### ${log.date} · ${log.dayName}`);
    for (const e of log.exercises) {
      const sets = e.sets.filter((s) => s.done).map((s) => formatSet(s, e.type)).join(', ');
      out.push(`- ${e.name}: ${sets}${e.rir != null ? ` (RIR ${e.rir})` : ''}`);
    }
    out.push('');
  }

  out.push('## Sugerencia actual de la app (doble progresión)', '');
  for (const day of routine.days) {
    for (const e of day.exercises) {
      const last = findLastEntry(logs, e.id);
      if (!last) continue;
      const s = suggest(e, last);
      out.push(`- ${e.name}: ${ACTION_LABEL[s.action]}${s.kg != null ? ` → ${s.kg} kg` : ''}`);
    }
  }
  if (routine.context?.trim()) out.push('', `Contexto: ${routine.context.trim()}`);
  out.push('', 'Analizá mi progreso: estancamientos, volumen por grupo muscular, y qué ajustarías para la próxima semana.');
  return out.join('\n');
}

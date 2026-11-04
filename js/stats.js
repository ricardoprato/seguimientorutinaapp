// Pure helpers for the progress chart and the training-streak heatmap.
// Dates are ISO strings (YYYY-MM-DD); math runs in UTC so time zones never shift a day.

const DAY_MS = 86400000;
const toMs = (iso) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const toIso = (ms) => new Date(ms).toISOString().slice(0, 10);

// One point per session: heaviest load used and best reps (or seconds) at that load.
export function exerciseSeries(logs, exId) {
  const points = [];
  for (const log of logs) {
    const entry = log.exercises.find((e) => e.exId === exId);
    const sets = entry?.sets.filter((s) => s.done && s.reps != null) ?? [];
    if (!sets.length) continue;
    const weights = sets.map((s) => s.kg).filter((kg) => kg != null);
    const kg = weights.length ? Math.max(...weights) : null;
    const reps = Math.max(...sets.filter((s) => kg == null || s.kg === kg).map((s) => s.reps));
    points.push({ date: log.date, kg, reps });
  }
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

// Consecutive training days. The current streak stays alive until a full day is missed.
export function streaks(dates, today) {
  const days = [...new Set(dates)].map(toMs).sort((a, b) => a - b);
  let longest = 0;
  let run = 0;
  days.forEach((d, i) => {
    run = i > 0 && d - days[i - 1] === DAY_MS ? run + 1 : 1;
    longest = Math.max(longest, run);
  });
  const last = days.at(-1);
  const gap = last == null ? Infinity : (toMs(today) - last) / DAY_MS;
  return { current: gap <= 1 ? run : 0, longest };
}

// `count` Monday-first weeks, the last one containing today. Days after today are null.
export function heatmapWeeks(today, count) {
  const end = toMs(today);
  const mondayOffset = (new Date(end).getUTCDay() + 6) % 7;
  const start = end - (mondayOffset + (count - 1) * 7) * DAY_MS;
  return Array.from({ length: count }, (_, w) => Array.from({ length: 7 }, (_, d) => {
    const ms = start + (w * 7 + d) * DAY_MS;
    return ms > end ? null : toIso(ms);
  }));
}
